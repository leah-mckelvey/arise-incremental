/**
 * Cache setup using ts-query's tiered caching.
 *
 * L1: In-process QueryClient cache (per server instance)
 * L2: Shared cache (InMemory for dev, Redis for prod)
 * L3: Database (SQLite for dev, PostgreSQL for prod)
 */

import { QueryClient, type SharedCacheAdapter } from '@ts-query/core';

// ============================================================================
// In-Memory Adapter (for development / single-process)
// ============================================================================

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class InMemoryAdapter implements SharedCacheAdapter {
  private store = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  // Debug helper
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// ============================================================================
// Create the QueryClient with tiered caching
// ============================================================================

const sharedCacheAdapter = new InMemoryAdapter();

export const queryClient = new QueryClient({
  sharedCache: {
    adapter: sharedCacheAdapter,
    defaultTtl: 60_000, // 1 minute default
  },
});

// TTL constants for different data types
export const CACHE_TTL = {
  GAME_STATE: 5_000, // 5 seconds - frequently updated
  LEADERBOARD: 30_000, // 30 seconds - expensive query, updates less often
  PLAYER_STATS: 10_000, // 10 seconds - viewed by others
} as const;

// Metrics for monitoring
export function getCacheStats() {
  return sharedCacheAdapter.getStats();
}
