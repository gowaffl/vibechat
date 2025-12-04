The message grouping logic has been updated to correctly distinguish between different AI friends.

### Fix Details:
1.  **Enhanced Comparison Logic**: The `isSameUserAsOlder` and `isSameUserAsNewer` checks now include a specific condition for AI messages.
2.  **AI Friend Differentiation**: When comparing two messages where `userId` is null (indicating AI), we now strictly compare `aiFriendId`. This prevents messages from different AI personas from being visually grouped together.
3.  **Consistent UI**: This ensures that when different AI friends send consecutive messages, they each get their own avatar and name header, maintaining clear attribution.

Verified that `null === null` no longer causes incorrect grouping for AI messages.