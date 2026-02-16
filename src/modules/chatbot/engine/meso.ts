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
} from './types.js';
import { calculateWeightedUtilityFromResolved } from './weightedUtility.js';

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
      id: `meso_${round}_price`,
      offer: priceFocusedOffer,
      utility: priceFocusedUtility.totalUtility,
      label: 'Best Price',
      description: 'Lower price with standard payment terms',
      emphasis: ['price'],
      tradeoffs: ['Prioritizes price reduction over payment flexibility'],
    });

    // ============================================
    // Option 2: Terms-Focused
    // Higher price, longer payment terms
    // ============================================

    const termsFocusedOffer = generateTermsFocusedOffer(config, vendorOffer, round, targetUtility);
    const termsFocusedUtility = calculateWeightedUtilityFromResolved(termsFocusedOffer, config);

    options.push({
      id: `meso_${round}_terms`,
      offer: termsFocusedOffer,
      utility: termsFocusedUtility.totalUtility,
      label: 'Best Terms',
      description: 'Extended payment terms with moderate price',
      emphasis: ['payment_terms'],
      tradeoffs: ['Prioritizes payment flexibility over price'],
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
        id: `meso_${round}_balanced`,
        offer: balancedOffer,
        utility: balancedUtility.totalUtility,
        label: 'Balanced',
        description: 'Balanced approach with delivery/warranty focus',
        emphasis: hasDeliveryWeight ? ['delivery', 'warranty'] : ['warranty'],
        tradeoffs: ['Balances price and terms for better delivery/warranty'],
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
 * and continues until near the end of negotiation
 */
export function shouldUseMeso(
  round: number,
  maxRounds: number,
  previousMesoRounds: number = 0
): boolean {
  // MESO starts from round 1 (PM's first counter-offer after vendor's quotation)
  // Round 0 would be before any vendor message, which shouldn't happen
  if (round < 1) return false;

  // Don't use MESO in final rounds (need to close the deal)
  if (round >= maxRounds - 1) return false;

  // Limit MESO to 3 rounds per negotiation to avoid fatigue
  if (previousMesoRounds >= 3) return false;

  // Use MESO in rounds 1 through maxRounds-2
  return true;
}
