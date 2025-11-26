import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface UnreadCount {
  chatId: string;
  unreadCount: number;
}

/**
 * Shared hook for fetching unread message counts across all chats.
 * This prevents duplicate polling when multiple screens need unread counts.
 * React Query will automatically deduplicate requests with the same query key.
 */
export const useUnreadCounts = (userId: string | undefined) => {
  return useQuery<UnreadCount[]>({
    queryKey: ["unread-counts", userId],
    queryFn: () => api.get(`/api/chats/unread-counts?userId=${userId}`),
    enabled: !!userId,
    refetchInterval: 3000, // Poll every 3 seconds
    // Prevent refetch on window focus to avoid excessive calls
    refetchOnWindowFocus: false,
    // Keep previous data while refetching to prevent UI flicker
    placeholderData: (previousData) => previousData,
  });
};

