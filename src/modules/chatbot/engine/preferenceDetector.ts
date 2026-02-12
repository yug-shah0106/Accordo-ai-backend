/**
 * Vendor Preference Detector Module
 *
 * Detects whether vendor is price-focused or terms-focused based on:
 * 1. Keyword analysis in messages
 * 2. Concession patterns (what they're more willing to move on)
 *
 * Used by the dynamic counter-offer engine to:
 * - Concede on factors the vendor cares less about
 * - Push harder on factors the vendor seems flexible on
 *
 * @module preferenceDetector
 */

import type { Offer, AccumulatedOffer } from './types.js';
import type {
  NegotiationState,
  VendorEmphasis,
  ConcessionRecord,
  PmCounterRecord,
  DetectedKeywords,
} from './types.js';
import { createEmptyNegotiationState, extractPaymentDays } from './types.js';

// ============================================
// KEYWORD PATTERNS
// ============================================

/**
 * Keywords indicating vendor is price-focused
 */
const PRICE_KEYWORDS = [
  'budget',
  'cost',
  'costs',
  'expensive',
  'cheap',
  'cheaper',
  'discount',
  'price',
  'pricing',
  'afford',
  'affordable',
  'rate',
  'rates',
  'dollars',
  'margin',
  'margins',
  'profit',
  'bottom line',
  'reduce',
  'reduction',
  'lower',
  'lowest',
  'best price',
  'competitive',
  'value',
  'savings',
  '$',
];

/**
 * Keywords indicating vendor is terms-focused
 */
const TERMS_KEYWORDS = [
  'cash flow',
  'cashflow',
  'payment',
  'payments',
  'net',
  'credit',
  'days',
  'invoice',
  'invoicing',
  'billing',
  'receivables',
  'due',
  'duration',
  'timing',
  'terms',
  'upfront',
  'advance',
  'installment',
  'flexible',
  'flexibility',
  'pay later',
  'extended',
  'extension',
];

// ============================================
// KEYWORD ANALYSIS
// ============================================

/**
 * Analyze message content for price and terms keywords
 *
 * @param content - Message content to analyze
 * @returns Object with detected price and terms keywords
 *
 * @example
 * ```typescript
 * const result = analyzeMessageKeywords("The price is too high for our budget");
 * // result = { priceKeywords: ['price', 'budget'], termsKeywords: [] }
 * ```
 */
export function analyzeMessageKeywords(content: string): DetectedKeywords {
  const lowerContent = content.toLowerCase();

  const priceKeywords = PRICE_KEYWORDS.filter((kw) =>
    lowerContent.includes(kw.toLowerCase())
  );

  const termsKeywords = TERMS_KEYWORDS.filter((kw) =>
    lowerContent.includes(kw.toLowerCase())
  );

  return { priceKeywords, termsKeywords };
}

/**
 * Merge detected keywords from multiple messages
 *
 * @param existing - Existing detected keywords
 * @param newKeywords - New keywords to merge
 * @returns Merged keywords (deduplicated)
 */
export function mergeKeywords(
  existing: DetectedKeywords,
  newKeywords: DetectedKeywords
): DetectedKeywords {
  return {
    priceKeywords: [...new Set([...existing.priceKeywords, ...newKeywords.priceKeywords])],
    termsKeywords: [...new Set([...existing.termsKeywords, ...newKeywords.termsKeywords])],
  };
}

// ============================================
// CONCESSION CALCULATION
// ============================================

/**
 * Calculate a concession record for price
 *
 * @param previousPrice - Previous vendor offer price
 * @param currentPrice - Current vendor offer price
 * @param pmTarget - PM's target price
 * @param pmMax - PM's max acceptable price
 * @param round - Current negotiation round
 * @returns Concession record or null if no concession
 */
export function calculatePriceConcession(
  previousPrice: number,
  currentPrice: number,
  pmTarget: number,
  pmMax: number,
  round: number
): ConcessionRecord | null {
  // No concession if price went up (away from PM's target)
  if (currentPrice >= previousPrice) return null;

  const change = previousPrice - currentPrice; // Positive = vendor dropped price
  const range = pmMax - pmTarget;
  const changePercent = range > 0 ? (change / range) * 100 : 0;

  return {
    round,
    previousValue: previousPrice,
    newValue: currentPrice,
    change,
    changePercent,
    timestamp: new Date(),
  };
}

