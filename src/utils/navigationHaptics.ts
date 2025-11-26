import * as Haptics from "expo-haptics";
import { NavigationContainerRef } from "@react-navigation/native";

/**
 * Navigation Haptics Utility
 * Provides haptic feedback for navigation events to create a more tactile UX
 */

export const triggerNavigationHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const triggerBackNavigationHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const triggerModalOpenHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

export const triggerModalCloseHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Setup navigation listeners for automatic haptics
 */
export const setupNavigationHaptics = (navigationRef: React.RefObject<NavigationContainerRef<any>>) => {
  return navigationRef.current?.addListener('state' as any, () => {
    // Trigger light haptic on every navigation state change
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
};

