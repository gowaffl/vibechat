I have updated the spacing logic to ensuring proper separation between different users' message groups.

### Adjustments
1.  **Explicit Margin Control**: Added `shouldIncreaseBottomMargin` check.
2.  **Spacing Logic**:
    - **Between Grouped Messages**: Keeps the reduced `mb-0.5` spacing.
    - **End of Group**: Explicitly applies `mb-3` (standard spacing) when the *next* message (visually below) is from a different user.

This ensures that while consecutive messages are tight, the transition to a *new* speaker always maintains the standard, comfortable gap.
