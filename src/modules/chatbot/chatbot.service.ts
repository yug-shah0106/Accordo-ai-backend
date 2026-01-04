import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { CustomError } from '../../utils/custom-error.js';
import logger from '../../config/logger.js';
import models from '../../models/index.js';
import { parseOfferRegex } from './engine/parseOffer.js';
import { decideNextMove } from './engine/decide.js';
import { computeExplainability, totalUtility, type NegotiationConfig } from './engine/utility.js';
import type { Offer, Decision, Explainability } from './engine/types.js';
import type { ChatbotDeal } from '../../models/chatbotDeal.js';
import type { ChatbotMessage } from '../../models/chatbotMessage.js';

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
 * Process a vendor message in INSIGHTS (demo) mode
 * Extracts offer, makes decision, generates counter
 */
export const processVendorMessageService = async (
  input: ProcessMessageInput
): Promise<{
  message: ChatbotMessage;
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

    // Save message with engine outputs
    const messageId = uuidv4();
    const message = await models.ChatbotMessage.create({
      id: messageId,
      dealId: input.dealId,
      role: input.role,
      content: input.content,
      extractedOffer: extractedOffer as any,
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

    return { message, decision, explainability };
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
        { model: models.Requisition, as: 'Requisition', attributes: ['id', 'title'] },
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
 * Unarchive a deal
 */
export const unarchiveDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    await deal.update({ archivedAt: null });
    logger.info(`Unarchived deal ${dealId}`);
    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to unarchive deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Soft delete a deal
 */
export const softDeleteDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    await deal.update({ deletedAt: new Date() });
    logger.info(`Soft deleted deal ${dealId}`);
    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to soft delete deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Restore a soft-deleted deal
 */
export const restoreDealService = async (dealId: string): Promise<ChatbotDeal> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    await deal.update({ deletedAt: null });
    logger.info(`Restored deal ${dealId}`);
    return deal;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(`Failed to restore deal: ${(error as Error).message}`, 500);
  }
};

/**
 * Permanently delete a deal and all messages
 */
export const permanentDeleteDealService = async (dealId: string): Promise<void> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    // Delete all messages (CASCADE should handle this, but explicit is safer)
    await models.ChatbotMessage.destroy({ where: { dealId } });

    // Delete deal
    await deal.destroy();

    logger.info(`Permanently deleted deal ${dealId}`);
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(
      `Failed to permanently delete deal: ${(error as Error).message}`,
      500
    );
  }
};

/**
 * Get negotiation config for a deal
 */
export const getDealConfigService = async (dealId: string): Promise<NegotiationConfig> => {
  try {
    const deal = await models.ChatbotDeal.findByPk(dealId);
    if (!deal) {
      throw new CustomError('Deal not found', 404);
    }

    if (deal.requisitionId) {
      return await buildConfigFromRequisition(deal.requisitionId);
    } else if (deal.contractId) {
      return await buildConfigFromContract(deal.contractId);
    } else {
      // Return default config
      const { negotiationConfig } = await import('./engine/config.js');
      return negotiationConfig;
    }
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

      const { message: accordoMessage, decision } = processResult;

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
