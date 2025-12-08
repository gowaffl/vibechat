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
// Note: Limits are per-user (when userId is available) or per-IP
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Default rate limit - increased to handle app startup burst
  default: { windowMs: 60000, maxRequests: 200 },  // 200 req/min
  
  // Heavy endpoints (AI, image generation)
  heavy: { windowMs: 60000, maxRequests: 30 },     // 30 req/min
  
  // Light endpoints (typing, health, unread counts)
  light: { windowMs: 60000, maxRequests: 600 },    // 600 req/min (10/sec)
  
  // Auth endpoints (stricter to prevent brute force)
  auth: { windowMs: 60000, maxRequests: 15 },      // 15 req/min
  
  // Message endpoints - higher limit for active chats
  messages: { windowMs: 60000, maxRequests: 300 }, // 300 req/min
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
  
  // Light endpoints (high-frequency reads)
  if (
    path.includes("/typing") || 
    path.includes("/health") ||
    path.includes("/unread-counts") ||
    path.includes("/presence")
  ) {
    return "light";
  }
  
  // Message endpoints - higher limit for active chat usage
  if (path.includes("/messages") || path.match(/\/chats\/[^/]+\/messages/)) {
    return "messages";
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

