import { Decision, Offer, extractPaymentDays, formatPaymentTerms, NegotiationState, AccumulatedOffer, PmCounterRecord, BehavioralSignals, AdaptiveStrategyResult, DynamicRoundConfig } from './types.js';
import { totalUtility, priceUtility, termsUtility, NegotiationConfig } from './utility.js';
import { detectVendorEmphasis, getTotalPriceConcession, getLastPmCounter } from './preferenceDetector.js';

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

/**
 * Calculate counter-offer price based on priority strategy
 *
 * Priority strategies (aggressiveness = how much PM moves toward vendor's offer):
 * - HIGH (Maximize Savings): 15% of range - PM stays very close to target (hardest negotiator)
 * - MEDIUM (Fair Deal): 40% of range - PM moves moderately toward vendor
 * - LOW (Quick Close): 55% of range - PM moves more toward vendor (faster closure)
 *
 * Formula: Counter = PM's Target + (Aggressiveness × Range)
 * Where Range = Vendor's Offer - PM's Target
 */
function calculateCounterPrice(
  config: NegotiationConfig,
  vendorOffer: Offer,
  round: number
): number {
  const { target, max_acceptable, anchor, concession_step } = config.parameters.total_price;
  const priceRange = max_acceptable - target;
  const priority = config.priority || 'MEDIUM';

  let counterPrice: number;

  switch (priority) {
    case 'HIGH': {
      // Maximize Savings: Counter at 15% of range above target (very aggressive)
      // Small concessions as rounds progress: starts at 10%, max 15%
      const aggressiveOffset = Math.min(0.15, 0.10 + round * 0.01); // 10% + 1% per round, max 15%
      counterPrice = target + priceRange * aggressiveOffset;
      break;
    }
    case 'LOW': {
      // Quick Close: Counter at 55% of range above target
      // More willing to meet vendor halfway for faster closure
      const quickCloseOffset = Math.min(0.55, 0.50 + round * 0.01); // 50% + 1% per round, max 55%
      counterPrice = target + priceRange * quickCloseOffset;
      break;
    }
    case 'MEDIUM':
    default: {
      // Fair Deal: Counter at 40% of range above target
      const balancedOffset = Math.min(0.40, 0.35 + round * 0.01); // 35% + 1% per round, max 40%
      counterPrice = target + priceRange * balancedOffset;
      break;
    }
  }

  // Never counter above vendor's offer (would be illogical)
  if (vendorOffer.total_price !== null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }

  // Never exceed max acceptable
  counterPrice = Math.min(counterPrice, max_acceptable);

  // Round to 2 decimal places
  return Math.round(counterPrice * 100) / 100;
}

/**
 * Generate flexible payment terms (not limited to 30/60/90)
 *
 * @param currentDays - Current payment terms in days
 * @param direction - 'increase' for longer terms (better for buyer), 'decrease' for shorter
 * @param step - Step size in days (default 15)
 * @returns New payment terms string (e.g., "Net 45", "Net 55")
 *
 * @example
 * ```typescript
 * generateFlexibleTerms(30, 'increase', 15) // "Net 45"
 * generateFlexibleTerms(60, 'decrease', 10) // "Net 50"
 * ```
 */
export function generateFlexibleTerms(
  currentDays: number,
  direction: 'increase' | 'decrease',
  step: number = 15
): string {
  const newDays = direction === 'increase'
    ? Math.min(currentDays + step, 120) // Max 120 days
    : Math.max(currentDays - step, 7);   // Min 7 days

  return formatPaymentTerms(newDays);
}

/**
 * Calculate dynamic counter-offer based on vendor preference detection
 *
 * Strategy:
 * - If vendor is price-focused: Offer HIGHER price, push for LONGER payment terms
 * - If vendor is terms-focused: Push for LOWER price, offer FLEXIBLE terms
 * - If balanced/unknown: Use standard priority-based calculation
 *
 * @param config - Negotiation configuration
 * @param vendorOffer - Current vendor offer
 * @param round - Current round number
 * @param negotiationState - Tracked negotiation state (optional)
 * @param previousPmOffer - Previous PM counter-offer (optional)
 * @returns Counter-offer with price and terms
 */
