/**
 * Personal Chat Streaming Hook
 * 
 * Handles SSE (Server-Sent Events) streaming for real-time AI responses
 * in personal chat conversations. Provides ChatGPT-like experience with
 * thinking indicators, tool call progress, and streamed content.
 */

import { useCallback, useRef, useState } from "react";
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
// SSE Parser
// ============================================================================

interface SSEEvent {
  event: string;
  data: string;
}

interface ParseResult {
  events: SSEEvent[];
  remaining: string;
}

/**
 * Parse SSE events from a text chunk
 * SSE format: event: <event_name>\ndata: <json_data>\n\n
 * Returns both parsed events and any remaining unparsed text
 */
function parseSSEEvents(text: string): ParseResult {
  const events: SSEEvent[] = [];
  
  // Split by double newline to get complete events
  const parts = text.split("\n\n");
  
  // The last part might be incomplete, so we return it as remaining
  const remaining = parts.pop() || "";
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    const lines = part.split("\n");
    let currentEvent = "";
    let currentData = "";
    
    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        // Handle data that might have "data: " or "data:"
        currentData = line.slice(5).trim();
        // If there's a leading space after "data:", remove it
        if (line.charAt(5) === " ") {
          currentData = line.slice(6);
        }
      }
    }
    
    if (currentEvent && currentData) {
      events.push({ event: currentEvent, data: currentData });
    }
  }
  
  return { events, remaining };
}

// ============================================================================
// Hook
// ============================================================================

export function usePersonalChatStreaming(callbacks?: StreamingCallbacks) {
  const [streamingState, setStreamingState] = useState<StreamingState>(initialStreamingState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef<string>("");
  const accumulatedThinkingRef = useRef<string>("");

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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingState((prev) => ({
      ...prev,
      isStreaming: false,
      isThinking: false,
      currentToolCall: null,
    }));
  }, []);

  /**
   * Start streaming a message
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
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state
      accumulatedContentRef.current = "";
      accumulatedThinkingRef.current = "";
      setStreamingState({
        ...initialStreamingState,
        isStreaming: true,
      });

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Get auth token
        const token = await authClient.getToken();
        
        // Build request URL
        const url = `${BACKEND_URL}/api/personal-chats/${conversationId}/messages/stream`;
        
        console.log("[Streaming] Starting stream to:", url);

        // Make fetch request with streaming
        const response = await fetch(url, {
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
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        // Read the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("[Streaming] Stream ended");
            // Process any remaining buffer content before exiting
            if (buffer.trim()) {
              const { events } = parseSSEEvents(buffer + "\n\n"); // Add terminator
              for (const event of events) {
                try {
                  const data = JSON.parse(event.data);
                  console.log("[Streaming] Final event:", event.event);
                  // Process the event (simplified - done event handling)
                  if (event.event === "done") {
                    setStreamingState((prev) => ({
                      ...prev,
                      isStreaming: false,
                      isThinking: false,
                      currentToolCall: null,
                    }));
                    callbacks?.onDone?.(data.updatedTitle);
                  }
                } catch (e) {
                  console.warn("[Streaming] Failed to parse final event:", e);
                }
              }
            }
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Parse SSE events from buffer and get remaining unparsed text
          const { events, remaining } = parseSSEEvents(buffer);
          buffer = remaining; // Keep only the unparsed portion

          // Process each event
          for (const event of events) {
            try {
              const data = JSON.parse(event.data);
              
              switch (event.event) {
                case "connected":
                  console.log("[Streaming] Connected:", data);
                  break;

                case "user_message":
                  console.log("[Streaming] User message saved:", data.id);
                  setStreamingState((prev) => ({
                    ...prev,
                    userMessageId: data.id,
                  }));
                  callbacks?.onUserMessage?.(data as UserMessage);
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
                  callbacks?.onThinkingStart?.();
                  break;

                case "thinking_delta":
                  if (data.content) {
                    accumulatedThinkingRef.current += data.content;
                    setStreamingState((prev) => ({
                      ...prev,
                      thinkingContent: accumulatedThinkingRef.current,
                    }));
                    callbacks?.onThinkingDelta?.(data.content);
                  }
                  break;

                case "thinking_end":
                  console.log("[Streaming] Thinking ended");
                  setStreamingState((prev) => ({
                    ...prev,
                    isThinking: false,
                    thinkingContent: data.content || accumulatedThinkingRef.current,
                  }));
                  callbacks?.onThinkingEnd?.(data.content || accumulatedThinkingRef.current);
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
                  callbacks?.onToolCallStart?.(data.toolName, data.toolInput);
                  break;

                case "tool_call_progress":
                  setStreamingState((prev) => ({
                    ...prev,
                    currentToolCall: prev.currentToolCall
                      ? { ...prev.currentToolCall, status: "in_progress" }
                      : null,
                  }));
                  callbacks?.onToolCallProgress?.(data);
                  break;

                case "tool_call_end":
                  console.log("[Streaming] Tool call ended:", data.toolName);
                  setStreamingState((prev) => ({
                    ...prev,
                    currentToolCall: prev.currentToolCall
                      ? { ...prev.currentToolCall, status: "completed", sources: data.sources }
                      : null,
                  }));
                  callbacks?.onToolCallEnd?.(data.toolName, data.sources);
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
                    callbacks?.onContentDelta?.(data.content, accumulatedContentRef.current);
                  }
                  break;

                case "content_end":
                  console.log("[Streaming] Content ended, length:", data.content?.length);
                  setStreamingState((prev) => ({
                    ...prev,
                    content: data.content || accumulatedContentRef.current,
                  }));
                  callbacks?.onContentEnd?.(data.content || accumulatedContentRef.current);
                  break;

                case "image_generated":
                  console.log("[Streaming] Image generated:", data.imageId);
                  callbacks?.onImageGenerated?.(data.imageId);
                  break;

                case "assistant_message":
                  console.log("[Streaming] Assistant message saved:", data.id);
                  setStreamingState((prev) => ({
                    ...prev,
                    assistantMessageId: data.id,
                    messageId: data.id,
                  }));
                  callbacks?.onAssistantMessage?.(data as AssistantMessage);
                  break;

                case "done":
                  console.log("[Streaming] Stream completed successfully");
                  setStreamingState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    isThinking: false,
                    currentToolCall: null,
                  }));
                  callbacks?.onDone?.(data.updatedTitle);
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
                  callbacks?.onError?.(data.error);
                  break;

                case "ping":
                  // Keep-alive ping, ignore
                  break;

                default:
                  console.log("[Streaming] Unknown event:", event.event, data);
              }
            } catch (parseError) {
              console.warn("[Streaming] Failed to parse event data:", event.data, parseError);
            }
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("[Streaming] Request aborted");
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
        callbacks?.onError?.(errorMessage);
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [callbacks]
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

