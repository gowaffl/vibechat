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

const SWIPE_THRESHOLD = 80; // How far to swipe to reveal timestamp (absolute value)
const MAX_SWIPE = 120; // Maximum swipe distance (absolute value)

/**
 * SwipeableMessage - Wraps a message bubble to enable swipe-to-reveal timestamp
 * HIGH-9: Bidirectional swipe support
 * - Right-aligned messages (currentUser): swipe LEFT to reveal timestamp
 * - Left-aligned messages (other users): swipe RIGHT to reveal timestamp
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
      const translation = event.translationX;
      
      // HIGH-9: Support bidirectional swipe based on message alignment
      // Current user (right-aligned): swipe left (negative)
      // Other users (left-aligned): swipe right (positive)
      const isValidDirection = isCurrentUser 
        ? translation < 0  // Swipe left for own messages
        : translation > 0; // Swipe right for others' messages
      
      if (isValidDirection) {
        // Limit the swipe distance
        const clampedTranslation = isCurrentUser
          ? Math.max(translation, -MAX_SWIPE)
          : Math.min(translation, MAX_SWIPE);
        translateX.value = clampedTranslation;
        
        // Trigger haptic when crossing threshold
        const absTranslation = Math.abs(translation);
        if (absTranslation > SWIPE_THRESHOLD && !isRevealed) {
          runOnJS(setIsRevealed)(true);
          runOnJS(triggerHaptic)();
        } else if (absTranslation <= SWIPE_THRESHOLD && isRevealed) {
          runOnJS(setIsRevealed)(false);
        }
      } else {
        // Don't allow swiping in the wrong direction
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
    // Calculate opacity based on swipe distance (absolute value)
    const opacity = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    return {
      opacity: opacity,
      transform: [
        {
          // Slight parallax effect - moves in opposite direction for visual polish
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

