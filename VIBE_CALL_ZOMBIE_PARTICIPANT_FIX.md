# Vibe Call Zombie Participant Fix

## Problem

A "zombie participant" was stuck in the voice room database, showing "1 person" in the Vibe Call banner even though the call had ended and no one was actually connected.

### Symptoms
- Vibe Call banner shows "1 person" and "Join" button
- Call ended in LiveKit (visible in LiveKit dashboard)
- No one is actually in the call
- Room is marked as `isActive = true` in database
- One participant has `leftAt = NULL` (never marked as left)

## Root Cause

The participant never properly called the `/api/voice-rooms/leave` endpoint when disconnecting. This can happen when:

1. **App crashes or force-closes** while in a call
2. **Network disconnection** before leave API call completes
3. **LiveKit disconnects** but the `onDisconnected` callback fails
4. **React Native unmounts** the component before cleanup completes

## Immediate Fix Applied

### 1. Cleaned Up Zombie Participant

```sql
-- Marked the stuck participant as left
UPDATE voice_participant
SET "leftAt" = NOW()
WHERE id = 'de649b6e-2619-4eea-a91d-425a2685b152'
AND "leftAt" IS NULL;
```

### 2. Marked Room as Inactive

```sql
-- Marked the room as inactive since no participants remain
UPDATE voice_room
SET 
  "isActive" = false,
  "endedAt" = NOW()
WHERE id = '682d2946-fadc-490c-92d5-468ced77bb37'
AND "isActive" = true;
```

**Result**: ✅ Banner now correctly shows no active call

## Long-term Solutions

### Solution 1: Add Cleanup Job (Backend)

Create a periodic job that cleans up zombie participants:

```typescript
// backend/src/jobs/cleanup-voice-rooms.ts
export async function cleanupZombieParticipants() {
  // Find participants who joined more than 1 hour ago and never left
  const { data: zombies } = await db
    .from('voice_participant')
    .select('id, voiceRoomId, userId, joinedAt')
    .is('leftAt', null)
    .lt('joinedAt', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (zombies && zombies.length > 0) {
    console.log(`[Cleanup] Found ${zombies.length} zombie participants`);
    
    // Mark them as left
    await db
      .from('voice_participant')
      .update({ leftAt: new Date().toISOString() })
      .in('id', zombies.map(z => z.id));
    
    // Check if any rooms should be closed
    for (const zombie of zombies) {
      const { count } = await db
        .from('voice_participant')
        .select('*', { count: 'exact', head: true })
        .eq('voiceRoomId', zombie.voiceRoomId)
        .is('leftAt', null);
      
      if (count === 0) {
        await db
          .from('voice_room')
          .update({ 
            isActive: false,
            endedAt: new Date().toISOString()
          })
          .eq('id', zombie.voiceRoomId);
      }
    }
  }
}

// Run every 5 minutes
setInterval(cleanupZombieParticipants, 5 * 60 * 1000);
```

### Solution 2: Improve Client-Side Cleanup (Frontend)

Add better error handling and retry logic:

```typescript
// src/hooks/useVoiceRoom.ts
const leaveRoom = async (retries = 3) => {
  if (!user || !activeRoom) return;
  
  for (let i = 0; i < retries; i++) {
    try {
      await api.post(`/api/voice-rooms/leave`, {
        userId: user.id,
        voiceRoomId: activeRoom.id,
      });
      
      setRoomState(prev => ({ ...prev, token: null, serverUrl: null }));
      fetchActiveRoom();
      return; // Success
    } catch (err) {
      console.error(`[useVoiceRoom] Leave attempt ${i + 1} failed:`, err);
      if (i === retries - 1) {
        // Last attempt failed - log for debugging
        console.error("[useVoiceRoom] All leave attempts failed");
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
    }
  }
};
```

### Solution 3: Add Heartbeat System

Implement a heartbeat to detect disconnected participants:

```typescript
// Add a lastHeartbeat timestamp to voice_participant
// Update it every 30 seconds while connected
// Backend job marks participants as left if lastHeartbeat > 2 minutes ago
```

### Solution 4: LiveKit Webhook Improvements

The `room_finished` webhook should clean up ALL participants:

```typescript
// backend/src/routes/webhooks.ts
async function handleRoomFinished(event: any) {
  const roomName = event.room?.name;
  
  if (!roomName) return;
  
  // Mark ALL participants as left (in case some didn't call leave API)
  await db
    .from('voice_participant')
    .update({ leftAt: new Date().toISOString() })
    .eq('voiceRoomId', roomName)
    .is('leftAt', null);
  
  // Mark room as inactive
  await db
    .from('voice_room')
    .update({ 
      isActive: false,
      endedAt: new Date().toISOString()
    })
    .eq('id', roomName);
}
```

## Manual Cleanup Script

If this happens again, run this SQL to clean up:

```sql
-- Find all zombie participants (joined > 1 hour ago, never left)
SELECT 
  vp.id,
  vp."voiceRoomId",
  vp."userId",
  vp."joinedAt",
  vr.name as room_name,
  vr."isActive" as room_active
FROM voice_participant vp
JOIN voice_room vr ON vr.id = vp."voiceRoomId"
WHERE vp."leftAt" IS NULL
AND vp."joinedAt" < NOW() - INTERVAL '1 hour';

-- Mark zombies as left
UPDATE voice_participant
SET "leftAt" = NOW()
WHERE "leftAt" IS NULL
AND "joinedAt" < NOW() - INTERVAL '1 hour';

-- Find rooms with no active participants that are still marked active
SELECT 
  vr.id,
  vr."chatId",
  vr.name,
  vr."isActive",
  COUNT(CASE WHEN vp."leftAt" IS NULL THEN 1 END) as active_participants
FROM voice_room vr
LEFT JOIN voice_participant vp ON vp."voiceRoomId" = vr.id
WHERE vr."isActive" = true
GROUP BY vr.id
HAVING COUNT(CASE WHEN vp."leftAt" IS NULL THEN 1 END) = 0;

-- Mark empty rooms as inactive
UPDATE voice_room vr
SET 
  "isActive" = false,
  "endedAt" = NOW()
WHERE vr."isActive" = true
AND NOT EXISTS (
  SELECT 1 FROM voice_participant vp
  WHERE vp."voiceRoomId" = vr.id
  AND vp."leftAt" IS NULL
);
```

## Recommended Implementation Priority

1. **HIGH**: Implement Solution 4 (Webhook improvements) - Quick win, handles most cases
2. **HIGH**: Implement Solution 1 (Cleanup job) - Safety net for edge cases
3. **MEDIUM**: Implement Solution 2 (Retry logic) - Improves reliability
4. **LOW**: Solution 3 (Heartbeat) - Complex, only needed if issues persist

## Testing Checklist

- [ ] Force-close app while in call - verify participant marked as left
- [ ] Disconnect network while in call - verify cleanup happens
- [ ] Let call run for 1+ hour - verify cleanup job works
- [ ] Multiple people leave at once - verify room closes correctly
- [ ] Last person crashes - verify webhook marks room inactive

## Related Files

- `backend/src/routes/voice-rooms.ts` - Leave endpoint
- `backend/src/routes/webhooks.ts` - LiveKit webhooks
- `src/hooks/useVoiceRoom.ts` - Client-side leave logic
- `src/components/VoiceRoom/VoiceRoomModal.tsx` - Disconnect handling

## Status

✅ **IMMEDIATE FIX APPLIED** - Zombie participant cleaned up
🟡 **LONG-TERM SOLUTIONS PENDING** - Need to implement webhook improvements and cleanup job

