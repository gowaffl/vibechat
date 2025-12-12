# Messaging System Optimization: Memory & Storage

**Date:** December 12, 2025
**Implementation:** Cache Pruning Strategy

## Overview
We identified a potential performance bottleneck and memory risk in the messaging system related to how messages are persisted in MMKV and managed in local state.

## The Problem
1.  **Unbounded Growth:** Previous implementation allowed the `messages` array in both React State and MMKV storage to grow indefinitely as long as the user remained in the app or received realtime updates.
2.  **Startup Latency:** Persisting massive JSON blobs (e.g., thousands of messages) in MMKV causes significant synchronous blocking during `JSON.parse()` at app startup.
3.  **Memory Pressure:** Extremely large arrays can cause UI stuttering during updates (copying large arrays) and increase the risk of OOM (Out Of Memory) crashes.

## The Solution: Active Pruning
We have implemented a `MAX_CACHED_MESSAGES` limit (set to **500**) in `ChatScreen.tsx`.

### Logic
Whenever new messages are added to the local list (via **Realtime** or **Recovery**), we now:
1.  Prepend the new messages.
2.  Check if the total length exceeds 500.
3.  **Slice/Truncate** the array to 500 items before saving to State or Cache.

```typescript
const updatedMessages = [newMessage, ...oldData.messages];
if (updatedMessages.length > MAX_CACHED_MESSAGES) {
  updatedMessages.length = MAX_CACHED_MESSAGES;
}
```

### Impact
*   **Performance:** UI updates remain O(1) relative to a fixed upper bound, preventing degradation over long sessions.
*   **Storage:** MMKV storage footprint is capped, ensuring fast app startup.
*   **UX:** Users can still access older messages by scrolling up (pull-to-refresh), which triggers a database fetch via the existing pagination logic. The cache only keeps the "active" context.

## Files Modified
*   `src/screens/ChatScreen.tsx`: Added `MAX_CACHED_MESSAGES` constant and applied pruning logic to `recoverMissedMessages` and `Realtime Subscription (INSERT event)`.