export function calculateDynamicCounter(
  config: NegotiationConfig,
  vendorOffer: Offer,
  round: number,
  negotiationState?: NegotiationState | null,
  previousPmOffer?: Offer | PmCounterRecord | null,
  adaptiveStrategy?: AdaptiveStrategyResult | null
): { price: number; terms: string; strategy: string } {
  const { target, max_acceptable } = config.parameters.total_price;
  const priceRange = max_acceptable - target;
  const priority = config.priority || 'MEDIUM';

  // Use adaptive aggressiveness when available, otherwise fall back to static base
  const baseAggressiveness = adaptiveStrategy
    ? adaptiveStrategy.adjustedAggressiveness
    : ({
        HIGH: 0.15,   // 15% above target
        MEDIUM: 0.40, // 40% above target
        LOW: 0.55,    // 55% above target
      }[priority] ?? 0.40);

  // Round adjustment: 2% per round, max 10%
  const roundAdjustment = Math.min(0.10, round * 0.02);

  // Calculate concession bonus (up to 10% if vendor dropped price)
  let concessionBonus = 0;
  if (negotiationState) {
    const totalConcession = getTotalPriceConcession(negotiationState);
    concessionBonus = Math.min(0.10, totalConcession / 100);
  }

  // Detect vendor emphasis and calculate emphasis adjustment
  let emphasisAdjustment = 0;
  let chosenTerms: string;
  let strategy: string;

  if (negotiationState && negotiationState.vendorEmphasis !== 'unknown' && negotiationState.emphasisConfidence >= 0.7) {
    const { vendorEmphasis, emphasisConfidence } = negotiationState;

    if (vendorEmphasis === 'price-focused') {
      // Vendor cares about price - offer higher price, push for longer terms
      emphasisAdjustment = 0.10 * emphasisConfidence; // Up to +10% on price
      // Push for longer terms
      const currentTermsDays = vendorOffer.payment_terms
        ? extractPaymentDays(vendorOffer.payment_terms) ?? 30
        : 30;
      chosenTerms = generateFlexibleTerms(currentTermsDays, 'increase', 15);
      strategy = `Dynamic (price-focused vendor): Conceding ${(emphasisAdjustment * 100).toFixed(0)}% on price, pushing ${chosenTerms}`;
    } else if (vendorEmphasis === 'terms-focused') {
      // Vendor cares about terms - push harder on price, be flexible on terms
      emphasisAdjustment = -0.05 * emphasisConfidence; // Up to -5% on price (harder)
      // Accept or slightly improve vendor's terms
      chosenTerms = vendorOffer.payment_terms ?? bestTerms(config);
      strategy = `Dynamic (terms-focused vendor): Pushing ${(Math.abs(emphasisAdjustment) * 100).toFixed(0)}% harder on price, accepting ${chosenTerms}`;
    } else {
      // Balanced - use standard priority-based terms
      chosenTerms = priority === 'HIGH' ? bestTerms(config) : nextBetterTerms(config, vendorOffer.payment_terms);
      strategy = `Balanced: Standard priority-based counter`;
    }
  } else {
    // Unknown emphasis - use standard priority-based terms
    chosenTerms = priority === 'HIGH' ? bestTerms(config) : nextBetterTerms(config, vendorOffer.payment_terms);
    strategy = `Standard: ${priority} priority counter`;
  }

  // Calculate final counter price
  const totalOffset = baseAggressiveness + roundAdjustment + concessionBonus + emphasisAdjustment;
  let counterPrice = target + priceRange * totalOffset;

  // Never counter above vendor's offer
  if (vendorOffer.total_price !== null) {
    counterPrice = Math.min(counterPrice, vendorOffer.total_price);
  }

  // Never exceed max acceptable
  counterPrice = Math.min(counterPrice, max_acceptable);

  // Round to 2 decimal places
  counterPrice = Math.round(counterPrice * 100) / 100;

  console.log('[CalculateDynamicCounter]', {
    priority,
    baseAggressiveness,
    roundAdjustment,
    concessionBonus,
    emphasisAdjustment,
    totalOffset,
    counterPrice,
    chosenTerms,
    strategy,
    vendorEmphasis: negotiationState?.vendorEmphasis,
    emphasisConfidence: negotiationState?.emphasisConfidence,
  });

  return { price: counterPrice, terms: chosenTerms, strategy };
}

