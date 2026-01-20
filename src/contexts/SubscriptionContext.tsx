import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesError,
} from "react-native-purchases";
import { Platform, Alert } from "react-native";
import { useUser } from "./UserContext";
import { api } from "@/lib/api";
import { useAnalytics } from "@/hooks/useAnalytics";

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionPlan = "free" | "plus" | "pro";

export interface UsageLimits {
  personalMessages: number; // -1 for unlimited
  imageGenerations: number;
  aiCalls: number; // -1 for unlimited
  vibeCalls: boolean;
}

export interface UsageStats {
  dailyPersonalMessages: number;
  monthlyImageGenerations: number;
  monthlyAICalls: number;
}

export interface SubscriptionState {
  // Current plan info
  currentPlan: SubscriptionPlan;
  isPro: boolean;
  isPlus: boolean;
  isFreeTrial: boolean;
  freeTrialEndsAt: string | null;
  hasUsedFreeTrial: boolean;

  // Usage tracking
  usage: UsageStats;
  limits: UsageLimits;

  // RevenueCat info
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  plusOffering: PurchasesOffering | null;
  proOffering: PurchasesOffering | null;
  availablePackages: PurchasesPackage[];

  // State
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
}

export interface SubscriptionContextType extends SubscriptionState {
  // Actions
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywall: () => Promise<void>;
  presentCustomerCenter: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  startFreeTrial: () => Promise<boolean>;

  // Helpers
  canUseFeature: (feature: "personal_message" | "image_generation" | "ai_call" | "vibe_call") => boolean;
  getRemainingUsage: (feature: "personal_message" | "image_generation" | "ai_call") => number;
  getUpgradeMessage: (feature: string) => string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REVENUECAT_API_KEY = "test_yRYvtLzmxZeukKZSqwKPYpSXpTE";

// Entitlement IDs configured in RevenueCat
// These must match the lookup_key values in RevenueCat dashboard
const ENTITLEMENTS = {
  PRO: "VibeChat Pro", // Note: includes space, matches RevenueCat lookup_key
  PLUS: "plus",
};

// Plan limits
const PLAN_LIMITS: Record<SubscriptionPlan, UsageLimits> = {
  free: {
    personalMessages: 25,
    imageGenerations: 5,
    aiCalls: 25,
    vibeCalls: false,
  },
  plus: {
    personalMessages: 125,
    imageGenerations: 25,
    aiCalls: 125,
    vibeCalls: false,
  },
  pro: {
    personalMessages: -1, // Unlimited
    imageGenerations: 50,
    aiCalls: -1, // Unlimited
    vibeCalls: true,
  },
};

// ============================================================================
// CONTEXT
// ============================================================================

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

// ============================================================================
// PROVIDER
// ============================================================================

export const SubscriptionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useUser();
  const analytics = useAnalytics();

