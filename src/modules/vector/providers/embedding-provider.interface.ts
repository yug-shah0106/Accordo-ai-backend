/**
 * Abstract base class for embedding providers
 */

import type { EmbeddingServiceHealth } from '../vector.types.js';

export interface EmbeddingProviderConfig {
  model: string;
  dimension: number;
  timeout: number;
  maxBatchSize: number;
}

export abstract class EmbeddingProvider {
  abstract readonly providerName: string;

  protected config: EmbeddingProviderConfig;

  constructor(config: EmbeddingProviderConfig) {
    this.config = config;
  }

  /** Initialize the provider (load models, verify credentials, etc.) */
  abstract initialize(): Promise<void>;

  /** Generate embedding for a single text */
  abstract embed(text: string, instruction?: string): Promise<number[]>;

  /** Generate embeddings for multiple texts */
  abstract embedBatch(texts: string[], instruction?: string): Promise<number[][]>;

  /** Check provider health / connectivity */
  abstract checkHealth(): Promise<EmbeddingServiceHealth>;
}
