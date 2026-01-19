import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { CustomError } from '../../utils/custom-error.js';
import logger from '../../config/logger.js';
import models from '../../models/index.js';
import sequelize from '../../config/database.js';
import { parseOfferRegex } from './engine/parseOffer.js';
import { decideNextMove } from './engine/decide.js';
import { computeExplainability, totalUtility, type NegotiationConfig } from './engine/utility.js';
import type { Offer, Decision, Explainability, WeightedUtilityResult, ParsedVendorOffer } from './engine/types.js';
import { calculateWeightedUtility, convertLegacyConfig, getUtilitySummary, extractValueFromOffer } from './engine/weightedUtility.js';
import { DEFAULT_THRESHOLDS } from './engine/types.js';
import type { ChatbotDeal } from '../../models/chatbotDeal.js';
import type { ChatbotMessage } from '../../models/chatbotMessage.js';
import { chatCompletion } from '../../services/llm.service.js';
import { captureVendorBid, checkAndTriggerComparison } from '../bidComparison/bidComparison.service.js';
import { sendDealCreatedEmail, sendPmDealStatusNotificationEmail, sendDealSummaryPDFEmail } from '../../services/email.service.js';
import { getCachedSuggestions, cacheSuggestions, invalidateSuggestions, precomputeSuggestionsBackground } from './suggestionCache.js';
import { generateDealSummaryPDF, generatePDFFilename, type DealSummaryPDFInput } from './pdf/dealSummaryPdfGenerator.js';

export interface CreateDealInput {
  title: string;
  counterparty?: string;
  mode?: 'INSIGHTS' | 'CONVERSATION';
  templateId?: string;
  requisitionId?: number;
  contractId?: number;
  userId: number;
  vendorId?: number;
}

/**
 * Input for creating a deal with full wizard configuration
 */
export interface CreateDealWithConfigInput {
  // Basic info
  title: string;
  counterparty?: string;
  mode: 'INSIGHTS' | 'CONVERSATION';
  requisitionId: number;
  vendorId: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  userId: number;

  // Price & Quantity
  priceQuantity: {
    targetUnitPrice: number;
    maxAcceptablePrice: number;
    minOrderQuantity: number;
    preferredQuantity?: number;
    volumeDiscountExpectation?: number;
  };

  // Payment Terms
  paymentTerms: {
    minDays: number;
    maxDays: number;
    advancePaymentLimit?: number;
    acceptedMethods?: ('BANK_TRANSFER' | 'CREDIT' | 'LC')[];
  };

  // Delivery
  delivery: {
    requiredDate: string;
    preferredDate?: string;
    locationId?: number;
    locationAddress?: string;
    partialDelivery: {
      allowed: boolean;
      type?: 'QUANTITY' | 'PERCENTAGE';
      minValue?: number;
    };
  };

  // Contract & SLA
  contractSla: {
    warrantyPeriod: '6_MONTHS' | '1_YEAR' | '2_YEARS' | '3_YEARS';
    defectLiabilityMonths?: number;
    lateDeliveryPenaltyPerDay: number;
    maxPenaltyCap?: {
      type: 'PERCENTAGE' | 'FIXED';
      value?: number;
    };
    qualityStandards?: string[];
  };

  // Negotiation Control
  negotiationControl?: {
    deadline?: string;
    maxRounds?: number;
    walkawayThreshold?: number;
  };

  // Custom Parameters
  customParameters?: Array<{
    id?: string;
    name: string;
    type: 'BOOLEAN' | 'NUMBER' | 'TEXT' | 'DATE';
    targetValue: boolean | number | string;
    flexibility: 'FIXED' | 'FLEXIBLE' | 'NICE_TO_HAVE';
    includeInNegotiation: boolean;
  }>;
}

export interface ProcessMessageInput {
  dealId: string;
  content: string;
  role: 'VENDOR' | 'ACCORDO' | 'SYSTEM';
  userId: number;
}

export interface DealWithMessages {
  deal: ChatbotDeal;
  messages: ChatbotMessage[];
}

export interface ListDealsFilters {
  status?: 'NEGOTIATING' | 'ACCEPTED' | 'WALKED_AWAY' | 'ESCALATED';
  mode?: 'INSIGHTS' | 'CONVERSATION';
  archived?: boolean;
  deleted?: boolean;
  userId?: number;
  vendorId?: number;
}