  // State
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>("free");
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [freeTrialEndsAt, setFreeTrialEndsAt] = useState<string | null>(null);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [plusOffering, setPlusOffering] = useState<PurchasesOffering | null>(null);
  const [proOffering, setProOffering] = useState<PurchasesOffering | null>(null);
  const [availablePackages, setAvailablePackages] = useState<PurchasesPackage[]>([]);
  const [usage, setUsage] = useState<UsageStats>({
    dailyPersonalMessages: 0,
    monthlyImageGenerations: 0,
    monthlyAICalls: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed values
  const isPro = currentPlan === "pro";
  const isPlus = currentPlan === "plus";
  const limits = PLAN_LIMITS[currentPlan];

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loginToRevenueCat(user.id);
      fetchSubscriptionStatus();
    }
  }, [user?.id]);

  const initializeRevenueCat = async () => {
    try {
      // Set log level for debugging (change to LOG_LEVEL.ERROR in production)
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      // Configure RevenueCat
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
      });

      console.log("[Subscription] RevenueCat initialized");

      // Set up listener for customer info updates
      Purchases.addCustomerInfoUpdateListener((info) => {
        console.log("[Subscription] Customer info updated");
        handleCustomerInfoUpdate(info);
      });

      // Fetch offerings
      await fetchOfferings();
    } catch (err) {
      console.error("[Subscription] Failed to initialize RevenueCat:", err);
      setError("Failed to initialize subscription service");
    } finally {
      setIsLoading(false);
    }
  };

  const loginToRevenueCat = async (userId: string) => {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      console.log("[Subscription] Logged in to RevenueCat as:", userId);
      handleCustomerInfoUpdate(customerInfo);
    } catch (err) {
      console.error("[Subscription] Failed to login to RevenueCat:", err);
    }
  };

  // ============================================================================
  // FETCHING
  // ============================================================================

  const fetchOfferings = async () => {
    try {
      const allOfferings = await Purchases.getOfferings();

      // Set current offering
      if (allOfferings.current) {
        setOfferings(allOfferings.current);
        console.log(
          "[Subscription] Current offering:",
          allOfferings.current.identifier
        );
      }

      // Get Plus offering (lookup_key: "Plus")
      const plus = allOfferings.all["Plus"];
      if (plus) {
        setPlusOffering(plus);
        console.log("[Subscription] Plus offering found:", plus.identifier);
      }

      // Get Pro offering (lookup_key: "Pro")
      const pro = allOfferings.all["Pro"];
      if (pro) {
        setProOffering(pro);
        console.log("[Subscription] Pro offering found:", pro.identifier);
      }

      // Combine all packages from both offerings
      const allPackages: PurchasesPackage[] = [];
      if (plus?.availablePackages) {
        allPackages.push(...plus.availablePackages);
      }
      if (pro?.availablePackages) {
        allPackages.push(...pro.availablePackages);
      }

      setAvailablePackages(allPackages);
      console.log(`[Subscription] Total packages available: ${allPackages.length}`);

      if (allPackages.length === 0) {
        console.warn("[Subscription] No packages available in offerings");
      }
    } catch (err) {
      console.error("[Subscription] Failed to fetch offerings:", err);
    }
  };

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) return;

    try {
      const response = await api.get<{
        currentPlan: SubscriptionPlan;
        isPro: boolean;
        isPlus: boolean;
        isFreeTrial: boolean;
        freeTrialEndsAt: string | null;
        hasUsedFreeTrial: boolean;
        usage: UsageStats;
        limits: UsageLimits;
      }>(`/api/subscriptions/status?userId=${user.id}`);

      setCurrentPlan(response.currentPlan);
      setIsFreeTrial(response.isFreeTrial);
      setFreeTrialEndsAt(response.freeTrialEndsAt);
      setHasUsedFreeTrial(response.hasUsedFreeTrial);
      setUsage(response.usage);

      console.log("[Subscription] Fetched status:", response.currentPlan);
    } catch (err) {
      console.error("[Subscription] Failed to fetch subscription status:", err);
    }
  };

  const refreshSubscriptionStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // Refresh RevenueCat customer info
      const info = await Purchases.getCustomerInfo();
      handleCustomerInfoUpdate(info);

      // Refresh from our backend
      await fetchSubscriptionStatus();
    } catch (err) {
      console.error("[Subscription] Failed to refresh status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // ============================================================================
  // CUSTOMER INFO HANDLING
  // ============================================================================

  const handleCustomerInfoUpdate = (info: CustomerInfo) => {
    setCustomerInfo(info);

    // Determine plan from entitlements
    let newPlan: SubscriptionPlan = "free";

    if (info.entitlements.active[ENTITLEMENTS.PRO]) {
      newPlan = "pro";
      const entitlement = info.entitlements.active[ENTITLEMENTS.PRO];
      setIsFreeTrial(entitlement.periodType === "TRIAL");
      if (entitlement.expirationDate) {
        setFreeTrialEndsAt(entitlement.expirationDate);
      }
    } else if (info.entitlements.active[ENTITLEMENTS.PLUS]) {
      newPlan = "plus";
      const entitlement = info.entitlements.active[ENTITLEMENTS.PLUS];
      setIsFreeTrial(entitlement.periodType === "TRIAL");
    } else {
      setIsFreeTrial(false);
      setFreeTrialEndsAt(null);
    }

    if (newPlan !== currentPlan) {
      setCurrentPlan(newPlan);
      console.log("[Subscription] Plan updated to:", newPlan);

      // Track plan change
      analytics.capture("subscription_plan_changed", {
        new_plan: newPlan,
        previous_plan: currentPlan,
        is_trial: isFreeTrial,
      });

      // Sync with backend
      syncSubscriptionToBackend(newPlan, info);
    }
  };

  const syncSubscriptionToBackend = async (
    plan: SubscriptionPlan,
    info: CustomerInfo
  ) => {
    if (!user?.id) return;

    try {
      const entitlement =
        info.entitlements.active[ENTITLEMENTS.PRO] ||
        info.entitlements.active[ENTITLEMENTS.PLUS];

      await api.post("/api/subscriptions/sync", {
        userId: user.id,
        currentPlan: plan,
        revenueCatId: info.originalAppUserId,
        entitlementId: entitlement?.identifier || null,
        expiresAt: entitlement?.expirationDate || null,
        isFreeTrial: entitlement?.periodType === "TRIAL",
        freeTrialEndsAt:
          entitlement?.periodType === "TRIAL"
            ? entitlement.expirationDate
            : null,
      });

      console.log("[Subscription] Synced to backend");
    } catch (err) {
      console.error("[Subscription] Failed to sync to backend:", err);
    }
  };

  // ============================================================================
  // PURCHASE ACTIONS
  // ============================================================================

  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      handleCustomerInfoUpdate(customerInfo);

      // Track purchase
      analytics.capture("subscription_purchased", {
        package_id: pkg.identifier,
        product_id: pkg.product.identifier,
        price: pkg.product.price,
        currency: pkg.product.currencyCode,
      });

      Alert.alert(
        "Purchase Successful! 🎉",
        "Thank you for subscribing to VibeChat! Your premium features are now active."
      );

      return true;
    } catch (err) {
      const purchaseError = err as PurchasesError;

      // Handle user cancellation
      if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        console.log("[Subscription] Purchase cancelled by user");
        return false;
      }

      console.error("[Subscription] Purchase failed:", purchaseError);
      setError(purchaseError.message || "Purchase failed");

      // Track failed purchase
      analytics.capture("subscription_purchase_failed", {
        package_id: pkg.identifier,
        error_code: purchaseError.code,
        error_message: purchaseError.message,
      });

      Alert.alert(
        "Purchase Failed",
        purchaseError.message || "Something went wrong. Please try again."
      );

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      setIsRestoring(true);
      setError(null);

      const info = await Purchases.restorePurchases();
      handleCustomerInfoUpdate(info);

      const hasActiveSubscription =
        info.entitlements.active[ENTITLEMENTS.PRO] ||
        info.entitlements.active[ENTITLEMENTS.PLUS];

      if (hasActiveSubscription) {
        Alert.alert(
          "Purchases Restored! 🎉",
          "Your subscription has been restored successfully."
        );
        return true;
      } else {
        Alert.alert(
          "No Active Subscription",
          "We couldn't find any previous purchases to restore."
        );
        return false;
      }
    } catch (err) {
      const purchaseError = err as PurchasesError;
      console.error("[Subscription] Restore failed:", purchaseError);
      setError(purchaseError.message || "Restore failed");

      Alert.alert(
        "Restore Failed",
        purchaseError.message || "Something went wrong. Please try again."
      );

      return false;
    } finally {
      setIsRestoring(false);
    }
  };

  const presentPaywall = async () => {
    try {
      // Import the UI module dynamically
      const RevenueCatUI = await import("react-native-purchases-ui");

      const paywallResult = await RevenueCatUI.default.presentPaywall();

      console.log("[Subscription] Paywall result:", paywallResult);

      // Refresh after paywall closes
      await refreshSubscriptionStatus();
    } catch (err) {
      console.error("[Subscription] Failed to present paywall:", err);

      // Fallback: show alert with available packages
      if (availablePackages.length > 0) {
        Alert.alert(
          "Upgrade to Premium",
          "Choose a plan to unlock all features",
          availablePackages.map((pkg) => ({
            text: `${pkg.product.title} - ${pkg.product.priceString}`,
            onPress: () => purchasePackage(pkg),
          }))
        );
      }
    }
  };

  const presentCustomerCenter = async () => {
    try {
      const RevenueCatUI = await import("react-native-purchases-ui");
      await RevenueCatUI.default.presentCustomerCenter();
    } catch (err) {
      console.error("[Subscription] Failed to present customer center:", err);
      Alert.alert(
        "Error",
        "Unable to open subscription management. Please try again."
      );
    }
  };

  const startFreeTrial = async (): Promise<boolean> => {
    if (hasUsedFreeTrial) {
      Alert.alert(
        "Free Trial Already Used",
        "You've already used your free trial. Subscribe to continue enjoying premium features!"
      );
      return false;
    }

    // Find the Pro package with a free trial
    const proPackage = availablePackages.find(
      (pkg) =>
        pkg.product.identifier.includes("pro") &&
        pkg.product.introPrice !== null
    );

    if (proPackage) {
      return await purchasePackage(proPackage);
    } else {
      // If no package with trial, start backend-managed trial
      try {
        await api.post("/api/subscriptions/start-trial", {
          userId: user?.id,
        });

        setIsFreeTrial(true);
        setCurrentPlan("pro");
        setHasUsedFreeTrial(true);

        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        setFreeTrialEndsAt(trialEnd.toISOString());

        analytics.capture("free_trial_started", {
          trial_days: 7,
        });

        Alert.alert(
          "Welcome to VibeChat Pro! 🎉",
          "Enjoy 7 days of unlimited features. Your trial will end on " +
            trialEnd.toLocaleDateString()
        );

        return true;
      } catch (err) {
        console.error("[Subscription] Failed to start trial:", err);
        Alert.alert("Error", "Failed to start free trial. Please try again.");
        return false;
      }
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const canUseFeature = useCallback(
    (
      feature: "personal_message" | "image_generation" | "ai_call" | "vibe_call"
    ): boolean => {
      switch (feature) {
        case "personal_message":
          return (
            limits.personalMessages === -1 ||
            usage.dailyPersonalMessages < limits.personalMessages
          );
        case "image_generation":
          return usage.monthlyImageGenerations < limits.imageGenerations;
        case "ai_call":
          return (
            limits.aiCalls === -1 || usage.monthlyAICalls < limits.aiCalls
          );
        case "vibe_call":
          return limits.vibeCalls;
        default:
          return false;
      }
    },
    [limits, usage]
  );

  const getRemainingUsage = useCallback(
    (feature: "personal_message" | "image_generation" | "ai_call"): number => {
      switch (feature) {
        case "personal_message":
          return limits.personalMessages === -1
            ? Infinity
            : Math.max(0, limits.personalMessages - usage.dailyPersonalMessages);
        case "image_generation":
          return Math.max(
            0,
            limits.imageGenerations - usage.monthlyImageGenerations
          );
        case "ai_call":
          return limits.aiCalls === -1
            ? Infinity
            : Math.max(0, limits.aiCalls - usage.monthlyAICalls);
        default:
          return 0;
      }
    },
    [limits, usage]
  );

  const getUpgradeMessage = useCallback(
    (feature: string): string => {
      const planName = currentPlan === "free" ? "Plus or Pro" : "Pro";
      const messages: Record<string, string> = {
        personal_message: `You've reached your daily message limit. Upgrade to ${planName} for more messages!`,
        image_generation: `You've reached your monthly image limit. Upgrade to ${planName} for more generations!`,
        ai_call: `You've reached your monthly AI call limit. Upgrade to ${planName} for more AI features!`,
        vibe_call: "Vibe Calls are a Pro-exclusive feature. Upgrade to Pro to start voice chats!",
      };
      return messages[feature] || `Upgrade to ${planName} to access this feature!`;
    },
    [currentPlan]
  );

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue: SubscriptionContextType = {
    // State
    currentPlan,
    isPro,
    isPlus,
    isFreeTrial,
    freeTrialEndsAt,
    hasUsedFreeTrial,
    usage,
    limits,
    customerInfo,
    offerings,
    plusOffering,
    proOffering,
    availablePackages,
    isLoading,
    isRestoring,
    error,

    // Actions
    purchasePackage,
    restorePurchases,
    presentPaywall,
    presentCustomerCenter,
    refreshSubscriptionStatus,
    startFreeTrial,

    // Helpers
    canUseFeature,
    getRemainingUsage,
    getUpgradeMessage,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error(
      "useSubscription must be used within SubscriptionProvider"
    );
  }
  return context;
};

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Quick check for Pro status
 */
export const useIsPro = () => {
  const { isPro, isFreeTrial, currentPlan } = useSubscription();
  return isPro || (isFreeTrial && currentPlan === "pro");
};

/**
 * Quick check for Plus or higher status
 */
export const useIsPlusOrHigher = () => {
  const { isPro, isPlus } = useSubscription();
  return isPro || isPlus;
};

/**
 * Hook for checking feature access with automatic upgrade prompt
 */
export const useFeatureAccess = (
  feature: "personal_message" | "image_generation" | "ai_call" | "vibe_call"
) => {
  const { canUseFeature, getRemainingUsage, getUpgradeMessage, presentPaywall } =
    useSubscription();

  const hasAccess = canUseFeature(feature);
  const remaining =
    feature !== "vibe_call" ? getRemainingUsage(feature as any) : undefined;
  const upgradeMessage = getUpgradeMessage(feature);

  const checkAccessAndPrompt = useCallback(async (): Promise<boolean> => {
    if (hasAccess) return true;

    Alert.alert("Upgrade Required", upgradeMessage, [
      { text: "Not Now", style: "cancel" },
      { text: "Upgrade", onPress: () => presentPaywall() },
    ]);

    return false;
  }, [hasAccess, upgradeMessage, presentPaywall]);

  return {
    hasAccess,
    remaining,
    upgradeMessage,
    checkAccessAndPrompt,
  };
};
