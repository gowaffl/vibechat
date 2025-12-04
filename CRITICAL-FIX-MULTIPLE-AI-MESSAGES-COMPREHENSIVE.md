The user requested a fix for the message grouping logic in `ChatScreen.tsx`.

### Issue
Previously, the logic for determining if consecutive messages were from the same sender only relied on `userId`. Since all AI messages have `userId: null`, consecutive messages from *different* AI friends were being grouped together as if they were from the same person. This caused:
- Missing avatars for the second AI friend.
- Missing name headers for the second AI friend.
- Visual confusion about who sent which message.

### Fix Implemented
I updated the `isSameUserAsOlder` and `isSameUserAsNewer` logic in `src/screens/ChatScreen.tsx` to perform a deeper equality check:

```typescript
const isSameSender = 
  (prevMessage.userId === message.userId) && 
  (prevMessage.userId !== null || prevMessage.aiFriendId === message.aiFriendId);
```

Now:
1. **User vs User**: Compared by `userId`.
2. **User vs AI**: `userId` differs (one is string, one is null), so they are not grouped.
3. **AI vs AI**: `userId` matches (both null), so we check `aiFriendId`. If different, they are not grouped.

This ensures accurate visual grouping for all message types.