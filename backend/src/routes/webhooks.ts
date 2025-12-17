import { Hono } from "hono";
import { WebhookReceiver } from "livekit-server-sdk";
import { db } from "../db";
import { env } from "../env";
import { transcribeFromUrl } from "../services/voice-transcription";
import { generateVibeCallSummary } from "../services/summary-service";
import type { AppType } from "../index";

const app = new Hono<AppType>();

/**
 * LiveKit Webhook Handler
 * Receives events from LiveKit when rooms/egress state changes
 * 
 * Configure this webhook URL in your LiveKit Cloud dashboard:
 * POST https://your-backend.com/api/webhooks/livekit
 */
app.post("/livekit", async (c) => {
  try {
    const body = await c.req.text();
    const authHeader = c.req.header("Authorization");

    // Verify webhook signature if secret is configured
    if (env.LIVEKIT_WEBHOOK_SECRET) {
      const receiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      
      try {
        const event = await receiver.receive(body, authHeader);
        console.log(`[Webhook] Received LiveKit event: ${event.event}`);
        
        // Handle different event types
        switch (event.event) {
          case "egress_ended":
            await handleEgressEnded(event);
            break;
          case "room_finished":
            await handleRoomFinished(event);
            break;
          default:
            console.log(`[Webhook] Unhandled event type: ${event.event}`);
        }
        
        return c.json({ success: true });
      } catch (verifyError) {
        console.error("[Webhook] Signature verification failed:", verifyError);
        return c.json({ error: "Invalid signature" }, 401);
      }
    } else {
      // No secret configured - parse directly (development mode)
      console.warn("[Webhook] No LIVEKIT_WEBHOOK_SECRET configured - skipping signature verification");
      const event = JSON.parse(body);
      console.log(`[Webhook] Received LiveKit event: ${event.event}`);
      
      switch (event.event) {
        case "egress_ended":
          await handleEgressEnded(event);
          break;
        case "room_finished":
          await handleRoomFinished(event);
          break;
        default:
          console.log(`[Webhook] Unhandled event type: ${event.event}`);
      }
      
      return c.json({ success: true });
    }
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * Handle egress_ended event - triggered when a recording finishes
 */
async function handleEgressEnded(event: any) {
  try {
    const egressInfo = event.egressInfo;
    
    if (!egressInfo) {
      console.error("[Webhook] No egressInfo in egress_ended event");
      return;
    }

    const roomName = egressInfo.roomName; // This is the voice_room.id
    const status = egressInfo.status;
    
    console.log(`[Webhook] Egress ended for room ${roomName}, status: ${status}`);
    
    // Only process successful egress
    if (status !== "EGRESS_COMPLETE") {
      console.warn(`[Webhook] Egress status is ${status}, skipping processing`);
      return;
    }
    
    // Get the recording URL from the egress info
    let recordingUrl: string | null = null;
    
    // Check for file outputs (S3/GCS)
    if (egressInfo.fileResults && egressInfo.fileResults.length > 0) {
      recordingUrl = egressInfo.fileResults[0].location;
    }
    // Check for segment outputs
    else if (egressInfo.segmentResults && egressInfo.segmentResults.length > 0) {
      recordingUrl = egressInfo.segmentResults[0].playlistLocation;
    }
    // Check for stream outputs (less common for our use case)
    else if (egressInfo.streamResults && egressInfo.streamResults.length > 0) {
      recordingUrl = egressInfo.streamResults[0].url;
    }
    
    if (!recordingUrl) {
      console.error("[Webhook] No recording URL found in egress results");
      return;
    }
    
    console.log(`[Webhook] Recording URL: ${recordingUrl}`);
    
    // Update voice_room with recording URL
    await db
      .from("voice_room")
      .update({ recordingUrl })
      .eq("id", roomName);
    
    // Process the recording asynchronously (transcribe + summarize)
    processRecording(roomName, recordingUrl).catch((err) => {
      console.error(`[Webhook] Error processing recording for room ${roomName}:`, err);
    });
    
  } catch (error) {
    console.error("[Webhook] Error handling egress_ended:", error);
  }
}

/**
 * Handle room_finished event - triggered when all participants leave
 */
async function handleRoomFinished(event: any) {
  try {
    const room = event.room;
    if (!room) return;
    
    const roomName = room.name; // This is the voice_room.id
    
    console.log(`[Webhook] Room finished: ${roomName}`);
    
    // Mark the voice room as inactive
    await db
      .from("voice_room")
      .update({ 
        isActive: false,
        endedAt: new Date().toISOString()
      })
      .eq("id", roomName);
      
  } catch (error) {
    console.error("[Webhook] Error handling room_finished:", error);
  }
}

/**
 * Process a recording: transcribe and generate summary
 */
async function processRecording(voiceRoomId: string, recordingUrl: string) {
  console.log(`[Webhook] Starting processing for room ${voiceRoomId}`);
  
  // 1. Get the voice room details
  const { data: voiceRoom, error: roomError } = await db
    .from("voice_room")
    .select("*, chat:chatId(id, name)")
    .eq("id", voiceRoomId)
    .single();
  
  if (roomError || !voiceRoom) {
    console.error("[Webhook] Voice room not found:", voiceRoomId);
    return;
  }
  
  // 2. Get participants who were in the call
  const { data: participants } = await db
    .from("voice_participant")
    .select("*, user:userId(id, name)")
    .eq("voiceRoomId", voiceRoomId);
  
  const participantNames = participants
    ?.map((p) => p.user?.name || "Unknown")
    .filter((n, i, arr) => arr.indexOf(n) === i) // unique
    .join(", ") || "Unknown participants";
  
  // 3. Transcribe the recording
  console.log(`[Webhook] Transcribing recording for room ${voiceRoomId}...`);
  const transcription = await transcribeFromUrl(recordingUrl);
  
  if (!transcription || transcription === "Transcription failed" || transcription.length < 20) {
    console.warn(`[Webhook] Transcription too short or failed for room ${voiceRoomId}`);
    // Update room with empty transcription
    await db
      .from("voice_room")
      .update({ transcription: transcription || "No transcription available" })
      .eq("id", voiceRoomId);
    return;
  }
  
  console.log(`[Webhook] Transcription complete (${transcription.length} chars)`);
  
  // 4. Generate summary
  console.log(`[Webhook] Generating summary for room ${voiceRoomId}...`);
  const summary = await generateVibeCallSummary(transcription, participantNames);
  
  console.log(`[Webhook] Summary generated (${summary.length} chars)`);
  
  // 5. Update voice_room with transcription and summary
  await db
    .from("voice_room")
    .update({ 
      transcription,
      summary
    })
    .eq("id", voiceRoomId);
  
  // 6. Create a system message in the chat with the summary
  const callStartTime = voiceRoom.startedAt 
    ? new Date(voiceRoom.startedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
  
  const callDuration = voiceRoom.startedAt && voiceRoom.endedAt
    ? formatDuration(new Date(voiceRoom.endedAt).getTime() - new Date(voiceRoom.startedAt).getTime())
    : "Unknown duration";
  
  // Summary message without emojis
  const summaryMessage = `Vibe Call Summary - ${callStartTime}
Participants: ${participantNames}
Duration: ${callDuration}

${summary}`;

  // Insert system message
  const { error: messageError } = await db
    .from("message")
    .insert({
      chatId: voiceRoom.chatId,
      userId: voiceRoom.createdBy, // Use the creator as the sender
      content: summaryMessage,
      messageType: "system", // ✅ Fixed: was "type", should be "messageType"
      metadata: {
        vibeCallSummary: true,
        voiceRoomId: voiceRoomId,
        participants: participants?.map((p) => p.userId) || [],
      },
    });
  
  if (messageError) {
    console.error("[Webhook] Error creating summary message:", messageError);
  } else {
    console.log(`[Webhook] Summary message posted to chat ${voiceRoom.chatId}`);
  }
}

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export default app;
