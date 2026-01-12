/**
 * Embedding Service Client - HTTP client for the Python embedding microservice
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../../config/logger.js';
import type {
  EmbedRequest,
  EmbedBatchRequest,
  EmbedResponse,
  EmbedBatchResponse,
  EmbeddingServiceHealth,
} from './vector.types.js';

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';
const EMBEDDING_TIMEOUT = Number(process.env.EMBEDDING_TIMEOUT || 30000);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class EmbeddingClient {
  private client: AxiosInstance;
  private isHealthy: boolean = false;
  private lastHealthCheck: Date | null = null;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor() {
    this.client = axios.create({
      baseURL: EMBEDDING_SERVICE_URL,
      timeout: EMBEDDING_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info(`Embedding client initialized with URL: ${EMBEDDING_SERVICE_URL}`);
  }

  /**
   * Check if the embedding service is healthy
   */
  async checkHealth(): Promise<EmbeddingServiceHealth> {
    try {
      const response = await this.client.get<EmbeddingServiceHealth>('/health');
      this.isHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = new Date();
      return response.data;
    } catch (error) {
      this.isHealthy = false;
      logger.error('Embedding service health check failed:', error);
      return {
        status: 'unavailable',
        model: 'unknown',
        dimension: 0,
        device: 'unknown',
        gpu_available: false,
      };
    }
  }

  /**
   * Get cached health status or refresh if stale
   */
  async getHealthStatus(): Promise<EmbeddingServiceHealth> {
    const now = new Date();
    if (
      !this.lastHealthCheck ||
      now.getTime() - this.lastHealthCheck.getTime() > this.healthCheckInterval
    ) {
      return this.checkHealth();
    }

    return {
      status: this.isHealthy ? 'healthy' : 'unavailable',
      model: 'BAAI/bge-large-en-v1.5',
      dimension: 1024,
      device: 'unknown',
      gpu_available: false,
    };
  }

  /**
   * Wait for the embedding service to be ready
   */
  async waitForService(maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const health = await this.checkHealth();
      if (health.status === 'healthy') {
        logger.info('Embedding service is ready');
        return true;
      }
      logger.info('Waiting for embedding service to be ready...');
      await this.sleep(checkInterval);
    }

    logger.error('Embedding service did not become ready in time');
    return false;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string, instruction?: string): Promise<number[]> {
    const request: EmbedRequest = { text, instruction };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.post<EmbedResponse>('/embed', request);
        return response.data.embedding;
      } catch (error) {
        const isLastAttempt = attempt === MAX_RETRIES;
        this.handleError(error, 'embed', isLastAttempt);

        if (!isLastAttempt) {
          await this.sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw new Error('Failed to generate embedding after max retries');
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[], instruction?: string): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Split into chunks of 100 if needed
    const maxBatchSize = 100;
    if (texts.length > maxBatchSize) {
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += maxBatchSize) {
        const chunk = texts.slice(i, i + maxBatchSize);
        const chunkEmbeddings = await this.embedBatchInternal(chunk, instruction);
        results.push(...chunkEmbeddings);
      }
      return results;
    }

    return this.embedBatchInternal(texts, instruction);
  }

  /**
   * Internal batch embedding method
   */
  private async embedBatchInternal(texts: string[], instruction?: string): Promise<number[][]> {
    const request: EmbedBatchRequest = { texts, instruction };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.post<EmbedBatchResponse>('/embed/batch', request);
        return response.data.embeddings;
      } catch (error) {
        const isLastAttempt = attempt === MAX_RETRIES;
        this.handleError(error, 'embedBatch', isLastAttempt);

        if (!isLastAttempt) {
          await this.sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw new Error('Failed to generate batch embeddings after max retries');
  }

  /**
   * Compute similarity between two texts
   */
  async computeSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const response = await this.client.post<{ similarity: number }>('/similarity', {
        text1,
        text2,
      });
      return response.data.similarity;
    } catch (error) {
      this.handleError(error, 'computeSimilarity', true);
      throw error;
    }
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    // For normalized vectors, norms should be 1, so just return dot product
    if (Math.abs(norm1 - 1) < 0.001 && Math.abs(norm2 - 1) < 0.001) {
      return dotProduct;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Handle and log errors
   */
  private handleError(error: unknown, operation: string, shouldThrow: boolean): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = axiosError.message;

      if (status === 503) {
        logger.warn(`Embedding service temporarily unavailable during ${operation}`);
      } else if (axiosError.code === 'ECONNREFUSED') {
        logger.error(`Embedding service not running (${operation})`);
        this.isHealthy = false;
      } else {
        logger.error(`Embedding service error during ${operation}: ${message}`);
      }

      if (shouldThrow) {
        throw new Error(`Embedding service error: ${message}`);
      }
    } else {
      logger.error(`Unexpected error during ${operation}:`, error);
      if (shouldThrow) {
        throw error;
      }
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const embeddingClient = new EmbeddingClient();
export default embeddingClient;
