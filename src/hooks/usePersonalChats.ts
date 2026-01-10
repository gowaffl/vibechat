/**
 * usePersonalChats Hook
 * 
 * Provides data fetching and mutations for personal chat conversations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import type {
  PersonalConversation,
  GetPersonalConversationsResponse,
  GetPersonalConversationResponse,
  CreatePersonalConversationResponse,
  DeletePersonalConversationResponse,
  BulkDeletePersonalConversationsResponse,
  GetTopAgentsResponse,
  GetAllUserAgentsResponse,
  AIFriend,
  PersonalChatFolder,
  GetFoldersResponse,
  CreateFolderResponse,
  UpdateFolderResponse,
  DeleteFolderResponse,
  MoveConversationToFolderResponse,
} from "@/shared/contracts";

// Query keys for personal chats
export const personalChatsKeys = {
  all: ["personal-chats"] as const,
  conversations: (userId: string) => [...personalChatsKeys.all, "conversations", userId] as const,
  conversation: (conversationId: string) => [...personalChatsKeys.all, "conversation", conversationId] as const,
  topAgents: (userId: string) => [...personalChatsKeys.all, "top-agents", userId] as const,
  allAgents: (userId: string) => [...personalChatsKeys.all, "all-agents", userId] as const,
  folders: (userId: string) => [...personalChatsKeys.all, "folders", userId] as const,
};

/**
 * Hook to fetch all personal conversations for the current user
 */
export function usePersonalConversations() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: personalChatsKeys.conversations(user?.id || ""),
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      // Backend returns conversations array directly
      const response = await api.get<PersonalConversation[]>(
        `/api/personal-chats?userId=${user.id}`
      );
      return response || [];
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a specific conversation with its messages
 */
export function usePersonalConversation(conversationId: string | null) {
  const { user } = useUser();
  
  return useQuery({
    queryKey: personalChatsKeys.conversation(conversationId || ""),
    queryFn: async () => {
      if (!user?.id || !conversationId) throw new Error("Missing required data");
      return api.get<GetPersonalConversationResponse>(
        `/api/personal-chats/${conversationId}?userId=${user.id}`
      );
    },
    enabled: !!user?.id && !!conversationId,
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Hook to fetch user's top most-used agents
 */
export function useTopAgents(limit: number = 3) {
  const { user } = useUser();
  
  return useQuery({
    queryKey: personalChatsKeys.topAgents(user?.id || ""),
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      // Backend returns array of { userId, aiFriendId, usageCount, aiFriend: {...} } directly
      const response = await api.get<any[]>(
        `/api/personal-chats/top-agents?userId=${user.id}&limit=${limit}`
      );
      // Extract aiFriend from each usage record
      return (response || []).map((item: any) => item.aiFriend).filter(Boolean) as AIFriend[];
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch all agents available to the user (from all their chats)
 * Returns agents sorted by creation date (newest first) for "most recent" fallback
 */
export function useAllUserAgents() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: personalChatsKeys.allAgents(user?.id || ""),
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      // Backend returns array of AI friends directly
      const response = await api.get<AIFriend[]>(
        `/api/personal-chats/all-agents?userId=${user.id}`
      );
      // Sort by createdAt descending (newest first) for "most recent" fallback
      const agents = response || [];
      return agents.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to create a new personal conversation
 */
export function useCreatePersonalConversation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { aiFriendId?: string | null; title?: string }) => {
      if (!user?.id) throw new Error("User not authenticated");
      // POST to /api/personal-chats to create new conversation
      const response = await api.post<{ id: string; userId: string; aiFriendId: string | null; title: string; lastMessageAt: string | null; createdAt: string; updatedAt: string; aiFriend: any | null }>("/api/personal-chats", {
        userId: user.id,
        ...data,
      });
      return { conversation: response };
    },
    onSuccess: () => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "")
      });
    },
  });
}

/**
 * Hook to delete a personal conversation
 */
export function useDeletePersonalConversation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      return api.delete<DeletePersonalConversationResponse>(
        `/api/personal-chats/${conversationId}`,
        { userId: user.id }
      );
    },
    onSuccess: () => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "")
      });
    },
  });
}

/**
 * Hook to bulk delete personal conversations
 */
export function useBulkDeletePersonalConversations() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationIds: string[]) => {
      if (!user?.id) throw new Error("User not authenticated");
      return api.delete<BulkDeletePersonalConversationsResponse>(
        "/api/personal-chats/bulk",
        { userId: user.id, conversationIds }
      );
    },
    onSuccess: () => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "")
      });
    },
  });
}

/**
 * Hook to update a personal conversation (title, agent)
 */
export function useUpdatePersonalConversation() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      conversationId: string; 
      title?: string; 
      aiFriendId?: string | null 
    }) => {
      if (!user?.id) throw new Error("User not authenticated");
      const { conversationId, ...updateData } = data;
      return api.patch<PersonalConversation>(
        `/api/personal-chats/${conversationId}`,
        { userId: user.id, ...updateData }
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate conversations list and specific conversation
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "")
      });
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversation(variables.conversationId)
      });
    },
  });
}


// ============================================================================
// FOLDER HOOKS
// ============================================================================

/**
 * Hook to fetch all folders for the current user
 */
export function useFolders() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: personalChatsKeys.folders(user?.id || ""),
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const response = await api.get<PersonalChatFolder[]>(
        `/api/personal-chats/folders?userId=${user.id}`
      );
      return response || [];
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to create a new folder
 */
export function useCreateFolder() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      return api.post<CreateFolderResponse>("/api/personal-chats/folders", {
        userId: user.id,
        name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.folders(user?.id || "")
      });
    },
  });
}

/**
 * Hook to update a folder (rename)
 */
export function useUpdateFolder() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { folderId: string; name?: string; sortOrder?: number }) => {
      if (!user?.id) throw new Error("User not authenticated");
      const { folderId, ...updateData } = data;
      return api.patch<UpdateFolderResponse>(
        `/api/personal-chats/folders/${folderId}`,
        { userId: user.id, ...updateData }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.folders(user?.id || "")
      });
    },
  });
}

/**
 * Hook to delete a folder
 */
export function useDeleteFolder() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (folderId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      return api.delete<DeleteFolderResponse>(
        `/api/personal-chats/folders/${folderId}`,
        { userId: user.id }
      );
    },
    onSuccess: () => {
      // Invalidate both folders and conversations (conversations may have moved)
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.folders(user?.id || "")
      });
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "")
      });
    },
  });
}

/**
 * Hook to move a conversation to a folder (or remove from folder)
 */
export function useMoveConversationToFolder() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { conversationId: string; folderId: string | null }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return api.patch<MoveConversationToFolderResponse>(
        `/api/personal-chats/${data.conversationId}/folder`,
        { userId: user.id, folderId: data.folderId }
      );
    },
    onSuccess: () => {
      // Invalidate conversations and folders
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "")
      });
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.folders(user?.id || "")
      });
    },
  });
}
