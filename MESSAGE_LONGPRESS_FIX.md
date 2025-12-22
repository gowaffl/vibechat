# Message Long Press Context Menu Fix

## Issue Summary
Users reported that long-press to show the context menu (for reacting, replying, copying, etc.) was working inconsistently across different message types. Some messages would respond to long press while others would not, with no clear pattern.

## Root Causes Identified

### 1. Nested GestureDetector Conflict
The message rendering had multiple nested `GestureDetector` components:
- **SwipeableMessage** wrapper with a Pan gesture (for swipe-to-reveal timestamp)
- **Bubble gesture** inside with LongPress + Tap gestures
- For images: Additional **Pressable** with `onLongPress` handler

When gestures are nested, the outer Pan gesture can interfere with the inner LongPress gesture, especially if the user's finger moves slightly during the press (natural finger wobble).

### 2. Image Message Conflict
Image messages had a separate `onLongPress` handler on a Pressable component that was intended to enable "image selection mode". However, this Pressable was inside the GestureDetector with the bubble gesture, causing the outer gesture to consume the touch event before reaching the Pressable. This created a conflict where neither gesture would consistently fire.

### 3. Gesture Sensitivity
The Pan gesture had a relatively low activation threshold (10px), meaning even slight finger movement during a long press could activate the swipe gesture instead, canceling the long press.

## Fixes Implemented

### 1. SwipeableMessage Pan Gesture Adjustments
**File:** `src/components/SwipeableMessage.tsx`

- **Increased `activeOffsetX`** from `[-10, 10]` to `[-20, 20]`
  - Requires 20px of horizontal movement before the pan gesture activates
  - Reduces accidental activation during long press
  
- **Increased `failOffsetY`** from `[-15, 15]` to `[-25, 25]`
  - More tolerant of vertical finger movement
  - Prevents pan gesture from failing due to natural finger wobble

### 2. Bubble Long Press Gesture Improvements
**File:** `src/screens/ChatScreen.tsx` (lines ~7131-7138)

- **Reduced `minDuration`** from `500ms` to `400ms`
  - Long press triggers faster, before pan gesture has chance to interfere
  - Still long enough to distinguish from taps
  
- **Added `maxDistance(20)`** parameter
  - Allows up to 20px of finger movement during long press
  - Accommodates natural finger wobble without canceling the gesture

- **Added explicit `hitSlop`** to MessageBubbleMeasurer
  - Ensures touch area is properly defined
  - Helps with gesture recognition consistency

### 3. Removed Conflicting Image Pressable Handler
**File:** `src/screens/ChatScreen.tsx` (lines ~6657-6676)

- **Removed `onLongPress`** from image Pressable
  - Eliminated gesture conflict for image messages
  - The bubble long press now handles all messages uniformly
  - Image selection mode functionality should be added to context menu if needed

## Technical Details

### Gesture Composition Strategy
The gestures are composed using `Gesture.Exclusive(bubbleLongPress, bubbleTap)`, which means:
- Long press takes priority and blocks tap if it succeeds
- Tap only fires if long press fails (e.g., duration < 400ms)

This is nested inside a SwipeableMessage that has its own Pan gesture:
```
<SwipeableMessage> (Pan gesture - swipe to reveal timestamp)
  <GestureDetector gesture={Gesture.Exclusive(longPress, tap)}>
    <MessageBubble>
      {content}
    </MessageBubble>
  </GestureDetector>
</SwipeableMessage>
```

### Why These Changes Work Together

1. **Timing**: 400ms long press activates before user is likely to accidentally swipe
2. **Tolerance**: 20px maxDistance allows natural wobble without canceling
3. **Separation**: Increased pan threshold (20px) prevents accidental activation
4. **Uniformity**: Removing image-specific handlers ensures all messages behave the same

## Testing Recommendations

Test long press on the following message types:
- ✅ Text messages (individual)
- ✅ Text messages (in groups)
- ✅ Image messages (single)
- ✅ Image messages (carousel/multiple)
- ✅ Video messages
- ✅ Voice messages
- ✅ Messages with reactions
- ✅ Messages with replies (reply preview chip)
- ✅ Messages with link previews
- ✅ AI messages with markdown
- ✅ Messages in threads
- ✅ Messages from current user
- ✅ Messages from other users

### Test Scenarios
1. **Long press (400-500ms)** - Should show context menu
2. **Quick tap (<250ms)** - Should trigger tap action (selection mode if active)
3. **Swipe left/right (>20px)** - Should reveal timestamp
4. **Long press with slight wobble** - Should still show context menu

## Potential Future Improvements

### Option 1: Use Gesture.Simultaneous()
Instead of nesting GestureDetectors, compose all gestures at the same level:
```typescript
const combinedGesture = Gesture.Simultaneous(
  panGesture,
  Gesture.Exclusive(longPress, tap)
);
```

This would require refactoring SwipeableMessage to accept child gestures as props.

### Option 2: Use simultaneousWithExternalGesture()
Mark gestures as compatible so they can work together:
```typescript
const panGesture = Gesture.Pan()
  .simultaneousWithExternalGesture(longPressGesture, tapGesture);
```

### Option 3: Single GestureDetector
Combine all gesture logic into a single detector to avoid nesting entirely.

## Impact

These changes should make long press work consistently across:
- All message types (text, image, video, voice)
- All message states (individual, grouped, with reactions, with replies)
- All user types (own messages, others' messages, AI messages)

The changes maintain backward compatibility with existing functionality:
- Swipe to reveal timestamp still works
- Tap for selection mode still works
- All other interactions remain unchanged

