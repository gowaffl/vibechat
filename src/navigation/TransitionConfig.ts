import { TransitionSpec } from '@react-navigation/stack/lib/typescript/src/types';
import { StackCardStyleInterpolator } from '@react-navigation/stack';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Custom configuration for a "Instant/Quick Fade" effect
// Responsive, snappy, and minimal movement
export const transitionSpec: {
  open: TransitionSpec;
  close: TransitionSpec;
} = {
  open: {
    animation: 'spring',
    config: {
      stiffness: 1500, // Very stiff for quick start
      damping: 200,    // High damping to prevent bounce/overshoot
      mass: 0.5,       // Lightweight for speed
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
  close: {
    animation: 'spring',
    config: {
      stiffness: 1500,
      damping: 200,
      mass: 0.5,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
};

/**
 * Custom Card Style Interpolator
 * Implements a "Quick Fade" effect:
 * - Entering screen fades in (0 -> 1 opacity)
 * - Very slight scale (0.99 -> 1) for a subtle "breathing" feel, but mostly static
 * - No horizontal/vertical translation (to avoid alignment issues)
 */
export const forFadeTransition: StackCardStyleInterpolator = ({
  current,
  next,
}) => {
  const opacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Very subtle scale for a touch of polish, almost imperceptible
  const scale = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1], 
  });

  return {
    cardStyle: {
      opacity,
      transform: [
        { scale },
      ],
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.5],
      }),
    },
  };
};

// Legacy export for backward compatibility if needed, but redirects to new logic
// We can keep the name if we want to minimize churn, but better to update callsites
export const forTrayTransition = forFadeTransition;
