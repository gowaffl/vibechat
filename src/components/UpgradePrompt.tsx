import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  Crown,
  Zap,
  X,
  MessageCircle,
  Image as ImageIcon,
  Bot,
  Mic,
  Sparkles,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/contexts/ThemeContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// TYPES
// ============================================================================

export type UpgradeFeature =
  | "personal_message"
  | "image_generation"
  | "ai_call"
  | "vibe_call";

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  feature: UpgradeFeature;
  customTitle?: string;
  customDescription?: string;
}

// ============================================================================
// FEATURE CONFIGS
// ============================================================================

const FEATURE_CONFIGS: Record<
  UpgradeFeature,
  {
    icon: any;
    title: string;
    description: string;
    color: string;
    recommendedPlan: "plus" | "pro";
  }
> = {
  personal_message: {
    icon: MessageCircle,
    title: "Daily Message Limit Reached",
    description:
      "You've used all your personal chat messages for today. Upgrade to continue chatting with your AI friends!",
    color: "#8B5CF6",
    recommendedPlan: "plus",
  },
  image_generation: {
    icon: ImageIcon,
    title: "Image Generation Limit Reached",
    description:
      "You've used all your image generations for this month. Upgrade to create more stunning AI images!",
    color: "#10B981",
    recommendedPlan: "plus",
  },
  ai_call: {
    icon: Bot,
    title: "AI Call Limit Reached",
    description:
      "You've reached your monthly AI call limit. Upgrade to unlock more AI-powered features!",
    color: "#F59E0B",
    recommendedPlan: "plus",
  },
  vibe_call: {
    icon: Mic,
    title: "Vibe Calls – Pro Only",
    description:
      "Voice chat with your friends in real-time! Vibe Calls are exclusively available for Pro subscribers.",
    color: "#EF4444",
    recommendedPlan: "pro",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export const UpgradePrompt = ({
  visible,
  onClose,
  feature,
  customTitle,
  customDescription,
}: UpgradePromptProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { colors, isDark } = useTheme();
  const { currentPlan, presentPaywall, startFreeTrial, hasUsedFreeTrial } =
    useSubscription();

  const config = FEATURE_CONFIGS[feature];
  const FeatureIcon = config.icon;

  const handleUpgrade = () => {
    onClose();
    navigation.navigate("Subscription");
  };

  const handleQuickUpgrade = async () => {
    await presentPaywall();
  };

  const handleStartTrial = async () => {
    await startFreeTrial();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          onPress={onClose}
        />

        <View
          style={{
            width: SCREEN_WIDTH - 48,
            maxWidth: 400,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <BlurView
            intensity={isDark ? 80 : 100}
            tint={isDark ? "dark" : "light"}
            style={{ overflow: "hidden" }}
          >
            {/* Header Gradient */}
            <LinearGradient
              colors={
                config.recommendedPlan === "pro"
                  ? ["rgba(245,158,11,0.3)", "transparent"]
                  : ["rgba(139,92,246,0.3)", "transparent"]
              }
              style={{
                paddingTop: 24,
                paddingHorizontal: 24,
              }}
            >
              {/* Close Button */}
              <Pressable
                onPress={onClose}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.05)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>

              {/* Icon */}
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: `${config.color}20`,
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "center",
                  marginBottom: 16,
                }}
              >
                <FeatureIcon size={32} color={config.color} />
              </View>

              {/* Title */}
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.text,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {customTitle || config.title}
              </Text>

              {/* Description */}
              <Text
                style={{
                  fontSize: 15,
                  color: colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 22,
                  paddingBottom: 24,
                }}
              >
                {customDescription || config.description}
              </Text>
            </LinearGradient>

            {/* Content */}
            <View
              style={{
                padding: 24,
                backgroundColor: isDark
                  ? "rgba(20,20,20,0.9)"
                  : "rgba(255,255,255,0.9)",
              }}
            >
              {/* Show benefits */}
              <View
                style={{
                  marginBottom: 20,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.textSecondary,
                    marginBottom: 12,
                    letterSpacing: 0.5,
                  }}
                >
                  {config.recommendedPlan === "pro"
                    ? "UNLOCK WITH PRO"
                    : "UPGRADE TO PLUS OR PRO"}
                </Text>

                <View className="gap-3">
                  {config.recommendedPlan === "pro" ? (
                    <>
                      <FeatureRow
                        icon={MessageCircle}
                        text="Unlimited personal messages"
                        colors={colors}
                      />
                      <FeatureRow
                        icon={ImageIcon}
                        text="50 image generations/month"
                        colors={colors}
                      />
                      <FeatureRow
                        icon={Bot}
                        text="Unlimited AI calls"
                        colors={colors}
                      />
                      <FeatureRow
                        icon={Mic}
                        text="Vibe Calls (voice rooms)"
                        colors={colors}
                        highlight
                      />
                    </>
                  ) : (
                    <>
                      <FeatureRow
                        icon={MessageCircle}
                        text="5x more personal messages"
                        colors={colors}
                      />
                      <FeatureRow
                        icon={ImageIcon}
                        text="5x more image generations"
                        colors={colors}
                      />
                      <FeatureRow
                        icon={Bot}
                        text="5x more AI calls"
                        colors={colors}
                      />
                    </>
                  )}
                </View>
              </View>

              {/* Free Trial CTA */}
              {!hasUsedFreeTrial && currentPlan === "free" && (
                <Pressable onPress={handleStartTrial} style={{ marginBottom: 12 }}>
                  <LinearGradient
                    colors={["#F59E0B", "#D97706"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 16,
                      borderRadius: 14,
                    }}
                  >
                    <Sparkles size={20} color="white" />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: "white",
                      }}
                    >
                      Start 7-Day Pro Trial
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}

              {/* Upgrade Button */}
              <Pressable onPress={handleUpgrade}>
                <LinearGradient
                  colors={
                    config.recommendedPlan === "pro"
                      ? hasUsedFreeTrial
                        ? ["#F59E0B", "#D97706"]
                        : ["rgba(245,158,11,0.2)", "rgba(217,119,6,0.2)"]
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
                    borderRadius: 14,
                    borderWidth:
                      !hasUsedFreeTrial && config.recommendedPlan === "pro"
                        ? 1
                        : 0,
                    borderColor: "rgba(245,158,11,0.3)",
                  }}
                >
                  {config.recommendedPlan === "pro" ? (
                    <Crown
                      size={20}
                      color={
                        hasUsedFreeTrial || currentPlan !== "free"
                          ? "white"
                          : "#F59E0B"
                      }
                    />
                  ) : (
                    <Zap size={20} color="white" />
                  )}
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color:
                        !hasUsedFreeTrial && config.recommendedPlan === "pro"
                          ? "#F59E0B"
                          : "white",
                    }}
                  >
                    View Subscription Plans
                  </Text>
                </LinearGradient>
              </Pressable>

              {/* Maybe Later */}
              <Pressable
                onPress={onClose}
                style={{
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                  }}
                >
                  Maybe Later
                </Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const FeatureRow = ({
  icon: Icon,
  text,
  colors,
  highlight,
}: {
  icon: any;
  text: string;
  colors: any;
  highlight?: boolean;
}) => (
  <View className="flex-row items-center gap-3">
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: highlight
          ? "rgba(245,158,11,0.2)"
          : "rgba(139,92,246,0.2)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={14} color={highlight ? "#F59E0B" : "#8B5CF6"} />
    </View>
    <Text
      style={{
        fontSize: 14,
        color: colors.text,
        fontWeight: highlight ? "600" : "400",
      }}
    >
      {text}
    </Text>
  </View>
);

// ============================================================================
// HOOK FOR EASY ACCESS
// ============================================================================

export const useUpgradePrompt = () => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [promptFeature, setPromptFeature] =
    React.useState<UpgradeFeature>("personal_message");
  const [customTitle, setCustomTitle] = React.useState<string | undefined>();
  const [customDescription, setCustomDescription] = React.useState<
    string | undefined
  >();

  const showUpgradePrompt = (
    feature: UpgradeFeature,
    title?: string,
    description?: string
  ) => {
    setPromptFeature(feature);
    setCustomTitle(title);
    setCustomDescription(description);
    setIsVisible(true);
  };

  const hideUpgradePrompt = () => {
    setIsVisible(false);
  };

  const UpgradePromptComponent = () => (
    <UpgradePrompt
      visible={isVisible}
      onClose={hideUpgradePrompt}
      feature={promptFeature}
      customTitle={customTitle}
      customDescription={customDescription}
    />
  );

  return {
    showUpgradePrompt,
    hideUpgradePrompt,
    UpgradePromptComponent,
  };
};

export default UpgradePrompt;
