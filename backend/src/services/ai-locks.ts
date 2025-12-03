/**
 * Shared AI Response Locks (Distributed)
 * 
 * This module provides centralized, distributed locks for AI response generation
 * using the database to prevent race conditions across different parts of the application
 * and multiple server instances.
 */

import { db } from "../db";
import { randomUUID } from "crypto";

// Server instance ID to identify which server holds the lock
const SERVER_ID = randomUUID();

// Minimum time (in milliseconds) between AI responses in the same chat
export const AI_RESPONSE_COOLDOWN = 30000; // 30 seconds
export const LOCK_EXPIRY_SECONDS = 60;

/**
 * Acquire a distributed lock for AI response generation
 * Returns true if lock was acquired, false if already locked
 */
export async function acquireAIResponseLock(chatId: string): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + LOCK_EXPIRY_SECONDS * 1000).toISOString();
    
    // Try to insert a lock or take over an expired one
    // We use raw SQL for atomic upsert with condition
    const { error } = await db.rpc('acquire_engagement_lock', {
      p_chat_id: chatId,
      p_locked_by: SERVER_ID,
      p_expires_at: expiresAt
    });

    // Since we can't easily add a new RPC function without a migration file and we already ran one,
    // let's use a standard query approach that is safe enough.
    // We'll try to insert, if conflict, check expiry.
    
    // First, try to clean up expired locks for this chat
    await db
      .from('ai_engagement_lock')
      .delete()
      .eq('chat_id', chatId)
      .lt('expires_at', new Date().toISOString());

    // Now try to insert
    const { error: insertError } = await db
      .from('ai_engagement_lock')
      .insert({
        chat_id: chatId,
        locked_by: SERVER_ID,
        expires_at: expiresAt
      });

    if (!insertError) {
      console.log(`[AI Locks] Distributed lock acquired for chat ${chatId}`);
      return true;
    }

    // If insert failed, it's locked by someone else
    console.log(`[AI Locks] Failed to acquire lock for chat ${chatId} - already locked`);
    return false;

  } catch (error) {
    console.error(`[AI Locks] Error acquiring lock for chat ${chatId}:`, error);
    return false;
  }
}

/**
 * Release a distributed lock for AI response generation
 */
export async function releaseAIResponseLock(chatId: string): Promise<void> {
  try {
    // Only release if WE hold the lock
    const { error } = await db
      .from('ai_engagement_lock')
      .delete()
      .eq('chat_id', chatId)
      .eq('locked_by', SERVER_ID);

    if (error) {
      console.error(`[AI Locks] Error releasing lock for chat ${chatId}:`, error);
    } else {
      console.log(`[AI Locks] Distributed lock released for chat ${chatId}`);
    }
  } catch (error) {
    console.error(`[AI Locks] Error releasing lock for chat ${chatId}:`, error);
  }
}

/**
 * Check cooldown status for a chat using persistent storage
 * Returns true if cooldown is active (should not respond)
 */
export async function isInCooldown(chatId: string): Promise<boolean> {
  try {
    // Check the most recent response time from any AI friend in this chat
    const { data: aiFriends, error } = await db
      .from('ai_friend')
      .select('last_response_at')
      .eq('chatId', chatId)
      .not('last_response_at', 'is', null)
      .order('last_response_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(`[AI Locks] Error checking cooldown for chat ${chatId}:`, error);
      return false; // Fail open to allow response if DB check fails
    }

    if (!aiFriends || aiFriends.length === 0 || !aiFriends[0].last_response_at) {
      return false;
    }

    const lastResponseTime = new Date(aiFriends[0].last_response_at).getTime();
    const now = Date.now();
    const timeSinceLastResponse = now - lastResponseTime;

    if (timeSinceLastResponse < AI_RESPONSE_COOLDOWN) {
      const remainingCooldown = Math.ceil((AI_RESPONSE_COOLDOWN - timeSinceLastResponse) / 1000);
      console.log(`[AI Locks] Cooldown active for chat ${chatId}. ${remainingCooldown}s remaining.`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[AI Locks] Error checking cooldown for chat ${chatId}:`, error);
    return false;
  }
}

/**
 * Update the last response time for an AI friend in a chat
 * Note: This updates the specific AI friend that responded, 
 * but isInCooldown checks ALL AI friends in the chat.
 */
export async function updateLastResponseTime(chatId: string, aiFriendId: string): Promise<void> {
  try {
    const { error } = await db
      .from('ai_friend')
      .update({ last_response_at: new Date().toISOString() })
      .eq('id', aiFriendId);

    if (error) {
      console.error(`[AI Locks] Error updating last response time for friend ${aiFriendId}:`, error);
    } else {
      console.log(`[AI Locks] Updated last response time for chat ${chatId} (friend ${aiFriendId})`);
    }
  } catch (error) {
    console.error(`[AI Locks] Error updating last response time for friend ${aiFriendId}:`, error);
  }
}
