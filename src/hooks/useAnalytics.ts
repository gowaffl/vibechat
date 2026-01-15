/**
 * useAnalytics Hook
 * 
 * Centralized analytics hook using PostHog for product analytics.
 * Provides convenient methods for tracking user events and behavior.
 */

import { usePostHog } from 'posthog-react-native';
import { useCallback, useEffect } from 'react';

export interface AnalyticsEvent {
  // User events
  user_signed_up?: { method: 'email' | 'phone' | 'google' | 'apple' };
  user_signed_in?: { method: 'email' | 'phone' | 'google' | 'apple' };
  user_signed_out?: Record<string, never>;
  
  // Chat events
  chat_created?: { type: 'group' | 'personal'; member_count?: number };
  message_sent?: { type: 'text' | 'image' | 'video' | 'audio'; has_ai: boolean };
  message_reacted?: { emoji: string };
  
  // AI events
  ai_message_sent?: { command?: string; persona_type?: string };
  ai_friend_created?: { persona_type: string };
  image_generated?: { success: boolean };
  
  // Voice events
  voice_call_started?: { participant_count: number };
  voice_call_ended?: { duration_seconds: number };
  
  // Feature usage
  feature_used?: { feature_name: string; context?: string };
  screen_viewed?: { screen_name: string };
  
  // Premium events
  premium_viewed?: Record<string, never>;
  premium_subscribed?: { plan: string };
  
  // Translation events
  message_translated?: { from_language: string; to_language: string };
  
  // Community events
  workflow_cloned?: { workflow_id: string };
  community_visited?: Record<string, never>;
}

type EventName = keyof AnalyticsEvent;
type EventProperties<T extends EventName> = AnalyticsEvent[T];

/**
 * Hook for tracking analytics events throughout the app.
 * 
 * @example
 * const analytics = useAnalytics();
 * 
 * // Track a button press
 * analytics.capture('feature_used', { feature_name: 'dark_mode_toggle' });
 * 
 * // Track screen view
 * analytics.trackScreen('Settings');
 * 
 * // Identify user
 * analytics.identify(userId, { email, name });
 */
export const useAnalytics = () => {
  const posthog = usePostHog();

  /**
   * Capture a custom event with optional properties
   */
  const capture = useCallback(<T extends EventName>(
    eventName: T,
    properties?: EventProperties<T>
  ) => {
    try {
      posthog?.capture(eventName, properties as Record<string, any>);
    } catch (error) {
      console.error('[Analytics] Error capturing event:', error);
    }
  }, [posthog]);

  /**
   * Track a screen view
   */
  const trackScreen = useCallback((screenName: string, properties?: Record<string, any>) => {
    try {
      posthog?.screen(screenName, properties);
    } catch (error) {
      console.error('[Analytics] Error tracking screen:', error);
    }
  }, [posthog]);

  /**
   * Identify the current user
   */
  const identify = useCallback((
    userId: string,
    properties?: {
      email?: string;
      name?: string;
      phone?: string;
      [key: string]: any;
    }
  ) => {
    try {
      posthog?.identify(userId, properties);
    } catch (error) {
      console.error('[Analytics] Error identifying user:', error);
    }
  }, [posthog]);

  /**
   * Set user properties
   */
  const setUserProperties = useCallback((properties: Record<string, any>) => {
    try {
      posthog?.identify(undefined, properties);
    } catch (error) {
      console.error('[Analytics] Error setting user properties:', error);
    }
  }, [posthog]);

  /**
   * Reset analytics (e.g., on logout)
   */
  const reset = useCallback(() => {
    try {
      posthog?.reset();
    } catch (error) {
      console.error('[Analytics] Error resetting analytics:', error);
    }
  }, [posthog]);

  /**
   * Enable/disable analytics
   */
  const setEnabled = useCallback((enabled: boolean) => {
    try {
      if (enabled) {
        posthog?.optIn();
      } else {
        posthog?.optOut();
      }
    } catch (error) {
      console.error('[Analytics] Error setting enabled state:', error);
    }
  }, [posthog]);

  return {
    capture,
    trackScreen,
    identify,
    setUserProperties,
    reset,
    setEnabled,
    // Expose the raw PostHog instance for advanced usage
    posthog,
  };
};

/**
 * Hook to automatically track screen views
 * Use this in your screen components to automatically track when they're viewed
 * 
 * @example
 * function MyScreen() {
 *   useScreenTracking('MyScreen', { some_property: 'value' });
 *   return <View>...</View>;
 * }
 */
export const useScreenTracking = (
  screenName: string,
  properties?: Record<string, any>
) => {
  const { trackScreen } = useAnalytics();

  useEffect(() => {
    trackScreen(screenName, properties);
  }, [screenName, trackScreen, properties]);
};
