import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../utils/custom-error.js';
import logger from '../../config/logger.js';
import models from '../../models/index.js';
import env from '../../config/env.js';
import sequelize from '../../config/database.js';
import { sendPMQuoteNotificationEmail } from '../../services/email.service.js';
import {
  buildConfigFromRequisition,
  saveVendorMessageOnlyService,
  generatePMResponseAsyncService,
  syncContractStatus,
} from '../chatbot/chatbot.service.js';
import type { Contract } from '../../models/contract.js';
import type { ChatbotDeal } from '../../models/chatbotDeal.js';
import type { ChatbotMessage } from '../../models/chatbotMessage.js';

/**
 * Vendor Chat Service
 * Business logic for public vendor chat endpoints (no auth required)
 * All operations authenticated via uniqueToken
 */

export interface ContractDetails {
  products: Array<{
    productId: number;
    productName: string;
    quantity: number;
    quotedPrice: number | string;
    deliveryDate?: string;
  }>;
  additionalTerms?: {
    paymentTerms?: string;
    netPaymentDay?: number | string;
    prePaymentPercentage?: number | string;
    postPaymentPercentage?: number | string;
    additionalNotes?: string;
  };
}

export interface SubmitQuoteResult {
  contract: Contract;
  deal: ChatbotDeal | null;
  canEdit: boolean;
  chatUrl: string;
}

export interface CanEditQuoteResult {
  canEdit: boolean;
  reason: string;
}

export interface VendorDealData {
  deal: ChatbotDeal;
  messages: ChatbotMessage[];
  contract: Contract;
  requisition: {
    id: number;
    title: string;
    rfqNumber: string | null;
    products: Array<{
      id: number;
      name: string;
      quantity: number;
      unit: string | null;
    }>;
  };
  vendorQuote: ContractDetails | null;
  isVendor: true;
}

/**
 * Find contract by unique token with all necessary associations
 */
const findContractByToken = async (uniqueToken: string): Promise<Contract | null> => {
  return models.Contract.findOne({
    where: { uniqueToken },
    include: [
      {
        model: models.Requisition,
        as: 'Requisition',
        include: [
          {
            model: models.RequisitionProduct,
            as: 'RequisitionProduct',
            include: [
              {
                model: models.Product,
                as: 'Product',
              },
            ],
          },
          {
            model: models.Project,
            as: 'Project',
          },
        ],
      },
      {
        model: models.User,
        as: 'Vendor',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: models.Company,
        as: 'Company',
        attributes: ['id', 'companyName'],
      },
    ],
  });
};

/**
 * Submit vendor quote - updates contract and notifies PM
 */