export interface PaginatedDealsResponse {
  data: ChatbotDeal[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Map requisition data to negotiation config
 * Uses BATNA and target price from requisition products
 */
export const buildConfigFromRequisition = async (
  requisitionId: number
): Promise<NegotiationConfig> => {
  const requisition = await models.Requisition.findByPk(requisitionId, {
    include: [
      {
        model: models.RequisitionProduct,
        as: 'RequisitionProduct',
      },
    ],
  });

  if (!requisition) {
    throw new CustomError('Requisition not found', 404);
  }

  // Calculate weighted average target price from products
  let totalTarget = 0;
  let totalQuantity = 0;

  if (requisition.RequisitionProduct && requisition.RequisitionProduct.length > 0) {
    for (const reqProduct of requisition.RequisitionProduct) {
      const quantity = (reqProduct as any).qty || 1;
      const targetPrice = (reqProduct as any).targetPrice || 0;
      totalTarget += targetPrice * quantity;
      totalQuantity += quantity;
    }
  }

  const averageTarget = totalQuantity > 0 ? totalTarget / totalQuantity : 100;
  const anchor = averageTarget * 0.85; // 15% below target
  const maxAcceptable = averageTarget * 1.2; // 20% above target
  const concessionStep = (averageTarget - anchor) / 6; // ~2.5% steps

  return {
    parameters: {
      unit_price: {
        weight: 0.6,
        direction: 'minimize',
        anchor,
        target: averageTarget,
        max_acceptable: maxAcceptable,
        concession_step: concessionStep,
      },
      payment_terms: {
        weight: 0.4,
        options: ['Net 30', 'Net 60', 'Net 90'] as const,
        utility: {
          'Net 30': 0.2,
          'Net 60': 0.6,
          'Net 90': 1.0,
        },
      },
    },
    accept_threshold: 0.7,
    walkaway_threshold: 0.45,
    max_rounds: 6,
  };
};

/**
 * Map contract data to negotiation config
 */
export const buildConfigFromContract = async (
  contractId: number
): Promise<NegotiationConfig> => {
  const contract = await models.Contract.findByPk(contractId, {
    include: [
      {
        model: models.Requisition,
        as: 'Requisition',
        include: [
          {
            model: models.RequisitionProduct,
            as: 'RequisitionProduct',
          },
        ],
      },
    ],
  });

  if (!contract) {
    throw new CustomError('Contract not found', 404);
  }

  if (!contract.Requisition) {
    throw new CustomError('Contract has no associated requisition', 400);
  }

  return buildConfigFromRequisition(contract.Requisition.id);
};

/**
 * Create a new negotiation deal
 */
export const createDealService = async (
  input: CreateDealInput
): Promise<ChatbotDeal> => {
  try {
    const dealId = uuidv4();

    // Validate foreign keys
    if (input.requisitionId) {
      const requisition = await models.Requisition.findByPk(input.requisitionId);
      if (!requisition) {
        throw new CustomError('Requisition not found', 404);
      }
    }

    if (input.contractId) {
      const contract = await models.Contract.findByPk(input.contractId);
      if (!contract) {
        throw new CustomError('Contract not found', 404);
      }
    }

    if (input.vendorId) {
      const vendor = await models.User.findByPk(input.vendorId);
      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }
    }

    const deal = await models.ChatbotDeal.create({
      id: dealId,
      title: input.title,
      counterparty: input.counterparty || null,
      status: 'NEGOTIATING',
      round: 0,
      mode: input.mode || 'CONVERSATION',
      latestOfferJson: null,
      latestVendorOffer: null,
      latestDecisionAction: null,
      latestUtility: null,
      convoStateJson: input.mode === 'CONVERSATION' ? { phase: 'GREETING', history: [] } : null,
      templateId: input.templateId || null,
      requisitionId: input.requisitionId || null,
      contractId: input.contractId || null,
      userId: input.userId,
      vendorId: input.vendorId || null,
      archivedAt: null,
      deletedAt: null,
    });

    logger.info(`Created deal ${dealId}: ${input.title}`);
    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to create deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Create a negotiation deal with full wizard configuration
 * Stores all parameters in negotiationConfigJson
 */
export const createDealWithConfigService = async (
  input: CreateDealWithConfigInput
): Promise<ChatbotDeal> => {
  try {
    const dealId = uuidv4();

    // Validate requisition exists
    const requisition = await models.Requisition.findByPk(input.requisitionId);
    if (!requisition) {
      throw new CustomError('Requisition not found', 404);
    }

    // Validate vendor exists
    const vendor = await models.User.findByPk(input.vendorId);
    if (!vendor) {
      throw new CustomError('Vendor not found', 404);
    }

    // Build negotiation config from wizard input
    const { priceQuantity, paymentTerms, delivery, contractSla, negotiationControl, customParameters } = input;

    // Calculate concession step based on price range
    const priceRange = priceQuantity.maxAcceptablePrice - priceQuantity.targetUnitPrice;
    const concessionStep = priceRange / (negotiationControl?.maxRounds || 10);

    // Build payment terms utility based on accepted methods
    const paymentTermsOptions = ['Net 30', 'Net 60', 'Net 90'] as const;
    const paymentTermsUtility = {
      'Net 30': 0.2,
      'Net 60': 0.6,
      'Net 90': 1.0,
    } as const;

    // Adjust accept/walkaway thresholds based on priority
    let acceptThreshold = 0.7;
    let walkawayThreshold = 0.45;

    if (input.priority === 'HIGH') {
      acceptThreshold = 0.8;
      walkawayThreshold = 0.55;
    } else if (input.priority === 'LOW') {
      acceptThreshold = 0.6;
      walkawayThreshold = 0.35;
    }

    // Apply custom walkaway threshold if provided
    if (negotiationControl?.walkawayThreshold) {
      walkawayThreshold = (100 - negotiationControl.walkawayThreshold) / 100;
    }

    const negotiationConfig: NegotiationConfig = {
      parameters: {
        unit_price: {
          weight: 0.6,
          direction: 'minimize',
          anchor: priceQuantity.targetUnitPrice * 0.85,
          target: priceQuantity.targetUnitPrice,
          max_acceptable: priceQuantity.maxAcceptablePrice,
          concession_step: concessionStep,
        },
        payment_terms: {
          weight: 0.4,
          options: paymentTermsOptions,
          utility: paymentTermsUtility,
        },
      },
      accept_threshold: acceptThreshold,
      walkaway_threshold: walkawayThreshold,
      max_rounds: negotiationControl?.maxRounds || 10,
    };

    // Store the full wizard configuration in a separate JSON field
    const wizardConfig = {
      priority: input.priority,
      priceQuantity,
      paymentTerms,
      delivery,
      contractSla,
      negotiationControl: {
        deadline: negotiationControl?.deadline || null,
        maxRounds: negotiationControl?.maxRounds || 10,
        walkawayThreshold: negotiationControl?.walkawayThreshold || 20,
      },
      customParameters: customParameters || [],
    };

    // Check if a Contract already exists for this vendor+requisition
    // If not, create one to ensure data consistency between Contracts and ChatbotDeals tables
    let contractId: number | null = null;

    const existingContract = await models.Contract.findOne({
      where: {
        requisitionId: input.requisitionId,
        vendorId: input.vendorId,
      },
    });

    if (existingContract) {
      contractId = existingContract.id;
      logger.info(`Using existing contract ${contractId} for vendor ${input.vendorId} on requisition ${input.requisitionId}`);
    } else {
      // Create a new Contract record to link vendor to requisition
      // This ensures the vendor appears in the dropdown for future deals
      const uniqueToken = crypto.randomBytes(16).toString('hex');
      const newContract = await models.Contract.create({
        requisitionId: input.requisitionId,
        vendorId: input.vendorId,
        status: 'Created',
        uniqueToken,
        chatbotDealId: dealId,  // Link to the deal we're about to create
        createdBy: input.userId,
      });
      contractId = newContract.id;
      logger.info(`Created new contract ${contractId} for vendor ${input.vendorId} on requisition ${input.requisitionId}`);
    }

    const deal = await models.ChatbotDeal.create({
      id: dealId,
      title: input.title,
      counterparty: input.counterparty || null,
      status: 'NEGOTIATING',
      round: 0,
      mode: input.mode,
      latestOfferJson: null,
      latestVendorOffer: null,
      latestDecisionAction: null,
      latestUtility: null,
      convoStateJson: input.mode === 'CONVERSATION' ? { phase: 'GREETING', history: [] } : null,
      negotiationConfigJson: { ...negotiationConfig, wizardConfig } as any,
      templateId: null,
      requisitionId: input.requisitionId,
      contractId: contractId,
      userId: input.userId,
      vendorId: input.vendorId,
      archivedAt: null,
      deletedAt: null,
    });

    logger.info(`Created deal with config ${dealId}: ${input.title} (priority: ${input.priority})`);

    // Send email notification to vendor
    let emailStatus: { success: boolean; messageId?: string; error?: string } = { success: false, error: 'Email not sent' };

    try {
      // Fetch requisition with products and project
      const requisitionWithDetails = await models.Requisition.findByPk(input.requisitionId, {
        include: [
          {
            model: models.Project,
            as: 'Project',
            attributes: ['id', 'projectName'],
          },
          {
            model: models.RequisitionProduct,
            as: 'RequisitionProduct',
            include: [
              {
                model: models.Product,
                as: 'Product',
                attributes: ['id', 'productName', 'UOM'],
              },
            ],
          },
        ],
      });

      if (requisitionWithDetails && vendor.email) {
        // Extract products from requisition
        const products = ((requisitionWithDetails as any).RequisitionProduct || []).map((rp: any) => ({
          name: rp.Product?.productName || 'Unknown Product',
          quantity: rp.quantity || 1,
          targetPrice: rp.targetPrice || priceQuantity.targetUnitPrice,
          unit: rp.Product?.UOM || undefined,
        }));

        // Build email data
        const emailData = {
          dealId: dealId,
          dealTitle: input.title,
          requisitionId: input.requisitionId,
          rfqNumber: (requisitionWithDetails as any).rfqNumber || `RFQ-${input.requisitionId}`,
          requisitionTitle: (requisitionWithDetails as any).title || input.title,
          projectName: (requisitionWithDetails as any).Project?.projectName || 'Unknown Project',
          vendorId: input.vendorId,
          vendorName: vendor.name || vendor.email,
          vendorEmail: vendor.email,
          negotiationDeadline: negotiationControl?.deadline ? new Date(negotiationControl.deadline) : (requisitionWithDetails as any).negotiationClosureDate || undefined,
          products: products.length > 0 ? products : [{
            name: 'Products as per RFQ',
            quantity: 1,
            targetPrice: priceQuantity.targetUnitPrice,
          }],
          priceConfig: {
            targetUnitPrice: priceQuantity.targetUnitPrice,
            maxAcceptablePrice: priceQuantity.maxAcceptablePrice,
          },
          paymentTerms: paymentTerms ? {
            minDays: paymentTerms.minDays || 30,
            maxDays: paymentTerms.maxDays || 90,
          } : undefined,
          deliveryDate: delivery?.requiredDate || undefined,
        };

        emailStatus = await sendDealCreatedEmail(emailData);

        if (emailStatus.success) {
          logger.info(`Deal created email sent to vendor ${vendor.email} for deal ${dealId}`);
        } else {
          logger.warn(`Failed to send deal created email: ${emailStatus.error}`, { dealId, vendorEmail: vendor.email });
        }
      } else {
        logger.warn(`Cannot send deal created email: missing requisition details or vendor email`, {
          dealId,
          hasRequisition: !!requisitionWithDetails,
          hasVendorEmail: !!vendor.email,
        });
      }
    } catch (emailError) {
      logger.error(`Error sending deal created email: ${(emailError as Error).message}`, { dealId });
      emailStatus = { success: false, error: (emailError as Error).message };
    }

    // Return deal with email status (deal is created regardless of email status)
    return {
      ...deal.toJSON(),
      emailStatus,
    } as ChatbotDeal & { emailStatus: typeof emailStatus };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to create deal with config: ${(error as Error).message}`, 500);
  }
};

/**
 * Get smart defaults for a vendor/RFQ combination
 * Based on historical data from similar deals
 */
/**
 * Smart defaults response structure matching frontend SmartDefaults interface
 */
interface SmartDefaultsResponse {
  priceQuantity: {
    targetUnitPrice: number | null;
    maxAcceptablePrice: number | null;
    volumeDiscountExpectation: number | null;
  };
  paymentTerms: {
    minDays: number;
    maxDays: number;
    advancePaymentLimit: number | null;
  };
  delivery: {
    typicalDeliveryDays: number | null;
  };
  source: 'vendor_history' | 'similar_deals' | 'industry_default' | 'combined';
  confidence: number;
}

export const getSmartDefaultsService = async (
  rfqId: number,
  vendorId: number
): Promise<SmartDefaultsResponse> => {
  try {
    // Get requisition for base pricing
    const requisition = await models.Requisition.findByPk(rfqId, {
      include: [
        {
          model: models.RequisitionProduct,
          as: 'RequisitionProduct',
        },
      ],
    });

    if (!requisition) {
      throw new CustomError('Requisition not found', 404);
    }

    // Calculate base target from requisition products
    let totalTarget = 0;
    let totalQuantity = 0;

    if (requisition.RequisitionProduct && requisition.RequisitionProduct.length > 0) {
      for (const reqProduct of requisition.RequisitionProduct) {
        const quantity = (reqProduct as any).qty || 1;
        const targetPrice = (reqProduct as any).targetPrice || 100;
        totalTarget += targetPrice * quantity;
        totalQuantity += quantity;
      }
    }

    const averageTarget = totalQuantity > 0 ? totalTarget / totalQuantity : 100;

    // Look for historical deals with this vendor
    const historicalDeals = await models.ChatbotDeal.findAll({
      where: {
        vendorId,
        status: 'ACCEPTED',
      },
      limit: 10,
      order: [['createdAt', 'DESC']],
    });

    // Calculate averages from historical data
    let avgPaymentDays = 45;
    let avgVolumeDiscount = 5;
    let avgDeliveryDays = 14;
    let source: SmartDefaultsResponse['source'] = 'industry_default';
    let confidence = 0.5;

    if (historicalDeals.length > 0) {
      // Use historical data if available
      avgPaymentDays = 45;
      avgVolumeDiscount = 8;
      avgDeliveryDays = 21;
      source = 'vendor_history';
      confidence = 0.8;
    }

    const targetUnitPrice = Math.round(averageTarget * 100) / 100;
    const maxAcceptablePrice = Math.round(averageTarget * 1.2 * 100) / 100;

    return {
      priceQuantity: {
        targetUnitPrice,
        maxAcceptablePrice,
        volumeDiscountExpectation: avgVolumeDiscount,
      },
      paymentTerms: {
        minDays: 30,
        maxDays: avgPaymentDays + 15,
        advancePaymentLimit: 20, // Default 20% advance payment limit
      },
      delivery: {
        typicalDeliveryDays: avgDeliveryDays,
      },
      source,
      confidence,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to get smart defaults: ${(error as Error).message}`, 500);
  }
};

/**
 * Process a vendor message in INSIGHTS (demo) mode
 * Extracts offer, makes decision, generates counter
 */
/**
 * Generate Accordo response text based on decision
 */
const generateAccordoResponseText = (decision: Decision, config: NegotiationConfig): string => {
  const { action, counterOffer, utilityScore } = decision;

  switch (action) {
    case 'ACCEPT':
      return `I'm pleased to accept your offer. We have a deal at $${counterOffer?.unit_price || 'agreed'} with ${counterOffer?.payment_terms || 'agreed'} payment terms. Thank you for the negotiation.`;

    case 'COUNTER':
      const targetPrice = config.parameters.unit_price.target;
      const priceText = counterOffer?.unit_price
        ? `$${counterOffer.unit_price}`
        : `$${targetPrice}`;
      const termsText = counterOffer?.payment_terms || 'Net 60';
      return `Thank you for your offer. Based on our analysis, I'd like to counter with ${priceText} and ${termsText} payment terms. This would give us a utility score of ${((utilityScore || 0) * 100).toFixed(0)}%.`;

    case 'WALK_AWAY':
      return `I appreciate your time, but unfortunately the current offer doesn't meet our minimum requirements. The utility score of ${((utilityScore || 0) * 100).toFixed(0)}% falls below our walkaway threshold. We'll need to conclude this negotiation.`;

    case 'ESCALATE':
      return `This negotiation has reached a point where I need to escalate it to a human decision-maker for review. Thank you for your patience.`;

    case 'ASK_CLARIFY':
      return `I need some clarification on your offer. Could you please provide more details about the pricing and payment terms?`;

    default:
      return `Thank you for your message. Our analysis shows a utility score of ${((utilityScore || 0) * 100).toFixed(0)}%.`;
  }
};

export const processVendorMessageService = async (
  input: ProcessMessageInput
): Promise<{
  message: ChatbotMessage;
  accordoMessage: ChatbotMessage;
  decision: Decision;
  explainability: Explainability;
}> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(input.dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    if (deal.status !== 'NEGOTIATING') {
      throw new CustomError('Deal is not in negotiating status', 400);
    }

    // Build negotiation config from requisition or contract
    let config: NegotiationConfig;
    if (deal.requisitionId) {
      config = await buildConfigFromRequisition(deal.requisitionId);
    } else if (deal.contractId) {
      config = await buildConfigFromContract(deal.contractId);
    } else {
      // Fallback to default config
      const { negotiationConfig } = await import('./engine/config.js');
      config = negotiationConfig;
    }

    // Parse vendor offer from message
    const extractedOffer = parseOfferRegex(input.content);

    // Increment round
    const newRound = deal.round + 1;

    // Make decision
    const decision = decideNextMove(config, extractedOffer, newRound);

    // Compute explainability
    const explainability = computeExplainability(config, extractedOffer, decision);

    // Save VENDOR message
    const vendorMessageId = uuidv4();
    const message = await models.ChatbotMessage.create({
      id: vendorMessageId,
      dealId: input.dealId,
      role: input.role,
      content: input.content,
      extractedOffer: extractedOffer as any,
      engineDecision: null,
      decisionAction: null,
      utilityScore: null,
      counterOffer: null,
      explainabilityJson: null,
    });

    // Generate and save ACCORDO response message
    const accordoResponseText = generateAccordoResponseText(decision, config);
    const accordoMessageId = uuidv4();
    const accordoMessage = await models.ChatbotMessage.create({
      id: accordoMessageId,
      dealId: input.dealId,
      role: 'ACCORDO',
      content: accordoResponseText,
      extractedOffer: null,
      engineDecision: decision as any,
      decisionAction: decision.action,
      utilityScore: decision.utilityScore,
      counterOffer: decision.counterOffer as any,
      explainabilityJson: explainability as any,
    });

    // Update deal with latest state
    let finalStatus: 'NEGOTIATING' | 'ACCEPTED' | 'WALKED_AWAY' | 'ESCALATED' = deal.status;
    if (decision.action === 'ACCEPT') finalStatus = 'ACCEPTED';
    else if (decision.action === 'WALK_AWAY') finalStatus = 'WALKED_AWAY';
    else if (decision.action === 'ESCALATE') finalStatus = 'ESCALATED';

    await deal.update({
      round: newRound,
      status: finalStatus,
      latestVendorOffer: extractedOffer as any,
      latestOfferJson: decision.counterOffer as any,
      latestDecisionAction: decision.action,
      latestUtility: decision.utilityScore,
    });

    logger.info(
      `Processed vendor message for deal ${input.dealId}: ${decision.action} (utility: ${decision.utilityScore})`
    );

    // Hook: Capture vendor bid when deal reaches terminal state
    if (['ACCEPTED', 'WALKED_AWAY', 'ESCALATED'].includes(finalStatus)) {
      try {
        await captureVendorBid(deal.id);
        if (deal.requisitionId) {
          await checkAndTriggerComparison(deal.requisitionId);
        }
        logger.info(`Captured vendor bid for deal ${deal.id} with status ${finalStatus}`);
      } catch (bidError) {
        // Log but don't fail the message processing
        logger.error(`Failed to capture vendor bid: ${(bidError as Error).message}`);
      }
    }

    // Invalidate suggestions cache after new message & pre-compute for next round
    invalidateSuggestions(input.dealId).catch(() => {});
    if (finalStatus === 'NEGOTIATING' && input.userId) {
      // Pre-compute suggestions in background for instant response on next request
      precomputeSuggestionsBackground(input.dealId, input.userId, generateScenarioSuggestionsService);
    }

    return { message, accordoMessage, decision, explainability };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(
      `Failed to process vendor message: ${(error as Error).message}`,
      500
    );
  }
};

/**
 * Get deal with messages
 */
export const getDealService = async (dealId: string): Promise<DealWithMessages> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId, {
      include: [
        { model: models.Requisition, as: 'Requisition' },
        { model: models.Contract, as: 'Contract' },
        { model: models.User, as: 'User', attributes: ['id', 'name', 'email'] },
        { model: models.User, as: 'Vendor', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    const messages = await models.ChatbotMessage.findAll({
      where: { dealId },
      order: [['createdAt', 'ASC']],
    });

    return { deal, messages };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to get deal: ${(error as Error).message}`, 500);
  }
};

/**
 * List deals with filters and pagination
 */
export const listDealsService = async (
  filters: ListDealsFilters,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedDealsResponse> => {
  try {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.mode) where.mode = filters.mode;
    if (filters.userId) where.userId = filters.userId;
    if (filters.vendorId) where.vendorId = filters.vendorId;

    // Handle archived/deleted filters
    if (filters.archived === true) {
      where.archivedAt = { [Op.ne]: null };
    } else if (filters.archived === false) {
      where.archivedAt = null;
    }

    if (filters.deleted === true) {
      where.deletedAt = { [Op.ne]: null };
    } else if (filters.deleted === false) {
      where.deletedAt = null;
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await models.ChatbotDeal.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: models.Requisition, as: 'Requisition', attributes: ['id', 'subject', 'rfqId'] },
        { model: models.Contract, as: 'Contract', attributes: ['id', 'status'] },
        { model: models.User, as: 'User', attributes: ['id', 'name', 'email'] },
        { model: models.User, as: 'Vendor', attributes: ['id', 'name', 'email'] },
      ],
    });

    return {
      data: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  } catch (error) {
    throw new CustomError(`Failed to list deals: ${(error as Error).message}`, 500);
  }
};

/**
 * Reset a deal (clear messages and state)
 */
export const resetDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Delete all messages
    await models.ChatbotMessage.destroy({ where: { dealId } });

    // Reset deal state
    await deal.update({
      status: 'NEGOTIATING',
      round: 0,
      latestOfferJson: null,
      latestVendorOffer: null,
      latestDecisionAction: null,
      latestUtility: null,
      convoStateJson: deal.mode === 'CONVERSATION' ? { phase: 'GREETING', history: [] } : null,
    });

    logger.info(`Reset deal ${dealId}`);
    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to reset deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Archive a deal
 */
export const archiveDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    await deal.update({ archivedAt: new Date() });
    logger.info(`Archived deal ${dealId}`);
    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to archive deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Unarchive a deal (also clears deletedAt to fully recover)
 * Additionally auto-recovers the parent requisition if it was archived
 */
export const unarchiveDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Clear both archived and deleted flags to fully recover the deal
    await deal.update({ archivedAt: null, deletedAt: null });
    logger.info(`Unarchived deal ${dealId}`);

    // Auto-recover parent requisition if it was archived
    if (deal.requisitionId) {
      const requisition = await models.Requisition.findByPk(deal.requisitionId);
      if (requisition && requisition.archivedAt) {
        await requisition.update({ archivedAt: null });
        logger.info(`Auto-recovered parent requisition ${deal.requisitionId} after unarchiving deal ${dealId}`);
      }
    }

    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to unarchive deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Retry sending deal notification email to vendor
 * Fetches the deal and its related data, then resends the email
 */
export const retryDealEmailService = async (
  dealId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Fetch the deal with vendor information
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    // Validate required relationships exist
    if (!deal.vendorId) {
      return { success: false, error: 'Deal has no vendor attached' };
    }
    if (!deal.requisitionId) {
      return { success: false, error: 'Deal has no requisition attached' };
    }

    // Fetch vendor
    const vendor = await models.User.findByPk(deal.vendorId);
    if (!vendor || !vendor.email) {
      return { success: false, error: 'Vendor email not found' };
    }

    // Fetch requisition with details
    const requisition = await models.Requisition.findByPk(deal.requisitionId, {
      include: [
        {
          model: models.Project,
          as: 'Project',
          attributes: ['id', 'projectName'],
        },
        {
          model: models.RequisitionProduct,
          as: 'RequisitionProduct',
          include: [
            {
              model: models.Product,
              as: 'Product',
              attributes: ['id', 'productName', 'unit'],
            },
          ],
        },
      ],
    });

    if (!requisition) {
      return { success: false, error: 'Requisition not found' };
    }

    // Extract negotiation config from deal
    const config = deal.negotiationConfigJson as any;
    const wizardConfig = config?.wizardConfig;
    const priceQuantity = wizardConfig?.priceQuantity || {};
    const paymentTerms = wizardConfig?.paymentTerms;
    const delivery = wizardConfig?.delivery;
    const negotiationControl = wizardConfig?.negotiationControl;

    // Extract products from requisition
    const products = ((requisition as any).RequisitionProduct || []).map((rp: any) => ({
      name: rp.Product?.productName || 'Unknown Product',
      quantity: rp.quantity || 1,
      targetPrice: rp.targetPrice || priceQuantity.targetUnitPrice || 0,
      unit: rp.Product?.UOM || undefined,
    }));

    // Build email data
    const emailData = {
      dealId: deal.id,
      dealTitle: deal.title,
      requisitionId: deal.requisitionId!,
      rfqNumber: (requisition as any).rfqNumber || `RFQ-${deal.requisitionId}`,
      requisitionTitle: (requisition as any).title || deal.title,
      projectName: (requisition as any).Project?.projectName || 'Unknown Project',
      vendorId: deal.vendorId!,
      vendorName: vendor.name || vendor.email,
      vendorEmail: vendor.email,
      negotiationDeadline: negotiationControl?.deadline ? new Date(negotiationControl.deadline) : (requisition as any).negotiationClosureDate || undefined,
      products: products.length > 0 ? products : [{
        name: 'Products as per RFQ',
        quantity: 1,
        targetPrice: priceQuantity.targetUnitPrice || 0,
      }],
      priceConfig: {
        targetUnitPrice: priceQuantity.targetUnitPrice || 0,
        maxAcceptablePrice: priceQuantity.maxAcceptablePrice || 0,
      },
      paymentTerms: paymentTerms ? {
        minDays: paymentTerms.minDays || 30,
        maxDays: paymentTerms.maxDays || 90,
      } : undefined,
      deliveryDate: delivery?.requiredDate || undefined,
    };

    const emailStatus = await sendDealCreatedEmail(emailData);

    if (emailStatus.success) {
      logger.info(`Deal email retry successful for deal ${dealId} to vendor ${vendor.email}`);
    } else {
      logger.warn(`Deal email retry failed: ${emailStatus.error}`, { dealId, vendorEmail: vendor.email });
    }

    return emailStatus;
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`Error retrying deal email: ${errorMessage}`, { dealId });
    return { success: false, error: errorMessage };
  }
};

/**
 * Extended config response type that includes wizardConfig for display
 */
export interface ExtendedNegotiationConfig extends NegotiationConfig {
  wizardConfig?: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    priceQuantity: {
      targetUnitPrice: number;
      maxAcceptablePrice: number;
      minOrderQuantity: number;
      preferredQuantity?: number;
      volumeDiscountExpectation?: number;
    };
    paymentTerms: {
      minDays: number;
      maxDays: number;
      advancePaymentLimit?: number;
      acceptedMethods?: ('BANK_TRANSFER' | 'CREDIT' | 'LC')[];
    };
    delivery: {
      requiredDate: string;
      preferredDate?: string;
      locationId?: number;
      locationAddress?: string;
      partialDelivery: {
        allowed: boolean;
        type?: 'QUANTITY' | 'PERCENTAGE';
        minValue?: number;
      };
    };
    contractSla: {
      warrantyPeriod: string;
      defectLiabilityMonths?: number;
      lateDeliveryPenaltyPerDay: number;
      maxPenaltyCap?: {
        type: 'PERCENTAGE' | 'FIXED';
        value?: number;
      };
      qualityStandards?: string[];
    };
    negotiationControl: {
      deadline?: string | null;
      maxRounds: number;
      walkawayThreshold: number;
    };
    customParameters: Array<{
      id?: string;
      name: string;
      type: string;
      targetValue: boolean | number | string;
      flexibility: string;
      includeInNegotiation: boolean;
    }>;
  };
  parameterWeights?: Record<string, number>;
}

/**
 * Get negotiation config for a deal
 * Returns extended config with wizardConfig if available
 */
export const getDealConfigService = async (dealId: string): Promise<ExtendedNegotiationConfig> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Check if deal has stored negotiationConfigJson with wizardConfig
    const configJson = deal.negotiationConfigJson as Record<string, unknown> | null;
    if (configJson && configJson.wizardConfig) {
      // Return the full config including wizardConfig
      return {
        parameters: configJson.parameters as NegotiationConfig['parameters'],
        accept_threshold: configJson.accept_threshold as number,
        walkaway_threshold: configJson.walkaway_threshold as number,
        max_rounds: configJson.max_rounds as number,
        wizardConfig: configJson.wizardConfig as ExtendedNegotiationConfig['wizardConfig'],
        parameterWeights: configJson.parameterWeights as Record<string, number> | undefined,
      };
    }

    // Fallback: Build config from requisition or contract
    let baseConfig: NegotiationConfig;
    if (deal.requisitionId) {
      baseConfig = await buildConfigFromRequisition(deal.requisitionId);
    } else if (deal.contractId) {
      baseConfig = await buildConfigFromContract(deal.contractId);
    } else {
      // Return default config
      const { negotiationConfig } = await import('./engine/config.js');
      baseConfig = negotiationConfig;
    }

    return {
      ...baseConfig,
      wizardConfig: undefined,
      parameterWeights: undefined,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to get deal config: ${(error as Error).message}`, 500);
  }
};

/**
 * Get last explainability for a deal (from most recent message)
 */
export const getLastExplainabilityService = async (
  dealId: string
): Promise<Explainability | null> => {
  try {
    const lastMessage = await models.ChatbotMessage.findOne({
      where: { dealId, explainabilityJson: { [Op.ne]: null } },
      order: [['createdAt', 'DESC']],
    });

    return lastMessage ? (lastMessage.explainabilityJson as Explainability) : null;
  } catch (error) {
    throw new CustomError(
      `Failed to get last explainability: ${(error as Error).message}`,
      500
    );
  }
};

/**
 * Get weighted utility calculation for a deal
 * Uses parameter weights from Step 4 to calculate overall utility
 * Applies thresholds: Accept (≥70%), Escalate (30-50%), Walk Away (<30%)
 *
 * GET /api/chatbot/deals/:dealId/utility
 */
export const getDealUtilityService = async (
  dealId: string
): Promise<{
  utility: WeightedUtilityResult;
  summary: ReturnType<typeof getUtilitySummary>;
  latestOffer: ParsedVendorOffer | null;
  config: NegotiationConfig;
}> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Get the negotiation config (includes weights from Step 4)
    const config = await getDealConfigService(dealId);

