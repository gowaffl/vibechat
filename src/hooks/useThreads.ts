import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Thread,
  CreateThreadRequest,
  UpdateThreadRequest,
  Message,
} from "@shared/contracts";

export function useThreads(chatId: string, userId: string) {
  const queryClient = useQueryClient();

  // Get all threads for a chat
  const {
    data: threads,
    isLoading,
    refetch,
  } = useQuery<Thread[]>({
    queryKey: ["threads", chatId],
    queryFn: async () => {
      return api.get<Thread[]>(`/api/threads/${chatId}?userId=${userId}`);
    },
  });

  // Create thread
  const createThreadMutation = useMutation({
    mutationFn: async (
      request: Omit<CreateThreadRequest, "chatId" | "creatorId">
    ) => {
      console.log("[useThreads] Creating thread with request:", { chatId, creatorId: userId, ...request });
      const result = await api.post<Thread>("/api/threads", {
        chatId,
        creatorId: userId,
        ...request,
      });
      console.log("[useThreads] Thread created successfully:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[useThreads] onSuccess called, invalidating queries for chatId:", chatId);
      console.log("[useThreads] Created thread data:", data);
      queryClient.invalidateQueries({ queryKey: ["threads", chatId] });
    },
    onError: (error) => {
      console.error("[useThreads] Failed to create thread:", error);
    },
  });

  // Update thread
  const updateThreadMutation = useMutation({
    mutationFn: async ({
      threadId,
      ...updates
    }: Omit<UpdateThreadRequest, "userId"> & { threadId: string }) => {
      return api.patch<Thread>(`/api/threads/${threadId}`, {
        userId,
        ...updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads", chatId] });
    },
  });

  // Delete thread
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return api.delete<{ success: boolean }>(`/api/threads/${threadId}?userId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads", chatId] });
    },
  });

  // Reorder threads
  const reorderThreadsMutation = useMutation({
    mutationFn: async (items: { threadId: string; sortOrder: number }[]) => {
      return api.post<{ success: boolean }>("/api/threads/reorder", {
        chatId,
        userId,
        items,
      });
    },
    onSuccess: () => {
      // We invalidate to ensure we have the canonical order from server
      queryClient.invalidateQueries({ queryKey: ["threads", chatId] });
    },
  });

  return {
    threads: threads || [],
    isLoading,
    refetch,
    createThread: createThreadMutation.mutate,
    isCreating: createThreadMutation.isPending,
    updateThread: updateThreadMutation.mutate,
    isUpdating: updateThreadMutation.isPending,
    deleteThread: deleteThreadMutation.mutate,
    isDeleting: deleteThreadMutation.isPending,
    reorderThreads: reorderThreadsMutation.mutate,
  };
}

// Hook to get messages for a specific thread
export function useThreadMessages(threadId: string | null, userId: string) {
  const query = useQuery<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => {
      if (!threadId) {
        return { messages: [], hasMore: false, nextCursor: null };
      }
      return api.get<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(`/api/threads/${threadId}/messages?userId=${userId}`);
    },
    enabled: !!threadId, // Only run query if threadId is provided
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in memory for 30 minutes
  });

  return query;
}

