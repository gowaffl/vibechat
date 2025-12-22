# Message Encryption Security Fix

**Date:** December 22, 2024  
**Status:** ✅ RESOLVED

## Summary

Fixed a critical security warning from Supabase regarding the `message_decrypted` view that was defined with `SECURITY DEFINER`, which bypassed Row Level Security (RLS) policies.

## The Problem

### Security Warning
Supabase flagged the `message_decrypted` view as having `SECURITY DEFINER`, which caused queries against the view to run with the privileges of the view owner (postgres superuser) rather than the caller. This meant:

- ✗ RLS policies on the underlying `message` table were bypassed
- ✗ Users could potentially see messages they shouldn't have access to
- ✗ Privilege escalation risk if the view was accessed unexpectedly

### Root Cause Analysis

After investigating the codebase, we discovered:

1. **The view was NOT being used** - No code referenced `message_decrypted`
2. **The app was already doing it right** - Messages were being decrypted properly in the backend using explicit RPC calls
3. **The view was redundant and risky** - It provided no benefit and was a security liability

## The Solution

### Decision: Drop the View Entirely

We chose to **completely remove** the `message_decrypted` view because:

1. ✅ The view is unused in the codebase
2. ✅ The app already has proper encryption/decryption architecture
3. ✅ Automatic decryption views are a security anti-pattern
4. ✅ Explicit decryption is more secure and auditable

### Current Architecture (Correct)

**Messages are encrypted at rest and decrypted explicitly in the backend:**

```typescript
// backend/src/services/message-encryption.ts
export async function decryptMessageContent(message) {
  if (!message.is_encrypted || !message.content) {
    return message;
  }
  
  // Explicit RPC call to decrypt
  const { data, error } = await db.rpc('decrypt_message_content', {
    encrypted_text: message.content
  });
  
  return { ...message, content: data || message.content };
}
```

**Database layer:**

- `message` table: Stores encrypted content with RLS policies
- `decrypt_message_content()` function: SECURITY DEFINER to access vault (appropriate use)
- ~~`message_decrypted` view~~: ❌ Removed (was unused and insecure)

### Migration Applied

```sql
-- Migration: drop_unused_message_decrypted_view
DROP VIEW IF EXISTS public.message_decrypted;
```

## Security Improvements

### Before
- ⚠️ `message_decrypted` view with SECURITY DEFINER bypassed RLS
- ⚠️ View had broad grants to `anon` and `authenticated` roles
- ⚠️ Automatic decryption could expose data unintentionally

### After
- ✅ View completely removed
- ✅ All message access goes through `message` table with proper RLS
- ✅ Decryption is explicit and controlled in backend code
- ✅ No automatic decryption that could be accidentally exposed

## RLS Policies (Still in Effect)

The `message` table maintains proper security with RLS:

```sql
-- Members can view messages
Policy: is_chat_member("chatId")

-- Users can insert messages (in chats they're members of)
Policy: is_chat_member("chatId") AND auth.uid() = "userId"

-- Users can update/delete their own messages
Policy: auth.uid() = "userId"
```

## Verification

1. ✅ Security advisor no longer shows the SECURITY DEFINER view warning
2. ✅ View count is 0 (confirmed dropped)
3. ✅ No codebase references to `message_decrypted`
4. ✅ App functionality unchanged (view wasn't being used)

## Key Takeaways

### Best Practices for Message Encryption

1. **Encrypt at rest** - Store encrypted in the database
2. **Enforce RLS** - Use row-level security on encrypted tables
3. **Decrypt explicitly** - Use controlled RPC calls in backend, not automatic views
4. **Audit access** - Know exactly where and when decryption happens
5. **Least privilege** - Only decrypt what's needed, when needed

### Why Views with SECURITY DEFINER are Risky

- They run with owner's privileges (often superuser)
- They bypass RLS policies on underlying tables
- They can be hard to audit
- They can be accidentally exposed via auto-generated APIs
- Explicit function calls are safer and more auditable

## Related Files

- `/backend/src/services/message-encryption.ts` - Proper encryption service
- `/current_supabase_schema.sql` - Updated with documentation
- Applied migrations:
  - `fix_message_decrypted_view_security` (initial attempt)
  - `drop_unused_message_decrypted_view` (final solution)

## Testing

No testing required - the view was unused, so removing it has no functional impact. The app continues to:
- ✅ Encrypt messages on insert
- ✅ Decrypt messages via explicit RPC calls
- ✅ Enforce RLS policies on the message table
- ✅ Display messages correctly to users

---

**Result:** Critical security warning resolved. Message encryption architecture is now secure and follows best practices.