    // Get the latest vendor message with extracted offer
    const latestVendorMessage = await models.ChatbotMessage.findOne({
      where: {
        dealId,
        role: 'VENDOR',
        extractedOffer: { [Op.ne]: null },
      },
      order: [['createdAt', 'DESC']],
    });

    // Parse the latest offer from the vendor message
    let latestOffer: ParsedVendorOffer | null = null;
    if (latestVendorMessage && latestVendorMessage.extractedOffer) {
      const offer = latestVendorMessage.extractedOffer as Offer;
      // Cast negotiationConfigJson for type safety
      const configJson = deal.negotiationConfigJson as Record<string, any> | null;
      latestOffer = {
        unitPrice: offer.unit_price,
        paymentTerms: offer.payment_terms,
        // Additional fields from deal config if available
        deliveryDate: configJson?.delivery?.targetDate ?? null,
        partialDelivery: configJson?.delivery?.allowPartial ?? null,
        warrantyMonths: configJson?.contractTerms?.warrantyPeriod ?? null,
        lateDeliveryPenalty: configJson?.contractTerms?.lateDeliveryPenalty ?? null,
      };
    }

    // Convert legacy config to weighted format if needed
    const weightedConfig = convertLegacyConfig({
      unit_price: config.parameters.unit_price,
      payment_terms: config.parameters.payment_terms,
      accept_threshold: config.accept_threshold,
      walkaway_threshold: config.walkaway_threshold,
      max_rounds: config.max_rounds,
    });

    // Calculate weighted utility
    const utility = calculateWeightedUtility(
      latestOffer || {},
      weightedConfig
    );

    // Generate display summary
    const summary = getUtilitySummary(utility);

