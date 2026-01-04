/**
 * Vendor Policy Configuration
 *
 * Defines default negotiation policies for different vendor scenarios.
 * Each scenario has different concession willingness and constraints.
 */

import type { VendorPolicy, VendorScenario } from './types.js';

/**
 * Default vendor policy (baseline)
 */
export const DEFAULT_VENDOR_POLICY: VendorPolicy = {
  minPrice: 90,
  startPrice: 110,
  preferredTerms: 'Net 30',
  concessionStep: 2,
  maxRounds: 6,
  minAcceptableTerms: 'Net 60',
};

/**
 * Get vendor policy for a specific scenario
 *
 * @param scenario - Vendor negotiation scenario
 * @param basePrice - Optional base price to calculate from (defaults to 100)
 * @returns Vendor policy configuration
 */
export function getScenarioPolicy(
  scenario: VendorScenario,
  basePrice: number = 100
): VendorPolicy {
  switch (scenario) {
    case 'HARD':
      // Resistant vendor: small concessions, high floor price
      return {
        minPrice: basePrice * 0.95, // Only willing to go 5% below base
        startPrice: basePrice * 1.15, // Starts 15% above base
        preferredTerms: 'Net 30',
        concessionStep: basePrice * 0.01, // 1% concessions only
        maxRounds: 8, // Willing to negotiate longer
        minAcceptableTerms: 'Net 30', // Won't budge on terms
      };

    case 'SOFT':
      // Flexible vendor: reasonable concessions, lower floor price
      return {
        minPrice: basePrice * 0.85, // Willing to go 15% below base
        startPrice: basePrice * 1.1, // Starts 10% above base
        preferredTerms: 'Net 30',
        concessionStep: basePrice * 0.03, // 3% concessions
        maxRounds: 6, // Standard negotiation length
        minAcceptableTerms: 'Net 90', // Flexible on terms
      };

    case 'WALK_AWAY':
      // Inflexible vendor: no concessions, take it or leave it
      return {
        minPrice: basePrice * 1.0, // Won't go below base price
        startPrice: basePrice * 1.1, // Starts 10% above base
        preferredTerms: 'Net 30',
        concessionStep: 0, // No price concessions
        maxRounds: 3, // Quick to walk away
        minAcceptableTerms: 'Net 30', // No term flexibility
      };

    default:
      return DEFAULT_VENDOR_POLICY;
  }
}

/**
 * Merge custom policy with scenario defaults
 *
 * @param scenario - Base scenario
 * @param customPolicy - Custom policy overrides
 * @param basePrice - Base price for calculations
 * @returns Merged vendor policy
 */
export function mergeVendorPolicy(
  scenario: VendorScenario,
  customPolicy: Partial<VendorPolicy> = {},
  basePrice: number = 100
): VendorPolicy {
  const scenarioPolicy = getScenarioPolicy(scenario, basePrice);

  return {
    ...scenarioPolicy,
    ...customPolicy,
  };
}

/**
 * Calculate next vendor price based on policy and round
 *
 * @param policy - Vendor negotiation policy
 * @param currentPrice - Current vendor price
 * @param round - Current negotiation round
 * @param accordoPrice - Accordo's counter-offer price (influences concession)
 * @returns Next vendor price
 */
export function calculateNextVendorPrice(
  policy: VendorPolicy,
  currentPrice: number,
  round: number,
  accordoPrice: number | null
): number {
  // If at or below minimum price, don't go lower
  if (currentPrice <= policy.minPrice) {
    return policy.minPrice;
  }

  // If past max rounds, stick to minimum price or walk away
  if (round >= policy.maxRounds) {
    return policy.minPrice;
  }

  // Calculate concession
  let concession = policy.concessionStep;

  // If Accordo's price is close to vendor's, make smaller concession
  if (accordoPrice !== null) {
    const gap = currentPrice - accordoPrice;
    if (gap < policy.concessionStep * 2) {
      // If gap is small, make a final move toward middle
      concession = gap * 0.5;
    }
  }

  // Apply concession but don't go below min price
  const nextPrice = Math.max(currentPrice - concession, policy.minPrice);

  return Math.round(nextPrice * 100) / 100; // Round to 2 decimals
}

/**
 * Determine if vendor should walk away
 *
 * @param policy - Vendor policy
 * @param round - Current round
 * @param currentPrice - Current vendor price
 * @param accordoPrice - Accordo's latest offer
 * @returns True if vendor should walk away
 */
export function shouldVendorWalkAway(
  policy: VendorPolicy,
  round: number,
  currentPrice: number,
  accordoPrice: number | null
): boolean {
  // Walk away if exceeded max rounds
  if (round > policy.maxRounds) {
    return true;
  }

  // Walk away if Accordo's price is unreasonably low (below min price - 10%)
  if (accordoPrice !== null && accordoPrice < policy.minPrice * 0.9) {
    return true;
  }

  // Walk away if at minimum price and Accordo still wants lower
  if (currentPrice <= policy.minPrice && accordoPrice !== null && accordoPrice < currentPrice) {
    return true;
  }

  return false;
}

/**
 * Calculate next vendor payment terms based on policy
 *
 * @param policy - Vendor policy
 * @param currentTerms - Current payment terms
 * @param accordoTerms - Accordo's desired terms
 * @returns Next payment terms vendor will offer
 */
export function calculateNextVendorTerms(
  policy: VendorPolicy,
  currentTerms: 'Net 30' | 'Net 60' | 'Net 90',
  accordoTerms: 'Net 30' | 'Net 60' | 'Net 90' | null
): 'Net 30' | 'Net 60' | 'Net 90' {
  // If no flexibility, stick to preferred terms
  if (policy.minAcceptableTerms === policy.preferredTerms) {
    return policy.preferredTerms;
  }

  // If Accordo wants longer terms and vendor can accommodate
  if (accordoTerms) {
    const termsOrder = ['Net 30', 'Net 60', 'Net 90'];
    const accordoIndex = termsOrder.indexOf(accordoTerms);
    const minIndex = termsOrder.indexOf(policy.minAcceptableTerms || 'Net 90');

    if (accordoIndex <= minIndex) {
      // Vendor can accept Accordo's terms
      return accordoTerms;
    } else {
      // Vendor offers their worst acceptable terms
      return policy.minAcceptableTerms || 'Net 90';
    }
  }

  // Default to preferred terms
  return currentTerms || policy.preferredTerms;
}
