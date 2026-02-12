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
    if (contract.status !== 'Created' && contract.status !== 'Opened') {
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

  return { deal, openingMessage };
};

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
  const requisition = (contract as any).Requisition;
  const requisitionCurrency = requisition?.typeOfCurrency as 'USD' | 'INR' | 'EUR' | 'GBP' | 'AUD' | undefined;
  const parsedOffer = parseOfferWithDelivery(content, requisitionCurrency);

  // Create vendor message
  const vendorMessage = await models.ChatbotMessage.create({
    id: uuidv4(),
    dealId: deal.id,
    role: 'VENDOR',
    content,
    extractedOffer: parsedOffer.total_price !== null || parsedOffer.payment_terms !== null ? {
      total_price: parsedOffer.total_price,
      payment_terms: parsedOffer.payment_terms,
      payment_terms_days: parsedOffer.payment_terms_days,
      delivery_date: parsedOffer.delivery_date,
      delivery_days: parsedOffer.delivery_days,
    } : null,
    counterOffer: null,
    engineDecision: null,
    decisionAction: null,
    utilityScore: null,
    explainabilityJson: null,
    round: deal.round + 1,
  });

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

    logger.info(`Generated PM response for vendor chat: ${pmDecision.action} (utility: ${pmDecision.utilityScore})`);

    return {
      pmMessage: result.message,
      decision: pmDecision,
      deal,
    };
  } catch (error) {
    logger.error('Failed to generate PM response using LLM service', { error: (error as Error).message });

    // Fallback: generate a simple acknowledgment if the engine fails
    const fallbackContent = `Thank you for your offer. I'm reviewing the details and will provide my response shortly. We value this negotiation and look forward to reaching a mutually beneficial agreement.`;

    const fallbackMessage = await models.ChatbotMessage.create({
      id: uuidv4(),
      dealId: deal.id,
      role: 'ACCORDO',
      content: fallbackContent,
      extractedOffer: null,
      counterOffer: null,
      engineDecision: null,
      decisionAction: null,
      utilityScore: null,
      explainabilityJson: null,
      round: deal.round + 1,
    });

    await deal.update({ round: deal.round + 1 });
    await deal.reload();

    return {
      pmMessage: fallbackMessage,
      decision: {
        action: 'COUNTER',
        utilityScore: 0,
        counterOffer: null,
        reasons: ['Response pending review'],
      },
      deal,
    };
  }
};

/**
 * Vendor suggestion emphasis types (same as PM but from vendor perspective)
 */
export type VendorSuggestionEmphasis = 'price' | 'terms' | 'delivery';

/**
 * Structured vendor suggestion
 */
export interface VendorStructuredSuggestion {
  message: string;
  price: number;
  paymentTerms: string;
  deliveryDate: string | null;
  deliveryDays: number | null;
  emphasis: VendorSuggestionEmphasis;
}

/**
 * Vendor scenario suggestions map
 */
export type VendorScenarioType = 'STRONG' | 'BALANCED' | 'FLEXIBLE';
export type VendorScenarioSuggestions = Record<VendorScenarioType, VendorStructuredSuggestion[]>;

/**
 * Generate vendor suggestions based on PM's last counter-offer
 *
 * Vendor Perspective (vendor wants HIGHER prices):
 * - STRONG: 15% above PM's counter-offer (vendor's strong position)
 * - BALANCED: 5% above PM's counter-offer (meet halfway)
 * - FLEXIBLE: Match PM's counter-offer (vendor accepts PM's price)
 *
 * Uses both vendor's original quote and PM's counter-offer for smart calculation.
 * PM targets remain hidden from vendor.
 */
