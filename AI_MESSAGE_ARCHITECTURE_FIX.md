# AI Message Architecture Fix

## Date: November 25, 2025

## Issue Discovered

The backend code was attempting to use `userId: "ai-assistant"` for AI-generated messages, but:
1. **No "ai-assistant" user exists in the database**
2. **Actual AI messages in the database have `userId: null`**
3. **Code was checking for `userId === "ai-assistant"` which would never match**

This caused the AI engagement service to crash with:
```
TypeError: undefined is not an object (evaluating 'db.aIFriend.findMany')
```

## Root Causes

### 1. Prisma to Supabase Migration Incomplete
- Code was using Prisma-style queries (`db.aIFriend.findMany()`)
- Supabase uses different query syntax (`.from("ai_friend").select()`)

### 2. Incorrect AI Message Detection
- Code checked `userId === "ai-assistant"` to identify AI messages
- Database actually uses `userId: null` and `aiFriendId: <uuid>` for AI messages

## Correct Architecture

### Database Schema
The `message` table structure:
- **userId**: `NULL` for AI messages, actual user UUID for human messages
- **aiFriendId**: Set to AI friend UUID for AI messages, `NULL` for human messages

```sql
CREATE TABLE "message" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT,          -- NULL for AI messages
    "chatId" TEXT NOT NULL,
    "aiFriendId" TEXT,      -- UUID of AI friend that sent the message
    "content" TEXT,
    ...
);
```

### AI Friends vs Users
- **`ai_friend` table**: Stores AI assistant configurations (name, personality, tone, etc.)
- Each chat can have multiple AI friends with different personalities
- Example: "Gridley" AI friend with personality "You are our AIO..."

### Message Identification
- **Human messages**: `userId: <user-uuid>`, `aiFriendId: null`
- **AI messages**: `userId: null`, `aiFriendId: <ai-friend-uuid>`

## Changes Made

### 1. Fixed Prisma to Supabase Queries

**Before:**
```typescript
const aiFriends = await db.aIFriend.findMany({
  where: { chatId },
  orderBy: { sortOrder: "asc" },
});
```

**After:**
```typescript
const { data: aiFriends } = await db
  .from("ai_friend")
  .select("*")
  .eq("chatId", chatId)
  .order("sortOrder", { ascending: true });
```

### 2. Fixed AI Message Detection

**Before:**
```typescript
if (lastMessage && lastMessage.userId === "ai-assistant") {
  // AI message detected
}
```

**After:**
```typescript
if (lastMessage && lastMessage.aiFriendId) {
  // AI message detected - identified by having an aiFriendId
}
```

### 3. Fixed AI Message Creation

**Before:**
```typescript
await db.message.create({
  data: {
    userId: "ai-assistant", // ❌ This user doesn't exist!
    chatId: chatId,
    content: "..."
  }
});
```

**After:**
```typescript
const { data: message } = await db
  .from("message")
  .insert({
    userId: null,           // ✅ Correct: NULL for AI messages
    aiFriendId: aiFriendId, // ✅ Links to specific AI friend
    chatId: chatId,
    content: "..."
  })
  .select()
  .single();
```

### 4. Removed "ai-assistant" User Dependency

- Removed all attempts to fetch `user` with id "ai-assistant"
- AI messages no longer pretend to be from a user
- Frontend can display AI friend info using the `aiFriendId`

## Files Modified

1. **backend/src/services/ai-engagement.ts**
   - Converted all Prisma queries to Supabase
   - Fixed AI message detection (use `aiFriendId` instead of `userId`)
   - Fixed message creation (use `userId: null`)

2. **backend/src/routes/ai.ts**
   - Fixed AI chat responses
   - Fixed AI image generation
   - Fixed AI meme generation
   - All now use `userId: null` and `aiFriendId`

3. **backend/src/routes/messages.ts**
   - Fixed message deletion permissions
   - AI messages now detected by `aiFriendId !== null`

4. **backend/src/routes/custom-commands.ts**
   - Fixed custom command AI responses
   - Use `userId: null` for AI messages

5. **current_supabase_schema.sql**
   - Updated documentation to reflect userId is nullable
   - Added notes about AI message architecture

## Testing Verification

Query to verify current AI messages:
```sql
SELECT id, "userId", "aiFriendId", content, "messageType", "createdAt" 
FROM "message" 
WHERE "aiFriendId" IS NOT NULL 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

Expected result:
- `userId`: null
- `aiFriendId`: UUID like "783270d3-5c3e-438c-b48f-a37166ffe767"

## Benefits of This Architecture

1. **Proper Separation**: AI friends are not users - they're chat assistants
2. **Multiple AI Friends**: Each chat can have multiple AI assistants with different personalities
3. **Clear Identification**: Easy to identify AI vs human messages
4. **No Fake Users**: No need to create/maintain "ai-assistant" user records
5. **Better RLS**: Row Level Security policies work correctly without special cases

## Migration Notes

- No data migration needed - existing messages already follow this pattern
- Code was out of sync with database schema
- This fix aligns code with actual database state

## Future Considerations

If you need to display user info for AI messages in the frontend:
- Join with `ai_friend` table using `aiFriendId`
- Display AI friend's name, color, and personality info
- Or keep `userId: null` and handle display logic in frontend

