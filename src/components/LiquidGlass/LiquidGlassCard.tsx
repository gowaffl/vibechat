import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { LiquidGlassVariant, getVariantColors } from "./variants";
import { useTheme } from "@/contexts/ThemeContext";

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
  intensity,
  style,
  titleStyle,
  subtitleStyle,
  variant = "default",
}) => {
  const { colors, isDark } = useTheme();
  const currentVariant = getVariantColors(variant, isDark);
  
  const finalIntensity = intensity ?? (isDark ? 70 : 60);

  // The inner content with clipping for the glass effect
  const InnerCard = (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: currentVariant.borderColor,
        // Ensure the inner view fills the width but sizes height to content
        width: "100%",
        backgroundColor: "transparent",
      }}
    >
      <BlurView 
        intensity={finalIntensity} 
        tint={isDark ? "dark" : "light"} 
        style={[
          StyleSheet.absoluteFill, 
          // Explicitly adding borderRadius here can sometimes help with clipping issues on certain RN versions
          { borderRadius: 16 } 
        ]}
      >
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
                    color: currentVariant.textColor,
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
                    color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)",
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
    </View>
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
            // Shadow container (Outer)
            borderRadius: 16,
            backgroundColor: "transparent", // Essential for iOS shadow visibility with no background
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
        {InnerCard}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        {
          // Shadow container (Outer)
          borderRadius: 16,
          backgroundColor: "transparent",
          shadowColor: currentVariant.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        },
        style,
      ]}
    >
      {InnerCard}
    </View>
  );
};

export default LiquidGlassCard;
