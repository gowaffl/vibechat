/**
 * Subscription Service
 * 
 * Manages user subscriptions, tier verification, and RevenueCat integration.
 * Handles the three subscription tiers: Free, Plus ($5/mo), Pro ($20/mo)
 */

import { db } from "../db";
import type {
  SubscriptionTier,
  UserSubscription,
  PlanLimits,
  FeatureGateResponse,
} from "@/shared/contracts";

// Plan limits configuration
export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    personalMessagesPerDay: 25,
    imageGenerationsPerMonth: 5,
    aiCallsPerMonth: 25,
    vibeCallsEnabled: false,
  },
  plus: {
    personalMessagesPerDay: 125, // 5x free
    imageGenerationsPerMonth: 25, // 5x free
    aiCallsPerMonth: 125, // 5x free
    vibeCallsEnabled: false,
  },
  pro: {
    personalMessagesPerDay: -1, // Unlimited
    imageGenerationsPerMonth: 50,
    aiCallsPerMonth: -1, // Unlimited
    vibeCallsEnabled: true,
  },
};

/**
 * Get user's subscription record, creating one if it doesn't exist
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data: subscription, error } = await db
    .from("user_subscription")
    .select("*")
    .eq("userId", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Subscription] Error fetching subscription:", error);
    return null;
  }

  if (!subscription) {
    // Create subscription with 7-day trial if it doesn't exist
    const { data: newSubscription, error: createError } = await db
      .from("user_subscription")
      .insert({
        userId,
        subscriptionTier: "free",
        isTrialActive: true,
        trialStartedAt: new Date().toISOString(),
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("[Subscription] Error creating subscription:", createError);
      return null;
    }

    console.log(`[Subscription] Created new subscription with trial for user ${userId}`);
    return formatSubscription(newSubscription);
  }

  return formatSubscription(subscription);
}

/**
 * Get user's effective subscription tier (considering trial status)
 */
export async function getEffectiveTier(userId: string): Promise<SubscriptionTier> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return "free";
  }

  // Check if trial is active and not expired
  if (subscription.isTrialActive && subscription.trialEndsAt) {
    const trialEnd = new Date(subscription.trialEndsAt);
    if (trialEnd > new Date()) {
      return "pro"; // Trial grants Pro access
    }
    
    // Trial expired - mark it as inactive
    await db
      .from("user_subscription")
      .update({ isTrialActive: false })
      .eq("userId", userId);
  }

  // Check if subscription is active and not expired
  if (subscription.subscriptionExpiresAt) {
    const expiresAt = new Date(subscription.subscriptionExpiresAt);
    if (expiresAt > new Date()) {
      return subscription.subscriptionTier;
    }
    
    // Subscription expired - revert to free
    await db
      .from("user_subscription")
      .update({ subscriptionTier: "free" })
      .eq("userId", userId);
    
    return "free";
  }

  return subscription.subscriptionTier;
}

/**
 * Get plan limits for a tier
 */
export function getPlanLimits(tier: SubscriptionTier): PlanLimits {
  return PLAN_LIMITS[tier];
}

/**
 * Check if a feature is available for the user's tier
 * Used for Pro-only features like Vibe Calls
 */
export async function checkFeatureAccess(
  userId: string,
  feature: "vibeCallsEnabled"
): Promise<FeatureGateResponse> {
  const effectiveTier = await getEffectiveTier(userId);
  const limits = getPlanLimits(effectiveTier);
  
  const allowed = limits[feature] === true;
  
  return {
    allowed,
    requiredTier: "pro",
    currentTier: effectiveTier,
    message: allowed
      ? undefined
      : "Vibe Calls require a Pro subscription. Upgrade to unlock voice calling.",
  };
}

/**
 * Update subscription from RevenueCat webhook or sync
 */
