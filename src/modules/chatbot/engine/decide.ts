import { Decision, Offer } from './types.js';
import { totalUtility, priceUtility, termsUtility, NegotiationConfig } from './utility.js';

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

  if (u >= config.accept_threshold) {
    return {
      action: 'ACCEPT',
      utilityScore: u,
      counterOffer: null,
      reasons: [`Utility ${u} >= accept threshold ${config.accept_threshold}`],
    };
  }

  // ✅ IMPORTANT: do NOT ESCALATE just because u is low
  // Instead, give a stronger counter package
  if (u < config.walkaway_threshold) {
    const { target, anchor, concession_step } = config.parameters.unit_price;
    const bestTermsOption = bestTerms(config);

    // Strong but plausible counter: use anchor + controlled steps
    const buyerPosition = Math.min(
      target,
      anchor + (round - 1) * concession_step
    );
    const strongPrice = Math.min(vendorOffer.unit_price, buyerPosition); // never above vendor
    const counter: Offer = {
      unit_price: strongPrice,
      payment_terms: bestTermsOption,
    };

    return {
      action: 'COUNTER',
      utilityScore: u,
      counterOffer: counter,
      reasons: ['Low utility; proposing a stronger package instead of closing.'],
    };
  }

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
      (config.accept_threshold - priceContribution) / wT;

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
