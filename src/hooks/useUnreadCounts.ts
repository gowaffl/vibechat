import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { api } from "@/lib/api";
import { setBadgeCount } from "@/lib/notifications";
import { supabaseClient } from "@/lib/authClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface UnreadCount {
  chatId: string;
  unreadCount: number;
}

/**
 * Production-ready unread counts hook with realtime updates.
 * 
 * Strategy:
 * - Primary: Supabase Realtime subscriptions for instant updates
 * - Fallback: Polling every 30 seconds (reduced from 3s) for reliability
 * - Refreshes on app foreground and reconnect
 * - Badge count sync with deduplication
 */
export const useUnreadCounts = (userId: string | undefined, chatIds?: string[]) => {
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);
  const lastBadgeCount = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const chatIdsRef = useRef<Set<string>>(new Set());

  // Update chat IDs ref when chatIds changes
  useEffect(() => {
    if (chatIds) {
      chatIdsRef.current = new Set(chatIds);
    }
  }, [chatIds]);

  const query = useQuery<UnreadCount[]>({
    queryKey: ["unread-counts", userId],
    queryFn: () => api.get(`/api/chats/unread-counts?userId=${userId}`),
    enabled: !!userId,
    // Reduced polling interval since we rely primarily on realtime
    refetchInterval: 30000, // Poll every 30 seconds as fallback
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    refetchOnReconnect: true,
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  // Optimistically update unread counts based on realtime events
  const updateUnreadCount = useCallback((chatId: string, delta: number) => {
    queryClient.setQueryData<UnreadCount[]>(["unread-counts", userId], (old) => {
      if (!old) return old;
      
      return old.map((uc) => {
        if (uc.chatId === chatId) {
          const newCount = Math.max(0, uc.unreadCount + delta);
          return { ...uc, unreadCount: newCount };
        }
        return uc;
      });
    });
  }, [queryClient, userId]);

  // Subscribe to realtime events for unread count updates
  useEffect(() => {
    if (!userId) return;

    console.log('[UnreadCounts] Setting up realtime subscription');

    const channel = supabaseClient.channel(`unread-counts:${userId}`)
      // Listen for new messages to increment unread counts
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message',
        },
        (payload: any) => {
          const chatId = payload.new.chatId;
          const senderId = payload.new.userId;
          
          // Only increment if:
          // 1. The message is in one of the user's chats
          // 2. The message is NOT from the current user
          if (chatIdsRef.current.has(chatId) && senderId !== userId) {
            console.log('[UnreadCounts] New message in chat', chatId, 'incrementing unread');
            updateUnreadCount(chatId, 1);
          }
        }
      )
      // Listen for read receipts to update unread counts
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'read_receipt',
        },
        (payload: any) => {
          // If the current user created a read receipt, clear unread for that chat
          if (payload.new.userId === userId) {
            const chatId = payload.new.chatId;
            console.log('[UnreadCounts] Read receipt created for chat', chatId, 'clearing unread');
            queryClient.setQueryData<UnreadCount[]>(["unread-counts", userId], (old) => {
              if (!old) return old;
              return old.map((uc) => 
                uc.chatId === chatId ? { ...uc, unreadCount: 0 } : uc
              );
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'read_receipt',
        },
        (payload: any) => {
          // If the current user updated their read receipt, clear unread for that chat
          if (payload.new.userId === userId) {
            const chatId = payload.new.chatId;
            console.log('[UnreadCounts] Read receipt updated for chat', chatId, 'clearing unread');
            queryClient.setQueryData<UnreadCount[]>(["unread-counts", userId], (old) => {
              if (!old) return old;
              return old.map((uc) => 
                uc.chatId === chatId ? { ...uc, unreadCount: 0 } : uc
              );
            });
          }
        }
      );

    channel.subscribe((status) => {
      console.log('[UnreadCounts] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        // Fetch fresh data after successful subscription
        query.refetch();
      }
    });

    channelRef.current = channel;

    return () => {
      console.log('[UnreadCounts] Cleaning up realtime subscription');
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, updateUnreadCount, queryClient, query]);

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

  // Refetch and update badge when app comes to foreground
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

  return {
    ...query,
    // Expose updateUnreadCount for manual updates (e.g., when entering a chat)
    updateUnreadCount,
    // Force clear unread for a specific chat
    clearUnreadForChat: useCallback((chatId: string) => {
      queryClient.setQueryData<UnreadCount[]>(["unread-counts", userId], (old) => {
        if (!old) return old;
        return old.map((uc) => 
          uc.chatId === chatId ? { ...uc, unreadCount: 0 } : uc
        );
      });
    }, [queryClient, userId]),
  };
};
