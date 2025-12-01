import { TransitionSpec } from '@react-navigation/stack/lib/typescript/src/types';
import { StackCardStyleInterpolator } from '@react-navigation/stack';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Custom spring configuration for the "bounce" effect
// Further adjusted for an even slower, premium, and elegant feel
export const transitionSpec: {
  open: TransitionSpec;
  close: TransitionSpec;
} = {
  open: {
    animation: 'spring',
    config: {
      stiffness: 1000, // Much stiffer for immediate response (was 100)
      damping: 60,     // Higher damping to control the high stiffness (was 18)
      mass: 1.0,       // Standard mass
      overshootClamping: false,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
  close: {
    animation: 'spring',
    config: {
      stiffness: 1000,
      damping: 60,
      mass: 1.0,
      overshootClamping: false,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
};

/**
 * Custom Card Style Interpolator
 * Implements the "Tray" effect:
 * - Exiting screen scales down and fades slightly (drops to back)
 * - Entering screen slides in from the right
 */
export const cardStyleInterpolator: StackCardStyleInterpolator = ({
  current,
  next,
  layouts,
  index,
  closing,
}) => {
  // This export is kept for backward compatibility or alternative use, 
  // but 'forTrayTransition' is the refined version being used.
  const { progress } = current;
  const width = layouts.screen.width;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  const scale = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.9], 
      })
    : 1;

  const opacity = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.8],
      })
    : 1;

  const borderRadius = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
      })
    : 0;

  return {
    cardStyle: {
      transform: [
        { translateX: translateX },
        { scale: scale },
      ],
      opacity: opacity,
      borderRadius: borderRadius,
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.3], 
      }),
    },
  };
};

// Refined Interpolator that correctly handles "Self" (Entering) and "Previous" (Leaving) logic
// The 'cardStyleInterpolator' is called for EACH card in the stack.
// - For the TOP card (entering): 'next' is undefined. We slide it in.
// - For the BACK card (leaving): 'next' is defined (it's the entering card). We scale it down.

// We extend the type to allow passing direction manually
export const forTrayTransition = (props: any) => {
  const { current, next, layouts, direction: propDirection } = props;
  const width = layouts.screen.width;

  // Use passed direction if available
  const isBack = propDirection === 'back';

  // Animation for the FOCUSED (Entering) card
  // Slides in from Right (width) to Center (0)
  // If Back: Slides in from Left (-width) to Center (0)
  const translateFocused = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isBack ? -width : width, 0],
  });

  // Enhanced "Tray" effect: More pronounced scaling and fading
  // When 'next' (the covering card) enters (progress 0->1):
  // 1. Scale down (1 -> 0.88) ("Drops back")
  // 2. Fade out (1 -> 0.75)
  // 3. Add Luxe Glow (Shadow opacity 0 -> 1)
  
  const scaleUnfocused = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.88], 
      })
    : 1;
    
  const opacityUnfocused = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.75],
      })
    : 1;

  // Luxe Glow Effect for the background card
  // Only applies when 'next' is present (meaning this card is dropping back)
  // Color: Brand Blue (#4FC3F7)
  const shadowColor = next ? '#4FC3F7' : '#000000';
  
  const shadowOpacity = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.6], // Glows as it drops
      })
    : undefined; // Let default shadow style handle it for entering card

  const shadowRadius = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 25], // Expands as it drops
      })
    : undefined;

  const elevation = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
      })
    : undefined;

  // Base styles for the entering card's shadow (Black drop shadow)
  const enteringShadowStyle = {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: isBack ? 5 : -5, height: 0 }, // Flip shadow offset if back
    elevation: 10,
  };

  // Styles for the dropping card (Blue Glow)
  // We apply these directly to cardStyle if next is present
  const droppingCardStyle = next ? {
    shadowColor: shadowColor,
    shadowOpacity: shadowOpacity,
    shadowRadius: shadowRadius,
    shadowOffset: { width: 0, height: 0 }, // Centered glow
    elevation: elevation,
    // Ensure background color is set so shadow casts correctly (usually inherited but good to be safe)
    // backgroundColor: 'black', // This might override transparent screens, proceed with caution
  } : {};

  return {
    cardStyle: {
      transform: [
        { translateX: next ? 0 : translateFocused },
        { scale: scaleUnfocused },
      ],
      opacity: opacityUnfocused,
      ...droppingCardStyle,
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4], 
      }),
    },
    // Only apply default shadow style if we are the entering card (next is undefined)
    shadowStyle: next ? null : enteringShadowStyle,
  };
};
