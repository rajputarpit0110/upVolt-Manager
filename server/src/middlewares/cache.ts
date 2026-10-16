import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  body: any;
  timestamp: number;
  ttl: number; // in milliseconds
  tag?: string;
}

const serverCache = new Map<string, CacheEntry>();

/**
 * Invalidate server cache entries matching a tag or URL substring
 */
export const invalidateServerCache = (tagOrPattern?: string): void => {
  if (!tagOrPattern) {
    serverCache.clear();
    return;
  }
  const clean = tagOrPattern.toLowerCase();
  for (const [key, entry] of serverCache.entries()) {
    if (entry.tag && entry.tag.toLowerCase().includes(clean)) {
      serverCache.delete(key);
    } else if (key.toLowerCase().includes(clean)) {
      serverCache.delete(key);
    }
  }
};

/**
 * Express middleware for in-memory response caching
 */
export const serverCacheMiddleware = (options: { ttlSeconds?: number; tag?: string } = {}) => {
  const ttlMs = (options.ttlSeconds || 60) * 1000;
  const tag = options.tag;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Role and college sensitive cache key to avoid privilege leaks
    const userRole = req.user?.role || 'ANON';
    const userCollege = req.user?.college || 'ALL';
    const cacheKey = `${req.originalUrl || req.url}#${userRole}#${userCollege}`;

    const cached = serverCache.get(cacheKey);
    if (cached) {
      if (Date.now() - cached.timestamp < cached.ttl) {
        res.setHeader('X-Server-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        res.send(cached.body);
        return;
      } else {
        serverCache.delete(cacheKey);
      }
    }

    res.setHeader('X-Server-Cache', 'MISS');

    // Capture response body on send
    const originalSend = res.send.bind(res);
    res.send = (body: any): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        serverCache.set(cacheKey, {
          body,
          timestamp: Date.now(),
          ttl: ttlMs,
          tag,
        });
      }
      return originalSend(body);
    };

    next();
  };
};

/**
 * Middleware to automatically invalidate relevant cache entries when mutations happen
 */
export const autoInvalidateCacheMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const url = (req.originalUrl || req.url).toLowerCase();
    
    // Invalidate on finish so we only invalidate if request doesn't throw a server error
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        if (url.includes('/orders')) {
          invalidateServerCache('orders');
          invalidateServerCache('reports');
          invalidateServerCache('products');
          invalidateServerCache('colleges');
        } else if (url.includes('/products')) {
          invalidateServerCache('products');
          invalidateServerCache('reports');
          invalidateServerCache('categories');
        } else if (url.includes('/purchases')) {
          invalidateServerCache('purchases');
          invalidateServerCache('products');
          invalidateServerCache('reports');
        } else if (url.includes('/categories')) {
          invalidateServerCache('categories');
          invalidateServerCache('products');
        } else if (url.includes('/colleges')) {
          invalidateServerCache('colleges');
          invalidateServerCache('products');
          invalidateServerCache('orders');
        } else if (url.includes('/customers')) {
          invalidateServerCache('customers');
          invalidateServerCache('orders');
        } else if (url.includes('/suppliers')) {
          invalidateServerCache('suppliers');
          invalidateServerCache('purchases');
        } else if (url.includes('/users')) {
          invalidateServerCache('users');
        }
      }
    });
  }
  next();
};
