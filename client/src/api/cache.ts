/**
 * UpVolt API Cache Manager
 * Provides intelligent in-memory caching, in-flight request deduplication,
 * and automatic cache invalidation upon mutations.
 */

export interface CacheOptions {
  ttl?: number;          // Time-to-live in milliseconds
  bypassCache?: boolean; // Force fresh network fetch if true
  cacheKey?: string;     // Custom override for cache key
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiCacheManager {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Determine default TTL for specific endpoints (in milliseconds)
   */
  private getDefaultTtl(url: string): number {
    if (url.includes('/categories') || url.includes('/settings')) {
      return 5 * 60 * 1000; // 5 minutes (rarely change)
    }
    if (url.includes('/customers') || url.includes('/suppliers')) {
      return 3 * 60 * 1000; // 3 minutes
    }
    if (url.includes('/products')) {
      return 2 * 60 * 1000; // 2 minutes
    }
    if (url.includes('/orders/trash')) {
      return 60 * 1000; // 1 minute
    }
    if (url.includes('/orders')) {
      return 60 * 1000; // 1 minute
    }
    if (url.includes('/reports') || url.includes('/dashboard')) {
      return 60 * 1000; // 1 minute
    }
    if (url.includes('/colleges')) {
      return 2 * 60 * 1000; // 2 minutes
    }
    return 60 * 1000; // Default 1 minute
  }

  /**
   * Construct a deterministic cache key from URL and query parameters
   */
  public generateKey(url: string, params?: any): string {
    if (!params || typeof params !== 'object') return url;

    // Filter out undefined and sort keys alphabetically
    const keys = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null)
      .sort();

    if (keys.length === 0) return url;

    const query = keys
      .map((k) => `${k}=${encodeURIComponent(typeof params[k] === 'object' ? JSON.stringify(params[k]) : String(params[k]))}`)
      .join('&');

    return `${url}?${query}`;
  }

  /**
   * Retrieve cached data if valid
   */
  public get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    // Hard expiry after 3x TTL
    if (age > entry.ttl * 3) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data as T,
      isStale: age > entry.ttl,
    };
  }

  /**
   * Save data into cache
   */
  public set<T>(key: string, data: T, customTtl?: number): void {
    const ttl = customTtl ?? this.getDefaultTtl(key);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete a specific cache key
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a substring pattern
   */
  public invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data and in-flight promises
   */
  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Automatically invalidate related caches based on mutation URL
   */
  public handleMutation(url: string): void {
    const cleanUrl = url.toLowerCase();

    if (cleanUrl.includes('/orders')) {
      this.invalidate('/orders');
      this.invalidate('/products');
      this.invalidate('/reports');
      this.invalidate('/colleges');
      this.invalidate('/customers');
      this.dispatchDataChange('orders');
    } else if (cleanUrl.includes('/products')) {
      this.invalidate('/products');
      this.invalidate('/reports');
      this.invalidate('/categories');
      this.invalidate('/inventory');
      this.dispatchDataChange('products');
    } else if (cleanUrl.includes('/purchases')) {
      this.invalidate('/purchases');
      this.invalidate('/products');
      this.invalidate('/reports');
      this.invalidate('/inventory');
      this.dispatchDataChange('purchases');
    } else if (cleanUrl.includes('/inventory')) {
      this.invalidate('/inventory');
      this.invalidate('/products');
      this.invalidate('/reports');
      this.dispatchDataChange('inventory');
    } else if (cleanUrl.includes('/customers')) {
      this.invalidate('/customers');
      this.invalidate('/orders');
      this.dispatchDataChange('customers');
    } else if (cleanUrl.includes('/suppliers')) {
      this.invalidate('/suppliers');
      this.invalidate('/purchases');
      this.dispatchDataChange('suppliers');
    } else if (cleanUrl.includes('/categories')) {
      this.invalidate('/categories');
      this.invalidate('/products');
      this.dispatchDataChange('categories');
    } else if (cleanUrl.includes('/colleges')) {
      this.invalidate('/colleges');
      this.invalidate('/products');
      this.invalidate('/orders');
      this.dispatchDataChange('colleges');
    } else if (cleanUrl.includes('/settings')) {
      this.invalidate('/settings');
      this.dispatchDataChange('settings');
    } else if (cleanUrl.includes('/users')) {
      this.invalidate('/users');
      this.dispatchDataChange('users');
    }
  }

  private dispatchDataChange(entity: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('upvolt_data_changed', { detail: { entity } }));
    }
  }

  /**
   * Fetch with cache + in-flight deduplication
   */
  public async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // 1. Check cache if not bypassed
    if (!options?.bypassCache) {
      const cached = this.get<T>(key);
      if (cached && !cached.isStale) {
        return cached.data;
      }
    }

    // 2. Check in-flight requests (deduplication)
    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise) {
      return inFlightPromise as Promise<T>;
    }

    // 3. Initiate fetch and store in inFlight
    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, options?.ttl);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}

export const apiCache = new ApiCacheManager();
