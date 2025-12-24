# Translation Loading States

## Overview

Added loading states for message translations to improve UX and eliminate the flash of original content before translated content appears.

## Problem

Previously, when translating messages:
1. **Batch translation**: No indication that translation was happening - messages just appeared suddenly in the target language
2. **New messages**: Original content would flash for 2-3 seconds, then suddenly switch to translated content
3. **User confusion**: No visual feedback that translation was in progress

## Solution

### 1. **Per-Message Loading State**

Each message being translated now shows a shimmer animation instead of the original content.

**State Management**:
```typescript
const [translatingMessages, setTranslatingMessages] = useState<Set<string>>(new Set());
```

**Message Rendering**:
```typescript
{translationEnabled && translatingMessages.has(message.id) ? (
  <ShimmeringText 
    text="Translating..." 
    style={{ fontSize: 15, color: colors.textSecondary, fontStyle: 'italic' }}
  />
) : (
  <MessageText
    content={translationEnabled && translatedMessages[message.id] 
      ? translatedMessages[message.id]! 
      : message.content}
    ...
  />
)}
```

### 2. **Batch Translation Banner**

When translating multiple messages (e.g., when opening a chat), a banner appears below the chat header.

**State Management**:
```typescript
const [isBatchTranslating, setIsBatchTranslating] = useState(false);
```

**Banner Component**:
```tsx
{isBatchTranslating && (
  <Reanimated.View
    entering={FadeInUp}
    exiting={FadeOut}
    style={{
      position: "absolute",
      top: insets.top + 70,
      backgroundColor: isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)",
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    }}
  >
    <ActivityIndicator size="small" color={colors.primary} />
    <ShimmeringText 
      text="Translating messages..." 
      style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}
    />
  </Reanimated.View>
)}
```

## Implementation Details

### Batch Translation Function

```typescript
const translateVisibleMessages = useCallback(async (messagesToTranslate: Message[], forceRetranslate: boolean = false) => {
  // ... filtering logic ...
  
  // Set lock and loading states
  translationInProgressRef.current = true;
  setIsBatchTranslating(true);
  
  // Mark all messages as translating
  const messageIds = textMessages.map((m) => m.id);
  setTranslatingMessages(prev => {
    const newSet = new Set(prev);
    messageIds.forEach(id => newSet.add(id));
    return newSet;
  });
  
  try {
    // Call batch translation API
    const response = await api.post("/api/ai-native/translate-batch", {
      userId: user?.id,
      messageIds: messageIds,
      targetLanguage: currentLanguage,
    });
    
    // Update translated messages
    if (translations) {
      setTranslatedMessages(prev => ({ ...prev, ...translations }));
      setTranslationVersion(v => v + 1);
    }
  } finally {
    // Release lock and clear loading states
    translationInProgressRef.current = false;
    setIsBatchTranslating(false);
    
    // Remove translated messages from translating set
    setTranslatingMessages(prev => {
      const newSet = new Set(prev);
      textMessages.forEach(m => newSet.delete(m.id));
      return newSet;
    });
  }
}, [user?.id]);
```

### Single Message Translation

```typescript
const translateSingleMessage = async (messageToTranslate: Message) => {
  // ... validation ...
  
  // Mark message as translating
  setTranslatingMessages(prev => new Set(prev).add(messageToTranslate.id));
  
  try {
    const response = await api.post("/api/ai-native/translate", {
      userId: user?.id,
      messageId: messageToTranslate.id,
      targetLanguage: currentLanguage,
    });
    
    if (translatedText) {
      setTranslatedMessages(prev => ({
        ...prev,
        [messageToTranslate.id]: translatedText
      }));
      setTranslationVersion(v => v + 1);
    }
  } finally {
    // Remove message from translating set
    setTranslatingMessages(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageToTranslate.id);
      return newSet;
    });
  }
};
```

## User Experience Flow

### Opening a Chat with Translation Enabled

1. User opens chat
2. **Banner appears**: "Translating messages..." (with shimmer animation)
3. **Individual messages**: Show "Translating..." shimmer instead of original text
4. **API completes**: Banner fades out, messages smoothly transition to translated content
5. **No flash**: Original content never displayed

### New Message Arrives

1. New message received via Supabase Realtime
2. **Message bubble shows**: "Translating..." (shimmer animation)
3. **Translation API call**: Happens in background
4. **Completion**: Message smoothly transitions from shimmer to translated content
5. **No flash**: Original content never displayed

### Switching Language

1. User selects new language from dropdown
2. **Banner appears**: "Translating messages..."
3. **All message bubbles**: Show "Translating..." shimmer
4. **Batch translation**: Re-translates all visible messages
5. **Completion**: Banner disappears, messages show new language

## Visual Design

### Shimmer Animation
- **Component**: `ShimmeringText` (existing component)
- **Text**: "Translating..."
- **Style**: Italic, secondary text color
- **Animation**: Smooth gradient sweep from left to right

### Banner
- **Position**: Below chat header, above messages
- **Background**: Primary color with low opacity (theme-aware)
- **Border**: Bottom border with primary color
- **Icon**: `ActivityIndicator` (spinning)
- **Animation**: Slide down on appear, fade out on dismiss

## Edge Cases Handled

1. **Multiple concurrent translations**: Lock mechanism prevents duplicate API calls
2. **Navigation during translation**: Loading states cleared on unmount
3. **Translation errors**: Shimmer removed, shows original content
4. **Empty messages**: Not marked as translating
5. **Already translated**: Not re-translated unless forced

## Performance Considerations

- **Set for tracking**: Efficient O(1) lookup for `translatingMessages.has(id)`
- **Batch updates**: Single state update for all messages in batch
- **Cleanup in finally**: Always removes loading states, even on error
- **Version counter**: Forces FlashList re-render only when translations complete

## Files Modified

- **src/screens/ChatScreen.tsx**:
  - Added `translatingMessages` state (Set)
  - Added `isBatchTranslating` state (boolean)
  - Updated `translateVisibleMessages` to set loading states
  - Updated `translateSingleMessage` to set loading states
  - Updated message rendering to show shimmer when translating
  - Added batch translation banner below chat header

## Testing

1. **Batch translation**:
   - Open a chat with translation enabled
   - Verify banner appears
   - Verify message bubbles show "Translating..." shimmer
   - Verify smooth transition to translated content

2. **New messages**:
   - Have translation enabled
   - Receive a new message
   - Verify shimmer appears immediately
   - Verify smooth transition to translated content
   - Verify no flash of original content

3. **Language switch**:
   - Select a different language
   - Verify banner appears
   - Verify all messages show shimmer
   - Verify smooth transition to new language

4. **Error handling**:
   - Disconnect network
   - Trigger translation
   - Verify shimmer eventually clears
   - Verify original content shown

## Related Files

- **TRANSLATION_BACKEND_FIX.md**: Backend endpoints for translation
- **TRANSLATION_CHOOSE_LANGUAGE_UX.md**: "Choose Language" UX improvement
- **TRANSLATION_CANCELLATION_FIX.md**: API cancellation handling
- **TRANSLATION_FIX_SUMMARY.md**: Initial translation implementation

## Next Steps

The translation feature is now complete with:
- ✅ Per-user, per-chat settings
- ✅ Real-time translation of new messages
- ✅ Batch translation of visible messages
- ✅ "Choose Language" UX
- ✅ **Loading states with shimmer animation** (NEW)
- ✅ **Batch translation banner** (NEW)
- ✅ **No flash of original content** (NEW)

