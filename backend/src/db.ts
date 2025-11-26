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
