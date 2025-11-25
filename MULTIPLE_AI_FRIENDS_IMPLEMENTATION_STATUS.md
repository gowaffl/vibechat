# Multiple AI Friends Implementation Status

## ✅ Completed Backend Work

### 1. Database Schema (✅ COMPLETE)
- Created `AIFriend` model in Prisma schema
- Added `aiFriendId` field to `Message` model
- Created migration that preserves existing data
- Migrated existing Chat AI settings to AIFriend records

### 2. Shared Contracts (✅ COMPLETE)
- Added `AIFriend` schema and types
- Added all AI friends CRUD request/response schemas
- Updated `Message` schema to include `aiFriendId`
- Updated `AiChatRequest` schema to require `aiFriendId`

### 3. Backend API Routes (✅ COMPLETE)
- Created `/api/ai-friends` endpoints:
  - `GET /api/ai-friends/:chatId` - Get all AI friends for a chat
  - `POST /api/ai-friends` - Create new AI friend (auto-assigns color from palette)
  - `PATCH /api/ai-friends/:id` - Update AI friend settings
  - `DELETE /api/ai-friends/:id` - Delete AI friend (must keep at least one)
  - `PATCH /api/ai-friends/reorder` - Reorder AI friends

### 4. AI Chat Endpoint (✅ COMPLETE)
- Updated `/api/ai/chat` to accept and use `aiFriendId`
- Fetches specific AI friend settings (name, personality, tone)
- Uses AI friend's settings in system prompt
- Saves message with `aiFriendId` reference

### 5. Auto-Engagement Service (✅ COMPLETE)
- Updated to query all AI friends per chat
- Checks engagement settings per AI friend
- Selects ONE AI friend randomly if multiple qualify
- Maintains restriction: no AI can respond if last message is from any AI
- Passes `aiFriendId` when generating response

## 🚧 Frontend Work Remaining

### 1. GroupSettingsScreen Updates (⏳ IN PROGRESS)

#### Already Done:
- ✅ Added AI friends API client (`/src/api/ai-friends.ts`)
- ✅ Added `AIFriend` type import
- ✅ Added query to fetch AI friends
- ✅ Added state for `selectedAiFriendId`, `isCreatingAiFriend`, and AI friend form fields

#### Still Needed:
1. **Add AI Friends Mutations** (after existing mutations):
```typescript
// Create AI friend mutation
const createAIFriendMutation = useMutation({
  mutationFn: (data: CreateAIFriendRequest) => aiFriendsApi.createAIFriend(data),
  onSuccess: (newFriend) => {
    queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
    setSelectedAiFriendId(newFriend.id);
    setIsCreatingAiFriend(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
});

// Update AI friend mutation
const updateAIFriendMutation = useMutation({
  mutationFn: ({ aiFriendId, data }: { aiFriendId: string; data: UpdateAIFriendRequest }) =>
    aiFriendsApi.updateAIFriend(aiFriendId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
});

// Delete AI friend mutation
const deleteAIFriendMutation = useMutation({
  mutationFn: (aiFriendId: string) => aiFriendsApi.deleteAIFriend(aiFriendId, user?.id || ""),
  onSuccess: (_, deletedId) => {
    queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
    if (selectedAiFriendId === deletedId && aiFriends.length > 0) {
      setSelectedAiFriendId(aiFriends[0].id);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
});
```

2. **Update Effect to Set Selected AI Friend** (after chat data loads):
```typescript
// Auto-select first AI friend when data loads
React.useEffect(() => {
  if (aiFriends.length > 0 && !selectedAiFriendId) {
    setSelectedAiFriendId(aiFriends[0].id);
  }
}, [aiFriends, selectedAiFriendId]);

// Load selected AI friend data into form fields
React.useEffect(() => {
  const selectedFriend = aiFriends.find(f => f.id === selectedAiFriendId);
  if (selectedFriend) {
    setAiName(selectedFriend.name);
    setAiPersonality(selectedFriend.personality || "");
    setAiTone(selectedFriend.tone || "");
    setAiEngagementMode(selectedFriend.engagementMode);
    setAiEngagementPercent(selectedFriend.engagementPercent || 50);
  }
}, [selectedAiFriendId, aiFriends]);
```

3. **Replace AI Friend Section UI** (lines ~1238-1614):
   - Add dropdown at top (only shown if 2+ AI friends) to switch between AI friends
   - Add "+" button next to section header to create new AI friend
   - Show selected AI friend's settings in form fields
   - Add delete button for selected AI friend (disabled if only one left)
   - Update all handlers to work with `selectedAiFriendId`

