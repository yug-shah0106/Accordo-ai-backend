import { Request, Response, NextFunction } from 'express';
import * as chatbotService from './chatbot.service.js';
import { CustomError } from '../../utils/custom-error.js';
import logger from '../../config/logger.js';

/**
 * Chatbot Controller
 * Handles HTTP requests for negotiation chatbot operations
 */

/**
 * Create a new negotiation deal
 * POST /api/chatbot/deals
 */
export const createDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, counterparty, mode, templateId, requisitionId, contractId, vendorId } = req.body;

    if (!title) {
      throw new CustomError('Title is required', 400);
    }

    const deal = await chatbotService.createDealService({
      title,
      counterparty,
      mode,
      templateId,
      requisitionId,
      contractId,
      userId: req.context.userId,
      vendorId,
    });

    logger.info(`Deal created: ${deal.id} by user ${req.context.userId}`);
    res.status(201).json({ message: 'Deal created successfully', data: deal });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a deal with messages
 * GET /api/chatbot/deals/:dealId
 */
export const getDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const result = await chatbotService.getDealService(dealId);

    res.status(200).json({ message: 'Deal retrieved successfully', data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * List deals with filters
 * GET /api/chatbot/deals
 */
export const listDeals = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      mode,
      archived,
      deleted,
      userId,
      vendorId,
      page = 1,
      limit = 10,
    } = req.query;

    const filters: chatbotService.ListDealsFilters = {};
    if (status) filters.status = status as any;
    if (mode) filters.mode = mode as any;
    if (archived !== undefined) filters.archived = archived === 'true';
    if (deleted !== undefined) filters.deleted = deleted === 'true';
    if (userId) filters.userId = parseInt(userId as string, 10);
    if (vendorId) filters.vendorId = parseInt(vendorId as string, 10);

    const result = await chatbotService.listDealsService(
      filters,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    res.status(200).json({ message: 'Deals retrieved successfully', data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Process a vendor message (INSIGHTS mode)
 * POST /api/chatbot/deals/:dealId/messages
 */
export const processVendorMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const { content, role = 'VENDOR' } = req.body;

    if (!content) {
      throw new CustomError('Message content is required', 400);
    }

    const result = await chatbotService.processVendorMessageService({
      dealId,
      content,
      role,
      userId: req.context.userId,
    });

    logger.info(
      `Vendor message processed for deal ${dealId}: ${result.decision.action}`
    );

    res.status(200).json({
      message: 'Message processed successfully',
      data: {
        message: result.message,
        decision: result.decision,
        explainability: result.explainability,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset a deal (clear messages and state)
 * POST /api/chatbot/deals/:dealId/reset
 */
export const resetDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const deal = await chatbotService.resetDealService(dealId);

    logger.info(`Deal reset: ${dealId} by user ${req.context.userId}`);
    res.status(200).json({ message: 'Deal reset successfully', data: deal });
  } catch (error) {
    next(error);
  }
};

/**
 * Get negotiation config for a deal
 * GET /api/chatbot/deals/:dealId/config
 */
export const getDealConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const config = await chatbotService.getDealConfigService(dealId);

    res.status(200).json({ message: 'Config retrieved successfully', data: config });
  } catch (error) {
    next(error);
  }
};

/**
 * Get last explainability for a deal
 * GET /api/chatbot/deals/:dealId/explainability
 */
export const getLastExplainability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const explainability = await chatbotService.getLastExplainabilityService(dealId);

    if (!explainability) {
      throw new CustomError('No explainability data found', 404);
    }

    res.status(200).json({
      message: 'Explainability retrieved successfully',
      data: explainability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive a deal
 * POST /api/chatbot/deals/:dealId/archive
 */
export const archiveDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const deal = await chatbotService.archiveDealService(dealId);

    logger.info(`Deal archived: ${dealId} by user ${req.context.userId}`);
    res.status(200).json({ message: 'Deal archived successfully', data: deal });
  } catch (error) {
    next(error);
  }
};

/**
 * Unarchive a deal
 * POST /api/chatbot/deals/:dealId/unarchive
 */
export const unarchiveDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const deal = await chatbotService.unarchiveDealService(dealId);

    logger.info(`Deal unarchived: ${dealId} by user ${req.context.userId}`);
    res.status(200).json({ message: 'Deal unarchived successfully', data: deal });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete a deal
 * DELETE /api/chatbot/deals/:dealId
 */
export const softDeleteDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const deal = await chatbotService.softDeleteDealService(dealId);

    logger.info(`Deal soft deleted: ${dealId} by user ${req.context.userId}`);
    res.status(200).json({ message: 'Deal deleted successfully', data: deal });
  } catch (error) {
    next(error);
  }
};

/**
 * Restore a soft-deleted deal
 * POST /api/chatbot/deals/:dealId/restore
 */
export const restoreDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const deal = await chatbotService.restoreDealService(dealId);

    logger.info(`Deal restored: ${dealId} by user ${req.context.userId}`);
    res.status(200).json({ message: 'Deal restored successfully', data: deal });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently delete a deal
 * DELETE /api/chatbot/deals/:dealId/permanent
 */
export const permanentDeleteDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    await chatbotService.permanentDeleteDealService(dealId);

    logger.info(`Deal permanently deleted: ${dealId} by user ${req.context.userId}`);
    res.status(200).json({ message: 'Deal permanently deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a system message
 * POST /api/chatbot/deals/:dealId/system-message
 */
export const createSystemMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const { content } = req.body;

    if (!content) {
      throw new CustomError('Message content is required', 400);
    }

    const message = await chatbotService.createSystemMessageService(dealId, content);

    res.status(201).json({ message: 'System message created successfully', data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * ==================== CONVERSATION MODE CONTROLLERS ====================
 */

/**
 * Start a conversation (CONVERSATION mode only)
 * POST /api/chatbot/conversation/deals/:dealId/start
 */
export const startConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const userId = req.context.userId;

    const { startConversation } = await import('./convo/conversationService.js');
    const result = await startConversation(dealId, userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message in conversation mode
 * POST /api/chatbot/conversation/deals/:dealId/messages
 */
export const sendConversationMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const { content } = req.body;
    const userId = req.context.userId;

    if (!content) {
      throw new CustomError('Message content is required', 400);
    }

    const { processConversationMessage } = await import('./convo/conversationService.js');
    const result = await processConversationMessage({
      dealId,
      vendorMessage: content,
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get last explainability for conversation mode
 * GET /api/chatbot/conversation/deals/:dealId/explainability
 */
export const getConversationExplainability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const userId = req.context.userId;

    const { getLastExplainability } = await import('./convo/conversationService.js');
    const explainability = await getLastExplainability(dealId, userId);

    if (!explainability) {
      res.status(404).json({ message: 'No explainability available for this deal' });
      return;
    }

    res.status(200).json({ message: 'Explainability retrieved successfully', data: explainability });
  } catch (error) {
    next(error);
  }
};

/**
 * ==================== DEMO MODE CONTROLLERS ====================
 */

/**
 * Run full demo negotiation with autopilot vendor
 * POST /api/chatbot/deals/:dealId/run-demo
 *
 * Request body:
 * {
 *   "scenario": "HARD" | "SOFT" | "WALK_AWAY",
 *   "maxRounds"?: number  // Default: 10
 * }
 *
 * Response:
 * {
 *   "message": "Demo completed successfully",
 *   "data": {
 *     "deal": Deal,
 *     "messages": Message[],
 *     "steps": Array<{ vendorMessage, accordoMessage, round }>,
 *     "finalStatus": string,
 *     "totalRounds": number,
 *     "finalUtility": number | null
 *   }
 * }
 */
export const runDemo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const { scenario, maxRounds = 10 } = req.body;

    if (!scenario) {
      throw new CustomError('Scenario is required', 400);
    }

    const validScenarios = ['HARD', 'SOFT', 'WALK_AWAY'];
    if (!validScenarios.includes(scenario)) {
      throw new CustomError(
        `Invalid scenario: ${scenario}. Must be one of: ${validScenarios.join(', ')}`,
        400
      );
    }

    const result = await chatbotService.runDemoService(dealId, scenario, maxRounds);

    logger.info(`[RunDemo] Demo completed for deal ${dealId}`, {
      scenario,
      totalRounds: result.totalRounds,
      finalStatus: result.finalStatus,
      userId: req.context.userId,
    });

    res.status(200).json({
      message: 'Demo completed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume an escalated deal
 * POST /api/chatbot/deals/:dealId/resume
 *
 * Response:
 * {
 *   "message": "Deal resumed successfully",
 *   "data": Deal
 * }
 */
export const resumeDeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dealId } = req.params;
    const deal = await chatbotService.resumeDealService(dealId);

    logger.info(`[ResumeController] Deal resumed: ${dealId}`, {
      userId: req.context.userId,
    });

    res.status(200).json({
      message: 'Deal resumed successfully',
      data: deal,
    });
  } catch (error) {
    next(error);
  }
};
