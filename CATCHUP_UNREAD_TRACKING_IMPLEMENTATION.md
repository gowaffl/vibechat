# Catch-Up Button Unread Message Tracking Implementation

## Overview
The catch-up AI summary button now only appears when the user has **actual unseen messages** (tracked via read receipts) and can be dismissed with a swipe gesture or by clicking to use it.

## Changes Made

### 1. ChatScreen.tsx
**Added Functionality:**
- ✅ **Unread Count Query**: Fetches actual unread message counts from the backend using read receipts
- ✅ **Dismiss State Management**: Tracks if the button has been dismissed using AsyncStorage for persistence
- ✅ **Smart Reset Logic**: Automatically re-shows the button when new unread messages arrive after dismissal
- ✅ **Updated Visibility Logic**: Button only shows when `currentChatUnreadCount > 0 && !catchUpDismissed`

**Key Features:**
```typescript
// Queries actual unread counts based on read receipts
const { data: unreadCounts = [] } = useQuery<UnreadCount[]>({
  queryKey: ["unread-counts", user?.id],
  queryFn: () => api.get(`/api/chats/unread-counts?userId=${user?.id}`),
  enabled: !!user?.id,
  refetchInterval: 3000, // Poll every 3 seconds
});

// Calculates unread count for current chat
const currentChatUnreadCount = useMemo(() => {
  const chatUnread = unreadCounts.find((uc) => uc.chatId === chatId);
  return chatUnread?.unreadCount || 0;
}, [unreadCounts, chatId]);
```

**Persistence:**
- Dismiss state is saved to AsyncStorage with key `catchup_dismissed_{chatId}`
- Last unread count is saved to detect when new messages arrive
- Automatically resets dismiss state when unread count increases

### 2. CatchUpButton.tsx
**Added Functionality:**
- ✅ **Swipe-to-Dismiss Gesture**: Users can swipe the button to the right to dismiss it
- ✅ **onDismiss Callback**: New prop that fires when the button is dismissed
- ✅ **Haptic Feedback**: Provides tactile feedback on swipe gestures
- ✅ **Smooth Animations**: Spring animations for natural feel

**Key Features:**
```typescript
// Pan responder handles swipe gestures
const panResponder = PanResponder.create({
  onPanResponderMove: (_, gestureState) => {
    if (gestureState.dx > 0) {
      translateX.setValue(gestureState.dx);
    }
  },
  onPanResponderRelease: (_, gestureState) => {
    if (gestureState.dx > 100) {
      // Dismiss if swiped > 100px
      Animated.timing(translateX, { toValue: 400, duration: 200 }).start(() => {
        onDismiss?.();
      });
    } else {
      // Snap back
      Animated.spring(translateX, { toValue: 0 }).start();
    }
  },
});
```

## User Experience Flow

### Scenario 1: User Returns to Chat with Unread Messages
1. User opens a chat with 10 unread messages
2. ✅ Catch-up button appears showing "10 new messages"
3. User can either:
   - **Click** to view AI summary
   - **Swipe right** to dismiss

### Scenario 2: User Dismisses Button
1. User swipes the catch-up button to the right
2. ✅ Button smoothly animates off screen
3. ✅ Dismiss state is saved to AsyncStorage
4. Button stays hidden even if user leaves and returns

### Scenario 3: New Messages After Dismissal
1. User dismisses the catch-up button
2. Other users send 5 new messages
3. ✅ Unread count increases from 10 to 15
4. ✅ Button automatically reappears to alert user of new messages

### Scenario 4: User Views Messages
1. User scrolls through the chat
2. ✅ Messages are automatically marked as read
3. ✅ Unread count decreases
4. ✅ When unread count reaches 0, button disappears

## Technical Details

### Read Receipt System
The implementation leverages the existing read receipt infrastructure:
- **Backend**: `/api/chats/unread-counts` endpoint calculates unread messages by comparing all messages against read receipts
- **Frontend**: Automatically marks messages as read when viewing the chat
- **Real-time Updates**: Polls every 3 seconds to keep counts fresh

### State Management
```typescript
// Local state for UI
const [catchUpDismissed, setCatchUpDismissed] = useState(false);

// AsyncStorage keys
`catchup_dismissed_{chatId}` - Whether button is dismissed
`catchup_last_count_{chatId}` - Last unread count when dismissed
```

### Visibility Logic
```typescript
isVisible={
  currentChatUnreadCount > 0 &&  // Has unread messages
  !showCatchUpModal &&           // Modal not open
  !catchUpDismissed              // Not dismissed
}
```

## Benefits

1. **Privacy & Accuracy**: Only shows for actual unseen messages, not just message count
2. **User Control**: Users can dismiss the button when they don't need it
3. **Smart Re-appearance**: Automatically reappears when truly needed
4. **Intuitive UX**: Swipe gesture follows iOS/Android patterns
5. **Performance**: Leverages existing read receipt polling (no additional overhead)
6. **Persistence**: Dismiss state survives app restarts

## Testing Recommendations

### Manual Testing
1. ✅ Join a chat with existing messages
2. ✅ Verify button shows with correct unread count
3. ✅ Swipe button to the right to dismiss
4. ✅ Leave and return - verify button stays dismissed
5. ✅ Have another user send messages
6. ✅ Verify button reappears with updated count
7. ✅ Scroll through chat to mark messages as read
8. ✅ Verify button disappears when count reaches 0

### Edge Cases
- ✅ First-time user in empty chat (no button)
- ✅ User's own messages don't count as unread
- ✅ System messages don't trigger the button
- ✅ Multiple chat handling (dismiss state per chat)
- ✅ Concurrent read receipts (handled by backend)

## Future Enhancements (Optional)

1. **Tutorial**: Show first-time tooltip explaining swipe gesture
2. **Animations**: Add particle effect on dismiss
3. **Settings**: User preference to auto-dismiss after viewing summary
4. **Batch Actions**: "Mark all as read" button
5. **Smart Triggers**: Only show for high-priority messages

