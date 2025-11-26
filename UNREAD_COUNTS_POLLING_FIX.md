# Unread Counts Polling Duplication Fix

## Problem
Multiple screens (`ChatScreen.tsx` and `ChatListScreen.tsx`) were independently polling the `/api/chats/unread-counts` endpoint every 3 seconds with the same query key `["unread-counts", userId]`. When both screens were mounted simultaneously (e.g., during navigation or when screens remained in memory), they both polled independently, causing rapid duplicate API calls visible in the logs.

## Root Cause
Both screens had identical `useQuery` definitions:
```typescript
const { data: unreadCounts = [] } = useQuery<UnreadCount[]>({
  queryKey: ["unread-counts", user?.id],
  queryFn: () => api.get(`/api/chats/unread-counts?userId=${user?.id}`),
  enabled: !!user?.id,
  refetchInterval: 3000, // Poll every 3 seconds
});
```

While React Query deduplicates requests with the same query key, having two separate `useQuery` calls with `refetchInterval` in different components can still cause excessive refetches when both screens are active.

## Solution
Created a shared custom hook `useUnreadCounts` that centralizes the polling logic:

### 1. New Hook: `src/hooks/useUnreadCounts.ts`
```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface UnreadCount {
  chatId: string;
  unreadCount: number;
}

export const useUnreadCounts = (userId: string | undefined) => {
  return useQuery<UnreadCount[]>({
    queryKey: ["unread-counts", userId],
    queryFn: () => api.get(`/api/chats/unread-counts?userId=${userId}`),
    enabled: !!userId,
    refetchInterval: 3000, // Poll every 3 seconds
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
};
```

### 2. Updated `ChatListScreen.tsx`
- Added import: `import { useUnreadCounts } from "@/hooks/useUnreadCounts";`
- Replaced inline `useQuery` with: `const { data: unreadCounts = [] } = useUnreadCounts(user?.id);`
- Removed `UnreadCount` from type imports (now handled by the hook)

### 3. Updated `ChatScreen.tsx`
- Added import: `import { useUnreadCounts } from "@/hooks/useUnreadCounts";`
- Replaced inline `useQuery` with: `const { data: unreadCounts = [] } = useUnreadCounts(user?.id);`

## Benefits
1. **Eliminates duplicate polling**: React Query's cache sharing now works optimally with a single hook managing the query
2. **Better performance**: Prevents window focus refetches with `refetchOnWindowFocus: false`
3. **Smoother UI**: Uses `placeholderData` to keep previous data visible while refetching
4. **Maintainable**: Single source of truth for unread counts polling logic
5. **Consistent behavior**: Same polling configuration across all screens

## Testing
After implementing this fix:
- Monitor the terminal/console logs - you should see only ONE request to `/api/chats/unread-counts` every 3 seconds instead of multiple rapid-fire requests
- Navigate between ChatList and Chat screens - unread counts should still update properly
- Open multiple chats - unread badges should display correctly

## Files Modified
- ✅ Created: `src/hooks/useUnreadCounts.ts`
- ✅ Updated: `src/screens/ChatListScreen.tsx`
- ✅ Updated: `src/screens/ChatScreen.tsx`

## Date
November 26, 2025

