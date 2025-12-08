/**
 * Simple in-memory rate limiter middleware for Hono
 * Uses sliding window algorithm with automatic cleanup
 */

import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Rate limit configuration per endpoint type
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

// Default configurations for different endpoint types
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Default rate limit
  default: { windowMs: 60000, maxRequests: 100 },  // 100 req/min
  
  // Heavy endpoints (AI, image generation)
  heavy: { windowMs: 60000, maxRequests: 20 },     // 20 req/min
  
  // Light endpoints (typing, health)
  light: { windowMs: 60000, maxRequests: 300 },    // 300 req/min
  
  // Auth endpoints (stricter to prevent brute force)
  auth: { windowMs: 60000, maxRequests: 10 },      // 10 req/min
};

// In-memory store: key -> RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 5 minutes
    if (now - entry.windowStart > 5 * 60000) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[RateLimiter] Cleaned ${cleaned} expired entries`);
  }
}, CLEANUP_INTERVAL);

/**
 * Get rate limit key from request (uses userId from query/body or IP)
 */
function getRateLimitKey(c: Context): string {
  // Try to get userId from query params or auth header
  const userId = c.req.query("userId");
  if (userId) return `user:${userId}`;
  
  // Fallback to IP address
  const forwarded = c.req.header("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

/**
 * Determine rate limit type based on path
 */
function getRateLimitType(path: string): keyof typeof RATE_LIMITS {
  // Heavy endpoints (AI, reactor, catchup - involve AI processing)
  if (path.includes("/ai/") || path.includes("/reactor/") || path.includes("/catchup/")) {
    return "heavy";
  }
  
  // Auth endpoints
  if (path.includes("/auth/")) {
    return "auth";
  }
  
  // Light endpoints (typing is now via Realtime, but keep for backward compat)
  if (path.includes("/typing") || path.includes("/health")) {
    return "light";
  }
  
  return "default";
}

/**
 * Rate limiter middleware factory
 */
export function rateLimiter(customConfig?: Partial<RateLimitConfig>) {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    const key = getRateLimitKey(c);
    const limitType = getRateLimitType(path);
    const config = { ...RATE_LIMITS[limitType], ...customConfig };
    
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    
    if (!entry || now - entry.windowStart >= config.windowMs) {
      // New window
      rateLimitStore.set(key, { count: 1, windowStart: now });
    } else {
      // Within window
      if (entry.count >= config.maxRequests) {
        // Rate limited
        const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000);
        
        console.warn(`[RateLimiter] Rate limit exceeded for ${key} on ${path} (${entry.count}/${config.maxRequests})`);
        
        c.header("Retry-After", String(retryAfter));
        c.header("X-RateLimit-Limit", String(config.maxRequests));
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", String(Math.ceil((entry.windowStart + config.windowMs) / 1000)));
        
        return c.json(
          { 
            error: "Too many requests", 
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
            retryAfter 
          },
          429
        );
      }
      
      entry.count++;
    }
    
    // Add rate limit headers to response
    const currentEntry = rateLimitStore.get(key)!;
    c.header("X-RateLimit-Limit", String(config.maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, config.maxRequests - currentEntry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil((currentEntry.windowStart + config.windowMs) / 1000)));
    
    await next();
  };
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): { totalEntries: number; uniqueUsers: number; uniqueIPs: number } {
  let uniqueUsers = 0;
  let uniqueIPs = 0;
  
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith("user:")) uniqueUsers++;
    else if (key.startsWith("ip:")) uniqueIPs++;
  }
  
  return {
    totalEntries: rateLimitStore.size,
    uniqueUsers,
    uniqueIPs,
  };
}

