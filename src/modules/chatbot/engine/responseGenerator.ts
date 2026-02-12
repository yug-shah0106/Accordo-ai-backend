/**
 * Human-Like Response Generator Module
 *
 * Generates context-aware, human-like PM responses that:
 * - Always include delivery terms
 * - Adapt to vendor's tone
 * - Acknowledge vendor concerns
 * - Provide high variation (10+ styles per action)
 * - Use dynamic length based on complexity
 * - Hide internal utility calculations
 *
 * Uses LLM with fallback to enhanced templates.
 *
 * @module responseGenerator
 */

import logger from '../../../config/logger.js';
import { chatCompletion } from '../../../services/llm.service.js';
import { detectVendorTone, getToneDescription, type VendorTone, type ToneMessage } from './toneDetector.js';
import { extractVendorConcerns, getAcknowledgmentSentence, type VendorConcern, type ConcernMessage } from './concernExtractor.js';
import { formatDeliveryDate, formatDeliveryShort, type DeliveryConfig } from './deliveryUtility.js';
import type { Offer, Decision, AccumulatedOffer, OfferComponent } from './types.js';
import type { NegotiationConfig } from './utility.js';
import { getProvidedComponents, getMissingComponents } from './offerAccumulator.js';

/**
 * Input for response generation
 */
export interface ResponseGeneratorInput {
  decision: Decision;
  config: NegotiationConfig;
  conversationHistory: Array<{ role: string; content: string }>;
  vendorOffer: Offer;
  counterOffer: Offer | null;
  deliveryConfig?: DeliveryConfig;
  dealTitle?: string;
  round?: number;
  maxRounds?: number;
  /** Current partial extraction from vendor's latest message (for ASK_CLARIFY) */
  currentExtraction?: Offer;
  /** Accumulated offer state (for ASK_CLARIFY acknowledgment) */
  accumulatedOffer?: AccumulatedOffer;
}

/**
 * Result from response generation
 */
export interface ResponseGeneratorResult {
  response: string;
  source: 'llm' | 'fallback';
  tone: VendorTone;
  concerns: VendorConcern[];
  generationTimeMs: number;
}

/**
 * Format delivery from offer for display
 */
function formatDeliveryFromOffer(offer: Offer | null | undefined): string {
  if (!offer) return 'as agreed';

  // Check for delivery_date or delivery_days in the offer
  const extendedOffer = offer as any;

  if (extendedOffer.delivery_date) {
    const date = new Date(extendedOffer.delivery_date);
    return formatDeliveryShort(date);
  }

  if (extendedOffer.delivery_days) {
    return `within ${extendedOffer.delivery_days} days`;
  }

  return 'as agreed';
}

/**
 * Format delivery config for display
 */
function formatDeliveryFromConfig(config?: DeliveryConfig): string {
  if (!config) return 'per agreement';

  if (config.requiredDate) {
    const date = typeof config.requiredDate === 'string'
      ? new Date(config.requiredDate)
      : config.requiredDate;
    return `by ${formatDeliveryShort(date)}`;
  }

  return 'per agreement';
}

/**
 * Build natural ASK_CLARIFY LLM prompt that acknowledges what was provided
 * and asks naturally for what's missing
 */
function buildAskClarifyPrompt(input: ResponseGeneratorInput, tone: VendorTone): string {
  const { vendorOffer, currentExtraction, accumulatedOffer } = input;
  const toneDescription = getToneDescription(tone);

  // Determine what was provided in current message vs what's missing
  const currentProvided = currentExtraction ? getProvidedComponents(currentExtraction) : [];
  const missing = getMissingComponents(accumulatedOffer || vendorOffer);

  // Build context about what we have and what we need
  const providedText = currentProvided.length > 0
    ? `Vendor just provided: ${currentProvided.join(', ')}`
    : 'Vendor message did not include specific offer details';

  const missingText = missing.length > 0
    ? `Still need: ${missing.join(' and ')}`
    : 'All required information received';

  // Format accumulated state
  const accumulatedText = accumulatedOffer
    ? `Current accumulated offer: ${accumulatedOffer.total_price ? `$${accumulatedOffer.total_price.toLocaleString()}` : 'no price'}, ${accumulatedOffer.payment_terms || 'no terms'}`
    : '';

  return `
You are Accordo, a Procurement Manager. Generate a natural ${toneDescription} response that acknowledges what the vendor provided and asks for what's missing.

CURRENT MESSAGE CONTEXT:
${providedText}
${accumulatedText}
${missingText}

TONE: ${tone} (conversational, not robotic)

REQUIREMENTS:
1. FIRST acknowledge what the vendor just provided (if anything)
   - For price: "Got it - $37K" or "Thanks for the pricing at $37,000" or "$37K - noted"
   - For terms: "Net 60 works" or "Thanks for confirming Net 60"
2. THEN naturally ask for the missing piece(s)
   - For missing price: "What about the total price?" or "And the pricing?"
   - For missing terms: "What about payment terms?" or "How about terms - Net 30, 60, or something else?"
3. Keep it SHORT - 1-2 sentences max
4. Sound natural and human, like a real conversation
5. DO NOT say "I need clarification" or "Could you please provide" - too formal
6. DO NOT mention: utility, algorithm, system, analysis

EXAMPLE RESPONSES:
- "Got it - $37K. What about payment terms?"
- "Net 60 works for us. And the total price?"
- "Thanks for that. Can you confirm both the price and payment terms?"
- "$37,000 noted. How about terms - Net 30, 60?"

Generate response:`;
}

