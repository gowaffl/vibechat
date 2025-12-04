I have corrected the spacing logic to properly handle the inverted list structure.

### Spacing Correction
The previous logic incorrectly set `margin-bottom` based on the *older* message (visually above), which caused the gap to appear in the wrong place (between grouped messages instead of after the group).

**Corrected Logic**:
- We now check `isSameUserAsNewer` (the message visually *below*).
- **If SAME**: We are in the middle of a group -> `mb-0.5` (Tight spacing to pull the next message up).
- **If DIFFERENT**: We are at the end of a group -> `mb-3` (Standard gap to separate from the next user's message).

This ensures:
1.  **Grouped Messages**: Sit close together (2px).
2.  **Group Ends**: Have a proper gap (12px) before the next user's message starts.

This logic now correctly respects the inverted rendering order of the chat list.
