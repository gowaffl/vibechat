import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";

interface LiquidGlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  variant?: "default" | "success" | "error";
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
}

const LiquidGlassInput: React.FC<LiquidGlassInputProps> = ({
  label,
  error,
  icon,
  iconPosition = "left",
  variant = "default",
  containerStyle,
  labelStyle,
  errorStyle,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const { colors, isDark } = useTheme();

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.parallel([
      Animated.spring(borderAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.parallel([
      Animated.spring(borderAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    onBlur?.(e);
  };

  const variantColors = {
    default: {
      borderColor: borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.glassBorder, isDark ? "rgba(0, 122, 255, 0.6)" : "rgba(0, 122, 255, 0.5)"],
      }),
      shadowColor: "rgba(0, 122, 255, 0.5)",
      gradientColors: [
        colors.glassBackground,
        colors.glassBackgroundSecondary,
        "rgba(255, 255, 255, 0.03)",
      ] as const,
    },
    success: {
      borderColor: borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(52, 199, 89, 0.4)", "rgba(52, 199, 89, 0.7)"],
      }),
      shadowColor: "rgba(52, 199, 89, 0.5)",
      gradientColors: [
        "rgba(52, 199, 89, 0.1)",
        "rgba(52, 199, 89, 0.07)",
        "rgba(52, 199, 89, 0.05)",
      ] as const,
    },
    error: {
      borderColor: borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(255, 59, 48, 0.4)", "rgba(255, 59, 48, 0.7)"],
      }),
      shadowColor: "rgba(255, 59, 48, 0.5)",
      gradientColors: [
        "rgba(255, 59, 48, 0.1)",
        "rgba(255, 59, 48, 0.07)",
        "rgba(255, 59, 48, 0.05)",
      ] as const,
    },
  };

  const currentVariant = error ? variantColors.error : variantColors[variant];

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text
          style={[
            {
              fontSize: 14,
              fontWeight: "600",
              color: colors.textSecondary,
              marginBottom: 8,
            },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}

      <Animated.View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: currentVariant.borderColor,
          shadowColor: currentVariant.shadowColor,
          shadowOffset: { width: 0, height: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 4],
          })},
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 0.4],
          }),
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [4, 12],
          }),
          elevation: 4,
        }}
      >
        <BlurView intensity={isDark ? 60 : 40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={currentVariant.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          {icon && iconPosition === "left" && <View style={{ marginRight: 12 }}>{icon}</View>}
          
          <TextInput
            {...textInputProps}
            onFocus={handleFocus}
            onBlur={handleBlur}
            keyboardAppearance={isDark ? "dark" : "light"}
            style={[
              {
                flex: 1,
                fontSize: 16,
                color: colors.text,
                padding: 0,
              },
              textInputProps.style,
            ]}
            placeholderTextColor={colors.inputPlaceholder}
          />

          {icon && iconPosition === "right" && <View style={{ marginLeft: 12 }}>{icon}</View>}
        </View>
      </Animated.View>

      {error && (
        <Text
          style={[
            {
              fontSize: 12,
              color: colors.error,
              marginTop: 6,
              marginLeft: 4,
            },
            errorStyle,
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

export default LiquidGlassInput;
