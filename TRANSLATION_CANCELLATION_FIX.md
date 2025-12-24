# Translation API Cancellation Fix

## Problem Identified

```
LOG  [API Error] POST /api/ai-native/translate-batch: [Error: fetch failed: Fetch request has been canceled]
ERROR  [Translation] Failed to translate messages: [Error: fetch failed: Fetch request has been canceled]
```

### Root Cause

The translation feature had **race conditions** caused by multiple `useEffect` hooks triggering `translateVisibleMessages` simultaneously:

1. **Main Chat Effect**: Triggered whenever `allMessages` changed (frequent due to real-time updates)
2. **Thread Effect**: Triggered whenever `allThreadMessages` changed
3. **Focus Effect**: Triggered when the screen was focused

When these effects fired in rapid succession (e.g., when multiple messages came in quickly, or when navigating between chats), they would:
- Start multiple API requests simultaneously
- Each new request would cancel the previous one
- Result in repeated "fetch failed: Fetch request has been canceled" errors
- No translations would complete successfully

## Solutions Implemented

### 1. **Translation Request Lock** ✅

Added a ref-based lock to prevent concurrent translation requests:

```typescript
const translationInProgressRef = useRef(false); // Lock to prevent concurrent translations
```

In `translateVisibleMessages`:
```typescript
// Check if translation is already in progress
if (translationInProgressRef.current) {
  console.log("[Translation] Translation already in progress, skipping duplicate request");
  return;
}

// Set lock
translationInProgressRef.current = true;

try {
  // ... API call ...
} finally {
  // Release lock
  translationInProgressRef.current = false;
}
```

**Why this works**: Ensures only ONE translation request can be in flight at a time. If another effect tries to trigger translation while one is already running, it will be skipped.

### 2. **Debounced Translation Effects** ✅

Added 500ms debounce to translation effects to prevent rapid-fire triggering:

```typescript
const translationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debouncing

// In effects:
if (translationTimeoutRef.current) {
  clearTimeout(translationTimeoutRef.current);
}

translationTimeoutRef.current = setTimeout(() => {
  translateVisibleMessages(messages, false);
}, 500); // 500ms debounce
```

**Why this works**: 
- When messages update rapidly, previous timeouts are cleared and a new one is set
- Translation only fires after 500ms of "quiet time" with no new updates
- Dramatically reduces the number of API calls

### 3. **Dependency Array Optimization** ✅

Changed from tracking entire message arrays to just their lengths:

**Before**:
```typescript
}, [translationEnabled, translationLanguage, allMessages, currentThreadId]);
```

**After**:
```typescript
}, [translationEnabled, translationLanguage, allMessages.length, currentThreadId]);
```

**Why this works**:
- Arrays are compared by reference, so every change triggers the effect
- Length changes only when messages are added/removed, not when they're modified
- Reduces unnecessary effect triggers

### 4. **Graceful Cancellation Handling** ✅

Updated error handling to distinguish between actual errors and cancellations:

```typescript
catch (error: any) {
  // Only log error if it's not a cancellation
  if (!error?.message?.includes("canceled") && !error?.message?.includes("cancelled")) {
    console.error("[Translation] Failed to translate messages:", error);
  } else {
    console.log("[Translation] Request was canceled (likely due to component unmount or navigation)");
  }
}
```

**Why this works**: Cancellations are now logged as informational messages, not errors.

### 5. **Staggered Focus Effect Timing** ✅

Increased the delay on the `useFocusEffect` from 100ms to 800ms:

```typescript
const timer = setTimeout(() => {
  // ... translate ...
}, 800); // 800ms delay to avoid conflict with other effects
```

**Why this works**: Gives the other debounced effects time to complete before the focus effect triggers, avoiding overlap.

## Flow Comparison

### Before (❌ Multiple Concurrent Requests)

```
Message arrives → allMessages updates → Effect 1 fires immediately → API Request 1 starts
100ms later → Another message arrives → allMessages updates → Effect 1 fires → API Request 2 starts (cancels Request 1)
50ms later → Focus effect fires → API Request 3 starts (cancels Request 2)
Result: All requests canceled, no translations complete
```

### After (✅ Single Debounced Request)

```
Message arrives → allMessages.length updates → Effect 1 schedules in 500ms → Timer 1 set
100ms later → Another message arrives → allMessages.length updates → Timer 1 cleared, Timer 2 set (500ms)
50ms later → Focus effect schedules in 800ms → Timer 3 set
450ms of quiet time passes...
Timer 2 fires → Check lock (not locked) → Set lock → API Request starts
Request completes → Lock released → Translations applied ✅
```

## Testing Verification

1. **Enable translation** in a chat
2. **Send multiple messages rapidly** or receive real-time messages
3. **Check console logs**:
   - Should see "SCHEDULING translation" messages
   - Should see only ONE "EXECUTING translation" after quiet period
   - Should NOT see repeated cancellation errors
4. **Verify translations appear** after the debounce period
5. **Navigate away and back** to the chat
   - Translation state should persist
   - No duplicate requests should fire

## Console Logs to Watch For

**Good (Expected)**:
```
[Translation] Main chat effect - SCHEDULING translation for 50 messages in 500ms
[Translation] Main chat effect - SCHEDULING translation for 51 messages in 500ms
[Translation] Main chat effect - EXECUTING translation
[Translation] Calling batch translate API for 10 messages to language: es
[Translation] Received translations count: 10
[Translation] Updated translatedMessages object, total: 10
```

**Bad (Should No Longer Happen)**:
```
[API Error] POST /api/ai-native/translate-batch: [Error: fetch failed: Fetch request has been canceled]
ERROR  [Translation] Failed to translate messages: [Error: fetch failed: Fetch request has been canceled]
```

## Additional Benefits

1. **Reduced API calls**: Debouncing dramatically reduces the number of API requests
2. **Better UX**: Translations appear smoothly without flickering or errors
3. **Server load**: Backend receives far fewer requests
4. **Battery life**: Mobile devices make fewer network requests

## Files Modified

- **src/screens/ChatScreen.tsx**:
  - Added `translationInProgressRef` lock
  - Added `translationTimeoutRef` for debouncing
  - Updated `translateVisibleMessages` with lock and better error handling
  - Debounced main chat translation effect
  - Debounced thread translation effect
  - Staggered focus effect timing
  - Optimized dependency arrays to use `.length` instead of full arrays

## Related Documentation

- **TRANSLATION_FIX_SUMMARY.md**: Original translation persistence fix
- **TRANSLATION_IMPLEMENTATION_COMPLETE.md**: Initial translation feature documentation
- **TRANSLATION_LANGUAGE_PREFERENCES.md**: Language preference system

## Next Steps

1. Test thoroughly with rapid message updates
2. Monitor backend logs to verify reduced API load
3. Consider adding a loading indicator during the debounce period (optional)
4. Consider using React Query for translations with built-in caching/deduplication (future enhancement)

