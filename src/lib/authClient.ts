import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// Create Supabase auth client for phone authentication
// This handles SMS OTP verification flows from the mobile app
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required. Check your environment variables.");
}

// Custom storage implementation using Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helper functions
export const authClient = {
  /**
   * Send SMS OTP to phone number
   */
  sendOtp: async (phone: string) => {
    return await supabaseClient.auth.signInWithOtp({ phone });
  },

  /**
   * Verify SMS OTP code
   */
  verifyOtp: async (phone: string, code: string) => {
    return await supabaseClient.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    return await supabaseClient.auth.signOut();
  },

  /**
   * Get current session
   */
  getSession: async () => {
    return await supabaseClient.auth.getSession();
  },

  /**
   * Get auth token for API requests
   */
  getToken: async () => {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token || null;
  },

  /**
   * Get user ID
   */
  getUserId: async () => {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.user?.id || null;
  },

  /**
   * Get user phone
   */
  getPhone: async () => {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.user?.phone || null;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback: (session: any) => void) => {
    return supabaseClient.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },

  /**
   * Get cookie (for backward compatibility with old API client)
   */
  getCookie: () => {
    // Not needed for Supabase auth - return empty string
    return "";
  },
};
