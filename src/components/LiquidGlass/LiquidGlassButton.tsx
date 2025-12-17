import React, { useRef, useEffect } from "react";
import { Pressable, Text, Animated, ViewStyle, TextStyle, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { useTheme } from "@/contexts/ThemeContext";

interface LiquidGlassButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  color?: string;
}

const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
  onPress,
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = "left",
  color,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const { colors, isDark } = useTheme();

  const handlePressIn = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const variantStyles = {
    primary: {
      borderColor: color ? `${color}80` : (isDark ? "#0061FF" : "rgba(0, 97, 255, 0.5)"),
      borderWidth: 1,
      shadowColor: color ? `${color}80` : (isDark ? "#0061FF" : "rgba(0, 97, 255, 0.4)"),
      gradientColors: color
        ? [`${color}4D`, `${color}33`, `${color}1A`]
        : (isDark 
            ? ["#0061FF", "#00C6FF", "#00E676"] as const
            : ["rgba(0, 97, 255, 0.8)", "rgba(0, 198, 255, 0.8)", "rgba(0, 230, 118, 0.8)"] as const),
    },
    secondary: {
      borderColor: colors.glassBorder,
      borderWidth: 1,
      shadowColor: colors.glassShadow,
      gradientColors: [
        colors.glassBackground,
        colors.glassBackgroundSecondary,
        "rgba(255, 255, 255, 0.05)",
      ] as const,
    },
    ghost: {
      borderColor: "transparent",
      borderWidth: 0,
      shadowColor: "transparent",
      gradientColors: ["transparent", "transparent", "transparent"] as const,
    },
  };

  const sizeStyles = {
    small: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      fontSize: 14,
    },
    medium: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 16,
      fontSize: 16,
    },
    large: {
      paddingHorizontal: 28,
      paddingVertical: 18,
      borderRadius: 20,
      fontSize: 18,
    },
  };

  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: disabled ? 0.5 : opacityAnim,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={{
          borderRadius: currentSize.borderRadius,
          overflow: "hidden",
          borderWidth: currentVariant.borderWidth,
          borderColor: currentVariant.borderColor,
          shadowColor: currentVariant.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <BlurView intensity={variant === "ghost" ? 0 : (isDark ? 60 : 40)} tint={isDark ? "dark" : "light"} style={{ flex: 1 }}>
          <LinearGradient
            colors={currentVariant.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: currentSize.paddingHorizontal,
              paddingVertical: currentSize.paddingVertical,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <LuxeLogoLoader size={20} />
            ) : (
              <>
                {icon && iconPosition === "left" && icon}
                {typeof children === "string" ? (
                  <Text
                    style={[
                      {
                        color: variant === "secondary" || variant === "ghost" ? colors.text : "#FFFFFF",
                        fontSize: currentSize.fontSize,
                        fontWeight: "600",
                      },
                      textStyle,
                    ]}
                  >
                    {children}
                  </Text>
                ) : (
                  children
                )}
                {icon && iconPosition === "right" && icon}
              </>
            )}
          </LinearGradient>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
};

export default LiquidGlassButton;
