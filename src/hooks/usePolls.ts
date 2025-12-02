import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Poll,
  CreatePollRequest,
  VotePollRequest,
} from "@shared/contracts";

export function usePolls(chatId: string, userId: string) {
  const queryClient = useQueryClient();

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

