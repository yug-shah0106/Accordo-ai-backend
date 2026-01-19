/**
 * Weighted Utility Calculator
 *
 * Combines individual parameter utilities into a total weighted utility score.
 * Uses weights from Step 4 of the deal wizard to calculate the overall offer utility.
 *
 * Formula: Total Utility = Σ (Parameter_Utility × Parameter_Weight / 100)
 *
 * Thresholds (user-configurable):
 * - Accept: ≥70% (default)
 * - Counter: 50-70% (escalate zone to accept zone)
 * - Escalate: 30-50% (walk away zone to counter zone)
 * - Walk Away: <30% (default)
 */

import type {
  WeightedParameterConfig,
  ParameterUtilityResult,
  ThresholdConfig,
  WeightedUtilityResult,
  WeightedNegotiationConfig,
  ParsedVendorOffer,
} from "./types.js";
import {
  DEFAULT_THRESHOLDS,
  getRecommendationFromUtility,
} from "./types.js";
import {
  calculateParameterUtility,
  parsePaymentTermsDays,
  getDefaultParameterConfigs,
} from "./parameterUtility.js";

/**
 * Calculate weighted utility from parsed vendor offer and configuration
 */
export function calculateWeightedUtility(
  vendorOffer: ParsedVendorOffer,
  config: WeightedNegotiationConfig
): WeightedUtilityResult {
  const parameterUtilities: Record<string, ParameterUtilityResult> = {};
  let totalUtility = 0;
  let totalWeight = 0;

  // Calculate utility for each configured parameter
  for (const [paramId, paramConfig] of Object.entries(config.parameters)) {
    const value = extractValueFromOffer(vendorOffer, paramId);
    const utilityResult = calculateParameterUtility(value, paramConfig);

    parameterUtilities[paramId] = utilityResult;
    totalUtility += utilityResult.contribution;
    totalWeight += paramConfig.weight;
  }

  // Normalize if weights don't sum to 100
  // (This shouldn't happen if Step 4 validates properly, but handle it gracefully)
  if (totalWeight > 0 && totalWeight !== 100) {
    totalUtility = (totalUtility / totalWeight) * 100;
  }

  // Clamp total utility to [0, 1]
  totalUtility = Math.max(0, Math.min(1, totalUtility));

  const thresholds = config.thresholds || DEFAULT_THRESHOLDS;
  const { action, reason } = getRecommendationFromUtility(totalUtility, thresholds);

  return {
    totalUtility,
    totalUtilityPercent: totalUtility * 100,
    parameterUtilities,
    thresholds,
    recommendation: action,
    recommendationReason: reason,
  };
}

/**
 * Extract the appropriate value from a vendor offer for a given parameter ID
 */
export function extractValueFromOffer(
  offer: ParsedVendorOffer,
  paramId: string
): number | string | boolean | Date | null {
  switch (paramId) {
    case "unitPrice":
      return offer.unitPrice ?? null;
    case "totalPrice":
      return offer.totalPrice ?? null;
    case "volumeDiscount":
      return offer.volumeDiscount ?? null;
    case "paymentTermsDays":
      // Try to get days directly, or parse from string
      if (offer.paymentTermsDays !== undefined) {
        return offer.paymentTermsDays;
      }
      if (offer.paymentTerms) {
        return parsePaymentTermsDays(offer.paymentTerms);
      }
      return null;
    case "paymentTerms":
      return offer.paymentTerms ?? null;
    case "advancePayment":
      return offer.advancePayment ?? null;
    case "deliveryDate":
      return offer.deliveryDate ?? null;
    case "partialDelivery":
      return offer.partialDelivery ?? null;
    case "warrantyMonths":
      return offer.warrantyMonths ?? null;
    case "lateDeliveryPenalty":
      return offer.lateDeliveryPenalty ?? null;
    case "qualityCertifications":
      // For array values, check if any certifications exist
      return offer.qualityCertifications && offer.qualityCertifications.length > 0
        ? true
        : false;
    default:
      // Check custom parameters
      if (offer.customParameters && paramId in offer.customParameters) {
        return offer.customParameters[paramId];
      }
      return null;
  }
}

