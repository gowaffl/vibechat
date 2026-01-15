/**
 * LLM Analytics Service
 * 
 * Tracks all LLM usage across the application following PostHog's LLM Observability best practices.
 * 
 * Key Features:
 * - Token usage tracking (prompt, completion, total)
 * - Cost calculation and tracking
 * - Latency monitoring
 * - Error tracking with detailed context
 * - Model and provider tracking
 * - Feature-specific tagging
 * 
 * Reference: https://posthog.com/docs/ai-engineering/llm-observability
 */

import { posthog } from "../env";

// ============================================================================
// TYPES
// ============================================================================

export type LLMFeature =
  | "ai_auto_response" // AI friend auto-engagement in group chats
  | "ai_mention_response" // @mention AI responses in group chats
  | "personal_chat" // Personal AI agent conversations
  | "catch_up" // Catch-up summaries
  | "tldr" // TLDR summaries
  | "translation" // Message translation
  | "image_generation" // Image generation (Gemini)
  | "meme_generation" // Meme generation
  | "smart_reply" // Smart reply suggestions
  | "group_avatar" // Group avatar generation
  | "title_generation"; // Conversation title generation

export type LLMProvider = "openai" | "google" | "anthropic";

export interface LLMStartParams {
  feature: LLMFeature;
  model: string;
  provider: LLMProvider;
  userId?: string;
  chatId?: string;
  promptTokens?: number;
  promptLength?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}

export interface LLMSuccessParams {
  feature: LLMFeature;
  model: string;
  provider: LLMProvider;
  userId?: string;
  chatId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd?: number;
  finishReason?: string;
  metadata?: Record<string, any>;
}

