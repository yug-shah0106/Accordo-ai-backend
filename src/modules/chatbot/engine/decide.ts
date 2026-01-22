import { Decision, Offer, extractPaymentDays, formatPaymentTerms } from './types.js';
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

/**
 * Get delivery date and days for counter-offer
 * Uses vendor's delivery if provided, otherwise falls back to config or 30-day default
 */
function getDeliveryForCounter(
  vendorOffer: Offer,
  config: NegotiationConfig
): { delivery_date: string; delivery_days: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Priority 1: Use vendor's delivery if provided
  if (vendorOffer.delivery_date) {
    const deliveryDate = new Date(vendorOffer.delivery_date);
    const days = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      delivery_date: vendorOffer.delivery_date,
      delivery_days: Math.max(1, days),
    };
  }

  // Priority 2: Use vendor's delivery_days if provided
  if (vendorOffer.delivery_days && vendorOffer.delivery_days > 0) {
    const deliveryDate = new Date(today);
    deliveryDate.setDate(deliveryDate.getDate() + vendorOffer.delivery_days);
    return {
      delivery_date: deliveryDate.toISOString().split('T')[0],
      delivery_days: vendorOffer.delivery_days,
    };
  }

  // Priority 3: Use config delivery if available
  // Note: config doesn't currently have delivery, but we'll check anyway for future compatibility
  const configDelivery = (config as unknown as { delivery?: { requiredDate?: string; preferredDate?: string } }).delivery;
  if (configDelivery?.preferredDate || configDelivery?.requiredDate) {
    const dateStr = configDelivery.preferredDate || configDelivery.requiredDate!;
    const deliveryDate = new Date(dateStr);
    const days = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      delivery_date: dateStr,
      delivery_days: Math.max(1, days),
    };
  }

  // Priority 4: Default to 30 days
  const defaultDate = new Date(today);
  defaultDate.setDate(defaultDate.getDate() + 30);
  return {
    delivery_date: defaultDate.toISOString().split('T')[0],
    delivery_days: 30,
  };
}

/**
 * Get the next better payment terms for buyer
 * UPDATED January 2026: Now supports any "Net X" format
 *
 * Strategy: If current terms are standard (30/60/90), move to next option
 * If non-standard, move toward the nearest better standard term
 * Better = longer payment time = better for buyer
 */
function nextBetterTerms(
  config: NegotiationConfig,
  t: Offer['payment_terms']
): string {
  const opts = config.parameters.payment_terms.options; // ["Net 30","Net 60","Net 90"]

  // If null or undefined, return first option
  if (!t) return opts[0];

  // Check if it's a standard term
  const idx = opts.indexOf(t as 'Net 30' | 'Net 60' | 'Net 90');
  if (idx >= 0) {
    // Standard term - move to next option (longer is better for buyer)
    return opts[Math.min(idx + 1, opts.length - 1)];
  }

  // Non-standard term - extract days and find nearest better standard
  const days = extractPaymentDays(t);
  if (days === null) return opts[0];

  // Find the next standard term with more days (better for buyer)
  if (days < 30) return 'Net 30';
  if (days < 60) return 'Net 60';
  if (days < 90) return 'Net 90';

  // Already better than all standard options, keep the same
  return t;
}

/**
 * Get the best payment terms for buyer from config
 * Typically Net 90 (longest payment time)
 */
function bestTerms(config: NegotiationConfig): string {
  const opts = config.parameters.payment_terms.options;
  return opts[opts.length - 1];
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
    const delivery = getDeliveryForCounter(vendorOffer, config);
    const counter: Offer = {
      unit_price: strongPrice,
      payment_terms: bestTermsOption,
      delivery_date: delivery.delivery_date,
      delivery_days: delivery.delivery_days,
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
  const delivery = getDeliveryForCounter(vendorOffer, config);

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
    // UPDATED January 2026: Now supports any "Net X" format
    const opts = config.parameters.payment_terms.options;
    const utils = config.parameters.payment_terms.utility;

    let chosenTerms: string = opts[opts.length - 1]; // Default to best (longest) terms
    for (const opt of opts) {
      if (utils[opt] >= requiredTermsUtil) {
        chosenTerms = opt;
        break;
      }
    }

    // If we can't meet threshold with any standard terms, improve one step
    if (utils[chosenTerms as keyof typeof utils] < requiredTermsUtil) {
      chosenTerms = nextBetterTerms(config, vendorOffer.payment_terms);
    }

    counter = {
      unit_price: vendorOffer.unit_price,
      payment_terms: chosenTerms,
      delivery_date: delivery.delivery_date,
      delivery_days: delivery.delivery_days,
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
    counter = {
      unit_price: clamped,
      payment_terms: bestTermsOption,
      delivery_date: delivery.delivery_date,
      delivery_days: delivery.delivery_days,
    };
    reasons.push(
      'Best terms already; move price slowly toward target (never above vendor offer).'
    );
  }

  return { action: 'COUNTER', utilityScore: u, counterOffer: counter, reasons };
}