export async function updateSubscription(
  userId: string,
  updates: {
    subscriptionTier?: SubscriptionTier;
    revenueCatCustomerId?: string;
    revenueCatEntitlementId?: string;
    subscriptionStartedAt?: string;
    subscriptionExpiresAt?: string | null;
    isTrialActive?: boolean;
  }
): Promise<UserSubscription | null> {
  const { data, error } = await db
    .from("user_subscription")
    .update({
      ...updates,
      lastVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("userId", userId)
    .select()
    .single();

  if (error) {
    console.error("[Subscription] Error updating subscription:", error);
    return null;
  }

  console.log(`[Subscription] Updated subscription for user ${userId}:`, updates);
  return formatSubscription(data);
}

/**
 * Map RevenueCat entitlement to subscription tier
 * Note: entitlementId must match the lookup_key in RevenueCat dashboard
 */
export function mapEntitlementToTier(entitlementId: string): SubscriptionTier {
  const normalized = entitlementId.toLowerCase().trim();
  switch (normalized) {
    case "pro":
    case "vibechat pro": // Matches RevenueCat lookup_key "VibeChat Pro"
    case "vibechat_pro":
      return "pro";
    case "plus":
    case "vibechat plus":
    case "vibechat_plus":
      return "plus";
    default:
      return "free";
  }
}

/**
 * Handle RevenueCat webhook events
 */
export async function handleRevenueCatWebhook(event: {
  type: string;
  app_user_id: string;
  product_id?: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number;
}): Promise<{ success: boolean; message: string }> {
  const userId = event.app_user_id;
  
  console.log(`[Subscription] Processing RevenueCat webhook: ${event.type} for user ${userId}`);

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE": {
      // User purchased or renewed subscription
      const entitlementId = event.entitlement_ids?.[0] || "";
      const tier = mapEntitlementToTier(entitlementId);
      
      await updateSubscription(userId, {
        subscriptionTier: tier,
        revenueCatEntitlementId: entitlementId,
        subscriptionStartedAt: new Date().toISOString(),
        subscriptionExpiresAt: event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null,
        isTrialActive: false, // Purchase cancels trial
      });
      
      return { success: true, message: `Subscription updated to ${tier}` };
    }
    
    case "CANCELLATION":
    case "EXPIRATION": {
      // Subscription cancelled or expired
      await updateSubscription(userId, {
        subscriptionTier: "free",
        subscriptionExpiresAt: null,
      });
      
      return { success: true, message: "Subscription cancelled, reverted to free" };
    }
    
    case "BILLING_ISSUE": {
      // Payment failed - log but don't immediately downgrade
      console.warn(`[Subscription] Billing issue for user ${userId}`);
      return { success: true, message: "Billing issue noted" };
    }
    
    default:
      console.log(`[Subscription] Unhandled webhook event type: ${event.type}`);
      return { success: true, message: "Event acknowledged" };
  }
}

/**
 * Check if user is in trial period
 */
export async function isInTrialPeriod(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) return false;
  
  if (!subscription.isTrialActive || !subscription.trialEndsAt) {
    return false;
  }
  
  return new Date(subscription.trialEndsAt) > new Date();
}

/**
 * Get remaining trial days
 */
export async function getRemainingTrialDays(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription || !subscription.isTrialActive || !subscription.trialEndsAt) {
    return 0;
  }
  
  const trialEnd = new Date(subscription.trialEndsAt);
  const now = new Date();
  
  if (trialEnd <= now) return 0;
  
  const msRemaining = trialEnd.getTime() - now.getTime();
  return Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
}

// Helper to format DB record to TypeScript type
function formatSubscription(record: any): UserSubscription {
  return {
    id: record.id,
    userId: record.userId,
    subscriptionTier: record.subscriptionTier,
    revenueCatCustomerId: record.revenueCatCustomerId,
    revenueCatEntitlementId: record.revenueCatEntitlementId,
    isTrialActive: record.isTrialActive,
    trialStartedAt: record.trialStartedAt,
    trialEndsAt: record.trialEndsAt,
    subscriptionStartedAt: record.subscriptionStartedAt,
    subscriptionExpiresAt: record.subscriptionExpiresAt,
    lastVerifiedAt: record.lastVerifiedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
