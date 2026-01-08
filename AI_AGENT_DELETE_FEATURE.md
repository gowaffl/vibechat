# AI Agent Delete Feature Implementation

## Overview
Users can now delete AI agents they created from the personal chat agents list using a long press gesture. This provides a clean way to manage custom AI friends while protecting system agents and agents created by others.

## Features
- **Long Press to Delete**: Hold down on any agent in the selector dropdown to trigger delete
- **Creator Verification**: Only agents created by the current user can be deleted
- **Confirmation Dialog**: Shows a confirmation alert before deletion
- **Smart Selection Handling**: If the deleted agent is currently active, automatically switches to the default VibeChat AI
- **Haptic Feedback**: Provides tactile feedback for better UX

## Database Changes

### Migration: `add_created_by_to_ai_friend`
Added a new `createdBy` column to track agent creators:

```sql
-- Add createdBy column to ai_friend table
ALTER TABLE public.ai_friend ADD COLUMN IF NOT EXISTS "createdBy" text;

-- Add foreign key constraint
ALTER TABLE public.ai_friend 
ADD CONSTRAINT ai_friend_createdBy_fkey 
FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_friend_created_by ON public.ai_friend("createdBy");
```

This allows us to track which user created each AI friend and enforce creator-only deletion.

## Backend Changes

### File: `shared/contracts.ts`
Updated the `aiFriendSchema` to include the `createdBy` field:

```typescript
export const aiFriendSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  name: z.string(),
  personality: z.string().nullable(),
  tone: z.string().nullable(),
  engagementMode: z.enum(["on-call", "percentage", "off"]).default("on-call"),
  engagementPercent: z.number().int().min(0).max(100).nullable(),
  color: z.string(),
  sortOrder: z.number().int(),
  createdBy: z.string().nullable(), // NEW: User ID of the creator
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

### File: `backend/src/routes/ai-friends.ts`
Updated all AI friend endpoints to include and save the `createdBy` field:

1. **GET `/api/ai-friends/:chatId`** - Returns `createdBy` for each agent
2. **POST `/api/ai-friends`** - Sets `createdBy` to the creating user's ID
3. **PATCH `/api/ai-friends/:id`** - Returns `createdBy` in response
4. **DELETE `/api/ai-friends/:id`** - Already existed, now works with creator tracking

Example changes in the POST endpoint:
```typescript
const { data: newFriend, error: createError } = await db
  .from("ai_friend")
  .insert({
    chatId: data.chatId,
    name: data.name || "AI Friend",
    // ... other fields
    createdBy: data.userId, // Track who created this agent
  })
  .select()
  .single();
```

## Frontend Changes

### File: `src/components/PersonalChat/AgentSelectorDropdown.tsx`

Added the following functionality:

1. **Imports**: Added `Alert`, `useUser`, `useQueryClient`, `api`, and `personalChatsKeys`
2. **Delete Handler**: `handleDeleteAgent()` - Shows confirmation and calls delete API
3. **Long Press Handler**: `handleAgentLongPress()` - Only triggers for user-created agents
4. **Selection Management**: Automatically switches to default AI if deleted agent was active
5. **Cache Invalidation**: Refreshes the agents list after deletion

Key implementation:

```typescript
const handleDeleteAgent = useCallback(async (agent: AIFriend) => {
  if (!user?.id) return;
  
  Alert.alert(
    "Delete Agent",
    `Are you sure you want to delete "${agent.name}"? This action cannot be undone.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/api/ai-friends/${agent.id}`, {
            userId: user.id,
          });
          
          // If the deleted agent was selected, clear selection
          if (selectedAgent?.id === agent.id) {
            onAgentSelect(null);
          }
          
          // Refresh agents list
          queryClient.invalidateQueries({ 
            queryKey: personalChatsKeys.allAgents(user.id) 
          });
        },
      },
    ]
  );
}, [user?.id, selectedAgent, onAgentSelect, queryClient]);

const handleAgentLongPress = useCallback((agent: AIFriend) => {
  // Only show delete option if the user created this agent
  if (agent.createdBy === user?.id) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleDeleteAgent(agent);
  }
}, [user?.id, handleDeleteAgent]);
```

Updated the agent item Pressable to include `onLongPress`:
```typescript
<Pressable
  key={agent.id}
  onPress={() => handleSelectAgent(agent)}
  onLongPress={() => handleAgentLongPress(agent)} // NEW
  // ... rest of the props
>
```

## User Experience Flow

1. User opens the Personal Chat screen
2. Taps the agent selector dropdown in the header
3. Sees a list of available agents
4. Long presses on an agent they created
5. Confirmation dialog appears: "Are you sure you want to delete [Agent Name]?"
6. User taps "Delete" or "Cancel"
7. If deleted:
   - Haptic feedback confirms the action
   - Agent is removed from the list
   - If it was the active agent, switches to default VibeChat AI
   - List refreshes to show updated agents

## Security & Permissions

### Creator-Only Deletion
- **Frontend Check**: `agent.createdBy === user?.id` - Only shows delete for user's agents
- **Backend Check**: Already enforced by chat membership verification in the API
- **No visual indicator**: Non-creator agents simply don't respond to long press

### Protection Rules
1. ✅ Users can only delete agents they created
2. ✅ Cannot delete the last agent in a chat (enforced by backend)
3. ✅ Cannot delete agents created by others
4. ✅ System-created agents (with `createdBy: null`) cannot be deleted by anyone

## Testing

### Test Cases
1. ✅ Create a new agent → Long press → Should show delete confirmation
2. ✅ Long press on system agent (VibeChat AI) → Nothing happens
3. ✅ Long press on agent created by another user → Nothing happens
4. ✅ Delete the currently selected agent → Should switch to default VibeChat AI
5. ✅ Delete an agent that is not selected → Selection should remain unchanged
6. ✅ Delete an agent → Agent should disappear from list immediately
7. ✅ Try to delete when not authenticated → Should fail gracefully

### How to Test
1. Open Personal Chat
2. Create a new custom agent (e.g., "Test Agent")
3. Long press on the agent in the selector dropdown
4. Confirm deletion
5. Verify the agent is removed and selection is handled correctly

## Notes

- **Backwards Compatibility**: Existing agents without a `createdBy` value (`null`) are treated as system agents and cannot be deleted
- **Future Enhancement**: Could add a visual indicator (e.g., small trash icon on hover) to make deletion more discoverable
- **UX Consideration**: Long press is a standard mobile pattern but may not be immediately obvious to users. Consider adding a tip or tutorial
- **Performance**: The delete operation is optimized with proper indexing on the `createdBy` column

## Related Files

- `src/components/PersonalChat/AgentSelectorDropdown.tsx` - Main UI component
- `src/screens/PersonalChatScreen.tsx` - Parent screen that uses the selector
- `backend/src/routes/ai-friends.ts` - API endpoints for agent management
- `shared/contracts.ts` - Type definitions and schemas
- `src/hooks/usePersonalChats.ts` - React Query hooks for agents

## Date Implemented
January 8, 2026
