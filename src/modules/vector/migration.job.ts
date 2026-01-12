/**
 * Migration Job - Batch vectorization of historical data
 */

import {
  ChatbotMessage,
  ChatbotDeal,
  MessageEmbedding,
  DealEmbedding,
  VectorMigrationStatus,
} from '../../models/index.js';
import { embeddingClient } from './embedding.client.js';
import * as vectorService from './vector.service.js';
import logger from '../../config/logger.js';
import type { MigrationProgress } from './vector.types.js';

type MigrationType = 'messages' | 'deals' | 'patterns' | 'full';

let currentMigration: VectorMigrationStatus | null = null;
let isCancelled = false;

/**
 * Start a new migration
 */
export async function startMigration(
  type: MigrationType,
  batchSize: number = 100
): Promise<number> {
  // Check if there's already a migration in progress
  const existingMigration = await VectorMigrationStatus.findOne({
    where: { status: 'in_progress' },
  });

  if (existingMigration) {
    throw new Error('A migration is already in progress');
  }

  // Check embedding service health
  const health = await embeddingClient.checkHealth();
  if (health.status !== 'healthy') {
    throw new Error('Embedding service is not available');
  }

  // Count records to migrate
  let totalRecords = 0;
  if (type === 'messages' || type === 'full') {
    totalRecords += await ChatbotMessage.count();
  }
  if (type === 'deals' || type === 'full') {
    totalRecords += await ChatbotDeal.count();
  }

  // Create migration record
  const migration = await VectorMigrationStatus.create({
    migrationType: type,
    status: 'pending',
    totalRecords,
    processedRecords: 0,
    failedRecords: 0,
    currentBatch: 0,
    totalBatches: Math.ceil(totalRecords / batchSize),
    batchSize,
    startedAt: new Date(),
  });

  currentMigration = migration;
  isCancelled = false;

  // Start migration in background
  runMigration(migration.id, type, batchSize).catch((error) => {
    logger.error('Migration failed:', error);
  });

  return migration.id;
}

/**
 * Run the migration process
 */
async function runMigration(
  migrationId: number,
  type: MigrationType,
  batchSize: number
): Promise<void> {
  const migration = await VectorMigrationStatus.findByPk(migrationId);
  if (!migration) {
    throw new Error('Migration not found');
  }

  try {
    // Update status to in_progress
    await migration.update({
      status: 'in_progress',
      startedAt: new Date(),
    });

    const startTime = Date.now();
    let processedTotal = 0;
    let failedTotal = 0;

    // Migrate messages
    if (type === 'messages' || type === 'full') {
      const result = await migrateMessages(migration, batchSize);
      processedTotal += result.processed;
      failedTotal += result.failed;
    }

    // Migrate deals
    if ((type === 'deals' || type === 'full') && !isCancelled) {
      const result = await migrateDeals(migration, batchSize);
      processedTotal += result.processed;
      failedTotal += result.failed;
    }

    // Update final status
    const status = isCancelled ? 'failed' : 'completed';
    const errorMessage = isCancelled ? 'Migration was cancelled' : null;

    await migration.update({
      status,
      processedRecords: processedTotal,
      failedRecords: failedTotal,
      completedAt: new Date(),
      errorMessage,
      processingRate: processedTotal / ((Date.now() - startTime) / 1000),
    });

    logger.info(`Migration ${status}: processed ${processedTotal}, failed ${failedTotal}`);
  } catch (error) {
    logger.error('Migration error:', error);
    await migration.update({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date(),
    });
  } finally {
    currentMigration = null;
  }
}

/**
 * Migrate messages in batches
 */
