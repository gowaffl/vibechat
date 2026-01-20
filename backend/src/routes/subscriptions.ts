/**
 * Subscription Routes
 * 
 * API endpoints for subscription management and usage tracking.
 */

import { Hono } from "hono";
import type { AppType } from "../index";
import { zValidator } from "@hono/zod-validator";
import {
  syncSubscriptionRequestSchema,
  revenueCatWebhookEventSchema,
  type GetSubscriptionStatusResponse,
  type SyncSubscriptionResponse,
} from "@/shared/contracts";
import {
  getUserSubscription,
  getEffectiveTier,
  getPlanLimits,
  updateSubscription,
  handleRevenueCatWebhook,
  mapEntitlementToTier,
  getRemainingTrialDays,
} from "../services/subscription-service";
import {
  getUserUsage,
  getAllRemainingUsage,
} from "../services/usage-tracking-service";

const subscriptions = new Hono<AppType>();

/**
 * GET /api/subscriptions/status - Get user's subscription status and usage (via query param)
 * This endpoint is used by the frontend SubscriptionContext
 */
subscriptions.get("/status", async (c) => {
  const userId = c.req.query("userId");
  
  if (!userId) {
    return c.json({ error: "userId query parameter is required" }, 400);
  }

  try {
    const [subscription, usage, effectiveTier, remaining] = await Promise.all([
      getUserSubscription(userId),
      getUserUsage(userId),
      getEffectiveTier(userId),
      getAllRemainingUsage(userId),
    ]);

    if (!subscription || !usage) {
      return c.json({ error: "Failed to fetch subscription data" }, 500);
    }

    const limits = getPlanLimits(effectiveTier);
    const trialDaysRemaining = await getRemainingTrialDays(userId);

    // Response format expected by SubscriptionContext
    const response = {
      currentPlan: effectiveTier,
      isPro: effectiveTier === "pro",
      isPlus: effectiveTier === "plus",
      isFreeTrial: subscription.isTrialActive || false,
      freeTrialEndsAt: subscription.trialEndsAt || null,
      hasUsedFreeTrial: subscription.hasUsedTrial || false,
      trialDaysRemaining: trialDaysRemaining,
      usage: {
        dailyPersonalMessages: usage.dailyPersonalMessages || 0,
        monthlyImageGenerations: usage.monthlyImageGenerations || 0,
        monthlyAICalls: usage.monthlyAiCalls || 0,
      },
      limits: {
        personalMessages: limits.personalMessagesPerDay,
        imageGenerations: limits.imageGenerationsPerMonth,
        aiCalls: limits.aiCallsPerMonth,
        vibeCalls: effectiveTier === "pro",
      },
    };

    return c.json(response);
  } catch (error) {
    console.error("[Subscriptions] Error getting subscription status:", error);
    return c.json({ error: "Failed to get subscription status" }, 500);
  }
});

/**
 * GET /api/subscription/:userId - Get user's subscription status and usage
 */
subscriptions.get("/:userId", async (c) => {
  const userId = c.req.param("userId");

  try {
    const [subscription, usage, effectiveTier, remaining] = await Promise.all([
      getUserSubscription(userId),
      getUserUsage(userId),
      getEffectiveTier(userId),
      getAllRemainingUsage(userId),
    ]);

    if (!subscription || !usage) {
      return c.json({ error: "Failed to fetch subscription data" }, 500);
    }

    const limits = getPlanLimits(effectiveTier);
    const trialDaysRemaining = await getRemainingTrialDays(userId);

    const response: GetSubscriptionStatusResponse = {
      subscription: {
        ...subscription,
        // Add formatted timestamps
        trialStartedAt: subscription.trialStartedAt || null,
        trialEndsAt: subscription.trialEndsAt || null,
        subscriptionStartedAt: subscription.subscriptionStartedAt || null,
        subscriptionExpiresAt: subscription.subscriptionExpiresAt || null,
      },
      usage,
      effectiveTier,
      limits,
      remaining: {
        personalMessages: remaining.personalMessages,
        imageGenerations: remaining.imageGenerations,
        aiCalls: remaining.aiCalls,
      },
    };

    // Add trial info to response if in trial
    if (subscription.isTrialActive && trialDaysRemaining > 0) {
      (response as any).trialDaysRemaining = trialDaysRemaining;
    }

    return c.json(response);
  } catch (error) {
    console.error("[Subscriptions] Error getting subscription status:", error);
    return c.json({ error: "Failed to get subscription status" }, 500);
  }
});

/**
 * POST /api/subscription/sync - Sync subscription with RevenueCat
 * Called from the client after a purchase or to verify current status
 */
subscriptions.post(
  "/sync",
  zValidator("json", syncSubscriptionRequestSchema),
  async (c) => {
    const { userId, revenueCatCustomerId } = c.req.valid("json");

    try {
      // In a real implementation, you would call RevenueCat API here
      // to get the customer's current entitlements
      // For now, we just update the customer ID
      
      const subscription = await updateSubscription(userId, {
        revenueCatCustomerId,
      });

      if (!subscription) {
        return c.json({ error: "Failed to sync subscription" }, 500);
      }

      const effectiveTier = await getEffectiveTier(userId);

      const response: SyncSubscriptionResponse = {
        success: true,
        subscription,
        effectiveTier,
      };

      return c.json(response);
    } catch (error) {
      console.error("[Subscriptions] Error syncing subscription:", error);
      return c.json({ error: "Failed to sync subscription" }, 500);
    }
  }
);

