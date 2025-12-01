# Custom Command Timeout Fix

## Problem
Users were receiving "fetch failed: Fetch request has been canceled" errors when executing long-running custom commands, even though the commands were completing successfully on the backend.

## Root Cause
The frontend API client (`src/lib/api.ts`) had a hardcoded 30-second timeout for all requests. Long-running AI operations (custom commands, image generation, meme generation) often exceeded this limit, causing the frontend to abort the request while the backend continued processing.

## Solution

### 1. Dynamic Timeout Configuration (`src/lib/api.ts`)

**Added configurable timeout support:**
- Added `timeout` parameter to `FetchOptions` type
- Modified `fetchFn` to accept and use custom timeout values (default: 30 seconds)
- Updated `api.post()` method to automatically apply extended timeouts for AI operations:
  - **AI Operations**: 120 seconds (2 minutes)
    - `/api/custom-commands/execute`
    - `/api/ai/chat`
    - `/api/ai/generate-image`
    - `/api/ai/generate-meme`
  - **Other Operations**: 30 seconds (default)

```typescript
// Before
const timeoutId = setTimeout(() => controller.abort(), 30000); // Fixed 30 seconds

// After
const { timeout = 30000 } = options;
const timeoutId = setTimeout(() => controller.abort(), timeout); // Configurable
```

### 2. Improved Error Handling (`src/screens/ChatScreen.tsx`)

**Enhanced timeout error messages:**
- Updated error handlers for `executeCustomCommandMutation`, `generateImageMutation`, and `generateMemeMutation`
- Detect timeout/canceled errors and show informative messages
- Automatically invalidate queries when timeout occurs to check if the operation completed

**Before:**
```typescript
onError: (error) => {
  setIsAITyping(false);
  Alert.alert("Error", "Failed to execute custom command. Please try again.");
}
```

**After:**
```typescript
onError: (error: any) => {
  setIsAITyping(false);
  const errorMessage = error?.message || String(error);
  
  if (errorMessage.includes('timeout') || errorMessage.includes('canceled')) {
    Alert.alert(
      "Command Processing",
      "Your command is taking longer than expected but may still complete. The response will appear when ready.",
      [{ text: "OK", onPress: () => queryClient.invalidateQueries({ queryKey: ["messages"] }) }]
    );
  } else {
    Alert.alert("Error", "Failed to execute custom command. Please try again.");
  }
}
```

## Benefits

1. **No More False Errors**: Users won't see error messages for operations that are actually completing successfully
2. **Better UX**: Clear messaging when operations take longer than expected
3. **Automatic Recovery**: Queries are invalidated after timeout to check if the operation completed
4. **Scalable**: Easy to adjust timeouts for different operations as needed
5. **Smart Defaults**: AI operations automatically get longer timeouts without manual configuration

## Testing

Test with long-running operations:
1. Execute custom commands with complex prompts that require tool calls
2. Generate images with reference images
3. Generate memes with complex prompts
4. Verify that operations completing within 2 minutes show success
5. Verify that operations exceeding 2 minutes show helpful timeout message

## Files Modified

- `src/lib/api.ts`: Added configurable timeout support
- `src/screens/ChatScreen.tsx`: Improved error handling for AI mutations

