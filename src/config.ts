/**
 * Global Configuration
 * 
 * Centralized configuration for the application.
 * The backend URL is resolved from environment variables with a localhost fallback.
 */

export const BACKEND_URL = 
  process.env.EXPO_PUBLIC_API_URL || 
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 
  "http://localhost:3000";

if (!process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL) {
  // Only warn in development or if specifically needed
  if (__DEV__) {
    console.warn("⚠️ Backend URL not set in env. Using default:", BACKEND_URL);
  }
}

