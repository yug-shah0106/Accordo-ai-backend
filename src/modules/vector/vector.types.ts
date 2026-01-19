/**
 * Type definitions for the Vector module
 */

// Embedding Service Types
export interface EmbedRequest {
  text: string;
  instruction?: string;
}

export interface EmbedBatchRequest {
  texts: string[];
  instruction?: string;
}

export interface EmbedResponse {
  embedding: number[];
  dimension: number;
  model: string;
  processing_time_ms: number;
}

export interface EmbedBatchResponse {
  embeddings: number[][];
  dimension: number;
  count: number;
  model: string;
  processing_time_ms: number;
}

export interface EmbeddingServiceHealth {
  status: 'healthy' | 'loading' | 'unavailable';
  model: string;
  dimension: number;
  device: string;
  gpu_available: boolean;
  gpu_name?: string;
}

// Vector Search Types
export interface VectorSearchFilters {
  dealId?: string;
  userId?: number;
  vendorId?: number;
  role?: 'VENDOR' | 'ACCORDO' | 'SYSTEM';
  outcome?: string;
  minUtility?: number;
  maxUtility?: number;
  decisionAction?: string;
  productCategory?: string;
  priceRange?: string;
  paymentTerms?: string;
  contentType?: 'message' | 'offer_extract' | 'decision';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface VectorSearchOptions {
  topK?: number;
  similarityThreshold?: number;
  includeMetadata?: boolean;
  filters?: VectorSearchFilters;
}

export interface VectorSearchResult<T = Record<string, unknown>> {
  id: string;
  similarity: number;
  contentText: string;
  metadata: T;
}

export interface MessageSearchResult extends VectorSearchResult {
  metadata: {
    messageId: string;
    dealId: string;
    role: string;
    round: number;
    outcome?: string;
    utilityScore?: number;
    decisionAction?: string;
  };
}

export interface DealSearchResult extends VectorSearchResult {
  metadata: {
    dealId: string;
    dealTitle?: string;
    counterparty?: string;
    finalStatus?: string;
    totalRounds?: number;
    finalUtility?: number;
    finalPrice?: number;
  };
}

export interface PatternSearchResult extends VectorSearchResult {
  metadata: {
    patternType: string;
    patternName: string;
    scenario?: string;
    avgUtility?: number;
    successRate?: number;
    sampleCount: number;
  };
}

// Vectorization Types
export interface VectorizationResult {
  success: boolean;
  embeddingId?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface BatchVectorizationResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  processingTimeMs: number;
}

// AI Context Types
export interface AIContextResult {
  similarDeals: DealSearchResult[];
  fewShotExamples: PatternSearchResult[];
  relevantMessages: MessageSearchResult[];
  contextText: string;
  retrievalTimeMs: number;
}

export interface RAGContext {
  systemPromptAddition: string;
  fewShotExamples: string[];
  similarNegotiations: string[];
  relevanceScores: number[];
}

// Migration Types
export interface MigrationProgress {
  id: number;
  migrationType: 'messages' | 'deals' | 'patterns' | 'full';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  currentBatch: number;
  totalBatches: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  processingRate?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// Vector Stats Types
export interface VectorStats {
  messageEmbeddings: {
    total: number;
    byRole: Record<string, number>;
    byOutcome: Record<string, number>;
  };
  dealEmbeddings: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  negotiationPatterns: {
    total: number;
    active: number;
    byType: Record<string, number>;
  };
  embeddingServiceStatus: EmbeddingServiceHealth;
  lastMigration?: MigrationProgress;
}

// Content Preparation Types
export interface PreparedContent {
  contentText: string;
  contentType: 'message' | 'offer_extract' | 'decision' | 'summary' | 'pattern';
  metadata: Record<string, unknown>;
}

export interface MessageContent {
  content: string;
  role: string;
  dealId: string;
  round: number;
  extractedOffer?: {
    unit_price?: number;
    payment_terms?: string;
  };
  engineDecision?: {
    action: string;
    utilityScore: number;
  };
}

export interface DealSummaryContent {
  dealId: string;
  title: string;
  counterparty?: string;
  status: string;
  totalRounds: number;
  latestUtility?: number;
  latestOffer?: {
    unit_price?: number;
    payment_terms?: string;
  };
  messages: MessageContent[];
}
