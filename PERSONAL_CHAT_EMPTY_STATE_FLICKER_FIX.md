# Personal Chat Empty State Flicker Fix

## Issue
When starting a new conversation in Personal Chat and typing into the message input, the empty state (VibeChat icon and "Start a Conversation" text) would flash/flicker with each keystroke. This created a jarring user experience.

## Root Cause
The `EmptyState` component was defined as a regular function component inside the main `PersonalChatScreen` component. This meant:

1. On every keystroke, `inputText` state changes
2. The entire `PersonalChatScreen` component re-renders
3. The `EmptyState` function is recreated from scratch
4. React potentially unmounts and remounts the component, causing visible flicker
5. The conditional check `messagesWithDividers.length === 0 && !streaming.isStreaming` was re-evaluated on every render

## Solution
Applied React performance optimizations using `useMemo`:

### 1. Memoized the Empty State Condition
```typescript
// Memoize whether to show empty state - prevents flicker on keystroke
const shouldShowEmptyState = useMemo(
  () => messagesWithDividers.length === 0 && !streaming.isStreaming,
  [messagesWithDividers.length, streaming.isStreaming]
);
```

This ensures the condition is only recalculated when the actual values change (new messages arrive or streaming starts/stops), not on every keystroke.

### 2. Memoized the Empty State Component
```typescript
// Empty state component - positioned towards top for keyboard visibility
// Memoized to prevent recreation on every keystroke
const emptyStateComponent = useMemo(() => (
  <View style={styles.emptyStateContainer}>
    <View style={styles.emptyStateContent}>
      <View style={[styles.emptyStateIcon, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }]}>
        <Image
          source={require("../../assets/vibechat icon main.png")}
          style={{ width: 56, height: 56, borderRadius: 28 }}
          contentFit="cover"
        />
      </View>
      <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
        {selectedAgent ? `Chat with ${selectedAgent.name}` : "Start a Conversation"}
      </Text>
      <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
        {selectedAgent
          ? selectedAgent.personality || "Your AI companion is ready to chat"
          : "Select an agent or start typing to begin"}
      </Text>
    </View>
  </View>
), [selectedAgent, colors.text, colors.textSecondary, isDark]);
```

This memoizes the entire component tree, only recreating it when dependencies change (agent selection, theme colors, or dark mode toggle).

### 3. Updated the Render Logic
```typescript
{/* Messages List */}
<View style={styles.messagesContainer}>
  {shouldShowEmptyState ? (
    emptyStateComponent
  ) : (
    <FlashList
      // ... FlashList props
    />
  )}
</View>
```

## Benefits

1. **No More Flicker**: The empty state remains stable while typing
2. **Better Performance**: React doesn't need to recreate the component on every keystroke
3. **Smoother UX**: Users can type freely without visual distractions
4. **Optimized Re-renders**: Component only updates when necessary (agent changes, theme changes, etc.)

## Testing

To verify the fix:
1. Open Personal Chat
2. Start a new conversation (no messages)
3. Begin typing in the message input
4. The VibeChat icon and "Start a Conversation" text should remain stable (no flicker)
5. The input should respond smoothly to each keystroke

## Files Changed

- `src/screens/PersonalChatScreen.tsx`
  - Added `shouldShowEmptyState` memoized variable
  - Converted `EmptyState` function to `emptyStateComponent` with `useMemo`
  - Updated conditional render to use memoized values

## Related Performance Patterns

This same pattern can be applied to other components that might flicker during typing:
- Chat empty states
- Search result lists
- Dynamic UI elements that change based on input

## Technical Notes

### Why useMemo Instead of React.memo?
- `useMemo` is used for memoizing JSX/render output
- `React.memo` is for memoizing entire component functions
- Since this was inline JSX, `useMemo` is the appropriate choice

### Dependency Array
The dependencies (`[selectedAgent, colors.text, colors.textSecondary, isDark]`) ensure:
- Updates when user selects a different agent
- Updates when theme colors change
- Updates when dark/light mode toggles
- Doesn't update on unrelated state changes (like `inputText`)
