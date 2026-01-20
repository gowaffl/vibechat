/**
 * useAnalytics Hook
 * 
 * Centralized analytics hook using PostHog for product analytics.
 * Provides convenient methods for tracking user events and behavior.
 */

import { usePostHog } from 'posthog-react-native';
import { useCallback, useEffect } from 'react';

export interface AnalyticsEvent {
  // User Lifecycle Events
  user_signed_up?: { method: 'email' | 'phone' | 'google' | 'apple'; referrer?: string };
  user_signed_in?: { method: 'email' | 'phone' | 'google' | 'apple' };
  user_signed_out?: Record<string, never>;
  onboarding_step_completed?: { step_name: string; step_number: number; [key: string]: any };
  onboarding_completed?: { time_taken_seconds?: number };
  profile_updated?: { fields_updated: string[] };
  
  // Messaging Events - Core
  message_sent?: { 
    type: 'text' | 'image' | 'video' | 'audio'; 
    chat_type: 'group' | 'personal';
    has_media?: boolean;
    has_mention?: boolean;
    has_vibe?: boolean;
    char_length?: number;
    is_first_message?: boolean;
  };
  first_message_sent?: { time_since_signup_minutes: number };
  message_received?: { sender_type: 'user' | 'ai' };
  message_replied?: { message_type: string };
  message_deleted?: { own_message: boolean };
  message_copied?: { message_type: string };
  message_shared?: { share_type: string };
  
  // Reactions & Engagement
  reaction_added?: { emoji: string; message_type?: string; is_own_message?: boolean };
  reaction_removed?: { emoji: string };
  message_reply_started?: { message_type: string; is_own_message: boolean };
  
  // AI Feature Events
  catch_up_viewed?: { unread_count: number; time_away_hours?: number };
  catch_up_generated?: { message_count: number; time_taken_ms: number; summary_type?: string };
  ai_message_sent?: { command?: string; has_tools?: boolean; persona_name?: string; prompt_length?: number; has_ai_friend?: boolean };
  ai_friend_created?: { persona_type: string };
  tldr_generated?: { message_count: number; time_taken_ms?: number };
  translation_used?: { from_lang: string; to_lang: string; auto_detected?: boolean; char_length?: number };
  image_generated?: { prompt_length: number; success: boolean; time_taken_ms?: number; error_type?: string };
  smart_reply_used?: { reply_text_length: number };
  
  // LLM Analytics Events (PostHog Best Practices)
  llm_generation_started?: { 
    feature: 'catch_up' | 'tldr' | 'translation' | 'image_gen' | 'ai_chat' | 'personal_chat';
    model?: string;
    chat_type?: 'group' | 'personal';
    input_length?: number;
    context_length?: number;
  };
  llm_generation_completed?: {
    feature: 'catch_up' | 'tldr' | 'translation' | 'image_gen' | 'ai_chat' | 'personal_chat';
    model?: string;
    duration_ms: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    success: boolean;
    error_type?: string;
    cost_usd?: number;
  };
  llm_generation_failed?: {
    feature: 'catch_up' | 'tldr' | 'translation' | 'image_gen' | 'ai_chat' | 'personal_chat';
    model?: string;
    error_type: string;
    error_message?: string;
    duration_ms?: number;
  };
  llm_response_rated?: {
    feature: string;
    rating: 'positive' | 'negative';
    feedback?: string;
  };
  
  // Voice & Audio Events
  voice_call_started?: { participant_count: number; call_type?: 'group' | 'personal' };
  voice_call_joined?: { room_id?: string; was_invited?: boolean };
  voice_call_left?: { duration_seconds: number };
  voice_call_ended?: { duration_seconds: number; participant_count: number };
  voice_message_sent?: { duration_seconds: number };
  voice_message_played?: Record<string, never>;
  
  // Social & Discovery Events
  chat_created?: { type: 'group' | 'personal'; initial_member_count: number };
  chat_joined?: { join_method: string; member_count: number };
  chat_left?: { member_count: number };
  chat_viewed?: { chat_id: string };
  invite_sent?: { method: string; chat_type?: string };
  invite_accepted?: { chat_id: string };
  friend_added?: Record<string, never>;
  
  // Thread & Organization Events
  thread_created?: { rule_count: number; is_shared: boolean };
  thread_viewed?: { thread_name: string; message_count?: number };
  
  // Content Events
  event_created?: { has_date: boolean; has_location?: boolean; has_reminder?: boolean };
  event_rsvp?: { response_type: 'yes' | 'no' | 'maybe' };
  poll_created?: { option_count: number; allow_multiple: boolean };
  poll_voted?: { option_index: number };
  media_uploaded?: { media_type: 'image' | 'video' | 'audio'; file_size_mb?: number; media_source?: string };
  media_viewed?: { media_type: string };
  link_preview_viewed?: { domain?: string };
  bookmark_added?: { content_type?: string };
  bookmark_removed?: Record<string, never>;
  
  // Feature Discovery Events
  feature_discovered?: { feature_name: string; discovery_method: string };
  feature_used?: { feature_name: string; context?: string };
  menu_opened?: { menu_type: string; screen?: string };
  settings_viewed?: { section?: string };
  help_viewed?: { help_topic?: string };
  screen_viewed?: { screen_name: string; [key: string]: any };
  
  // Monetization Events
  premium_viewed?: { source?: string };
  paywall_viewed?: { trigger_feature: string; user_message_count?: number; days_since_signup?: number };
  premium_cta_clicked?: { plan_type?: string; source?: string };
  premium_subscribed?: { plan: string; price?: number; had_trial?: boolean };
  premium_cancelled?: { reason?: string; days_subscribed?: number };
  premium_feature_used?: { feature_name: string };
  premium_feature_attempted?: { feature_name: string; is_locked: boolean };
  
  // Subscription Events (RevenueCat)
  subscription_plan_changed?: { new_plan: string; previous_plan: string; is_trial?: boolean };
  subscription_purchased?: { package_id: string; product_id: string; price?: number; currency?: string };
  subscription_purchase_failed?: { package_id: string; error_code?: string; error_message?: string };
  free_trial_started?: { trial_days: number };
  subscription_restored?: { plan: string };
  subscription_upgraded?: { from_plan: string; to_plan: string };
  rate_limit_hit?: { feature: string; limit: number; current_usage: number; plan: string };
  
  // Error & Performance Events
  error_occurred?: { error_type: string; error_message?: string; screen?: string; component_stack?: string; status_code?: number; endpoint?: string };
  slow_performance?: { operation: string; duration_ms: number };
  network_error?: { endpoint: string; status_code?: number; error_type?: string };
  crash_prevented?: { error_boundary: string; component?: string };
  
  // Community & Workflows
  workflow_cloned?: { workflow_id: string };
  community_visited?: Record<string, never>;
  
  // Test Events
  test_event?: { timestamp?: string; test?: boolean; [key: string]: any };
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
