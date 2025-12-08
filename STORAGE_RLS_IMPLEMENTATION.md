# Storage RLS Implementation - Privacy-Focused Image Access

## Overview
Implemented comprehensive Row Level Security (RLS) for Supabase storage to ensure users can only access images from users they share chats with. This provides a privacy-focused approach where images are not publicly accessible.

## Date: December 8, 2025

## Problem
- User profile images were failing to load due to RLS being enabled on storage
- Storage bucket was set to `public: false` but the app was trying to use public URLs
- Need privacy-focused access control: users should only see images from people they share chats with

## Solution Architecture

### 1. Database-Level RLS Policies
**Migration:** `storage_rls_chat_based_access`

#### Helper Function
```sql
CREATE FUNCTION public.users_share_chat(user_id_1 uuid, user_id_2 uuid)
```
- Checks if two users are members of at least one common chat
- Returns boolean
- Used by RLS policies to validate access

#### Storage RLS Policies
1. **View Own Files** - Users can always see their own uploads
2. **View Chat Member Files** - Users can see files from users they share chats with
3. **Upload Files** - Authenticated users can upload files (owner set automatically)
4. **Update Own Files** - Users can update their own files
5. **Delete Own Files** - Users can delete their own files

### 2. Backend Image Proxy
**File:** `backend/src/routes/image-proxy.ts`

#### Endpoint: `/api/images/*`
- Proxies all image requests through authenticated endpoint
- Validates user access via RLS policies
- Accepts authentication via:
  - `Authorization: Bearer <token>` header
  - `?token=<token>` query parameter (for React Native Image component)

#### Features:
- Automatic content-type detection from file extension
- 403 errors for access denied (doesn't leak file existence info)
- Cache-Control headers for 1-hour client-side caching
- CORS enabled for cross-origin requests

### 3. Frontend Image Handling

#### Updated Files:
1. **`src/utils/imageHelpers.ts`**
   - Added `extractStoragePath()` to parse Supabase storage URLs
   - Updated `getFullImageUrl()` to route Supabase URLs through proxy
   - Added `getAuthenticatedImageUrl()` for async token injection

2. **`src/components/AuthImage.tsx`** (NEW)
   - Custom wrapper around `expo-image`
   - Automatically handles authentication for RLS-protected images
   - Async URL resolution with auth token
   - Graceful fallback while loading
   - Drop-in replacement for regular Image component

3. **`src/screens/ProfileScreen.tsx`**
   - Updated to use `AuthImage` component
   - Added `imageLoadError` state for graceful fallback
   - Shows initials avatar when image fails to load

### 4. Schema Documentation
**File:** `current_supabase_schema.sql`

Updated storage configuration documentation to reflect:
- Public access DISABLED
- Chat-based access control
- Image proxy endpoint details
- Privacy-focused architecture

## Security Features

### Privacy Protection
- ✅ Users cannot access images from users they don't share chats with
- ✅ File existence is not leaked (403 errors for all unauthorized access)
- ✅ All requests require authentication
- ✅ RLS policies enforced at database level

### Performance Optimization
- ✅ Client-side caching (1-hour)
- ✅ Efficient RLS policy using EXISTS clauses
- ✅ Query-level policy evaluation with `(SELECT auth.uid())`

## Usage

### For Developers

#### Use AuthImage for Profile/Chat Images:
```tsx
import { AuthImage } from '@/components/AuthImage';

// Simple usage
<AuthImage 
  source={{ uri: user.image }} 
  style={{ width: 100, height: 100 }} 
  contentFit="cover"
/>

// With error handling
<AuthImage
  source={{ uri: imageUrl }}
  style={{ width: 200, height: 200 }}
  onError={(error) => console.error('Image failed:', error)}
  onLoad={() => console.log('Image loaded!')}
/>
```

#### Local/Asset Images (no auth needed):
```tsx
// These work automatically without auth
<AuthImage source={require('./logo.png')} />
<AuthImage source={{ uri: 'data:image/png;base64,...' }} />
```

### Image URL Flow

1. **Old URL:** `https://xxekfvxdzixesjrbxoju.supabase.co/storage/v1/object/public/uploads/file.jpg`
2. **Transformed:** `https://backend.com/api/images/file.jpg`
3. **With Auth:** `https://backend.com/api/images/file.jpg?token=<jwt>`
4. **Backend:** Validates access via RLS, serves image if authorized

## Migration Notes

### Existing Images
- Old public URLs will automatically be routed through the proxy
- Signed URLs are also handled and routed through proxy
- No database migration needed for existing image URLs

### Backend Deployment
- Ensure backend is deployed with new image proxy route
- Verify storage bucket RLS policies are applied
- Test that auth tokens are working

### Testing Checklist
- [ ] Profile images load for your own profile
- [ ] Profile images load for users in shared chats
- [ ] Profile images DON'T load for users not in shared chats
- [ ] Chat images load correctly
- [ ] Image upload still works
- [ ] Fallback to initials avatar when image fails

## Files Modified

### Backend
- ✅ `backend/src/routes/image-proxy.ts` (NEW)
- ✅ `backend/src/index.ts` (registered image proxy route)

### Frontend
- ✅ `src/utils/imageHelpers.ts`
- ✅ `src/components/AuthImage.tsx` (NEW)
- ✅ `src/screens/ProfileScreen.tsx`

### Database
- ✅ Migration: `storage_rls_chat_based_access`
- ✅ Function: `public.users_share_chat()`
- ✅ 5 RLS policies on `storage.objects`

### Documentation
- ✅ `current_supabase_schema.sql`
- ✅ `STORAGE_RLS_IMPLEMENTATION.md` (this file)

## Benefits

### User Privacy
- 🔒 Images only visible to chat members
- 🔒 No public access to user uploads
- 🔒 Fine-grained access control

### Security
- 🛡️ Database-level RLS enforcement
- 🛡️ JWT authentication required
- 🛡️ No information leakage about file existence

### Performance
- ⚡ Client-side caching
- ⚡ Efficient RLS queries
- ⚡ Single proxy endpoint for all images

### Developer Experience
- 🎯 Simple `AuthImage` component
- 🎯 Drop-in replacement for Image
- 🎯 Automatic auth handling
- 🎯 Graceful fallbacks

## Next Steps

1. **Test thoroughly** - Verify images load correctly in all scenarios
2. **Monitor performance** - Watch for any slow image loading
3. **Consider optimization** - If needed, implement image CDN or caching layer
4. **Document for team** - Ensure all developers know to use `AuthImage`

## Troubleshooting

### Images Not Loading
1. Check if user is authenticated
2. Verify users share at least one chat
3. Check backend logs for 403 errors
4. Ensure RLS policies are applied

### Slow Image Loading
1. Check network latency to backend
2. Consider implementing CDN
3. Monitor backend image proxy performance
4. Optimize RLS policy queries if needed

---

**Status:** ✅ IMPLEMENTED
**Migration:** ✅ APPLIED
**Testing:** ⏳ PENDING USER VALIDATION

