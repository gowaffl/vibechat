import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { LiquidGlassVariant, variantColorMap } from "./variants";

interface LiquidGlassCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  intensity?: number;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  variant?: LiquidGlassVariant;
}

const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  onPress,
  intensity = 70,
  style,
  titleStyle,
  subtitleStyle,
  variant = "default",
}) => {
  const currentVariant = variantColorMap[variant];

  const cardContent = (
    <>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={currentVariant.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>

      <View style={{ position: "relative", zIndex: 1, padding: 16 }}>
        {/* Header */}
        {(title || subtitle || icon) && (
          <View style={{ marginBottom: children ? 12 : 0 }}>
            {icon && <View style={{ marginBottom: 8 }}>{icon}</View>}
            {title && (
              <Text
                style={[
                  {
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#FFFFFF",
                    marginBottom: subtitle ? 4 : 0,
                  },
                  titleStyle,
                ]}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={[
                  {
                    fontSize: 14,
                    color: "rgba(255, 255, 255, 0.7)",
                  },
                  subtitleStyle,
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}

        {/* Content */}
        {children}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [
          {
            borderRadius: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: currentVariant.borderColor,
            shadowColor: currentVariant.shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: pressed ? 0.4 : 0.3,
            shadowRadius: pressed ? 12 : 8,
            elevation: pressed ? 6 : 4,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
          style,
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: currentVariant.borderColor,
          shadowColor: currentVariant.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        },
        style,
      ]}
    >
      {cardContent}
    </View>
  );
};

export default LiquidGlassCard;

