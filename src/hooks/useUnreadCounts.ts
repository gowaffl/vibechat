import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { api } from "@/lib/api";
import { setBadgeCount } from "@/lib/notifications";

export interface UnreadCount {
  chatId: string;
  unreadCount: number;
}

/**
 * Shared hook for fetching unread message counts across all chats.
 * This prevents duplicate polling when multiple screens need unread counts.
 * React Query will automatically deduplicate requests with the same query key.
 * Also syncs the app icon badge count with total unread messages.
 * 
 * HIGH-10: Enhanced to ensure badge clears properly when entering app directly
 */
export const useUnreadCounts = (userId: string | undefined) => {
  const appState = useRef(AppState.currentState);
  const lastBadgeCount = useRef<number | null>(null);

  const query = useQuery<UnreadCount[]>({
    queryKey: ["unread-counts", userId],
    queryFn: () => api.get(`/api/chats/unread-counts?userId=${userId}`),
    enabled: !!userId,
    refetchInterval: 3000, // Poll every 3 seconds
    // HIGH-10: Enable refetch on mount to get fresh data when entering app
    refetchOnMount: true,
    // Prevent refetch on window focus to avoid excessive calls
    refetchOnWindowFocus: false,
    // Keep previous data while refetching to prevent UI flicker
    placeholderData: (previousData) => previousData,
    // HIGH-10: Ensure fresh data on reconnect
    refetchOnReconnect: true,
  });

  // Sync badge count whenever unread counts change
  useEffect(() => {
    if (query.data) {
      const totalUnread = query.data.reduce((sum, uc) => sum + uc.unreadCount, 0);
      // Only update badge if the count actually changed
      if (lastBadgeCount.current !== totalUnread) {
        setBadgeCount(totalUnread);
        lastBadgeCount.current = totalUnread;
      }
    }
  }, [query.data]);

  // HIGH-10: Refetch and update badge when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        userId
      ) {
        // App has come to foreground - refetch unread counts to update badge
        // Use a small delay to ensure server has processed any recent read receipts
        setTimeout(() => {
          query.refetch();
        }, 300);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [userId, query]);

  return query;
};

