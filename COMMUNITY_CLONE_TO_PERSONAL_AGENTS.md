# Community Clone to Personal Agents Implementation

## Overview
Added the ability to clone community AI personas directly to a user's personal agents list, in addition to the existing functionality of cloning to group chats.

## Changes Made

### 1. Frontend - CloneModal Component (`src/components/Community/CloneModal.tsx`)

#### New State
- Added `cloneToPersonal` boolean state to track if user wants to clone to personal agents

#### UI Updates
- **Personal Agents Option**: Added a new selectable option at the top of the modal (only visible for AI personas)
  - Shows a "Personal Agents" button with a User icon
  - Mutually exclusive with chat selection
  - When selected, deselects all chats and vice versa

- **Dynamic Button Text**: Updated the clone button to show:
  - "Clone to Personal Agents" when `cloneToPersonal` is true
  - "Clone to X Chat(s)" when selecting chats

- **Conditional Chat List**: Chat selection list only shows when `cloneToPersonal` is false
  - Added "or select chats:" divider text for AI personas

#### Logic Updates
- Modified `handleClone` to:
  - Send `cloneToPersonal` flag to backend
  - Send empty `targetChatIds` array when cloning to personal
  - Allow cloning when either `cloneToPersonal` is true OR chats are selected

- Updated `handleClose` to reset `cloneToPersonal` state

### 2. Backend - Community Routes (`backend/src/routes/community.ts`)

#### Schema Changes
Updated `cloneItemSchema` to:
```typescript
const cloneItemSchema = z.object({
  userId: z.string(),
  itemType: z.enum(["ai_friend", "command", "workflow"]),
  communityItemId: z.string(),
  targetChatIds: z.array(z.string()).max(10).optional().default([]),
  cloneToPersonal: z.boolean().optional().default(false),
}).refine(
  (data) => data.cloneToPersonal || data.targetChatIds.length > 0,
  { message: "Either cloneToPersonal must be true or targetChatIds must not be empty" }
);
```

Key changes:
- Made `targetChatIds` optional (defaults to empty array)
- Added `cloneToPersonal` boolean field
- Added validation to ensure at least one target is specified

#### Clone Logic Updates

**Personal Agent Clone Flow** (when `cloneToPersonal` is true):
1. Checks if user already has a personal agent with the same name and personality
2. Gets user's existing personal agents to determine color assignment
3. Uses color rotation algorithm (same as personal chat agent creation)
4. Fetches user's first chat for the required `chatId` field (or uses placeholder)
5. Creates AI friend with:
   - `isPersonal: true`
   - `ownerUserId: userId`
   - `createdBy: userId`
   - Community persona's name, personality, and tone
   - `engagementMode: "on-call"`
   - Assigned color from rotation
6. Records clone in `community_clone` table with `targetChatId: null`

**Group Chat Clone Flow** (existing, when `cloneToPersonal` is false):
- Unchanged - clones to selected chats as before

### 3. Database Schema (`current_supabase_schema.sql`)

#### Migration: `allow_null_target_chat_id_for_personal_clones`
```sql
-- Allow targetChatId to be NULL for personal agent clones
-- When cloning a community AI friend to personal agents, targetChatId will be NULL
ALTER TABLE public.community_clone ALTER COLUMN "targetChatId" DROP NOT NULL;
COMMENT ON COLUMN community_clone."targetChatId" IS 'The chat where the item was cloned to. NULL for personal agent clones.';
```

**Rationale**: Personal agent clones don't belong to a specific chat, so `targetChatId` needs to be nullable.

## User Experience

### Before
Users could only clone community AI personas to their group chats.

### After
Users now have two options when cloning an AI persona:
1. **Clone to Personal Agents**: Creates a private copy of the persona that only the user can see and use in personal chats
2. **Clone to Group Chats**: Creates a copy in selected group chats (existing behavior)

### UI Flow
1. User taps "Clone" on a community AI persona
2. Modal opens showing:
   - Persona details (description, personality, metadata)
   - "Personal Agents" option (with User icon)
   - "or select chats:" divider
   - List of user's group chats
3. User selects either:
   - Personal Agents option (deselects all chats)
   - One or more group chats (deselects Personal Agents)
4. Button text updates dynamically based on selection
5. User taps clone button
6. Success message shows and modal closes

## Technical Details

### Personal Agent Properties
When cloned to personal agents, the AI friend has:
- `isPersonal: true` - Marks it as a personal agent
- `ownerUserId: userId` - Links to the owner
- `createdBy: userId` - Tracks who created it
- `chatId: <user's first chat or placeholder>` - Required field for DB consistency
- `engagementMode: "on-call"` - Default engagement mode
- `color: <assigned from rotation>` - Unique color assignment
- `sortOrder: 0` - Default sort order

### Color Assignment
Uses the same color rotation algorithm as personal chat agent creation:
- 8 colors available: Green, Blue, Orange, Purple, Red, Yellow, Cyan, Pink
- Finds first unused color
- If all colors used, cycles back to beginning based on agent count

### Duplicate Prevention
- Checks if user already has a personal agent with identical name and personality
- Returns 400 error if duplicate found
- Prevents accidental duplicate clones

### Community Clone Tracking
- Records clone in `community_clone` table
- `targetChatId` is `null` for personal agent clones
- Allows tracking of clone metrics for community items

## Testing Checklist

- [ ] Clone AI persona to personal agents
- [ ] Verify agent appears in personal agents list
- [ ] Verify agent can be used in personal chats
- [ ] Verify agent does NOT appear in group chats
- [ ] Test duplicate prevention (clone same persona twice to personal)
- [ ] Verify color assignment works correctly
- [ ] Test cloning to both personal and group chats (separate clones)
- [ ] Verify "Personal Agents" option only shows for AI personas (not commands/workflows)
- [ ] Test modal state resets properly when closed
- [ ] Verify mutual exclusivity between personal and chat selection

## Future Enhancements

1. **Bulk Clone**: Allow cloning to both personal agents AND group chats in one action
2. **Clone History**: Show user which community items they've already cloned
3. **Clone Updates**: Notify users when original community persona is updated
4. **Custom Modifications**: Allow users to modify cloned personal agents after creation

## Related Files

### Frontend
- `src/components/Community/CloneModal.tsx` - Clone modal UI

### Backend
- `backend/src/routes/community.ts` - Clone API endpoint
- `backend/src/routes/personal-chats.ts` - Personal agent creation logic (reference)

### Database
- `current_supabase_schema.sql` - Schema documentation
- Migration: `allow_null_target_chat_id_for_personal_clones`

## Notes

- Commands and workflows can only be cloned to group chats (personal agents option only shows for AI personas)
- Personal agent clones are completely independent from the original community persona
- Users can clone the same community persona to both personal agents and multiple group chats
- Each clone is tracked separately in the `community_clone` table