/**
 * Build LLM prompt for response generation
 */
function buildPrompt(
  input: ResponseGeneratorInput,
  tone: VendorTone,
  concerns: VendorConcern[]
): string {
  const { decision, vendorOffer, counterOffer, deliveryConfig, round, maxRounds } = input;
  const { action } = decision;

  const toneDescription = getToneDescription(tone);
  const concernsText = concerns.length > 0
    ? `Vendor concerns to acknowledge: ${concerns.map(c => c.text).join(', ')}`
    : 'No specific concerns mentioned';

  const vendorDelivery = formatDeliveryFromOffer(vendorOffer);
  const counterDelivery = counterOffer
    ? formatDeliveryFromOffer(counterOffer)
    : formatDeliveryFromConfig(deliveryConfig);

  // Build base prompt based on action
  const actionPrompts: Record<string, string> = {
    ACCEPT: `
You are Accordo, a Procurement Manager. Generate a ${toneDescription} acceptance response.

VENDOR'S OFFER:
- Total Price: $${vendorOffer.total_price?.toFixed(2) || 'not specified'} (for entire order)
- Payment: ${vendorOffer.payment_terms || 'not specified'}
- Delivery: ${vendorDelivery}

${concernsText}

TONE: ${tone} (mirror the vendor's communication style)

REQUIREMENTS:
1. Confirm ALL THREE terms: total price, payment, delivery
2. Express genuine appreciation
3. ${concerns.length > 0 ? 'Briefly acknowledge their efforts/challenges positively' : 'Thank them for the negotiation'}
4. Keep to 2-3 sentences
5. DO NOT mention: utility, algorithm, score, threshold, calculation, analysis
6. Sound human and warm, not robotic
7. IMPORTANT: Always refer to the price as "total" or "total price" - NOT per unit

Generate response:`,

    COUNTER: `
You are Accordo, a Procurement Manager. Generate a ${toneDescription} counter-offer response.

VENDOR'S OFFER:
- Total Price: $${vendorOffer.total_price?.toFixed(2) || 'not specified'} (for entire order)
- Payment: ${vendorOffer.payment_terms || 'not specified'}
- Delivery: ${vendorDelivery}

OUR COUNTER:
- Total Price: $${counterOffer?.total_price?.toFixed(2) || 'flexible'} (for entire order)
- Payment: ${counterOffer?.payment_terms || 'flexible'}
- Delivery: ${counterDelivery}

${concernsText}

BUSINESS REASONING (pick one naturally, don't reveal numbers):
- "This aligns better with our budget constraints"
- "We need to balance quality with cost-effectiveness"
- "Extended payment terms help our cash flow planning"
- "Our project timeline requires this delivery schedule"

TONE: ${tone} (match their formality level)
ROUND: ${round || 1} of ${maxRounds || 6}

REQUIREMENTS:
1. ${concerns.length > 0 ? `First acknowledge briefly: something about ${concerns[0].text}` : 'Acknowledge their offer respectfully'}
2. Present ALL THREE counter terms clearly
3. Provide brief business reasoning (not calculations)
4. Keep door open for negotiation
5. Length: 2-4 sentences
6. DO NOT mention: utility, algorithm, score, threshold, calculation, percentage, analysis
7. Sound collaborative, not demanding
8. IMPORTANT: Always refer to the price as "total" or "total price" - NOT per unit

Generate response:`,

    WALK_AWAY: `
You are Accordo, a Procurement Manager. Generate a professional, regretful response declining to continue.

FINAL SITUATION:
- Vendor's offer: $${vendorOffer.total_price?.toFixed(2) || 'N/A'}, ${vendorOffer.payment_terms || 'N/A'}, ${vendorDelivery}
- Round: ${round || 'final'} of ${maxRounds || 6}
- Gap: Too far from our requirements

TONE: Professional regret (regardless of vendor's tone)

REQUIREMENTS:
1. Express genuine appreciation for their time and effort
2. Be clear but kind that we cannot proceed
3. Brief reason: "budget constraints" or "timeline requirements" (not specific numbers)
4. Leave door open for future opportunities
5. 2-3 sentences maximum
6. DO NOT blame or criticize their offer
7. DO NOT mention: utility, algorithm, score, threshold, calculation, analysis

Generate response:`,

    ESCALATE: `
You are Accordo, a Procurement Manager. The negotiation needs human review.

SITUATION: Complex situation requiring human decision-maker involvement

TONE: Reassuring and professional

REQUIREMENTS:
1. Reassure vendor their offer is being seriously considered
2. Explain a colleague will review (don't say "escalate" or "algorithm")
3. Maintain positive tone about potential partnership
4. 2-3 sentences

Generate response:`,

    ASK_CLARIFY: buildAskClarifyPrompt(input, tone)
  };

  return actionPrompts[action] || actionPrompts.COUNTER;
}

