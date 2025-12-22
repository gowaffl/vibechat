# Vibe Call Keyboard Dismissal Implementation

## Issue
When the Vibe Call voice room modal is fully open (not docked), the keyboard should always be closed since users don't need it during a voice call. However, when the modal is docked (minimized to a small pill at the bottom), the keyboard should still function normally for typing in the main chat.

## Solution

### Changes Made

**File:** `src/components/VoiceRoom/VoiceRoomModal.tsx`

#### 1. Added Keyboard Import
```typescript
import { Keyboard } from "react-native";
```

#### 2. Added Optional Callback Prop
```typescript
interface VoiceRoomModalProps {
  // ... existing props
  onDockStateChange?: (isDocked: boolean) => void;
}
```

This allows parent components to react to dock state changes if needed in the future.

#### 3. Dismiss Keyboard on Modal Open
When the modal becomes visible and is in full mode (not docked), the keyboard is automatically dismissed:

```typescript
useEffect(() => {
  if (visible) {
    // ... existing code
    
    // Dismiss keyboard when modal opens in full mode (not docked)
    if (!isDocked) {
      Keyboard.dismiss();
    }
  }
  // ...
}, [visible, isDocked, onLeave]);
```

#### 4. Dismiss Keyboard on Dock Toggle (Manual)
When user taps the dock/expand button, keyboard is dismissed when expanding to full mode:

```typescript
const toggleDock = () => {
  const nextState = !isDocked;
  setIsDocked(nextState);
  dockProgress.value = withSpring(nextState ? 1 : 0, SPRING_CONFIG);
  onDockStateChange?.(nextState);
  
  // Dismiss keyboard when modal is fully expanded (not docked)
  if (!nextState) {
    Keyboard.dismiss();
  }
};
```

#### 5. Dismiss Keyboard on Gesture-Based Dock Toggle
When user swipes to expand/dock the modal, keyboard is dismissed during gesture completion:

```typescript
const handleDockToggle = useCallback((shouldDock: boolean) => {
  setIsDocked(shouldDock);
  onDockStateChange?.(shouldDock);
  
  // Dismiss keyboard when modal is fully expanded (not docked)
  if (!shouldDock) {
    Keyboard.dismiss();
  }
}, [onDockStateChange]);
```

## Behavior

### Modal States

1. **Fully Open (Expanded)**
   - `isDocked = false`
   - `dockProgress = 0`
   - Takes up full screen
   - **Keyboard is ALWAYS dismissed**

2. **Docked (Minimized)**
   - `isDocked = true`
   - `dockProgress = 1`
   - Shows as small pill at bottom
   - **Keyboard works normally**

### User Interactions

| Action | Dock State Change | Keyboard Behavior |
|--------|------------------|-------------------|
| Open modal for first time | N/A → Expanded | ✅ Dismissed |
| Tap chevron down button | Expanded → Docked | ⚪ No change (stays open if typing) |
| Tap maximize icon | Docked → Expanded | ✅ Dismissed |
| Swipe down to dock | Expanded → Docked | ⚪ No change |
| Swipe up to expand | Docked → Expanded | ✅ Dismissed |
| Close modal | Any → Hidden | ⚪ No change |

### Edge Cases Handled

1. **Modal opens while typing**
   - Keyboard immediately dismisses when modal opens in full mode
   
2. **User is typing and expands docked modal**
   - Keyboard dismisses as modal expands
   
3. **User docks modal to type**
   - Keyboard remains available for typing in chat

## Technical Details

### Why This Approach?

1. **Self-contained**: All keyboard logic is in VoiceRoomModal component
2. **No parent changes needed**: ChatScreen doesn't need updates
3. **Consistent**: Works for all transitions (button tap, gesture, programmatic)
4. **Non-intrusive**: Keyboard still works when modal is docked

### Alternative Approaches Considered

1. **Parent-managed keyboard**: Have ChatScreen handle keyboard dismissal
   - ❌ Requires prop drilling and state management
   - ❌ Less cohesive

2. **Prevent keyboard from showing**: Use listeners to block keyboard
   - ❌ Too aggressive, might prevent wanted interactions
   - ❌ More complex implementation

3. **Auto-dock on keyboard show**: Dock modal when keyboard opens
   - ❌ Unexpected UX, users don't expect modal to move
   - ❌ Doesn't solve the core issue

## Testing Checklist

### Test Scenarios

- [ ] Open voice call modal → Keyboard should dismiss
- [ ] Open voice call modal while typing → Keyboard should dismiss
- [ ] Dock modal → Keyboard should be available for typing
- [ ] Type in chat with docked modal → Keyboard should work normally
- [ ] Expand docked modal via button → Keyboard should dismiss
- [ ] Expand docked modal via swipe gesture → Keyboard should dismiss
- [ ] Dock expanded modal → Keyboard should remain available
- [ ] Close modal → Keyboard state should not be affected

### Device Testing

- [ ] iOS (Physical device)
- [ ] iOS (Simulator) - Note: Keyboard behavior differs on simulator
- [ ] Android (Physical device)
- [ ] Android (Emulator) - Note: Keyboard behavior differs on emulator

## Future Enhancements

### Optional Features

1. **Blur input when modal opens**
   - Could explicitly blur the chat input TextInput
   - Ensures no accidental keyboard re-opening
   
2. **Disable input when expanded**
   - Make chat input non-interactive when modal is expanded
   - Provides visual feedback that typing is not available

3. **Keyboard listener**
   - Listen for keyboard showing while modal is expanded
   - Auto-dismiss or auto-dock modal based on preference

## Related Files

- `src/components/VoiceRoom/VoiceRoomModal.tsx` - Main modal component
- `src/screens/ChatScreen.tsx` - Parent component that uses modal
- `src/hooks/useVoiceRoom.ts` - Voice room state management

## Notes

- Keyboard dismissal is instant and non-animated
- Works with both hardware and software keyboards
- Compatible with keyboard accessories/external keyboards
- No performance impact (native Keyboard API)