async function migrateMessages(
  migration: VectorMigrationStatus,
  batchSize: number
): Promise<{ processed: number; failed: number }> {
  let offset = 0;
  let processed = 0;
  let failed = 0;
  let batchNumber = 0;

  // Get IDs of messages that already have embeddings
  const existingEmbeddings = await MessageEmbedding.findAll({
    attributes: ['messageId'],
  });
  const existingIds = new Set(existingEmbeddings.map((e) => e.messageId));

  while (!isCancelled) {
    // Fetch batch of messages with their deals
    const messages = await ChatbotMessage.findAll({
      offset,
      limit: batchSize,
      order: [['createdAt', 'ASC']],
      include: [
        {
          model: ChatbotDeal,
          as: 'Deal',
        },
      ],
    });

    if (messages.length === 0) {
      break;
    }

    batchNumber++;
    const batchStart = Date.now();

    // Filter out messages that already have embeddings
    const messagesToProcess = messages.filter((m) => !existingIds.has(m.id));

    // Process batch
    for (const message of messagesToProcess) {
      if (isCancelled) break;

      try {
        const deal = message.Deal;
        if (!deal) {
          failed++;
          continue;
        }

        const result = await vectorService.vectorizeMessage(message, deal);
        if (result.success) {
          processed++;
          existingIds.add(message.id);
        } else {
          failed++;
          logger.warn(`Failed to vectorize message ${message.id}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        logger.error(`Error vectorizing message ${message.id}:`, error);
      }
    }

    // Update migration progress
    const batchTime = Date.now() - batchStart;
    const rate = messagesToProcess.length / (batchTime / 1000);
    const remaining = migration.totalRecords - processed - failed;
    const estimatedTimeRemaining = remaining / rate;

    await migration.update({
      processedRecords: processed,
      failedRecords: failed,
      currentBatch: batchNumber,
      lastProcessedId: messages[messages.length - 1].id,
      processingRate: rate,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
    });

    logger.info(
      `Migration batch ${batchNumber}: processed ${processed}/${migration.totalRecords} messages`
    );

    offset += batchSize;
  }

  return { processed, failed };
}

/**
 * Migrate deals in batches
 */
async function migrateDeals(
  migration: VectorMigrationStatus,
  batchSize: number
): Promise<{ processed: number; failed: number }> {
  let offset = 0;
  let processed = 0;
  let failed = 0;
  let batchNumber = migration.currentBatch;

  // Get IDs of deals that already have embeddings
  const existingEmbeddings = await DealEmbedding.findAll({
    attributes: ['dealId'],
    where: { embeddingType: 'summary' },
  });
  const existingIds = new Set(existingEmbeddings.map((e) => e.dealId));

  while (!isCancelled) {
    // Fetch batch of deals
    const deals = await ChatbotDeal.findAll({
      offset,
      limit: batchSize,
      order: [['createdAt', 'ASC']],
    });

    if (deals.length === 0) {
      break;
    }

    batchNumber++;
    const batchStart = Date.now();

    // Filter out deals that already have embeddings
    const dealsToProcess = deals.filter((d) => !existingIds.has(d.id));

    // Process batch
    for (const deal of dealsToProcess) {
      if (isCancelled) break;

      try {
        const result = await vectorService.vectorizeDeal(deal.id);
        if (result.success) {
          processed++;
          existingIds.add(deal.id);
        } else {
          failed++;
          logger.warn(`Failed to vectorize deal ${deal.id}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        logger.error(`Error vectorizing deal ${deal.id}:`, error);
      }
    }

    // Update migration progress
    const batchTime = Date.now() - batchStart;
    const rate = dealsToProcess.length / (batchTime / 1000);

    await migration.update({
      processedRecords: migration.processedRecords + processed,
      failedRecords: migration.failedRecords + failed,
      currentBatch: batchNumber,
      lastProcessedId: deals[deals.length - 1].id,
      processingRate: rate,
    });

    logger.info(`Migration batch ${batchNumber}: processed ${processed} deals`);

    offset += batchSize;
  }

  return { processed, failed };
}

/**
 * Get current migration status
 */
export async function getMigrationStatus(): Promise<MigrationProgress | null> {
  const migration = await VectorMigrationStatus.findOne({
    order: [['createdAt', 'DESC']],
  });

  if (!migration) {
    return null;
  }

  return {
    id: migration.id,
    migrationType: migration.migrationType,
    status: migration.status,
    totalRecords: migration.totalRecords,
    processedRecords: migration.processedRecords,
    failedRecords: migration.failedRecords,
    currentBatch: migration.currentBatch,
    totalBatches: migration.totalBatches,
    percentComplete:
      migration.totalRecords > 0
        ? Math.round((migration.processedRecords / migration.totalRecords) * 100)
        : 0,
    estimatedTimeRemaining: migration.estimatedTimeRemaining || undefined,
    processingRate: migration.processingRate || undefined,
    startedAt: migration.startedAt || undefined,
    completedAt: migration.completedAt || undefined,
    errorMessage: migration.errorMessage || undefined,
  };
}

/**
 * Cancel the current migration
 */
export async function cancelMigration(): Promise<void> {
  isCancelled = true;

  if (currentMigration) {
    await currentMigration.update({
      status: 'failed',
      errorMessage: 'Migration was cancelled by user',
    });
  }
}

/**
 * Resume a failed migration
 */
export async function resumeMigration(migrationId: number): Promise<void> {
  const migration = await VectorMigrationStatus.findByPk(migrationId);

  if (!migration) {
    throw new Error('Migration not found');
  }

  if (migration.status !== 'failed') {
    throw new Error('Can only resume failed migrations');
  }

  // Reset cancellation flag
  isCancelled = false;

  // Restart migration
  currentMigration = migration;
  runMigration(migration.id, migration.migrationType, migration.batchSize).catch((error) => {
    logger.error('Migration resume failed:', error);
  });
}

export default {
  startMigration,
  getMigrationStatus,
  cancelMigration,
  resumeMigration,
};
