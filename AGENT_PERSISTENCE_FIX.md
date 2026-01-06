# Agent Selector Persistence Fix

## Problem
The agent selector in the PersonalChatScreen was resetting to the default "VibeChat AI" agent every time the user left and returned to a chat, even though the conversation had a different agent associated with it.

## Root Cause
The issue had multiple aspects:

1. **State Initialization**: The `selectedAgent` state was initialized to `null` on every component mount
2. **Effect Condition**: The effect that loaded the agent from conversation data had a condition `!selectedAgent` that prevented it from updating properly
3. **Missing Agent Update**: When users manually switched agents, the conversation wasn't being updated in the database
4. **Initial Agent ID**: The `initialAgentId` route param wasn't being used

## Solution

### 1. Fixed Agent Loading from Conversation Data
**File**: `src/screens/PersonalChatScreen.tsx`

Removed the `!selectedAgent` condition and cleaned up the dependency array so the agent always syncs with the conversation data:

```typescript
// Before
useEffect(() => {
  const aiFriendFromConversation = (conversationData as any)?.ai_friend;
  if (aiFriendFromConversation && !selectedAgent) {
    setSelectedAgent(aiFriendFromConversation);
  }
}, [conversationData, selectedAgent]);

// After
useEffect(() => {
  const aiFriendFromConversation = (conversationData as any)?.ai_friend;
  if (aiFriendFromConversation) {
    setSelectedAgent(aiFriendFromConversation);
  }
}, [conversationData]);
```

### 2. Added Support for Initial Agent ID
Added logic to handle the `initialAgentId` route param when starting a new chat:

```typescript
// Fetch all agents to resolve initialAgentId if provided
const { data: allAgents = [] } = useAllUserAgents();

// Handle initial agent ID from route params (for new chats started with a specific agent)
useEffect(() => {
  if (initialAgentId && allAgents.length > 0 && !conversationId) {
    const agent = allAgents.find(a => a.id === initialAgentId);
    if (agent) {
      setSelectedAgent(agent);
    }
  }
}, [initialAgentId, allAgents, conversationId]);
```

### 3. Implemented Agent Switching with Persistence
Updated the `handleAgentSelect` callback to update the conversation in the database when the user switches agents:

```typescript
const handleAgentSelect = useCallback(async (agent: AIFriend | null) => {
  setSelectedAgent(agent);
  
  // If we have an existing conversation, update it to use the new agent
  if (conversationId && agent && user?.id) {
    try {
      await api.patch(`/api/personal-chats/${conversationId}`, {
        userId: user.id,
        aiFriendId: agent.id,
      });
      // Invalidate the conversation query to refresh data
      queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversation(conversationId) });
    } catch (error) {
      console.error("Failed to update conversation agent:", error);
      // Don't show an error to user - this is non-critical
    }
  }
}, [conversationId, queryClient, user?.id]);
```

## Backend Verification

Verified that the backend already has the necessary endpoints:

1. **PATCH /api/personal-chats/:conversationId** (lines 371-480 in `backend/src/routes/personal-chats.ts`)
   - Accepts `userId` and `aiFriendId` in the request body
   - Validates user ownership
   - Verifies user has access to the AI friend
   - Updates the conversation's `aiFriendId`

2. **POST /api/personal-chats/:conversationId/messages/stream** (lines 762-1167)
   - Already handles switching agents mid-conversation (lines 804-821)
   - Updates the conversation's `aiFriendId` when a different agent is requested

## Testing

To test the fix:

1. **Persistence Test**:
   - Select a custom agent in a personal chat
   - Send a message
   - Navigate away from the chat
   - Return to the chat
   - ✅ The agent selector should show the selected agent (not reset to default)

2. **Agent Switching Test**:
   - Open an existing conversation
   - Switch to a different agent
   - Send a message
   - Navigate away and return
   - ✅ The new agent should be persisted

3. **New Chat with Agent Test**:
   - Navigate to PersonalChatScreen with an `agentId` route param
   - ✅ The agent selector should show the specified agent

4. **Default Agent Test**:
   - Create a new conversation without selecting an agent
   - ✅ The agent selector should show "VibeChat AI"
   - Select an agent and send a message
   - Navigate away and return
   - ✅ The selected agent should be persisted

## Files Modified

1. `/src/screens/PersonalChatScreen.tsx`
   - Updated agent loading effect
   - Added initial agent ID handling
   - Implemented agent switching with database updates
   - Added `useAllUserAgents` hook import

## Benefits

1. **Better UX**: Users don't lose their agent selection when navigating
2. **Consistent Behavior**: The agent persists across sessions
3. **Proper State Management**: Agent selection is now properly synced with the database
4. **Seamless Agent Switching**: Users can switch agents mid-conversation and the change persists

