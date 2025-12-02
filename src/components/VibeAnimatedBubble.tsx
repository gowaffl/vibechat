import React, { useEffect, useRef, memo } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import { VibeType } from "@shared/contracts";

interface VibeAnimatedBubbleProps {
  vibeType: VibeType;
  children: React.ReactNode;
}

// Vibe-specific animation configurations
const VIBE_ANIMATIONS = {
  genuine: {
    // Warm pulsing glow - heartbeat-like
    type: "pulse",
    color: "#FF6B9D",
    duration: 2000,
  },
  playful: {
    // Subtle bounce/wiggle
    type: "wiggle",
    color: "#FFB347",
    duration: 400,
  },
  serious: {
    // Sharp, bold appearance with subtle emphasis
    type: "emphasis",
    color: "#FF6B6B",
    duration: 300,
  },
  soft: {
    // Gentle floating/breathing
    type: "float",
    color: "#A78BFA",
    duration: 3000,
  },
  hype: {
    // Electric shimmer/energy burst
    type: "shimmer",
    color: "#34D399",
    duration: 1500,
  },
};

export const VibeAnimatedBubble = memo(({ vibeType, children }: VibeAnimatedBubbleProps) => {
  const config = VIBE_ANIMATIONS[vibeType];
  
  // All animations use native driver for performance
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation - quick scale up
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 15,
      useNativeDriver: true,
    }).start();

    // Entrance opacity
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Start vibe-specific animation
    switch (config.type) {
      case "pulse":
        // Genuine - warm heartbeat pulse (scale only, native driver)
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.02,
              duration: config.duration * 0.3,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: config.duration * 0.7,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        // Glow ring opacity animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.8,
              duration: config.duration * 0.5,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.3,
              duration: config.duration * 0.5,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case "wiggle":
        // Playful - quick wiggle on mount
        Animated.sequence([
          Animated.timing(wiggleAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: -1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0.5,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case "emphasis":
        // Serious - bold entrance with slight shake
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 300,
            friction: 10,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case "float":
        // Soft - gentle floating motion
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: 1,
              duration: config.duration * 0.5,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: config.duration * 0.5,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case "shimmer":
        // Hype - energetic shimmer overlay
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerOpacity, {
              toValue: 0.4,
              duration: config.duration * 0.5,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(shimmerOpacity, {
              toValue: 0,
              duration: config.duration * 0.5,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        // Also add a subtle pulse for energy
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.015,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;
    }
  }, [vibeType]);

  // Calculate transform based on vibe type
  const getTransform = () => {
    const transforms: any[] = [{ scale: scaleAnim }];

    switch (config.type) {
      case "pulse":
        transforms.push({ scale: pulseAnim });
        break;
      case "wiggle":
        transforms.push({
          rotate: wiggleAnim.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ["-2deg", "0deg", "2deg"],
          }),
        });
        break;
      case "float":
        transforms.push({
          translateY: floatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -3],
          }),
        });
        break;
      case "shimmer":
        transforms.push({ scale: pulseAnim });
        break;
    }

    return transforms;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: entranceAnim,
          transform: getTransform(),
        },
      ]}
    >
      {/* Shimmer overlay for Hype - green energy pulse */}
      {config.type === "shimmer" && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            {
              backgroundColor: config.color,
              opacity: shimmerOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}
      
      {/* Pulsing glow ring for Genuine - warm pink border */}
      {config.type === "pulse" && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.glowRing,
            {
              borderColor: config.color,
              opacity: glowOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    // Container inherits layout from parent
  },
  overlay: {
    borderRadius: 20,
  },
  glowRing: {
    borderRadius: 20,
    borderWidth: 2,
  },
});

export default VibeAnimatedBubble;
