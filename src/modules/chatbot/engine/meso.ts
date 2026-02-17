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
    // Option 1: Price-Focused
    // Lower price, standard terms
    // ============================================

    const priceFocusedOffer = generatePriceFocusedOffer(config, vendorOffer, round, targetUtility);
    const priceFocusedUtility = calculateWeightedUtilityFromResolved(priceFocusedOffer, config);

    options.push({
      id: `meso_${round}_offer1`,
      offer: priceFocusedOffer,
      utility: priceFocusedUtility.totalUtility,
      label: 'Offer 1',
      description: '',
      emphasis: ['price'],
      tradeoffs: [],
    });

    // ============================================
    // Option 2: Terms-Focused
    // Higher price, longer payment terms
    // ============================================

    const termsFocusedOffer = generateTermsFocusedOffer(config, vendorOffer, round, targetUtility);
    const termsFocusedUtility = calculateWeightedUtilityFromResolved(termsFocusedOffer, config);

    options.push({
      id: `meso_${round}_offer2`,
      offer: termsFocusedOffer,
      utility: termsFocusedUtility.totalUtility,
      label: 'Offer 2',
      description: '',
      emphasis: ['payment_terms'],
      tradeoffs: [],
    });

    // ============================================
    // Option 3: Balanced (only if config supports delivery/warranty)
    // Moderate price, moderate terms, better delivery/warranty
    // ============================================

    const hasDeliveryWeight = (config.weights.deliveryDate ?? 0) > 3;
    const hasWarrantyWeight = (config.weights.warrantyPeriod ?? 0) > 3;

    if (hasDeliveryWeight || hasWarrantyWeight) {
      const balancedOffer = generateBalancedOffer(config, vendorOffer, round, targetUtility);
      const balancedUtility = calculateWeightedUtilityFromResolved(balancedOffer, config);

      options.push({
        id: `meso_${round}_offer3`,
        offer: balancedOffer,
        utility: balancedUtility.totalUtility,
        label: 'Offer 3',
        description: '',
        emphasis: hasDeliveryWeight ? ['delivery', 'warranty'] : ['warranty'],
        tradeoffs: [],
      });
    }

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

/**
 * Generate a price-focused counter-offer
 * Prioritizes lower price, accepts standard payment terms
 */
function generatePriceFocusedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // More aggressive price (closer to target)
  const aggressiveness = priority === 'HIGH' ? 0.20 : priority === 'LOW' ? 0.40 : 0.30;
  const roundAdjustment = Math.min(0.10, round * 0.02);

  let counterPrice = targetPrice + priceRange * (aggressiveness + roundAdjustment);

  // Never exceed vendor's offer
  if (vendorOffer.total_price != null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }
  counterPrice = Math.min(counterPrice, maxAcceptablePrice);
  counterPrice = Math.round(counterPrice * 100) / 100;

  // Standard payment terms (min days)
  const paymentDays = config.paymentTermsMinDays;

  return {
    total_price: counterPrice,
    payment_terms: `Net ${paymentDays}`,
    payment_terms_days: paymentDays,
    delivery_days: vendorOffer.delivery_days ?? 30,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: config.warrantyPeriodMonths,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate a terms-focused counter-offer
 * Accepts higher price for longer payment terms
 */
function generateTermsFocusedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Less aggressive price (further from target)
  const aggressiveness = priority === 'HIGH' ? 0.35 : priority === 'LOW' ? 0.55 : 0.45;
  const roundAdjustment = Math.min(0.10, round * 0.02);

  let counterPrice = targetPrice + priceRange * (aggressiveness + roundAdjustment);

  // Never exceed vendor's offer
  if (vendorOffer.total_price != null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }
  counterPrice = Math.min(counterPrice, maxAcceptablePrice);
  counterPrice = Math.round(counterPrice * 100) / 100;

  // Longer payment terms (max days)
  const paymentDays = config.paymentTermsMaxDays;

  return {
    total_price: counterPrice,
    payment_terms: `Net ${paymentDays}`,
    payment_terms_days: paymentDays,
    delivery_days: vendorOffer.delivery_days ?? 30,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: config.warrantyPeriodMonths,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate a balanced counter-offer
 * Moderate price and terms, focuses on delivery/warranty
 */
function generateBalancedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  targetUtility: number
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Moderate aggressiveness
  const aggressiveness = priority === 'HIGH' ? 0.28 : priority === 'LOW' ? 0.48 : 0.38;
  const roundAdjustment = Math.min(0.10, round * 0.02);

  let counterPrice = targetPrice + priceRange * (aggressiveness + roundAdjustment);

  if (vendorOffer.total_price != null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }
  counterPrice = Math.min(counterPrice, maxAcceptablePrice);
  counterPrice = Math.round(counterPrice * 100) / 100;

  // Moderate payment terms
  const paymentDays = Math.round((config.paymentTermsMinDays + config.paymentTermsMaxDays) / 2);

  // Request better delivery/warranty
  let deliveryDays = vendorOffer.delivery_days ?? 30;
  if (config.deliveryDate) {
    const targetDays = Math.ceil(
      (config.deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    deliveryDays = Math.min(deliveryDays, targetDays);
  }

  // Request more warranty
  const warrantyMonths = Math.max(
    config.warrantyPeriodMonths,
    (vendorOffer.warranty_months ?? config.warrantyPeriodMonths) + 3
  );

  return {
    total_price: counterPrice,
    payment_terms: `Net ${paymentDays}`,
    payment_terms_days: paymentDays,
    delivery_days: deliveryDays,
    warranty_months: warrantyMonths,
    partial_delivery_allowed: true, // Request flexibility
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
 * Generate dynamic price-focused offer with concessions
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
  // If vendor prefers price, we're slightly more aggressive on price
  const baseAggressiveness = priority === 'HIGH' ? 0.20 : priority === 'LOW' ? 0.40 : 0.30;
  const emphasisAdjustment = (priceEmphasis - 0.5) * 0.1; // -0.05 to +0.05 based on preference

  // Round-based concession: move toward vendor each round
  const roundConcession = round * concessionRate;

  let counterPrice = targetPrice + priceRange * (baseAggressiveness + emphasisAdjustment + roundConcession);

  // Ensure different from previous round (at least $50 or 0.5% different)
  if (previousPrice != null) {
    const minDiff = Math.max(50, previousPrice * 0.005);
    if (Math.abs(counterPrice - previousPrice) < minDiff) {
      counterPrice = previousPrice + minDiff; // Move toward vendor
    }
  }

  // Never exceed vendor's offer
  if (vendorOffer.total_price != null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }
  counterPrice = Math.min(counterPrice, maxAcceptablePrice);
  counterPrice = Math.round(counterPrice * 100) / 100;

  // Standard payment terms
  const paymentDays = config.paymentTermsMinDays;

  return {
    total_price: counterPrice,
    payment_terms: `Net ${paymentDays}`,
    payment_terms_days: paymentDays,
    delivery_days: vendorOffer.delivery_days ?? 30,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: config.warrantyPeriodMonths,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate dynamic terms-focused offer with concessions
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

  // Less aggressive on price for terms-focused offer
  const baseAggressiveness = priority === 'HIGH' ? 0.35 : priority === 'LOW' ? 0.55 : 0.45;
  const emphasisAdjustment = (termsEmphasis - 0.5) * 0.1;

  // Round-based concession
  const roundConcession = round * concessionRate;

  let counterPrice = targetPrice + priceRange * (baseAggressiveness + emphasisAdjustment + roundConcession);

  // Ensure different from previous round
  if (previousPrice != null) {
    const minDiff = Math.max(50, previousPrice * 0.005);
    if (Math.abs(counterPrice - previousPrice) < minDiff) {
      counterPrice = previousPrice + minDiff;
    }
  }

  if (vendorOffer.total_price != null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }
  counterPrice = Math.min(counterPrice, maxAcceptablePrice);
  counterPrice = Math.round(counterPrice * 100) / 100;

  // Extended payment terms
  const paymentDays = config.paymentTermsMaxDays;

  return {
    total_price: counterPrice,
    payment_terms: `Net ${paymentDays}`,
    payment_terms_days: paymentDays,
    delivery_days: vendorOffer.delivery_days ?? 30,
    delivery_date: vendorOffer.delivery_date ?? undefined,
    warranty_months: config.warrantyPeriodMonths,
    partial_delivery_allowed: config.partialDeliveryAllowed,
  };
}

/**
 * Generate dynamic balanced offer with concessions
 */
function generateDynamicBalancedOffer(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  concessionRate: number,
  previousPrice: number | null | undefined
): ExtendedOffer {
  const { targetPrice, maxAcceptablePrice, priceRange, priority } = config;

  // Moderate aggressiveness
  const baseAggressiveness = priority === 'HIGH' ? 0.28 : priority === 'LOW' ? 0.48 : 0.38;

  // Round-based concession
  const roundConcession = round * concessionRate;

  let counterPrice = targetPrice + priceRange * (baseAggressiveness + roundConcession);

  // Ensure different from previous round
  if (previousPrice != null) {
    const minDiff = Math.max(50, previousPrice * 0.005);
    if (Math.abs(counterPrice - previousPrice) < minDiff) {
      counterPrice = previousPrice + minDiff;
    }
  }

  if (vendorOffer.total_price != null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }
  counterPrice = Math.min(counterPrice, maxAcceptablePrice);
  counterPrice = Math.round(counterPrice * 100) / 100;

  // Moderate payment terms
  const paymentDays = Math.round((config.paymentTermsMinDays + config.paymentTermsMaxDays) / 2);

  // Better delivery/warranty
  let deliveryDays = vendorOffer.delivery_days ?? 30;
  if (config.deliveryDate) {
    const targetDays = Math.ceil(
      (config.deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    deliveryDays = Math.min(deliveryDays, targetDays);
  }

  const warrantyMonths = Math.max(
    config.warrantyPeriodMonths,
    (vendorOffer.warranty_months ?? config.warrantyPeriodMonths) + 3
  );

  return {
    total_price: counterPrice,
    payment_terms: `Net ${paymentDays}`,
    payment_terms_days: paymentDays,
    delivery_days: deliveryDays,
    warranty_months: warrantyMonths,
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
 */
export function generateFinalMesoOptions(
  config: ResolvedNegotiationConfig,
  vendorOffer: ExtendedOffer,
  round: number,
  currentUtility: number
): MesoResult {
  const options: MesoOption[] = [];

  try {
    const { targetPrice, maxAcceptablePrice, priceRange } = config;

    // Final offers are closer to vendor's position (we're ready to close)
    // All should yield >= 75% utility

    // ============================================
    // Final Offer 1: Vendor's price, our terms
    // ============================================

    const finalOffer1: ExtendedOffer = {
      total_price: vendorOffer.total_price,
      payment_terms: `Net ${config.paymentTermsMaxDays}`,
      payment_terms_days: config.paymentTermsMaxDays,
      delivery_days: vendorOffer.delivery_days ?? 30,
      warranty_months: config.warrantyPeriodMonths,
      partial_delivery_allowed: config.partialDeliveryAllowed,
    };
    const finalUtility1 = calculateWeightedUtilityFromResolved(finalOffer1, config);

    options.push({
      id: `meso_${round}_final1`,
      offer: finalOffer1,
      utility: finalUtility1.totalUtility,
      label: 'Offer 1',
      description: '',
      emphasis: ['payment_terms'],
      tradeoffs: [],
    });

    // ============================================
    // Final Offer 2: Slight price reduction, vendor's terms
    // ============================================

    const slightReduction = priceRange * 0.05; // 5% reduction from vendor
    const finalPrice2 = vendorOffer.total_price != null
      ? Math.max(targetPrice, vendorOffer.total_price - slightReduction)
      : targetPrice + priceRange * 0.6;

    const vendorTermsDays = vendorOffer.payment_terms_days ?? 30;

    const finalOffer2: ExtendedOffer = {
      total_price: Math.round(finalPrice2 * 100) / 100,
      payment_terms: `Net ${vendorTermsDays}`,
      payment_terms_days: vendorTermsDays,
      delivery_days: vendorOffer.delivery_days ?? 30,
      warranty_months: config.warrantyPeriodMonths,
      partial_delivery_allowed: config.partialDeliveryAllowed,
    };
    const finalUtility2 = calculateWeightedUtilityFromResolved(finalOffer2, config);

    options.push({
      id: `meso_${round}_final2`,
      offer: finalOffer2,
      utility: finalUtility2.totalUtility,
      label: 'Offer 2',
      description: '',
      emphasis: ['price'],
      tradeoffs: [],
    });

    // ============================================
    // Final Offer 3: Split the difference on both
    // ============================================

    const midPrice = vendorOffer.total_price != null
      ? (vendorOffer.total_price + targetPrice + priceRange * 0.5) / 2
      : targetPrice + priceRange * 0.55;

    const midTerms = Math.round((config.paymentTermsMinDays + config.paymentTermsMaxDays) / 2);

    const finalOffer3: ExtendedOffer = {
      total_price: Math.round(midPrice * 100) / 100,
      payment_terms: `Net ${midTerms}`,
      payment_terms_days: midTerms,
      delivery_days: vendorOffer.delivery_days ?? 30,
      warranty_months: config.warrantyPeriodMonths + 3, // Bonus warranty
      partial_delivery_allowed: true,
    };
    const finalUtility3 = calculateWeightedUtilityFromResolved(finalOffer3, config);

    options.push({
      id: `meso_${round}_final3`,
      offer: finalOffer3,
      utility: finalUtility3.totalUtility,
      label: 'Offer 3',
      description: '',
      emphasis: ['warranty'],
      tradeoffs: [],
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
