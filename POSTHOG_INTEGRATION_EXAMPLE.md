# PostHog Integration Example

This document shows practical examples of how to integrate PostHog analytics in key areas of your VibeChat app.

## Example 1: User Identification in UserContext

Add automatic user identification when users sign in:

```typescript
// src/contexts/UserContext.tsx

import { useAnalytics } from "@/hooks/useAnalytics";

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const analytics = useAnalytics();

  useEffect(() => {
    // Identify user when they're loaded
    if (user) {
      analytics.identify(user.id, {
        email: user.email,
        name: user.name,
        phone: user.phone,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      });
    }
  }, [user, analytics]);

  const signOut = async () => {
    try {
      await authClient.signOut();
      analytics.capture('user_signed_out');
      analytics.reset(); // Clear user identification
      setUser(null);
    } catch (error) {
      console.error('[UserContext] Sign out error:', error);
    }
  };

  // ... rest of your code
};
```

## Example 2: Track Screen Views in Navigation

Add automatic screen tracking in your navigation:

```typescript
// src/navigation/RootNavigator.tsx

import { useScreenTracking } from '@/hooks/useAnalytics';

function ChatScreen({ route }) {
  const { chatId } = route.params;
  
  // Automatically track when this screen is viewed
  useScreenTracking('Chat', {
    chat_id: chatId
  });

  return <View>...</View>;
}

function SettingsScreen() {
  useScreenTracking('Settings');
  return <View>...</View>;
}
```

## Example 3: Track Message Sending

Track when messages are sent in your chat component:

```typescript
// In your message sending function

import { useAnalytics } from '@/hooks/useAnalytics';

function ChatScreen() {
  const analytics = useAnalytics();

  const handleSendMessage = async (message: string, type: 'text' | 'image' | 'video') => {
    try {
      // Send message logic...
      await sendMessage(message);

      // Track the event
      analytics.capture('message_sent', {
        type,
        has_ai: chatHasAI,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return <MessageInput onSend={handleSendMessage} />;
}
```

## Example 4: Track Feature Usage

Track when users interact with features:

```typescript
// In a settings toggle

import { useAnalytics } from '@/hooks/useAnalytics';

function ThemeToggle() {
  const analytics = useAnalytics();
  const { isDark, toggleTheme } = useTheme();

  const handleToggle = () => {
    toggleTheme();
    
    analytics.capture('feature_used', {
      feature_name: 'theme_toggle',
      theme: isDark ? 'light' : 'dark',
      context: 'settings'
    });
  };

  return <Switch value={isDark} onValueChange={handleToggle} />;
}
```

## Example 5: Track AI Interactions

Track AI feature usage:

```typescript
// In your AI chat component

import { useAnalytics } from '@/hooks/useAnalytics';

function AIChat() {
  const analytics = useAnalytics();

  const handleAIMessage = async (message: string, command?: string) => {
    try {
      const response = await sendAIMessage(message);

      analytics.capture('ai_message_sent', {
        command,
        persona_type: aiPersona.type
      });

      return response;
    } catch (error) {
      analytics.capture('feature_used', {
        feature_name: 'ai_error',
        error_type: error.message
      });
    }
  };

  return <AIMessageInput onSend={handleAIMessage} />;
}
```

## Example 6: Track Voice Calls

Track voice call events:

```typescript
// In your voice call component

import { useAnalytics } from '@/hooks/useAnalytics';

function VoiceCall() {
  const analytics = useAnalytics();
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  const startCall = () => {
    const startTime = Date.now();
    setCallStartTime(startTime);

    analytics.capture('voice_call_started', {
      participant_count: participants.length
    });
  };

  const endCall = () => {
    if (callStartTime) {
      const duration = Math.floor((Date.now() - callStartTime) / 1000);

      analytics.capture('voice_call_ended', {
        duration_seconds: duration
      });
    }

    setCallStartTime(null);
  };

  return (
    <View>
      <Button onPress={startCall}>Start Call</Button>
      <Button onPress={endCall}>End Call</Button>
    </View>
  );
}
```

## Example 7: Track Onboarding Flow

Track user progress through onboarding:

```typescript
// In your onboarding screens

import { useAnalytics } from '@/hooks/useAnalytics';

function OnboardingScreen1() {
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.capture('feature_used', {
      feature_name: 'onboarding_step_1',
      context: 'onboarding'
    });
  }, []);

  const handleNext = () => {
    analytics.capture('feature_used', {
      feature_name: 'onboarding_step_1_completed',
      context: 'onboarding'
    });
    navigation.navigate('OnboardingStep2');
  };

  return <View>...</View>;
}
```

## Example 8: Track Premium Features

Track premium feature interactions:

```typescript
// In your premium/paywall component

import { useAnalytics } from '@/hooks/useAnalytics';

function PremiumScreen() {
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.capture('premium_viewed');
  }, []);

  const handleSubscribe = async (plan: string) => {
    try {
      await subscribeToPremium(plan);

      analytics.capture('premium_subscribed', {
        plan
      });

      navigation.goBack();
    } catch (error) {
      console.error('Subscription error:', error);
    }
  };

  return <View>...</View>;
}
```

## Example 9: Track Translation Usage

Track when users use translation features:

```typescript
// In your translation component

import { useAnalytics } from '@/hooks/useAnalytics';

function MessageTranslation({ message }) {
  const analytics = useAnalytics();

  const handleTranslate = async (toLanguage: string) => {
    try {
      const translated = await translateMessage(message, toLanguage);

      analytics.capture('message_translated', {
        from_language: message.language,
        to_language: toLanguage
      });

      return translated;
    } catch (error) {
      console.error('Translation error:', error);
    }
  };

  return <TranslateButton onPress={() => handleTranslate('es')} />;
}
```

## Example 10: Track Error Events

Track errors for debugging and monitoring:

```typescript
// In your error boundary or try-catch blocks

import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const analytics = useAnalytics();

  const handleAction = async () => {
    try {
      await performAction();
    } catch (error) {
      // Log error to console
      console.error('Action failed:', error);

      // Track in PostHog
      analytics.capture('feature_used', {
        feature_name: 'error_occurred',
        error_type: error.name,
        error_message: error.message,
        context: 'my_component_action'
      });

      // Show user-friendly message
      showToast('Something went wrong. Please try again.');
    }
  };

  return <Button onPress={handleAction} />;
}
```

## Best Practices Checklist

- ✅ Identify users when they sign in
- ✅ Reset analytics when users sign out
- ✅ Track screen views for important screens
- ✅ Track key user actions (send message, create chat, etc.)
- ✅ Track feature usage to understand adoption
- ✅ Track errors to identify issues
- ✅ Use consistent event naming (snake_case)
- ✅ Add context properties to events
- ✅ Don't track PII (message content, passwords, etc.)
- ✅ Test events in PostHog dashboard

## Next Steps

1. Add your PostHog API key to environment variables
2. Test that events are being sent (check PostHog dashboard)
3. Start adding tracking to key user flows
4. Create dashboards in PostHog for key metrics
5. Set up feature flags if needed
