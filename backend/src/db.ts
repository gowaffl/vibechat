import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// ============================================
// Supabase Database Client
// ============================================
// This is a singleton instance of the Supabase client
// Used throughout the application for database operations
//
// Usage:
//   import { db } from "./db";
//   const { data, error } = await db.from('user').select('*');
//
// The database schema is managed through Supabase migrations

/**
 * Admin client with service role key for server-side operations
 * This bypasses Row Level Security (RLS) policies
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-client-info": "vibeChat-backend",
      },
    },
    // Realtime connection settings - keep connection alive
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Main database client (alias for admin client)
 * Used for most server-side database operations
 */
export const db = supabaseAdmin;

/**
 * Create a Supabase client for a specific user session
 * Use this when you need to respect RLS policies for a specific user
 * 
 * @param accessToken - User's JWT access token
 * @returns Supabase client scoped to the user
 */
export function createUserClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Alias for backwards compatibility
export const supabase = db;

/**
 * Execute a query with automatic retry on connection failures
 * This helps handle stale connections that may occur after periods of inactivity
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any; status?: number; statusText?: string }>,
  maxRetries = 2,
  retryDelay = 100
): Promise<{ data: T | null; error: any; status?: number; statusText?: string }> {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();
      
      // If we got a successful response or a legitimate error (not connection issue), return it
      if (result.status && result.status < 500) {
        return result;
      }
      
      // If no error and we have data, return success
      if (!result.error || result.data !== null) {
        return result;
      }
      
      // Check for connection-related errors
      const errorMessage = result.error?.message?.toLowerCase() || "";
      const isConnectionError = 
        errorMessage.includes("fetch") ||
        errorMessage.includes("network") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("econnreset") ||
        result.status === 0 ||
        result.status === undefined;
      
      if (!isConnectionError) {
        // Not a connection error, return immediately
        return result;
      }
      
      lastError = result;
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.warn(`[DB] Connection error detected, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    } catch (error) {
      lastError = { data: null, error };
      
      if (attempt < maxRetries) {
        console.warn(`[DB] Query exception, retrying (${attempt + 1}/${maxRetries})...`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }
  
  console.error(`[DB] Query failed after ${maxRetries + 1} attempts`);
  return lastError || { data: null, error: new Error("Query failed after retries") };
}
