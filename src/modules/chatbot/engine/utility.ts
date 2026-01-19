import { Offer, Explainability, Decision } from './types.js';

/**
 * NegotiationConfig defines the parameters and thresholds for utility-based negotiations.
 *
 * Threshold Zones (based on cumulative weighted utility 0-100%):
 * - Accept Zone: utility >= accept_threshold (default 70%)
 * - Counter Zone: utility >= escalate_threshold AND < accept_threshold (50-70%)
 * - Escalate Zone: utility >= walkaway_threshold AND < escalate_threshold (30-50%)
 * - Walk Away Zone: utility < walkaway_threshold (< 30%)
 */
export interface NegotiationConfig {
  parameters: {
    unit_price: {
      weight: number;
      direction: string;
      anchor: number;
      target: number;
      max_acceptable: number;
      concession_step: number;
    };
    payment_terms: {
      weight: number;
      options: readonly ['Net 30', 'Net 60', 'Net 90'];
      utility: {
        'Net 30': number;
        'Net 60': number;
        'Net 90': number;
      };
    };
  };
  /** Accept threshold - utility >= this triggers ACCEPT (default: 0.70 = 70%) */
  accept_threshold: number;
  /** Escalate threshold - utility >= this but < accept triggers COUNTER, < this triggers ESCALATE (default: 0.50 = 50%) */
  escalate_threshold?: number;
  /** Walk away threshold - utility < this triggers WALK_AWAY (default: 0.30 = 30%) */
  walkaway_threshold: number;
  max_rounds: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function priceUtility(config: NegotiationConfig, price: number) {
  const { anchor, max_acceptable } = config.parameters.unit_price;
  if (price <= anchor) return 1;
  if (price >= max_acceptable) return 0;
  return clamp01(1 - (price - anchor) / (max_acceptable - anchor));
}

export function termsUtility(
  config: NegotiationConfig,
  terms: 'Net 30' | 'Net 60' | 'Net 90'
) {
  return config.parameters.payment_terms.utility[terms] ?? 0;
}

export function totalUtility(config: NegotiationConfig, offer: Offer) {
  const wP = config.parameters.unit_price.weight;
  const wT = config.parameters.payment_terms.weight;

  const pu =
    offer.unit_price == null ? 0 : priceUtility(config, offer.unit_price);
  const tu =
    offer.payment_terms == null
      ? 0
      : termsUtility(config, offer.payment_terms);
  return clamp01(pu * wP + tu * wT);
}

/**
 * Compute explainability payload from config, vendor offer, and decision
 * This provides a complete audit trail of how the decision was made
 */
export function computeExplainability(
  config: NegotiationConfig,
  vendorOffer: Offer,
  decision: Decision
): Explainability {
  const wP = config.parameters.unit_price.weight;
  const wT = config.parameters.payment_terms.weight;

  const pu =
    vendorOffer.unit_price == null
      ? null
      : priceUtility(config, vendorOffer.unit_price);
  const tu =
    vendorOffer.payment_terms == null
      ? null
      : termsUtility(config, vendorOffer.payment_terms);

  const weightedPrice = pu == null ? null : pu * wP;
  const weightedTerms = tu == null ? null : tu * wT;

  const total =
    weightedPrice == null || weightedTerms == null
      ? null
      : clamp01(weightedPrice + weightedTerms);

  return {
    vendorOffer: {
      unit_price: vendorOffer.unit_price,
      payment_terms: vendorOffer.payment_terms,
    },
    utilities: {
      priceUtility: pu,
      termsUtility: tu,
      weightedPrice,
      weightedTerms,
      total,
    },
    decision: {
      action: decision.action,
      reasons: decision.reasons,
      counterOffer: decision.counterOffer ?? null,
    },
    configSnapshot: {
      weights: { price: wP, terms: wT },
      thresholds: {
        accept: config.accept_threshold,
        escalate: config.escalate_threshold ?? 0.50,
        walkaway: config.walkaway_threshold,
      },
      unitPrice: {
        anchor: config.parameters.unit_price.anchor,
        target: config.parameters.unit_price.target,
        max: config.parameters.unit_price.max_acceptable,
        step: config.parameters.unit_price.concession_step,
      },
      termOptions: [...config.parameters.payment_terms.options],
    },
  };
}
