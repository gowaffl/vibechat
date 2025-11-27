import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

// Use the app icon from assets
const APP_ICON = require('../../assets/vibechat icon main.png');

interface LuxeLogoLoaderProps {
  size?: 'small' | 'large' | number;
  style?: ViewStyle;
}

export const LuxeLogoLoader: React.FC<LuxeLogoLoaderProps> = ({ size = 'large', style }) => {
  // Determine dimensions
  const dimension = typeof size === 'number' 
    ? size 
    : size === 'small' ? 30 : 60;

  // Animation Values
  const animationProgress = useSharedValue(0);

  useEffect(() => {
    // Infinite breathing cycle
    animationProgress.value = withRepeat(
      withSequence(
        // Scale Up phase
        withTiming(1, { 
          duration: 1200, 
          easing: Easing.inOut(Easing.ease) 
        }),
        // Scale Down phase
        withTiming(0, { 
          duration: 1200, 
          easing: Easing.inOut(Easing.ease) 
        })
      ),
      -1, // Infinite repeat
      true // Reverse: false (we are defining the full sequence manually? No, withRepeat(..., true) reverses the sequence)
      // Actually, easier to just go 0 -> 1 and auto-reverse.
    );
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => {
    // Interpolate Scale: slightly smaller to slightly larger
    const scale = interpolate(
      animationProgress.value,
      [0, 1],
      [0.85, 1.1] 
    );

    // Interpolate Opacity: Fades out slightly when small, fully visible when large
    const opacity = interpolate(
      animationProgress.value,
      [0, 1],
      [0.6, 1.0]
    );

    return {
      transform: [{ scale }],
      opacity: opacity,
    };
  });

  return (
    <View style={[styles.container, { width: dimension * 1.2, height: dimension * 1.2 }, style]}>
      <Animated.View style={[animatedIconStyle]}>
        <Image
          source={APP_ICON}
          style={{
            width: dimension,
            height: dimension,
            borderRadius: dimension * 0.22,
          }}
          contentFit="cover"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
