/**
 * Suggestion Cache - Fast in-memory caching for scenario suggestions
 *
 * Provides instant (<50ms) responses for cached suggestions
 * with automatic background refresh when LLM responses are ready.
 *
 * Cache Strategy:
 * 1. Check in-memory cache first (instant)
 * 2. Generate fallback instantly if miss
 * 3. Background LLM generation updates cache for next request
 */

import logger from '../../config/logger.js';

// Cache configuration
const CACHE_TTL_MS = 300_000; // 5 minutes in milliseconds
const MEMORY_CACHE_MAX_SIZE = 100; // Max deals to cache in memory

// In-memory cache for fastest access
interface CacheEntry {
  suggestions: Record<string, string[]>;
  timestamp: number;
  source: 'llm' | 'fallback';
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for a deal's suggestions
 */
function getCacheKey(dealId: string, round: number): string {
  return `suggestions:${dealId}:${round}`;
}

/**
 * Get suggestions from cache
 *
 * @returns Cached suggestions or null if not found
 */
export async function getCachedSuggestions(
  dealId: string,
  round: number
): Promise<{ suggestions: Record<string, string[]>; source: 'llm' | 'fallback' } | null> {
  const key = getCacheKey(dealId, round);

  const entry = memoryCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    logger.debug('[SuggestionCache] Cache hit', { dealId, round, source: entry.source });
    return { suggestions: entry.suggestions, source: entry.source };
  }

  // Expired or not found
  if (entry) {
    memoryCache.delete(key);
  }

  logger.debug('[SuggestionCache] Cache miss', { dealId, round });
  return null;
}

/**
 * Store suggestions in cache
 */
export async function cacheSuggestions(
  dealId: string,
  round: number,
  suggestions: Record<string, string[]>,
  source: 'llm' | 'fallback'
): Promise<void> {
  const key = getCacheKey(dealId, round);
  const entry: CacheEntry = {
    suggestions,
    timestamp: Date.now(),
    source,
  };

  memoryCache.set(key, entry);

  // Evict old entries if cache is too large
  if (memoryCache.size > MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }

  logger.debug('[SuggestionCache] Cached suggestions', { dealId, round, source });
}

/**
 * Invalidate cache for a deal (call when new message arrives)
 */
export async function invalidateSuggestions(dealId: string): Promise<void> {
  let deletedCount = 0;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`suggestions:${dealId}:`)) {
      memoryCache.delete(key);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    logger.debug('[SuggestionCache] Invalidated cache', { dealId, keysRemoved: deletedCount });
  }
}

/**
 * Pre-compute suggestions in background (fire-and-forget)
 *
 * Call this after processing a vendor message to warm the cache
 * before the user requests suggestions.
 */
export function precomputeSuggestionsBackground(
  dealId: string,
  userId: number,
  generateFn: (dealId: string, userId: number) => Promise<Record<string, string[]>>
): void {
  // Fire-and-forget background generation
  setImmediate(async () => {
    try {
      logger.info('[SuggestionCache] Pre-computing suggestions in background', { dealId });
      await generateFn(dealId, userId);
      logger.info('[SuggestionCache] Background pre-computation complete', { dealId });
    } catch (error) {
      logger.warn('[SuggestionCache] Background pre-computation failed', {
        dealId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  memoryCacheSize: number;
  maxMemorySize: number;
  ttlMs: number;
} {
  return {
    memoryCacheSize: memoryCache.size,
    maxMemorySize: MEMORY_CACHE_MAX_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}

/**
 * Clear all caches (for testing)
 */
export async function clearAllCaches(): Promise<void> {
  memoryCache.clear();
  logger.debug('[SuggestionCache] Cleared all caches');
}
