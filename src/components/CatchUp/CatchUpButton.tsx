import React, { useState, useEffect, useRef } from "react";
import { Pressable, Text, Animated, View, PanResponder } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { variantColorMap } from "../LiquidGlass/variants";

interface CatchUpButtonProps {
  unreadCount: number;
  onPress: () => void;
  onDismiss?: () => void;
  isVisible?: boolean;
}

const CatchUpButton: React.FC<CatchUpButtonProps> = ({
  unreadCount,
  onPress,
  onDismiss,
  isVisible = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible && unreadCount > 0) {
      // Entrance animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }).start();

      // Subtle pulse animation loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, unreadCount, scaleAnim, pulseAnim]);

  // Pan responder for swipe-to-dismiss gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping to the right
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped more than 100px to the right, dismiss
        if (gestureState.dx > 100) {
          Animated.timing(translateX, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            if (onDismiss) {
              onDismiss();
            }
            // Reset position for next time
            translateX.setValue(0);
          });
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (!isVisible || unreadCount === 0) {
    return null;
  }

  const catchupVariant = variantColorMap.catchup;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        bottom: 100, // Above keyboard area
        right: 16,
        transform: [
          { scale: Animated.multiply(scaleAnim, pulseAnim) },
          { translateX },
        ],
        zIndex: 1000,
      }}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <View
          style={{
            borderRadius: 22,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: catchupVariant.borderColor,
            shadowColor: catchupVariant.shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <BlurView intensity={70} tint="dark">
            <LinearGradient
              colors={catchupVariant.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* AI Sparkle Icon */}
              <Text style={{ fontSize: 20, lineHeight: 20 }}>✨</Text>

              {/* Text Content */}
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#FFFFFF",
                    letterSpacing: -0.3,
                  }}
                >
                  AI Summary
                </Text>
              </View>

              {/* Compact Badge */}
              {unreadCount > 0 && (
                <View
                  style={{
                    backgroundColor: catchupVariant.iconColor,
                    borderRadius: 11,
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 7,
                    justifyContent: "center",
                    alignItems: "center",
                    marginLeft: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#FFFFFF",
                      lineHeight: 14,
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </BlurView>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default CatchUpButton;

