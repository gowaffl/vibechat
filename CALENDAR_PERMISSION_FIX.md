# Calendar Permission Fix - CRITICAL

## ❌ The Problem
App was crashing on startup with error:
```
ExpoCalendar.MissingCalendarPListValueException error 1
```

This happened because:
1. The app was importing `expo-calendar` at module load time (before any user interaction)
2. iOS 17+ requires additional calendar permission keys in Info.plist
3. The missing `NSCalendarsWriteOnlyAccessUsageDescription` key caused the crash

## ✅ The Solution

### 1. Added Missing iOS Calendar Permission Keys

#### Updated `app.json`:
```json
"infoPlist": {
  "NSCalendarsUsageDescription": "...",
  "NSCalendarsWriteOnlyAccessUsageDescription": "VibeChat needs to add events to your calendar for group chat scheduling.",
  "NSCalendarsFullAccessUsageDescription": "...",
  "NSRemindersUsageDescription": "...",
  "NSRemindersFullAccessUsageDescription": "VibeChat needs full reminders access to create and manage tasks for your group chats."
}
```

#### Updated `ios/VibeChat/Info.plist`:
Added `NSCalendarsWriteOnlyAccessUsageDescription` key between the other calendar keys.

### 2. Fixed Calendar Module Loading Pattern

**Before (causing crash):**
```typescript
import * as Calendar from "expo-calendar";  // ❌ Loaded at app startup
```

**After (safe loading):**
```typescript
// No import at top level
const addToAppleCalendar = async () => {
  const Calendar = await import("expo-calendar");  // ✅ Only loaded when user clicks button
  // ... use Calendar
}
```

### 3. Reinstalled iOS Pods
Ran `pod install` to apply the Info.plist changes.

## 📝 Required Actions

### To Fix the Issue:
1. **Stop the current Expo server** (if running)
2. **Rebuild the iOS app** with one of these methods:

#### Option A: Using EAS Build (Recommended)
```bash
eas build --profile development --platform ios
```

#### Option B: Using Xcode
```bash
# Open the Xcode workspace
open ios/VibeChat.xcworkspace

# Then build and run from Xcode (Cmd+R)
```

#### Option C: Rebuild with Expo
```bash
# Clear cache and rebuild
npx expo run:ios --device --no-build-cache
```

### After Rebuilding:
1. Install the new build on your device
2. The calendar error should be gone
3. Calendar functionality will only activate when user taps "Add to Calendar"

## 🔍 Technical Details

### iOS Calendar Permissions (iOS 17+)
Apple now requires three different calendar permission keys:
- `NSCalendarsUsageDescription` - Basic calendar access
- `NSCalendarsWriteOnlyAccessUsageDescription` - Write-only access (NEW in iOS 17)
- `NSCalendarsFullAccessUsageDescription` - Full read/write access

### Lazy Loading Benefits
By lazy-loading `expo-calendar`:
1. App starts faster
2. Permissions only requested when needed
3. No crashes from missing plist entries at startup
4. Better user experience (permission prompt only when relevant)

## 📦 Files Modified
- `/app.json` - Added calendar permission keys
- `/ios/VibeChat/Info.plist` - Added calendar permission keys
- `/src/components/Events/AddToCalendar.tsx` - Changed to lazy-load calendar module
- `/ios/Podfile.lock` - Updated via pod install

## ✅ Status
**Code Changes:** Complete ✓
**Pod Install:** Complete ✓
**Next Step:** Rebuild iOS app to apply changes

## 🧪 Testing After Fix
1. Launch the app - should NOT crash
2. Navigate to Events feature
3. Create a confirmed event
4. Tap "Add to Calendar" button
5. Calendar permission prompt should appear (first time only)
6. Event should be added to calendar successfully






