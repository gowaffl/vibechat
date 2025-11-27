import React, { useEffect } from "react";
import { View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

interface OnboardingProgressProps {
  totalSteps: number;
  currentStep: number; // 0-indexed
  style?: ViewStyle;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  totalSteps,
  currentStep,
  style,
}) => {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 12, // Increased gap
        },
        style,
      ]}
    >
      {Array.from({ length: totalSteps }).map((_, index) => (
        <ProgressChip
          key={index}
          isActive={index === currentStep}
          isCompleted={index < currentStep}
        />
      ))}
    </View>
  );
};

const ProgressChip: React.FC<{ isActive: boolean; isCompleted: boolean }> = ({
  isActive,
  isCompleted,
}) => {
  const width = useSharedValue(12); // Increased base width
  const opacity = useSharedValue(0.3);
  const activeScale = useSharedValue(1);

  useEffect(() => {
    width.value = withSpring(isActive ? 32 : 12, { damping: 15 }); // Increased active width
    opacity.value = withTiming(isActive || isCompleted ? 1 : 0.3);
    activeScale.value = withSpring(isActive ? 1.1 : 1);
  }, [isActive, isCompleted]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: width.value,
      opacity: opacity.value,
      transform: [{ scale: activeScale.value }],
      backgroundColor: isCompleted || isActive ? "#FFFFFF" : "#FFFFFF",
    };
  });

  return (
    <View
      style={{
        height: 8, // Increased height
        borderRadius: 4, // Adjusted radius
        overflow: "hidden",
      }}
    >
      <BlurView intensity={80} tint="light" style={{ flex: 1 }}>
        <Animated.View
          style={[
            {
              height: "100%",
              borderRadius: 4,
            },
            animatedStyle,
          ]}
        />
      </BlurView>
    </View>
  );
};
