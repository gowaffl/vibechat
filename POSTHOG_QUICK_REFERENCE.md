# PostHog Quick Reference Card

## 🚀 Getting Started

### 1. Add Environment Variables

Create a `.env` file (or add to your existing one):

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_your_api_key_here
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### 2. Import the Hook

```typescript
import { useAnalytics } from '@/hooks/useAnalytics';
```

### 3. Use in Your Component

```typescript
const analytics = useAnalytics();
analytics.capture('event_name', { property: 'value' });
```

---

## 📊 Common Patterns

### Track Screen View

```typescript
import { useScreenTracking } from '@/hooks/useAnalytics';

function MyScreen() {
  useScreenTracking('MyScreen');
  return <View>...</View>;
}
```

### Track Button Press

```typescript
const analytics = useAnalytics();

<Button onPress={() => {
  analytics.capture('feature_used', {
    feature_name: 'dark_mode_toggle'
  });
}} />
```

### Identify User (on login)

```typescript
analytics.identify(userId, {
  email: user.email,
  name: user.name
});
```

### Reset (on logout)

```typescript
analytics.capture('user_signed_out');
analytics.reset();
```

---

## 🎯 Available Events

| Event | Properties | Example |
|-------|-----------|---------|
| `user_signed_up` | `method` | `{ method: 'email' }` |
| `user_signed_in` | `method` | `{ method: 'phone' }` |
| `chat_created` | `type, member_count` | `{ type: 'group', member_count: 5 }` |
| `message_sent` | `type, has_ai` | `{ type: 'text', has_ai: true }` |
| `message_reacted` | `emoji` | `{ emoji: '👍' }` |
| `ai_message_sent` | `command, persona_type` | `{ command: 'tldr' }` |
| `voice_call_started` | `participant_count` | `{ participant_count: 3 }` |
| `voice_call_ended` | `duration_seconds` | `{ duration_seconds: 180 }` |
| `feature_used` | `feature_name, context` | `{ feature_name: 'dark_mode' }` |
| `screen_viewed` | `screen_name` | `{ screen_name: 'Settings' }` |
| `premium_viewed` | - | `{}` |
| `premium_subscribed` | `plan` | `{ plan: 'monthly' }` |
| `message_translated` | `from_language, to_language` | `{ from_language: 'en', to_language: 'es' }` |

---

## 🛠️ API Methods

```typescript
const analytics = useAnalytics();

// Capture event
analytics.capture('event_name', { key: 'value' });

// Track screen
analytics.trackScreen('ScreenName', { key: 'value' });

// Identify user
analytics.identify('user_id', { email: 'user@example.com' });

// Set user properties
analytics.setUserProperties({ theme: 'dark' });

// Reset (logout)
analytics.reset();

// Enable/disable
analytics.setEnabled(false); // Opt out
analytics.setEnabled(true);  // Opt in
```

---

## ✅ Implementation Checklist

### Core Setup
- [x] PostHog package installed
- [x] Provider configured in App.tsx
- [x] Config added to src/config.ts
- [x] useAnalytics hook created
- [ ] Environment variables set

### Tracking Implementation
- [ ] User sign in/out tracking
- [ ] Screen view tracking on main screens
- [ ] Message sending tracking
- [ ] AI interaction tracking
- [ ] Voice call tracking
- [ ] Premium feature tracking
- [ ] Error tracking

---

## 🔍 Testing

### 1. Check Console
Look for PostHog initialization logs when app starts.

### 2. Trigger Event
```typescript
analytics.capture('test_event', { test: true });
```

### 3. Verify in PostHog
1. Go to [PostHog Dashboard](https://app.posthog.com)
2. Navigate to "Live Events"
3. Look for your event (may take a few seconds)

---

## 🐛 Troubleshooting

**Events not appearing?**
- ✅ Check `EXPO_PUBLIC_POSTHOG_API_KEY` is set
- ✅ Verify API key in PostHog dashboard
- ✅ Check console for errors
- ✅ Ensure internet connection
- ✅ Try `npx expo start -c` to clear cache

**Build errors?**
```bash
rm -rf node_modules
npm install
npx expo start -c
```

---

## 📁 Key Files

- **Config**: `src/config.ts`
- **Provider**: `App.tsx`
- **Hook**: `src/hooks/useAnalytics.ts`
- **Docs**: `POSTHOG_SETUP.md`
- **Examples**: `POSTHOG_INTEGRATION_EXAMPLE.md`

---

## 🎓 Resources

- [Full Setup Guide](./POSTHOG_SETUP.md)
- [Integration Examples](./POSTHOG_INTEGRATION_EXAMPLE.md)
- [PostHog Docs](https://posthog.com/docs/libraries/react-native)
- [PostHog Dashboard](https://app.posthog.com)

---

## 💡 Pro Tips

1. **Be Consistent**: Use snake_case for all event names
2. **Add Context**: Include relevant properties with events
3. **Track Errors**: Monitor errors to improve UX
4. **No PII**: Never track sensitive user data
5. **Test Often**: Verify events appear in PostHog dashboard
6. **Start Simple**: Focus on key user flows first
7. **Use Types**: TypeScript will autocomplete event names
8. **Document**: Add comments explaining what you're tracking

---

**Need Help?** See the full documentation in `POSTHOG_SETUP.md`
