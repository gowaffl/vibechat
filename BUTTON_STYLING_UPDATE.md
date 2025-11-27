# Button Styling Update

## Overview
Updated all primary action buttons across the app to use the new VibeChat brand gradient:
`['#0061FF', '#00C6FF', '#00E676']` (Deep Blue -> Bright Cyan -> Neon Green)

## Changes Applied

### Global Component Updates
- **Liquid Glass Button (`src/components/LiquidGlass/LiquidGlassButton.tsx`)**
  - Updated `primary` variant to use the new brand gradient.
  - This automatically updated buttons in:
    - `CreateEventModal.tsx` (Create Event)
    - `CreateAIFriendModal.tsx` (Create AI Friend)
    - `CreateThreadModal.tsx` (Create Thread)
    - `ReactorMenu.tsx` (Remix, Meme buttons)
    - `AttachmentsMenu.tsx` (Remix, Meme buttons)
    - `CatchUpModal.tsx` (Got it button)

### Screen-Specific Updates
- **Welcome Screen**: "Agree & Continue" button
- **Phone Auth Screen**: "Next/Verify" button
- **Birthdate Screen**: "Continue" button
- **Onboarding Name Screen**: "Continue" button
- **Onboarding Photo Screen**: "Take Photo", "Looks Good!" buttons
- **Chat Screen**: "Create AI Friend" button
- **Profile Screen**: "Save Changes" button
- **Create Chat Screen**: "Create Chat" button
- **Join Chat Screen**: "Join Chat" button
- **Invite Screen**: "Go to Chats", "Join Chat" buttons
- **Invite Members Screen**: Floating "Invite" button
- **Threads Panel**: Floating "Plus" button
- **Custom Commands Modal**: "Create Command" button
- **Add To Calendar**: "Add to Calendar" button

## Notes
- Feature-specific semantic gradients (e.g., Orange for CatchUp, Red for Delete, Green for Finalize) were preserved to maintain feature identity and semantic meaning.
- Tab bar styling was left as is (Light Blue) as it is not a button.
- Background gradients and overlay gradients were left as is.

