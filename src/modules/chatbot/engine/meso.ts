/**
 * MESO - Multiple Equivalent Simultaneous Offers
 *
 * Pactum-style negotiation technique that generates 2-3 equivalent-utility offers
 * per counter-offer round, enabling preference discovery through vendor selection.
 *
 * Key Concepts:
 * - All offers have approximately the same total utility (within 2% variance)
 * - Each offer trades off different parameters (price vs terms vs delivery)
 * - Vendor's choice reveals their true preferences
 * - Preferences are tracked to improve future counter-offers
 *
 * @module meso
 */

import type {
  Offer,
  ExtendedOffer,
  ResolvedNegotiationConfig,
  WizardConfig,
  NegotiationState,
  MesoSelectionRecord,
} from './types.js';
import { calculateWeightedUtilityFromResolved } from './weightedUtility.js';

// ============================================
// VENDOR PREFERENCE PROFILE (Learning-Based MESO)
// ============================================

/**
 * Vendor preference profile learned from MESO selections
 */
export interface VendorPreferenceProfile {
  /** Inferred weight for price (0-1, higher = vendor prefers price-focused offers) */
  priceWeight: number;
  /** Inferred weight for payment terms (0-1) */
  termsWeight: number;
  /** Inferred weight for delivery (0-1) */
  deliveryWeight: number;
  /** Inferred weight for warranty (0-1) */
  warrantyWeight: number;
  /** Last selected offer type */
  lastSelectedOfferType: 'offer_1' | 'offer_2' | 'offer_3' | 'price' | 'terms' | 'balanced' | null;
  /** History of selections with offer details */
  selectionHistory: MesoSelectionRecord[];
  /** Number of times vendor selected price-focused */
  priceSelectionCount: number;
  /** Number of times vendor selected terms-focused */
  termsSelectionCount: number;
  /** Number of times vendor selected balanced */
  balancedSelectionCount: number;
}

/**
 * Create empty vendor preference profile
 */
export function createEmptyPreferenceProfile(): VendorPreferenceProfile {
  return {
    priceWeight: 0.5,
    termsWeight: 0.5,
    deliveryWeight: 0.5,
    warrantyWeight: 0.5,
    lastSelectedOfferType: null,
    selectionHistory: [],
    priceSelectionCount: 0,
    termsSelectionCount: 0,
    balancedSelectionCount: 0,
  };
}

/**
 * Build vendor preference profile from negotiation state
 */
export function buildPreferenceProfile(state: NegotiationState | null): VendorPreferenceProfile {
  const profile = createEmptyPreferenceProfile();

  if (!state || !state.mesoSelections || state.mesoSelections.length === 0) {
    return profile;
  }

  profile.selectionHistory = state.mesoSelections;

  // Count selections by type
  for (const selection of state.mesoSelections) {
    const type = selection.selectedType;
    if (type === 'offer_1' || type === 'price') {
      profile.priceSelectionCount++;
    } else if (type === 'offer_2' || type === 'terms') {
      profile.termsSelectionCount++;
    } else if (type === 'offer_3' || type === 'balanced') {
      profile.balancedSelectionCount++;
    }
  }

  // Calculate weights based on selection frequency
  const totalSelections = state.mesoSelections.length;
  if (totalSelections > 0) {
    profile.priceWeight = 0.5 + (profile.priceSelectionCount / totalSelections) * 0.3;
    profile.termsWeight = 0.5 + (profile.termsSelectionCount / totalSelections) * 0.3;
    // Balanced selections indicate no strong preference, keep at 0.5
  }

  // Set last selected type
  const lastSelection = state.mesoSelections[state.mesoSelections.length - 1];
  profile.lastSelectedOfferType = lastSelection.selectedType;

  return profile;
}

/**
 * Previous MESO round data for ensuring dynamic offers
 */
export interface PreviousMesoRound {
  round: number;
  options: MesoOption[];
  selectedOptionId?: string;
}

// ============================================
// MESO Types
// ============================================

/**
 * A single MESO option
 */
export interface MesoOption {
  /** Unique identifier for this option */
  id: string;
  /** The counter-offer */
  offer: ExtendedOffer;
  /** Calculated utility score */
  utility: number;
  /** Human-readable label (e.g., "Price-Focused", "Terms-Focused") */
  label: string;
  /** Description of trade-offs in this option */
  description: string;
  /** Which parameters are emphasized */
  emphasis: ('price' | 'payment_terms' | 'delivery' | 'warranty')[];
  /** Trade-offs made in this option */
  tradeoffs: string[];
}

