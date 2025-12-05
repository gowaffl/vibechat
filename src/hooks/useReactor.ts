import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Message, ImagePreviewResponse } from "@shared/contracts";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";

export interface ReactorOptions {
  onPreview?: (data: ImagePreviewResponse, type: "remix" | "meme") => void;
}

export function useReactor(chatId: string, userId: string, options?: ReactorOptions) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

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
      showToast({ 
        title: "✨ Caption Ready!", 
        message: "Check the chat for your AI-generated caption",
        type: "success" 
      });
    },
    onError: (error: Error) => {
      console.log("[Reactor] Caption mutation error:", error);
      showToast({ 
        title: "❌ Caption Failed", 
        message: error.message || "Could not generate caption. Please try again.",
        type: "error" 
      });
    },
  });

  // Remix media with AI
  const remixMutation = useMutation({
    mutationFn: async ({
      messageId,
      remixPrompt,
      preview = false,
    }: {
      messageId: string;
      remixPrompt: string;
      preview?: boolean;
    }) => {
      console.log("[Reactor] Remixing media:", messageId, "with prompt:", remixPrompt, "preview:", preview);
      const result = await api.post<any>("/api/reactor/remix", {
        messageId,
        userId,
        chatId,
        remixPrompt,
        preview,
      });
      console.log("[Reactor] Remix generated successfully, result:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[Reactor] Remix success with data:", data);
      
      // If it's a preview, don't invalidate queries or show success toast yet
      if (data && data.previewId) {
        console.log("[Reactor] Preview received, waiting for user confirmation");
        options?.onPreview?.(data as ImagePreviewResponse, "remix");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      // Only show success alert if we actually got data back
      if (data && data.id) {
        console.log("[Reactor] Showing success alert");
        showToast({ 
          title: "🎨 Remix Ready!", 
          message: "Your remixed image has been posted to the chat",
          type: "success" 
        });
      }
    },
    onError: (error: Error) => {
      console.log("[Reactor] Remix mutation error:", error.message);
      console.log("[Reactor] Full error object:", error);
      // Invalidate queries to refresh the chat
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      
      // Parse error message to give user helpful feedback
      let userMessage = "Could not remix image. Please try again.";
      const errorStr = error.message || "";
      
      if (errorStr.includes("timeout") || errorStr.includes("AbortError")) {
        userMessage = "Image remixing took too long. Please try a simpler prompt.";
      } else if (errorStr.includes("rate limit") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        userMessage = "Too many requests. Please wait a moment and try again.";
      } else if (errorStr.includes("safety") || errorStr.includes("blocked")) {
        userMessage = "Your prompt was blocked by safety filters. Please try a different prompt.";
      } else if (errorStr.includes("503") || errorStr.includes("unavailable")) {
        userMessage = "Image service is temporarily unavailable. Please try again later.";
      }
      
      showToast({ 
        title: "❌ Remix Failed", 
        message: userMessage,
        type: "error" 
      });
    },
  });

  // Create meme from media
  const memeMutation = useMutation({
    mutationFn: async ({
      messageId,
      memePrompt,
      preview = false,
    }: {
      messageId: string;
      memePrompt?: string;
      preview?: boolean;
    }) => {
      console.log("[Reactor] Creating meme from:", messageId, "prompt:", memePrompt, "preview:", preview);
      const result = await api.post<any>("/api/reactor/meme-from-media", {
        messageId,
        userId,
        chatId,
        memePrompt,
        preview,
      });
      console.log("[Reactor] Meme generated successfully");
      return result;
    },
    onSuccess: (data) => {
      console.log("[Reactor] Meme success, data:", data);
      
      // If it's a preview, don't invalidate queries or show success toast yet
      if (data && data.previewId) {
        console.log("[Reactor] Preview received, waiting for user confirmation");
        options?.onPreview?.(data as ImagePreviewResponse, "meme");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      showToast({ 
        title: "😂 Meme Ready!", 
        message: "Your hilarious meme has been posted to the chat",
        type: "success" 
      });
    },
    onError: (error: Error) => {
      console.log("[Reactor] Meme mutation error:", error);
      console.log("[Reactor] Full error object:", error);
      // Invalidate queries to refresh the chat
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      
      // Parse error message to give user helpful feedback
      let userMessage = "Could not create meme. Please try again.";
      const errorStr = error.message || "";
      
      if (errorStr.includes("timeout") || errorStr.includes("AbortError")) {
        userMessage = "Meme creation took too long. Please try a simpler prompt.";
      } else if (errorStr.includes("rate limit") || errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        userMessage = "Too many requests. Please wait a moment and try again.";
      } else if (errorStr.includes("safety") || errorStr.includes("blocked")) {
        userMessage = "Your prompt was blocked by safety filters. Please try a different prompt.";
      } else if (errorStr.includes("503") || errorStr.includes("unavailable")) {
        userMessage = "Image service is temporarily unavailable. Please try again later.";
      }
      
      showToast({ 
        title: "❌ Meme Failed", 
        message: userMessage,
        type: "error" 
      });
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

