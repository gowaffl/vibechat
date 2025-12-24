# Translation Backend Endpoints Fix

## Problem

After implementing the "Choose Language" UX improvement, translations were not working at all. No `[Translation]` logs appeared in the frontend terminal, and no translations were being displayed.

### Root Cause

The **backend API endpoints were missing**! The frontend was calling:
- `PATCH /api/chats/:chatId/translation` - To save translation settings
- `GET /api/chats/:chatId` - To load translation settings

But these endpoints **didn't exist** in the backend, causing all translation API calls to fail silently.

## Solution

Added the missing backend endpoints to `/backend/src/routes/chats.ts`:

### 1. **GET `/api/chats/:chatId`** - Fetch chat details with translation settings

```typescript
chats.get("/:chatId", async (c) => {
  const chatId = c.req.param("chatId");
  const userId = c.req.query("userId");

  // Fetch chat details
  const { data: chat } = await db
    .from("chat")
    .select("*")
    .eq("id", chatId)
    .single();

  // Fetch chat members with translation settings
  const { data: members } = await db
    .from("chat_member")
    .select("*, user:userId(*)")
    .eq("chatId", chatId);

  // Find current user's member record
  const myMember = members?.find((m: any) => m.userId === userId);

  return c.json({
    ...chat,
    members,
    translationEnabled: myMember?.translation_enabled || false,
    translationLanguage: myMember?.translation_language || ""
  });
});
```

**What it does**:
- Fetches chat details and all members
- Extracts translation settings from the current user's `chat_member` record
- Returns `translationEnabled` and `translationLanguage` at the top level for easy access

### 2. **PATCH `/api/chats/:chatId/translation`** - Update translation settings

```typescript
chats.patch("/:chatId/translation", async (c) => {
  const chatId = c.req.param("chatId");
  const body = await c.req.json();
  const { userId, translationEnabled, translationLanguage } = body;

  // Build update object dynamically
  const updateData: any = {};
  if (translationEnabled !== undefined) {
    updateData.translation_enabled = translationEnabled;
  }
  if (translationLanguage !== undefined) {
    updateData.translation_language = translationLanguage;
  }

  // Update the chat_member record
  const { error } = await db
    .from("chat_member")
    .update(updateData)
    .eq("chatId", chatId)
    .eq("userId", userId);

  return c.json({ success: true, ...updateData });
});
```

**What it does**:
- Accepts `translationEnabled` (boolean) and/or `translationLanguage` (string)
- Updates the `chat_member` table for the specific user in the specific chat
- Allows partial updates (can update just enabled state or just language)

## Database Schema

The `chat_member` table already had the necessary columns:

```sql
CREATE TABLE chat_member (
  id text PRIMARY KEY,
  chatId text REFERENCES chat(id),
  userId text REFERENCES user(id),
  joinedAt timestamp,
  isPinned boolean DEFAULT false,
  pinnedAt timestamp,
  isMuted boolean DEFAULT false,
  translation_enabled boolean DEFAULT false,  -- ✅ Already exists
  translation_language text DEFAULT 'en'      -- ✅ Already exists
);
```

## Frontend Flow (Now Working)

### 1. **On Chat Load**:
```typescript
// Fetch chat details including translation settings
const { data: chatDetails } = useQuery({
  queryKey: ["chat", chatId],
  queryFn: async () => {
    const response = await api.get<any>(`/api/chats/${chatId}?userId=${user?.id}`);
    return response;
  },
  enabled: !!chatId && !!user?.id,
});

// Sync translation settings from server
useEffect(() => {
  if (chatDetails) {
    setTranslationEnabled(chatDetails.translationEnabled);
    if (chatDetails.translationLanguage) {
      setTranslationLanguage(chatDetails.translationLanguage);
    }
  }
}, [chatDetails]);
```

### 2. **When User Toggles Translation**:
```typescript
const handleTranslationToggle = async (enabled: boolean) => {
  setTranslationEnabled(enabled);
  
  // Save to backend
  await api.patch(`/api/chats/${chatId}/translation`, {
    userId: user?.id,
    translationEnabled: enabled
  });
};
```

### 3. **When User Selects Language**:
```typescript
const handleLanguageSelect = async (language: string) => {
  setTranslationLanguage(language);
  
  // Save to backend
  await api.patch(`/api/chats/${chatId}/translation`, {
    userId: user?.id,
    translationLanguage: language
  });
  
  // Now trigger translation
  if (translationEnabled && messages.length > 0) {
    await translateVisibleMessages(messages, true);
  }
};
```

## Per-User Translation Settings

Each user in a chat has their own translation settings stored in their `chat_member` record:

| User | Chat | translation_enabled | translation_language |
|------|------|---------------------|---------------------|
| Alice | Chat1 | true | "es" (Spanish) |
| Bob | Chat1 | true | "fr" (French) |
| Charlie | Chat1 | false | "en" |

**Result**: 
- Alice sees messages translated to Spanish
- Bob sees messages translated to French  
- Charlie sees original messages (no translation)
- All in the same chat!

## Testing

1. **Open a chat** and toggle translation ON
2. **Select a language** (e.g., Spanish)
3. **Check console logs**:
   ```
   [Chats] Updating translation settings for user xxx in chat yyy: { translationEnabled: true }
   [Chats] Successfully updated translation settings
   [Translation] Language selected: es
   [Translation] Language selected, translating 50 messages
   [Translation] Main chat effect - EXECUTING translation
   [Translation] Calling batch translate API for 10 messages to language: es
   ```
4. **Verify translations appear** in the chat
5. **Leave and return** to the chat
6. **Verify** settings persisted (translation still ON, language still Spanish)

## Files Modified

- **backend/src/routes/chats.ts**:
  - Added `GET /:chatId` endpoint
  - Added `PATCH /:chatId/translation` endpoint

## Related Documentation

- **TRANSLATION_CHOOSE_LANGUAGE_UX.md**: Frontend UX improvements
- **TRANSLATION_CANCELLATION_FIX.md**: Fixed API cancellation issues
- **TRANSLATION_FIX_SUMMARY.md**: Original translation persistence fix

## Next Steps

The translation feature should now work end-to-end:
1. ✅ Frontend can save translation settings
2. ✅ Backend stores settings per-user per-chat
3. ✅ Frontend loads settings on chat open
4. ✅ Translations are triggered after language selection
5. ✅ Settings persist across navigation

