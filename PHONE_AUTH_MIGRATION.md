# WhatsApp-Style Phone Authentication Migration

## ✅ What's Been Completed

### Backend Changes
1. **Removed Better Auth** - Replaced with Supabase Auth for phone/SMS authentication
2. **Created Phone Auth Routes** (`backend/src/routes/auth.ts`):
   - `POST /api/auth/send-otp` - Sends SMS verification code via Twilio
   - `POST /api/auth/verify-otp` - Verifies code and creates/returns user
   - `POST /api/auth/refresh` - Refreshes access token
   - `POST /api/auth/sign-out` - Signs out user

3. **Updated Database Schema**:
   - Added `phone` column to `user` table (E.164 format: `+12396998960`)
   - Phone number is now the primary identity (unique)
   - User ID comes from Supabase auth (`auth.users.id`)

4. **Updated Environment Variables**:
   - Removed `BETTER_AUTH_SECRET` requirement
   - Kept `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Frontend Changes
1. **Created PhoneAuthScreen** (`src/screens/PhoneAuthScreen.tsx`):
   - Clean, minimal UI inspired by WhatsApp
   - Two-step flow: Enter phone → Enter 6-digit code
   - Automatic formatting for US phone numbers (+1)
   - Error handling and loading states

2. **Updated Auth Client** (`src/lib/authClient.ts`):
   - Switched from Better Auth to Supabase client
   - Uses Expo SecureStore for persistent sessions
   - Helper functions for OTP send/verify, session management

3. **Updated UserContext** (`src/contexts/UserContext.tsx`):
   - Listens to Supabase auth state changes
   - Fetches user profile after authentication
   - Provides `isAuthenticated` and `signOut` methods

4. **Updated Navigation** (`src/navigation/RootNavigator.tsx`):
   - Added `PhoneAuth` screen as initial route for unauthenticated users
   - Routes: PhoneAuth → Onboarding → ChatList

5. **Updated API Client** (`src/lib/api.ts`):
   - Changed from cookie-based auth to Bearer token auth
   - Automatically includes JWT token in all API requests

## 🚀 Next Steps (What You Need to Do)

### 1. Apply Database Migration to Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Add phone column to user table
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Create unique index on phone
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_key" ON "user"("phone");

-- Add comment
COMMENT ON COLUMN "user"."phone" IS 'Phone number in E.164 format (e.g., +12396998960)';
```

**OR** use the migration file created at: `backend/supabase_migrations/add_phone_to_user.sql`

### 2. Verify Supabase Phone Auth Setup

Make sure you have:
- ✅ Phone Auth enabled in Supabase (Authentication → Providers → Phone)
- ✅ Twilio integration configured (you mentioned this is already done)
- ✅ Test phone number added (for development)

### 3. Update Environment Variables

**Frontend** (.env in root directory):
```
EXPO_PUBLIC_SUPABASE_URL=https://xxekfvxdzixesjrbxoju.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_VIBECODE_BACKEND_URL=(automatically set)
EXPO_PUBLIC_VIBECODE_PROJECT_ID=(automatically set)
```

**Backend** (backend/.env):
```
SUPABASE_URL=https://xxekfvxdzixesjrbxoju.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BACKEND_URL=(automatically set)
```

### 4. Test the Flow

1. Open the app - should show PhoneAuthScreen
2. Enter phone number (e.g., `+12396998960`)
3. Click "Send Code" - should receive SMS
4. Enter 6-digit code
5. Click "Verify" - should create user and navigate to onboarding

## 🔄 How It Works (WhatsApp Style)

### Identity = Phone Number
- Your user ID in the database is linked to your phone number
- Phone number is unique - can't have two accounts with same number
- User ID comes from Supabase auth (`auth.users.id`)

### The Login Process
1. **Input**: User enters phone number (+12396998960)
2. **Challenge**: Supabase sends 6-digit SMS code via Twilio
3. **Verify**: User enters code
4. **Token**: Supabase issues JWT access token
5. **Backend**: Creates user record if doesn't exist

### Account Persistence
- **Persistence**: JWT token stored securely in Expo SecureStore
- **Auto-refresh**: Token automatically refreshes when expired
- **Restoring**: If user reinstalls app, they verify phone again and get their account back
- **Data**: All chats, messages, settings persist across devices

### Comparison

**WhatsApp**: Identity is the phone number (follows you across devices)
**VibeChat (Old)**: Identity was the device (lost if app deleted)
**VibeChat (New)**: Identity is the phone number ✅ 

## 📱 User Experience

### New User Flow
1. Opens app → PhoneAuthScreen
2. Enters phone → Receives SMS
3. Enters code → Account created
4. Onboarding (name, photo) → ChatList

### Returning User Flow
1. Opens app → Authenticated automatically (stored session)
2. Goes straight to ChatList

### Reinstalled App Flow
1. Opens app → PhoneAuthScreen
2. Enters phone → Receives SMS
3. Enters code → Existing account retrieved
4. Goes to ChatList (onboarding already done)

## 🐛 Troubleshooting

### "Failed to send verification code"
- Check Supabase phone auth is enabled
- Verify Twilio credentials in Supabase
- Check phone number format (E.164: +12396998960)

### "Invalid verification code"
- Code expires after 60 seconds
- Make sure phone number matches exactly
- Check Supabase logs for errors

### "User not found" after verification
- Backend might not be running
- Check `EXPO_PUBLIC_VIBECODE_BACKEND_URL` is set
- Verify `/api/users` endpoint is accessible

### Environment variables not loaded
- Restart Expo dev server after changing .env
- Check variable names start with `EXPO_PUBLIC_` for frontend access

## 📝 Files Changed

### Backend
- `backend/src/auth.ts` - Replaced Better Auth with Supabase helpers
- `backend/src/routes/auth.ts` - NEW: Phone auth endpoints
- `backend/src/index.ts` - Removed Better Auth middleware, added auth routes
- `backend/src/env.ts` - Removed `BETTER_AUTH_SECRET` requirement
- `current_supabase_schema.sql` - Added phone column to user table
- `shared/contracts.ts` - Added phone to user schema

### Frontend
- `src/screens/PhoneAuthScreen.tsx` - NEW: Phone auth UI
- `src/lib/authClient.ts` - Replaced Better Auth with Supabase client
- `src/contexts/UserContext.tsx` - Updated for Supabase auth
- `src/navigation/RootNavigator.tsx` - Added PhoneAuth screen, auth routing
- `src/navigation/types.ts` - Added PhoneAuth to route types
- `src/lib/api.ts` - Changed from cookies to Bearer tokens

## 🎯 Key Benefits

1. **Cross-device**: User can reinstall app or switch devices and keep their account
2. **Familiar UX**: Works exactly like WhatsApp - users already know the flow
3. **No passwords**: No password to remember or reset
4. **Secure**: SMS verification via Twilio, JWT tokens in secure storage
5. **Simple**: One phone number = one account, easy to understand

## Next Steps

1. Apply the SQL migration
2. Test the phone auth flow
3. Enjoy your WhatsApp-style authentication! 🎉