/**
 * Calculate a concession record for payment terms
 *
 * Terms concession = vendor accepting longer payment terms (better for PM)
 *
 * @param previousDays - Previous payment terms in days
 * @param currentDays - Current payment terms in days
 * @param pmMinDays - PM's minimum acceptable days
 * @param pmMaxDays - PM's preferred maximum days (e.g., 90)
 * @param round - Current negotiation round
 * @returns Concession record or null if no concession
 */
export function calculateTermsConcession(
  previousDays: number,
  currentDays: number,
  pmMinDays: number,
  pmMaxDays: number,
  round: number
): ConcessionRecord | null {
  // Concession = vendor accepting LONGER terms (better for PM)
  if (currentDays <= previousDays) return null;

  const change = currentDays - previousDays; // Positive = more days (better for PM)
  const range = pmMaxDays - pmMinDays;
  const changePercent = range > 0 ? (change / range) * 100 : 0;

  return {
    round,
    previousValue: previousDays,
    newValue: currentDays,
    change,
    changePercent,
    timestamp: new Date(),
  };
}

// ============================================
// EMPHASIS DETECTION
// ============================================

/**
 * Detect vendor's emphasis based on accumulated data
 *
 * Scoring:
 * - Keyword difference × 0.3 (minor signal)
 * - Concession pattern × 2.0 (strong signal)
 *
 * Confidence ranges:
 * - 0.5: No data (unknown)
 * - 0.6: Keywords only
 * - 0.7: Some concession data
 * - 0.8: Multiple concessions
 * - 0.9: Clear pattern
 *
 * @param state - Current negotiation state
 * @returns Object with emphasis and confidence
 */
export function detectVendorEmphasis(state: NegotiationState): {
  emphasis: VendorEmphasis;
  confidence: number;
} {
  const { priceConcessions, termsConcessions, detectedKeywords } = state;

  // Calculate keyword score
  const priceKeywordCount = detectedKeywords.priceKeywords.length;
  const termsKeywordCount = detectedKeywords.termsKeywords.length;
  const keywordDiff = priceKeywordCount - termsKeywordCount;
  const keywordScore = keywordDiff * 0.3; // Positive = price-focused

  // Calculate concession score
  // Vendor making MORE price concessions = they care LESS about price
  // So we invert: more price concessions = vendor is terms-focused
  const totalPriceConcessionPercent = priceConcessions.reduce(
    (sum, c) => sum + c.changePercent,
    0
  );
  const totalTermsConcessionPercent = termsConcessions.reduce(
    (sum, c) => sum + c.changePercent,
    0
  );

  // Positive score = vendor conceded more on terms, so they're price-focused
  // Negative score = vendor conceded more on price, so they're terms-focused
  const concessionScore = (totalTermsConcessionPercent - totalPriceConcessionPercent) * 2.0;

  // Combined score
  const combinedScore = keywordScore + concessionScore;

  // Determine emphasis
  let emphasis: VendorEmphasis;
  if (Math.abs(combinedScore) < 5) {
    emphasis = 'balanced';
  } else if (combinedScore > 0) {
    emphasis = 'price-focused';
  } else {
    emphasis = 'terms-focused';
  }

  // Calculate confidence
  let confidence = 0.5;
  const hasKeywords = priceKeywordCount > 0 || termsKeywordCount > 0;
  const hasConcessions = priceConcessions.length > 0 || termsConcessions.length > 0;
  const hasMultipleConcessions =
    priceConcessions.length > 1 || termsConcessions.length > 1;

  if (!hasKeywords && !hasConcessions) {
    emphasis = 'unknown';
    confidence = 0.5;
  } else if (hasKeywords && !hasConcessions) {
    confidence = 0.6;
  } else if (hasConcessions && !hasMultipleConcessions) {
    confidence = 0.7;
  } else if (hasMultipleConcessions) {
    confidence = Math.abs(combinedScore) > 15 ? 0.9 : 0.8;
  }

  return { emphasis, confidence };
}

