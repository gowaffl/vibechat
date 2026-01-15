# PostHog Troubleshooting Guide

## Error: "useNavigation/useNavigationState error: Couldn't find a navigation object"

### Problem
You see these errors when starting your app:
```
useNavigationState error Error: Couldn't find a navigation object. 
Is your component inside NavigationContainer?

useNavigation error Error: Couldn't find a navigation object. 
Is your component inside NavigationContainer?
```

### Root Cause
PostHog has an "autocapture" feature that automatically tracks React Navigation screen views. This feature tries to access navigation state before the NavigationContainer is mounted, causing these errors.

### Solution ✅

This has been fixed in `App.tsx` by disabling PostHog's autocapture features:

```typescript
<PostHogProvider
  apiKey={POSTHOG_API_KEY || "placeholder"}
  options={{
    host: POSTHOG_HOST,
    disabled: !isPostHogEnabled,
    captureNativeAppLifecycleEvents: false,
  }}
  autocapture={{
    captureScreens: false,      // Disable auto screen tracking
    captureTouches: false,       // Disable auto touch tracking
    captureLifecycleEvents: false, // Disable auto lifecycle tracking
  }}
>
```

**What this means:**
- ✅ No more navigation errors
- ✅ You track screens manually using `useScreenTracking()` (which gives you more control)
- ✅ PostHog works properly without interfering with navigation

**Restart your app** to apply the fix:
```bash
# Stop Metro (Ctrl+C)
npx expo start -c
# Press 'i' for iOS or 'a' for Android
```

---

## Error: "Either a PostHog client or an apiKey is required"

### Problem
You see this error when starting your app:
```
ERROR Warning: Error: Either a PostHog client or an apiKey is required. 
If you want to use the PostHogProvider without a client, please provide 
an apiKey and the options={ disabled: true }.
```

### Root Cause
This happens when the PostHog API key isn't being loaded from your environment variables, usually because:
1. The `.env` file was just created/updated and Metro hasn't reloaded it
2. Environment variables weren't set properly
3. Metro cache has stale values

### Solution ✅

**Step 1: Verify your `.env` file**
Make sure you have:
```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_your_actual_key_here
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Step 2: Restart with cache cleared**
```bash
# Stop the current Metro bundler (Ctrl+C)
npx expo start -c
# Press 'i' for iOS or 'a' for Android
```

**Step 3: Verify it's working**
After restart, you should see:
- No PostHog errors in the console
- A log: `⚠️ PostHog API key not set. Analytics will be disabled.` (if key is missing)
- OR normal app startup (if key is present)

### How We Fixed It

The `App.tsx` was updated to gracefully handle missing API keys:

```typescript
export default function App() {
  // Only enable PostHog if API key is provided
  const isPostHogEnabled = POSTHOG_API_KEY && POSTHOG_API_KEY.length > 0;

  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY || "placeholder"}
      options={{
        host: POSTHOG_HOST,
        disabled: !isPostHogEnabled,  // ← Disables PostHog if no key
      }}
    >
      {/* ... rest of app */}
    </PostHogProvider>
  );
}
```

This means:
- ✅ If API key is set → PostHog is enabled and tracking
- ✅ If API key is missing → PostHog is disabled, app works normally
- ✅ No more errors!

## Other Common Issues

### Issue: Events not appearing in PostHog dashboard

**Possible causes:**
1. API key is incorrect
2. Network connectivity issues
3. PostHog cloud instance is down
4. Events are being sent but there's a delay

**Solutions:**
```typescript
// Enable debug mode to see what's being sent
import { usePostHog } from 'posthog-react-native';

const posthog = usePostHog();
posthog?.debug(); // Enables verbose logging
```

### Issue: App crashes after adding PostHog

**Possible causes:**
1. Package not installed correctly
2. Native dependencies not linked

**Solutions:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild iOS (if on iOS)
cd ios && pod install && cd ..

# Clear cache and restart
npx expo start -c
```

### Issue: TypeScript errors with useAnalytics hook

**Possible causes:**
1. Import path is incorrect
2. TypeScript hasn't picked up the new file

**Solutions:**
```typescript
// Correct import:
import { useAnalytics } from '@/hooks/useAnalytics';

// If that doesn't work, try relative path:
import { useAnalytics } from '../hooks/useAnalytics';

// Or restart TypeScript server in VSCode/Cursor:
// Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## Environment Variable Best Practices

### ✅ DO:
- Use `EXPO_PUBLIC_` prefix for client-side variables
- Store API keys securely (don't commit `.env` to git)
- Use different keys for dev/staging/production

### ❌ DON'T:
- Commit `.env` file to version control
- Use production keys in development
- Share API keys in screenshots or logs

### Example .env structure:
```bash
# Development
EXPO_PUBLIC_POSTHOG_API_KEY=phc_dev_key_here

# Production (in your deployment environment)
EXPO_PUBLIC_POSTHOG_API_KEY=phc_prod_key_here
```

## Verification Checklist

After fixing the error, verify:

- [ ] App starts without PostHog errors
- [ ] No console errors related to PostHog
- [ ] Test event appears in PostHog dashboard:
  ```typescript
  const analytics = useAnalytics();
  analytics.capture('test_event', { test: true });
  ```
- [ ] Check [PostHog Live Events](https://app.posthog.com/events) for your test event
- [ ] User identification works on login
- [ ] Analytics reset on logout

## Still Having Issues?

1. **Check the documentation:**
   - `POSTHOG_SETUP.md` - Complete setup guide
   - `POSTHOG_INTEGRATION_EXAMPLE.md` - Code examples
   - `POSTHOG_QUICK_REFERENCE.md` - Quick reference

2. **Check PostHog status:**
   - [PostHog Status Page](https://status.posthog.com)

3. **Enable debug logging:**
   ```typescript
   const posthog = usePostHog();
   posthog?.debug();
   ```

4. **Check Metro bundler logs:**
   - Look for environment variable warnings
   - Check for module resolution errors

5. **Verify package installation:**
   ```bash
   npm list posthog-react-native
   # Should show: posthog-react-native@4.18.0
   ```

## Quick Fix Commands

```bash
# Full reset (if all else fails)
rm -rf node_modules
rm -rf ios/Pods
rm -rf ios/build
npm install
cd ios && pod install && cd ..
npx expo start -c
```

---

**Last Updated:** January 15, 2026

For more help, see the main [POSTHOG_SETUP.md](./POSTHOG_SETUP.md) guide.
