import { api } from "../lib/api";
import type { AIFriend, CreateAIFriendRequest, UpdateAIFriendRequest } from "@shared/contracts";

export const aiFriendsApi = {
  // Get all AI friends for a chat
  getAIFriends: async (chatId: string, userId: string): Promise<AIFriend[]> => {
    return api.get<AIFriend[]>(`/api/ai-friends/${chatId}?userId=${userId}`);
  },

  // Create new AI friend
  createAIFriend: async (data: CreateAIFriendRequest): Promise<AIFriend> => {
    return api.post<AIFriend>("/api/ai-friends", data);
  },

  // Update AI friend
  updateAIFriend: async (aiFriendId: string, data: UpdateAIFriendRequest): Promise<AIFriend> => {
    return api.patch<AIFriend>(`/api/ai-friends/${aiFriendId}`, data);
  },

  // Delete AI friend
  deleteAIFriend: async (aiFriendId: string, userId: string): Promise<{ success: boolean; message: string }> => {
    return api.delete(`/api/ai-friends/${aiFriendId}`, { userId });
  },

  // Reorder AI friends
  reorderAIFriends: async (chatId: string, userId: string, items: Array<{ aiFriendId: string; sortOrder: number }>): Promise<{ success: boolean; message: string }> => {
    return api.patch("/api/ai-friends/reorder", { chatId, userId, items });
  },
};

