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

/**
 * PostHog Configuration
 * 
 * PostHog is used for product analytics and feature tracking.
 * Set EXPO_PUBLIC_POSTHOG_API_KEY and optionally EXPO_PUBLIC_POSTHOG_HOST in your environment.
 */
export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "";
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (!process.env.EXPO_PUBLIC_POSTHOG_API_KEY) {
  if (__DEV__) {
    console.warn("⚠️ PostHog API key not set. Analytics will be disabled.");
  }
}

/**
 * RevenueCat Configuration
 * 
 * RevenueCat is used for subscription management and in-app purchases.
 * Set EXPO_PUBLIC_REVENUECAT_API_KEY in your environment.
 * The API key provided is the test key - replace with production key for release builds.
 */
export const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "test_yRYvtLzmxZeukKZSqwKPYpSXpTE";

if (!process.env.EXPO_PUBLIC_REVENUECAT_API_KEY) {
  if (__DEV__) {
    console.warn("⚠️ RevenueCat API key not set in env. Using test key.");
  }
}
