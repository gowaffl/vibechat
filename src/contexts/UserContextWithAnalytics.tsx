/**
 * Enhanced UserContext with PostHog Analytics Integration
 * 
 * This is an enhanced version of UserContext that includes automatic
 * user identification and property tracking for PostHog analytics.
 * 
 * TO IMPLEMENT: Replace your existing UserContext.tsx with this file
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/shared/contracts";
import { api } from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { authClient } from "@/lib/authClient";
import { useAnalytics } from "@/hooks/useAnalytics";
import * as Device from "expo-device";
import * as Application from "expo-application";
import { Platform } from "react-native";

interface UserContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  updateUser: (updates: {
    name?: string;
    bio?: string;
    image?: string;
    birthdate?: string;
    hasCompletedOnboarding?: boolean;
    summaryPreference?: "concise" | "detailed";
    hasSeenSummaryPreferencePrompt?: boolean;
    translationPreference?: "enabled" | "disabled";
    preferredLanguage?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const analytics = useAnalytics();

  useEffect(() => {
    initializeUser();

    // Listen for auth state changes
    const { data: authListener } = authClient.onAuthStateChange(async (session) => {
      if (session) {
        await fetchUser();
      } else {
        setUser(null);
        // Reset analytics on sign out
        analytics.reset();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Identify user and set properties when user changes
  useEffect(() => {
    if (user) {
      identifyUser(user);
    }
  }, [user, analytics]);

  /**
   * Identify user in PostHog with all relevant properties
   */
  const identifyUser = async (userData: User) => {
    try {
      // Calculate days since signup
      const daysSinceSignup = userData.createdAt
        ? Math.floor((Date.now() - new Date(userData.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Get device info
      const deviceInfo = {
        platform: Platform.OS,
        device_model: Device.modelName || "unknown",
        os_version: Platform.Version?.toString() || "unknown",
        app_version: Application.nativeApplicationVersion || "unknown",
      };

      // Identify user with ID and email (if available)
      analytics.identify(userData.id, {
        // Identity
        name: userData.name,
        phone: userData.phone ? `***${userData.phone.slice(-4)}` : undefined, // Partially masked for privacy
        created_at: userData.createdAt,

        // Onboarding status
        has_completed_onboarding: userData.hasCompletedOnboarding,
        days_since_signup: daysSinceSignup,

        // Preferences
        preferred_language: userData.preferredLanguage || "en",
        summary_preference: userData.summaryPreference || "concise",
        translation_enabled: userData.translationPreference === "enabled",

        // Device info
        ...deviceInfo,
      });

      console.log("[Analytics] User identified:", userData.id);
    } catch (error) {
      console.error("[Analytics] Failed to identify user:", error);
    }
  };

  const initializeUser = async () => {
    try {
      // Check if user is already authenticated with Supabase
      const { data: { session } } = await authClient.getSession();

      if (session) {
        // User is authenticated - fetch their profile
        await fetchUser();
      } else {
        // User needs to authenticate with phone number
        console.log("[UserContext] No session found - user needs to authenticate");
      }
    } catch (error) {
      console.error("[UserContext] Failed to initialize user:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    try {
      const userId = await authClient.getUserId();
      if (!userId) {
        console.error("[UserContext] No user ID found");
        return;
      }

      // Fetch user profile from backend
      try {
        const userData = await api.get<User>(`/api/users/${userId}`);
        setUser(userData);

        // Register for push notifications after user is loaded and has completed onboarding
        if (userData.hasCompletedOnboarding) {
          registerForPushNotificationsAsync(userData.id).catch((error) => {
            console.error("[UserContext] Failed to register for push notifications:", error);
          });
        }
      } catch (apiError: any) {
        // If user not found in DB but has session (stuck state), sign them out
        if (apiError.message && apiError.message.includes("404")) {
          console.warn("[UserContext] User has session but no DB record. Signing out to reset.");
          await authClient.signOut();
          setUser(null);
          analytics.reset();
        } else {
          throw apiError;
        }
      }
    } catch (error) {
      console.error("[UserContext] Failed to fetch user:", error);
    }
  };

  const updateUser = async (updates: {
    name?: string;
    bio?: string;
    image?: string;
    birthdate?: string;
    hasCompletedOnboarding?: boolean;
    summaryPreference?: "concise" | "detailed";
    hasSeenSummaryPreferencePrompt?: boolean;
    translationPreference?: "enabled" | "disabled";
    preferredLanguage?: string;
  }) => {
    if (!user) {
      console.error("[UserContext] Cannot update user - user is null");
      throw new Error("Cannot update user - user is null. Please restart the app.");
    }

    try {
      const updatedUser = await api.patch<User>(`/api/users/${user.id}`, updates);
      setUser(updatedUser);

      // Track profile update
      analytics.capture("profile_updated", {
        fields_updated: Object.keys(updates),
      });

      // Track onboarding completion
      if (updates.hasCompletedOnboarding && !user.hasCompletedOnboarding) {
        analytics.capture("onboarding_completed");

        // Register for push notifications
        registerForPushNotificationsAsync(updatedUser.id).catch((error) => {
          console.error("[UserContext] Failed to register for push notifications:", error);
        });
      }

      // Update user properties in PostHog
      analytics.setUserProperties({
        has_completed_onboarding: updatedUser.hasCompletedOnboarding,
        summary_preference: updatedUser.summaryPreference,
        translation_enabled: updatedUser.translationPreference === "enabled",
        preferred_language: updatedUser.preferredLanguage,
      });
    } catch (error) {
      console.error("[UserContext] Failed to update user:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Track sign out event
      analytics.capture("user_signed_out");

      await authClient.signOut();
      setUser(null);

      // Reset analytics (clears user identification)
      analytics.reset();
    } catch (error) {
      console.error("[UserContext] Failed to sign out:", error);
    }
  };

  const isAuthenticated = !!user;

  return (
    <UserContext.Provider value={{ user, loading, isAuthenticated, updateUser, signOut }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
};
