import React, { useState, createContext, useContext } from "react";
import { View, Text, ViewProps } from "react-native";
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

type SwipeableMessageContextType = {
  setBubbleHeight: (height: number) => void;
};

const SwipeableMessageContext = createContext<SwipeableMessageContextType | null>(null);

export const MessageBubbleMeasurer: React.FC<ViewProps> = (props) => {
  const context = useContext(SwipeableMessageContext);
  
  return (
    <View
      {...props}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        context?.setBubbleHeight(height);
        props.onLayout?.(event);
      }}
    />
  );
};

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
  const maxSwipeDistance = useSharedValue(MAX_SWIPE);
  const [isRevealed, setIsRevealed] = useState(false);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const [timestampHeight, setTimestampHeight] = useState(20); // Default approx height

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
        const currentMaxSwipe = maxSwipeDistance.value;
        const clampedTranslation = isCurrentUser
          ? Math.max(translation, -currentMaxSwipe)
          : Math.min(translation, currentMaxSwipe);
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
        {
          // Center the text vertically relative to the top anchor
          translateY: -timestampHeight / 2, 
        },
      ],
    };
  });

  return (
    <SwipeableMessageContext.Provider value={{ setBubbleHeight }}>
      <View style={{ position: "relative" }}>
        {/* Timestamp - revealed behind the message */}
        <Animated.View
          style={[
            {
              position: "absolute",
              right: isCurrentUser ? 8 : undefined,
              left: !isCurrentUser ? 8 : undefined,
              // Position timestamp at the vertical center of just the message bubble
              top: bubbleHeight > 0 ? bubbleHeight / 2 : "50%",
              paddingHorizontal: 12,
              zIndex: 0,
            },
            timestampAnimatedStyle,
          ]}
          onLayout={(event) => {
            // Calculate required swipe distance based on timestamp width
            const { width, height } = event.nativeEvent.layout;
            setTimestampHeight(height);

            // We need enough space for the timestamp plus some padding
            // The timestamp moves at 0.3x speed, so we create 0.7x relative space
            // required_swipe * 0.7 = width + padding
            const padding = 20;
            const requiredSwipe = (width + padding) / 0.7;
            
            // Only update if significantly different to avoid jitter, but ensure at least MAX_SWIPE
            if (requiredSwipe > MAX_SWIPE) {
               maxSwipeDistance.value = requiredSwipe;
            }
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: "#8E8E93",
              fontSize: 13,
              fontWeight: "500",
              minWidth: 50, // Ensure it has some width
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
    </SwipeableMessageContext.Provider>
  );
};
