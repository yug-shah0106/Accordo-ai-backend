import { z } from "zod";

export const OfferSchema = z.object({
  unit_price: z.number().nullable(),
  payment_terms: z.enum(["Net 30", "Net 60", "Net 90"]).nullable(),
  meta: z.object({
    raw_terms_days: z.number().optional(),
    non_standard_terms: z.boolean().optional(),
  }).optional(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const DecisionSchema = z.object({
  action: z.enum(["ACCEPT", "COUNTER", "WALK_AWAY", "ESCALATE", "ASK_CLARIFY"]),
  utilityScore: z.number(),
  counterOffer: OfferSchema.nullable(),
  reasons: z.array(z.string()),
});
export type Decision = z.infer<typeof DecisionSchema>;

export type Explainability = {
  vendorOffer: { unit_price: number | null; payment_terms: string | null };
  utilities: {
    priceUtility: number | null;
    termsUtility: number | null;
    weightedPrice: number | null;
    weightedTerms: number | null;
    total: number | null;
  };
  decision: {
    action: string;
    reasons: string[];
    counterOffer?: { unit_price: number | null; payment_terms: string | null } | null;
  };
  configSnapshot: {
    weights: { price: number; terms: number };
    thresholds: { accept: number; escalate: number; walkaway: number };
    unitPrice: { anchor: number; target: number; max: number; step: number };
    termOptions: string[];
  };
};

// ============================================
// WEIGHTED UTILITY TYPES (Step 4 Integration)
// ============================================

/**
 * Parameter utility types - how utility is calculated for each parameter
 */
export type ParameterUtilityType = 'linear' | 'binary' | 'stepped' | 'date' | 'percentage' | 'boolean';

/**
 * Parameter direction - which direction is better
 */
export type ParameterDirection = 'lower_better' | 'higher_better' | 'match_target' | 'closer_better';

/**
 * Parameter status based on utility score
 */
export type ParameterStatus = 'excellent' | 'good' | 'warning' | 'critical';

/**
 * Configuration for a single weighted parameter
 */
export interface WeightedParameterConfig {
  id: string;
  name: string;
  weight: number;                    // 0-100, from Step 4 wizard
  source: 'step2' | 'step3' | 'custom';
  utilityType: ParameterUtilityType;
  direction: ParameterDirection;
  target: number | string | boolean | null;
  min?: number | string | null;
  max?: number | string | null;
  // For stepped utility (like payment terms)
  options?: string[];
  optionUtilities?: Record<string, number>;
}

/**
 * Individual parameter utility result
 */
export interface ParameterUtilityResult {
  parameterId: string;
  parameterName: string;
  utility: number;                   // 0-1
  weight: number;                    // 0-100
  contribution: number;              // utility × (weight / 100)
  currentValue: number | string | boolean | null;
  targetValue: number | string | boolean | null;
  maxValue?: number | string | null;
  status: ParameterStatus;
  color: string;                     // For UI display
}

/**
 * Threshold configuration for decisions
 */
export interface ThresholdConfig {
  accept: number;                    // Default: 0.70 (70%)
  escalate: number;                  // Default: 0.50 (50%)
  walkAway: number;                  // Default: 0.30 (30%)
}

/**
 * Default threshold values
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  accept: 0.70,
  escalate: 0.50,
  walkAway: 0.30,
};

/**
 * Complete weighted utility calculation result
 */
export interface WeightedUtilityResult {
  totalUtility: number;              // 0-1
  totalUtilityPercent: number;       // 0-100 for display
  parameterUtilities: Record<string, ParameterUtilityResult>;
  thresholds: ThresholdConfig;
  recommendation: 'ACCEPT' | 'COUNTER' | 'ESCALATE' | 'WALK_AWAY';
  recommendationReason: string;
}

/**
 * Extended negotiation config with weighted parameters
 */
export interface WeightedNegotiationConfig {
  parameters: Record<string, WeightedParameterConfig>;
  thresholds: ThresholdConfig;
  maxRounds: number;
  // Legacy support
  legacyConfig?: {
    unit_price: {
      weight: number;
      anchor: number;
      target: number;
      max_acceptable: number;
      concession_step: number;
    };
    payment_terms: {
      weight: number;
      options: string[];
      utility: Record<string, number>;
    };
  };
}

/**
 * Parsed offer from vendor message - extended with all parameters
 */
export interface ParsedVendorOffer {
  // Step 2 - Commercial
  unitPrice?: number | null;
  totalPrice?: number | null;
  volumeDiscount?: number | null;
  paymentTermsDays?: number | null;
  paymentTerms?: string | null;
  advancePayment?: number | null;
  deliveryDate?: string | Date | null;
  partialDelivery?: boolean | null;
  // Step 3 - Contract
  warrantyMonths?: number | null;
  lateDeliveryPenalty?: number | null;
  qualityCertifications?: string[] | null;
  // Custom parameters
  customParameters?: Record<string, number | string | boolean | null>;
  // Raw extracted text for debugging
  _raw?: Record<string, string>;
}

/**
 * Helper function to get status from utility score
 */
export function getStatusFromUtility(utility: number): ParameterStatus {
  if (utility >= 0.80) return 'excellent';
  if (utility >= 0.60) return 'good';
  if (utility >= 0.40) return 'warning';
  return 'critical';
}

/**
 * Helper function to get status color
 */
export function getStatusColor(status: ParameterStatus): string {
  switch (status) {
    case 'excellent': return '#22c55e';  // green-500
    case 'good': return '#3b82f6';       // blue-500
    case 'warning': return '#eab308';    // yellow-500
    case 'critical': return '#ef4444';   // red-500
  }
}

/**
 * Helper function to get recommendation from utility score
 */
export function getRecommendationFromUtility(
  utility: number,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): { action: 'ACCEPT' | 'COUNTER' | 'ESCALATE' | 'WALK_AWAY'; reason: string } {
  if (utility >= thresholds.accept) {
    return {
      action: 'ACCEPT',
      reason: `Utility score (${(utility * 100).toFixed(0)}%) meets acceptance threshold (${(thresholds.accept * 100).toFixed(0)}%)`
    };
  }
  if (utility < thresholds.walkAway) {
    return {
      action: 'WALK_AWAY',
      reason: `Utility score (${(utility * 100).toFixed(0)}%) is below walk-away threshold (${(thresholds.walkAway * 100).toFixed(0)}%)`
    };
  }
  if (utility < thresholds.escalate) {
    return {
      action: 'ESCALATE',
      reason: `Utility score (${(utility * 100).toFixed(0)}%) is in escalation zone (${(thresholds.walkAway * 100).toFixed(0)}%-${(thresholds.escalate * 100).toFixed(0)}%)`
    };
  }
  return {
    action: 'COUNTER',
    reason: `Utility score (${(utility * 100).toFixed(0)}%) is in negotiation zone (${(thresholds.escalate * 100).toFixed(0)}%-${(thresholds.accept * 100).toFixed(0)}%)`
  };
}