    return {
      utility,
      summary,
      latestOffer,
      config,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to get deal utility: ${(error as Error).message}`, 500);
  }
};

/**
 * Create a system message (for automated responses)
 */
export const createSystemMessageService = async (
  dealId: string,
  content: string
): Promise<ChatbotMessage> => {
  try {
    const messageId = uuidv4();
    const message = await models.ChatbotMessage.create({
      id: messageId,
      dealId,
      role: 'SYSTEM',
      content,
      extractedOffer: null,
      engineDecision: null,
      decisionAction: null,
      utilityScore: null,
      counterOffer: null,
      explainabilityJson: null,
    });

    return message;
  } catch (error) {
    throw new CustomError(`Failed to create system message: ${(error as Error).message}`, 500);
  }
};

/**
 * Create a message with explicit properties
 */
export const createMessageService = async (input: {
  dealId: string;
  role: 'VENDOR' | 'ACCORDO' | 'SYSTEM';
  content: string;
  extractedOffer?: Offer | null;
  engineDecision?: Decision | null;
  decisionAction?: string | null;
  utilityScore?: number | null;
  counterOffer?: Offer | null;
  explainabilityJson?: Explainability | null;
}): Promise<ChatbotMessage> => {
  try {
    const messageId = uuidv4();
    const message = await models.ChatbotMessage.create({
      id: messageId,
      dealId: input.dealId,
      role: input.role,
      content: input.content,
      extractedOffer: input.extractedOffer || null,
      engineDecision: input.engineDecision || null,
      decisionAction: input.decisionAction || null,
      utilityScore: input.utilityScore || null,
      counterOffer: input.counterOffer || null,
      explainabilityJson: input.explainabilityJson || null,
    });

    return message;
  } catch (error) {
    throw new CustomError(`Failed to create message: ${(error as Error).message}`, 500);
  }
};

/**
 * Run full demo negotiation with autopilot vendor
 *
 * Algorithm:
 * 1. Reset deal to initial state
 * 2. Set vendor scenario policy
 * 3. Loop until terminal state (ACCEPTED, WALKED_AWAY, ESCALATED, or maxRounds):
 *    - Generate vendor message using vendorAgent
 *    - Process vendor message (extract offer)
 *    - Run decision engine
 *    - Generate Accordo response
 *    - Save both messages
 *    - Check if deal is in terminal state
 * 4. Return complete transcript with steps array
 *
 * @param dealId - Deal ID
 * @param scenario - Vendor scenario (HARD, SOFT, WALK_AWAY)
 * @param maxRounds - Maximum number of rounds (default: 10)
 * @returns Complete demo transcript
 */
export const runDemoService = async (
  dealId: string,
  scenario: 'HARD' | 'SOFT' | 'WALK_AWAY',
  maxRounds: number = 10
): Promise<{
  deal: ChatbotDeal;
  messages: ChatbotMessage[];
  steps: Array<{
    vendorMessage: ChatbotMessage;
    accordoMessage: ChatbotMessage;
    round: number;
  }>;
  finalStatus: string;
  totalRounds: number;
  finalUtility: number | null;
}> => {
  try {
    logger.info('[RunDemo] Starting demo negotiation', { dealId, scenario, maxRounds });

    // Reset deal to initial state
    const resetDeal = await resetDealService(dealId);

    // Validate deal mode is INSIGHTS
    if (resetDeal.mode !== 'INSIGHTS') {
      throw new CustomError('Run demo only works in INSIGHTS mode', 400);
    }

    // Import vendor agent (dynamic to avoid circular deps)
    const { generateVendorReply } = await import('./vendor/vendorAgent.js');

    const steps: Array<{
      vendorMessage: ChatbotMessage;
      accordoMessage: ChatbotMessage;
      round: number;
    }> = [];

    let currentRound = 0;
    let dealStatus: string = 'NEGOTIATING';
    let lastAccordoOffer: Offer | null = null;

    // Run negotiation loop
    while (
      currentRound < maxRounds &&
      dealStatus === 'NEGOTIATING'
    ) {
      logger.info('[RunDemo] Starting round', { dealId, round: currentRound, scenario });

      // Generate vendor message using vendorAgent
      const vendorReplyResult = await generateVendorReply({
        dealId,
        round: currentRound,
        lastAccordoOffer,
        scenario,
        customPolicy: undefined,
      });

      if (!vendorReplyResult.success || !vendorReplyResult.data) {
        throw new CustomError(
          vendorReplyResult.message || 'Failed to generate vendor reply',
          500
        );
      }

      const { content: vendorContent, offer: vendorOffer } = vendorReplyResult.data;

      // Save vendor message
      const vendorMessage = await createMessageService({
        dealId,
        role: 'VENDOR',
        content: vendorContent,
        extractedOffer: vendorOffer as Offer,
      });

      logger.info('[RunDemo] Vendor message generated', {
        dealId,
        round: currentRound,
        messageId: vendorMessage.id,
        offer: vendorOffer,
      });

      // Process vendor message through decision engine
      const processResult = await processVendorMessageService({
        dealId,
        content: vendorContent,
        role: 'VENDOR',
        userId: 0, // System user for autopilot
      });

      const { accordoMessage, decision } = processResult;

      logger.info('[RunDemo] Accordo message generated', {
        dealId,
        round: currentRound,
        messageId: accordoMessage.id,
        decision: decision.action,
      });

      // Add step to transcript
      steps.push({
        vendorMessage,
        accordoMessage,
        round: currentRound,
      });

      // Update last Accordo offer for next round
      lastAccordoOffer = accordoMessage.counterOffer as Offer | null;

      // Check terminal state
      const updatedDeal = await models.ChatbotDeal.findByPk(dealId);
      if (!updatedDeal) {
        throw new CustomError('Deal not found after processing', 500);
      }

      dealStatus = updatedDeal.status;

      if (
        dealStatus === 'ACCEPTED' ||
        dealStatus === 'WALKED_AWAY' ||
        dealStatus === 'ESCALATED'
      ) {
        logger.info('[RunDemo] Demo completed with terminal state', {
          dealId,
          status: dealStatus,
          round: currentRound,
        });
        break;
      }

      currentRound++;
    }

    // If maxRounds reached without terminal state, set status to ESCALATED
    if (currentRound >= maxRounds && dealStatus === 'NEGOTIATING') {
      await models.ChatbotDeal.update(
        { status: 'ESCALATED' },
        { where: { id: dealId } }
      );

      await createSystemMessageService(
        dealId,
        `Maximum rounds (${maxRounds}) reached. Deal escalated to human.`
      );

      dealStatus = 'ESCALATED';
      logger.info('[RunDemo] Max rounds reached, deal escalated', {
        dealId,
        maxRounds,
      });
    }

    // Get final deal state and all messages
    const finalDealData = await getDealService(dealId);
    const { deal, messages } = finalDealData;

    logger.info('[RunDemo] Demo negotiation completed', {
      dealId,
      scenario,
      totalRounds: currentRound,
      finalStatus: deal.status,
      finalUtility: deal.latestUtility,
    });

    return {
      deal,
      messages,
      steps,
      finalStatus: deal.status,
      totalRounds: currentRound,
      finalUtility: deal.latestUtility,
    };
  } catch (error) {
    logger.error('[RunDemo] Failed to run demo negotiation', {
      dealId,
      scenario,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      `Failed to run demo: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Resume an escalated deal
 *
 * Changes status from ESCALATED back to NEGOTIATING and adds a system message.
 *
 * @param dealId - Deal ID
 * @returns Updated deal
 */
export const resumeDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    if (deal.status !== 'ESCALATED') {
      throw new CustomError('Only ESCALATED deals can be resumed', 400);
    }

    // Update deal status
    deal.status = 'NEGOTIATING';
    await deal.save();

    // Add system message
    await createSystemMessageService(dealId, 'Deal resumed by human negotiator.');

    logger.info('[ResumeService] Deal resumed', { dealId, status: deal.status });

    return deal;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      `Failed to resume deal: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Generate AI-powered scenario suggestions
 *
 * Analyzes the conversation history and negotiation context to generate
 * contextually relevant counter-offer suggestions for each scenario type.
 *
 * @param dealId - The deal UUID
 * @returns Object with scenario suggestions: { HARD: [...], MEDIUM: [...], SOFT: [...], WALK_AWAY: [...] }
 */
export const generateScenarioSuggestionsService = async (
  dealId: string,
  userId: number
): Promise<Record<string, string[]>> => {
  try {
    // Check cache first for instant response
    const deal = await models.ChatbotDeal.findOne({
      where: { id: dealId },
      attributes: ['id', 'round'],
    });

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    const cachedResult = await getCachedSuggestions(dealId, deal.round);
    if (cachedResult) {
      logger.info('[ScenarioSuggestions] Returning cached suggestions', {
        dealId,
        round: deal.round,
        source: cachedResult.source,
      });
      return cachedResult.suggestions;
    }

    // Get deal with messages and config (full fetch for generation)
    const dealWithMessages = await models.ChatbotDeal.findOne({
      where: { id: dealId },
      include: [
        {
          model: models.ChatbotMessage,
          as: 'Messages',
          where: { role: { [Op.in]: ['VENDOR', 'ACCORDO'] } },
          required: false,
          order: [['createdAt', 'ASC']],
        },
      ],
    });

    if (!dealWithMessages) {
      throw new CustomError('Deal not found', 404);
    }

    // Get negotiation config
    const config = dealWithMessages.negotiationConfigJson as NegotiationConfig;
    if (!config) {
      throw new CustomError('Deal has no negotiation config', 400);
    }

    // Get last vendor message for context
    const messages = (dealWithMessages as any).Messages || [];
    const lastVendorMessage = messages.filter((m: ChatbotMessage) => m.role === 'VENDOR').pop();

    // Build conversation context
    const conversationContext = messages
      .map((m: ChatbotMessage) => `${m.role}: ${m.content}`)
      .join('\n');

    // Extract config values with fallbacks
    const priceConfig = config.parameters?.unit_price || { anchor: 100, target: 90, max_acceptable: 120, concession_step: 2 };
    const termsConfig = config.parameters?.payment_terms || { options: ['Net 30', 'Net 60', 'Net 90'] as const };
    const idealTerms = termsConfig.options?.[0] || 'Net 30';
    const acceptableTerms = termsConfig.options?.[1] || 'Net 60';

    // Generate suggestions using LLM
    const prompt = `You are a procurement negotiation assistant. Analyze this negotiation and generate 4 counter-offer suggestions for each scenario type.

NEGOTIATION CONTEXT:
Deal: ${dealWithMessages.title}
Current Round: ${dealWithMessages.round}
Status: ${dealWithMessages.status}

NEGOTIATION CONFIG:
Target Price: $${priceConfig.target}
Min Price: $${priceConfig.anchor}
Max Price: $${priceConfig.max_acceptable}
Ideal Payment Terms: ${idealTerms}
Acceptable Payment Terms: ${acceptableTerms}

CONVERSATION HISTORY:
${conversationContext || 'No messages yet'}

LAST VENDOR MESSAGE:
${lastVendorMessage ? lastVendorMessage.content : 'None'}

Generate 4 counter-offer suggestions for EACH of these scenarios:
1. HARD: Aggressive, push for best price, short payment terms
2. MEDIUM: Balanced approach, reasonable price, moderate terms
3. SOFT: Flexible, focus on relationship, longer terms acceptable
4. WALK_AWAY: Unreasonable offers that signal walking away

Format your response as JSON only (no markdown, no explanation):
{
  "HARD": ["offer1", "offer2", "offer3", "offer4"],
  "MEDIUM": ["offer1", "offer2", "offer3", "offer4"],
  "SOFT": ["offer1", "offer2", "offer3", "offer4"],
  "WALK_AWAY": ["offer1", "offer2", "offer3", "offer4"]
}

Each offer should be a short message (under 50 chars) like "We can do $92 Net 30" or "Best I can offer is $88 Net 60".`;

    // Parse LLM response
    let suggestions: Record<string, string[]>;
    let generationSource: 'llm' | 'fallback' = 'llm';

    // Fast timeout for instant response (500ms)
    const SUGGESTION_TIMEOUT_MS = 500;

    // Generate instant fallback suggestions (used if LLM is slow or fails)
    const generateFallbackSuggestions = (): Record<string, string[]> => ({
      HARD: [
        `We can do $${priceConfig.anchor} ${idealTerms}`,
        `Best I can offer is $${priceConfig.anchor + 2} ${idealTerms}`,
        `Final: $${priceConfig.anchor + 5} ${idealTerms}`,
        `Absolute limit: $${priceConfig.anchor + 8} ${idealTerms}`,
      ],
      MEDIUM: [
        `We can do $${priceConfig.target - 5} ${acceptableTerms}`,
        `How about $${priceConfig.target - 8} ${acceptableTerms}?`,
        `We're open to $${priceConfig.target - 12} Net 90`,
        `Final offer: $${priceConfig.target - 15} Net 90`,
      ],
      SOFT: [
        `We can do $${priceConfig.target} ${acceptableTerms}`,
        `How about $${priceConfig.target - 2} Net 90?`,
        `We're willing to go to $${priceConfig.target - 5} Net 90`,
        `Final offer: $${priceConfig.target - 8} Net 90`,
      ],
      WALK_AWAY: [
        `We can do $${priceConfig.max_acceptable} ${idealTerms}`,
        `Best I can offer is $${priceConfig.max_acceptable - 2} ${idealTerms}`,
        `Our final offer is $${priceConfig.max_acceptable + 10} ${idealTerms} - take it or leave it`,
        `Sorry, we can't go lower than $${priceConfig.max_acceptable + 10}`,
      ],
    });

    // LLM generation promise
    const llmGenerationPromise = async (): Promise<Record<string, string[]>> => {
      const llmResponse = await chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.7, maxTokens: 500 }  // Reduced from 1000
      );
      // Clean response - remove markdown code blocks if present
      const cleanedResponse = llmResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedResponse);
    };

    // Timeout promise that returns fallback after 500ms
    const timeoutPromise = new Promise<Record<string, string[]>>((resolve) => {
      setTimeout(() => {
        logger.info('[ScenarioSuggestions] LLM timeout reached, using instant fallback', {
          dealId,
          timeoutMs: SUGGESTION_TIMEOUT_MS
        });
        resolve(generateFallbackSuggestions());
      }, SUGGESTION_TIMEOUT_MS);
    });

    // Race between LLM and timeout - whoever finishes first wins
    const startTime = Date.now();
    try {
      suggestions = await Promise.race([
        llmGenerationPromise(),
        timeoutPromise,
      ]);

      const elapsedMs = Date.now() - startTime;

      // Determine if we got LLM or fallback based on timing
      if (elapsedMs < SUGGESTION_TIMEOUT_MS) {
        logger.info('[ScenarioSuggestions] LLM responded within timeout', {
          dealId,
          elapsedMs
        });
      } else {
        generationSource = 'fallback';
        logger.info('[ScenarioSuggestions] Using fallback (timeout triggered)', {
          dealId,
          elapsedMs
        });
      }
    } catch (llmOrParseError) {
      logger.warn('[ScenarioSuggestions] LLM error, using fallback suggestions', {
        dealId,
        error: llmOrParseError instanceof Error ? llmOrParseError.message : String(llmOrParseError),
      });

      generationSource = 'fallback';
      suggestions = generateFallbackSuggestions();
    }

    logger.info('[ScenarioSuggestions] Generated suggestions', { dealId, round: dealWithMessages.round });

    // Cache the suggestions for future requests
    await cacheSuggestions(dealId, dealWithMessages.round, suggestions, generationSource);

    // Log to training data for future LLM fine-tuning (non-blocking)
    setImmediate(async () => {
      try {
        await models.NegotiationTrainingData.create({
          dealId: dealWithMessages.id,
          userId,
          round: dealWithMessages.round,
          suggestionsJson: suggestions,
          conversationContext,
          configSnapshot: config,
          llmModel: process.env.LLM_MODEL || 'llama3.1',
          generationSource,
        });

        logger.info('[ScenarioSuggestions] Training data logged', {
          dealId,
          round: dealWithMessages.round,
          generationSource
        });
      } catch (loggingError) {
        // Don't fail the request if logging fails
        logger.error('[ScenarioSuggestions] Failed to log training data', {
          dealId,
          error: loggingError,
        });
      }
    });

    return suggestions;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    throw new CustomError(
      `Failed to generate scenario suggestions: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

// ==================== REQUISITION-BASED DEAL QUERIES ====================

/**
 * Response type for requisitions with deal statistics
 */
export interface RequisitionWithDeals {
  id: number;
  rfqNumber: string;
  title: string;
  projectId: number;
  projectName: string;
  estimatedValue: number | null;
  deadline: string | null;
  createdAt: string;

  // Aggregated stats
  vendorCount: number;
  activeDeals: number;
  completedDeals: number;

  // Status breakdown
  statusCounts: {
    negotiating: number;
    accepted: number;
    walkedAway: number;
    escalated: number;
  };

  // Progress
  completionPercentage: number;
  lastActivityAt: string | null;
}

/**
 * Response type for vendor deal summary
 */
export interface VendorDealSummary {
  dealId: string;
  vendorId: number;
  vendorName: string;
  vendorEmail: string;
  companyName: string | null;

  status: 'NEGOTIATING' | 'ACCEPTED' | 'WALKED_AWAY' | 'ESCALATED';
  currentRound: number;
  maxRounds: number;

  latestOffer: {
    unitPrice: number | null;
    paymentTerms: string | null;
  } | null;

  utilityScore: number | null;
  lastActivityAt: string | null;
  completedAt: string | null;
}

/**
 * Filters for requisitions with deals query
 */
export interface RequisitionsWithDealsFilters {
  projectId?: number;
  status?: 'all' | 'has_active' | 'all_completed';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'recent_activity' | 'estimated_value' | 'vendor_count' | 'deadline';
  archived?: 'active' | 'archived' | 'all';
}

/**
 * Get all requisitions that have associated deals with aggregated statistics
 */
export const getRequisitionsWithDealsService = async (
  filters: RequisitionsWithDealsFilters = {},
  page: number = 1,
  limit: number = 10
): Promise<{ data: RequisitionWithDeals[]; total: number; page: number; totalPages: number }> => {
  try {
    // First, get all requisition IDs that have deals
    const requisitionIdsWithDeals = await models.ChatbotDeal.findAll({
      attributes: ['requisitionId'],
      where: {
        requisitionId: { [Op.ne]: null },
        deletedAt: null,
      },
      group: ['requisitionId'],
      raw: true,
    });

    const requisitionIds = requisitionIdsWithDeals.map((d: any) => d.requisitionId);

    if (requisitionIds.length === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }

    // Build where clause for requisitions
    const whereClause: any = {
      id: { [Op.in]: requisitionIds },
    };

    if (filters.projectId) {
      whereClause.projectId = filters.projectId;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt[Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.createdAt[Op.lte] = new Date(filters.dateTo);
      }
    }

    // Apply archived filter
    if (filters.archived === 'active') {
      whereClause.archivedAt = null;
    } else if (filters.archived === 'archived') {
      whereClause.archivedAt = { [Op.ne]: null };
    }
    // If 'all', no filter on archivedAt

    // Get requisitions with project info
    const { count: total, rows: requisitions } = await models.Requisition.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.Project,
          as: 'Project',
          attributes: ['id', 'projectName'],
        },
      ],
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
    });

    // Get deal statistics for each requisition
    const result: RequisitionWithDeals[] = [];

    for (const requisition of requisitions) {
      // Get deals for this requisition
      const deals = await models.ChatbotDeal.findAll({
        where: {
          requisitionId: requisition.id,
          deletedAt: null,
        },
        include: [
          {
            model: models.User,
            as: 'Vendor',
            attributes: ['id', 'name', 'email'],
          },
        ],
        order: [['lastMessageAt', 'DESC']],
      });

      // Calculate statistics
      const statusCounts = {
        negotiating: 0,
        accepted: 0,
        walkedAway: 0,
        escalated: 0,
      };

      let lastActivityAt: Date | null = null;

      for (const deal of deals) {
        switch (deal.status) {
          case 'NEGOTIATING':
            statusCounts.negotiating++;
            break;
          case 'ACCEPTED':
            statusCounts.accepted++;
            break;
          case 'WALKED_AWAY':
            statusCounts.walkedAway++;
            break;
          case 'ESCALATED':
            statusCounts.escalated++;
            break;
        }

        if (deal.lastMessageAt && (!lastActivityAt || deal.lastMessageAt > lastActivityAt)) {
          lastActivityAt = deal.lastMessageAt;
        }
      }

      const vendorCount = deals.length;
      const completedDeals = statusCounts.accepted + statusCounts.walkedAway + statusCounts.escalated;
      const activeDeals = statusCounts.negotiating;
      const completionPercentage = vendorCount > 0 ? Math.round((completedDeals / vendorCount) * 100) : 0;

      // Apply status filter
      if (filters.status === 'has_active' && activeDeals === 0) {
        continue;
      }
      if (filters.status === 'all_completed' && activeDeals > 0) {
        continue;
      }

      result.push({
        id: requisition.id,
        rfqNumber: requisition.rfqId || `RFQ${requisition.id}`,
        title: requisition.subject || 'Untitled Requisition',
        projectId: requisition.projectId,
        projectName: (requisition as any).Project?.projectName || 'Unknown Project',
        estimatedValue: requisition.totalPrice || requisition.totalEstimatedAmount as number | null,
        deadline: requisition.negotiationClosureDate?.toISOString() || null,
        createdAt: requisition.createdAt.toISOString(),
        vendorCount,
        activeDeals,
        completedDeals,
        statusCounts,
        completionPercentage,
        lastActivityAt: lastActivityAt?.toISOString() || null,
      });
    }

    // Apply sorting
    if (filters.sortBy === 'recent_activity') {
      result.sort((a, b) => {
        if (!a.lastActivityAt && !b.lastActivityAt) return 0;
        if (!a.lastActivityAt) return 1;
        if (!b.lastActivityAt) return -1;
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      });
    } else if (filters.sortBy === 'estimated_value') {
      result.sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0));
    } else if (filters.sortBy === 'vendor_count') {
      result.sort((a, b) => b.vendorCount - a.vendorCount);
    } else if (filters.sortBy === 'deadline') {
      result.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    }

    return {
      data: result,
      total: result.length,
      page,
      totalPages: Math.ceil(result.length / limit),
    };
  } catch (error) {
    logger.error('[getRequisitionsWithDeals] Error:', error);
    throw new CustomError(
      `Failed to get requisitions with deals: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Get all vendor deals for a specific requisition
 */
export const getRequisitionDealsService = async (
  requisitionId: number,
  filters: { status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; archived?: 'active' | 'archived' | 'all' } = {}
): Promise<{
  requisition: RequisitionWithDeals;
  deals: VendorDealSummary[];
}> => {
  try {
    // Get requisition with project
    const requisition = await models.Requisition.findByPk(requisitionId, {
      include: [
        {
          model: models.Project,
          as: 'Project',
          attributes: ['id', 'projectName'],
        },
      ],
    });

    if (!requisition) {
      throw new CustomError('Requisition not found', 404);
    }

    // Build where clause for deals
    const whereClause: any = {
      requisitionId,
      deletedAt: null,
    };

    if (filters.status && filters.status !== 'all') {
      whereClause.status = filters.status.toUpperCase();
    }

    // Apply archived filter
    if (filters.archived === 'active') {
      whereClause.archivedAt = null;
    } else if (filters.archived === 'archived') {
      whereClause.archivedAt = { [Op.ne]: null };
    }
    // If 'all', no filter on archivedAt

    // Get all deals for this requisition with vendor info and messages (for utility score fallback)
    // Note: User model doesn't have direct association to VendorCompany
    // So we only include basic User info and Company if available
    const deals = await models.ChatbotDeal.findAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'Vendor',
          attributes: ['id', 'name', 'email'],
          include: [
            {
              model: models.Company,
              as: 'Company',
              attributes: ['id', 'companyName'],
              required: false,
            },
          ],
        },
        {
          model: models.ChatbotMessage,
          as: 'Messages',
          attributes: ['id', 'role', 'utilityScore', 'extractedOffer', 'createdAt'],
          order: [['createdAt', 'ASC']],
        },
      ],
      order: [['lastMessageAt', 'DESC']],
    });

    logger.debug('[getRequisitionDealsService] Found deals', {
      count: deals.length,
      deals: deals.map(d => ({ id: d.id, archivedAt: d.archivedAt })),
    });

    // Calculate requisition statistics
    const statusCounts = {
      negotiating: 0,
      accepted: 0,
      walkedAway: 0,
      escalated: 0,
    };

    let lastActivityAt: Date | null = null;

    const vendorDeals: VendorDealSummary[] = [];

    for (const deal of deals) {
      // Count statuses
      switch (deal.status) {
        case 'NEGOTIATING':
          statusCounts.negotiating++;
          break;
        case 'ACCEPTED':
          statusCounts.accepted++;
          break;
        case 'WALKED_AWAY':
          statusCounts.walkedAway++;
          break;
        case 'ESCALATED':
          statusCounts.escalated++;
          break;
      }

      if (deal.lastMessageAt && (!lastActivityAt || deal.lastMessageAt > lastActivityAt)) {
        lastActivityAt = deal.lastMessageAt;
      }

      // Get max rounds from config
      let maxRounds = 10;
      if (deal.negotiationConfigJson) {
        const config = deal.negotiationConfigJson as any;
        maxRounds = config.max_rounds || config.negotiationControl?.maxRounds || 10;
      }

      // Get messages for this deal to extract utility score and offer
      const messages = (deal.Messages || []) as any[];

      // Find the last Accordo message with utility score
      const lastAccordoMessage = [...messages].reverse().find(
        (m) => m.role === 'ACCORDO' && m.utilityScore
      );

      // Find the last vendor message with extracted offer
      const lastVendorMessage = [...messages].reverse().find(
        (m) => m.role === 'VENDOR' && m.extractedOffer
      );

      // Parse latest offer - try messages first, then fall back to deal-level data
      let latestOffer: { unitPrice: number | null; paymentTerms: string | null } | null = null;

      if (lastVendorMessage?.extractedOffer) {
        const offer = lastVendorMessage.extractedOffer as any;
        latestOffer = {
          unitPrice: offer?.price || offer?.unit_price || offer?.unitPrice || null,
          paymentTerms: offer?.paymentTerms || offer?.payment_terms || null,
        };
      } else if (deal.latestOfferJson || deal.latestVendorOffer) {
        const offer = (deal.latestOfferJson || deal.latestVendorOffer) as any;
        latestOffer = {
          unitPrice: offer?.price || offer?.unit_price || offer?.unitPrice || null,
          paymentTerms: offer?.payment_terms || offer?.paymentTerms || null,
        };
      }

      // Get utility score - try messages first, then fall back to deal-level data
      let utilityScore: number | null = deal.latestUtility ? Number(deal.latestUtility) : null;
      if (!utilityScore && lastAccordoMessage?.utilityScore) {
        utilityScore = Number(lastAccordoMessage.utilityScore);
      }

      // Get vendor info
      const vendor = deal.Vendor as any;
      const companyName = vendor?.Company?.companyName || null;

      vendorDeals.push({
        dealId: deal.id,
        vendorId: deal.vendorId || 0,
        vendorName: vendor?.name || deal.counterparty || 'Unknown Vendor',
        vendorEmail: vendor?.email || '',
        companyName,
        status: deal.status,
        currentRound: deal.round,
        maxRounds,
        latestOffer,
        utilityScore,
        lastActivityAt: deal.lastMessageAt?.toISOString() || null,
        completedAt: deal.status !== 'NEGOTIATING' ? deal.updatedAt.toISOString() : null,
      });
    }

    // Apply sorting with sortOrder support
    const isDescending = filters.sortOrder === 'desc';
    const sortMultiplier = isDescending ? -1 : 1;

    if (filters.sortBy === 'utilityScore' || filters.sortBy === 'utility_score') {
      // Sort by utility score
      vendorDeals.sort((a, b) => {
        const scoreA = a.utilityScore || 0;
        const scoreB = b.utilityScore || 0;
        return (scoreA - scoreB) * sortMultiplier;
      });
    } else if (filters.sortBy === 'lastActivity' || filters.sortBy === 'last_activity') {
      // Sort by last activity
      vendorDeals.sort((a, b) => {
        if (!a.lastActivityAt && !b.lastActivityAt) return 0;
        if (!a.lastActivityAt) return sortMultiplier;
        if (!b.lastActivityAt) return -sortMultiplier;
        const dateA = new Date(a.lastActivityAt).getTime();
        const dateB = new Date(b.lastActivityAt).getTime();
        return (dateA - dateB) * sortMultiplier;
      });
    } else if (filters.sortBy === 'vendorName' || filters.sortBy === 'vendor_name') {
      // Sort by vendor name alphabetically
      vendorDeals.sort((a, b) => {
        const nameA = (a.vendorName || '').toLowerCase();
        const nameB = (b.vendorName || '').toLowerCase();
        return nameA.localeCompare(nameB) * sortMultiplier;
      });
    } else {
      // Default: status priority (NEGOTIATING first, then ACCEPTED, ESCALATED, WALKED_AWAY)
      // For status sorting: asc = active first, desc = completed first
      const statusPriority: Record<string, number> = {
        NEGOTIATING: 0,
        ACCEPTED: 1,
        ESCALATED: 2,
        WALKED_AWAY: 3,
      };
      vendorDeals.sort((a, b) => {
        const priorityA = statusPriority[a.status] ?? 99;
        const priorityB = statusPriority[b.status] ?? 99;
        return (priorityA - priorityB) * sortMultiplier;
      });
    }

    const vendorCount = deals.length;
    const completedDeals = statusCounts.accepted + statusCounts.walkedAway + statusCounts.escalated;
    const activeDeals = statusCounts.negotiating;
    const completionPercentage = vendorCount > 0 ? Math.round((completedDeals / vendorCount) * 100) : 0;

    const requisitionWithDeals: RequisitionWithDeals = {
      id: requisition.id,
      rfqNumber: requisition.rfqId || `RFQ${requisition.id}`,
      title: requisition.subject || 'Untitled Requisition',
      projectId: requisition.projectId,
      projectName: (requisition as any).Project?.projectName || 'Unknown Project',
      estimatedValue: requisition.totalPrice || requisition.totalEstimatedAmount as number | null,
      deadline: requisition.negotiationClosureDate?.toISOString() || null,
      createdAt: requisition.createdAt.toISOString(),
      vendorCount,
      activeDeals,
      completedDeals,
      statusCounts,
      completionPercentage,
      lastActivityAt: lastActivityAt?.toISOString() || null,
    };

    return {
      requisition: requisitionWithDeals,
      deals: vendorDeals,
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    logger.error('[getRequisitionDeals] Error:', error);
    throw new CustomError(
      `Failed to get requisition deals: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};
/**
 * Archive a requisition and cascade to all its deals
 */
export const archiveRequisitionService = async (
  requisitionId: number
): Promise<{ requisition: any; archivedDealsCount: number }> => {
  const transaction = await sequelize.transaction();
  try {
    const requisition = await models.Requisition.findByPk(requisitionId);
    if (!requisition) {
      throw new CustomError('Requisition not found', 404);
    }
    if (requisition.archivedAt) {
      throw new CustomError('Requisition is already archived', 400);
    }

    await requisition.update({ archivedAt: new Date() }, { transaction });

    // Cascade: Archive all deals under this requisition
    const [archivedDealsCount] = await models.ChatbotDeal.update(
      { archivedAt: new Date() },
      {
        where: { requisitionId, archivedAt: null },
        transaction
      }
    );

    await transaction.commit();
    logger.info(`[archiveRequisition] Archived requisition ${requisitionId} and ${archivedDealsCount} deals`);
    return { requisition, archivedDealsCount };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof CustomError) throw error;
    logger.error('[archiveRequisition] Error:', error);
    throw new CustomError(`Failed to archive requisition: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
};

/**
 * Unarchive a requisition and optionally unarchive all its deals
 */
export const unarchiveRequisitionService = async (
  requisitionId: number,
  unarchiveDeals: boolean = true
): Promise<{ requisition: any; unarchivedDealsCount: number }> => {
  const transaction = await sequelize.transaction();
  try {
    const requisition = await models.Requisition.findByPk(requisitionId);
    if (!requisition) {
      throw new CustomError('Requisition not found', 404);
    }
    if (!requisition.archivedAt) {
      throw new CustomError('Requisition is not archived', 400);
    }

    await requisition.update({ archivedAt: null }, { transaction });

    let unarchivedDealsCount = 0;
    if (unarchiveDeals) {
      [unarchivedDealsCount] = await models.ChatbotDeal.update(
        { archivedAt: null },
        {
          where: { requisitionId, archivedAt: { [Op.ne]: null } },
          transaction
        }
      );
    }

    await transaction.commit();
    logger.info(`[unarchiveRequisition] Unarchived requisition ${requisitionId} and ${unarchivedDealsCount} deals`);
    return { requisition, unarchivedDealsCount };
  } catch (error) {
    await transaction.rollback();
    if (error instanceof CustomError) throw error;
    logger.error('[unarchiveRequisition] Error:', error);
    throw new CustomError(`Failed to unarchive requisition: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
};

/**
 * Response type for deal summary (used in modal)
 */
export interface DealSummaryResponse {
  deal: {
    id: string;
    title: string;
    status: string;
    mode: string;
    vendorName: string;
    vendorEmail: string;
    companyName: string | null;
  };
  finalOffer: {
    unitPrice: number | null;
    paymentTerms: string | null;
    totalValue: number | null;
    deliveryDate: string | null;
  };
  metrics: {
    utilityScore: number | null;
    totalRounds: number;
    maxRounds: number;
    startedAt: string;
    completedAt: string | null;
    durationDays: number | null;
  };
  timeline: Array<{
    round: number;
    vendorOffer: string;
    accordoResponse: string;
    action: string;
  }>;
  chatPreview: string[];
}

/**
 * Get detailed deal summary for completed deals
 */
export const getDealSummaryService = async (dealId: string): Promise<DealSummaryResponse> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId, {
      include: [
        {
          model: models.User,
          as: 'Vendor',
          attributes: ['id', 'name', 'email'],
          include: [
            {
              model: models.Company,
              as: 'Company',
              attributes: ['companyName'],
              required: false,
            },
          ],
        },
        {
          model: models.ChatbotMessage,
          as: 'Messages',
          order: [['createdAt', 'ASC']],
        },
        {
          model: models.Requisition,
          as: 'Requisition',
          attributes: ['id'],
          include: [
            {
              model: models.RequisitionProduct,
              as: 'RequisitionProduct',
              attributes: ['qty', 'targetPrice'],
            },
          ],
          required: false,
        },
      ],
    });

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    const vendor = deal.Vendor as any;
    const messages = (deal.Messages || []) as ChatbotMessage[];

    // Parse final offer from messages (the actual data is stored in chatbot_messages)
    let finalOffer = {
      unitPrice: null as number | null,
      paymentTerms: null as string | null,
      totalValue: null as number | null,
      deliveryDate: null as string | null,
    };

    // Get the last vendor message with extracted_offer for final agreed terms
    // Or the last Accordo message with counter_offer if deal was accepted
    const lastVendorMessage = [...messages].reverse().find(
      (m) => m.role === 'VENDOR' && m.extractedOffer
    );
    const lastAccordoMessage = [...messages].reverse().find(
      (m) => m.role === 'ACCORDO' && (m.counterOffer || m.utilityScore)
    );

    // For ACCEPTED deals, the final offer is the last vendor's offer that was accepted
    // For other statuses, show the last known offer
    if (lastVendorMessage?.extractedOffer) {
      const offer = lastVendorMessage.extractedOffer as any;
      finalOffer.unitPrice = offer?.price || offer?.unit_price || offer?.unitPrice || null;
      finalOffer.paymentTerms = offer?.paymentTerms || offer?.payment_terms || null;
      // Convert deliveryDays to a date if we have it
      if (offer?.deliveryDays) {
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + offer.deliveryDays);
        finalOffer.deliveryDate = deliveryDate.toISOString();
      }
    }

    // Fallback to deal-level data if messages don't have the offer
    if (!finalOffer.unitPrice && (deal.latestOfferJson || deal.latestVendorOffer)) {
      const offer = (deal.latestOfferJson || deal.latestVendorOffer) as any;
      finalOffer.unitPrice = offer?.price || offer?.unit_price || offer?.unitPrice || null;
      finalOffer.paymentTerms = offer?.payment_terms || offer?.paymentTerms || null;
    }

    // Get delivery date from config if not found in offer
    if (!finalOffer.deliveryDate && deal.negotiationConfigJson) {
      const config = deal.negotiationConfigJson as any;
      finalOffer.deliveryDate = config.delivery?.requiredDate || null;
    }

    // Get utility score from the last Accordo message
    let latestUtility = deal.latestUtility ? Number(deal.latestUtility) : null;
    if (!latestUtility && lastAccordoMessage?.utilityScore) {
      latestUtility = Number(lastAccordoMessage.utilityScore);
    }

    // Calculate total value from RequisitionProducts quantity
    if (finalOffer.unitPrice) {
      let totalQuantity = 1; // Default quantity

      // Get total quantity from RequisitionProduct (the actual source of truth)
      const requisition = deal.Requisition as any;
      if (requisition?.RequisitionProduct?.length > 0) {
        totalQuantity = requisition.RequisitionProduct.reduce(
          (sum: number, product: any) => sum + (product.qty || 0),
          0
        );
      }

      // Fallback: Try to get quantity from negotiation config
      if (totalQuantity <= 1 && deal.negotiationConfigJson) {
        const config = deal.negotiationConfigJson as any;
        totalQuantity = config.priceQuantity?.preferredQuantity ||
                        config.priceQuantity?.minOrderQuantity ||
                        config.quantity ||
                        1;
      }

      // Fallback: Try to get quantity from the offer itself
      if (totalQuantity <= 1) {
        const offer = lastVendorMessage?.extractedOffer as any;
        if (offer?.quantity) {
          totalQuantity = offer.quantity;
        }
      }

      finalOffer.totalValue = finalOffer.unitPrice * totalQuantity;
    }

    // Get max rounds from config
    let maxRounds = 10;
    if (deal.negotiationConfigJson) {
      const config = deal.negotiationConfigJson as any;
      maxRounds = config.max_rounds || config.negotiationControl?.maxRounds || 10;
    }

    // Calculate duration
    let durationDays: number | null = null;
    if (deal.status !== 'NEGOTIATING') {
      const startDate = new Date(deal.createdAt);
      const endDate = new Date(deal.updatedAt);
      durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Build timeline from messages
    const timeline: Array<{
      round: number;
      vendorOffer: string;
      accordoResponse: string;
      action: string;
    }> = [];

    let currentRound = 0;
    let vendorOffer = '';
    let accordoResponse = '';
    let action = '';

    for (const message of messages) {
      if (message.role === 'VENDOR') {
        // Start new round
        if (vendorOffer && accordoResponse) {
          timeline.push({ round: currentRound, vendorOffer, accordoResponse, action });
        }
        currentRound++;
        vendorOffer = message.content; // Return full message content
        accordoResponse = '';
        action = '';
      } else if (message.role === 'ACCORDO') {
        accordoResponse = message.content; // Return full message content
        action = message.decisionAction || '';
      }
    }

    // Add final round
    if (vendorOffer) {
      timeline.push({ round: currentRound, vendorOffer, accordoResponse, action });
    }

    // Get last few messages for preview
    const chatPreview = messages
      .slice(-5)
      .map((m) => `${m.role}: ${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}`);

    return {
      deal: {
        id: deal.id,
        title: deal.title,
        status: deal.status,
        mode: deal.mode,
        vendorName: vendor?.name || deal.counterparty || 'Unknown Vendor',
        vendorEmail: vendor?.email || '',
        companyName: vendor?.Company?.companyName || null,
      },
      finalOffer,
      metrics: {
        utilityScore: latestUtility,
        totalRounds: deal.round,
        maxRounds,
        startedAt: deal.createdAt.toISOString(),
        completedAt: deal.status !== 'NEGOTIATING' ? deal.updatedAt.toISOString() : null,
        durationDays,
      },
      timeline,
      chatPreview,
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    logger.error('[getDealSummary] Error:', error);
    throw new CustomError(
      `Failed to get deal summary: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Export deal summary as PDF
 * Generates a comprehensive PDF report with analytics, timeline, and chat transcript
 */
export const exportDealPDFService = async (
  dealId: string,
  rfqId: number
): Promise<{ data: Buffer; filename: string }> => {
  try {
    logger.info('[exportDealPDF] Generating PDF for deal:', { dealId, rfqId });

    // Get deal summary data
    const summary = await getDealSummaryService(dealId);

    // Get full message list for transcript
    const deal = await models.ChatbotDeal.findByPk(dealId, {
      include: [
        {
          model: models.ChatbotMessage,
          as: 'Messages',
          order: [['createdAt', 'ASC']],
        },
      ],
    });

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    const messages = (deal.Messages || []) as ChatbotMessage[];

    // Extract price data from timeline for charts
    const timelineWithPrices = summary.timeline.map((item) => {
      let vendorPrice: number | null = null;
      let accordoPrice: number | null = null;

      // Try to extract prices from messages
      const vendorMatch = item.vendorOffer.match(/\$[\d,]+(?:\.\d{2})?/);
      if (vendorMatch) {
        vendorPrice = parseFloat(vendorMatch[0].replace(/[$,]/g, ''));
      }

      const accordoMatch = item.accordoResponse.match(/\$[\d,]+(?:\.\d{2})?/);
      if (accordoMatch) {
        accordoPrice = parseFloat(accordoMatch[0].replace(/[$,]/g, ''));
      }

      return {
        ...item,
        vendorPrice,
        accordoPrice,
      };
    });

    // Prepare PDF input
    const pdfInput: DealSummaryPDFInput = {
      deal: summary.deal,
      finalOffer: summary.finalOffer,
      metrics: summary.metrics,
      timeline: timelineWithPrices,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        extractedOffer: m.extractedOffer as any,
      })),
      rfqId,
      generatedAt: new Date(),
    };

    // Generate PDF
    const pdfBuffer = await generateDealSummaryPDF(pdfInput);
    const filename = generatePDFFilename(summary.deal.vendorName, rfqId);

    logger.info('[exportDealPDF] PDF generated successfully:', {
      dealId,
      filename,
      size: pdfBuffer.length,
    });

    return { data: pdfBuffer, filename };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    logger.error('[exportDealPDF] Error:', error);
    throw new CustomError(
      `Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Email deal summary PDF to recipient
 * Generates PDF and sends it as an email attachment
 */
export const emailDealPDFService = async (
  dealId: string,
  rfqId: number,
  email: string
): Promise<void> => {
  try {
    logger.info('[emailDealPDF] Sending PDF for deal:', { dealId, rfqId, email });

    // Generate the PDF
    const { data: pdfBuffer, filename } = await exportDealPDFService(dealId, rfqId);

    // Get deal info for email subject
    const summary = await getDealSummaryService(dealId);

    // Send email with attachment
    await sendDealSummaryPDFEmail({
      to: email,
      dealTitle: summary.deal.title,
      vendorName: summary.deal.vendorName,
      rfqId,
      pdfBuffer,
      filename,
    });

    logger.info('[emailDealPDF] Email sent successfully:', {
      dealId,
      email,
      filename,
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    logger.error('[emailDealPDF] Error:', error);
    throw new CustomError(
      `Failed to email PDF: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

// ==================== NEW API RESTRUCTURE SERVICES (January 2026) ====================

/**
 * Response type for requisitions available for negotiation
 */
export interface RequisitionForNegotiation {
  id: number;
  rfqNumber: string;
  title: string;
  projectId: number;
  projectName: string;
  status: string;
  estimatedValue: number;  // Frontend expects this name
  negotiationClosureDate: string | null;
  createdAt: string;
  vendorCount: number;
  productCount: number;  // Frontend expects this field
}

/**
 * Vendor address for delivery location selection
 * Used in the deal wizard for selecting delivery addresses
 */
export interface VendorAddress {
  id: number;
  label: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  isDefault: boolean;
  source?: 'VENDOR' | 'BUYER';  // Indicates whether address is from vendor or buyer company
}

/**
 * Response type for vendors attached to a requisition
 * NOTE: Frontend expects `id` to be vendor id and `name` to be vendor name
 */
export interface RequisitionVendor {
  id: number;           // Vendor ID (frontend uses this as the value for selection)
  vendorId?: number;    // Same as id, included for backward compatibility
  name: string;         // Vendor name (frontend expects `name` not `vendorName`)
  email?: string;
  companyId?: number;
  companyName: string | null;
  pastDealsCount: number;
  avgUtilityScore?: number | null;
  addresses: VendorAddress[];
  // Extra context fields (optional for frontend)
  contractId?: number | null;
  contractStatus?: string | null;
  hasDeal?: boolean;
  dealId?: string | null;
  dealStatus?: string | null;
}

/**
 * Response type for draft configuration
 */
export interface DealDraft {
  id: string;
  rfqId: number;
  vendorId: number;
  userId: number;
  title: string;
  configData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get requisitions available for negotiation
 * Returns requisitions that have vendors attached via contracts
 */
export const getRequisitionsForNegotiationService = async (): Promise<{
  requisitions: RequisitionForNegotiation[];
  total: number;
}> => {
  try {
    // Find requisitions that have contracts (vendors attached)
    const requisitionsWithContracts = await models.Requisition.findAll({
      include: [
        {
          model: models.Project,
          as: 'Project',
          attributes: ['id', 'projectName'],
        },
        {
          model: models.Contract,
          as: 'Contract',
          attributes: ['id', 'vendorId', 'status'],
          where: {
            vendorId: { [Op.ne]: null },
          },
          required: true,
        },
        {
          model: models.RequisitionProduct,
          as: 'RequisitionProduct',
          attributes: ['id'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const result: RequisitionForNegotiation[] = requisitionsWithContracts.map((req) => {
      const contracts = (req as any).Contract || [];
      const requisitionProducts = (req as any).RequisitionProduct || [];
      return {
        id: req.id,
        rfqNumber: req.rfqId || `RFQ${req.id}`,
        title: req.subject || 'Untitled Requisition',
        projectId: req.projectId,
        projectName: (req as any).Project?.projectName || 'Unknown Project',
        status: req.status || 'Open',
        estimatedValue: (req.totalEstimatedAmount as number) || 0,  // Frontend expects estimatedValue
        negotiationClosureDate: req.negotiationClosureDate?.toISOString() || null,
        createdAt: req.createdAt.toISOString(),
        vendorCount: Array.isArray(contracts) ? contracts.length : 1,
        productCount: Array.isArray(requisitionProducts) ? requisitionProducts.length : 0,  // Frontend expects productCount
      };
    });

    return {
      requisitions: result,
      total: result.length,
    };
  } catch (error) {
    logger.error('[getRequisitionsForNegotiation] Error:', error);
    throw new CustomError(
      `Failed to get requisitions for negotiation: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Get vendors attached to a specific requisition via contracts
 * Returns data in format expected by frontend VendorSummary interface
 */
export const getRequisitionVendorsService = async (
  rfqId: number
): Promise<RequisitionVendor[]> => {
  try {
    // Fetch requisition WITH buyer company and addresses via Project
    // Requisition -> Project -> Company -> Addresses
    const requisition = await models.Requisition.findByPk(rfqId, {
      include: [
        {
          model: models.Project,
          as: 'Project',
          attributes: ['id', 'projectName', 'companyId'],
          required: false,
          include: [
            {
              model: models.Company,
              as: 'Company',
              attributes: ['id', 'companyName'],
              required: false,
              include: [
                {
                  model: models.Address,
                  as: 'Addresses',
                  attributes: ['id', 'label', 'address', 'city', 'state', 'country', 'postalCode', 'isDefault'],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });
    if (!requisition) {
      throw new CustomError('Requisition not found', 404);
    }

    // Map buyer company addresses (per user requirement: buyer addresses only)
    // Access through: requisition.Project.Company.Addresses
    const buyerCompany = (requisition as any).Project?.Company;
    const buyerAddresses: VendorAddress[] = (buyerCompany?.Addresses || []).map((addr: any) => ({
      id: addr.id,
      label: addr.label || 'Delivery Address',
      address: addr.address || '',
      city: addr.city || null,
      state: addr.state || null,
      country: addr.country || null,
      postalCode: addr.postalCode || null,
      isDefault: addr.isDefault || false,
      source: 'BUYER' as const,
    }));

    // Get all contracts for this requisition with vendor info and addresses
    const contracts = await models.Contract.findAll({
      where: {
        requisitionId: rfqId,
        vendorId: { [Op.ne]: null },
      },
      include: [
        {
          model: models.User,
          as: 'Vendor',
          attributes: ['id', 'name', 'email'],
          include: [
            {
              model: models.Company,
              as: 'Company',
              attributes: ['id', 'companyName'],
              required: false,
              include: [
                {
                  model: models.Address,
                  as: 'Addresses',
                  attributes: ['id', 'label', 'address', 'city', 'state', 'country', 'postalCode', 'isDefault'],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    // For each vendor, check if they have an existing deal and count past deals
    const result: RequisitionVendor[] = [];
    const processedVendorIds = new Set<number>();

    for (const contract of contracts) {
      const vendor = (contract as any).Vendor;
      if (!vendor) continue;

      processedVendorIds.add(vendor.id);

      // Check for existing deal for this requisition
      const existingDeal = await models.ChatbotDeal.findOne({
        where: {
          requisitionId: rfqId,
          vendorId: vendor.id,
          deletedAt: null,
        },
        order: [['createdAt', 'DESC']],
      });

      // Count past completed deals for this vendor
      const pastDealsCount = await models.ChatbotDeal.count({
        where: {
          vendorId: vendor.id,
          status: { [Op.in]: ['ACCEPTED', 'WALKED_AWAY', 'ESCALATED'] },
          deletedAt: null,
        },
      });

      // Calculate average utility score from past deals
      const pastDeals = await models.ChatbotDeal.findAll({
        where: {
          vendorId: vendor.id,
          status: 'ACCEPTED',
          latestUtility: { [Op.ne]: null },
          deletedAt: null,
        },
        attributes: ['latestUtility'],
      });
      const avgUtilityScore = pastDeals.length > 0
        ? pastDeals.reduce((sum, d) => sum + (d.latestUtility || 0), 0) / pastDeals.length
        : null;

      // Per user requirement: Only return buyer addresses (not vendor addresses)
      // The buyer addresses are from the requisition's project's company
      const addresses: VendorAddress[] = [...buyerAddresses];

      result.push({
        id: vendor.id,                    // Frontend expects vendor ID as `id` (User table)
        vendorId: contract.vendorId ?? undefined,  // Vendor table ID (for matching with VendorDetails)
        name: vendor.name || 'Unknown Vendor',  // Frontend expects `name`
        email: vendor.email || '',
        companyId: vendor.Company?.id || undefined,
        companyName: vendor.Company?.companyName || null,
        pastDealsCount,
        avgUtilityScore,
        addresses,
        // Extra context fields for UI
        contractId: contract.id,
        contractStatus: contract.status,
        hasDeal: !!existingDeal,
        dealId: existingDeal?.id || null,
        dealStatus: existingDeal?.status || null,
      });
    }

    // FALLBACK: Also check ChatbotDeals table for vendors that may have deals
    // without corresponding Contract records (legacy data or edge cases)
    const dealsWithoutContracts = await models.ChatbotDeal.findAll({
      where: {
        requisitionId: rfqId,
        vendorId: { [Op.ne]: null },
        deletedAt: null,
      },
      attributes: ['vendorId'],
      group: ['vendorId'],
    });

    for (const deal of dealsWithoutContracts) {
      const vendorId = deal.vendorId;
      if (!vendorId || processedVendorIds.has(vendorId)) continue;

      // This vendor has a deal but no contract - fetch their info
      const vendor = await models.User.findByPk(vendorId, {
        attributes: ['id', 'name', 'email'],
        include: [
          {
            model: models.Company,
            as: 'Company',
            attributes: ['id', 'companyName'],
            required: false,
          },
        ],
      });

      if (!vendor) continue;

      processedVendorIds.add(vendorId);

      // Get the most recent deal for this vendor on this requisition
      const existingDeal = await models.ChatbotDeal.findOne({
        where: {
          requisitionId: rfqId,
          vendorId: vendorId,
          deletedAt: null,
        },
        order: [['createdAt', 'DESC']],
      });

      // Count past completed deals for this vendor
      const pastDealsCount = await models.ChatbotDeal.count({
        where: {
          vendorId: vendorId,
          status: { [Op.in]: ['ACCEPTED', 'WALKED_AWAY', 'ESCALATED'] },
          deletedAt: null,
        },
      });

      // Calculate average utility score from past deals
      const pastDeals = await models.ChatbotDeal.findAll({
        where: {
          vendorId: vendorId,
          status: 'ACCEPTED',
          latestUtility: { [Op.ne]: null },
          deletedAt: null,
        },
        attributes: ['latestUtility'],
      });
      const avgUtilityScore = pastDeals.length > 0
        ? pastDeals.reduce((sum, d) => sum + (d.latestUtility || 0), 0) / pastDeals.length
        : null;

      result.push({
        id: vendor.id,
        vendorId: vendor.id,
        name: vendor.name || 'Unknown Vendor',
        email: vendor.email || '',
        companyId: (vendor as any).Company?.id || undefined,
        companyName: (vendor as any).Company?.companyName || null,
        pastDealsCount,
        avgUtilityScore,
        addresses: [...buyerAddresses],
        // No contract exists for this vendor
        contractId: null,
        contractStatus: null,
        hasDeal: !!existingDeal,
        dealId: existingDeal?.id || null,
        dealStatus: existingDeal?.status || null,
      });

      logger.info(`[getRequisitionVendors] Added vendor ${vendorId} from ChatbotDeals fallback (no contract exists)`);
    }

    logger.info('[getRequisitionVendors] Retrieved vendors', {
      rfqId,
      vendorCount: result.length,
      fromContracts: contracts.length,
      fromDealsFallback: result.length - contracts.length,
    });

    return result;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    logger.error('[getRequisitionVendors] Error:', error);
    throw new CustomError(
      `Failed to get requisition vendors: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

// ==================== DRAFT MANAGEMENT (In-Memory Storage) ====================
// Note: Drafts are stored in memory for now. Can be moved to database if needed.

const draftStorage = new Map<string, DealDraft>();

/**
 * Save a draft deal configuration
 */
export const saveDraftService = async (input: {
  rfqId: number;
  vendorId: number;
  userId: number;
  data: Record<string, unknown>;
}): Promise<DealDraft> => {
  try {
    const draftId = uuidv4();
    const now = new Date().toISOString();

    const draft: DealDraft = {
      id: draftId,
      rfqId: input.rfqId,
      vendorId: input.vendorId,
      userId: input.userId,
      title: (input.data.title as string) || 'Untitled Draft',
      configData: input.data,
      createdAt: now,
      updatedAt: now,
    };

    draftStorage.set(draftId, draft);

    logger.info('[saveDraft] Draft saved', {
      draftId,
      rfqId: input.rfqId,
      vendorId: input.vendorId,
      userId: input.userId,
    });

    return draft;
  } catch (error) {
    throw new CustomError(
      `Failed to save draft: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * List drafts for a specific RFQ+Vendor combination
 */
export const listDraftsService = async (
  rfqId: number,
  vendorId: number,
  userId: number
): Promise<DealDraft[]> => {
  try {
    const drafts: DealDraft[] = [];

    for (const draft of draftStorage.values()) {
      if (
        draft.rfqId === rfqId &&
        draft.vendorId === vendorId &&
        draft.userId === userId
      ) {
        drafts.push(draft);
      }
    }

    // Sort by updatedAt descending
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    logger.info('[listDrafts] Retrieved drafts', {
      rfqId,
      vendorId,
      userId,
      count: drafts.length,
    });

    return drafts;
  } catch (error) {
    throw new CustomError(
      `Failed to list drafts: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Get a specific draft by ID
 */
export const getDraftService = async (draftId: string): Promise<DealDraft> => {
  try {
    const draft = draftStorage.get(draftId);

    if (!draft) {
      throw new CustomError('Draft not found', 404);
    }

    return draft;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(
      `Failed to get draft: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Delete a draft by ID
 */
export const deleteDraftService = async (draftId: string): Promise<void> => {
  try {
    const draft = draftStorage.get(draftId);

    if (!draft) {
      throw new CustomError('Draft not found', 404);
    }

    draftStorage.delete(draftId);

    logger.info('[deleteDraft] Draft deleted', { draftId });
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(
      `Failed to delete draft: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

// ==================== VENDOR ADDRESSES ====================

/**
 * Response type for vendor delivery addresses
 */
export interface VendorDeliveryAddress {
  id: string;
  name: string;
  address: string;
  type: 'company';
  isDefault: boolean;
}

/**
 * Get delivery addresses for a specific vendor
 * Returns the vendor's company addresses from the Addresses table
 * Falls back to legacy fullAddress field if no addresses exist
 */
export const getVendorAddressesService = async (
  vendorId: number
): Promise<VendorDeliveryAddress[]> => {
  try {
    // Get the vendor user with their company and addresses
    const vendor = await models.User.findByPk(vendorId, {
      include: [
        {
          model: models.Company,
          as: 'Company',
          attributes: ['id', 'companyName', 'fullAddress'],
          include: [
            {
              model: models.Address,
              as: 'Addresses',
              attributes: ['id', 'label', 'address', 'city', 'state', 'country', 'postalCode', 'isDefault'],
            },
          ],
        },
      ],
    });

    if (!vendor) {
      throw new CustomError('Vendor not found', 404);
    }

    const addresses: VendorDeliveryAddress[] = [];

    // First, add addresses from the Addresses table (preferred)
    if (vendor.Company?.Addresses && vendor.Company.Addresses.length > 0) {
      for (const addr of vendor.Company.Addresses) {
        // Build full address string from components
        const addressParts = [
          addr.address,
          addr.city,
          addr.state,
          addr.postalCode,
          addr.country,
        ].filter(Boolean);

        addresses.push({
          id: `address-${addr.id}`,
          name: addr.label || 'Address',
          address: addressParts.join(', '),
          type: 'company',
          isDefault: addr.isDefault,
        });
      }
    }
    // Fall back to legacy fullAddress field if no addresses in Addresses table
    else if (vendor.Company && vendor.Company.fullAddress) {
      addresses.push({
        id: `company-${vendor.Company.id}`,
        name: vendor.Company.companyName || 'Company Address',
        address: vendor.Company.fullAddress,
        type: 'company',
        isDefault: true,
      });
    }

    logger.info('[getVendorAddresses] Retrieved addresses', {
      vendorId,
      addressCount: addresses.length,
      source: vendor.Company?.Addresses?.length ? 'Addresses table' : 'legacy fullAddress',
    });

    return addresses;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    logger.error('[getVendorAddresses] Error:', error);
    throw new CustomError(
      `Failed to get vendor addresses: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

// ==================== VENDOR NEGOTIATION (AI-PM MODE) ====================

import {
  generateVendorScenarios,
  generateAiPmResponse,
  generatePmOpeningOffer,
  type PmStance,
  type VendorScenarioOffer,
  type AiPmDecision,
} from './vendor/vendorPolicy.js';

/**
 * Extract PM stance from deal's wizard config
 */
const extractPmStance = (deal: ChatbotDeal): PmStance => {
  const configJson = deal.negotiationConfigJson as Record<string, unknown> | null;
  const wizardConfig = configJson?.wizardConfig as Record<string, unknown> | undefined;

  // Extract values from wizard config with defaults
  const priceQuantity = (wizardConfig?.priceQuantity || {}) as Record<string, number>;
  const paymentTerms = (wizardConfig?.paymentTerms || {}) as Record<string, number>;
  const delivery = (wizardConfig?.delivery || {}) as Record<string, string>;
  const negotiationControl = (wizardConfig?.negotiationControl || {}) as Record<string, number>;

  return {
    targetUnitPrice: priceQuantity.targetUnitPrice || 100,
    maxAcceptablePrice: priceQuantity.maxAcceptablePrice || 120,
    idealPaymentDays: paymentTerms.minDays || 30,
    maxPaymentDays: paymentTerms.maxDays || 60,
    requiredDeliveryDate: delivery.requiredDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferredDeliveryDate: delivery.preferredDate as string | undefined,
    walkawayThreshold: (negotiationControl.walkawayThreshold || 30) / 100,
    acceptThreshold: 0.70, // Default accept threshold
    escalateThreshold: 0.50, // Default escalate threshold
    maxRounds: negotiationControl.maxRounds || 10,
  };
};

/**
 * Start negotiation - generates AI-PM's opening offer
 * POST /api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/start-negotiation
 *
 * Called when vendor opens the deal for the first time.
 * AI-PM generates opening offer based on wizard config values.
 */
export const startNegotiationService = async (dealId: string): Promise<{
  deal: ChatbotDeal;
  messages: ChatbotMessage[];
  pmOpeningMessage: ChatbotMessage;
}> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId, {
      include: [
        { model: models.Requisition, as: 'Requisition' },
        { model: models.User, as: 'Vendor', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Check if deal already started (has messages)
    const existingMessages = await models.ChatbotMessage.findAll({
      where: { dealId },
      order: [['createdAt', 'ASC']],
    });

    if (existingMessages.length > 0) {
      // Already started - just return current state
      return {
        deal,
        messages: existingMessages,
        pmOpeningMessage: existingMessages[0],
      };
    }

    // Extract PM stance from wizard config
    const pmStance = extractPmStance(deal);

    // Get product info from requisition
    const requisition = deal.Requisition as any;
    const productName = requisition?.subject || 'the products';
    const quantity = 1; // Default quantity

    // Generate PM opening offer
    const pmOpeningText = generatePmOpeningOffer(pmStance, productName, quantity);

    // Create PM's opening message
    const pmMessageId = uuidv4();
    const pmOpeningMessage = await models.ChatbotMessage.create({
      id: pmMessageId,
      dealId,
      role: 'ACCORDO',
      content: pmOpeningText,
      extractedOffer: {
        unit_price: pmStance.targetUnitPrice,
        payment_terms: pmStance.idealPaymentDays <= 30 ? 'Net 30' :
                       pmStance.idealPaymentDays <= 60 ? 'Net 60' : 'Net 90',
      } as any,
      engineDecision: null,
      decisionAction: 'COUNTER', // PM's first offer is a counter
      utilityScore: 1.0, // PM's target = 100% utility for PM
      counterOffer: {
        unit_price: pmStance.targetUnitPrice,
        payment_terms: pmStance.idealPaymentDays <= 30 ? 'Net 30' :
                       pmStance.idealPaymentDays <= 60 ? 'Net 60' : 'Net 90',
      } as any,
      explainabilityJson: null,
    });

    // Update deal status
    await deal.update({
      status: 'NEGOTIATING',
      round: 1,
      lastMessageAt: new Date(),
    });

    logger.info('[StartNegotiation] PM opening offer generated', {
      dealId,
      targetPrice: pmStance.targetUnitPrice,
    });

    return {
      deal,
      messages: [pmOpeningMessage],
      pmOpeningMessage,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    logger.error('[StartNegotiation] Error:', error);
    throw new CustomError(
      `Failed to start negotiation: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Get vendor scenarios - scenario chips for vendor based on current state
 * GET /api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/vendor-scenarios
 *
 * Returns HARD/MEDIUM/SOFT scenario chips calculated from:
 * - PM's last offer
 * - Product category margins
 * - Vendor's profit goals
 */
export const getVendorScenariosService = async (dealId: string): Promise<{
  scenarios: VendorScenarioOffer[];
  pmLastOffer: { price: number; paymentTerms: string; deliveryDate: string } | null;
  productCategory: string;
}> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId, {
      include: [
        { model: models.Requisition, as: 'Requisition' },
      ],
    });

    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Get PM's last offer from messages
    const lastPmMessage = await models.ChatbotMessage.findOne({
      where: { dealId, role: 'ACCORDO' },
      order: [['createdAt', 'DESC']],
    });

    let pmLastOffer: { price: number; paymentTerms: string; deliveryDate: string } | null = null;

    if (lastPmMessage && lastPmMessage.counterOffer) {
      const counterOffer = lastPmMessage.counterOffer as any;
      pmLastOffer = {
        price: counterOffer.unit_price || counterOffer.price || 0,
        paymentTerms: counterOffer.payment_terms || counterOffer.paymentTerms || 'Net 30',
        deliveryDate: counterOffer.delivery_date || counterOffer.deliveryDate || new Date().toISOString().split('T')[0],
      };
    }

    // Get product category from requisition or default
    const productCategory = (deal.Requisition as any)?.category || 'default';

    // Extract PM stance to get vendor cost base (use target price as base)
    const pmStance = extractPmStance(deal);
    const vendorCostBase = pmStance.targetUnitPrice * 0.8; // Assume vendor cost is 80% of PM's target

    // Generate vendor scenarios
    const scenarios = generateVendorScenarios(
      pmLastOffer,
      productCategory,
      vendorCostBase,
      1 // quantity
    );

    logger.info('[GetVendorScenarios] Scenarios generated', {
      dealId,
      pmLastOffer,
      scenarioCount: scenarios.length,
    });

    return {
      scenarios,
      pmLastOffer,
      productCategory,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    logger.error('[GetVendorScenarios] Error:', error);
    throw new CustomError(
      `Failed to get vendor scenarios: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

/**
 * Vendor sends message - vendor sends offer, AI-PM responds immediately
 * POST /api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/vendor-message
 *
 * Flow:
 * 1. Vendor sends message
 * 2. System parses vendor's offer
 * 3. AI-PM evaluates against PM's config
 * 4. AI-PM generates response (ACCEPT/COUNTER/ESCALATE/WALK_AWAY)
 * 5. Both messages returned to frontend
 */
export const vendorSendMessageService = async (
  dealId: string,
  content: string,
  userId: number
): Promise<{
  deal: ChatbotDeal;
  messages: ChatbotMessage[];
  vendorMessage: ChatbotMessage;
  pmResponse: ChatbotMessage;
  pmDecision: AiPmDecision;
}> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    if (deal.status !== 'NEGOTIATING') {
      throw new CustomError('Deal is not in negotiating status', 400);
    }

    // Parse vendor's offer from message
    const vendorOffer = parseOfferRegex(content);

    // Save vendor message
    const vendorMessageId = uuidv4();
    const vendorMessage = await models.ChatbotMessage.create({
      id: vendorMessageId,
      dealId,
      role: 'VENDOR',
      content,
      extractedOffer: vendorOffer as any,
      engineDecision: null,
      decisionAction: null,
      utilityScore: null,
      counterOffer: null,
      explainabilityJson: null,
    });

    // Extract PM stance from wizard config
    const pmStance = extractPmStance(deal);

    // Generate AI-PM response
    const pmDecision = generateAiPmResponse(
      {
        price: vendorOffer.unit_price,
        paymentTerms: vendorOffer.payment_terms,
        deliveryDate: null, // TODO: Parse delivery date from message
      },
      pmStance,
      deal.round
    );

    // Save PM response message
    const pmMessageId = uuidv4();
    const pmResponse = await models.ChatbotMessage.create({
      id: pmMessageId,
      dealId,
      role: 'ACCORDO',
      content: pmDecision.message,
      extractedOffer: null,
      engineDecision: {
        action: pmDecision.action,
        utilityScore: pmDecision.utility,
        counterOffer: pmDecision.counterOffer || null,
        reasoning: pmDecision.reasoning,
      } as any,
      decisionAction: pmDecision.action,
      utilityScore: pmDecision.utility,
      counterOffer: pmDecision.counterOffer ? {
        unit_price: pmDecision.counterOffer.price,
        payment_terms: pmDecision.counterOffer.paymentTerms,
      } as any : null,
      explainabilityJson: {
        reasoning: pmDecision.reasoning,
        utility: pmDecision.utility,
      } as any,
    });

    // Determine final status based on PM decision
    let finalStatus: 'NEGOTIATING' | 'ACCEPTED' | 'WALKED_AWAY' | 'ESCALATED' = deal.status;
    if (pmDecision.action === 'ACCEPT') finalStatus = 'ACCEPTED';
    else if (pmDecision.action === 'WALK_AWAY') finalStatus = 'WALKED_AWAY';
    else if (pmDecision.action === 'ESCALATE') finalStatus = 'ESCALATED';

    // Update deal status
    await deal.update({
      status: finalStatus,
      round: deal.round + 1,
      latestVendorOffer: vendorOffer as any,
      latestOfferJson: pmDecision.counterOffer ? {
        unit_price: pmDecision.counterOffer.price,
        payment_terms: pmDecision.counterOffer.paymentTerms,
      } as any : null,
      latestDecisionAction: pmDecision.action,
      latestUtility: pmDecision.utility,
      lastMessageAt: new Date(),
    });

    // Reload deal with updated status
    await deal.reload();

    // Get all messages for this deal
    const allMessages = await models.ChatbotMessage.findAll({
      where: { dealId },
      order: [['createdAt', 'ASC']],
    });

    logger.info('[VendorSendMessage] Vendor message processed', {
      dealId,
      vendorOffer,
      pmDecision: pmDecision.action,
      utility: pmDecision.utility,
      newRound: deal.round,
      finalStatus,
    });

    // Send PM notification email if deal status changed to terminal state
    if (finalStatus === 'ACCEPTED' || finalStatus === 'WALKED_AWAY' || finalStatus === 'ESCALATED') {
      try {
        // Only proceed if we have valid user and requisition IDs
        if (!deal.userId || !deal.requisitionId) {
          logger.warn('[VendorSendMessage] Cannot send PM notification - missing userId or requisitionId', {
            dealId,
            hasUserId: !!deal.userId,
            hasRequisitionId: !!deal.requisitionId,
          });
        } else {
          // Get PM (deal creator) info
          const pmUser = await models.User.findByPk(deal.userId);
          // Get requisition info
          const requisition = await models.Requisition.findByPk(deal.requisitionId);
          // Get vendor info
          const vendorUser = deal.vendorId ? await models.User.findByPk(deal.vendorId) : null;
          const vendorCompany = deal.vendorId ? await models.Company.findOne({
            include: [{
              model: models.VendorCompany,
              as: 'VendorCompanies',
              where: { vendorId: deal.vendorId },
              required: true,
            }],
          }) : null;

          if (pmUser && requisition) {
            const emailResult = await sendPmDealStatusNotificationEmail({
              dealId: deal.id,
              dealTitle: deal.title,
              requisitionId: deal.requisitionId as number,
              rfqNumber: (requisition as any).rfqId || `RFQ-${deal.requisitionId}`,
              vendorName: vendorUser?.name || 'Vendor',
              vendorCompanyName: (vendorCompany as any)?.name || undefined,
              pmEmail: pmUser.email || '',
              pmName: pmUser.name || 'Procurement Manager',
              pmUserId: pmUser.id,
              newStatus: finalStatus,
              utility: pmDecision.utility,
              vendorOffer: {
                price: vendorOffer.unit_price,
                paymentTerms: vendorOffer.payment_terms,
              },
              reasoning: pmDecision.reasoning ? [pmDecision.reasoning] : undefined,
            });

            if (emailResult.success) {
              logger.info('[VendorSendMessage] PM notification email sent', {
                dealId,
                pmEmail: pmUser.email,
                status: finalStatus,
              });
            } else {
              logger.warn('[VendorSendMessage] PM notification email failed', {
                dealId,
                error: emailResult.error,
              });
            }
          } else {
            logger.warn('[VendorSendMessage] Could not send PM notification - missing user or requisition', {
              dealId,
              hasUser: !!pmUser,
              hasRequisition: !!requisition,
            });
          }
        }
      } catch (emailError) {
        // Don't fail the entire operation if email fails
        logger.error('[VendorSendMessage] Error sending PM notification email', {
          dealId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    return {
      deal,
      messages: allMessages,
      vendorMessage,
      pmResponse,
      pmDecision,
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    logger.error('[VendorSendMessage] Error:', error);
    throw new CustomError(
      `Failed to process vendor message: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};
