import { Router } from 'express';
import * as controller from './chatbot.controller.js';
import * as templateController from './template.controller.js';
import * as vendorSimulatorController from './vendor/vendorSimulator.controller.js';
import { authMiddleware, checkPermission } from '../../middlewares/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  createDealSchema,
  processMessageSchema,
  createSystemMessageSchema,
  dealIdSchema,
  listDealsQuerySchema,
} from './chatbot.validator.js';

const chatbotRouter = Router();

/**
 * Chatbot Module Routes
 * All routes are prefixed with /api/chatbot
 *
 * NOTE: Module permissions can be added later when chatbot module is registered
 * For now, using authMiddleware only to ensure authenticated access
 */

// ==================== Deal Management ====================

/**
 * Create a new negotiation deal
 * POST /api/chatbot/deals
 */
chatbotRouter.post(
  '/deals',
  authMiddleware,
  validateBody(createDealSchema),
  controller.createDeal
);

/**
 * List all deals with filters
 * GET /api/chatbot/deals
 */
chatbotRouter.get(
  '/deals',
  authMiddleware,
  validateQuery(listDealsQuerySchema),
  controller.listDeals
);

/**
 * Get a specific deal with messages
 * GET /api/chatbot/deals/:dealId
 */
chatbotRouter.get(
  '/deals/:dealId',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.getDeal
);

/**
 * Get negotiation config for a deal
 * GET /api/chatbot/deals/:dealId/config
 */
chatbotRouter.get(
  '/deals/:dealId/config',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.getDealConfig
);

/**
 * Get last explainability for a deal
 * GET /api/chatbot/deals/:dealId/explainability
 */
chatbotRouter.get(
  '/deals/:dealId/explainability',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.getLastExplainability
);

// ==================== Message Processing ====================

/**
 * Process a vendor message (INSIGHTS mode)
 * POST /api/chatbot/deals/:dealId/messages
 */
chatbotRouter.post(
  '/deals/:dealId/messages',
  authMiddleware,
  validateParams(dealIdSchema),
  validateBody(processMessageSchema),
  controller.processVendorMessage
);

/**
 * Create a system message
 * POST /api/chatbot/deals/:dealId/system-message
 */
chatbotRouter.post(
  '/deals/:dealId/system-message',
  authMiddleware,
  validateParams(dealIdSchema),
  validateBody(createSystemMessageSchema),
  controller.createSystemMessage
);

// ==================== Conversation Mode (CONVERSATION) ====================

/**
 * Start a conversation (auto-sends greeting)
 * POST /api/chatbot/conversation/deals/:dealId/start
 */
chatbotRouter.post(
  '/conversation/deals/:dealId/start',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.startConversation
);

/**
 * Send a message in conversation mode
 * POST /api/chatbot/conversation/deals/:dealId/messages
 */
chatbotRouter.post(
  '/conversation/deals/:dealId/messages',
  authMiddleware,
  validateParams(dealIdSchema),
  validateBody(processMessageSchema),
  controller.sendConversationMessage
);

/**
 * Get last explainability for conversation mode
 * GET /api/chatbot/conversation/deals/:dealId/explainability
 */
chatbotRouter.get(
  '/conversation/deals/:dealId/explainability',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.getConversationExplainability
);

// ==================== Deal Actions ====================

/**
 * Reset a deal (clear messages and state)
 * POST /api/chatbot/deals/:dealId/reset
 */
chatbotRouter.post(
  '/deals/:dealId/reset',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.resetDeal
);

/**
 * Archive a deal
 * POST /api/chatbot/deals/:dealId/archive
 */
chatbotRouter.post(
  '/deals/:dealId/archive',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.archiveDeal
);

/**
 * Unarchive a deal
 * POST /api/chatbot/deals/:dealId/unarchive
 */
chatbotRouter.post(
  '/deals/:dealId/unarchive',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.unarchiveDeal
);

/**
 * Restore a soft-deleted deal
 * POST /api/chatbot/deals/:dealId/restore
 */
chatbotRouter.post(
  '/deals/:dealId/restore',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.restoreDeal
);

/**
 * Soft delete a deal
 * DELETE /api/chatbot/deals/:dealId
 */
chatbotRouter.delete(
  '/deals/:dealId',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.softDeleteDeal
);

/**
 * Permanently delete a deal
 * DELETE /api/chatbot/deals/:dealId/permanent
 */
chatbotRouter.delete(
  '/deals/:dealId/permanent',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.permanentDeleteDeal
);

// ==================== Vendor Simulation (Autopilot) ====================

/**
 * Generate next vendor message (autopilot)
 * POST /api/chatbot/vendor/deals/:dealId/vendor/next
 */
chatbotRouter.post(
  '/vendor/deals/:dealId/vendor/next',
  authMiddleware,
  validateParams(dealIdSchema),
  vendorSimulatorController.generateNextVendorMessage
);

// ==================== Demo Mode ====================

/**
 * Run full demo negotiation with autopilot vendor
 * POST /api/chatbot/deals/:dealId/run-demo
 */
chatbotRouter.post(
  '/deals/:dealId/run-demo',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.runDemo
);

/**
 * Resume an escalated deal
 * POST /api/chatbot/deals/:dealId/resume
 */
chatbotRouter.post(
  '/deals/:dealId/resume',
  authMiddleware,
  validateParams(dealIdSchema),
  controller.resumeDeal
);

// ==================== Template Management ====================

/**
 * Get default template
 * GET /api/chatbot/templates/default
 * NOTE: This route must come BEFORE /api/chatbot/templates/:id
 */
chatbotRouter.get(
  '/templates/default',
  authMiddleware,
  templateController.getDefaultTemplate
);

/**
 * Create a new template
 * POST /api/chatbot/templates
 */
chatbotRouter.post(
  '/templates',
  authMiddleware,
  templateController.createTemplate
);

/**
 * List all templates
 * GET /api/chatbot/templates
 */
chatbotRouter.get(
  '/templates',
  authMiddleware,
  templateController.listTemplates
);

/**
 * Get a template by ID
 * GET /api/chatbot/templates/:id
 */
chatbotRouter.get(
  '/templates/:id',
  authMiddleware,
  templateController.getTemplate
);

/**
 * Update a template by ID
 * PUT /api/chatbot/templates/:id
 */
chatbotRouter.put(
  '/templates/:id',
  authMiddleware,
  templateController.updateTemplate
);

/**
 * Set a template as default
 * POST /api/chatbot/templates/:id/set-default
 */
chatbotRouter.post(
  '/templates/:id/set-default',
  authMiddleware,
  templateController.setDefaultTemplate
);

/**
 * Delete a template by ID (soft delete)
 * DELETE /api/chatbot/templates/:id
 */
chatbotRouter.delete(
  '/templates/:id',
  authMiddleware,
  templateController.deleteTemplate
);

/**
 * Permanently delete a template by ID
 * DELETE /api/chatbot/templates/:id/permanent
 */
chatbotRouter.delete(
  '/templates/:id/permanent',
  authMiddleware,
  templateController.permanentDeleteTemplate
);

export default chatbotRouter;
