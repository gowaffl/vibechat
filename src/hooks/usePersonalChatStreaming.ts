/**
 * Personal Chat Streaming Hook
 * 
 * Handles SSE (Server-Sent Events) streaming for real-time AI responses
 * in personal chat conversations. Provides ChatGPT-like experience with
 * thinking indicators, tool call progress, and streamed content.
 * 
 * Uses react-native-fetch-sse for proper SSE support in React Native,
 * as the standard fetch API doesn't support streaming in RN.
 */

import { useCallback, useRef, useState } from "react";
import { fetchSSE, type SSEEvent } from "react-native-fetch-sse";
import { BACKEND_URL } from "@/config";
import { authClient } from "@/lib/authClient";

// ============================================================================
// Types
// ============================================================================

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface ToolCallState {
  name: string;
  status: "starting" | "in_progress" | "completed";
  sources?: Array<{ title: string; url: string }>;
}

export interface StreamingState {
  isStreaming: boolean;
  content: string;
  messageId: string | null;
  isThinking: boolean;
  thinkingContent: string;
  currentToolCall: ToolCallState | null;
  reasoningEffort: ReasoningEffort | null;
  error: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
}

export interface UserMessage {
  id: string;
  conversationId: string;
  content: string;
  role: "user";
  imageUrl?: string | null;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  content: string;
  role: "assistant";
  generatedImageUrl?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface StreamingCallbacks {
  onUserMessage?: (message: UserMessage) => void;
  onThinkingStart?: () => void;
  onThinkingDelta?: (content: string) => void;
  onThinkingEnd?: (content: string) => void;
  onToolCallStart?: (toolName: string, toolInput?: any) => void;
  onToolCallProgress?: (data: any) => void;
  onToolCallEnd?: (toolName: string, sources?: any[]) => void;
  onContentDelta?: (delta: string, accumulated: string) => void;
  onContentEnd?: (content: string) => void;
  onImageGenerated?: (imageId: string) => void;
  onAssistantMessage?: (message: AssistantMessage) => void;
  onDone?: (updatedTitle?: string) => void;
  onError?: (error: string) => void;
  // Called when streaming finishes (success or error) - use to refetch conversation data
  onStreamingComplete?: () => void;
}

const initialStreamingState: StreamingState = {
  isStreaming: false,
  content: "",
  messageId: null,
  isThinking: false,
  thinkingContent: "",
  currentToolCall: null,
  reasoningEffort: null,
  error: null,
  userMessageId: null,
  assistantMessageId: null,
};

// ============================================================================
// Hook
// ============================================================================

export function usePersonalChatStreaming(callbacks?: StreamingCallbacks) {
  const [streamingState, setStreamingState] = useState<StreamingState>(initialStreamingState);
  const isAbortedRef = useRef(false);
  const accumulatedContentRef = useRef<string>("");
  const accumulatedThinkingRef = useRef<string>("");
  const callbacksRef = useRef(callbacks);
  
  // Keep callbacks ref updated
  callbacksRef.current = callbacks;

  /**
   * Reset streaming state
   */
  const resetState = useCallback(() => {
    setStreamingState(initialStreamingState);
    accumulatedContentRef.current = "";
    accumulatedThinkingRef.current = "";
  }, []);

  /**
   * Stop streaming and abort the connection
   */
  const stopStreaming = useCallback(() => {
    console.log("[Streaming] Stopping stream...");
    isAbortedRef.current = true;
    setStreamingState((prev) => ({
      ...prev,
      isStreaming: false,
      isThinking: false,
      currentToolCall: null,
    }));
  }, []);

  /**
   * Process an SSE event
   */
  const processEvent = useCallback((eventType: string, data: any) => {
    // Skip if aborted
    if (isAbortedRef.current) return;
    
    const cbs = callbacksRef.current;
    
    switch (eventType) {
      case "connected":
        console.log("[Streaming] Connected:", data);
        break;

      case "user_message":
        console.log("[Streaming] User message saved:", data.id);
        setStreamingState((prev) => ({
          ...prev,
          userMessageId: data.id,
        }));
        cbs?.onUserMessage?.(data as UserMessage);
        break;

      case "reasoning_effort":
        console.log("[Streaming] Reasoning effort:", data.effort);
        setStreamingState((prev) => ({
          ...prev,
          reasoningEffort: data.effort,
        }));
        break;

      case "thinking_start":
        console.log("[Streaming] Thinking started");
        accumulatedThinkingRef.current = "";
        setStreamingState((prev) => ({
          ...prev,
          isThinking: true,
          thinkingContent: "",
        }));
        cbs?.onThinkingStart?.();
        break;

      case "thinking_delta":
        if (data.content) {
          accumulatedThinkingRef.current += data.content;
          setStreamingState((prev) => ({
            ...prev,
            thinkingContent: accumulatedThinkingRef.current,
          }));
          cbs?.onThinkingDelta?.(data.content);
        }
        break;

      case "thinking_end":
        console.log("[Streaming] Thinking ended");
        setStreamingState((prev) => ({
          ...prev,
          isThinking: false,
          thinkingContent: data.content || accumulatedThinkingRef.current,
        }));
        cbs?.onThinkingEnd?.(data.content || accumulatedThinkingRef.current);
        break;

      case "tool_call_start":
        console.log("[Streaming] Tool call started:", data.toolName);
        setStreamingState((prev) => ({
          ...prev,
          currentToolCall: {
            name: data.toolName,
            status: "starting",
          },
        }));
        cbs?.onToolCallStart?.(data.toolName, data.toolInput);
        break;

      case "tool_call_progress":
        setStreamingState((prev) => ({
          ...prev,
          currentToolCall: prev.currentToolCall
            ? { ...prev.currentToolCall, status: "in_progress" }
            : null,
        }));
        cbs?.onToolCallProgress?.(data);
        break;

      case "tool_call_end":
        console.log("[Streaming] Tool call ended:", data.toolName);
        setStreamingState((prev) => ({
          ...prev,
          currentToolCall: prev.currentToolCall
            ? { ...prev.currentToolCall, status: "completed", sources: data.sources }
            : null,
        }));
        cbs?.onToolCallEnd?.(data.toolName, data.sources);
        // Clear tool call after a brief delay to show completion
        setTimeout(() => {
          setStreamingState((prev) => ({
            ...prev,
            currentToolCall: null,
          }));
        }, 500);
        break;

      case "content_delta":
        if (data.content) {
          accumulatedContentRef.current += data.content;
          setStreamingState((prev) => ({
            ...prev,
            content: accumulatedContentRef.current,
          }));
          cbs?.onContentDelta?.(data.content, accumulatedContentRef.current);
        }
        break;

      case "content_end":
        console.log("[Streaming] Content ended, length:", data.content?.length);
        setStreamingState((prev) => ({
          ...prev,
          content: data.content || accumulatedContentRef.current,
        }));
        cbs?.onContentEnd?.(data.content || accumulatedContentRef.current);
        break;

      case "image_generated":
        console.log("[Streaming] Image generated:", data.imageId);
        cbs?.onImageGenerated?.(data.imageId);
        break;

      case "assistant_message":
        console.log("[Streaming] Assistant message saved:", data.id);
        setStreamingState((prev) => ({
          ...prev,
          assistantMessageId: data.id,
          messageId: data.id,
        }));
        cbs?.onAssistantMessage?.(data as AssistantMessage);
        break;

      case "done":
        console.log("[Streaming] Stream completed successfully");
        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          currentToolCall: null,
        }));
        cbs?.onDone?.(data.updatedTitle);
        break;

      case "error":
        console.error("[Streaming] Error event:", data.error);
        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          currentToolCall: null,
          error: data.error,
        }));
        cbs?.onError?.(data.error);
        break;

      case "ping":
        // Keep-alive ping, ignore
        break;

      default:
        console.log("[Streaming] Unknown event:", eventType, data);
    }
  }, []);

  /**
   * Start streaming a message using react-native-fetch-sse
   */
  const startStreaming = useCallback(
    async (
      conversationId: string,
      userId: string,
      content: string,
      options?: {
        imageUrl?: string;
        aiFriendId?: string;
      }
    ) => {
      // Reset abort flag
      isAbortedRef.current = false;
      
      // Reset state
      accumulatedContentRef.current = "";
      accumulatedThinkingRef.current = "";
      setStreamingState({
        ...initialStreamingState,
        isStreaming: true,
      });

      try {
        // Get auth token
        const token = await authClient.getToken();
        
        // Build request URL
        const url = `${BACKEND_URL}/api/personal-chats/${conversationId}/messages/stream`;
        
        console.log("[Streaming] Starting SSE stream to:", url);

        // Use react-native-fetch-sse for proper SSE support in React Native
        await fetchSSE(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "text/event-stream",
              "Cache-Control": "no-cache",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              userId,
              content,
              imageUrl: options?.imageUrl,
              aiFriendId: options?.aiFriendId,
            }),
          },
          {
            shouldParseJsonWhenOnMsg: true,
            onStart: () => {
              console.log("[Streaming] SSE connection starting...");
            },
            onMessage: (event: SSEEvent) => {
              // Skip if aborted
              if (isAbortedRef.current) return;
              
              // Handle SSE event
              const eventType = event.event || "message";
              const data = event.data || {};
              
              console.log("[Streaming] Received event:", eventType);
              processEvent(eventType, data);
            },
            onError: (error, meta) => {
              // Skip if aborted
              if (isAbortedRef.current) return;
              
              console.error("[Streaming] SSE error:", error, meta);
              const errorMessage = error instanceof Error 
                ? error.message 
                : `HTTP ${meta?.status || "error"}: ${meta?.statusText || "Unknown error"}`;
              
              setStreamingState((prev) => ({
                ...prev,
                isStreaming: false,
                isThinking: false,
                currentToolCall: null,
                error: errorMessage,
              }));
              callbacksRef.current?.onError?.(errorMessage);
            },
            onEnd: () => {
              console.log("[Streaming] SSE connection ended");
              // Mark streaming as complete if not already done by a "done" event
              setStreamingState((prev) => {
                if (prev.isStreaming) {
                  console.log("[Streaming] Stream ended without done event, marking complete");
                  return {
                    ...prev,
                    isStreaming: false,
                    isThinking: false,
                    currentToolCall: null,
                  };
                }
                return prev;
              });
            },
          }
        );
        
        console.log("[Streaming] fetchSSE completed");
        
      } catch (error: any) {
        if (isAbortedRef.current) {
          console.log("[Streaming] Request was aborted");
          return;
        }
        
        console.error("[Streaming] Error:", error);
        const errorMessage = error?.message || "Unknown streaming error";
        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          isThinking: false,
          currentToolCall: null,
          error: errorMessage,
        }));
        callbacksRef.current?.onError?.(errorMessage);
      } finally {
        // Always call onStreamingComplete so the caller can refetch data
        console.log("[Streaming] Calling onStreamingComplete");
        callbacksRef.current?.onStreamingComplete?.();
      }
    },
    [processEvent]
  );

  return {
    streamingState,
    startStreaming,
    stopStreaming,
    resetState,
    isStreaming: streamingState.isStreaming,
  };
}

export default usePersonalChatStreaming;
