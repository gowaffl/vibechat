import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  Crown,
  Sparkles,
  Zap,
  Check,
  ChevronLeft,
  Star,
  MessageCircle,
  Image as ImageIcon,
  Bot,
  Mic,
  Infinity,
  Gift,
  RefreshCw,
  ExternalLink,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useSubscription,
  type SubscriptionPlan,
} from "@/contexts/SubscriptionContext";
import { useUser } from "@/contexts/UserContext";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import type { PurchasesPackage } from "react-native-purchases";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// TYPES
// ============================================================================

interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: string;
  priceSubtext?: string;
  icon: any;
  color: string;
  gradientColors: [string, string];
  features: Array<{
    icon: any;
    text: string;
    value: string;
    highlight?: boolean;
  }>;
  popular?: boolean;
}

// ============================================================================
// PLAN CONFIGURATIONS
// ============================================================================

const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceSubtext: "forever",
    icon: Sparkles,
    color: "#6B7280",
    gradientColors: ["#374151", "#1F2937"],
    features: [
      { icon: MessageCircle, text: "Personal messages", value: "25/day" },
      { icon: ImageIcon, text: "Image generations", value: "5/month" },
      { icon: Bot, text: "AI calls", value: "25/month" },
      { icon: Mic, text: "Vibe Calls", value: "—" },
    ],
  },
  {
    id: "plus",
    name: "VibeChat Plus",
    price: "$5",
    priceSubtext: "/month",
    icon: Zap,
    color: "#8B5CF6",
    gradientColors: ["#7C3AED", "#5B21B6"],
    features: [
      {
        icon: MessageCircle,
        text: "Personal messages",
        value: "125/day",
        highlight: true,
      },
      {
        icon: ImageIcon,
        text: "Image generations",
        value: "25/month",
        highlight: true,
      },
      { icon: Bot, text: "AI calls", value: "125/month", highlight: true },
      { icon: Mic, text: "Vibe Calls", value: "—" },
    ],
  },
  {
    id: "pro",
    name: "VibeChat Pro",
    price: "$20",
    priceSubtext: "/month",
    icon: Crown,
    color: "#F59E0B",
    gradientColors: ["#F59E0B", "#D97706"],
    popular: true,
    features: [
      {
        icon: MessageCircle,
        text: "Personal messages",
        value: "Unlimited",
        highlight: true,
      },
      {
        icon: ImageIcon,
        text: "Image generations",
        value: "50/month",
        highlight: true,
      },
      { icon: Bot, text: "AI calls", value: "Unlimited", highlight: true },
      { icon: Mic, text: "Vibe Calls", value: "✓", highlight: true },
    ],
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

const PlanCard = ({
  plan,
  isCurrentPlan,
  isSelected,
  onSelect,
  colors,
  isDark,
}: {
  plan: PlanConfig;
  isCurrentPlan: boolean;
  isSelected: boolean;
  onSelect: () => void;
  colors: any;
  isDark: boolean;
}) => {
  const PlanIcon = plan.icon;

  return (
    <Pressable
      onPress={onSelect}
      className="mb-4"
      style={{
        opacity: isCurrentPlan ? 0.7 : 1,
      }}
    >
      <View
        style={{
          borderRadius: 20,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected
            ? plan.color
            : isDark
            ? "rgba(255,255,255,0.1)"
            : "rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {plan.popular && (
          <LinearGradient
            colors={plan.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 16,
              alignItems: "center",
            }}
          >
            <View className="flex-row items-center gap-1">
              <Star size={14} color="white" fill="white" />
              <Text
                style={{
                  color: "white",
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1,
                }}
              >
                MOST POPULAR
              </Text>
            </View>
          </LinearGradient>
        )}

        <View
          style={{
            backgroundColor: isDark
              ? "rgba(30,30,30,0.9)"
              : "rgba(255,255,255,0.9)",
            padding: 20,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: `${plan.color}20`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlanIcon size={24} color={plan.color} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  {plan.name}
                </Text>
                {isCurrentPlan && (
                  <View
                    style={{
                      backgroundColor: `${plan.color}20`,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 8,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: plan.color,
                      }}
                    >
                      CURRENT PLAN
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="items-end">
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  color: colors.text,
                }}
              >
                {plan.price}
              </Text>
              {plan.priceSubtext && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: -4,
                  }}
                >
                  {plan.priceSubtext}
                </Text>
              )}
            </View>
          </View>

          {/* Features */}
          <View className="gap-3">
            {plan.features.map((feature, index) => {
              const FeatureIcon = feature.icon;
              return (
                <View
                  key={index}
                  className="flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <FeatureIcon size={18} color={colors.textSecondary} />
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.textSecondary,
                      }}
                    >
                      {feature.text}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: feature.highlight ? "700" : "500",
                      color: feature.highlight ? plan.color : colors.text,
                    }}
                  >
                    {feature.value}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Selection indicator */}
          {isSelected && !isCurrentPlan && (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: plan.color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={14} color="white" strokeWidth={3} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const UsageBar = ({
  current,
  limit,
  color,
}: {
  current: number;
  limit: number;
  color: string;
}) => {
  const percentage = limit === -1 ? 0 : Math.min((current / limit) * 100, 100);

  return (
    <View
      style={{
        height: 6,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: percentage > 80 ? "#EF4444" : color,
          borderRadius: 3,
        }}
      />
    </View>
  );
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

const SubscriptionScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  const {
    currentPlan,
    isPro,
    isPlus,
    isFreeTrial,
    freeTrialEndsAt,
    usage,
    limits,
    plusOffering,
    proOffering,
    customerInfo,
    isLoading,
    isRestoring,
    purchasePackage,
    restorePurchases,
    presentPaywall,
    presentCustomerCenter,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(
    currentPlan === "free" ? "pro" : currentPlan
  );
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Get the monthly package for the selected plan from the correct offering
  const getPackageForPlan = (plan: SubscriptionPlan): PurchasesPackage | null => {
    if (plan === "free") return null;

    // Get the correct offering based on plan
    const offering = plan === "plus" ? plusOffering : proOffering;
    
    if (!offering?.availablePackages) {
      console.warn(`[SubscriptionScreen] No offering found for plan: ${plan}`);
      return null;
    }

    // Find monthly package (look for $rc_monthly or pro_monthly/plus_monthly)
    const monthlyPkg = offering.availablePackages.find(
      (pkg) =>
        pkg.packageType === "MONTHLY" ||
        pkg.identifier.toLowerCase().includes("monthly")
    );

    if (monthlyPkg) {
      console.log(`[SubscriptionScreen] Found package for ${plan}:`, monthlyPkg.identifier);
      return monthlyPkg;
    }

    // Fallback: return first available package
    console.warn(`[SubscriptionScreen] No monthly package found, using first available`);
    return offering.availablePackages[0] || null;
  };

  const handlePurchase = async () => {
    if (selectedPlan === "free" || selectedPlan === currentPlan) return;

    const pkg = getPackageForPlan(selectedPlan);
    if (!pkg) {
      // Fallback to RevenueCat paywall
      await presentPaywall();
      return;
    }

    setIsPurchasing(true);
    try {
      await purchasePackage(pkg);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Calculate trial days remaining
  const getTrialDaysRemaining = () => {
    if (!freeTrialEndsAt) return 0;
    const end = new Date(freeTrialEndsAt);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <LuxeLogoLoader size={80} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={
          isDark
            ? ["rgba(139,92,246,0.3)", "rgba(30,30,30,0)"]
            : ["rgba(139,92,246,0.2)", "rgba(255,255,255,0)"]
        }
        style={{
          paddingTop: insets.top,
          paddingBottom: 20,
        }}
      >
        <View className="flex-row items-center justify-between px-4 pt-3">
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.05)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            Subscription
          </Text>

          <Pressable
            onPress={presentCustomerCenter}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.05)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExternalLink size={20} color={colors.text} />
          </Pressable>
        </View>

                {/* Current Subscription Status Banner */}
                {(isFreeTrial || isPro || isPlus) && (
                  <View
                    style={{
                      marginHorizontal: 16,
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isFreeTrial
                        ? "rgba(245,158,11,0.2)"
                        : isPro
                        ? "rgba(245,158,11,0.2)"
                        : "rgba(139,92,246,0.2)",
                      borderWidth: 1,
                      borderColor: isFreeTrial
                        ? "rgba(245,158,11,0.3)"
                        : isPro
                        ? "rgba(245,158,11,0.3)"
                        : "rgba(139,92,246,0.3)",
                    }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        {isFreeTrial ? (
                          <Gift size={20} color="#F59E0B" />
                        ) : isPro ? (
                          <Crown size={20} color="#F59E0B" />
                        ) : (
                          <Zap size={20} color="#8B5CF6" />
                        )}
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: isFreeTrial
                              ? "#F59E0B"
                              : isPro
                              ? "#F59E0B"
                              : "#8B5CF6",
                          }}
                        >
                          {isFreeTrial
                            ? "Pro Trial Active"
                            : isPro
                            ? "VibeChat Pro"
                            : "VibeChat Plus"}
                        </Text>
                      </View>
                      <Pressable
                        onPress={presentCustomerCenter}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: colors.text,
                          }}
                        >
                          Manage
                        </Text>
                      </Pressable>
                    </View>
                    {isFreeTrial ? (
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textSecondary,
                        }}
                      >
                        {getTrialDaysRemaining()} days remaining. Subscribe before your
                        trial ends to keep Pro features!
                      </Text>
                    ) : customerInfo?.managementURL ? (
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textSecondary,
                        }}
                      >
                        {customerInfo.latestExpirationDate
                          ? `Renews on ${new Date(
                              customerInfo.latestExpirationDate
                            ).toLocaleDateString()}`
                          : "Active subscription"}
                      </Text>
                    ) : null}
                  </View>
                )}
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Usage Summary */}
        <View
          style={{
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.02)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: 16,
            }}
          >
            CURRENT USAGE
          </Text>

          <View className="gap-4">
            <View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ fontSize: 14, color: colors.text }}>
                  Personal Messages (Today)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  {usage.dailyPersonalMessages}
                  {limits.personalMessages !== -1
                    ? ` / ${limits.personalMessages}`
                    : " / ∞"}
                </Text>
              </View>
              <UsageBar
                current={usage.dailyPersonalMessages}
                limit={limits.personalMessages}
                color="#8B5CF6"
              />
            </View>

            <View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ fontSize: 14, color: colors.text }}>
                  Image Generations (Monthly)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  {usage.monthlyImageGenerations} / {limits.imageGenerations}
                </Text>
              </View>
              <UsageBar
                current={usage.monthlyImageGenerations}
                limit={limits.imageGenerations}
                color="#10B981"
              />
            </View>

            <View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ fontSize: 14, color: colors.text }}>
                  AI Calls (Monthly)
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  {usage.monthlyAICalls}
                  {limits.aiCalls !== -1 ? ` / ${limits.aiCalls}` : " / ∞"}
                </Text>
              </View>
              <UsageBar
                current={usage.monthlyAICalls}
                limit={limits.aiCalls}
                color="#F59E0B"
              />
            </View>
          </View>
        </View>

        {/* Always Free Features */}
        <View
          style={{
            backgroundColor: isDark
              ? "rgba(16,185,129,0.1)"
              : "rgba(16,185,129,0.05)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: "rgba(16,185,129,0.2)",
          }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <Infinity size={18} color="#10B981" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: "#10B981",
              }}
            >
              ALWAYS FREE
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              lineHeight: 20,
            }}
          >
            • Unlimited AI auto-engagement in group chats{"\n"}
            • TLDR summaries & AI catch-up summaries{"\n"}
            • Message translation
          </Text>
        </View>

                {/* Subscription Management Info for Active Subscribers */}
                {(isPro || isPlus) && !isFreeTrial && (
                  <View
                    style={{
                      backgroundColor: isDark
                        ? "rgba(59,130,246,0.1)"
                        : "rgba(59,130,246,0.05)",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 24,
                      borderWidth: 1,
                      borderColor: "rgba(59,130,246,0.2)",
                    }}
                  >
                    <View className="flex-row items-center gap-2 mb-3">
                      <ExternalLink size={18} color="#3B82F6" />
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#3B82F6",
                        }}
                      >
                        MANAGE YOUR SUBSCRIPTION
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        lineHeight: 20,
                      }}
                    >
                      In the subscription manager you can:{"\n"}
                      • View billing history and receipts{"\n"}
                      • Update payment method{"\n"}
                      • Change your subscription plan{"\n"}
                      • Cancel your subscription{"\n"}
                      {"\n"}
                      If you cancel, you'll still have access until the end of your billing period.
                    </Text>
                  </View>
                )}

                {/* Plan Cards */}
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.textSecondary,
                    marginBottom: 12,
                  }}
                >
                  {isPro || isPlus ? "CHANGE YOUR PLAN" : "CHOOSE YOUR PLAN"}
                </Text>

        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={currentPlan === plan.id}
            isSelected={selectedPlan === plan.id}
            onSelect={() => setSelectedPlan(plan.id)}
            colors={colors}
            isDark={isDark}
          />
        ))}

        {/* Restore Purchases */}
        <Pressable
          onPress={restorePurchases}
          disabled={isRestoring}
          className="flex-row items-center justify-center gap-2 py-4"
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <RefreshCw size={16} color={colors.textSecondary} />
          )}
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Restore Purchases
          </Text>
        </Pressable>
      </ScrollView>

      {/* Bottom CTA */}
      <BlurView
        intensity={isDark ? 60 : 80}
        tint={isDark ? "dark" : "light"}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 16,
          paddingTop: 16,
          paddingHorizontal: 16,
          borderTopWidth: 1,
          borderTopColor: isDark
            ? "rgba(255,255,255,0.1)"
            : "rgba(0,0,0,0.05)",
        }}
      >
        {/* Subscribe/Upgrade Button */}
        {selectedPlan !== "free" && selectedPlan !== currentPlan && (
          <Pressable
            onPress={handlePurchase}
            disabled={isPurchasing}
            style={{
              opacity: isPurchasing ? 0.7 : 1,
            }}
          >
            <LinearGradient
              colors={
                selectedPlan === "pro"
                  ? ["#F59E0B", "#D97706"]
                  : ["#8B5CF6", "#7C3AED"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 16,
                borderRadius: 16,
              }}
            >
              {isPurchasing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  {selectedPlan === "pro" ? (
                    <Crown size={20} color="white" />
                  ) : (
                    <Zap size={20} color="white" />
                  )}
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "white",
                    }}
                  >
                    Subscribe to{" "}
                    {PLANS.find((p) => p.id === selectedPlan)?.name}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}

                {/* Manage Subscription / Change Plan for existing subscribers */}
                {(isPro || isPlus) && !isFreeTrial && (
                  <View className="gap-3">
                    {/* Allow upgrading from Plus to Pro or downgrading from Pro to Plus */}
                    {selectedPlan !== currentPlan && selectedPlan !== "free" && (
                      <Pressable
                        onPress={handlePurchase}
                        disabled={isPurchasing}
                        style={{
                          opacity: isPurchasing ? 0.7 : 1,
                        }}
                      >
                        <LinearGradient
                          colors={
                            selectedPlan === "pro"
                              ? ["#F59E0B", "#D97706"]
                              : ["#8B5CF6", "#7C3AED"]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            paddingVertical: 16,
                            borderRadius: 16,
                          }}
                        >
                          {isPurchasing ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <>
                              {selectedPlan === "pro" ? (
                                <Crown size={20} color="white" />
                              ) : (
                                <Zap size={20} color="white" />
                              )}
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "700",
                                  color: "white",
                                }}
                              >
                                {isPlus && selectedPlan === "pro"
                                  ? "Upgrade to Pro"
                                  : isPro && selectedPlan === "plus"
                                  ? "Switch to Plus"
                                  : "Change Plan"}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                )}

                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    textAlign: "center",
                    marginTop: 12,
                    lineHeight: 16,
                  }}
                >
                  Subscriptions auto-renew monthly. Cancel anytime.
                </Text>
      </BlurView>
    </View>
  );
};

export default SubscriptionScreen;
