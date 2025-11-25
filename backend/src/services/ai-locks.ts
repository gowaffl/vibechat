/**
 * Shared AI Response Locks
 * 
 * This module provides centralized, shared locks for AI response generation
 * to prevent race conditions across different parts of the application.
 * 
 * CRITICAL: Both the /api/ai/chat endpoint AND the ai-engagement service
 * MUST import locks from this single shared module to prevent duplicate responses.
 */

// In-memory lock to prevent race conditions on concurrent AI responses
// Maps chatId -> boolean indicating if a response is in progress
export const aiResponseLocks: Map<string, boolean> = new Map();

// Track last AI response time per chat to prevent back-to-back responses
// Maps chatId -> timestamp of last AI response
export const lastAIResponseTime: Map<string, number> = new Map();

// Track which chats are currently being processed to prevent concurrent processing
// Maps chatId -> boolean indicating if processing is in progress
export const chatProcessingLocks: Map<string, boolean> = new Map();

// Track last processed message per chat
// Maps chatId -> messageId of the last processed message
export const lastProcessedMessageId: Map<string, string> = new Map();

// Minimum time (in milliseconds) between AI responses in the same chat
export const AI_RESPONSE_COOLDOWN = 30000; // 30 seconds

/**
 * Acquire a lock for AI response generation
 * Returns true if lock was acquired, false if already locked
 */
export function acquireAIResponseLock(chatId: string): boolean {
  if (aiResponseLocks.has(chatId)) {
    console.log(`[AI Locks] Failed to acquire lock for chat ${chatId} - already locked`);
    return false;
  }
  aiResponseLocks.set(chatId, true);
  console.log(`[AI Locks] Lock acquired for chat ${chatId}`);
  return true;
}

/**
 * Release a lock for AI response generation
 */
export function releaseAIResponseLock(chatId: string): void {
  aiResponseLocks.delete(chatId);
  console.log(`[AI Locks] Lock released for chat ${chatId}`);
}

/**
 * Check if a chat is currently locked
 */
export function isAIResponseLocked(chatId: string): boolean {
  return aiResponseLocks.has(chatId);
}

/**
 * Acquire a lock for chat processing
 * Returns true if lock was acquired, false if already locked
 */
export function acquireChatProcessingLock(chatId: string): boolean {
  if (chatProcessingLocks.has(chatId)) {
    console.log(`[AI Locks] Failed to acquire processing lock for chat ${chatId} - already processing`);
    return false;
  }
  chatProcessingLocks.set(chatId, true);
  console.log(`[AI Locks] Processing lock acquired for chat ${chatId}`);
  return true;
}

/**
 * Release a lock for chat processing
 */
export function releaseChatProcessingLock(chatId: string): void {
  chatProcessingLocks.delete(chatId);
  console.log(`[AI Locks] Processing lock released for chat ${chatId}`);
}

/**
 * Check cooldown status for a chat
 * Returns true if cooldown is active (should not respond)
 */
export function isInCooldown(chatId: string): boolean {
  const now = Date.now();
  const lastResponseTime = lastAIResponseTime.get(chatId) || 0;
  const timeSinceLastResponse = now - lastResponseTime;
  
  if (timeSinceLastResponse < AI_RESPONSE_COOLDOWN) {
    const remainingCooldown = Math.ceil((AI_RESPONSE_COOLDOWN - timeSinceLastResponse) / 1000);
    console.log(`[AI Locks] Cooldown active for chat ${chatId}. ${remainingCooldown}s remaining.`);
    return true;
  }
  
  return false;
}

/**
 * Update the last response time for a chat
 */
export function updateLastResponseTime(chatId: string): void {
  lastAIResponseTime.set(chatId, Date.now());
  console.log(`[AI Locks] Updated last response time for chat ${chatId}`);
}

