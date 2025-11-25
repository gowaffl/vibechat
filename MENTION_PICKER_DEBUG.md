# MentionPicker Debug Instructions

## Added Debug Features

### 1. Console Logging

When you type `@` in the message input, you should see these logs in your console:

```
[Mentions] handleTyping called with text: @
[Mentions] Detection details: {
  text: "@",
  textLength: 1,
  lastAtIndex: 0,
  chatMembersCount: X,
  chatMembersNames: ["Alice", "Bob", ...],
  currentShowMentionPicker: false
}
[Mentions] @ found at index: 0 textAfterAt: ""
[Mentions] Setting showMentionPicker to TRUE
[Mentions] Search query: ""
```

Then on the next render:

```
[ChatScreen] Rendering MentionPicker check: {
  showMentionPicker: true,
  chatMembersCount: X,
  mentionSearch: "",
  keyboardHeight: 0
}
[ChatScreen] Actually rendering MentionPicker component
[MentionPicker] Rendering: {
  visible: true,
  totalUsers: X,
  searchQuery: "",
  filteredCount: X,
  filteredNames: ["Alice", "Bob", ...]
}
```

### 2. Visual Debug Indicator

A **RED BOX** will appear at the top-left of the screen when `showMentionPicker` is `true`. It will show:
```
MentionPicker: ON (X members)
```

This helps you confirm the state is being set correctly even if the actual picker isn't visible.

### 3. Component Logs

The MentionPicker component itself logs when it renders:
- Total users available
- Current search query
- How many users match the filter
- Names of filtered users

## Debugging Steps

### Step 1: Check if handleTyping is called
1. Open your app
2. Go to a chat
3. Open the console/debug logs
4. Type `@` in the message input
5. **Expected**: You should see `[Mentions] handleTyping called with text: @`

**If you DON'T see this:**
- The `onChangeText` handler isn't connected
- The TextInput isn't triggering properly
- Issue: Connection between TextInput and handleTyping

### Step 2: Check if @ is detected
After typing `@`, you should see:
```
[Mentions] @ found at index: 0 textAfterAt: ""
[Mentions] Setting showMentionPicker to TRUE
```

**If you DON'T see "Setting showMentionPicker to TRUE":**
- The @ detection logic has a bug
- The `lastAtIndex` is -1 when it shouldn't be

### Step 3: Check if chatMembers are loaded
Look for:
```
chatMembersCount: X
chatMembersNames: ["Name1", "Name2", ...]
```

**If chatMembersCount is 0:**
- The chat members query hasn't loaded yet
- The chat doesn't have any members
- Issue: Data not available for mentions

### Step 4: Check if state is set
After typing `@`, look for the **RED DEBUG BOX** at the top of the screen.

**If you SEE the red box:**
✅ State is being set correctly
❌ But the MentionPicker component isn't rendering/visible

**If you DON'T see the red box:**
❌ State isn't being set
→ Go back to Step 2

### Step 5: Check if MentionPicker renders
Look for these console logs:
```
[ChatScreen] Rendering MentionPicker check: { showMentionPicker: true, ... }
[ChatScreen] Actually rendering MentionPicker component
```

**If you see these logs but no picker:**
- The MentionPicker component is rendering but invisible
- Possible causes:
  - z-index issue
  - Positioning is off-screen
  - Opacity is 0
  - Component is returning null

### Step 6: Check MentionPicker internal state
Look for:
```
[MentionPicker] Rendering: {
  visible: true,
  totalUsers: X,
  ...
}
```

**If filteredCount is 0:**
- No users match the search
- The component returns `null`
- Try typing `@a` or `@b` to match names

**If you see "No users match search query":**
- The filter is too strict
- Try empty search (just `@`)

## Common Issues & Solutions

### Issue 1: No console logs at all
**Problem**: handleTyping isn't being called
**Solution**: Check that TextInput has `onChangeText={handleTyping}`

### Issue 2: chatMembersCount is 0
**Problem**: No members loaded
**Solution**: 
- Wait for the query to load
- Check if the chat actually has members
- Try in a chat with multiple users

### Issue 3: Red box shows but no picker
**Problem**: MentionPicker is rendering but invisible
**Solution**: Check the positioning calculation
- `bottom: keyboardHeight + 160`
- May be positioned off-screen
- Try with keyboard open/closed

### Issue 4: filteredCount is 0
**Problem**: Search filter excludes all users
**Solution**: 
- Just type `@` (empty search should show all)
- If still 0, the filter logic has a bug

### Issue 5: Component returns null
**Problem**: Early return in MentionPicker
**Causes**:
1. `!visible` → component returns immediately
2. `filteredUsers.length === 0` → component returns null

**Solution**: Check the logs to see which condition is failing

## Test Commands

Open your dev console and watch for these log patterns:

1. **Type `@`**
   - Should show: handleTyping → @ found → showMentionPicker TRUE
   
2. **Type `@a`**
   - Should show: search query "a" → filtered users
   
3. **Type `@ ` (@ + space)**
   - Should show: Space found → closing picker

4. **Type regular text**
   - Should show: No @ found → hiding picker

## Next Steps Based on Findings

### If handleTyping is never called:
→ Fix the TextInput connection

### If @ isn't detected:
→ Fix the detection logic

### If chatMembers is empty:
→ Wait for data or check the query

### If state is set but picker doesn't show:
→ Check positioning and z-index

### If picker renders but shows no users:
→ Check the filter logic

---

## Quick Fix: Force Visible Test

To test if it's a positioning issue, try forcing the picker to always show:

Add this temporarily at the top of ChatScreen's return:
```tsx
<View style={{ position: "absolute", top: 200, left: 0, right: 0, zIndex: 9999 }}>
  <MentionPicker
    visible={true}
    users={chatMembers}
    onSelectUser={handleSelectMention}
    searchQuery=""
  />
</View>
```

If this shows the picker, it's a positioning issue.
If this doesn't show, it's a MentionPicker component issue.