/**
 * POST /api/subscription/webhook - RevenueCat webhook handler
 * This endpoint is called by RevenueCat when subscription events occur
 */
subscriptions.post("/webhook", async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate webhook payload
    const parseResult = revenueCatWebhookEventSchema.safeParse(body);
    if (!parseResult.success) {
      console.error("[Subscriptions] Invalid webhook payload:", parseResult.error);
      return c.json({ error: "Invalid webhook payload" }, 400);
    }

    const { event } = parseResult.data;

    // Process the webhook event
    const result = await handleRevenueCatWebhook({
      type: event.type,
      app_user_id: event.app_user_id,
      product_id: event.product_id,
      entitlement_ids: event.entitlement_ids,
      expiration_at_ms: event.expiration_at_ms,
    });

    console.log(`[Subscriptions] Webhook processed: ${result.message}`);

    return c.json({ success: result.success, message: result.message });
  } catch (error) {
    console.error("[Subscriptions] Error processing webhook:", error);
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

/**
 * POST /api/subscription/update-tier - Manually update subscription tier
 * Used for testing or admin purposes
 */
subscriptions.post("/update-tier", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, tier, expiresAt } = body;

    if (!userId || !tier) {
      return c.json({ error: "userId and tier are required" }, 400);
    }

    if (!["free", "plus", "pro"].includes(tier)) {
      return c.json({ error: "Invalid tier. Must be free, plus, or pro" }, 400);
    }

    const subscription = await updateSubscription(userId, {
      subscriptionTier: tier,
      subscriptionStartedAt: tier !== "free" ? new Date().toISOString() : undefined,
      subscriptionExpiresAt: expiresAt || null,
      isTrialActive: false,
    });

    if (!subscription) {
      return c.json({ error: "Failed to update subscription" }, 500);
    }

    return c.json({
      success: true,
      subscription,
      effectiveTier: await getEffectiveTier(userId),
    });
  } catch (error) {
    console.error("[Subscriptions] Error updating tier:", error);
    return c.json({ error: "Failed to update tier" }, 500);
  }
});

/**
 * POST /api/subscriptions/start-trial - Start a 7-day free trial for new users
 * This is called when a user hasn't used their free trial yet
 */
subscriptions.post("/start-trial", async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if user has already used their trial
    if (subscription.hasUsedTrial) {
      return c.json({ 
        error: "Free trial already used",
        hasUsedTrial: true,
      }, 400);
    }

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Update subscription to start trial
    const updatedSubscription = await updateSubscription(userId, {
      isTrialActive: true,
      hasUsedTrial: true,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
    });

    if (!updatedSubscription) {
      return c.json({ error: "Failed to start trial" }, 500);
    }

    console.log(`[Subscriptions] Free trial started for user ${userId}. Ends at: ${trialEndsAt.toISOString()}`);

    return c.json({
      success: true,
      subscription: updatedSubscription,
      effectiveTier: "pro", // Trial gives Pro access
      trialEndsAt: trialEndsAt.toISOString(),
      message: "Your 7-day free trial has started! Enjoy Pro features.",
    });
  } catch (error) {
    console.error("[Subscriptions] Error starting trial:", error);
    return c.json({ error: "Failed to start trial" }, 500);
  }
});

/**
 * GET /api/subscription/plans - Get available subscription plans and their limits
 */
subscriptions.get("/plans", async (c) => {
  return c.json({
    plans: [
      {
        tier: "free",
        name: "Free",
        price: 0,
        limits: getPlanLimits("free"),
        features: [
          "Unlimited AI auto-engagement in group chats",
          "25 personal chat messages per day",
          "5 image generations per month",
          "25 AI calls per month",
          "Free TLDR summaries",
          "Free AI catch-up summaries",
          "Free translation",
        ],
      },
      {
        tier: "plus",
        name: "VibeChat Plus",
        price: 5,
        priceDisplay: "$5/mo",
        limits: getPlanLimits("plus"),
        features: [
          "Unlimited AI auto-engagement in group chats",
          "125 personal chat messages per day (5x)",
          "25 image generations per month (5x)",
          "125 AI calls per month (5x)",
          "Free TLDR summaries",
          "Free AI catch-up summaries",
          "Free translation",
        ],
      },
      {
        tier: "pro",
        name: "VibeChat Pro",
        price: 20,
        priceDisplay: "$20/mo",
        limits: getPlanLimits("pro"),
        features: [
          "Unlimited AI auto-engagement in group chats",
          "Unlimited personal chat messages",
          "50 image generations per month",
          "Unlimited AI calls",
          "Vibe Calls (voice rooms)",
          "Free TLDR summaries",
          "Free AI catch-up summaries",
          "Free translation",
        ],
        highlighted: true, // Most popular / recommended
      },
    ],
  });
});

export default subscriptions;
