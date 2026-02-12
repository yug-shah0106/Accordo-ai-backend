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

// ============================================
// OFFER ACCUMULATION TYPES (February 2026)
// ============================================

/**
 * Components of an offer that can be provided separately
 */
export type OfferComponent = 'price' | 'payment terms' | 'delivery';

/**
 * Accumulated offer that tracks partial offers across messages
 * Used to merge vendor's partial responses (e.g., "37000" then "Net 30")
 */
export interface AccumulatedOffer extends Offer {
  accumulation: {
    /** When price component was last updated */
    priceUpdatedAt: Date | null;
    /** When payment terms component was last updated */
    termsUpdatedAt: Date | null;
    /** When delivery component was last updated */
    deliveryUpdatedAt: Date | null;
    /** Message IDs that contributed to this accumulated offer (audit trail) */
    sourceMessageIds: string[];
    /** True when price AND terms are both present (delivery optional) */
    isComplete: boolean;
  };
}

// ============================================
// NEGOTIATION STATE TYPES (February 2026)
// ============================================

/**
 * Vendor's negotiation emphasis based on keyword analysis and concession patterns
 */
export type VendorEmphasis = 'price-focused' | 'terms-focused' | 'balanced' | 'unknown';

/**
 * Record of a price or terms concession made during negotiation
 */
export interface ConcessionRecord {
  /** Round when concession was made */
  round: number;
  /** Previous value (price in dollars or terms in days) */
  previousValue: number;
  /** New value after concession */
  newValue: number;
  /** Amount of change (positive = moved toward PM's target) */
  change: number;
  /** Percentage change relative to range */
  changePercent: number;
  /** When this concession was recorded */
  timestamp: Date;
}

/**
 * PM counter-offer history for tracking our own concessions
 */
export interface PmCounterRecord {
  /** Round number */
  round: number;
  /** Counter-offer price */
  price: number;
  /** Counter-offer payment terms (e.g., "Net 60") */
  terms: string;
  /** Counter-offer delivery days */
  deliveryDays: number | null;
  /** When this counter was made */
  timestamp: Date;
}

/**
 * Keywords detected in vendor messages
 */
export interface DetectedKeywords {
  /** Price-related keywords found */
  priceKeywords: string[];
  /** Terms-related keywords found */
  termsKeywords: string[];
}

/**
 * Complete negotiation state tracking across rounds
 * Stored in deal.convoStateJson for persistence
 */
export interface NegotiationState {
  /** History of vendor's price concessions */
  priceConcessions: ConcessionRecord[];
  /** History of vendor's terms concessions */
  termsConcessions: ConcessionRecord[];
  /** History of PM's counter-offers */
  pmCounterHistory: PmCounterRecord[];
  /** Detected vendor emphasis (what they care more about) */
  vendorEmphasis: VendorEmphasis;
  /** Confidence in the emphasis detection (0.5-0.9) */
  emphasisConfidence: number;
  /** Keywords detected in vendor messages */
  detectedKeywords: DetectedKeywords;
  /** When this state was last updated */
  lastUpdatedAt: Date;
}

/**
 * Create an empty negotiation state
 */
export function createEmptyNegotiationState(): NegotiationState {
  return {
    priceConcessions: [],
    termsConcessions: [],
    pmCounterHistory: [],
    vendorEmphasis: 'unknown',
    emphasisConfidence: 0.5,
    detectedKeywords: {
      priceKeywords: [],
      termsKeywords: [],
    },
    lastUpdatedAt: new Date(),
  };
}

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

// ============================================
// BEHAVIORAL ANALYSIS TYPES (February 2026)
// ============================================

/**
 * Behavioral signals extracted from negotiation message history.
 * Used by the adaptive negotiation engine to adjust strategy dynamically.
 */
export interface BehavioralSignals {
  // Concession analysis
  /** Average price concession per round ($/round) */
  concessionVelocity: number;
  /** Are concessions getting bigger over successive rounds? */
  concessionAccelerating: boolean;
  /** Most recent price change amount */
  lastConcessionSize: number;

  // Convergence analysis
  /** Gap between vendor and PM offers for last 3 rounds */
  priceGapTrend: number[];
  /** % gap reduction per round (positive = converging) */
  convergenceRate: number;
  /** Gap shrinking consistently? */
  isConverging: boolean;
  /** Same/similar offers for 2+ rounds? */
  isStalling: boolean;
  /** Gap growing? */
  isDiverging: boolean;

  // Engagement signals (computed from message timestamps)
  /** Average vendor response time in milliseconds */
  avgResponseTimeMs: number;
  /** Trend of response times */
  responseTimeTrend: 'faster' | 'slower' | 'stable';

  // Sentiment (keyword-based, not LLM)
  /** Latest detected sentiment from vendor message */
  latestSentiment: 'positive' | 'neutral' | 'resistant' | 'urgent';

  // Overall momentum: -1 (losing) to +1 (winning)
  /** Composite momentum score */
  momentum: number;
}

/**
 * Result of adaptive strategy computation.
 * Replaces static base aggressiveness when adaptive features are enabled.
 */
export interface AdaptiveStrategyResult {
  /** Modified aggressiveness (replaces static base) */
  adjustedAggressiveness: number;
  /** Human-readable strategy label */
  strategyLabel: 'Holding Firm' | 'Accelerating' | 'Matching Pace' | 'Final Push';
  /** Dynamic round extension signal */
  shouldExtendRounds: boolean;
  /** Early escalation signal */
  shouldEscalateEarly: boolean;
  /** Human-readable explanation */
  reasoning: string;
}

/**
 * Configuration for dynamic round limits.
 * Stored in negotiationConfigJson when adaptive features are enabled.
 */
export interface DynamicRoundConfig {
  /** Current max_rounds becomes this (user's chosen value) */
  softMaxRounds: number;
  /** Hard ceiling (softMax * 1.5) - never exceeded */
  hardMaxRounds: number;
  /** Feature flag for auto-extension */
  autoExtendEnabled: boolean;
}

/**
 * Historical insights for a vendor/category from past deals.
 * Used for adaptive anchoring.
 */
export interface HistoricalInsights {
  /** Average rounds to close for this vendor */
  avgRoundsToClose: number;
  /** Average price reduction percentage achieved */
  avgPriceReduction: number;
  /** Ratio of (anchor - finalPrice) / (anchor - target) */
  anchorEffectiveness: number;
  /** Behavioral profile of the vendor */
  vendorBehaviorProfile: 'quick_closer' | 'hard_negotiator' | 'walker' | 'unknown';
  /** Number of historical deals analyzed */
  sampleSize: number;
}

/**
 * Adaptive features configuration flags.
 * Stored in negotiationConfigJson.adaptiveFeatures
 */
export interface AdaptiveFeaturesConfig {
  /** Master flag - all adaptive features gated behind this */
  enabled: boolean;
  /** Whether historical anchor adjustment was applied */
  historicalAnchor: boolean;
  /** Dynamic round limit configuration */
  dynamicRounds?: DynamicRoundConfig;
  /** Original anchor before historical adjustment (for transparency) */
  originalAnchor?: number;
}