export interface LLMFailureParams {
  feature: LLMFeature;
  model: string;
  provider: LLMProvider;
  userId?: string;
  chatId?: string;
  promptTokens?: number;
  latencyMs: number;
  errorType: string;
  errorMessage: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Calculate cost in USD based on model and token usage
 * Prices as of January 2026
 */
export function calculateLLMCost(
  model: string,
  provider: LLMProvider,
  promptTokens: number,
  completionTokens: number
): number {
  // Prices per 1M tokens
  const pricing: Record<string, { input: number; output: number }> = {
    // OpenAI GPT-5.1
    "gpt-5.1": { input: 10.0, output: 30.0 },
    "gpt-5.1-mini": { input: 1.0, output: 3.0 },
    "gpt-5-mini": { input: 0.5, output: 1.5 },
    "gpt-4": { input: 30.0, output: 60.0 },
    "gpt-4-turbo": { input: 10.0, output: 30.0 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    
    // Google Gemini
    "gemini-3-pro": { input: 3.5, output: 10.5 },
    "gemini-3-pro-image-preview": { input: 5.0, output: 15.0 },
    "gemini-2.0-flash-thinking-exp": { input: 0.0, output: 0.0 }, // Free during preview
    "gemini-2.0-flash-exp": { input: 0.0, output: 0.0 }, // Free during preview
    "gemini-1.5-pro": { input: 1.25, output: 5.0 },
    "gemini-1.5-flash": { input: 0.075, output: 0.3 },
    
    // Anthropic Claude
    "claude-3.5-sonnet": { input: 3.0, output: 15.0 },
    "claude-3-opus": { input: 15.0, output: 75.0 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
  };

  const modelPricing = pricing[model.toLowerCase()] || pricing["gpt-4"]; // Default to GPT-4 pricing
  
  const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
  const outputCost = (completionTokens / 1_000_000) * modelPricing.output;
  
  return inputCost + outputCost;
}

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * Track the start of an LLM generation
 * Call this immediately before making the LLM API call
 */
export function trackLLMStart(params: LLMStartParams): void {
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: params.userId || "system",
      event: "llm_generation_started",
      properties: {
        $set: params.userId ? { user_id: params.userId } : undefined,
        
        // Core LLM properties
        model: params.model,
        provider: params.provider,
        feature: params.feature,
        
        // Request configuration
        prompt_tokens: params.promptTokens || 0,
        prompt_length: params.promptLength || 0,
        temperature: params.temperature,
        top_p: params.topP,
        max_tokens: params.maxTokens,
        stream: params.stream || false,
        
        // Context
        chat_id: params.chatId,
        
        // Metadata
        ...params.metadata,
        
        // Timestamp
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[LLM Analytics] Error tracking LLM start:", error);
  }
}

/**
 * Track successful LLM generation
 * Call this after receiving a successful response from the LLM
 */
export function trackLLMSuccess(params: LLMSuccessParams): void {
  if (!posthog) return;

  try {
    // Calculate cost if not provided
    const cost = params.costUsd ?? calculateLLMCost(
      params.model,
      params.provider,
      params.promptTokens,
      params.completionTokens
    );

    posthog.capture({
      distinctId: params.userId || "system",
      event: "llm_generation_completed",
      properties: {
        $set: params.userId ? { user_id: params.userId } : undefined,
        
        // Core LLM properties
        model: params.model,
        provider: params.provider,
        feature: params.feature,
        
        // Token usage
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
        total_tokens: params.totalTokens,
        
        // Performance
        latency_ms: params.latencyMs,
        
        // Cost
        cost_usd: cost,
        
        // Response details
        finish_reason: params.finishReason,
        
        // Context
        chat_id: params.chatId,
        
        // Metadata
        ...params.metadata,
        
        // Timestamp
        timestamp: new Date().toISOString(),
      },
    });

    // Also track token usage separately for aggregation
    posthog.capture({
      distinctId: params.userId || "system",
      event: "llm_token_usage_tracked",
      properties: {
        model: params.model,
        provider: params.provider,
        feature: params.feature,
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
        total_tokens: params.totalTokens,
        cost_usd: cost,
        chat_id: params.chatId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[LLM Analytics] Error tracking LLM success:", error);
  }
}

/**
 * Track failed LLM generation
 * Call this when an LLM API call fails
 */
export function trackLLMFailure(params: LLMFailureParams): void {
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: params.userId || "system",
      event: "llm_generation_failed",
      properties: {
        $set: params.userId ? { user_id: params.userId } : undefined,
        
        // Core LLM properties
        model: params.model,
        provider: params.provider,
        feature: params.feature,
        
        // Token usage (if available)
        prompt_tokens: params.promptTokens || 0,
        
        // Performance
        latency_ms: params.latencyMs,
        
        // Error details
        error_type: params.errorType,
        error_message: params.errorMessage,
        
        // Context
        chat_id: params.chatId,
        
        // Metadata
        ...params.metadata,
        
        // Timestamp
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[LLM Analytics] Error tracking LLM failure:", error);
  }
}

// ============================================================================
// HELPER: WRAP LLM CALL WITH AUTOMATIC TRACKING
// ============================================================================

/**
 * Wrapper function that automatically tracks LLM calls
 * 
 * Usage:
 * ```typescript
 * const result = await trackLLMCall({
 *   feature: "ai_mention_response",
 *   model: "gpt-5.1",
 *   provider: "openai",
 *   userId: user.id,
 *   chatId: chat.id,
 * }, async () => {
 *   return await openai.chat.completions.create({...});
 * });
 * ```
 */
export async function trackLLMCall<T>(
  params: Omit<LLMStartParams, "promptTokens" | "promptLength">,
  llmCall: () => Promise<T>,
  extractTokens?: (result: T) => { promptTokens: number; completionTokens: number; totalTokens: number }
): Promise<T> {
  const startTime = Date.now();
  
  // Track start
  trackLLMStart(params);
  
  try {
    // Execute LLM call
    const result = await llmCall();
    const latencyMs = Date.now() - startTime;
    
    // Extract token usage if extractor provided
    if (extractTokens) {
      const tokens = extractTokens(result);
      trackLLMSuccess({
        feature: params.feature,
        model: params.model,
        provider: params.provider,
        userId: params.userId,
        chatId: params.chatId,
        promptTokens: tokens.promptTokens,
        completionTokens: tokens.completionTokens,
        totalTokens: tokens.totalTokens,
        latencyMs,
        metadata: params.metadata,
      });
    }
    
    return result;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    
    // Track failure
    trackLLMFailure({
      feature: params.feature,
      model: params.model,
      provider: params.provider,
      userId: params.userId,
      chatId: params.chatId,
      latencyMs,
      errorType: error.name || "UnknownError",
      errorMessage: error.message || "LLM call failed",
      metadata: params.metadata,
    });
    
    // Re-throw the error
    throw error;
  }
}

// ============================================================================
// SHUTDOWN HANDLER
// ============================================================================

/**
 * Flush any pending events before shutdown
 * Call this in your server shutdown handler
 */
export async function flushLLMAnalytics(): Promise<void> {
  if (!posthog) return;
  
  try {
    await posthog.shutdown();
    console.log("✅ PostHog analytics flushed successfully");
  } catch (error) {
    console.error("❌ Error flushing PostHog analytics:", error);
  }
}
