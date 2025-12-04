I have implemented the message grouping feature with the following characteristics:

### Core Functionality
1.  **Consecutive Message Grouping**: Messages sent back-to-back by the same user (or same AI friend) are now visually grouped.
2.  **Reduced Spacing**: The margin between grouped messages is reduced to `2px` (mb-0.5), creating a cohesive block.
3.  **Merged Visuals**: The border radius at the connecting corners of grouped messages is reduced to `4px`, giving the appearance of a single continuous conversation stream.

### Display Logic
1.  **Name Headers**: The user's name is only displayed above the *first* message in a group.
2.  **Avatars**: The user's profile picture is only displayed next to the *last* message in a group.
3.  **Alignment**: A placeholder view preserves alignment for messages where the avatar is hidden.

### AI Handling
1.  **Smart Grouping**: The logic correctly distinguishes between different AI friends by checking `aiFriendId` when `userId` is null.
2.  **Differentiation**: Consecutive messages from *different* AI friends are treated as separate groups, ensuring each gets its own name and avatar.

### Spacing Refinement
1.  **Group Separation**: I explicitly ensured that the last message of a group maintains standard spacing (`mb-3`) before a message from a *different* user appears. This prevents different users' messages from feeling "stuck" together.

All changes are contained within `src/screens/ChatScreen.tsx`.