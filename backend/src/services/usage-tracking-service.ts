/**
 * Usage Tracking Service
 * 
 * Tracks and enforces usage limits for rate-limited features:
 * - Personal chat messages (daily limit)
 * - Image generations (monthly limit)
 * - AI calls (monthly limit) - @ai mentions, slash commands, workflows
 */

import { db } from "../db";
import {
  getEffectiveTier,
  getPlanLimits,
} from "./subscription-service";
import type {
  UserUsage,
  UsageCheckResponse,
  SubscriptionTier,
} from "@/shared/contracts";

export type UsageType = "personalMessages" | "imageGenerations" | "aiCalls";

/**
 * Get user's usage record, creating one if it doesn't exist
 */
export async function getUserUsage(userId: string): Promise<UserUsage | null> {
  // First check if reset is needed
  const { data: usage, error } = await db
    .from("user_usage")
    .select("*")
    .eq("userId", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Usage] Error fetching usage:", error);
    return null;
  }

  if (!usage) {
    // Create usage record if it doesn't exist
    const now = new Date();
    const { data: newUsage, error: createError } = await db
      .from("user_usage")
      .insert({
        userId,
        personalMessagesCount: 0,
        personalMessagesResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        imageGenerationsCount: 0,
        imageGenerationsResetAt: getNextMonthReset().toISOString(),
        aiCallsCount: 0,
        aiCallsResetAt: getNextMonthReset().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("[Usage] Error creating usage record:", createError);
      return null;
    }

    console.log(`[Usage] Created new usage record for user ${userId}`);
    return formatUsage(newUsage);
  }

  // Check and reset counters if needed
  const updatedUsage = await checkAndResetUsage(userId, usage);
  return formatUsage(updatedUsage);
}

/**
 * Check and reset usage counters if their periods have passed
 */
async function checkAndResetUsage(userId: string, usage: any): Promise<any> {
  const now = new Date();
  const updates: any = {};
  let needsUpdate = false;

  // Check daily personal messages reset
  if (new Date(usage.personalMessagesResetAt) <= now) {
    updates.personalMessagesCount = 0;
    updates.personalMessagesResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    needsUpdate = true;
    console.log(`[Usage] Resetting daily personal messages for user ${userId}`);
  }

  // Check monthly image generations reset
  if (new Date(usage.imageGenerationsResetAt) <= now) {
    updates.imageGenerationsCount = 0;
    updates.imageGenerationsResetAt = getNextMonthReset().toISOString();
    needsUpdate = true;
    console.log(`[Usage] Resetting monthly image generations for user ${userId}`);
  }

  // Check monthly AI calls reset
  if (new Date(usage.aiCallsResetAt) <= now) {
    updates.aiCallsCount = 0;
    updates.aiCallsResetAt = getNextMonthReset().toISOString();
    needsUpdate = true;
    console.log(`[Usage] Resetting monthly AI calls for user ${userId}`);
  }

  if (needsUpdate) {
    updates.updatedAt = now.toISOString();
    const { data, error } = await db
      .from("user_usage")
      .update(updates)
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      console.error("[Usage] Error updating usage:", error);
      return usage;
    }
    return data;
  }

  return usage;
}

/**
 * Check if a user can perform an action based on their usage limits
 */
export async function checkUsageLimit(
  userId: string,
  usageType: UsageType
): Promise<UsageCheckResponse> {
  const effectiveTier = await getEffectiveTier(userId);
  const limits = getPlanLimits(effectiveTier);
  const usage = await getUserUsage(userId);

  if (!usage) {
    // If we can't get usage, allow the action (fail open)
    console.warn(`[Usage] Could not get usage for user ${userId}, allowing action`);
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      upgradeRequired: false,
    };
  }

  let currentCount: number;
  let limit: number;
  let resetAt: string;

  switch (usageType) {
    case "personalMessages":
      currentCount = usage.personalMessagesCount;
      limit = limits.personalMessagesPerDay;
      resetAt = usage.personalMessagesResetAt;
      break;
    case "imageGenerations":
      currentCount = usage.imageGenerationsCount;
      limit = limits.imageGenerationsPerMonth;
      resetAt = usage.imageGenerationsResetAt;
      break;
    case "aiCalls":
      currentCount = usage.aiCallsCount;
      limit = limits.aiCallsPerMonth;
      resetAt = usage.aiCallsResetAt;
      break;
  }

  // -1 means unlimited
  if (limit === -1) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      upgradeRequired: false,
    };
  }

  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount < limit;

  return {
    allowed,
    reason: allowed ? undefined : getUpgradeMessage(usageType, effectiveTier),
    remaining,
    limit,
    resetAt,
    upgradeRequired: !allowed,
  };
}

