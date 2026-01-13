# Group Avatar Generation Fix

## Problem
The generate group avatar functionality was returning 404 errors:
```
<-- POST /api/chats/d9b0a144-845f-4152-9763-f260e29fb291/generate-avatar
--> POST /api/chats/d9b0a144-845f-4152-9763-f260e29fb291/generate-avatar 404 1ms
```

## Root Cause
The frontend was calling `/api/chats/:chatId/generate-avatar`, but this route didn't exist in the backend. The avatar generation logic was only available at `/api/ai/generate-group-avatar`.

## Solution
Added a new route in `backend/src/routes/chats.ts` that:
1. Accepts requests at `/api/chats/:id/generate-avatar` (matching frontend expectations)
2. Validates that the requesting user is a member of the chat
3. Forwards the request to the existing `/api/ai/generate-group-avatar` endpoint

## Changes Made

### File: `backend/src/routes/chats.ts`
Added new route after the image upload endpoint:

```typescript
// POST /api/chats/:id/generate-avatar - Generate AI avatar for chat
chats.post("/:id/generate-avatar", async (c) => {
  const chatId = c.req.param("id");
  
  try {
    const body = await c.req.json();
    const { userId } = body;

    console.log(`[Chats] Generate avatar request for chat ${chatId} by user ${userId}`);

    // Verify user is a member of the chat
    const { data: membership } = await db
      .from("chat_member")
      .select("id")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "You must be a member to generate chat avatar" }, 403);
    }

    // Forward to the AI avatar generation endpoint
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const response = await fetch(`${backendUrl}/api/ai/generate-group-avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return c.json(errorData, response.status as 400 | 401 | 403 | 404 | 429 | 500);
    }

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error("[Chats] Error generating avatar:", error);
    return c.json({ error: "Failed to generate avatar" }, 500);
  }
});
```

## How It Works

### Request Flow
1. Frontend calls: `POST /api/chats/{chatId}/generate-avatar` with `{ userId }`
2. New route validates user membership
3. Request is forwarded to: `POST /api/ai/generate-group-avatar` with `{ chatId }`
4. AI generates avatar using Gemini 3 Pro Image Preview
5. Avatar is saved to Supabase Storage
6. Chat record is updated with new avatar URL
7. Response is returned to frontend

### Security
- User must be a member of the chat to generate an avatar
- Rate limiting: Only one avatar per chat per day (Eastern timezone)
- All existing security checks in the AI endpoint remain in place

## Testing
To test the fix:
1. Deploy the updated backend
2. Navigate to Group Settings in the app
3. Tap "Generate Avatar" button
4. Should see avatar generation succeed (or appropriate error if already generated today)

## Related Files
- `backend/src/routes/chats.ts` - New route added
- `backend/src/routes/ai.ts` - Existing avatar generation logic (line 1327)
- `src/screens/GroupSettingsScreen.tsx` - Frontend implementation (line 177)

## Notes
- The existing `/api/ai/generate-group-avatar` endpoint remains unchanged and functional
- This fix maintains backward compatibility
- The route follows RESTful conventions by placing it under `/api/chats/:id/`