export const submitVendorQuote = async (
  uniqueToken: string,
  contractDetails: ContractDetails
): Promise<SubmitQuoteResult> => {
  const transaction = await sequelize.transaction();

  try {
    // Find contract by token
    const contract = await findContractByToken(uniqueToken);
    if (!contract) {
      throw new CustomError('Contract not found', 404);
    }

    // Validate contract status allows quote submission
    // Allow 'Active' status if vendor hasn't submitted a quote yet (deal was created before vendor filled form)
    const allowedStatuses = ['Created', 'Opened', 'Active'];
    if (!allowedStatuses.includes(contract.status)) {
      throw new CustomError('Quote has already been submitted for this contract', 400);
    }
    if (contract.status === 'Active' && contract.contractDetails) {
      throw new CustomError('Quote has already been submitted for this contract', 400);
    }

    // Update contract with quote
    await contract.update(
      {
        contractDetails: JSON.stringify(contractDetails),
        status: 'InitialQuotation',
      },
      { transaction }
    );

    // Update requisition status if present
    if (contract.Requisition) {
      await contract.Requisition.update(
        { status: 'InitialQuotation' },
        { transaction }
      );
    }

    // Find or create the chatbot deal
    let deal: ChatbotDeal | null = null;
    if (contract.chatbotDealId) {
      deal = await models.ChatbotDeal.findByPk(contract.chatbotDealId, { transaction });
    }

    // Create chatbot deal if it doesn't exist
    if (!deal) {
      const vendorName = (contract as any).Vendor?.name || 'Vendor';
      const requisitionTitle = (contract.Requisition as any)?.title || 'Requisition';

      // Build negotiation config from requisition (target prices, thresholds, etc.)
      let negotiationConfig = null;
      if (contract.requisitionId) {
        try {
          negotiationConfig = await buildConfigFromRequisition(contract.requisitionId);
          logger.info(`Built negotiation config from requisition ${contract.requisitionId} for vendor quote deal`);
        } catch (configError) {
          logger.warn(`Failed to build config from requisition: ${(configError as Error).message}`);
        }
      }

      deal = await models.ChatbotDeal.create(
        {
          id: uuidv4(),
          title: `${vendorName} - ${requisitionTitle}`,
          status: 'NEGOTIATING',
          mode: 'INSIGHTS',
          round: 0,
          requisitionId: contract.requisitionId,
          vendorId: contract.vendorId,
          contractId: contract.id,
          negotiationConfigJson: negotiationConfig,
          latestOfferJson: null,
          latestDecisionAction: null,
          latestUtility: null,
        },
        { transaction }
      );

      // Link the deal to the contract
      await contract.update(
        { chatbotDealId: deal.id },
        { transaction }
      );
    }

    await transaction.commit();

    // Reload contract to get updated data
    await contract.reload();

    // Send PM notification email (async, don't block response)
    sendPMQuoteNotificationEmail(contract, contractDetails).catch((err) => {
      logger.error('Failed to send PM quote notification email', { error: err.message });
    });

    const chatUrl = `/vendor-chat/${uniqueToken}`;

    return {
      contract,
      deal,
      canEdit: true, // Can edit until first chat message
      chatUrl,
    };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to submit quote: ${(error as Error).message}`, 500);
  }
};

/**
 * Check if quote can be edited (no messages yet)
 */
export const canEditQuote = async (uniqueToken: string): Promise<CanEditQuoteResult> => {
  const contract = await findContractByToken(uniqueToken);
  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  // Check if chatbot deal exists and has messages
  if (contract.chatbotDealId) {
    const messageCount = await models.ChatbotMessage.count({
      where: { dealId: contract.chatbotDealId },
    });

    if (messageCount > 0) {
      return {
        canEdit: false,
        reason: 'Negotiation has started - quote cannot be modified',
      };
    }
  }

  // Check contract status
  // Allow editing only for: Created, Opened, InitialQuotation
  // Block editing for: Active (negotiating), Escalated, Accepted, Rejected, Completed, Verified, Expired
  const editableStatuses = ['Created', 'Opened', 'InitialQuotation'];
  if (!editableStatuses.includes(contract.status)) {
    return {
      canEdit: false,
      reason: 'Contract status does not allow quote editing',
    };
  }

  return {
    canEdit: true,
    reason: 'Quote can be edited',
  };
};

/**
 * Edit quote (only if no messages yet)
 */
export const editVendorQuote = async (
  uniqueToken: string,
  contractDetails: ContractDetails
): Promise<Contract> => {
  const canEditResult = await canEditQuote(uniqueToken);
  if (!canEditResult.canEdit) {
    throw new CustomError(canEditResult.reason, 400);
  }

  const contract = await findContractByToken(uniqueToken);
  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  await contract.update({
    contractDetails: JSON.stringify(contractDetails),
  });

  await contract.reload();
  return contract;
};

/**
 * Get deal data for vendor - STRIPS PM TARGETS
 */
export const getDealForVendor = async (uniqueToken: string): Promise<VendorDealData> => {
  const contract = await findContractByToken(uniqueToken);
  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  if (!contract.chatbotDealId) {
    throw new CustomError('No negotiation deal found for this contract', 404);
  }

  const deal = await models.ChatbotDeal.findByPk(contract.chatbotDealId);
  if (!deal) {
    throw new CustomError('Deal not found', 404);
  }

  const messages = await models.ChatbotMessage.findAll({
    where: { dealId: deal.id },
    order: [['createdAt', 'ASC']],
  });

  // Build requisition data WITHOUT PM targets (hidden from vendors)
  const requisitionProducts = contract.Requisition?.RequisitionProduct || [];
  const requisition = {
    id: contract.Requisition?.id || 0,
    title: (contract.Requisition as any)?.title || 'Untitled',
    rfqNumber: (contract.Requisition as any)?.rfqNumber || null,
    products: requisitionProducts.map((rp: any) => ({
      id: rp.Product?.id || rp.productId,
      name: rp.Product?.productName || 'Unknown',
      quantity: rp.qty || 0,
      unit: rp.Product?.UOM || null,
      // NO targetPrice, NO batna, NO maximum_price - hidden from vendors
    })),
  };

  // Parse vendor quote from contract
  let vendorQuote: ContractDetails | null = null;
  if (contract.contractDetails) {
    try {
      vendorQuote = typeof contract.contractDetails === 'string'
        ? JSON.parse(contract.contractDetails)
        : contract.contractDetails;
    } catch {
      vendorQuote = null;
    }
  }

  // Sanitize messages - remove PM-specific data from explainability
  const sanitizedMessages = messages.map((msg) => {
    const msgJson = msg.toJSON() as any;
    // Remove PM thresholds and targets from explainability
    if (msgJson.explainabilityJson) {
      const explainability = msgJson.explainabilityJson as any;
      delete explainability.config;
      delete explainability.thresholds;
      if (explainability.utilities) {
        // Remove target values from utilities
        Object.keys(explainability.utilities).forEach((key) => {
          if (explainability.utilities[key]) {
            delete explainability.utilities[key].target;
            delete explainability.utilities[key].max_acceptable;
            delete explainability.utilities[key].anchor;
          }
        });
      }
    }
    return msgJson as ChatbotMessage;
  });

  return {
    deal,
    messages: sanitizedMessages,
    contract,
    requisition,
    vendorQuote,
    isVendor: true,
  };
};

/**
 * Vendor enters chat - creates opening message from quote if needed
 */
export const vendorEnterChat = async (uniqueToken: string): Promise<{
  deal: ChatbotDeal;
  openingMessage: ChatbotMessage | null;
}> => {
  const contract = await findContractByToken(uniqueToken);
  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  let deal: ChatbotDeal | null = null;

  // If deal doesn't exist, create it (fallback for contracts created before deal auto-creation)
  if (!contract.chatbotDealId) {
    const vendorName = (contract as any).Vendor?.name || 'Vendor';
    const requisitionTitle = (contract.Requisition as any)?.title || 'Requisition';

    // Build negotiation config from requisition (target prices, thresholds, etc.)
    let negotiationConfig = null;
    if (contract.requisitionId) {
      try {
        negotiationConfig = await buildConfigFromRequisition(contract.requisitionId);
        logger.info(`Built negotiation config from requisition ${contract.requisitionId} for vendor enter chat`);
      } catch (configError) {
        logger.warn(`Failed to build config from requisition: ${(configError as Error).message}`);
      }
    }

    deal = await models.ChatbotDeal.create({
      id: uuidv4(),
      title: `${vendorName} - ${requisitionTitle}`,
      status: 'NEGOTIATING',
      mode: 'INSIGHTS',
      round: 0,
      requisitionId: contract.requisitionId,
      vendorId: contract.vendorId,
      contractId: contract.id,
      negotiationConfigJson: negotiationConfig,
      latestOfferJson: null,
      latestDecisionAction: null,
      latestUtility: null,
    });

    // Link the deal to the contract
    await contract.update({ chatbotDealId: deal.id });
  } else {
    deal = await models.ChatbotDeal.findByPk(contract.chatbotDealId);
  }

  if (!deal) {
    throw new CustomError('Failed to create negotiation deal', 500);
  }

  // Check if opening message already exists
  const existingMessages = await models.ChatbotMessage.count({
    where: { dealId: deal.id },
  });

  if (existingMessages > 0) {
    // Already has messages, just return deal
    return { deal, openingMessage: null };
  }

  // Create opening message from vendor quote
  let vendorQuote: ContractDetails | null = null;
  if (contract.contractDetails) {
    try {
      vendorQuote = typeof contract.contractDetails === 'string'
        ? JSON.parse(contract.contractDetails)
        : contract.contractDetails;
    } catch {
      vendorQuote = null;
    }
  }

  if (!vendorQuote) {
    throw new CustomError('No quote found - please submit a quote first', 400);
  }

  // Build opening message content from quote
  let grandTotal = 0;
  const productLines = vendorQuote.products.map((p) => {
    const unitPrice = typeof p.quotedPrice === 'number' ? p.quotedPrice : parseFloat(p.quotedPrice as string) || 0;
    const quantity = p.quantity || 0;
    const totalPrice = unitPrice * quantity;
    grandTotal += totalPrice;
    return `- ${p.productName}: $${totalPrice.toFixed(2)} (${quantity} units)`;
  }).join('\n');

  const terms = vendorQuote.additionalTerms;
  let termsText = '';
  if (terms?.paymentTerms) {
    termsText += `\nPayment Terms: ${terms.paymentTerms === 'net_payment' ? `Net ${terms.netPaymentDay || 30} days` : 'Advance/Post payment'}`;
  }

  const openingContent = `Hello, I'm submitting my quotation for this requisition:\n\n${productLines}\n\nTotal: $${grandTotal.toFixed(2)}${termsText}\n\nI look forward to discussing the details.`;

  // Build payment terms string for extracted offer
  const paymentTermsStr = terms?.paymentTerms === 'net_payment'
    ? `Net ${terms?.netPaymentDay || 30}`
    : null;
  const paymentDays = terms?.paymentTerms === 'net_payment'
    ? Number(terms?.netPaymentDay || 30)
    : null;

  // Create the opening message with total_price (the format the decision engine expects)
  const openingMessage = await models.ChatbotMessage.create({
    id: uuidv4(),
    dealId: deal.id,
    role: 'VENDOR',
    content: openingContent,
    extractedOffer: {
      total_price: grandTotal,  // Use total price, not unit price
      payment_terms: paymentTermsStr,
      payment_terms_days: paymentDays,
    },
    counterOffer: null,
    engineDecision: null,
    decisionAction: null,
    utilityScore: null,
    explainabilityJson: null,
    round: 1,
  });

  // Update deal round
  await deal.update({ round: 1 });

  // Auto-generate PM response for opening message (async, fire-and-forget)
  // This ensures the vendor sees a PM response immediately after entering chat
  logger.info(`[VendorEnterChat] Auto-triggering PM response for opening message ${openingMessage.id}`);
  generatePMResponseInternal(deal.id, openingMessage.id, uniqueToken).catch((err) => {
    logger.error(`[VendorEnterChat] Failed to auto-generate PM response: ${(err as Error).message}`);
  });

  return { deal, openingMessage };
};

/**
 * Internal helper to generate PM response (used by auto-trigger)
 */
const generatePMResponseInternal = async (
  dealId: string,
  vendorMessageId: string,
  _uniqueToken: string
): Promise<void> => {
  try {
    const result = await generatePMResponseAsyncService({
      dealId,
      vendorMessageId,
      userId: 0, // Vendor context
    });

    logger.info(`[VendorEnterChat] Auto PM response generated: ${result.decision.action} (utility: ${result.decision.utilityScore})`);
  } catch (error) {
    logger.error(`[VendorEnterChat] Auto PM response failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Vendor sends a message - Phase 1: Instant save
 */
export const vendorSendMessageInstant = async (
  uniqueToken: string,
  content: string
): Promise<{ vendorMessage: ChatbotMessage; deal: ChatbotDeal }> => {
  const contract = await findContractByToken(uniqueToken);
  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  if (!contract.chatbotDealId) {
    throw new CustomError('No negotiation deal found for this contract', 404);
  }

  const deal = await models.ChatbotDeal.findByPk(contract.chatbotDealId);
  if (!deal) {
    throw new CustomError('Deal not found', 404);
  }

  if (deal.status !== 'NEGOTIATING') {
    throw new CustomError(`Cannot send message - negotiation is ${deal.status}`, 400);
  }

  // Parse offer from vendor message using the same parser as the chatbot engine
  // Import parseOfferWithDelivery to ensure consistent offer extraction
  // Pass requisition currency for proper conversion (February 2026)
  const { parseOfferWithDelivery } = await import('../chatbot/engine/parseOffer.js');
  const {
    mergeOffers,
    shouldResetAccumulation,
    createAccumulatedOffer,
    getProvidedComponents,
    getMissingComponents,
  } = await import('../chatbot/engine/offerAccumulator.js');

  const requisition = (contract as any).Requisition;
  const requisitionCurrency = requisition?.typeOfCurrency as 'USD' | 'INR' | 'EUR' | 'GBP' | 'AUD' | undefined;
  const parsedOffer = parseOfferWithDelivery(content, requisitionCurrency);

  // Accumulate offers across messages (price in msg1, terms in msg2, etc.)
  const vendorMessageId = uuidv4();
  const previousAccumulated = deal.latestVendorOffer as any;
  let accumulatedOffer: any;

  if (shouldResetAccumulation(parsedOffer)) {
    // Vendor provided complete offer (price + terms) - start fresh
    accumulatedOffer = createAccumulatedOffer(parsedOffer, vendorMessageId);
    logger.info(`[VendorChat] Complete offer detected, resetting accumulation for deal ${deal.id}`);
  } else if (parsedOffer.total_price !== null || parsedOffer.payment_terms !== null) {
    // Partial offer - merge with previously accumulated state
    accumulatedOffer = mergeOffers(previousAccumulated, parsedOffer, vendorMessageId);
    logger.info(`[VendorChat] Partial offer merged for deal ${deal.id}`, {
      provided: getProvidedComponents(parsedOffer),
      missing: getMissingComponents(accumulatedOffer),
      isComplete: accumulatedOffer?.accumulation?.isComplete,
    });
  } else {
    // No offer data in this message - keep previous accumulated state
    accumulatedOffer = previousAccumulated || null;
  }

  // Create vendor message with accumulated offer
  const vendorMessage = await models.ChatbotMessage.create({
    id: vendorMessageId,
    dealId: deal.id,
    role: 'VENDOR',
    content,
    extractedOffer: accumulatedOffer || null,
    counterOffer: null,
    engineDecision: null,
    decisionAction: null,
    utilityScore: null,
    explainabilityJson: null,
    round: deal.round + 1,
  });

  // Update deal with latest accumulated vendor offer
  if (accumulatedOffer) {
    await deal.update({
      latestVendorOffer: accumulatedOffer as any,
      lastMessageAt: new Date(),
    });
  }

  return { vendorMessage, deal };
};

/**
 * Generate PM response - Phase 2: Async response generation
 * Uses the actual chatbot decision engine for real PM responses
 */
export const generatePMResponse = async (
  uniqueToken: string,
  vendorMessageId: string
): Promise<{
  pmMessage: ChatbotMessage;
  decision: {
    action: 'ACCEPT' | 'COUNTER' | 'ESCALATE' | 'WALK_AWAY';
    utilityScore: number;
    counterOffer: any | null;
    reasons: string[];
  };
  deal: ChatbotDeal;
  meso: any | null;
  explainability: any | null;
}> => {
  const contract = await findContractByToken(uniqueToken);
  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  if (!contract.chatbotDealId) {
    throw new CustomError('No negotiation deal found', 404);
  }

  const deal = await models.ChatbotDeal.findByPk(contract.chatbotDealId);
  if (!deal) {
    throw new CustomError('Deal not found', 404);
  }

  // Get vendor message
  const vendorMessage = await models.ChatbotMessage.findByPk(vendorMessageId);
  if (!vendorMessage) {
    throw new CustomError('Vendor message not found', 404);
  }

  try {
    // Use the LLM-enhanced async PM response service for human-like responses
    // This is the same service used by the PM's negotiation room
    const result = await generatePMResponseAsyncService({
      dealId: deal.id,
      vendorMessageId: vendorMessage.id,
      userId: 0, // Vendor messages don't have an authenticated user
    });

    // Reload deal to get updated state
    await deal.reload();

    // Build decision object from the result
    const pmDecision = {
      action: result.decision.action as 'ACCEPT' | 'COUNTER' | 'ESCALATE' | 'WALK_AWAY',
      utilityScore: result.decision.utilityScore || 0,
      counterOffer: result.decision.counterOffer || null,
      reasons: result.decision.reasons || [],
    };

    // Sync contract status when deal reaches terminal state (belt-and-suspenders)
    if (['ACCEPTED', 'WALKED_AWAY', 'ESCALATED'].includes(deal.status)) {
      syncContractStatus(deal.id, deal.status, deal.contractId)
        .catch((err) => logger.error(`Failed to sync contract status from vendor-chat: ${(err as Error).message}`));
    }

    logger.info(`Generated PM response for vendor chat: ${pmDecision.action} (utility: ${pmDecision.utilityScore})`, {
      hasMeso: !!result.meso,
      mesoOptions: result.meso?.options?.length || 0,
    });

    return {
      pmMessage: result.message,
      decision: pmDecision,
      deal,
      meso: result.meso || null, // Include MESO options for frontend
      explainability: result.explainability || null,
    };
  } catch (error) {
    logger.error('Failed to generate PM response using LLM service, attempting direct engine fallback', {
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n'),
      dealId: deal.id,
      vendorMessageId,
    });

    // Fallback: run the decision engine directly (no LLM, template-based response)
    try {
      const { decideNextMove } = await import('../chatbot/engine/decide.js');
      const { generateQuickFallback } = await import('../chatbot/engine/responseGenerator.js');
      const { parseOfferWithDelivery } = await import('../chatbot/engine/parseOffer.js');

      // Build config from deal or requisition
      let config: any;
      if (deal.negotiationConfigJson) {
        const stored = deal.negotiationConfigJson as any;
        config = {
          parameters: stored.parameters,
          accept_threshold: stored.accept_threshold,
          escalate_threshold: stored.escalate_threshold,
          walkaway_threshold: stored.walkaway_threshold,
          max_rounds: stored.max_rounds,
          priority: stored.priority,
        };
      } else if (deal.requisitionId) {
        config = await buildConfigFromRequisition(deal.requisitionId);
      } else {
        throw new Error('No negotiation config available for fallback');
      }

      // Extract vendor offer
      const vendorOffer = (vendorMessage.extractedOffer as any) || parseOfferWithDelivery(vendorMessage.content);

      // Run decision engine
      const decision = decideNextMove(config, vendorOffer, deal.round, null, null);

      // Generate template-based response (no LLM)
      const responseContent = generateQuickFallback({
        decision,
        config,
        conversationHistory: [{ role: 'VENDOR', content: vendorMessage.content }],
        vendorOffer,
        counterOffer: decision.counterOffer,
        dealTitle: deal.title,
        round: deal.round,
        maxRounds: config.max_rounds,
      });

      const currentRound = vendorMessage.round || (deal.round + 1);

      const fallbackMessage = await models.ChatbotMessage.create({
        id: uuidv4(),
        dealId: deal.id,
        role: 'ACCORDO',
        content: responseContent,
        extractedOffer: null,
        counterOffer: decision.counterOffer as any,
        engineDecision: decision as any,
        decisionAction: decision.action,
        utilityScore: decision.utilityScore,
        explainabilityJson: null,
        round: currentRound,
      });

      let finalStatus: 'NEGOTIATING' | 'ACCEPTED' | 'WALKED_AWAY' | 'ESCALATED' = deal.status;
      if (decision.action === 'ACCEPT') finalStatus = 'ACCEPTED';
      else if (decision.action === 'WALK_AWAY') finalStatus = 'WALKED_AWAY';
      else if (decision.action === 'ESCALATE') finalStatus = 'ESCALATED';

      await deal.update({
        round: currentRound,
        status: finalStatus,
        latestOfferJson: decision.counterOffer as any,
        latestDecisionAction: decision.action,
        latestUtility: decision.utilityScore,
      });
      await deal.reload();

      // Sync contract status when deal reaches terminal state (fire-and-forget)
      if (['ACCEPTED', 'WALKED_AWAY', 'ESCALATED'].includes(finalStatus)) {
        syncContractStatus(deal.id, finalStatus, deal.contractId)
          .catch((err) => logger.error(`[Fallback] Failed to sync contract status: ${(err as Error).message}`));
      }

      logger.info(`[Fallback] Direct engine response for vendor chat: ${decision.action} (utility: ${decision.utilityScore})`);

      return {
        pmMessage: fallbackMessage,
        decision: {
          action: decision.action as 'ACCEPT' | 'COUNTER' | 'ESCALATE' | 'WALK_AWAY',
          utilityScore: decision.utilityScore,
          counterOffer: decision.counterOffer || null,
          reasons: decision.reasons || [],
        },
        deal,
        meso: null, // Fallback doesn't generate MESO
        explainability: null,
      };
    } catch (fallbackError) {
      logger.error('Direct engine fallback also failed', {
        error: (fallbackError as Error).message,
        stack: (fallbackError as Error).stack?.split('\n').slice(0, 5).join('\n'),
      });

      // Last resort: create a generic acknowledgment
      const lastResortContent = `Thank you for your offer. I've reviewed the details and would like to discuss terms further. Could you share more about your pricing flexibility?`;

      const lastResortMessage = await models.ChatbotMessage.create({
        id: uuidv4(),
        dealId: deal.id,
        role: 'ACCORDO',
        content: lastResortContent,
        extractedOffer: null,
        counterOffer: null,
        engineDecision: null,
        decisionAction: 'COUNTER',
        utilityScore: null,
        explainabilityJson: null,
        round: deal.round + 1,
      });

      await deal.update({ round: deal.round + 1 });
      await deal.reload();

      return {
        pmMessage: lastResortMessage,
        decision: {
          action: 'COUNTER' as const,
          utilityScore: 0,
          counterOffer: null,
          reasons: ['Engine fallback failed - generic response'],
        },
        deal,
        meso: null, // Last resort doesn't generate MESO
        explainability: null,
      };
    }
  }
};

export default {
  submitVendorQuote,
  canEditQuote,
  editVendorQuote,
  getDealForVendor,
  vendorEnterChat,
  vendorSendMessageInstant,
  generatePMResponse,
};