export function decideNextMove(
  config: NegotiationConfig,
  vendorOffer: Offer,
  round: number,
  negotiationState?: NegotiationState | null,
  previousPmOffer?: Offer | PmCounterRecord | null,
  behavioralSignals?: BehavioralSignals | null,
  adaptiveStrategy?: AdaptiveStrategyResult | null
): Decision {
  const reasons: string[] = [];
  const priority = config.priority || 'MEDIUM';

  // Get thresholds with defaults (70%, 50%, 30%)
  const acceptThreshold = config.accept_threshold ?? 0.70;
  const escalateThreshold = config.escalate_threshold ?? 0.50;
  const walkawayThreshold = config.walkaway_threshold ?? 0.30;

  // Debug logging for thresholds and offer
  console.log('[DecideNextMove] Config thresholds:', {
    priority,
    acceptThreshold,
    escalateThreshold,
    walkawayThreshold,
    maxRounds: config.max_rounds,
    adaptiveStrategy: adaptiveStrategy?.strategyLabel || 'none',
  });
  console.log('[DecideNextMove] Vendor offer:', {
    total_price: vendorOffer.total_price,
    payment_terms: vendorOffer.payment_terms,
    max_acceptable: config.parameters.total_price.max_acceptable,
    target: config.parameters.total_price.target,
  });

  // Dynamic round limits (Phase 3)
  const dynamicRounds = (config as NegotiationConfig & { dynamicRounds?: DynamicRoundConfig }).dynamicRounds;

  if (dynamicRounds?.autoExtendEnabled && behavioralSignals) {
    const softMax = dynamicRounds.softMaxRounds;
    const hardMax = dynamicRounds.hardMaxRounds;

    // Hard safety net - never exceeded
    if (round > hardMax) {
      return {
        action: 'ESCALATE',
        utilityScore: 0,
        counterOffer: null,
        reasons: [`Hard max rounds (${hardMax}) exceeded`],
      };
    }

    // Past soft max: check if we should auto-extend or escalate
    if (round > softMax) {
      if (behavioralSignals.isConverging && behavioralSignals.convergenceRate > 0.10) {
        // Auto-extend: offers are converging, gap decreasing >10%/round
        reasons.push(`Auto-extending: convergence rate ${(behavioralSignals.convergenceRate * 100).toFixed(0)}%/round`);
        // Continue to negotiation logic below (don't escalate)
      } else {
        return {
          action: 'ESCALATE',
          utilityScore: 0,
          counterOffer: null,
          reasons: [`Past soft max (${softMax}) rounds and not converging (rate: ${(behavioralSignals.convergenceRate * 100).toFixed(0)}%/round)`],
        };
      }
    }

    // Early escalation: before soft max but stalling
    if (round >= Math.ceil(softMax * 0.6) && behavioralSignals.isStalling) {
      if (adaptiveStrategy?.shouldEscalateEarly) {
        return {
          action: 'ESCALATE',
          utilityScore: 0,
          counterOffer: null,
          reasons: [`Stalling detected after ${round} rounds (early escalation triggered)`],
        };
      }
    }
  } else {
    // Backward compat: use original hard limit
    if (round > config.max_rounds) {
      return {
        action: 'ESCALATE',
        utilityScore: 0,
        counterOffer: null,
        reasons: [`Max rounds (${config.max_rounds}) exceeded`],
      };
    }
  }

  // Clarify if missing
  if (
    vendorOffer.total_price == null ||
    vendorOffer.payment_terms == null
  ) {
    return {
      action: 'ASK_CLARIFY',
      utilityScore: 0,
      counterOffer: null,
      reasons: ['Missing total_price or payment_terms in vendor offer.'],
    };
  }

  const max = config.parameters.total_price.max_acceptable;
  const minRoundsBeforeWalkaway = priority === 'HIGH' ? 3 : priority === 'MEDIUM' ? 2 : 1;

  // If price exceeds max acceptable
  if (vendorOffer.total_price > max) {
    // In early rounds, counter with max acceptable price instead of walking away
    // This gives vendors a chance to come down to an acceptable range
    if (round < minRoundsBeforeWalkaway) {
      const delivery = getDeliveryForCounter(vendorOffer, config);
      const dynamicCounter = calculateDynamicCounter(config, vendorOffer, round, negotiationState, previousPmOffer, adaptiveStrategy);
      const counter: Offer = {
        total_price: dynamicCounter.price,
        payment_terms: dynamicCounter.terms,
        delivery_date: delivery.delivery_date,
        delivery_days: delivery.delivery_days,
      };

      console.log('[DecideNextMove] Price exceeds max but protecting early rounds - countering', {
        vendorPrice: vendorOffer.total_price,
        maxAcceptable: max,
        counterPrice: dynamicCounter.price,
        counterTerms: dynamicCounter.terms,
        strategy: dynamicCounter.strategy,
        round,
        minRoundsBeforeWalkaway,
      });

      return {
        action: 'COUNTER',
        utilityScore: 0,
        counterOffer: counter,
        reasons: [`Price $${vendorOffer.total_price} exceeds our budget of $${max}. I can offer $${dynamicCounter.price.toFixed(2)} with ${dynamicCounter.terms} - can you work within this range?`],
      };
    }

    // After minimum rounds, walk away if price still exceeds max
    console.log('[DecideNextMove] WALK_AWAY: Price exceeds max acceptable after minimum rounds', {
      vendorPrice: vendorOffer.total_price,
      maxAcceptable: max,
      round,
      minRoundsBeforeWalkaway,
    });
    return {
      action: 'WALK_AWAY',
      utilityScore: 0,
      counterOffer: null,
      reasons: [`Price ${vendorOffer.total_price} > max acceptable ${max} after ${round} rounds of negotiation`],
    };
  }

  const u = totalUtility(config, vendorOffer);
  console.log('[DecideNextMove] Utility calculated:', {
    utility: u,
    walkawayThreshold,
    escalateThreshold,
    acceptThreshold,
    willWalkAway: u < walkawayThreshold,
    willEscalate: u < escalateThreshold && u >= walkawayThreshold,
    willAccept: u >= acceptThreshold,
  });

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

  // Walk Away Zone: utility < walkaway threshold
  // minRoundsBeforeWalkaway is already defined above (HIGH=3, MEDIUM=2, LOW=1)
  if (u < walkawayThreshold && round >= minRoundsBeforeWalkaway) {
    console.log('[DecideNextMove] Walking away after minimum rounds', {
      round,
      minRoundsBeforeWalkaway,
      utility: u,
      walkawayThreshold,
    });
    return {
      action: 'WALK_AWAY',
      utilityScore: u,
      counterOffer: null,
      reasons: [`Utility ${(u * 100).toFixed(0)}% < walkaway threshold ${(walkawayThreshold * 100).toFixed(0)}%`],
    };
  }

  // Early rounds protection: If utility is below threshold but we haven't hit minimum rounds, COUNTER instead
  // This gives the negotiation a chance to improve before walking away
  if (u < walkawayThreshold && round < minRoundsBeforeWalkaway) {
    const delivery = getDeliveryForCounter(vendorOffer, config);
    const dynamicCounter = calculateDynamicCounter(config, vendorOffer, round, negotiationState, previousPmOffer, adaptiveStrategy);
    const counter: Offer = {
      total_price: dynamicCounter.price,
      payment_terms: dynamicCounter.terms,
      delivery_date: delivery.delivery_date,
      delivery_days: delivery.delivery_days,
    };

    console.log('[DecideNextMove] Utility below threshold but protecting early rounds - countering instead', {
      round,
      minRoundsBeforeWalkaway,
      utility: u,
      walkawayThreshold,
      counterPrice: dynamicCounter.price,
      counterTerms: dynamicCounter.terms,
      strategy: dynamicCounter.strategy,
    });

    return {
      action: 'COUNTER',
      utilityScore: u,
      counterOffer: counter,
      reasons: [`Utility ${(u * 100).toFixed(0)}% below threshold, but round ${round}/${minRoundsBeforeWalkaway} - continuing negotiation at $${dynamicCounter.price.toFixed(2)} with ${dynamicCounter.terms}.`],
    };
  }

  // Escalate Zone: 30% <= utility < 50%
  // UPDATED Feb 2026: Added minimum rounds protection before escalating
  // For LOW priority (Quick Close), we may want to COUNTER instead of ESCALATE
  const minRoundsBeforeEscalate = priority === 'HIGH' ? 3 : priority === 'MEDIUM' ? 3 : 2;

  if (u < escalateThreshold) {
    const delivery = getDeliveryForCounter(vendorOffer, config);
    const dynamicCounter = calculateDynamicCounter(config, vendorOffer, round, negotiationState, previousPmOffer, adaptiveStrategy);

    const counter: Offer = {
      total_price: dynamicCounter.price,
      payment_terms: dynamicCounter.terms,
      delivery_date: delivery.delivery_date,
      delivery_days: delivery.delivery_days,
    };

    // For Quick Close (LOW priority), we continue negotiating instead of escalating
    // This allows faster deal closure with more flexibility
    if (priority === 'LOW') {
      return {
        action: 'COUNTER',
        utilityScore: u,
        counterOffer: counter,
        reasons: [`Quick Close strategy: Utility ${(u * 100).toFixed(0)}% - continuing negotiation at $${dynamicCounter.price.toFixed(2)} with ${dynamicCounter.terms} for faster resolution.`],
      };
    }

    // Early rounds protection: COUNTER instead of ESCALATE in first 2-3 rounds
    // This gives the negotiation a fair chance before involving human review
    if (round < minRoundsBeforeEscalate) {
      console.log('[DecideNextMove] Utility in escalate zone but protecting early rounds - countering instead', {
        round,
        minRoundsBeforeEscalate,
        utility: u,
        escalateThreshold,
        counterPrice: dynamicCounter.price,
        counterTerms: dynamicCounter.terms,
        strategy: dynamicCounter.strategy,
      });

      return {
        action: 'COUNTER',
        utilityScore: u,
        counterOffer: counter,
        reasons: [`Utility ${(u * 100).toFixed(0)}% in escalate zone, but round ${round}/${minRoundsBeforeEscalate} - continuing negotiation at $${dynamicCounter.price.toFixed(2)} with ${dynamicCounter.terms}.`],
      };
    }

    // After minimum rounds, escalate for human review
    console.log('[DecideNextMove] Escalating after minimum rounds', {
      round,
      minRoundsBeforeEscalate,
      utility: u,
      escalateThreshold,
    });

    return {
      action: 'ESCALATE',
      utilityScore: u,
      counterOffer: counter,
      reasons: [`Utility ${(u * 100).toFixed(0)}% in escalate zone (${(walkawayThreshold * 100).toFixed(0)}%-${(escalateThreshold * 100).toFixed(0)}%) after ${round} rounds. Proposing counter at $${dynamicCounter.price.toFixed(2)} with ${dynamicCounter.terms} but needs human review.`],
    };
  }

  // Counter Zone: 50% <= utility < 70%
  // Continue negotiating with counter-offers using dynamic strategy

  const delivery = getDeliveryForCounter(vendorOffer, config);
  const dynamicCounter = calculateDynamicCounter(config, vendorOffer, round, negotiationState, previousPmOffer, adaptiveStrategy);

  const counter: Offer = {
    total_price: dynamicCounter.price,
    payment_terms: dynamicCounter.terms,
    delivery_date: delivery.delivery_date,
    delivery_days: delivery.delivery_days,
  };

  reasons.push(`${dynamicCounter.strategy}: Counter at $${dynamicCounter.price.toFixed(2)} with ${dynamicCounter.terms}.`);

  return { action: 'COUNTER', utilityScore: u, counterOffer: counter, reasons };
}
