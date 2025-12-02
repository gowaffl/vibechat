import React, { useEffect } from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { VIBES } from "@/constants/vibes";
import { Vibe } from "@shared/contracts";

interface VibeMessageBubbleProps {
  vibe: Vibe | null | undefined;
  children: React.ReactNode;
  isMe: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export const VibeMessageBubble: React.FC<VibeMessageBubbleProps> = ({
  vibe: vibeKey,
  children,
  isMe,
  style,
  contentContainerStyle,
}) => {
  if (!vibeKey || !VIBES[vibeKey]) {
    return <View style={style}>{children}</View>;
  }

  const vibe = VIBES[vibeKey];
  const anim = useSharedValue(0);

  useEffect(() => {
    switch (vibe.animationType) {
      case "pulse":
        anim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
        break;
      case "bounce":
        anim.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
        break;
      case "shake":
        anim.value = withRepeat(
          withSequence(
            withTiming(-1.5, { duration: 120 }),
            withTiming(1.5, { duration: 120 }),
            withTiming(-1, { duration: 120 }),
            withTiming(1, { duration: 120 }),
            withTiming(0, { duration: 120 }),
            withTiming(0, { duration: 3000 }) // Long pause
          ),
          -1,
          false
        );
        break;
      case "glow":
        anim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 800, easing: Easing.linear }),
            withTiming(0, { duration: 800, easing: Easing.linear })
          ),
          -1,
          true
        );
        break;
      default:
        anim.value = 0;
    }
    return () => cancelAnimation(anim);
  }, [vibe.animationType]);

  const animatedStyle = useAnimatedStyle(() => {
    // Base styles applied to all vibes
    const styles: any = {
      borderWidth: 2,
      borderColor: vibe.color,
    };

    switch (vibe.animationType) {
      case "pulse":
        styles.shadowColor = vibe.color;
        styles.shadowOffset = { width: 0, height: 0 };
        styles.shadowOpacity = 0.3 + (anim.value * 0.3);
        styles.shadowRadius = 4 + (anim.value * 4);
        styles.elevation = 3;
        break;
      case "bounce":
        styles.transform = [{ translateY: anim.value }];
        break;
      case "shake":
        styles.transform = [{ rotate: `${anim.value}deg` }];
        break;
      case "glow":
        styles.shadowColor = vibe.color;
        styles.shadowOffset = { width: 0, height: 0 };
        styles.shadowOpacity = 0.5 + (anim.value * 0.5);
        styles.shadowRadius = 8 + (anim.value * 4);
        styles.elevation = 6;
        // Scale slightly for breathing effect
        styles.transform = [{ scale: 1 + (anim.value * 0.02) }];
        break;
    }

    return styles;
  });

  // Merge the passed style with animated style
  // We wrap the original style in the animated view, but overrides come from vibe
  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

