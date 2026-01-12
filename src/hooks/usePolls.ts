import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabaseClient } from "@/lib/authClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  Poll,
  CreatePollRequest,
  VotePollRequest,
} from "@shared/contracts";

export function usePolls(chatId: string, userId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Get all polls for a chat
  const {
    data: polls,
    isLoading,
    refetch,
  } = useQuery<Poll[]>({
    queryKey: ["polls", chatId],
    queryFn: async () => {
      console.log("[usePolls] Fetching polls for chat:", chatId, "user:", userId);
      const result = await api.get<Poll[]>(`/api/polls/${chatId}?userId=${userId}`);
      console.log("[usePolls] Fetched polls:", result?.length, "polls");
      return result;
    },
    enabled: !!chatId && !!userId,
  });

  // Stable refetch callback to avoid subscription recreation
  const stableRefetch = useCallback(() => {
    console.log("[usePolls] Realtime triggered refetch for chat:", chatId);
    refetch();
  }, [refetch, chatId]);

  // Subscribe to realtime updates for polls
  useEffect(() => {
    if (!chatId || !userId) return;

    console.log(`[usePolls] Setting up realtime subscription for chat: ${chatId}`);

    // Clean up existing channel
    if (channelRef.current) {
      supabaseClient.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabaseClient.channel(`polls:${chatId}`);

    // Listen for new polls created in this chat
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'poll',
        filter: `chatId=eq.${chatId}`,
      },
      (payload: any) => {
        console.log('[usePolls] New poll created:', payload.new?.id);
        stableRefetch();
      }
    );

    // Listen for poll updates (status changes, closures)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'poll',
        filter: `chatId=eq.${chatId}`,
      },
      (payload: any) => {
        console.log('[usePolls] Poll updated:', payload.new?.id, 'status:', payload.new?.status);
        stableRefetch();
      }
    );

    // Listen for vote changes (INSERT, UPDATE, DELETE)
    // Note: poll_vote doesn't have chatId, so we listen to all and let refetch filter
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'poll_vote',
      },
      (payload: any) => {
        console.log('[usePolls] Vote change detected:', payload.eventType);
        stableRefetch();
      }
    );

    channel.subscribe((status) => {
      console.log(`[usePolls] Realtime subscription status for chat ${chatId}:`, status);
    });

    channelRef.current = channel;

    // Cleanup on unmount or when chatId/userId changes
    return () => {
      console.log(`[usePolls] Cleaning up realtime subscription for chat: ${chatId}`);
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId, userId, stableRefetch]);

  // Create poll
  const createPollMutation = useMutation({
    mutationFn: async (request: Omit<CreatePollRequest, "chatId" | "creatorId">) => {
      console.log("[usePolls] Creating poll with request:", { chatId, creatorId: userId, ...request });
      const result = await api.post<Poll>("/api/polls", {
        chatId,
        creatorId: userId,
        ...request,
      });
      console.log("[usePolls] Poll created successfully:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[usePolls] onSuccess called, invalidating queries for chatId:", chatId);
      console.log("[usePolls] Created poll data:", data);
      queryClient.invalidateQueries({ queryKey: ["polls", chatId] });
      // Also invalidate messages to show the poll message
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
    onError: (error) => {
      console.error("[usePolls] Failed to create poll:", error);
    },
  });

  // Vote on poll option
  const voteMutation = useMutation({
    mutationFn: async ({
      pollId,
      optionId,
    }: {
      pollId: string;
      optionId: string;
    }) => {
      console.log("[usePolls] Voting on poll:", { pollId, optionId, userId });
      const result = await api.post<Poll>(`/api/polls/${pollId}/vote`, {
        userId,
        optionId,
      });
      console.log("[usePolls] Vote successful:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls", chatId] });
      // Also invalidate messages in case results message was sent
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
    onError: (error) => {
      console.error("[usePolls] Failed to vote:", error);
    },
  });

  // Close poll manually
  const closePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      console.log("[usePolls] Closing poll:", pollId);
      return api.patch<Poll>(`/api/polls/${pollId}/close`, {
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls", chatId] });
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
    onError: (error) => {
      console.error("[usePolls] Failed to close poll:", error);
    },
  });

  return {
    polls: polls || [],
    isLoading,
    refetch,
    createPoll: createPollMutation.mutate,
    isCreating: createPollMutation.isPending,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
    closePoll: closePollMutation.mutate,
    isClosing: closePollMutation.isPending,
  };
}