/**
 * Validate LLM response quality
 */
function validateResponse(response: string, action: string): boolean {
  if (!response || response.length < 20) return false;
  if (response.length > 500) return false;

  // Check for forbidden phrases
  const forbidden = [
    /utility\s*score/i,
    /algorithm/i,
    /threshold/i,
    /calculation/i,
    /\d+%\s*utility/i,
    /based on our analysis/i,
    /our system/i,
    /automated/i,
  ];

  for (const pattern of forbidden) {
    if (pattern.test(response)) {
      logger.warn('[ResponseGenerator] LLM response contains forbidden phrase', { pattern: pattern.source });
      return false;
    }
  }

  // For ACCEPT/COUNTER, check for delivery mention
  if (action === 'ACCEPT' || action === 'COUNTER') {
    const hasDelivery = /deliver|by\s+\w+\s+\d+|within\s+\d+|ship|timeline|schedule/i.test(response);
    if (!hasDelivery) {
      logger.warn('[ResponseGenerator] LLM response missing delivery terms');
      // Don't fail, we'll add delivery in post-processing if needed
    }
  }

  return true;
}

/**
 * Generate LLM response with timeout
 */
async function generateLLMResponse(prompt: string, timeoutMs: number = 4000): Promise<string | null> {
  const startTime = Date.now();

  try {
    const response = await Promise.race([
      chatCompletion([
        { role: 'system', content: 'You are Accordo, a professional Procurement Manager. Generate natural, human-like negotiation responses. Never mention algorithms, scores, or calculations.' },
        { role: 'user', content: prompt }
      ]),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
      )
    ]);

    const elapsed = Date.now() - startTime;
    logger.info('[ResponseGenerator] LLM response generated', { elapsedMs: elapsed });

    return response || null;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.warn('[ResponseGenerator] LLM generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      elapsedMs: elapsed
    });
    return null;
  }
}

/**
 * Enhanced fallback templates with delivery
 */