/**
 * Build weighted parameter configs from deal wizard form data
 * Combines Step 2 (Commercial) + Step 3 (Contract) data with Step 4 (Weights)
 */
export function buildWeightedConfig(
  step2Data: {
    targetUnitPrice?: number;
    maxAcceptablePrice?: number;
    volumeDiscountExpectation?: number;
    paymentTermsMin?: number;
    paymentTermsMax?: number;
    advancePaymentLimit?: number;
    deliveryDate?: string | Date;
    partialDelivery?: boolean;
  },
  step3Data: {
    warrantyPeriod?: number;
    lateDeliveryPenalty?: number;
    qualityStandards?: string[];
    maxRounds?: number;
    walkawayThreshold?: number;
    customParameters?: Array<{
      name: string;
      type: string;
      value: string | number | boolean;
      includeInNegotiation: boolean;
    }>;
  },
  step4Weights: Record<string, number>,
  thresholds?: ThresholdConfig
): WeightedNegotiationConfig {
  const defaults = getDefaultParameterConfigs();
  const parameters: Record<string, WeightedParameterConfig> = {};

  // Build unit price config
  if (step4Weights.unitPrice && step4Weights.unitPrice > 0) {
    parameters.unitPrice = {
      id: "unitPrice",
      ...defaults.unitPrice,
      weight: step4Weights.unitPrice,
      target: step2Data.targetUnitPrice ?? 0,
      max: step2Data.maxAcceptablePrice ?? step2Data.targetUnitPrice ?? 0,
    } as WeightedParameterConfig;
  }

  // Build payment terms config
  if (step4Weights.paymentTermsDays && step4Weights.paymentTermsDays > 0) {
    const termsOptions = ["Net 30", "Net 60", "Net 90"];
    const minDays = step2Data.paymentTermsMin ?? 30;
    const maxDays = step2Data.paymentTermsMax ?? 90;

    // Create utility mapping where longer terms are better for buyer
    const optionUtilities: Record<string, number> = {};
    for (const term of termsOptions) {
      const days = parsePaymentTermsDays(term) ?? 30;
      if (days <= minDays) {
        optionUtilities[term] = 0;
      } else if (days >= maxDays) {
        optionUtilities[term] = 1;
      } else {
        optionUtilities[term] = (days - minDays) / (maxDays - minDays);
      }
    }

    parameters.paymentTermsDays = {
      id: "paymentTermsDays",
      ...defaults.paymentTermsDays,
      weight: step4Weights.paymentTermsDays,
      target: maxDays,
      min: minDays,
      max: maxDays,
      options: termsOptions,
      optionUtilities,
    } as WeightedParameterConfig;
  }

  // Build advance payment config
  if (step4Weights.advancePayment && step4Weights.advancePayment > 0) {
    parameters.advancePayment = {
      id: "advancePayment",
      ...defaults.advancePayment,
      weight: step4Weights.advancePayment,
      target: 0, // Ideal: no advance payment
      max: step2Data.advancePaymentLimit ?? 50,
    } as WeightedParameterConfig;
  }

  // Build volume discount config
  if (step4Weights.volumeDiscount && step4Weights.volumeDiscount > 0) {
    parameters.volumeDiscount = {
      id: "volumeDiscount",
      ...defaults.volumeDiscount,
      weight: step4Weights.volumeDiscount,
      target: step2Data.volumeDiscountExpectation ?? 10,
      min: 0,
    } as WeightedParameterConfig;
  }

  // Build delivery date config
  if (step4Weights.deliveryDate && step4Weights.deliveryDate > 0) {
    const targetDate = step2Data.deliveryDate
      ? new Date(step2Data.deliveryDate)
      : new Date();
    const maxDate = new Date(targetDate);
    maxDate.setDate(maxDate.getDate() + 30); // 30 days tolerance

    parameters.deliveryDate = {
      id: "deliveryDate",
      ...defaults.deliveryDate,
      weight: step4Weights.deliveryDate,
      target: targetDate.toISOString(),
      max: maxDate.toISOString(),
    } as WeightedParameterConfig;
  }

  // Build partial delivery config
  if (step4Weights.partialDelivery && step4Weights.partialDelivery > 0) {
    parameters.partialDelivery = {
      id: "partialDelivery",
      ...defaults.partialDelivery,
      weight: step4Weights.partialDelivery,
      target: step2Data.partialDelivery ?? true,
    } as WeightedParameterConfig;
  }

  // Build warranty config
  if (step4Weights.warrantyMonths && step4Weights.warrantyMonths > 0) {
    parameters.warrantyMonths = {
      id: "warrantyMonths",
      ...defaults.warrantyMonths,
      weight: step4Weights.warrantyMonths,
      target: step3Data.warrantyPeriod ?? 12,
      min: 0,
    } as WeightedParameterConfig;
  }

  // Build late delivery penalty config
  if (step4Weights.lateDeliveryPenalty && step4Weights.lateDeliveryPenalty > 0) {
    parameters.lateDeliveryPenalty = {
      id: "lateDeliveryPenalty",
      ...defaults.lateDeliveryPenalty,
      weight: step4Weights.lateDeliveryPenalty,
      target: step3Data.lateDeliveryPenalty ?? 5,
      min: 0,
    } as WeightedParameterConfig;
  }

  // Build quality certifications config
  if (step4Weights.qualityCertifications && step4Weights.qualityCertifications > 0) {
    parameters.qualityCertifications = {
      id: "qualityCertifications",
      ...defaults.qualityCertifications,
      weight: step4Weights.qualityCertifications,
      target: true, // We want certifications
    } as WeightedParameterConfig;
  }

  // Add custom parameters
  if (step3Data.customParameters) {
    for (const customParam of step3Data.customParameters) {
      if (!customParam.includeInNegotiation) continue;

      const paramId = `custom_${customParam.name.toLowerCase().replace(/\s+/g, "_")}`;
      const weight = step4Weights[paramId] ?? 0;

      if (weight > 0) {
        let utilityType: "linear" | "boolean" | "stepped" = "linear";
        let direction: "lower_better" | "higher_better" | "match_target" = "match_target";

        switch (customParam.type) {
          case "boolean":
            utilityType = "boolean";
            direction = "match_target";
            break;
          case "select":
            utilityType = "stepped";
            direction = "match_target";
            break;
          default:
            utilityType = "linear";
            direction = "higher_better";
        }

        parameters[paramId] = {
          id: paramId,
          name: customParam.name,
          weight,
          source: "custom",
          utilityType,
          direction,
          target: customParam.value,
        };
      }
    }
  }

  return {
    parameters,
    thresholds: thresholds ?? DEFAULT_THRESHOLDS,
    maxRounds: step3Data.maxRounds ?? 5,
  };
}

