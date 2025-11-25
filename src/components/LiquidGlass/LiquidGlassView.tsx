import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

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
  intensity = 80,
  tint = "dark",
  borderRadius = 20,
  style,
  gradientColors = ["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"] as const,
  borderColor = "rgba(255, 255, 255, 0.2)",
  borderWidth = 1,
  shadowColor = "rgba(0, 0, 0, 0.3)",
  shadowIntensity = "medium",
}) => {
  const shadowStyles = {
    light: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    heavy: {
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
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
          borderColor,
          shadowColor,
          ...shadowStyles[shadowIntensity],
        },
        style,
      ]}
    >
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={gradientColors}
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

