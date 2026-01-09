import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/shared/contracts";
import { api } from "@/lib/api";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { authClient } from "@/lib/authClient";

interface UserContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  updateUser: (updates: { name?: string; bio?: string; image?: string; birthdate?: string; hasCompletedOnboarding?: boolean; summaryPreference?: "concise" | "detailed"; hasSeenSummaryPreferencePrompt?: boolean; translationPreference?: "enabled" | "disabled"; preferredLanguage?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeUser();

    // Listen for auth state changes
    const { data: authListener } = authClient.onAuthStateChange(async (session) => {
      if (session) {
        await fetchUser();
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

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
        } else {
          throw apiError;
        }
      }
    } catch (error) {
      console.error("[UserContext] Failed to fetch user:", error);
    }
  };

  const updateUser = async (updates: { name?: string; bio?: string; image?: string; birthdate?: string; hasCompletedOnboarding?: boolean; summaryPreference?: "concise" | "detailed"; hasSeenSummaryPreferencePrompt?: boolean; translationPreference?: "enabled" | "disabled"; preferredLanguage?: string }) => {
    if (!user) {
      console.error("[UserContext] Cannot update user - user is null");
      throw new Error("Cannot update user - user is null. Please restart the app.");
    }

    try {
      const updatedUser = await api.patch<User>(`/api/users/${user.id}`, updates);
      setUser(updatedUser);

      // Register for push notifications when user completes onboarding
      if (updates.hasCompletedOnboarding && !user.hasCompletedOnboarding) {
        registerForPushNotificationsAsync(updatedUser.id).catch((error) => {
          console.error("[UserContext] Failed to register for push notifications:", error);
        });
      }
    } catch (error) {
      console.error("[UserContext] Failed to update user:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
      setUser(null);
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
