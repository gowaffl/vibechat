import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Phone } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";

interface VoiceRoomBannerProps {
  participantCount: number;
  onJoinPress: () => void;
  isUserInCall?: boolean;
}

export const VoiceRoomBanner: React.FC<VoiceRoomBannerProps> = ({
  participantCount,
  onJoinPress,
  isUserInCall = false,
}) => {
  const { colors, isDark } = useTheme();
  const pulseAnim = useSharedValue(1);

  // Subtle pulse animation for the call indicator
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onJoinPress();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={styles.touchable}
      >
        <BlurView
          intensity={isDark ? 60 : 40}
          tint={isDark ? "dark" : "light"}
          style={styles.blurContainer}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(79, 195, 247, 0.12)", "rgba(79, 195, 247, 0.06)"]
                : ["rgba(79, 195, 247, 0.15)", "rgba(79, 195, 247, 0.08)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            <View style={styles.content}>
              {/* Left: Animated Pulse Indicator + Icon */}
              <View style={styles.leftSection}>
                <View style={styles.iconContainer}>
                  {/* Pulsing Ring */}
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      pulseStyle,
                      {
                        backgroundColor: isDark
                          ? "rgba(79, 195, 247, 0.2)"
                          : "rgba(79, 195, 247, 0.25)",
                      },
                    ]}
                  />
                  {/* Solid Icon Background */}
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(79, 195, 247, 0.25)"
                          : "rgba(79, 195, 247, 0.3)",
                      },
                    ]}
                  >
                    <Phone
                      size={14}
                      color={colors.primary}
                      strokeWidth={2.5}
                    />
                  </View>
                </View>

                {/* Text */}
                <View style={styles.textContainer}>
                  <Text
                    style={[
                      styles.titleText,
                      { color: isDark ? colors.text : colors.text },
                    ]}
                  >
                    {isUserInCall ? "Vibe Call Active" : "Vibe Call"}
                  </Text>
                  <Text
                    style={[
                      styles.subtitleText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {participantCount} {participantCount === 1 ? "person" : "people"}
                  </Text>
                </View>
              </View>

              {/* Right: Join Button */}
              {!isUserInCall && (
                <View
                  style={[
                    styles.joinButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(79, 195, 247, 0.2)"
                        : "rgba(79, 195, 247, 0.25)",
                      borderColor: isDark
                        ? "rgba(79, 195, 247, 0.3)"
                        : "rgba(79, 195, 247, 0.4)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.joinButtonText,
                      { color: colors.primary },
                    ]}
                  >
                    Join
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </BlurView>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  touchable: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#4FC3F7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  blurContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(79, 195, 247, 0.2)",
    overflow: "hidden",
  },
  gradient: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  pulseRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 1,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  joinButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