**Reference UI Structure:**
```tsx
<View className="rounded-2xl p-5 mb-4" style={{...}}>
  {/* Header with title and + button */}
  <View className="flex-row items-center justify-between mb-3">
    <Pressable onPress={() => setIsAiFriendSectionExpanded(!isAiFriendSectionExpanded)}>
      <View className="flex-row items-center">
        <Sparkles size={18} color="#34C759" />
        <Text className="text-sm font-semibold ml-2" style={{ color: "#34C759" }}>
          AI FRIENDS
        </Text>
      </View>
    </Pressable>
    <View className="flex-row items-center gap-2">
      {isCreator && (
        <Pressable onPress={() => setIsCreatingAiFriend(true)}>
          <Plus size={20} color="#34C759" />
        </Pressable>
      )}
      {isAiFriendSectionExpanded ? (
        <ChevronUp size={20} color="#34C759" />
      ) : (
        <ChevronDown size={20} color="#34C759" />
      )}
    </View>
  </View>

  {isAiFriendSectionExpanded && (
    <>
      {/* Dropdown to select AI friend (only if 2+) */}
      {aiFriends.length > 1 && (
        <View className="mb-4">
          <Text className="text-xs font-semibold mb-2" style={{ color: "#8E8E93" }}>
            Select AI Friend
          </Text>
          {/* Dropdown picker for AI friends */}
        </View>
      )}

      {/* Show selected AI friend's settings */}
      {selectedAiFriendId && (
        <>
          {/* AI Friend Name */}
          {/* Custom Instructions */}
          {/* Tone Chips */}
          {/* Engagement Settings */}
          
          {/* Delete button (only if 2+ friends) */}
          {aiFriends.length > 1 && isCreator && (
            <Pressable onPress={() => handleDeleteAIFriend(selectedAiFriendId)}>
              <View className="flex-row items-center justify-center p-3 rounded-lg mt-4"
                style={{ backgroundColor: "rgba(255, 69, 58, 0.1)", borderWidth: 1, borderColor: "#FF453A" }}>
                <Trash2 size={16} color="#FF453A" />
                <Text className="ml-2" style={{ color: "#FF453A" }}>Delete This AI Friend</Text>
              </View>
            </Pressable>
          )}
        </>
      )}
    </>
  )}
</View>
```

### 2. ChatScreen Updates (❌ NOT STARTED)

#### Needed Changes:

1. **Fetch AI Friends** (add query near top of component):
```typescript
const { data: aiFriends = [] } = useQuery<AIFriend[]>({
  queryKey: ["aiFriends", chatId],
  queryFn: () => aiFriendsApi.getAIFriends(chatId, user?.id || ""),
  enabled: !!user?.id && !!chatId,
});
```

2. **Update Mention Picker** (remove generic "AI Friend", add all AI friends):
   - Remove the single AI friend option
   - Add all AI friends to mention picker with their names and colored indicators
   - When AI friend is selected from picker, insert `@{friend.name}` and track friend ID
   - Pass `aiFriendId` to `/api/ai/chat` when sending mention

3. **Update `handleSendMessage`** to pass `aiFriendId` when calling AI chat:
```typescript
// When sending a message with AI friend mention
const mentionedAiFriend = aiFriends.find(friend => 
  mentionedUserIds.includes(friend.id) || content.includes(`@${friend.name}`)
);

if (mentionedAiFriend) {
  // Call AI chat endpoint with aiFriendId
  await api.post("/api/ai/chat", {
    userId: user.id,
    userMessage: content,
    chatId,
    aiFriendId: mentionedAiFriend.id,
  });
}
```

### 3. Message Display with Colors (❌ NOT STARTED)

#### Needed Changes:

1. **Create AI Friend Color Utility** (`/src/utils/ai-friend-colors.ts`):
```typescript
export const getAIFriendColor = (aiFriendId: string | null | undefined, aiFriends: AIFriend[]): string => {
  if (!aiFriendId) return "#34C759"; // Default green
  const friend = aiFriends.find(f => f.id === aiFriendId);
  return friend?.color || "#34C759";
};

export const getAIFriendName = (aiFriendId: string | null | undefined, aiFriends: AIFriend[]): string => {
  if (!aiFriendId) return "AI Friend";
  const friend = aiFriends.find(f => f.id === aiFriendId);
  return friend?.name || "AI Friend";
};
```

2. **Update Message Rendering** (in ChatScreen or MessageBubble component):
   - For messages where `userId === "ai-assistant"`:
     - Get AI friend color using `getAIFriendColor(message.aiFriendId, aiFriends)`
     - Apply color to message bubble border/accent
     - Show AI friend name above message (color-coded)
   - Example:
```typescript
{message.userId === "ai-assistant" && (
  <Text style={{ 
    color: getAIFriendColor(message.aiFriendId, aiFriends),
    fontWeight: "600",
    fontSize: 12,
    marginBottom: 4,
  }}>
    {getAIFriendName(message.aiFriendId, aiFriends)}
  </Text>
)}
```

3. **Update Typing Indicator** to show specific AI friend name with color

## 🎨 Color Palette

The backend auto-assigns colors from this palette:
- `#34C759` - Green (default)
- `#007AFF` - Blue
- `#FF9F0A` - Orange
- `#AF52DE` - Purple
- `#FF453A` - Red
- `#FFD60A` - Yellow
- `#64D2FF` - Cyan
- `#FF375F` - Pink

## Testing Checklist

- [ ] Create multiple AI friends in a chat
- [ ] Edit individual AI friend settings (name, personality, tone)
- [ ] Delete AI friends (verify at least one remains)
- [ ] Switch between AI friends using dropdown
- [ ] Mention specific AI friend by name (e.g., @Jarvis)
- [ ] Verify correct AI friend responds with its personality
- [ ] Set different engagement modes for different AI friends
- [ ] Verify only one AI friend responds to auto-engagement per message
- [ ] Verify no AI friend can respond if ANY AI friend just responded
- [ ] Verify color themes display correctly for each AI friend's messages
- [ ] Test with existing chats (verify migration worked)

## Known Limitations

1. Custom slash commands don't have AI friend association (they use generic AI response)
2. Old messages from before migration will have `aiFriendId = null`
3. Maximum 8 distinct colors before cycling (intentional design choice)