/**
 * Convert legacy negotiation config to weighted format
 * For backwards compatibility with existing deals
 */
export function convertLegacyConfig(
  legacyConfig: {
    unit_price?: {
      weight?: number;
      anchor?: number;
      target?: number;
      max_acceptable?: number;
      concession_step?: number;
    };
    payment_terms?: {
      weight?: number;
      options?: readonly string[] | string[];
      utility?: Record<string, number>;
    };
    accept_threshold?: number;
    walkaway_threshold?: number;
    max_rounds?: number;
  }
): WeightedNegotiationConfig {
  const parameters: Record<string, WeightedParameterConfig> = {};

  // Convert unit price
  if (legacyConfig.unit_price) {
    const priceConfig = legacyConfig.unit_price;
    parameters.unitPrice = {
      id: "unitPrice",
      name: "Unit Price",
      weight: priceConfig.weight ?? 60,
      source: "step2",
      utilityType: "linear",
      direction: "lower_better",
      target: priceConfig.target ?? priceConfig.anchor ?? 0,
      max: priceConfig.max_acceptable ?? priceConfig.target ?? 0,
    };
  }

  // Convert payment terms
  if (legacyConfig.payment_terms) {
    const termsConfig = legacyConfig.payment_terms;
    parameters.paymentTermsDays = {
      id: "paymentTermsDays",
      name: "Payment Terms",
      weight: termsConfig.weight ?? 40,
      source: "step2",
      utilityType: "stepped",
      direction: "higher_better",
      target: 90, // Net 90 is best for buyer
      options: termsConfig.options ? [...termsConfig.options] : ["Net 30", "Net 60", "Net 90"],
      optionUtilities: termsConfig.utility ?? {
        "Net 30": 0.5,
        "Net 60": 0.75,
        "Net 90": 1.0,
      },
    };
  }

  // Map legacy thresholds to new format
  const thresholds: ThresholdConfig = {
    accept: legacyConfig.accept_threshold ?? DEFAULT_THRESHOLDS.accept,
    escalate: DEFAULT_THRESHOLDS.escalate,
    walkAway: legacyConfig.walkaway_threshold ?? DEFAULT_THRESHOLDS.walkAway,
  };

  return {
    parameters,
    thresholds,
    maxRounds: legacyConfig.max_rounds ?? 5,
    legacyConfig: {
      unit_price: {
        weight: legacyConfig.unit_price?.weight ?? 60,
        anchor: legacyConfig.unit_price?.anchor ?? 0,
        target: legacyConfig.unit_price?.target ?? 0,
        max_acceptable: legacyConfig.unit_price?.max_acceptable ?? 0,
        concession_step: legacyConfig.unit_price?.concession_step ?? 0,
      },
      payment_terms: {
        weight: legacyConfig.payment_terms?.weight ?? 40,
        options: legacyConfig.payment_terms?.options ? [...legacyConfig.payment_terms.options] : ["Net 30", "Net 60", "Net 90"],
        utility: legacyConfig.payment_terms?.utility ?? {
          "Net 30": 0.5,
          "Net 60": 0.75,
          "Net 90": 1.0,
        },
      },
    },
  };
}