export const generateVendorSuggestions = async (
  uniqueToken: string,
  emphases?: VendorSuggestionEmphasis[]
): Promise<{
  suggestions: VendorScenarioSuggestions;
  hasPMCounterOffer: boolean;
  vendorQuotePrice: number | null;
  pmCounterPrice: number | null;
}> => {
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

  // Get all messages to find PM's last counter-offer
  const messages = await models.ChatbotMessage.findAll({
    where: { dealId: deal.id },
    order: [['createdAt', 'DESC']],
  });

  // Find the most recent PM (ACCORDO) message with a counter-offer
  let pmCounterOffer: { unit_price?: number; total_price?: number; payment_terms?: string } | null = null;
  for (const msg of messages) {
    if (msg.role === 'ACCORDO' && msg.counterOffer) {
      pmCounterOffer = msg.counterOffer as any;
      break;
    }
  }

  // Parse vendor's original quote
  let vendorQuote: ContractDetails | null = null;
  let vendorQuotePrice: number | null = null;
  if (contract.contractDetails) {
    try {
      vendorQuote = typeof contract.contractDetails === 'string'
        ? JSON.parse(contract.contractDetails)
        : contract.contractDetails;

      // Calculate total from vendor quote
      if (vendorQuote?.products) {
        vendorQuotePrice = vendorQuote.products.reduce((sum, p) => {
          const unitPrice = typeof p.quotedPrice === 'number' ? p.quotedPrice : parseFloat(p.quotedPrice as string) || 0;
          return sum + (unitPrice * (p.quantity || 1));
        }, 0);
      }
    } catch {
      vendorQuote = null;
    }
  }

  // Get PM's counter price (use total_price or unit_price)
  const pmCounterPrice = pmCounterOffer?.total_price ?? pmCounterOffer?.unit_price ?? null;
  const hasPMCounterOffer = pmCounterPrice !== null;

  // If no PM counter-offer yet, return empty suggestions
  if (!hasPMCounterOffer) {
    return {
      suggestions: {
        STRONG: [],
        BALANCED: [],
        FLEXIBLE: [],
      },
      hasPMCounterOffer: false,
      vendorQuotePrice,
      pmCounterPrice: null,
    };
  }

  // Calculate vendor suggestion prices (vendor perspective - wants higher prices)
  // STRONG: 15% above PM's counter (vendor's strong position)
  // BALANCED: 5% above PM's counter (meet in middle)
  // FLEXIBLE: Match PM's counter (vendor accepts PM's price)
  const strongPrice = Math.round(pmCounterPrice * 1.15 * 100) / 100;
  const balancedPrice = Math.round(pmCounterPrice * 1.05 * 100) / 100;
  const flexiblePrice = pmCounterPrice;

  // Get vendor's payment terms from quote or default
  const vendorTerms = vendorQuote?.additionalTerms;
  const vendorPaymentTerms = vendorTerms?.paymentTerms === 'net_payment'
    ? `Net ${vendorTerms?.netPaymentDay || 30}`
    : 'Net 30';

  // PM's suggested payment terms
  const pmPaymentTerms = pmCounterOffer?.payment_terms || 'Net 60';

  // Calculate delivery date (30 days from now as default)
  const today = new Date();
  const deliveryDate = new Date(today);
  deliveryDate.setDate(deliveryDate.getDate() + 30);
  const deliveryDateStr = deliveryDate.toISOString().split('T')[0];

  // Generate suggestions for each scenario with different emphases
  const generateScenarioSuggestions = (
    scenarioType: VendorScenarioType,
    basePrice: number,
    priceDescription: string
  ): VendorStructuredSuggestion[] => {
    const suggestions: VendorStructuredSuggestion[] = [];

    // Price-focused suggestion
    if (!emphases || emphases.length === 0 || emphases.includes('price')) {
      suggestions.push({
        message: `I can offer $${basePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} total${scenarioType === 'STRONG' ? ', which reflects our premium quality and reliable service' : scenarioType === 'BALANCED' ? ', meeting you halfway on the pricing' : ', accepting your proposed price point'}. Payment on ${vendorPaymentTerms} terms.`,
        price: basePrice,
        paymentTerms: vendorPaymentTerms,
        deliveryDate: deliveryDateStr,
        deliveryDays: 30,
        emphasis: 'price',
      });
    }

    // Terms-focused suggestion
    if (!emphases || emphases.length === 0 || emphases.includes('terms')) {
      const termsPrice = scenarioType === 'STRONG' ? basePrice : Math.round(basePrice * 0.98 * 100) / 100;
      suggestions.push({
        message: `For $${termsPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}, I can offer ${scenarioType === 'STRONG' ? 'Net 30' : scenarioType === 'BALANCED' ? 'Net 45' : pmPaymentTerms} payment terms${scenarioType !== 'STRONG' ? ' to accommodate your cash flow requirements' : ''}.`,
        price: termsPrice,
        paymentTerms: scenarioType === 'STRONG' ? 'Net 30' : scenarioType === 'BALANCED' ? 'Net 45' : pmPaymentTerms,
        deliveryDate: deliveryDateStr,
        deliveryDays: 30,
        emphasis: 'terms',
      });
    }

    // Delivery-focused suggestion
    if (!emphases || emphases.length === 0 || emphases.includes('delivery')) {
      const deliveryDays = scenarioType === 'STRONG' ? 45 : scenarioType === 'BALANCED' ? 30 : 21;
      const deliveryAdjustedDate = new Date(today);
      deliveryAdjustedDate.setDate(deliveryAdjustedDate.getDate() + deliveryDays);
      const adjustedDateStr = deliveryAdjustedDate.toISOString().split('T')[0];

      suggestions.push({
        message: `I propose $${basePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} with delivery in ${deliveryDays} days${scenarioType === 'FLEXIBLE' ? ' - expedited to meet your timeline' : scenarioType === 'BALANCED' ? ' - our standard timeline' : ' - allowing optimal production scheduling'}.`,
        price: basePrice,
        paymentTerms: vendorPaymentTerms,
        deliveryDate: adjustedDateStr,
        deliveryDays: deliveryDays,
        emphasis: 'delivery',
      });
    }

    return suggestions;
  };

  const suggestions: VendorScenarioSuggestions = {
    STRONG: generateScenarioSuggestions('STRONG', strongPrice, '15% above counter'),
    BALANCED: generateScenarioSuggestions('BALANCED', balancedPrice, '5% above counter'),
    FLEXIBLE: generateScenarioSuggestions('FLEXIBLE', flexiblePrice, 'matching counter'),
  };

  logger.info(`Generated vendor suggestions for token ${uniqueToken.substring(0, 8)}...`, {
    hasPMCounterOffer,
    vendorQuotePrice,
    pmCounterPrice,
    strongPrice,
    balancedPrice,
    flexiblePrice,
  });

  return {
    suggestions,
    hasPMCounterOffer,
    vendorQuotePrice,
    pmCounterPrice,
  };
};

export default {
  submitVendorQuote,
  canEditQuote,
  editVendorQuote,
  getDealForVendor,
  vendorEnterChat,
  vendorSendMessageInstant,
  generatePMResponse,
  generateVendorSuggestions,
};
