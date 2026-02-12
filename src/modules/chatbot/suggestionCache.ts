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
 *
 * Emphasis Filtering (January 2026):
 * - Cache keys now include emphasis filter for emphasis-specific results
 * - Supports multi-emphasis combinations (e.g., "price,delivery")
 * - No-emphasis cache stores full suggestions for client-side filtering
 */

import logger from '../../config/logger.js';
import type { ScenarioSuggestions, SuggestionDeliveryConfig, SuggestionEmphasis } from './engine/types.js';

// Cache configuration
const CACHE_TTL_MS = 300_000; // 5 minutes in milliseconds
const MEMORY_CACHE_MAX_SIZE = 100; // Max deals to cache in memory

// In-memory cache for fastest access
interface CacheEntry {
  suggestions: ScenarioSuggestions;
  timestamp: number;
  source: 'llm' | 'fallback';
  deliveryConfig?: SuggestionDeliveryConfig;
  emphases?: SuggestionEmphasis[]; // Which emphases were requested
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for a deal's suggestions
 * Now includes emphasis filter for emphasis-specific caching
 */
function getCacheKey(dealId: string, round: number, emphases?: SuggestionEmphasis[]): string {
  const emphasisSuffix = emphases && emphases.length > 0
    ? `:${emphases.sort().join(',')}`
    : '';
  return `suggestions:${dealId}:${round}${emphasisSuffix}`;
}

/**
 * Get suggestions from cache
 *
 * @param emphases - Optional emphasis filter for cached suggestions
 * @returns Cached suggestions or null if not found
 */
export async function getCachedSuggestions(
  dealId: string,
  round: number,
  emphases?: SuggestionEmphasis[]
): Promise<{ suggestions: ScenarioSuggestions; source: 'llm' | 'fallback'; deliveryConfig?: SuggestionDeliveryConfig; emphases?: SuggestionEmphasis[] } | null> {
  const key = getCacheKey(dealId, round, emphases);

  const entry = memoryCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    logger.debug('[SuggestionCache] Cache hit', { dealId, round, source: entry.source, emphases });
    return { suggestions: entry.suggestions, source: entry.source, deliveryConfig: entry.deliveryConfig, emphases: entry.emphases };
  }

  // Expired or not found
  if (entry) {
    memoryCache.delete(key);
  }

  logger.debug('[SuggestionCache] Cache miss', { dealId, round, emphases });
  return null;
}

/**
 * Store suggestions in cache
 *
 * @param emphases - Optional emphasis filter that was used to generate these suggestions
 */
export async function cacheSuggestions(
  dealId: string,
  round: number,
  suggestions: ScenarioSuggestions,
  source: 'llm' | 'fallback',
  deliveryConfig?: SuggestionDeliveryConfig,
  emphases?: SuggestionEmphasis[]
): Promise<void> {
  const key = getCacheKey(dealId, round, emphases);
  const entry: CacheEntry = {
    suggestions,
    timestamp: Date.now(),
    source,
    deliveryConfig,
    emphases,
  };

  memoryCache.set(key, entry);

  // Evict old entries if cache is too large
  if (memoryCache.size > MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }

  logger.debug('[SuggestionCache] Cached suggestions', { dealId, round, source, emphases });
}

/**
 * Filter suggestions by emphasis
 * Used for hybrid filtering: immediately filter cached suggestions on client
 *
 * @param suggestions - Full suggestions object
 * @param emphases - Emphases to filter by (if empty, returns all)
 * @returns Filtered suggestions with only matching emphases
 */
export function filterSuggestionsByEmphasis(
  suggestions: ScenarioSuggestions,
  emphases: SuggestionEmphasis[]
): ScenarioSuggestions {
  if (!emphases || emphases.length === 0) {
    return suggestions; // No filter, return all
  }

  const filterScenario = (scenarioSuggestions: ScenarioSuggestions[keyof ScenarioSuggestions]) => {
    // Filter to suggestions that match any of the selected emphases
    const filtered = scenarioSuggestions.filter(s => emphases.includes(s.emphasis));
    // If nothing matches, return original (fallback)
    return filtered.length > 0 ? filtered : scenarioSuggestions;
  };

  return {
    HARD: filterScenario(suggestions.HARD),
    MEDIUM: filterScenario(suggestions.MEDIUM),
    SOFT: filterScenario(suggestions.SOFT),
    WALK_AWAY: filterScenario(suggestions.WALK_AWAY),
  };
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
  generateFn: (dealId: string, userId: number) => Promise<ScenarioSuggestions>
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