// ============================================
// STATE UPDATE
// ============================================

/**
 * Update negotiation state with new data from a round
 *
 * @param state - Current negotiation state (or null for first round)
 * @param previousVendorOffer - Vendor's previous offer (or null)
 * @param currentVendorOffer - Vendor's current offer
 * @param vendorMessage - Vendor's message content
 * @param pmCounter - PM's counter-offer from this round (if any)
 * @param round - Current round number
 * @param config - Negotiation config with targets
 * @returns Updated negotiation state
 */
export function updateNegotiationState(
  state: NegotiationState | null,
  previousVendorOffer: Offer | AccumulatedOffer | null,
  currentVendorOffer: Offer | AccumulatedOffer,
  vendorMessage: string,
  pmCounter: Offer | null,
  round: number,
  config: {
    pmTargetPrice: number;
    pmMaxPrice: number;
    pmMinTermsDays: number;
    pmMaxTermsDays: number;
  }
): NegotiationState {
  // Start from existing state or create new
  const current = state ? { ...state } : createEmptyNegotiationState();

  // Update keywords from message
  const newKeywords = analyzeMessageKeywords(vendorMessage);
  current.detectedKeywords = mergeKeywords(current.detectedKeywords, newKeywords);

  // Calculate price concession if we have previous offer
  if (
    previousVendorOffer !== null &&
    previousVendorOffer.total_price !== null &&
    currentVendorOffer.total_price !== null
  ) {
    const priceConcession = calculatePriceConcession(
      previousVendorOffer.total_price,
      currentVendorOffer.total_price,
      config.pmTargetPrice,
      config.pmMaxPrice,
      round
    );
    if (priceConcession) {
      current.priceConcessions = [...current.priceConcessions, priceConcession];
    }
  }

  // Calculate terms concession if we have previous offer
  const previousTermsDays = previousVendorOffer?.payment_terms
    ? extractPaymentDays(previousVendorOffer.payment_terms)
    : null;
  const currentTermsDays = currentVendorOffer.payment_terms
    ? extractPaymentDays(currentVendorOffer.payment_terms)
    : null;

  if (previousTermsDays !== null && currentTermsDays !== null) {
    const termsConcession = calculateTermsConcession(
      previousTermsDays,
      currentTermsDays,
      config.pmMinTermsDays,
      config.pmMaxTermsDays,
      round
    );
    if (termsConcession) {
      current.termsConcessions = [...current.termsConcessions, termsConcession];
    }
  }

  // Record PM's counter-offer
  if (pmCounter) {
    const pmRecord: PmCounterRecord = {
      round,
      price: pmCounter.total_price ?? 0,
      terms: pmCounter.payment_terms ?? 'Net 30',
      deliveryDays: pmCounter.delivery_days ?? null,
      timestamp: new Date(),
    };
    current.pmCounterHistory = [...current.pmCounterHistory, pmRecord];
  }

  // Update emphasis detection
  const { emphasis, confidence } = detectVendorEmphasis(current);
  current.vendorEmphasis = emphasis;
  current.emphasisConfidence = confidence;
  current.lastUpdatedAt = new Date();

  return current;
}

/**
 * Get the last PM counter-offer from state
 */
export function getLastPmCounter(state: NegotiationState | null): PmCounterRecord | null {
  if (!state || state.pmCounterHistory.length === 0) return null;
  return state.pmCounterHistory[state.pmCounterHistory.length - 1];
}

/**
 * Get total vendor price concession percentage
 */
export function getTotalPriceConcession(state: NegotiationState): number {
  return state.priceConcessions.reduce((sum, c) => sum + c.changePercent, 0);
}

/**
 * Get total vendor terms concession percentage
 */
export function getTotalTermsConcession(state: NegotiationState): number {
  return state.termsConcessions.reduce((sum, c) => sum + c.changePercent, 0);
}

export default {
  analyzeMessageKeywords,
  mergeKeywords,
  calculatePriceConcession,
  calculateTermsConcession,
  detectVendorEmphasis,
  updateNegotiationState,
  getLastPmCounter,
  getTotalPriceConcession,
  getTotalTermsConcession,
};
