# Mention Shimmer Implementation

## Overview
Implemented a shimmering effect for user mentions in chat messages to improve visibility and aesthetics.

## Changes
1. **New Component: `ShimmeringText`**
   - Located at `src/components/ShimmeringText.tsx`.
   - Uses `MaskedView` to mask a moving gradient over the text.
   - Uses `react-native-reanimated` for smooth, infinite animation.
   - Supports custom styles and shimmer colors.

2. **Update: `MessageText`**
   - Located at `src/components/MessageText.tsx`.
   - Replaced the plain `Text` rendering for mentions with `ShimmeringText`.
   - Maintained existing badge styling (background color, border radius) by moving it to the wrapping `Pressable`.
   - Ensured mention text is bold (`fontWeight: "700"`) as requested.

## Usage
When a user is mentioned (e.g., `@User`), the name will appear bold with a subtle white shimmer animation moving across it. The mention uses the user's assigned color or a default accent color.

## Dependencies
- `@react-native-masked-view/masked-view`
- `expo-linear-gradient`
- `react-native-reanimated`
