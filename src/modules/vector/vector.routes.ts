/**
 * Vector Routes - API routes for vector operations
 */

import { Router } from 'express';
import * as controller from './vector.controller.js';

const router = Router();

// Health check
router.get('/health', controller.getHealth);

// Statistics
router.get('/stats', controller.getStats);

// Search endpoints
router.post('/search/messages', controller.searchMessages);
router.post('/search/deals', controller.searchDeals);
router.post('/search/patterns', controller.searchPatterns);

// AI Context (RAG) endpoints
router.post('/context/:dealId', controller.buildContext);
router.post('/rag/:dealId', controller.getRAGContext);

// Manual embedding endpoints
router.post('/embed/message/:messageId', controller.embedMessage);
router.post('/embed/deal/:dealId', controller.embedDeal);

// Migration endpoints
router.post('/migrate', controller.startMigration);
router.get('/migrate/status', controller.getMigrationStatus);
router.post('/migrate/cancel', controller.cancelMigration);

export default router;
