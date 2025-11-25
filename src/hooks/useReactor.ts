import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@shared/contracts";
import { Alert } from "react-native";
import { api } from "@/lib/api";

export function useReactor(chatId: string, userId: string) {
  const queryClient = useQueryClient();

  // Generate caption for media
  const captionMutation = useMutation({
    mutationFn: async (messageId: string) => {
      console.log("[Reactor] Generating caption for message:", messageId);
      const result = await api.post<Message>("/api/reactor/caption", {
        messageId,
        userId,
        chatId,
      });
      console.log("[Reactor] Caption generated successfully");
      return result;
    },
    onSuccess: () => {
      console.log("[Reactor] Caption success, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      Alert.alert("✨ Caption Ready!", "Check the chat for your AI-generated caption", [{ text: "OK" }]);
    },
    onError: (error: Error) => {
      console.log("[Reactor] Caption mutation error:", error);
      Alert.alert("❌ Caption Failed", error.message || "Could not generate caption. Please try again.", [{ text: "OK" }]);
    },
  });

  // Remix media with AI
  const remixMutation = useMutation({
    mutationFn: async ({
      messageId,
      remixPrompt,
    }: {
      messageId: string;
      remixPrompt: string;
    }) => {
      console.log("[Reactor] Remixing media:", messageId, "with prompt:", remixPrompt);
      const result = await api.post<Message>("/api/reactor/remix", {
        messageId,
        userId,
        chatId,
        remixPrompt,
      });
      console.log("[Reactor] Remix generated successfully, result:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[Reactor] Remix success with data:", data);
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      // Only show success alert if we actually got data back
      if (data && data.id) {
        console.log("[Reactor] Showing success alert");
        Alert.alert("🎨 Remix Ready!", "Your remixed image has been posted to the chat", [{ text: "OK" }]);
      }
    },
    onError: (error: Error) => {
      console.log("[Reactor] Remix mutation error:", error.message);
      console.log("[Reactor] Full error object:", error);
      // Invalidate queries anyway to refresh the chat - the remix might have succeeded
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      // Don't show error alert - if the remix actually succeeded, it will appear in the chat
      // If it truly failed, the user won't see the remixed image
    },
  });

  // Create meme from media
  const memeMutation = useMutation({
    mutationFn: async ({
      messageId,
      memePrompt,
    }: {
      messageId: string;
      memePrompt?: string;
    }) => {
      console.log("[Reactor] Creating meme from:", messageId, "prompt:", memePrompt);
      const result = await api.post<Message>("/api/reactor/meme-from-media", {
        messageId,
        userId,
        chatId,
        memePrompt,
      });
      console.log("[Reactor] Meme generated successfully");
      return result;
    },
    onSuccess: () => {
      console.log("[Reactor] Meme success, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      Alert.alert("😂 Meme Ready!", "Your hilarious meme has been posted to the chat", [{ text: "OK" }]);
    },
    onError: (error: Error) => {
      console.log("[Reactor] Meme mutation error:", error);
      console.log("[Reactor] Full error object:", error);
      // Invalidate queries anyway to refresh the chat - the meme might have succeeded
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      // Don't show error alert - if the meme actually succeeded, it will appear in the chat
      // If it truly failed, the user won't see the meme
    },
  });

  return {
    generateCaption: captionMutation.mutate,
    isGeneratingCaption: captionMutation.isPending,
    remix: remixMutation.mutate,
    isRemixing: remixMutation.isPending,
    createMeme: memeMutation.mutate,
    isCreatingMeme: memeMutation.isPending,
    isProcessing:
      captionMutation.isPending ||
      remixMutation.isPending ||
      memeMutation.isPending,
    error:
      captionMutation.error || remixMutation.error || memeMutation.error,
  };
}

