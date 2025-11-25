import React, { useRef, useEffect } from "react";
import { Pressable, Text, Animated, ViewStyle, TextStyle, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

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
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

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
      borderColor: "rgba(0, 122, 255, 0.5)",
      borderWidth: 1,
      shadowColor: "rgba(0, 122, 255, 0.5)",
      gradientColors: [
        "rgba(0, 122, 255, 0.3)",
        "rgba(0, 122, 255, 0.2)",
        "rgba(0, 122, 255, 0.1)",
      ] as const,
    },
    secondary: {
      borderColor: "rgba(255, 255, 255, 0.3)",
      borderWidth: 1,
      shadowColor: "rgba(255, 255, 255, 0.2)",
      gradientColors: [
        "rgba(255, 255, 255, 0.15)",
        "rgba(255, 255, 255, 0.1)",
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
        <BlurView intensity={variant === "ghost" ? 0 : 60} tint="dark" style={{ flex: 1 }}>
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
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                {icon && iconPosition === "left" && icon}
                {typeof children === "string" ? (
                  <Text
                    style={[
                      {
                        color: "#FFFFFF",
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