/**
 * Result of MESO generation
 */
export interface MesoResult {
  /** 2-3 equivalent-utility options */
  options: MesoOption[];
  /** Target utility score */
  targetUtility: number;
  /** Actual variance between options (should be < 2%) */
  variance: number;
  /** Whether MESO generation was successful */
  success: boolean;
  /** Reason for failure if not successful */
  reason?: string;
}

/**
 * Vendor's selection from MESO options
 */
export interface MesoSelection {
  /** Which option was selected */
  selectedOptionId: string;
  /** The selected offer */
  selectedOffer: ExtendedOffer;
  /** Inferred preferences based on selection */
  inferredPreferences: {
    /** Parameter with highest inferred importance */
    primaryPreference: string;
    /** Confidence in inference (0-1) */
    confidence: number;
    /** All inferred weights adjustments */
    preferenceAdjustments: Record<string, number>;
  };
}

/**
 * MESO round record for database storage
 */
export interface MesoRoundRecord {
  id?: string;
  dealId: string;
  round: number;
  options: MesoOption[];
  vendorSelection?: MesoSelection;
  inferredPreferences?: Record<string, number>;
  createdAt?: Date;
}

// ============================================
// MESO Generation
// ============================================

/**
 * Generate MESO options for a counter-offer round
 *
 * Strategy:
 * 1. Calculate base counter-offer using standard logic
 * 2. Generate variations that trade off different parameters
 * 3. Ensure all options have utility within 2% of each other
 * 4. Return 2-3 options for vendor selection
 *
 * @param config - Resolved negotiation configuration
 * @param vendorOffer - Current vendor offer
 * @param round - Current negotiation round
 * @param targetUtility - Target utility for counter-offers (0-1)
 */
export function generateMesoOptions(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number = 0.65
): MesoResult {
  const options: MesoOption[] = [];
  const variance_target = 0.02; // 2% variance

  try {
    // ============================================
    // Option 1: Best Price + Best Delivery + Medium Terms + Min Warranty
    // "Value-focused" - lowest price, fastest delivery, shorter warranty
    // ============================================

    const offer1 = generatePriceFocusedOffer(config, vendorOffer, round, targetUtility);
    const offer1Utility = calculateWeightedUtilityFromResolved(offer1, config);

    options.push({
      id: `meso_${round}_offer1`,
      offer: offer1,
      utility: offer1Utility.totalUtility,
      label: 'Offer 1',
      description: `Best price ($${offer1.total_price?.toLocaleString()}) with fast ${offer1.delivery_days}-day delivery`,
      emphasis: ['price', 'delivery'],
      tradeoffs: [`${offer1.warranty_months || 0} months warranty`, `Net ${offer1.payment_terms_days} payment`],
    });

    // ============================================
    // Option 2: Medium Price + Best Terms + Medium Delivery + Standard Warranty
    // "Cash flow friendly" - longest payment terms
    // ============================================

    const offer2 = generateTermsFocusedOffer(config, vendorOffer, round, targetUtility);
    const offer2Utility = calculateWeightedUtilityFromResolved(offer2, config);

    options.push({
      id: `meso_${round}_offer2`,
      offer: offer2,
      utility: offer2Utility.totalUtility,
      label: 'Offer 2',
      description: `Extended Net ${offer2.payment_terms_days} payment terms with ${offer2.warranty_months} months warranty`,
      emphasis: ['payment_terms'],
      tradeoffs: [`$${offer2.total_price?.toLocaleString()} price`, `${offer2.delivery_days}-day delivery`],
    });

    // ============================================
    // Option 3: Medium Price + Medium Terms + Best Delivery + Extended Warranty
    // "Full service" - best delivery + extended warranty
    // ============================================

    const offer3 = generateBalancedOffer(config, vendorOffer, round, targetUtility);
    const offer3Utility = calculateWeightedUtilityFromResolved(offer3, config);

    options.push({
      id: `meso_${round}_offer3`,
      offer: offer3,
      utility: offer3Utility.totalUtility,
      label: 'Offer 3',
      description: `Fast ${offer3.delivery_days}-day delivery with extended ${offer3.warranty_months} months warranty`,
      emphasis: ['delivery', 'warranty'],
      tradeoffs: [`$${offer3.total_price?.toLocaleString()} price`, `Net ${offer3.payment_terms_days} payment`],
    });

    // ============================================
    // Normalize utilities to minimize variance
    // ============================================

    const utilities = options.map((o) => o.utility);
    const avgUtility = utilities.reduce((a, b) => a + b, 0) / utilities.length;
    const maxVariance = Math.max(...utilities.map((u) => Math.abs(u - avgUtility)));

    // If variance is too high, adjust offers
    if (maxVariance > variance_target) {
      // Re-adjust offers to bring them closer together
      adjustOffersForVariance(options, config, avgUtility, variance_target);
    }

    // Recalculate final variance
    const finalUtilities = options.map((o) => o.utility);
    const finalAvg = finalUtilities.reduce((a, b) => a + b, 0) / finalUtilities.length;
    const finalVariance = Math.max(...finalUtilities.map((u) => Math.abs(u - finalAvg)));

    return {
      options,
      targetUtility: finalAvg,
      variance: finalVariance,
      success: true,
    };
  } catch (error) {
    return {
      options: [],
      targetUtility,
      variance: 0,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error generating MESO options',
    };
  }
}

