import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  interpolate,
  Extrapolation,
  WithSpringConfig,
} from "react-native-reanimated";
import { VIBES, VIBE_KEYS, VibeDefinition } from "@/constants/vibes";
import { Vibe } from "@shared/contracts";
import * as Haptics from "expo-haptics";

interface VibePickerProps {
  visible: boolean;
  activeIndex: number | null;
  anchorY?: number; // Y position of the send button to anchor to
}

const ITEM_SIZE = 50;
const RADIUS = 100; // Radius of the fan
const SCREEN_WIDTH = Dimensions.get("window").width;

export const VibePicker: React.FC<VibePickerProps> = ({
  visible,
  activeIndex,
  anchorY = 0,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [visible]);

  useEffect(() => {
    if (activeIndex !== null && visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [activeIndex, visible]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [
        { scale: interpolate(progress.value, [0, 1], [0.5, 1]) },
        { translateY: interpolate(progress.value, [0, 1], [20, 0]) },
      ],
      pointerEvents: visible ? "auto" : "none",
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.fanContainer}>
        {VIBE_KEYS.map((vibeKey, index) => {
          const vibe = VIBES[vibeKey];
          const isActive = activeIndex === index;
          
          // Calculate position on the arc
          // Total angle span: 180 degrees (PI)
          // Start from -PI (left) to 0 (right) ? No, above means -PI to 0.
          // Let's say we span 150 degrees centered upwards (-90 deg).
          // -165 to -15 deg.
          const totalAngle = Math.PI * 0.8; // 144 degrees
          const startAngle = -Math.PI / 2 - totalAngle / 2;
          const step = totalAngle / (VIBE_KEYS.length - 1);
          const angle = startAngle + step * index;

          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;

          return (
            <VibeItem
              key={vibeKey}
              vibe={vibe}
              isActive={isActive}
              x={x}
              y={y}
              index={index}
              progress={progress}
            />
          );
        })}
      </View>
      
      {/* Label Display */}
      <View style={styles.labelContainer}>
        {activeIndex !== null && (
          <Animated.View 
            entering={withSpring(1)} 
            style={styles.labelBadge}
          >
            <Text style={[styles.labelText, { color: VIBES[VIBE_KEYS[activeIndex]].color }]}>
              {VIBES[VIBE_KEYS[activeIndex]].label}
            </Text>
            <Text style={styles.descriptionText}>
              {VIBES[VIBE_KEYS[activeIndex]].description}
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const VibeItem = ({
  vibe,
  isActive,
  x,
  y,
  index,
  progress,
}: {
  vibe: VibeDefinition;
  isActive: boolean;
  x: number;
  y: number;
  index: number;
  progress: Animated.SharedValue<number>;
}) => {
  const Icon = vibe.icon;

  const animatedStyle = useAnimatedStyle(() => {
    const delay = index * 50;
    const scale = isActive ? 1.5 : 1;
    const activeY = isActive ? -10 : 0;

    return {
      transform: [
        { translateX: x },
        { translateY: y + activeY },
        { scale: withSpring(scale) },
      ],
      backgroundColor: isActive ? vibe.color : "#ffffff",
      borderColor: vibe.color,
      zIndex: isActive ? 10 : 1,
      shadowOpacity: isActive ? 0.3 : 0.1,
      shadowRadius: isActive ? 8 : 4,
      shadowColor: vibe.color,
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      color: isActive ? "#ffffff" : vibe.color,
    };
  });

  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      {/* @ts-ignore - icon color prop issue with reanimated */}
      <Icon size={24} color={isActive ? "#ffffff" : vibe.color} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80, // Position above the input bar
    right: 20,  // Align near the send button
    width: 250,
    height: 200,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  fanContainer: {
    position: "absolute",
    bottom: 0,
    right: 0, // Anchor point for the fan center
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    position: "absolute",
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  labelContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  labelBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  labelText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  descriptionText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});

