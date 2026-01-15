# PostHog Analytics Setup & Usage Guide

## Overview

PostHog is fully installed and configured in VibeChat for product analytics, user tracking, and feature usage monitoring.

## Installation Status ✅

- ✅ **Package installed**: `posthog-react-native` v4.18.0
- ✅ **Dependencies installed**: All required Expo packages
- ✅ **Provider configured**: PostHogProvider wraps the entire app
- ✅ **Configuration**: Environment-based configuration in `src/config.ts`
- ✅ **Utility hook**: `useAnalytics` hook created for easy usage

## Environment Variables

Add these environment variables to your `.env` file or Expo configuration:

```bash
# Required
EXPO_PUBLIC_POSTHOG_API_KEY=phc_your_api_key_here

# Optional (defaults to US cloud)
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Getting Your PostHog API Key

1. Go to your PostHog project settings
2. Navigate to "Project API Key"
3. Copy the API key (starts with `phc_`)
4. Add it to your environment variables

## Usage Examples

### Basic Event Tracking

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const analytics = useAnalytics();

  const handleButtonPress = () => {
    analytics.capture('feature_used', {
      feature_name: 'dark_mode_toggle',
      context: 'settings_screen'
    });
  };

  return <Button onPress={handleButtonPress} />;
}
```

### Screen Tracking

```typescript
import { useScreenTracking } from '@/hooks/useAnalytics';

function SettingsScreen() {
  // Automatically tracks when this screen is viewed
  useScreenTracking('Settings');

  return <View>...</View>;
}

// With additional properties
function ChatScreen({ chatId, chatType }: Props) {
  useScreenTracking('Chat', {
    chat_id: chatId,
    chat_type: chatType
  });

  return <View>...</View>;
}
```

### User Identification

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function useAuthTracking() {
  const analytics = useAnalytics();
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      analytics.identify(user.id, {
        email: user.email,
        name: user.name,
        phone: user.phone
      });
    }
  }, [user]);
}
```

### Tracking Sign Up/In Events

```typescript
// After successful sign up
analytics.capture('user_signed_up', {
  method: 'email' // or 'phone', 'google', 'apple'
});

// After successful sign in
analytics.capture('user_signed_in', {
  method: 'email'
});

// On logout
analytics.capture('user_signed_out');
analytics.reset(); // Clear user data
```

### Chat & Messaging Events

```typescript
// When creating a chat
analytics.capture('chat_created', {
  type: 'group',
  member_count: 5
});

// When sending a message
analytics.capture('message_sent', {
  type: 'text',
  has_ai: true
});

// When reacting to a message
analytics.capture('message_reacted', {
  emoji: '👍'
});
```

### AI Feature Tracking

```typescript
// AI message sent
analytics.capture('ai_message_sent', {
  command: 'tldr',
  persona_type: 'helpful_assistant'
});

// AI friend created
analytics.capture('ai_friend_created', {
  persona_type: 'professional'
});

// Image generation
analytics.capture('image_generated', {
  success: true
});
```

### Voice Call Tracking

```typescript
// When starting a voice call
analytics.capture('voice_call_started', {
  participant_count: 4
});

// When ending a voice call
analytics.capture('voice_call_ended', {
  duration_seconds: 180
});
```

### Premium Features

```typescript
// When viewing premium page
analytics.capture('premium_viewed');

// When subscribing
analytics.capture('premium_subscribed', {
  plan: 'monthly'
});
```

### Advanced Usage

```typescript
const analytics = useAnalytics();

// Set user properties
analytics.setUserProperties({
  theme_preference: 'dark',
  language: 'en',
  notifications_enabled: true
});

// Enable/disable analytics
analytics.setEnabled(false); // User opts out
analytics.setEnabled(true);  // User opts in

// Access raw PostHog instance for advanced features
const posthog = analytics.posthog;
if (posthog) {
  posthog.getFeatureFlag('new-feature');
}
```

## Event Types Reference

The `useAnalytics` hook provides TypeScript types for all events. Available event types:

### User Events
- `user_signed_up`
- `user_signed_in`
- `user_signed_out`

### Chat Events
- `chat_created`
- `message_sent`
- `message_reacted`

### AI Events
- `ai_message_sent`
- `ai_friend_created`
- `image_generated`

### Voice Events
- `voice_call_started`
- `voice_call_ended`

### Feature Usage
- `feature_used`
- `screen_viewed`

### Premium Events
- `premium_viewed`
- `premium_subscribed`

### Translation Events
- `message_translated`

### Community Events
- `workflow_cloned`
- `community_visited`

## Best Practices

### 1. **Track User Flows**
Track key user journeys to understand how users navigate your app:
```typescript
// Onboarding flow
analytics.capture('feature_used', { feature_name: 'onboarding_started' });
analytics.capture('feature_used', { feature_name: 'onboarding_step_1' });
analytics.capture('feature_used', { feature_name: 'onboarding_completed' });
```

### 2. **Track Feature Adoption**
Understand which features are being used:
```typescript
analytics.capture('feature_used', {
  feature_name: 'dark_mode',
  context: 'settings'
});
```

### 3. **Track Errors and Issues**
Monitor errors and edge cases:
```typescript
try {
  // Some operation
} catch (error) {
  analytics.capture('feature_used', {
    feature_name: 'error_occurred',
    error_type: error.message,
    context: 'message_send'
  });
}
```

### 4. **Use Consistent Naming**
- Use snake_case for event names and property keys
- Be descriptive but concise
- Group related events with prefixes (e.g., `chat_created`, `chat_deleted`)

### 5. **Don't Track PII**
Avoid tracking personally identifiable information in event properties:
- ❌ Don't track: message content, email addresses in properties
- ✅ Do track: message type, number of messages, feature usage

## Testing

### Test in Development

PostHog will work in development mode. Check the console for warnings if the API key is not set:

```
⚠️ PostHog API key not set. Analytics will be disabled.
```

### Verify Events in PostHog

1. Log in to your PostHog dashboard
2. Go to "Events" or "Live Events"
3. Trigger an event in your app
4. Verify it appears in PostHog (may take a few seconds)

## Debugging

### Enable PostHog Debug Mode

```typescript
import { usePostHog } from 'posthog-react-native';

const posthog = usePostHog();
posthog?.debug(); // Enables verbose logging
```

### Common Issues

**Events not showing up:**
- Check that `EXPO_PUBLIC_POSTHOG_API_KEY` is set correctly
- Verify the API key is correct in PostHog dashboard
- Check console for error messages
- Ensure you're connected to the internet

**Build errors:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Metro cache: `npx expo start -c`

## Additional Resources

- [PostHog React Native Docs](https://posthog.com/docs/libraries/react-native)
- [PostHog Dashboard](https://app.posthog.com)
- [PostHog API Reference](https://posthog.com/docs/api)

## Implementation Files

- **Configuration**: `src/config.ts`
- **Provider Setup**: `App.tsx`
- **Hook**: `src/hooks/useAnalytics.ts`
- **This Guide**: `POSTHOG_SETUP.md`
