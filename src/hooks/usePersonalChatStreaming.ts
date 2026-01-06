/**
 * Personal Chat Streaming Hook
 * 
 * Handles SSE (Server-Sent Events) streaming for real-time AI responses
 * in personal chat conversations. Provides ChatGPT-like experience with
 * thinking indicators, tool call progress, and streamed content.
 * 
 * React Native Compatibility:
 * - Uses text() fallback when ReadableStream is not available
 * - Implements progressive text parsing for SSE events
 * - Handles connection timeouts and errors gracefully
 */

import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
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

// Streaming timeout in milliseconds (2 minutes)
const STREAMING_TIMEOUT = 120000;

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

/**
 * Check if ReadableStream is supported (may not be in React Native)
 */
function supportsReadableStream(): boolean {
  try {
    return typeof ReadableStream !== "undefined" && 
           typeof Response !== "undefined" && 
           typeof Response.prototype.body !== "undefined";
  } catch {
    return false;
  }
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
   * Process a single SSE event
   */
  const processEvent = useCallback((event: SSEEvent, callbacksRef: StreamingCallbacks | undefined) => {
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
          callbacksRef?.onUserMessage?.(data as UserMessage);
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
          callbacksRef?.onThinkingStart?.();
          break;

        case "thinking_delta":
          if (data.content) {
            accumulatedThinkingRef.current += data.content;
            setStreamingState((prev) => ({
              ...prev,
              thinkingContent: accumulatedThinkingRef.current,
            }));
            callbacksRef?.onThinkingDelta?.(data.content);
          }
          break;

        case "thinking_end":
          console.log("[Streaming] Thinking ended");
          setStreamingState((prev) => ({
            ...prev,
            isThinking: false,
            thinkingContent: data.content || accumulatedThinkingRef.current,
          }));
          callbacksRef?.onThinkingEnd?.(data.content || accumulatedThinkingRef.current);
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
          callbacksRef?.onToolCallStart?.(data.toolName, data.toolInput);
          break;

        case "tool_call_progress":
          setStreamingState((prev) => ({
            ...prev,
            currentToolCall: prev.currentToolCall
              ? { ...prev.currentToolCall, status: "in_progress" }
              : null,
          }));
          callbacksRef?.onToolCallProgress?.(data);
          break;

        case "tool_call_end":
          console.log("[Streaming] Tool call ended:", data.toolName);
          setStreamingState((prev) => ({
            ...prev,
            currentToolCall: prev.currentToolCall
              ? { ...prev.currentToolCall, status: "completed", sources: data.sources }
              : null,
          }));
          callbacksRef?.onToolCallEnd?.(data.toolName, data.sources);
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
            callbacksRef?.onContentDelta?.(data.content, accumulatedContentRef.current);
          }
          break;

        case "content_end":
          console.log("[Streaming] Content ended, length:", data.content?.length);
          setStreamingState((prev) => ({
            ...prev,
            content: data.content || accumulatedContentRef.current,
          }));
          callbacksRef?.onContentEnd?.(data.content || accumulatedContentRef.current);
          break;

        case "image_generated":
          console.log("[Streaming] Image generated:", data.imageId);
          callbacksRef?.onImageGenerated?.(data.imageId);
          break;

        case "assistant_message":
          console.log("[Streaming] Assistant message saved:", data.id);
          setStreamingState((prev) => ({
            ...prev,
            assistantMessageId: data.id,
            messageId: data.id,
          }));
          callbacksRef?.onAssistantMessage?.(data as AssistantMessage);
          break;

        case "done":
          console.log("[Streaming] Stream completed successfully");
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            currentToolCall: null,
          }));
          callbacksRef?.onDone?.(data.updatedTitle);
          return true; // Signal completion

        case "error":
          console.error("[Streaming] Error event:", data.error);
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            currentToolCall: null,
            error: data.error,
          }));
          callbacksRef?.onError?.(data.error);
          return true; // Signal completion (with error)

        case "ping":
          // Keep-alive ping, ignore
          break;

        default:
          console.log("[Streaming] Unknown event:", event.event, data);
      }
    } catch (parseError) {
      console.warn("[Streaming] Failed to parse event data:", event.data, parseError);
    }
    return false; // Not complete yet
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

      // Create new abort controller with timeout
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Set a timeout to abort if streaming takes too long
      const timeoutId = setTimeout(() => {
        console.log("[Streaming] Timeout reached, aborting...");
        abortController.abort();
      }, STREAMING_TIMEOUT);

      let streamCompleted = false;

      try {
        // Get auth token
        const token = await authClient.getToken();
        
        // Build request URL
        const url = `${BACKEND_URL}/api/personal-chats/${conversationId}/messages/stream`;
        
        console.log("[Streaming] Starting stream to:", url);
        console.log("[Streaming] Platform:", Platform.OS, "ReadableStream supported:", supportsReadableStream());

        // Make fetch request
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId,
            content,
            imageUrl: options?.imageUrl,
            aiFriendId: options?.aiFriendId,
          }),
          signal: abortController.signal,
          // @ts-ignore - React Native specific option
          reactNative: { textStreaming: true },
        });

        if (!response.ok) {
          // Try to get error text, but handle cases where body might not be readable
          let errorText = `HTTP ${response.status}`;
          try {
            const text = await response.text();
            // Only include first 100 chars to avoid huge error messages
            errorText = `HTTP ${response.status}: ${text.substring(0, 100)}`;
          } catch {
            // Ignore if we can't read the body
          }
          throw new Error(errorText);
        }

        // Check if we can use ReadableStream (may not work in React Native)
        const canUseStream = response.body && typeof response.body.getReader === "function";
        
        if (canUseStream) {
          // Use streaming approach (works in modern environments)
          console.log("[Streaming] Using ReadableStream approach");
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log("[Streaming] Stream ended");
              // Process any remaining buffer content before exiting
              if (buffer.trim()) {
                const { events } = parseSSEEvents(buffer + "\n\n");
                for (const event of events) {
                  if (processEvent(event, callbacks)) {
                    streamCompleted = true;
                  }
                }
              }
              break;
            }

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Parse SSE events from buffer and get remaining unparsed text
            const { events, remaining } = parseSSEEvents(buffer);
            buffer = remaining;

            // Process each event
            for (const event of events) {
              if (processEvent(event, callbacks)) {
                streamCompleted = true;
              }
            }
          }
        } else {
          // Fallback: Read entire response as text and parse events
          // This is less ideal but works in React Native
          console.log("[Streaming] Using text fallback approach");
          const text = await response.text();
          console.log("[Streaming] Received text response, length:", text.length);
          
          const { events } = parseSSEEvents(text + "\n\n");
          console.log("[Streaming] Parsed", events.length, "events from response");
          
          for (const event of events) {
            if (processEvent(event, callbacks)) {
              streamCompleted = true;
            }
          }
        }
        
        // If stream ended without a "done" event, mark as complete
        if (!streamCompleted) {
          console.log("[Streaming] Stream ended without done event, marking complete");
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            currentToolCall: null,
          }));
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("[Streaming] Request aborted");
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            currentToolCall: null,
          }));
          // Don't call onError for intentional aborts, but still call onStreamingComplete
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
        // Clear timeout
        clearTimeout(timeoutId);
        
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        
        // Always call onStreamingComplete so the caller can refetch data
        // This ensures we get any saved messages even if streaming failed
        console.log("[Streaming] Calling onStreamingComplete");
        callbacks?.onStreamingComplete?.();
      }
    },
    [callbacks, processEvent]
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

