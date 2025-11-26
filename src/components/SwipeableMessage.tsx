import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

interface SwipeableMessageProps {
  children: React.ReactNode;
  timestamp: string;
  isCurrentUser: boolean;
}

const SWIPE_THRESHOLD = -80; // How far left to swipe to reveal timestamp
const MAX_SWIPE = -120; // Maximum swipe distance

/**
 * SwipeableMessage - Wraps a message bubble to enable swipe-to-reveal timestamp
 * Similar to iMessage behavior: swipe left to reveal timestamp, release to hide
 */
export const SwipeableMessage: React.FC<SwipeableMessageProps> = ({
  children,
  timestamp,
  isCurrentUser,
}) => {
  const translateX = useSharedValue(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
    .failOffsetY([-15, 15]) // Fail if vertical movement exceeds 15px
    .onUpdate((event) => {
      // Only allow swiping left (negative translation)
      // Limit the swipe distance
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, MAX_SWIPE);
        
        // Trigger haptic when crossing threshold
        if (event.translationX < SWIPE_THRESHOLD && !isRevealed) {
          runOnJS(setIsRevealed)(true);
          runOnJS(triggerHaptic)();
        } else if (event.translationX >= SWIPE_THRESHOLD && isRevealed) {
          runOnJS(setIsRevealed)(false);
        }
      } else {
        // Don't allow swiping right
        translateX.value = 0;
      }
    })
    .onEnd(() => {
      // Snap back to original position when released
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
      runOnJS(setIsRevealed)(false);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const timestampAnimatedStyle = useAnimatedStyle(() => {
    // Calculate opacity based on swipe distance
    const opacity = Math.min(Math.abs(translateX.value) / Math.abs(SWIPE_THRESHOLD), 1);
    return {
      opacity: opacity,
      transform: [
        {
          // Slight parallax effect
          translateX: translateX.value * 0.3,
        },
      ],
    };
  });

  return (
    <View style={{ position: "relative" }}>
      {/* Timestamp - revealed behind the message */}
      <Animated.View
        style={[
          {
            position: "absolute",
            right: isCurrentUser ? 8 : undefined,
            left: !isCurrentUser ? 8 : undefined,
            top: 0,
            bottom: 0,
            justifyContent: "center",
            paddingHorizontal: 12,
            zIndex: 0,
          },
          timestampAnimatedStyle,
        ]}
      >
        <Text
          style={{
            color: "#8E8E93",
            fontSize: 13,
            fontWeight: "500",
          }}
        >
          {timestamp}
        </Text>
      </Animated.View>

      {/* Message Content - swipeable */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ zIndex: 1 }, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

