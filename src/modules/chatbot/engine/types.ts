import { z } from "zod";

/**
 * Standard payment terms enum (for backwards compatibility)
 */
export const StandardPaymentTerms = ["Net 30", "Net 60", "Net 90"] as const;
export type StandardPaymentTerm = typeof StandardPaymentTerms[number];

/**
 * Payment terms can now be any "Net X" format where X is 1-120 days
 * We store as string format "Net X" for consistency
 */
export const OfferSchema = z.object({
  total_price: z.number().nullable(),
  // Accept any "Net X" format (X = 1-120 days) or standard terms
  payment_terms: z.string().nullable(),
  // Payment terms in days for calculations (e.g., 45 for "Net 45")
  payment_terms_days: z.number().nullable().optional(),
  // Delivery fields
  delivery_date: z.string().nullable().optional(),      // ISO date string (YYYY-MM-DD)
  delivery_days: z.number().nullable().optional(),      // Days from today
  meta: z.object({
    raw_terms_days: z.number().optional(),
    non_standard_terms: z.boolean().optional(),
    // Delivery meta
    delivery_source: z.enum(['explicit_date', 'relative_days', 'timeframe', 'asap']).optional(),
    raw_delivery_text: z.string().optional(),
    // Price parsing meta (February 2026)
    raw_price_text: z.string().optional(),
    raw_terms_text: z.string().optional(),
    // Currency meta (February 2026)
    currency_detected: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AUD']).optional(),
    currency_converted: z.boolean().optional(),
    original_currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AUD']).optional(),
    original_price: z.number().optional(),
  }).optional(),
});
export type Offer = z.infer<typeof OfferSchema>;

/**
 * Helper to check if a payment term is standard (Net 30/60/90)
 */
export function isStandardPaymentTerm(term: string | null): term is StandardPaymentTerm {
  return term !== null && StandardPaymentTerms.includes(term as StandardPaymentTerm);
}

/**
 * Extract days from payment terms string (e.g., "Net 45" -> 45)
 */
export function extractPaymentDays(term: string | null): number | null {
  if (!term) return null;
  const match = term.match(/Net\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Format days as payment terms string (e.g., 45 -> "Net 45")
 */
export function formatPaymentTerms(days: number): string {
  return `Net ${days}`;
}

export const DecisionSchema = z.object({
  action: z.enum(["ACCEPT", "COUNTER", "WALK_AWAY", "ESCALATE", "ASK_CLARIFY"]),
  utilityScore: z.number(),
  counterOffer: OfferSchema.nullable(),
  reasons: z.array(z.string()),
});
export type Decision = z.infer<typeof DecisionSchema>;

export type Explainability = {
  vendorOffer: { total_price: number | null; payment_terms: string | null };
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
    counterOffer?: { total_price: number | null; payment_terms: string | null } | null;
  };
  configSnapshot: {
    weights: { price: number; terms: number };
    thresholds: { accept: number; escalate: number; walkaway: number };
    totalPrice: { anchor: number; target: number; max: number; step: number };
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
    total_price: {
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

// ============================================
// STRUCTURED SUGGESTION TYPES
// ============================================

/**
 * Emphasis type for suggestion message variety
 * Each suggestion within a scenario emphasizes a different aspect
 */
export type SuggestionEmphasis = 'price' | 'terms' | 'delivery' | 'value';

/**
 * Scenario types for suggestions
 */
export type ScenarioType = 'HARD' | 'MEDIUM' | 'SOFT' | 'WALK_AWAY';

/**
 * Structured suggestion with price, terms, and delivery
 * Replaces the old string-only suggestion format
 */
export interface StructuredSuggestion {
  message: string;              // Human-like message text including all terms
  price: number;                // Unit price value
  paymentTerms: string;         // e.g., "Net 30", "Net 60", "Net 90"
  deliveryDate: string;         // ISO date string (YYYY-MM-DD)
  deliveryDays: number;         // Days from today
  emphasis: SuggestionEmphasis; // What this message emphasizes
}

/**
 * Complete scenario suggestions map
 */
export type ScenarioSuggestions = Record<ScenarioType, StructuredSuggestion[]>;

/**
 * Delivery configuration extracted from deal for suggestion generation
 * Note: For response generation, use DeliveryConfig from deliveryUtility.ts
 */
export interface SuggestionDeliveryConfig {
  date: string;                 // ISO date string
  daysFromToday: number;        // Calculated days
  isDefault: boolean;           // Whether using 30-day fallback
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

