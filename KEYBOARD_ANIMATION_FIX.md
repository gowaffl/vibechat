# Keyboard Animation Fix - Native-Synchronized Input

## Problem
The keyboard and message input bar were animating separately, with the keyboard opening first and the input bar following about half a second later. This created a disjointed, unresponsive user experience.

## Solution
Replaced the standard React Native `KeyboardAvoidingView` and `Keyboard` event listeners with `react-native-keyboard-controller`, which provides native-level synchronization between the keyboard and UI elements.

## Changes Made

### 1. ChatScreen.tsx
- **Removed**: Standard `Keyboard.addListener` events for `keyboardWillShow/Hide`
- **Removed**: Manual `keyboardHeight` state management
- **Added**: `useAnimatedKeyboard()` hook from Reanimated for native keyboard tracking
- **Added**: `useAnimatedStyle()` for synchronized padding animations
- **Updated**: `KeyboardAvoidingView` import from `react-native-keyboard-controller`
- **Updated**: `ScrollView` → `Reanimated.ScrollView` with animated style
- **Simplified**: Edit modal `KeyboardAvoidingView` to use consistent "padding" behavior

### 2. babel.config.js
- **Added**: `react-native-reanimated/plugin` to ensure Reanimated worklets compile correctly

## How It Works

1. **Native Keyboard Tracking**: `useAnimatedKeyboard()` provides a real-time `keyboard.height.value` that updates on the UI thread (not JS thread), eliminating lag.

2. **Animated Padding**: The input container's `paddingBottom` is animated using `useAnimatedStyle()`, which synchronizes perfectly with the native keyboard animation.

3. **Single Animation Frame**: The keyboard and input move together as one piece, just like Apple iMessage.

## Key Benefits

✅ **Instant responsiveness** - Keyboard and input move as one unit
✅ **Native performance** - Animations run on the UI thread
✅ **iOS-optimized** - Uses `behavior="padding"` for smooth iOS keyboard handling
✅ **Consistent behavior** - Same approach for both main chat and edit modal

## Technical Details

```typescript
// Before: Manual state tracking with delay
const [keyboardHeight, setKeyboardHeight] = useState(0);
Keyboard.addListener("keyboardWillShow", (e) => {
  setKeyboardHeight(e.endCoordinates.height); // JS thread, delayed
});

// After: Native synchronized tracking
const keyboard = useAnimatedKeyboard(); // UI thread, instant
const inputContainerAnimatedStyle = useAnimatedStyle(() => ({
  paddingBottom: keyboard.height.value > 0 ? 8 : insets.bottom + 16,
}));
```

## Dependencies Already Installed

- ✅ `react-native-keyboard-controller` (v1.17.0)
- ✅ `react-native-reanimated` (v3.17.4)
- ✅ `KeyboardProvider` already configured in App.tsx

## Important Implementation Notes

### Hook Order Fix
The `useAnimatedKeyboard()` and `useAnimatedStyle()` hooks **must** be declared early in the component, right after state declarations and before any conditional hooks or query hooks. This ensures the Rules of Hooks are followed and prevents "rendered more hooks than during previous render" errors.

```typescript
// ✅ Correct placement - early in component
const [eventButtonScale] = useState(new Animated.Value(1));
const [eventButtonRotate] = useState(new Animated.Value(0));

// Keyboard animation hooks - must be called early and consistently
const keyboard = useAnimatedKeyboard();
const inputContainerAnimatedStyle = useAnimatedStyle(() => {
  return {
    paddingBottom: keyboard.height.value > 0 ? 8 : insets.bottom + 24,
  };
});

// ❌ Wrong placement - after queries/conditionals
const handleSomething = () => { ... };
const keyboard = useAnimatedKeyboard(); // Will cause hook order error!
```

## Additional Improvements

### Chat List Keyboard Awareness
Added `chatListAnimatedStyle` that pushes the chat messages up when the keyboard opens:
- Uses `paddingTop: keyboard.height.value` on the inverted FlatList
- Ensures most recent message is visible above the input when typing
- Smooth, native-synchronized animation

### Instant Message Send (No Flash)
Improved message sending to be instant and smooth:
- **Before:** `invalidateQueries` caused a visible flash/refresh after sending
- **After:** Optimistic update smoothly replaced with real message data
- Message appears immediately in chat with smooth animation
- No jarring refresh or delay

**Key Changes:**
```typescript
onSuccess: (newMessage) => {
  // Smoothly replace optimistic message with real one
  const withoutOptimistic = previousMessages.filter(m => !m.id.startsWith('optimistic-'));
  queryClient.setQueryData(["messages", chatId], [...withoutOptimistic, newMessage]);
}
```

### Input Container Spacing
- Added `paddingBottom: 12` to input component container for breathing room
- Dark gradient background extends full height (no transparent gaps)
- Input sits flush against keyboard with no visible messages below

## Testing Checklist

- [ ] Tap message input - keyboard and input slide up together instantly
- [ ] Chat messages push up smoothly when keyboard opens
- [ ] Most recent message visible above input area
- [ ] Send message - appears instantly in chat with smooth animation
- [ ] No flash or refresh after sending message
- [ ] Dismiss keyboard - both slide down together smoothly
- [ ] Edit message - same synchronized behavior
- [ ] Fast typing - no lag or desync
- [ ] Mention picker - appears correctly above keyboard
- [ ] Different keyboard types - all sync properly
- [ ] No "rendered more hooks" errors in console
- [ ] Dark background extends to keyboard (no gaps showing messages)

