# Vibe Call Banner Implementation

## Overview
Implemented a clean, minimal, and premium active call banner that displays when there's an ongoing vibe call in a chat. The banner fits seamlessly with the existing design system and provides a non-intrusive way to notify users about active calls.

## What Was Added

### 1. VoiceRoomBanner Component
**Location**: `src/components/VoiceRoom/VoiceRoomBanner.tsx`

A premium glass-morphic banner component that displays:
- Animated pulse indicator (subtle, premium feel)
- Phone icon with gradient background
- Participant count
- "Join" button (when user is not in the call)
- Different state for when user is already in the call

**Design Features**:
- Uses `BlurView` for glass morphism effect
- `LinearGradient` with theme-appropriate colors (#4FC3F7 primary)
- Subtle pulse animation using Reanimated
- Haptic feedback on press
- Respects light/dark theme
- Shadows and borders matching the design system

### 2. ChatScreen Integration
**Location**: `src/screens/ChatScreen.tsx`

**Changes**:
- Imported `VoiceRoomBanner` component
- Positioned banner below thread pills (or below header if no threads)
- Banner appears at `top: insets.top + 85 + (threads ? 56 : 0)`
- `zIndex: 98` (below threads at 99, above messages)
- Only shows when `activeRoom` exists and `voiceModalVisible` is false
- Adjusted message list padding to account for banner height (+56px)

### 3. Polling Enabled
**Location**: `src/hooks/useVoiceRoom.ts`

**Changes**:
- Re-enabled 30-second polling for active room status
- Users will automatically see the banner appear when someone starts a call
- Polling happens on screen focus + every 30 seconds

### 4. Schema Documentation
**Location**: `current_supabase_schema.sql`

**Changes**:
- Added `voice_room` table documentation
- Added `voice_participant` table documentation
- Added indexes for performance
- Fully documents the vibe call database structure

## How It Works

### User Experience Flow

1. **User A starts a vibe call**:
   - Clicks vibe call button → Creates room → Joins call
   - Voice modal opens for User A

2. **User B (in same chat)**:
   - Within 30 seconds (or on screen focus), banner appears
   - Banner shows: "🎙️ Vibe Call - X people"
   - Clicks banner → Joins the SAME room as User A
   - Voice modal opens for User B

3. **When in call**:
   - Banner shows "Vibe Call Active" instead of join button
   - User sees they're already connected

4. **When call ends**:
   - Banner disappears for all users
   - Polling detects room is no longer active

### Technical Details

**Banner Positioning**:
```
┌─────────────────────────────┐
│      Chat Header (68px)     │
├─────────────────────────────┤
│   Thread Pills (56px)       │ ← If threads exist
├─────────────────────────────┤
│   Voice Banner (56px)       │ ← NEW! Only when active call
├─────────────────────────────┤
│                             │
│      Messages List          │
│                             │
└─────────────────────────────┘
```

**State Management**:
- `activeRoom`: Voice room object (null if no active call)
- `participants`: Number of current participants
- `voiceToken`: Present when user has joined
- `voiceModalVisible`: True when voice UI is open

## Design Specifications

### Colors
- **Primary**: `#4FC3F7` (Brand cyan/teal)
- **Dark Mode**:
  - Gradient: `rgba(79, 195, 247, 0.12)` → `rgba(79, 195, 247, 0.06)`
  - Border: `rgba(79, 195, 247, 0.2)`
  - Blur intensity: 60
- **Light Mode**:
  - Gradient: `rgba(79, 195, 247, 0.15)` → `rgba(79, 195, 247, 0.08)`
  - Border: `rgba(79, 195, 247, 0.2)`
  - Blur intensity: 40

### Dimensions
- Height: 56px (including padding)
- Border radius: 16px
- Padding: 14px horizontal, 10px vertical
- Icon size: 28px circle with 14px phone icon
- Pulse ring: 32px

### Animation
- Pulse duration: 1200ms in, 1200ms out
- Scale range: 1.0 → 1.15
- Easing: `Easing.inOut(Easing.ease)`
- Continuous repeat

## Files Modified

1. ✅ `src/components/VoiceRoom/VoiceRoomBanner.tsx` (NEW)
2. ✅ `src/components/VoiceRoom/index.ts` (NEW)
3. ✅ `src/screens/ChatScreen.tsx` (Updated imports + banner placement)
4. ✅ `src/hooks/useVoiceRoom.ts` (Enabled polling)
5. ✅ `current_supabase_schema.sql` (Added voice room tables)

## Testing Checklist

- [ ] Banner appears when another user starts a call
- [ ] Banner shows correct participant count
- [ ] Clicking banner joins the existing room
- [ ] Banner shows "Active" state when user is in call
- [ ] Banner disappears when call ends
- [ ] Banner doesn't obstruct messages
- [ ] Banner works in both light and dark mode
- [ ] Pulse animation is smooth and subtle
- [ ] Haptic feedback works on press
- [ ] Banner position adjusts correctly with/without threads

## Future Enhancements

Potential additions (not implemented yet):

1. **Push Notifications**: Send notification when call starts
2. **System Message**: Post in chat when call begins/ends
3. **Participant Avatars**: Show small avatar bubbles in banner
4. **Live Audio Indicators**: Show who's currently speaking
5. **Call Duration**: Display how long call has been active
6. **Quick Preview**: Long-press to preview who's in the call

## Notes

- The banner uses the same design language as other premium components (ImageGeneratorSheet, LiquidGlassCard)
- Positioning is carefully calculated to not interfere with existing UI elements
- Polling interval of 30 seconds balances responsiveness with battery/network usage
- The banner automatically hides when voice modal is open (no redundancy)

