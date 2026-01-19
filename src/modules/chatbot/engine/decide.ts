import { Decision, Offer } from './types.js';
import { totalUtility, priceUtility, termsUtility, NegotiationConfig } from './utility.js';

/**
 * Decision Engine with Weighted Utility Thresholds
 *
 * Threshold Zones (based on cumulative weighted utility):
 * - Accept Zone:    utility >= 70% (accept_threshold)
 * - Counter Zone:   50% <= utility < 70% (escalate_threshold to accept_threshold)
 * - Escalate Zone:  30% <= utility < 50% (walkaway_threshold to escalate_threshold)
 * - Walk Away Zone: utility < 30% (walkaway_threshold)
 *
 * Default thresholds: accept=0.70, escalate=0.50, walkaway=0.30
 */

function nextBetterTerms(
  config: NegotiationConfig,
  t: Offer['payment_terms']
) {
  const opts = config.parameters.payment_terms.options; // ["Net 30","Net 60","Net 90"]
  const idx = opts.indexOf(t!);
  if (idx < 0) return opts[0];
  return opts[Math.min(idx + 1, opts.length - 1)] as
    | 'Net 30'
    | 'Net 60'
    | 'Net 90';
}

function bestTerms(config: NegotiationConfig): 'Net 30' | 'Net 60' | 'Net 90' {
  const opts = config.parameters.payment_terms.options;
  return opts[opts.length - 1] as 'Net 30' | 'Net 60' | 'Net 90';
}

export function decideNextMove(
  config: NegotiationConfig,
  vendorOffer: Offer,
  round: number
): Decision {
  const reasons: string[] = [];

  // Get thresholds with defaults (70%, 50%, 30%)
  const acceptThreshold = config.accept_threshold ?? 0.70;
  const escalateThreshold = config.escalate_threshold ?? 0.50;
  const walkawayThreshold = config.walkaway_threshold ?? 0.30;

  // Allow rounds 1..max_rounds, escalate after that
  if (round > config.max_rounds) {
    return {
      action: 'ESCALATE',
      utilityScore: 0,
      counterOffer: null,
      reasons: [`Max rounds (${config.max_rounds}) exceeded`],
    };
  }

  // Clarify if missing
  if (
    vendorOffer.unit_price == null ||
    vendorOffer.payment_terms == null
  ) {
    return {
      action: 'ASK_CLARIFY',
      utilityScore: 0,
      counterOffer: null,
      reasons: ['Missing unit_price or payment_terms in vendor offer.'],
    };
  }

  const max = config.parameters.unit_price.max_acceptable;
  if (vendorOffer.unit_price > max) {
    return {
      action: 'WALK_AWAY',
      utilityScore: 0,
      counterOffer: null,
      reasons: [`Price ${vendorOffer.unit_price} > max acceptable ${max}`],
    };
  }

  const u = totalUtility(config, vendorOffer);

  // Decision zones based on cumulative weighted utility:
  // Accept Zone: utility >= 70%
  if (u >= acceptThreshold) {
    return {
      action: 'ACCEPT',
      utilityScore: u,
      counterOffer: null,
      reasons: [`Utility ${(u * 100).toFixed(0)}% >= accept threshold ${(acceptThreshold * 100).toFixed(0)}%`],
    };
  }

  // Walk Away Zone: utility < 30%
  if (u < walkawayThreshold) {
    return {
      action: 'WALK_AWAY',
      utilityScore: u,
      counterOffer: null,
      reasons: [`Utility ${(u * 100).toFixed(0)}% < walkaway threshold ${(walkawayThreshold * 100).toFixed(0)}%`],
    };
  }

  // Escalate Zone: 30% <= utility < 50%
  if (u < escalateThreshold) {
    const { target, anchor, concession_step } = config.parameters.unit_price;
    const bestTermsOption = bestTerms(config);

    // Make a strong counter but flag for human review
    const buyerPosition = Math.min(
      target,
      anchor + (round - 1) * concession_step
    );
    const strongPrice = Math.min(vendorOffer.unit_price, buyerPosition);
    const counter: Offer = {
      unit_price: strongPrice,
      payment_terms: bestTermsOption,
    };

    return {
      action: 'ESCALATE',
      utilityScore: u,
      counterOffer: counter,
      reasons: [`Utility ${(u * 100).toFixed(0)}% in escalate zone (${(walkawayThreshold * 100).toFixed(0)}%-${(escalateThreshold * 100).toFixed(0)}%). Proposing counter but needs human review.`],
    };
  }

  // Counter Zone: 50% <= utility < 70%
  // Continue negotiating with counter-offers

  // Counter strategy: Pactum-like - solve for minimum terms needed to hit accept threshold
  let counter: Offer;
  const bestTermsOption = bestTerms(config);

  if (vendorOffer.payment_terms !== bestTermsOption) {
    // Strategy: Compute required terms utility to hit accept threshold at vendor price
    const wP = config.parameters.unit_price.weight;
    const wT = config.parameters.payment_terms.weight;

    const priceUtil = priceUtility(config, vendorOffer.unit_price);
    const priceContribution = wP * priceUtil;

    // Required terms utility to hit accept threshold
    const requiredTermsUtil =
      (acceptThreshold - priceContribution) / wT;

    // Find cheapest terms option that meets the requirement
    const opts = config.parameters.payment_terms.options;
    const utils = config.parameters.payment_terms.utility;

    let chosenTerms: 'Net 30' | 'Net 60' | 'Net 90' = 'Net 90';
    for (const opt of opts) {
      if (utils[opt] >= requiredTermsUtil) {
        chosenTerms = opt as 'Net 30' | 'Net 60' | 'Net 90';
        break;
      }
    }

    // If we can't meet threshold with any terms, just improve one step
    if (utils[chosenTerms] < requiredTermsUtil) {
      chosenTerms = nextBetterTerms(config, vendorOffer.payment_terms);
    }

    counter = {
      unit_price: vendorOffer.unit_price,
      payment_terms: chosenTerms,
    };
    reasons.push(
      `Trade-off: keep price, request ${chosenTerms} to reach target utility.`
    );
  } else {
    // Buyer-side price movement: start at anchor, move slowly toward target
    // Never counter above vendor price, never exceed max acceptable
    const { target, anchor, concession_step, max_acceptable } =
      config.parameters.unit_price;

    // buyer "position" increases slowly from anchor -> target
    // Fix: start at anchor (round 1), then add steps for subsequent rounds
    const buyerPosition = Math.min(
      target,
      anchor + (round - 1) * concession_step
    );

    // never counter above vendor's offer
    const desiredPrice = Math.min(vendorOffer.unit_price, buyerPosition);

    // clamp
    const clamped = Math.min(desiredPrice, max_acceptable);

    const bestTermsOption = bestTerms(config);
    counter = { unit_price: clamped, payment_terms: bestTermsOption };
    reasons.push(
      'Best terms already; move price slowly toward target (never above vendor offer).'
    );
  }

  return { action: 'COUNTER', utilityScore: u, counterOffer: counter, reasons };
}
