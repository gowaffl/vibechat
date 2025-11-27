# Onboarding Navigation Fix

## Issue
When a user completed onboarding (uploading photo or skipping), the app would navigate to the `ChatList` screen directly instead of `MainTabs`.

## Symptoms
1. Empty state shown correctly on Chat List.
2. Bottom tab navigation missing.
3. "Create Chat" button and other interactions unresponsive.
4. Restarting the app fixed the issue.

## Root Cause
The `OnboardingPhotoScreen` was using `navigation.replace("ChatList")`.
- `ChatList` exists as a standalone screen in `RootStack` (without the tab bar wrapper).
- `MainTabs` is the screen that contains `TabNavigator` which renders the `CustomTabBar`.
- The "Create Chat" button navigates to `CreateChat` route, which only exists in `TabParamList` (child of `MainTabs`), not in `RootStack`. So navigating to it from the standalone `ChatList` failed.

## Fix
Updated `src/screens/OnboardingPhotoScreen.tsx` to navigate to `MainTabs` instead of `ChatList` upon completion.

```typescript
// Before
navigation.replace("ChatList", undefined);

// After
navigation.replace("MainTabs");
```

This ensures the user lands in the correct navigation context with the tab bar and access to all tab routes.

