/**
 * Personal Chat Streaming Hook
 * 
 * Handles SSE (Server-Sent Events) streaming for real-time AI responses
 * in personal chat conversations. Provides ChatGPT-like experience with
 * thinking indicators, tool call progress, and streamed content.
 * 
 * Uses XMLHttpRequest with onprogress for proper SSE support in React Native,
 * as the standard fetch API doesn't support streaming in RN.
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
  onImageGenerated?: (imageId: string, imageUrl?: string) => void;
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
// SSE Parser
// ============================================================================

interface SSEEvent {
  event: string;
  data: string;
}

/**
 * Parse SSE events from a chunk of text
 * Returns parsed events and any remaining incomplete data
 */
function parseSSEChunk(buffer: string): { events: SSEEvent[]; remaining: string } {
  const events: SSEEvent[] = [];
  
  // Split by double newline (SSE event separator)
  const parts = buffer.split("\n\n");
  
  // The last part might be incomplete, keep it in buffer
  const remaining = parts.pop() || "";
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    const lines = part.split("\n");
    let eventType = "message";
    let eventData = "";
    
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        eventData = line.slice(5).trim();
      }
    }
    
    if (eventData) {
      events.push({ event: eventType, data: eventData });
    }
  }
  
  return { events, remaining };
}

// ============================================================================
// Hook
// ============================================================================

