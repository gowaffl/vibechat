import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ConversationSummary,
  GenerateCatchUpRequest,
  GetCatchUpRequest,
} from "@shared/contracts";

export function useCatchUp(chatId: string, userId: string) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // Get cached catch-up summary
  const {
    data: cachedSummary,
    isLoading: isLoadingCached,
    refetch: refetchCached,
  } = useQuery<ConversationSummary | null>({
    queryKey: ["catchup", chatId, userId],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ userId });
        const data = await api.get<ConversationSummary | null>(
          `/api/catchup/${chatId}?${params}`
        );
        return data;
      } catch (error: any) {
        if (error.message?.includes("404")) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Generate new catch-up summary
  const generateMutation = useMutation({
    mutationFn: async (
      request: Omit<GenerateCatchUpRequest, "chatId" | "userId">
    ) => {
      setIsGenerating(true);
      console.log("[useCatchUp] Starting catch-up generation...");
      console.log("[useCatchUp] Request:", { chatId, userId, ...request });

      try {
        const data = await api.post<ConversationSummary>("/api/catchup/generate", {
          chatId,
          userId,
          ...request,
        });
        console.log("[useCatchUp] ✅ Summary generated successfully");
        return data;
      } catch (error) {
        console.error("[useCatchUp] ❌ Error generating summary:", error);
        throw error;
      }
    },
    onSuccess: (newSummary) => {
      console.log("[useCatchUp] Setting cached summary in query client");
      queryClient.setQueryData(["catchup", chatId, userId], newSummary);
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("[useCatchUp] Error in mutation:", error);
      setIsGenerating(false);
    },
  });

  const generateCatchUp = (
    summaryType: "quick" | "detailed" | "personalized" = "personalized",
    sinceMessageId?: string
  ) => {
    generateMutation.mutate({ summaryType, sinceMessageId });
  };

  // Clear cached summary (for when user closes modal and wants to choose again)
  const clearCachedSummary = () => {
    console.log("[useCatchUp] Clearing cached summary");
    queryClient.setQueryData(["catchup", chatId, userId], null);
  };

  // Check if summary is expired
  const isSummaryExpired = cachedSummary?.expiresAt
    ? new Date(cachedSummary.expiresAt) < new Date()
    : false;

  // Determine if we should show catch-up button
  const shouldShowCatchUp = !cachedSummary || isSummaryExpired;

  return {
    cachedSummary: isSummaryExpired ? null : cachedSummary,
    isLoadingCached,
    isGenerating: isGenerating || generateMutation.isPending,
    generateCatchUp,
    clearCachedSummary,
    refetchCached,
    shouldShowCatchUp,
    error: generateMutation.error,
  };
}

