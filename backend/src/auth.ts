import { db } from "./db";
import { env } from "./env";

// ============================================
// Supabase Auth Integration
// ============================================
// This module provides helper functions for Supabase phone authentication
// Supabase handles all authentication flows natively with phone/SMS OTP
//
// Flow:
//   1. User enters phone number
//   2. Supabase sends SMS with 6-digit code via Twilio
//   3. User enters code to verify
//   4. Supabase returns JWT token + user ID
//   5. Backend creates/updates user record with phone as identity
//
// Authentication happens entirely through Supabase Auth API
// No custom auth server needed!
console.log("🔐 [Auth] Using Supabase Phone Authentication");

/**
 * Verify a Supabase JWT token and return the user ID
 * This is used to authenticate API requests from the frontend
 */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { data, error } = await db.auth.getUser(token);
    
    if (error || !data.user) {
      console.error("[Auth] Token verification failed:", error);
      return null;
    }
    
    return data.user.id;
  } catch (error) {
    console.error("[Auth] Error verifying token:", error);
    return null;
  }
}

/**
 * Get user phone number from Supabase auth user
 */
export async function getUserPhone(userId: string): Promise<string | null> {
  try {
    const { data, error } = await db.auth.admin.getUserById(userId);
    
    if (error || !data.user) {
      console.error("[Auth] Failed to get user:", error);
      return null;
    }
    
    return data.user.phone || null;
  } catch (error) {
    console.error("[Auth] Error getting user phone:", error);
    return null;
  }
}

console.log("✅ [Auth] Supabase Auth helpers initialized");