const FALLBACK_TEMPLATES = {
  ACCEPT: (input: ResponseGeneratorInput, tone: VendorTone, concerns: VendorConcern[]): string => {
    const { vendorOffer, deliveryConfig } = input;
    const delivery = formatDeliveryFromOffer(vendorOffer) || formatDeliveryFromConfig(deliveryConfig);
    const concernAck = concerns.length > 0 ? getAcknowledgmentSentence(concerns) : '';

    const templates = [
      `Great news! We accept your offer of $${vendorOffer.total_price?.toFixed(2)} total with ${vendorOffer.payment_terms} and delivery ${delivery}. ${concernAck || 'Thank you for working with us!'}`,
      `Excellent! We have a deal - $${vendorOffer.total_price?.toFixed(2)} total, ${vendorOffer.payment_terms}, delivered ${delivery}. ${concernAck || 'Looking forward to a great partnership.'}`,
      `I'm pleased to confirm we accept: $${vendorOffer.total_price?.toFixed(2)} total, ${vendorOffer.payment_terms}, delivery ${delivery}. ${concernAck || 'Appreciate your flexibility!'}`,
      `We're happy to accept your terms: $${vendorOffer.total_price?.toFixed(2)} total with ${vendorOffer.payment_terms} payment and ${delivery} delivery. ${concernAck || "Let's finalize the paperwork."}`,
      `Deal! $${vendorOffer.total_price?.toFixed(2)} total, ${vendorOffer.payment_terms}, ${delivery}. ${concernAck || 'Thank you for the productive negotiation.'}`,
    ];

    // Adjust formality based on tone
    const formalTemplates = [
      `We are pleased to formally accept your offer of $${vendorOffer.total_price?.toFixed(2)} total with ${vendorOffer.payment_terms} payment terms and delivery ${delivery}. ${concernAck || 'We appreciate your professionalism throughout this negotiation.'}`,
    ];

    if (tone === 'formal') {
      return formalTemplates[Math.floor(Math.random() * formalTemplates.length)];
    }

    return templates[Math.floor(Math.random() * templates.length)];
  },

  COUNTER: (input: ResponseGeneratorInput, tone: VendorTone, concerns: VendorConcern[]): string => {
    const { vendorOffer, counterOffer, deliveryConfig } = input;
    const counterDelivery = formatDeliveryFromOffer(counterOffer) || formatDeliveryFromConfig(deliveryConfig);
    const concernAck = concerns.length > 0 ? getAcknowledgmentSentence(concerns) + ' ' : '';

    const templates = [
      `${concernAck}Thank you for your offer. We'd like to propose $${counterOffer?.total_price?.toFixed(2)} total with ${counterOffer?.payment_terms} and delivery ${counterDelivery}. This better aligns with our project requirements.`,
      `${concernAck}I appreciate the offer of $${vendorOffer.total_price?.toFixed(2)}. Our counter: $${counterOffer?.total_price?.toFixed(2)} total, ${counterOffer?.payment_terms}, delivery ${counterDelivery}. Can we meet in the middle?`,
      `${concernAck}Your proposal is noted. Given our constraints, we can offer $${counterOffer?.total_price?.toFixed(2)} total, ${counterOffer?.payment_terms}, with delivery ${counterDelivery}. Let me know your thoughts.`,
      `${concernAck}Thanks for the offer. We're looking at $${counterOffer?.total_price?.toFixed(2)} total with ${counterOffer?.payment_terms} payment and ${counterDelivery} delivery. Does this work for you?`,
      `${concernAck}I've reviewed your offer. We can do $${counterOffer?.total_price?.toFixed(2)} total, ${counterOffer?.payment_terms}, delivered ${counterDelivery}. This helps us stay within budget.`,
    ];

    const formalTemplates = [
      `${concernAck}Thank you for your proposal. We would like to respectfully counter with $${counterOffer?.total_price?.toFixed(2)} total, ${counterOffer?.payment_terms} payment terms, and delivery ${counterDelivery}. We believe this arrangement would be mutually beneficial.`,
    ];

    if (tone === 'formal') {
      return formalTemplates[Math.floor(Math.random() * formalTemplates.length)];
    }

    return templates[Math.floor(Math.random() * templates.length)];
  },

  WALK_AWAY: (input: ResponseGeneratorInput, tone: VendorTone, concerns: VendorConcern[]): string => {
    const templates = [
      `I appreciate your time and effort in this negotiation. Unfortunately, we're unable to proceed with the current terms. I hope we can work together on future opportunities.`,
      `Thank you for the discussions. Regrettably, the offer doesn't align with our current requirements. We'd welcome the chance to reconnect on future projects.`,
      `We've valued this negotiation, but can't move forward with these terms. Thank you for your understanding, and we hope to collaborate in the future.`,
      `I want to thank you for your patience throughout this process. Unfortunately, we're not able to reach an agreement this time. Best of luck, and I hope our paths cross again.`,
      `While I appreciate your offer, we're unable to proceed given our current constraints. Thank you for your professionalism, and I hope we can explore opportunities down the road.`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  },

  ESCALATE: (): string => {
    const templates = [
      `This requires some additional review from our team. A colleague will follow up with you shortly to continue the discussion.`,
      `I'd like to bring in a colleague to review this further. Someone will be in touch soon to continue our conversation.`,
      `Let me involve a team member to give this the attention it deserves. You'll hear from us shortly.`,
      `Your offer is being carefully considered. I'm bringing in a senior colleague to ensure we give this the proper attention. We'll be in touch soon.`,
      `I want to make sure we handle this properly. Let me loop in someone from our team who can help move this forward. You'll hear back shortly.`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  },

  ASK_CLARIFY: (input: ResponseGeneratorInput): string => {
    const { vendorOffer, currentExtraction, accumulatedOffer } = input;

    // Get what was provided and what's missing
    const currentProvided = currentExtraction ? getProvidedComponents(currentExtraction) : [];
    const missing = getMissingComponents(accumulatedOffer || vendorOffer);

    // Build acknowledgment based on what was provided
    let acknowledgment = '';
    if (currentProvided.length > 0) {
      const priceAcks = ['Got it', 'Thanks for that', 'Noted', 'Perfect'];
      acknowledgment = `${priceAcks[Math.floor(Math.random() * priceAcks.length)]} - ${currentProvided.join(' and ')}. `;
    }

    // Build request for missing items
    const missingRequests: Record<string, string[]> = {
      'price': [
        'What about the total price?',
        'And the pricing?',
        'Can you share the price?',
      ],
      'payment terms': [
        'What about payment terms?',
        'How about terms - Net 30, 60?',
        'And the payment terms?',
      ],
      'price and payment terms': [
        'Can you confirm both price and payment terms?',
        'What are you thinking for price and terms?',
      ],
    };

    const missingKey = missing.length === 2 ? 'price and payment terms' : missing[0] || 'price';
    const requests = missingRequests[missingKey] || missingRequests['price'];
    const request = requests[Math.floor(Math.random() * requests.length)];

    return `${acknowledgment}${request}`;
  }
};

/**
 * Generate enhanced fallback response
 */
function generateFallback(
  input: ResponseGeneratorInput,
  tone: VendorTone,
  concerns: VendorConcern[]
): string {
  const { action } = input.decision;

  const generator = FALLBACK_TEMPLATES[action as keyof typeof FALLBACK_TEMPLATES];
  if (generator) {
    return generator(input, tone, concerns);
  }

  // Default fallback
  return `Thank you for your message. I've noted your offer and will respond shortly.`;
}

/**
 * Generate a human-like PM response
 *
 * @param input - Response generation input
 * @returns Response with metadata
 *
 * @example
 * ```typescript
 * const result = await generateHumanLikeResponse({
 *   decision: { action: 'COUNTER', utilityScore: 0.65, ... },
 *   config: negotiationConfig,
 *   conversationHistory: messages,
 *   vendorOffer: { total_price: 98, payment_terms: 'Net 30' },
 *   counterOffer: { total_price: 94, payment_terms: 'Net 60' },
 *   deliveryConfig: { requiredDate: '2026-03-15' }
 * });
 * // result.response = "I understand the supply chain challenges..."
 * ```
 */
export async function generateHumanLikeResponse(
  input: ResponseGeneratorInput
): Promise<ResponseGeneratorResult> {
  const startTime = Date.now();

  // Detect vendor tone
  const toneMessages: ToneMessage[] = input.conversationHistory.map(m => ({
    role: m.role as 'VENDOR' | 'ACCORDO' | 'SYSTEM',
    content: m.content
  }));
  const toneResult = detectVendorTone(toneMessages);
  const tone = toneResult.primaryTone;

  // Extract concerns
  const concernMessages: ConcernMessage[] = input.conversationHistory.map(m => ({
    role: m.role as 'VENDOR' | 'ACCORDO' | 'SYSTEM',
    content: m.content
  }));
  const concerns = extractVendorConcerns(concernMessages);

  logger.info('[ResponseGenerator] Starting generation', {
    action: input.decision.action,
    tone,
    concernCount: concerns.length,
    round: input.round
  });

  // Try LLM first
  const prompt = buildPrompt(input, tone, concerns);
  const llmResponse = await generateLLMResponse(prompt);

  if (llmResponse && validateResponse(llmResponse, input.decision.action)) {
    const elapsed = Date.now() - startTime;
    return {
      response: llmResponse.trim(),
      source: 'llm',
      tone,
      concerns,
      generationTimeMs: elapsed
    };
  }

  // Fallback to enhanced templates
  logger.info('[ResponseGenerator] Using fallback templates');
  const fallbackResponse = generateFallback(input, tone, concerns);
  const elapsed = Date.now() - startTime;

  return {
    response: fallbackResponse,
    source: 'fallback',
    tone,
    concerns,
    generationTimeMs: elapsed
  };
}

/**
 * Generate a quick fallback response (for timeout scenarios)
 * This is synchronous and always returns immediately
 */
export function generateQuickFallback(input: ResponseGeneratorInput): string {
  // Use neutral tone and no concern acknowledgment for speed
  return generateFallback(input, 'friendly', []);
}

export default {
  generateHumanLikeResponse,
  generateQuickFallback
};