// ============================================
// MESO OFFER GENERATION HELPERS
// ============================================

/**
 * Calculate base counter-offer price based on round and priority
 */
function calculateBasePrice(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number
): number {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Base aggressiveness by priority
  const aggressiveness = priority === 'HIGH' ? 0.25 : priority === 'LOW' ? 0.45 : 0.35;
  const roundAdjustment = Math.min(0.10, round * 0.02);

  let basePrice = targetPrice + priceRange * (aggressiveness + roundAdjustment);

  // Never exceed vendor's offer or max acceptable
  if (vendorOffer.total_price != null) {
    basePrice = Math.min(basePrice, vendorOffer.total_price);
  }
  basePrice = Math.min(basePrice, maxAcceptablePrice);

  return Math.round(basePrice * 100) / 100;
}

/**
 * Calculate medium (midpoint) payment terms in days
 */
function getMediumPaymentDays(config: ResolvedNegotiationConfig): number {
  return Math.round((config.paymentTermsMinDays + config.paymentTermsMaxDays) / 2);
}

/**
 * Calculate best (fastest) delivery days
 * Uses preferred date if available, otherwise improves on vendor's offer
 */
function getBestDeliveryDays(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer
): number {
  const vendorDelivery = vendorOffer.delivery_days ?? 30;

  // If we have a preferred delivery date, calculate days from now
  if (config.preferredDeliveryDate) {
    const preferredDays = Math.ceil(
      (config.preferredDeliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(1, Math.min(preferredDays, vendorDelivery));
  }

  // Otherwise, aim for 10-20% faster than vendor's offer
  const improvement = Math.max(2, Math.floor(vendorDelivery * 0.15));
  return Math.max(7, vendorDelivery - improvement);
}

/**
 * Calculate medium delivery days (vendor's offer or required date)
 */
function getMediumDeliveryDays(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer
): number {
  const vendorDelivery = vendorOffer.delivery_days ?? 30;

  // If we have a required delivery date, use it as ceiling
  if (config.deliveryDate) {
    const requiredDays = Math.ceil(
      (config.deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.min(vendorDelivery, requiredDays);
  }

  return vendorDelivery;
}

/**
 * Generate Offer 1: BEST Price + BEST Delivery + MEDIUM Terms + MINIMUM Warranty
 * This is the "value-focused" option - lowest price, fastest delivery, shorter warranty
 */
function generatePriceFocusedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number
): ExtendedOffer {
  const basePrice = calculateBasePrice(config, vendorOffer, round);

  // BEST price: 2.5% lower than base (within strict boundaries)
  const priceDiscount = 0.025; // 2.5%
  let bestPrice = basePrice * (1 - priceDiscount);
  bestPrice = Math.max(config.targetPrice, bestPrice); // Don't go below target
  bestPrice = Math.round(bestPrice * 100) / 100;

  // MEDIUM payment terms
  const mediumPaymentDays = getMediumPaymentDays(config);

  // BEST delivery (fastest)
  const bestDeliveryDays = getBestDeliveryDays(config, vendorOffer);

  // MINIMUM warranty: config - 6 months (floor at 0)
  const minWarranty = Math.max(0, config.warrantyPeriodMonths - 6);

  return {
    total_price: bestPrice,
    payment_terms: `Net ${mediumPaymentDays}`,
    payment_terms_days: mediumPaymentDays,
    delivery_days: bestDeliveryDays,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: minWarranty,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate Offer 2: MEDIUM Price + BEST Terms + MEDIUM Delivery + STANDARD Warranty
 * This is the "cash flow friendly" option - longer payment terms, standard everything else
 */
function generateTermsFocusedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number
): ExtendedOffer {
  // MEDIUM price (base price, no discount)
  const mediumPrice = calculateBasePrice(config, vendorOffer, round);

  // BEST payment terms (longest, using wizard max)
  const bestPaymentDays = config.paymentTermsMaxDays;

  // MEDIUM delivery
  const mediumDeliveryDays = getMediumDeliveryDays(config, vendorOffer);

  // STANDARD warranty (config value)
  const standardWarranty = config.warrantyPeriodMonths;

  return {
    total_price: mediumPrice,
    payment_terms: `Net ${bestPaymentDays}`,
    payment_terms_days: bestPaymentDays,
    delivery_days: mediumDeliveryDays,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: standardWarranty,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate Offer 3: MEDIUM Price + MEDIUM Terms + BEST Delivery + EXTENDED Warranty
 * This is the "full service" option - best delivery, best warranty, fair price/terms
 */
function generateBalancedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number
): ExtendedOffer {
  // MEDIUM price (base price, no discount)
  const mediumPrice = calculateBasePrice(config, vendorOffer, round);

  // MEDIUM payment terms
  const mediumPaymentDays = getMediumPaymentDays(config);

  // BEST delivery (fastest)
  const bestDeliveryDays = getBestDeliveryDays(config, vendorOffer);

  // EXTENDED warranty: config + 6 months
  const extendedWarranty = config.warrantyPeriodMonths + 6;

  return {
    total_price: mediumPrice,
    payment_terms: `Net ${mediumPaymentDays}`,
    payment_terms_days: mediumPaymentDays,
    delivery_days: bestDeliveryDays,
    warranty_months: extendedWarranty,
    partial_delivery_allowed: true, // Request flexibility for full service
  };
}

/**
 * Adjust offers to minimize variance
 */
function adjustOffersForVariance(
  options: MesoOption[],
  config: ResolvedNegotiationConfig,
  targetUtility: number,
  maxVariance: number
): void {
  // Simple adjustment: scale prices to bring utilities closer
  for (const option of options) {
    const utilityDiff = option.utility - targetUtility;

    if (Math.abs(utilityDiff) > maxVariance) {
      // Adjust price to compensate
      const priceAdjustment = utilityDiff * config.priceRange * 0.1;

      if (option.offer.total_price != null) {
        option.offer.total_price = Math.round(
          (option.offer.total_price + priceAdjustment) * 100
        ) / 100;

        // Recalculate utility
        const newUtility = calculateWeightedUtilityFromResolved(option.offer, config);
        option.utility = newUtility.totalUtility;
      }
    }
  }
}

// ============================================
// Preference Tracking
// ============================================

/**
 * Analyze vendor's MESO selection to infer preferences
 *
 * @param selection - The option selected by the vendor
 * @param allOptions - All options that were presented
 */
export function inferPreferencesFromSelection(
  selection: MesoOption,
  allOptions: MesoOption[]
): MesoSelection {
  const preferenceAdjustments: Record<string, number> = {};
  let primaryPreference = 'price';
  let confidence = 0.5;

  // Analyze selection emphasis
  if (selection.emphasis.includes('price')) {
    preferenceAdjustments['price'] = 0.1; // Increase price weight
    preferenceAdjustments['payment_terms'] = -0.05;
    primaryPreference = 'price';
    confidence = 0.7;
  } else if (selection.emphasis.includes('payment_terms')) {
    preferenceAdjustments['payment_terms'] = 0.1;
    preferenceAdjustments['price'] = -0.05;
    primaryPreference = 'payment_terms';
    confidence = 0.7;
  } else if (selection.emphasis.includes('delivery')) {
    preferenceAdjustments['delivery'] = 0.1;
    preferenceAdjustments['price'] = -0.03;
    preferenceAdjustments['payment_terms'] = -0.03;
    primaryPreference = 'delivery';
    confidence = 0.65;
  } else if (selection.emphasis.includes('warranty')) {
    preferenceAdjustments['warranty'] = 0.1;
    primaryPreference = 'warranty';
    confidence = 0.6;
  }

  // Increase confidence if selection was consistent with previous patterns
  // (This would integrate with preference tracker - placeholder for now)

  return {
    selectedOptionId: selection.id,
    selectedOffer: selection.offer,
    inferredPreferences: {
      primaryPreference,
      confidence,
      preferenceAdjustments,
    },
  };
}

/**
 * Convert MESO option to standard Offer format
 */
export function mesoOptionToOffer(option: MesoOption): Offer {
  return {
    total_price: option.offer.total_price,
    payment_terms: option.offer.payment_terms,
    delivery_date: option.offer.delivery_date ?? null,
    delivery_days: option.offer.delivery_days ?? null,
  };
}

/**
 * Check if MESO should be enabled for this round
 * MESO starts from round 1 (PM's first response to vendor's quotation)
 * and continues throughout the entire negotiation until conclusion
 *
 * UPDATED February 2026: MESO now continues for ALL rounds
 * - Removed 3-round limit
 * - Only disabled for final offers (handled separately)
 */
export function shouldUseMeso(
  round: number,
  _maxRounds: number,
  _previousMesoRounds: number = 0
): boolean {
  // MESO starts from round 1 (PM's first counter-offer after vendor's quotation)
  // Round 0 would be before any vendor message, which shouldn't happen
  if (round < 1) return false;

  // MESO continues for all rounds until conclusion
  // Final offers are handled separately by generateFinalMesoOptions
  return true;
}

// ============================================
// DYNAMIC MESO GENERATION (Learning-Based)
// ============================================

/**
 * Concession rates based on round number
 * Early rounds: larger concessions
 * Later rounds: smaller concessions
 */
function getConcessionRate(round: number, isPrimary: boolean): number {
  if (round <= 5) {
    return isPrimary ? 0.025 : 0.015; // 2.5% primary, 1.5% secondary
  } else if (round <= 10) {
    return isPrimary ? 0.015 : 0.01;  // 1.5% primary, 1% secondary
  } else {
    return isPrimary ? 0.01 : 0.005;  // 1% primary, 0.5% secondary
  }
}

/**
 * Generate MESO options with learning-based dynamic adjustments
 *
 * This function generates offers that:
 * 1. Differ from previous round offers (no identical MESOs)
 * 2. Adjust based on vendor's selection history (learning)
 * 3. Apply progressive concessions (larger early, smaller later)
 *
 * @param config - Resolved negotiation configuration
 * @param vendorOffer - Current vendor offer
 * @param round - Current negotiation round
 * @param negotiationState - Negotiation state with MESO selection history
 * @param previousMeso - Previous round's MESO options (to ensure different values)
 * @param targetUtility - Target utility for counter-offers (0-1)
 */
export function generateDynamicMesoOptions(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  negotiationState: NegotiationState | null,
  previousMeso: PreviousMesoRound | null = null,
  targetUtility: number = 0.65
): MesoResult {
  const options: MesoOption[] = [];
  const variance_target = 0.03; // 3% variance for dynamic MESO

  try {
    // Build vendor preference profile from history
    const preferenceProfile = buildPreferenceProfile(negotiationState);

    // Calculate base concession rate for this round
    const primaryConcession = getConcessionRate(round, true);
    const secondaryConcession = getConcessionRate(round, false);

    // Determine emphasis adjustments based on vendor preferences
    const priceEmphasis = preferenceProfile.priceWeight;
    const termsEmphasis = preferenceProfile.termsWeight;

    // Get previous round prices to ensure we generate different values
    const prevOffer1Price = previousMeso?.options.find(o => o.id.includes('offer1'))?.offer.total_price;
    const prevOffer2Price = previousMeso?.options.find(o => o.id.includes('offer2'))?.offer.total_price;
    const prevOffer3Price = previousMeso?.options.find(o => o.id.includes('offer3'))?.offer.total_price;

    // ============================================
    // Option 1: Price-Focused (with dynamic adjustment)
    // ============================================

    const offer1 = generateDynamicPriceFocusedOffer(
      config,
      vendorOffer,
      round,
      primaryConcession,
      priceEmphasis,
      prevOffer1Price
    );
    const offer1Utility = calculateWeightedUtilityFromResolved(offer1, config);

    options.push({
      id: `meso_${round}_offer1`,
      offer: offer1,
      utility: offer1Utility.totalUtility,
      label: 'Offer 1',
      description: '',
      emphasis: ['price'],
      tradeoffs: [],
    });

    // ============================================
    // Option 2: Terms-Focused (with dynamic adjustment)
    // ============================================

    const offer2 = generateDynamicTermsFocusedOffer(
      config,
      vendorOffer,
      round,
      primaryConcession,
      termsEmphasis,
      prevOffer2Price
    );
    const offer2Utility = calculateWeightedUtilityFromResolved(offer2, config);

    options.push({
      id: `meso_${round}_offer2`,
      offer: offer2,
      utility: offer2Utility.totalUtility,
      label: 'Offer 2',
      description: '',
      emphasis: ['payment_terms'],
      tradeoffs: [],
    });

    // ============================================
    // Option 3: Balanced (always include for variety)
    // ============================================

    const offer3 = generateDynamicBalancedOffer(
      config,
      vendorOffer,
      round,
      secondaryConcession,
      prevOffer3Price
    );
    const offer3Utility = calculateWeightedUtilityFromResolved(offer3, config);

    options.push({
      id: `meso_${round}_offer3`,
      offer: offer3,
      utility: offer3Utility.totalUtility,
      label: 'Offer 3',
      description: '',
      emphasis: ['delivery', 'warranty'],
      tradeoffs: [],
    });

    // ============================================
    // Normalize utilities to minimize variance
    // ============================================

    const utilities = options.map((o) => o.utility);
    const avgUtility = utilities.reduce((a, b) => a + b, 0) / utilities.length;
    const maxVariance = Math.max(...utilities.map((u) => Math.abs(u - avgUtility)));

    if (maxVariance > variance_target) {
      adjustOffersForVariance(options, config, avgUtility, variance_target);
    }

    // Recalculate final variance
    const finalUtilities = options.map((o) => o.utility);
    const finalAvg = finalUtilities.reduce((a, b) => a + b, 0) / finalUtilities.length;
    const finalVariance = Math.max(...finalUtilities.map((u) => Math.abs(u - finalAvg)));

    return {
      options,
      targetUtility: finalAvg,
      variance: finalVariance,
      success: true,
    };
  } catch (error) {
    return {
      options: [],
      targetUtility,
      variance: 0,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error generating dynamic MESO options',
    };
  }
}

/**
 * Generate dynamic Offer 1: Best Price + Best Delivery + Medium Terms + Min Warranty
 * Applies round-based concessions and ensures different from previous round
 */
function generateDynamicPriceFocusedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  concessionRate: number,
  priceEmphasis: number,
  previousPrice: number | null | undefined
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Base aggressiveness adjusted by vendor preference
  const baseAggressiveness = priority === 'HIGH' ? 0.20 : priority === 'LOW' ? 0.40 : 0.30;
  const emphasisAdjustment = (priceEmphasis - 0.5) * 0.1;

  // Round-based concession: move toward vendor each round
  const roundConcession = round * concessionRate;

  let basePrice = targetPrice + priceRange * (baseAggressiveness + emphasisAdjustment + roundConcession);

  // Ensure different from previous round (at least $50 or 0.5% different)
  if (previousPrice != null) {
    const minDiff = Math.max(50, previousPrice * 0.005);
    if (Math.abs(basePrice - previousPrice) < minDiff) {
      basePrice = previousPrice + minDiff;
    }
  }

  // Never exceed vendor's offer
  if (vendorOffer.total_price != null) {
    basePrice = Math.min(basePrice, vendorOffer.total_price);
  }
  basePrice = Math.min(basePrice, maxAcceptablePrice);

  // BEST price: 2.5% discount from base
  let bestPrice = basePrice * 0.975;
  bestPrice = Math.max(config.targetPrice, bestPrice);
  bestPrice = Math.round(bestPrice * 100) / 100;

  // MEDIUM payment terms
  const mediumPaymentDays = getMediumPaymentDays(config);

  // BEST delivery
  const bestDeliveryDays = getBestDeliveryDays(config, vendorOffer);

  // MINIMUM warranty
  const minWarranty = Math.max(0, config.warrantyPeriodMonths - 6);

  return {
    total_price: bestPrice,
    payment_terms: `Net ${mediumPaymentDays}`,
    payment_terms_days: mediumPaymentDays,
    delivery_days: bestDeliveryDays,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: minWarranty,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate dynamic Offer 2: Medium Price + Best Terms + Medium Delivery + Standard Warranty
 * Applies round-based concessions and ensures different from previous round
 */
function generateDynamicTermsFocusedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  concessionRate: number,
  termsEmphasis: number,
  previousPrice: number | null | undefined
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Base aggressiveness for medium price
  const baseAggressiveness = priority === 'HIGH' ? 0.30 : priority === 'LOW' ? 0.50 : 0.40;
  const emphasisAdjustment = (termsEmphasis - 0.5) * 0.1;

  // Round-based concession
  const roundConcession = round * concessionRate;

  let mediumPrice = targetPrice + priceRange * (baseAggressiveness + emphasisAdjustment + roundConcession);

  // Ensure different from previous round
  if (previousPrice != null) {
    const minDiff = Math.max(50, previousPrice * 0.005);
    if (Math.abs(mediumPrice - previousPrice) < minDiff) {
      mediumPrice = previousPrice + minDiff;
    }
  }

  if (vendorOffer.total_price != null) {
    mediumPrice = Math.min(mediumPrice, vendorOffer.total_price);
  }
  mediumPrice = Math.min(mediumPrice, maxAcceptablePrice);
  mediumPrice = Math.round(mediumPrice * 100) / 100;

  // BEST payment terms (longest)
  const bestPaymentDays = config.paymentTermsMaxDays;

  // MEDIUM delivery
  const mediumDeliveryDays = getMediumDeliveryDays(config, vendorOffer);

  // STANDARD warranty
  const standardWarranty = config.warrantyPeriodMonths;

  return {
    total_price: mediumPrice,
    payment_terms: `Net ${bestPaymentDays}`,
    payment_terms_days: bestPaymentDays,
    delivery_days: mediumDeliveryDays,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: standardWarranty,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate dynamic Offer 3: Medium Price + Medium Terms + Best Delivery + Extended Warranty
 * Applies round-based concessions and ensures different from previous round
 */
function generateDynamicBalancedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  concessionRate: number,
  previousPrice: number | null | undefined
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Base aggressiveness for medium price
  const baseAggressiveness = priority === 'HIGH' ? 0.30 : priority === 'LOW' ? 0.50 : 0.40;

  // Round-based concession
  const roundConcession = round * concessionRate;

  let mediumPrice = targetPrice + priceRange * (baseAggressiveness + roundConcession);

  // Ensure different from previous round
  if (previousPrice != null) {
    const minDiff = Math.max(50, previousPrice * 0.005);
    if (Math.abs(mediumPrice - previousPrice) < minDiff) {
      mediumPrice = previousPrice + minDiff;
    }
  }

  if (vendorOffer.total_price != null) {
    mediumPrice = Math.min(mediumPrice, vendorOffer.total_price);
  }
  mediumPrice = Math.min(mediumPrice, maxAcceptablePrice);
  mediumPrice = Math.round(mediumPrice * 100) / 100;

  // MEDIUM payment terms
  const mediumPaymentDays = getMediumPaymentDays(config);

  // BEST delivery
  const bestDeliveryDays = getBestDeliveryDays(config, vendorOffer);

  // EXTENDED warranty
  const extendedWarranty = config.warrantyPeriodMonths + 6;

  return {
    total_price: mediumPrice,
    payment_terms: `Net ${mediumPaymentDays}`,
    payment_terms_days: mediumPaymentDays,
    delivery_days: bestDeliveryDays,
    warranty_months: extendedWarranty,
    partial_delivery_allowed: true,
  };
}


// ============================================
// FINAL MESO (75%+ Utility Trigger)
// ============================================

/**
 * Check if we should trigger final MESO offers
 * @param utilityScore - Current utility score (0-1)
 * @param round - Current round
 * @param threshold - Utility threshold for final offers (default 0.75)
 */
export function shouldTriggerFinalMeso(
  utilityScore: number,
  round: number,
  threshold: number = 0.75
): boolean {
  // Only trigger after round 2 (give some negotiation time)
  if (round < 2) return false;

  // Trigger when utility reaches threshold
  return utilityScore >= threshold;
}

/**
 * Generate final MESO options for deal closure
 * All three offers should be acceptable (>= 75% utility)
 * Uses the same parameter priority pattern as regular MESO
 */
export function generateFinalMesoOptions(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  currentUtility: number
): MesoResult {
  const options: MesoOption[] = [];

  try {
    const { targetPrice, priceRange } = config;

    // Final offers are closer to vendor's position (we're ready to close)
    // Use small price variation (2-3%) for final closure

    // Base price for finals: closer to vendor's price
    const vendorPrice = vendorOffer.total_price ?? (targetPrice + priceRange * 0.7);

    // ============================================
    // Final Offer 1: Best Price + Best Delivery + Medium Terms + Min Warranty
    // Slight discount from vendor price, fastest delivery
    // ============================================

    const finalPrice1 = Math.round((vendorPrice * 0.97) * 100) / 100; // 3% off vendor
    const mediumTerms = getMediumPaymentDays(config);
    const bestDelivery = getBestDeliveryDays(config, vendorOffer);
    const minWarranty = Math.max(0, config.warrantyPeriodMonths - 6);

    const finalOffer1: ExtendedOffer = {
      total_price: Math.max(targetPrice, finalPrice1),
      payment_terms: `Net ${mediumTerms}`,
      payment_terms_days: mediumTerms,
      delivery_days: bestDelivery,
      warranty_months: minWarranty,
      partial_delivery_allowed: config.partialDeliveryAllowed,
    };
    const finalUtility1 = calculateWeightedUtilityFromResolved(finalOffer1, config);

    options.push({
      id: `meso_${round}_final1`,
      offer: finalOffer1,
      utility: finalUtility1.totalUtility,
      label: 'Offer 1',
      description: `Best price ($${finalOffer1.total_price?.toLocaleString()}) with ${bestDelivery}-day delivery`,
      emphasis: ['price', 'delivery'],
      tradeoffs: [`${minWarranty} months warranty`, `Net ${mediumTerms} payment`],
    });

    // ============================================
    // Final Offer 2: Medium Price + Best Terms + Medium Delivery + Standard Warranty
    // Vendor price, longest payment terms
    // ============================================

    const mediumDelivery = getMediumDeliveryDays(config, vendorOffer);
    const bestTerms = config.paymentTermsMaxDays;
    const standardWarranty = config.warrantyPeriodMonths;

    const finalOffer2: ExtendedOffer = {
      total_price: Math.round(vendorPrice * 100) / 100,
      payment_terms: `Net ${bestTerms}`,
      payment_terms_days: bestTerms,
      delivery_days: mediumDelivery,
      warranty_months: standardWarranty,
      partial_delivery_allowed: config.partialDeliveryAllowed,
    };
    const finalUtility2 = calculateWeightedUtilityFromResolved(finalOffer2, config);

    options.push({
      id: `meso_${round}_final2`,
      offer: finalOffer2,
      utility: finalUtility2.totalUtility,
      label: 'Offer 2',
      description: `Extended Net ${bestTerms} payment terms with ${standardWarranty} months warranty`,
      emphasis: ['payment_terms'],
      tradeoffs: [`$${finalOffer2.total_price?.toLocaleString()} price`, `${mediumDelivery}-day delivery`],
    });

    // ============================================
    // Final Offer 3: Medium Price + Medium Terms + Best Delivery + Extended Warranty
    // Vendor price, fast delivery, bonus warranty
    // ============================================

    const extendedWarranty = config.warrantyPeriodMonths + 6;

    const finalOffer3: ExtendedOffer = {
      total_price: Math.round(vendorPrice * 100) / 100,
      payment_terms: `Net ${mediumTerms}`,
      payment_terms_days: mediumTerms,
      delivery_days: bestDelivery,
      warranty_months: extendedWarranty,
      partial_delivery_allowed: true,
    };
    const finalUtility3 = calculateWeightedUtilityFromResolved(finalOffer3, config);

    options.push({
      id: `meso_${round}_final3`,
      offer: finalOffer3,
      utility: finalUtility3.totalUtility,
      label: 'Offer 3',
      description: `Fast ${bestDelivery}-day delivery with extended ${extendedWarranty} months warranty`,
      emphasis: ['delivery', 'warranty'],
      tradeoffs: [`$${finalOffer3.total_price?.toLocaleString()} price`, `Net ${mediumTerms} payment`],
    });

    // Calculate final variance
    const utilities = options.map((o) => o.utility);
    const avgUtility = utilities.reduce((a, b) => a + b, 0) / utilities.length;
    const finalVariance = Math.max(...utilities.map((u) => Math.abs(u - avgUtility)));

    return {
      options,
      targetUtility: avgUtility,
      variance: finalVariance,
      success: true,
    };
  } catch (error) {
    return {
      options: [],
      targetUtility: currentUtility,
      variance: 0,
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error generating final MESO options',
    };
  }
}
