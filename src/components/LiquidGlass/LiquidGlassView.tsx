import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";

interface LiquidGlassViewProps {
  children: React.ReactNode;
  intensity?: number; // Blur intensity (0-100)
  tint?: "light" | "dark" | "default";
  borderRadius?: number;
  style?: ViewStyle;
  gradientColors?: readonly [string, string, ...string[]];
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowIntensity?: "light" | "medium" | "heavy";
}

const LiquidGlassView: React.FC<LiquidGlassViewProps> = ({
  children,
  intensity,
  tint,
  borderRadius = 20,
  style,
  gradientColors,
  borderColor,
  borderWidth = 1,
  shadowColor,
  shadowIntensity = "medium",
}) => {
  const { colors, isDark } = useTheme();

  // Set defaults based on theme if not provided
  const finalIntensity = intensity ?? (isDark ? 80 : 60);
  const finalTint = tint ?? (isDark ? "dark" : "light");
  const finalGradientColors = gradientColors ?? [
    colors.glassBackground,
    colors.glassBackgroundSecondary,
    "rgba(255, 255, 255, 0.02)" // Keep a bit of transparency
  ] as const;
  const finalBorderColor = borderColor ?? colors.glassBorder;
  const finalShadowColor = shadowColor ?? colors.glassShadow;

  const shadowStyles = {
    light: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.1 : 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    heavy: {
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  };

  return (
    <View
      style={[
        {
          borderRadius,
          overflow: "hidden",
          borderWidth,
          borderColor: finalBorderColor,
          shadowColor: finalShadowColor,
          ...shadowStyles[shadowIntensity],
        },
        style,
      ]}
    >
      <BlurView intensity={finalIntensity} tint={finalTint} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={finalGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>
      <View style={{ position: "relative", zIndex: 1 }}>{children}</View>
    </View>
  );
};

export default LiquidGlassView;
