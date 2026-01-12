/**
 * Vector Module - Exports for vectorization, RAG, and semantic search
 */

// Types
export * from './vector.types.js';

// Services
export * as vectorService from './vector.service.js';
export { embeddingClient } from './embedding.client.js';

// Queue
export { vectorizationQueue, onMessageCreated, onDealCompleted } from './vectorization.queue.js';

// Migration
export * as migrationJob from './migration.job.js';

// Routes
export { default as vectorRoutes } from './vector.routes.js';

// Controller (for direct use)
export * as vectorController from './vector.controller.js';
