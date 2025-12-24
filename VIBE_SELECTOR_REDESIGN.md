# VibeSelector Redesign Implementation

## Overview
Redesigned the VibeSelector menu to be a "fan out" interaction triggered by long-pressing the Send button.

## Changes
- **Component:** `src/components/VibeSelector.tsx`
- **Interaction:**
  - **Trigger:** Long press Send button (handled in `ChatScreen`).
  - **Animation:** Dots fan out in an arc (approx -180° to -80°) from the Send button.
  - **Selection:** Drag thumb to hover over dots.
  - **Feedback:** Selected dot scales up; Label fades in above the dot.
  - **Action:** Release to send with selected vibe.

## key Features
- **Distinct Dots:** Replaced list view with 7 absolute positioned colored dots.
- **Fan Animation:** Uses `react-native-reanimated` to interpolate positions from anchor to arc.
- **Dynamic Labels:** Labels appear only when hovering, positioned above the dot to remain visible above keyboard.
- **Haptics:** Added haptic feedback on open, selection change, and confirm.

## Technical Details
- Preserved `VibeSelectorStatic` mechanism to bridge gestures from `ChatScreen`.
- Uses `measureInWindow` from `ChatScreen` to anchor the fan to the Send button.
- Logic ensures dots and labels are rendered within the screen area above the input.