export function usePersonalChatStreaming(callbacks?: StreamingCallbacks) {
  const [streamingState, setStreamingState] = useState<StreamingState>(initialStreamingState);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const isAbortedRef = useRef(false);
  const accumulatedContentRef = useRef<string>("");
  const accumulatedThinkingRef = useRef<string>("");
  const sseBufferRef = useRef<string>("");
  const processedLengthRef = useRef<number>(0);
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
    sseBufferRef.current = "";
    processedLengthRef.current = 0;
  }, []);

  /**
   * Stop streaming and abort the connection
   */
  const stopStreaming = useCallback(() => {
    console.log("[Streaming] Stopping stream...");
    isAbortedRef.current = true;
    
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    
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
  const processEvent = useCallback((eventType: string, dataStr: string) => {
    // Skip if aborted
    if (isAbortedRef.current) return;
    
    const cbs = callbacksRef.current;
    
    // Parse data
    let data: any = {};
    try {
      data = JSON.parse(dataStr);
    } catch (e) {
      console.warn("[Streaming] Failed to parse event data:", dataStr);
      return;
    }
    
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
        console.log("[Streaming] *** IMAGE_GENERATED EVENT RECEIVED ***");
        console.log("[Streaming] Image generated - imageId:", data.imageId, "imageUrl:", data.imageUrl);
        if (data.imageUrl) {
          console.log("[Streaming] Calling onImageGenerated callback");
          cbs?.onImageGenerated?.(data.imageId, data.imageUrl);
        } else {
          console.warn("[Streaming] image_generated event has no imageUrl!");
        }
        break;

      case "assistant_message":
        console.log("[Streaming] *** ASSISTANT_MESSAGE EVENT RECEIVED ***");
        console.log("[Streaming] Assistant message - id:", data.id, "generatedImageUrl:", data.generatedImageUrl);
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
   * Process new data from XHR response
   */
  const processNewData = useCallback((responseText: string) => {
    // Get only the new data since last processing
    const newData = responseText.substring(processedLengthRef.current);
    processedLengthRef.current = responseText.length;
    
    if (!newData) return;
    
    // Add new data to buffer
    sseBufferRef.current += newData;
    
    // Parse events from buffer
    const { events, remaining } = parseSSEChunk(sseBufferRef.current);
    sseBufferRef.current = remaining;
    
    // Process each event
    for (const event of events) {
      processEvent(event.event, event.data);
    }
  }, [processEvent]);

  /**
   * Start streaming a message using XMLHttpRequest
   */
  const startStreaming = useCallback(
    async (
      conversationId: string,
      userId: string,
      content: string,
      options?: {
        imageUrl?: string;
        aiFriendId?: string;
        files?: Array<{ uri: string; name: string; mimeType: string; base64?: string }>;
      }
    ) => {
      // Abort any existing request
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      
      // Reset abort flag
      isAbortedRef.current = false;
      
      // Reset state
      accumulatedContentRef.current = "";
      accumulatedThinkingRef.current = "";
      sseBufferRef.current = "";
      processedLengthRef.current = 0;
      setStreamingState({
        ...initialStreamingState,
        isStreaming: true,
      });

      try {
        // Get auth token
        const token = await authClient.getToken();
        
        // Build request URL
        const url = `${BACKEND_URL}/api/personal-chats/${conversationId}/messages/stream`;
        
        console.log("[Streaming] Starting XHR stream to:", url);

        // Create XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Accept", "text/event-stream");
        xhr.setRequestHeader("Cache-Control", "no-cache");
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        
        // Handle progress - this is called as data streams in
        xhr.onprogress = () => {
          if (isAbortedRef.current) return;
          processNewData(xhr.responseText);
        };
        
        // Handle completion
        xhr.onload = () => {
          console.log("[Streaming] XHR completed, status:", xhr.status);
          
          if (isAbortedRef.current) return;
          
          // Process any remaining data
          if (xhr.responseText) {
            processNewData(xhr.responseText);
          }
          
          // Check for HTTP errors
          if (xhr.status !== 200) {
            console.error("[Streaming] HTTP error:", xhr.status, xhr.statusText);
            const errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
            setStreamingState((prev) => ({
              ...prev,
              isStreaming: false,
              isThinking: false,
              currentToolCall: null,
              error: errorMessage,
            }));
            callbacksRef.current?.onError?.(errorMessage);
          } else {
            // Mark streaming as complete if not already done by a "done" event
            setStreamingState((prev) => {
              if (prev.isStreaming) {
                console.log("[Streaming] XHR completed without done event, marking complete");
                return {
                  ...prev,
                  isStreaming: false,
                  isThinking: false,
                  currentToolCall: null,
                };
              }
              return prev;
            });
          }
          
          // Always call onStreamingComplete
          console.log("[Streaming] Calling onStreamingComplete");
          callbacksRef.current?.onStreamingComplete?.();
        };
        
        // Handle errors
        xhr.onerror = () => {
          if (isAbortedRef.current) return;
          
          console.error("[Streaming] XHR error");
          const errorMessage = "Network error - connection failed";
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            currentToolCall: null,
            error: errorMessage,
          }));
          callbacksRef.current?.onError?.(errorMessage);
          callbacksRef.current?.onStreamingComplete?.();
        };
        
        // Handle timeout
        xhr.ontimeout = () => {
          if (isAbortedRef.current) return;
          
          console.error("[Streaming] XHR timeout");
          const errorMessage = "Request timed out";
          setStreamingState((prev) => ({
            ...prev,
            isStreaming: false,
            isThinking: false,
            currentToolCall: null,
            error: errorMessage,
          }));
          callbacksRef.current?.onError?.(errorMessage);
          callbacksRef.current?.onStreamingComplete?.();
        };
        
        // Handle abort
        xhr.onabort = () => {
          console.log("[Streaming] XHR aborted");
          callbacksRef.current?.onStreamingComplete?.();
        };
        
        // Set timeout (2 minutes - enough for long AI responses)
        xhr.timeout = 120000;
        
        // Build request body
        const requestBody: Record<string, any> = {
          userId,
          content,
          imageUrl: options?.imageUrl,
          aiFriendId: options?.aiFriendId,
        };
        
        // Include files if present
        if (options?.files && options.files.length > 0) {
          requestBody.files = options.files.map(f => ({
            name: f.name,
            mimeType: f.mimeType,
            base64: f.base64,
          }));
          console.log(`[Streaming] Including ${options.files.length} file(s)`);
        }
        
        // Send the request
        xhr.send(JSON.stringify(requestBody));
        
        console.log("[Streaming] XHR request sent");
        
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
        callbacksRef.current?.onStreamingComplete?.();
      }
    },
    [processNewData]
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