/**
 * Get a summary of the utility calculation for display
 */
export function getUtilitySummary(result: WeightedUtilityResult): {
  overall: {
    score: number;
    percent: string;
    recommendation: string;
    reason: string;
  };
  parameters: Array<{
    name: string;
    utility: number;
    weight: number;
    contribution: number;
    status: string;
    color: string;
    currentValue: string;
    targetValue: string;
  }>;
  thresholds: {
    accept: string;
    escalate: string;
    walkAway: string;
  };
} {
  const parameters = Object.values(result.parameterUtilities).map((p) => ({
    name: p.parameterName,
    utility: Math.round(p.utility * 100),
    weight: p.weight,
    contribution: Math.round(p.contribution * 100),
    status: p.status,
    color: p.color,
    currentValue: formatValue(p.currentValue),
    targetValue: formatValue(p.targetValue),
  }));

  // Sort by weight descending
  parameters.sort((a, b) => b.weight - a.weight);

  return {
    overall: {
      score: result.totalUtility,
      percent: `${result.totalUtilityPercent.toFixed(0)}%`,
      recommendation: result.recommendation,
      reason: result.recommendationReason,
    },
    parameters,
    thresholds: {
      accept: `${(result.thresholds.accept * 100).toFixed(0)}%`,
      escalate: `${(result.thresholds.escalate * 100).toFixed(0)}%`,
      walkAway: `${(result.thresholds.walkAway * 100).toFixed(0)}%`,
    },
  };
}

/**
 * Format a value for display
 */
function formatValue(value: number | string | boolean | null): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Format as currency if it looks like a price
    if (value >= 1) {
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    // Format as percentage if decimal
    return `${(value * 100).toFixed(0)}%`;
  }
  // Check for ISO date string format
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  }
  return String(value);
}