/**
 * Increment usage counter after successful action
 */
export async function incrementUsage(
  userId: string,
  usageType: UsageType
): Promise<boolean> {
  const columnMap: Record<UsageType, string> = {
    personalMessages: "personalMessagesCount",
    imageGenerations: "imageGenerationsCount",
    aiCalls: "aiCallsCount",
  };

  const column = columnMap[usageType];

  // Use RPC to atomically increment
  const { error } = await db.rpc("increment_usage", {
    p_user_id: userId,
    p_column: column,
  });

  if (error) {
    // Fallback: manual increment
    console.warn("[Usage] RPC increment failed, using fallback:", error);
    const usage = await getUserUsage(userId);
    if (!usage) return false;

    const currentValue = (usage as any)[column.replace("Count", "Count") as keyof UserUsage] as number;
    
    const { error: updateError } = await db
      .from("user_usage")
      .update({
        [column]: currentValue + 1,
        updatedAt: new Date().toISOString(),
      })
      .eq("userId", userId);

    if (updateError) {
      console.error("[Usage] Error incrementing usage:", updateError);
      return false;
    }
  }

  console.log(`[Usage] Incremented ${usageType} for user ${userId}`);
  return true;
}

/**
 * Get upgrade message based on usage type and current tier
 */
function getUpgradeMessage(usageType: UsageType, currentTier: SubscriptionTier): string {
  const limits = getPlanLimits(currentTier);
  
  switch (usageType) {
    case "personalMessages": {
      if (currentTier === "free") {
        return `You've reached your daily limit of ${limits.personalMessagesPerDay} personal chat messages. Upgrade to Plus for 125/day or Pro for unlimited!`;
      }
      if (currentTier === "plus") {
        return `You've reached your daily limit of ${limits.personalMessagesPerDay} personal chat messages. Upgrade to Pro for unlimited messages!`;
      }
      return "Daily message limit reached.";
    }
    case "imageGenerations": {
      if (currentTier === "free") {
        return `You've used all ${limits.imageGenerationsPerMonth} image generations for this month. Upgrade to Plus for 25/month or Pro for 50/month!`;
      }
      if (currentTier === "plus") {
        return `You've used all ${limits.imageGenerationsPerMonth} image generations for this month. Upgrade to Pro for 50/month!`;
      }
      return `You've reached your monthly limit of ${limits.imageGenerationsPerMonth} image generations.`;
    }
    case "aiCalls": {
      if (currentTier === "free") {
        return `You've used all ${limits.aiCallsPerMonth} AI calls for this month. Upgrade to Plus for 125/month or Pro for unlimited!`;
      }
      if (currentTier === "plus") {
        return `You've used all ${limits.aiCallsPerMonth} AI calls for this month. Upgrade to Pro for unlimited AI calls!`;
      }
      return "Monthly AI call limit reached.";
    }
  }
}

/**
 * Get remaining usage for all types
 */
export async function getAllRemainingUsage(
  userId: string
): Promise<{
  personalMessages: number;
  imageGenerations: number;
  aiCalls: number;
}> {
  const effectiveTier = await getEffectiveTier(userId);
  const limits = getPlanLimits(effectiveTier);
  const usage = await getUserUsage(userId);

  if (!usage) {
    // Return limits as remaining if we can't get usage
    return {
      personalMessages: limits.personalMessagesPerDay,
      imageGenerations: limits.imageGenerationsPerMonth,
      aiCalls: limits.aiCallsPerMonth,
    };
  }

  return {
    personalMessages: limits.personalMessagesPerDay === -1
      ? -1
      : Math.max(0, limits.personalMessagesPerDay - usage.personalMessagesCount),
    imageGenerations: Math.max(0, limits.imageGenerationsPerMonth - usage.imageGenerationsCount),
    aiCalls: limits.aiCallsPerMonth === -1
      ? -1
      : Math.max(0, limits.aiCallsPerMonth - usage.aiCallsCount),
  };
}

// Helper to get the start of next month
function getNextMonthReset(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

// Helper to format DB record to TypeScript type
function formatUsage(record: any): UserUsage {
  return {
    id: record.id,
    userId: record.userId,
    personalMessagesCount: record.personalMessagesCount,
    personalMessagesResetAt: record.personalMessagesResetAt,
    imageGenerationsCount: record.imageGenerationsCount,
    imageGenerationsResetAt: record.imageGenerationsResetAt,
    aiCallsCount: record.aiCallsCount,
    aiCallsResetAt: record.aiCallsResetAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
