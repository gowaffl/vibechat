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
    type: "pulse",
    color: "#FF6B9D",
  },
  playful: {
    type: "wiggle",
    color: "#FFB347",
  },
  serious: {
    type: "emphasis",
    color: "#FF6B6B",
  },
  soft: {
    type: "float",
    color: "#A78BFA",
  },
  hype: {
    type: "shimmer",
    color: "#34D399",
  },
};

export const VibeAnimatedBubble = memo(({ vibeType, children }: VibeAnimatedBubbleProps) => {
  const config = VIBE_ANIMATIONS[vibeType];
  
  // Animation values - all native driver compatible
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  
  // Genuine - heartbeat pulse
  const heartbeatScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.2)).current;
  
  // Playful - bounce and wiggle
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  
  // Serious - shake emphasis
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Soft - float and fade
  const floatAnim = useRef(new Animated.Value(0)).current;
  const breatheOpacity = useRef(new Animated.Value(0.6)).current;
  
  // Hype - energy pulse
  const shimmerOpacity = useRef(new Animated.Value(0)).current;
  const energyScale = useRef(new Animated.Value(1)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Common entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 180,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Vibe-specific animations
    switch (config.type) {
      case "pulse":
        // GENUINE: Warm heartbeat - double pulse like a real heartbeat
        Animated.loop(
          Animated.sequence([
            // First beat
            Animated.timing(heartbeatScale, {
              toValue: 1.025,
              duration: 150,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(heartbeatScale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            // Second beat (slightly smaller)
            Animated.timing(heartbeatScale, {
              toValue: 1.015,
              duration: 120,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(heartbeatScale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            // Rest
            Animated.delay(800),
          ])
        ).start();
        
        // Warm glow that syncs with heartbeat
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.7,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.2,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.5,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.2,
              duration: 700,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case "wiggle":
        // PLAYFUL: Fun bounce entrance + ongoing subtle wiggle
        // Initial playful bounce
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -8,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 0,
            tension: 400,
            friction: 6,
            useNativeDriver: true,
          }),
        ]).start();
        
        // Playful wiggle
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(wiggleAnim, {
            toValue: 1,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: -1,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0.7,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: -0.5,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0,
            duration: 40,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case "emphasis":
        // SERIOUS: Strong, attention-grabbing entrance with shake
        // Wait for entrance to complete, then do the emphasis animation
        setTimeout(() => {
          Animated.sequence([
            // Quick shake left-right
            Animated.timing(shakeAnim, {
              toValue: 1,
              duration: 50,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: -1,
              duration: 50,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: 0.6,
              duration: 40,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: -0.3,
              duration: 40,
              useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
              toValue: 0,
              duration: 30,
              useNativeDriver: true,
            }),
          ]).start();
        }, 150);
        break;

      case "float":
        // SOFT: Gentle floating + breathing opacity - uncertain, delicate
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        // Soft breathing opacity
        Animated.loop(
          Animated.sequence([
            Animated.timing(breatheOpacity, {
              toValue: 0.9,
              duration: 1800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(breatheOpacity, {
              toValue: 0.6,
              duration: 1800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case "shimmer":
        // HYPE: Energetic pulse with sparkle effects
        // Main energy pulse
        Animated.loop(
          Animated.sequence([
            Animated.timing(energyScale, {
              toValue: 1.02,
              duration: 300,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(energyScale, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        // Shimmer wave
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerOpacity, {
              toValue: 0.35,
              duration: 400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(shimmerOpacity, {
              toValue: 0,
              duration: 600,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.delay(200),
          ])
        ).start();
        
        // Sparkle effects (staggered)
        Animated.loop(
          Animated.sequence([
            Animated.timing(sparkle1, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(sparkle1, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.delay(700),
          ])
        ).start();
        
        Animated.loop(
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(sparkle2, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(sparkle2, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.delay(300),
          ])
        ).start();
        break;
    }
  }, [vibeType]);

  // Build transforms based on vibe type
  const getTransform = () => {
    const transforms: any[] = [{ scale: scaleAnim }];

    switch (config.type) {
      case "pulse":
        transforms.push({ scale: heartbeatScale });
        break;
      case "wiggle":
        transforms.push(
          { translateY: bounceAnim },
          {
            rotate: wiggleAnim.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ["-3deg", "0deg", "3deg"],
            }),
          }
        );
        break;
      case "emphasis":
        transforms.push({
          translateX: shakeAnim.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-3, 0, 3],
          }),
        });
        break;
      case "float":
        transforms.push({
          translateY: floatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -4],
          }),
        });
        break;
      case "shimmer":
        transforms.push({ scale: energyScale });
        break;
    }

    return transforms;
  };

  // Get container opacity for soft vibe
  const getContainerOpacity = () => {
    if (config.type === "float") {
      return breatheOpacity;
    }
    return entranceAnim;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: getContainerOpacity(),
          transform: getTransform(),
        },
      ]}
    >
      {/* GENUINE: Warm glowing border ring */}
      {config.type === "pulse" && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.glowRing,
            {
              borderColor: config.color,
              opacity: glowOpacity,
              shadowColor: config.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* PLAYFUL: Colorful accent border */}
      {config.type === "wiggle" && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.playfulBorder,
            { borderColor: config.color },
          ]}
          pointerEvents="none"
        />
      )}

      {/* SERIOUS: Bold border to command attention */}
      {config.type === "emphasis" && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.seriousBorder,
            { 
              borderColor: config.color,
              shadowColor: config.color,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* SOFT: Subtle diffused border */}
      {config.type === "float" && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.softBorder,
            {
              borderColor: config.color,
              opacity: breatheOpacity.interpolate({
                inputRange: [0.6, 0.9],
                outputRange: [0.3, 0.6],
              }),
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* HYPE: Energy shimmer overlay */}
      {config.type === "shimmer" && (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.shimmerOverlay,
              {
                backgroundColor: config.color,
                opacity: shimmerOpacity,
              },
            ]}
            pointerEvents="none"
          />
          {/* Sparkle dots */}
          <Animated.View
            style={[
              styles.sparkle,
              {
                top: 8,
                right: 12,
                backgroundColor: config.color,
                opacity: sparkle1,
                transform: [{ scale: sparkle1 }],
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.sparkle,
              {
                bottom: 12,
                left: 16,
                backgroundColor: config.color,
                opacity: sparkle2,
                transform: [{ scale: sparkle2 }],
              },
            ]}
            pointerEvents="none"
          />
        </>
      )}

      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    // Inherits layout from parent
  },
  glowRing: {
    borderRadius: 20,
    borderWidth: 2,
  },
  playfulBorder: {
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  seriousBorder: {
    borderRadius: 20,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  softBorder: {
    borderRadius: 20,
    borderWidth: 1,
  },
  shimmerOverlay: {
    borderRadius: 20,
  },
  sparkle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default VibeAnimatedBubble;
