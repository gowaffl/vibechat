import { Hono } from "hono";
import { db } from "../db";
import { env } from "../env";
import { AccessToken, EgressClient, EncodedFileOutput, EncodedFileType, S3Upload, RoomServiceClient } from "livekit-server-sdk";
import {
  joinVoiceRoomRequestSchema,
  leaveVoiceRoomRequestSchema,
  getActiveVoiceRoomRequestSchema,
  type JoinVoiceRoomResponse,
  type LeaveVoiceRoomResponse,
  type GetActiveVoiceRoomResponse,
} from "@shared/contracts";
import type { AppType } from "../index";
import { getUserSubscription } from "../services/subscription-service";

const app = new Hono<AppType>();

// Initialize Egress client for recording control
let egressClient: EgressClient | null = null;

// Initialize RoomService client for participant management
let roomServiceClient: RoomServiceClient | null = null;

function getRoomServiceClient(): RoomServiceClient | null {
  if (!roomServiceClient && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_URL) {
    // Convert ws:// to https:// for API calls
    const httpUrl = env.LIVEKIT_URL.replace("ws://", "http://").replace("wss://", "https://");
    roomServiceClient = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return roomServiceClient;
}

/**
 * Force remove a participant from a LiveKit room
 * This ensures they're disconnected even if the client doesn't disconnect properly
 */
async function forceRemoveParticipant(roomName: string, participantIdentity: string): Promise<void> {
  const client = getRoomServiceClient();
  
  if (!client) {
    console.log("[VoiceRooms] RoomService client not available - skipping force removal");
    return;
  }
  
  try {
    console.log(`[VoiceRooms] Force removing participant ${participantIdentity} from room ${roomName}`);
    await client.removeParticipant(roomName, participantIdentity);
    console.log(`[VoiceRooms] Successfully removed participant ${participantIdentity}`);
  } catch (error: any) {
    // Ignore "participant not found" errors - they may have already left
    if (error?.message?.includes('not found') || error?.code === 'NOT_FOUND') {
      console.log(`[VoiceRooms] Participant ${participantIdentity} already left room`);
    } else {
      console.error("[VoiceRooms] Failed to remove participant:", error);
    }
  }
}

function getEgressClient(): EgressClient | null {
  if (!egressClient && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_URL) {
    // Convert ws:// to https:// for API calls
    const httpUrl = env.LIVEKIT_URL.replace("ws://", "http://").replace("wss://", "https://");
    egressClient = new EgressClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return egressClient;
}

/**
 * Start recording a room using LiveKit Egress
 * Records audio-only to save bandwidth and storage
 */
async function startRoomRecording(roomName: string): Promise<string | null> {
  const client = getEgressClient();
  
  if (!client) {
    console.log("[VoiceRooms] Egress client not available - recording disabled");
    return null;
  }
  
  // Check if S3 credentials are configured
  if (!env.SUPABASE_S3_ENDPOINT || !env.SUPABASE_S3_ACCESS_KEY || !env.SUPABASE_S3_SECRET_KEY) {
    console.log("[VoiceRooms] S3 credentials not configured - recording disabled");
    return null;
  }
  
  try {
    console.log(`[VoiceRooms] Starting recording for room: ${roomName}`);
    
    // Configure S3 output (Supabase Storage)
    const s3Config = new S3Upload({
      accessKey: env.SUPABASE_S3_ACCESS_KEY,
      secret: env.SUPABASE_S3_SECRET_KEY,
      bucket: env.SUPABASE_S3_BUCKET || "vibe-call-recordings",
      endpoint: env.SUPABASE_S3_ENDPOINT,
      forcePathStyle: true, // Required for Supabase S3
    });
    
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `${roomName}/{time}.mp4`,
      output: {
        case: "s3",
        value: s3Config,
      },
    });
    
    // Start room composite egress (audio only)
    // Using the new RoomCompositeOptions API
    const egress = await client.startRoomCompositeEgress(
      roomName,
      { file: fileOutput },
      { audioOnly: true }
    );
    
    console.log(`[VoiceRooms] Recording started, egress ID: ${egress.egressId}`);
    return egress.egressId;
    
  } catch (error) {
    console.error("[VoiceRooms] Failed to start recording:", error);
    return null;
  }
}

/**
 * Stop recording a room
 */
async function stopRoomRecording(egressId: string): Promise<void> {
  const client = getEgressClient();
  
  if (!client || !egressId) {
    return;
  }
  
  try {
    console.log(`[VoiceRooms] Stopping recording, egress ID: ${egressId}`);
    await client.stopEgress(egressId);
    console.log(`[VoiceRooms] Recording stopped`);
  } catch (error) {
    console.error("[VoiceRooms] Failed to stop recording:", error);
  }
}

// GET /api/voice-rooms/:chatId/active - Get active Vibe Call for a chat
app.get("/:chatId/active", async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    // Check if user is member of chat
    const { data: member, error: memberError } = await db
      .from("chat_member")
      .select("id")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (memberError || !member) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Get active room
    const { data: activeRoom, error: roomError } = await db
      .from("voice_room")
      .select("*")
      .eq("chatId", chatId)
      .eq("isActive", true)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (roomError && roomError.code !== "PGRST116") { // PGRST116 is "no rows found"
      console.error("[VoiceRooms] Error fetching active room:", roomError);
      return c.json({ error: "Failed to fetch active room" }, 500);
    }

    if (!activeRoom) {
      return c.json(null);
    }

    // Get participants
    const { data: participants, error: participantsError } = await db
      .from("voice_participant")
      .select("*, user:userId(*)")
      .eq("voiceRoomId", activeRoom.id)
      .is("leftAt", null);

    if (participantsError) {
      console.error("[VoiceRooms] Error fetching participants:", participantsError);
      return c.json({ error: "Failed to fetch participants" }, 500);
    }

    const response: GetActiveVoiceRoomResponse = {
      ...activeRoom,
      participants: participants || [],
    };

    return c.json(response);
  } catch (error) {
    console.error("[VoiceRooms] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/voice-rooms/join - Join or create a Vibe Call
app.post("/join", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = joinVoiceRoomRequestSchema.parse(body);
    const { chatId, userId } = validatedData;

    // ============================================================================
    // PRO-ONLY CHECK - Vibe Calls are only available for Pro subscribers
    // ============================================================================
    const subscription = await getUserSubscription(userId);
    const isPro = subscription?.currentPlan === "pro";
    const isInTrial = subscription?.isTrial && subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
    
    if (!isPro && !isInTrial) {
      console.log(`[VoiceRooms] User ${userId} attempted to join voice room without Pro subscription`);
      return c.json({
        error: "Vibe Calls are only available for Pro subscribers",
        code: "PRO_REQUIRED",
        upgradeUrl: "/subscription",
      }, 403);
    }

    // Check membership
    const { data: member, error: memberError } = await db
      .from("chat_member")
      .select("id")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (memberError || !member) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for existing active room
    let { data: activeRoom } = await db
      .from("voice_room")
      .select("*")
      .eq("chatId", chatId)
      .eq("isActive", true)
      .single();

    // If no active room, create one
    if (!activeRoom) {
      const { data: newRoom, error: createError } = await db
        .from("voice_room")
        .insert({
          chatId,
          createdBy: userId,
          name: validatedData.name || "Vibe Call",
          isActive: true,
          startedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !newRoom) {
        console.error("[VoiceRooms] Error creating room:", createError);
        return c.json({ error: "Failed to create Vibe Call" }, 500);
      }
      activeRoom = newRoom;
      
      // Start recording for the new room (async, don't block)
      startRoomRecording(newRoom.id).then((egressId) => {
        if (egressId) {
          // Store egress ID in room metadata for later reference
          db.from("voice_room")
            .update({ liveKitRoomId: egressId }) // Reuse liveKitRoomId to store egress ID
            .eq("id", newRoom.id)
            .then(() => {
              console.log(`✅ [VoiceRooms] Egress ID stored for room ${newRoom.id}`);
            });
        }
      }).catch((err) => {
        console.error("[VoiceRooms] Failed to start recording:", err);
      });
    }

    // Add user as participant (if not already)
    const { data: existingParticipant } = await db
      .from("voice_participant")
      .select("*")
      .eq("voiceRoomId", activeRoom.id)
      .eq("userId", userId)
      .is("leftAt", null)
      .single();

    let participantId = existingParticipant?.id;

    if (!existingParticipant) {
      const { data: newParticipant, error: joinError } = await db
        .from("voice_participant")
        .insert({
          voiceRoomId: activeRoom.id,
          userId,
          joinedAt: new Date().toISOString(),
          role: "speaker",
        })
        .select()
        .single();

              if (joinError || !newParticipant) {
                console.error("[VoiceRooms] Error joining room:", joinError);
                return c.json({ error: "Failed to join Vibe Call" }, 500);
              }
              participantId = newParticipant.id;
            }

    // Generate LiveKit token
    const apiKey = env.LIVEKIT_API_KEY;
    const apiSecret = env.LIVEKIT_API_SECRET;
    const wsUrl = env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.warn("[VoiceRooms] LiveKit credentials missing, using mock token");
    }

    const roomName = activeRoom.id;
    const participantIdentity = userId;

    // Fetch user details for metadata
    const { data: user } = await db
      .from("user")
      .select("name, image")
      .eq("id", userId)
      .single();

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: user?.name || userId,
      metadata: JSON.stringify({
        image: user?.image || null,
      })
    });

    at.addGrant({ 
      roomJoin: true, 
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    const response: JoinVoiceRoomResponse = {
      room: activeRoom,
      token,
      participantId: participantId!,
      serverUrl: wsUrl,
    };

    return c.json(response);
  } catch (error) {
    console.error("[VoiceRooms] Join error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/voice-rooms/leave - Leave a Vibe Call
app.post("/leave", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = leaveVoiceRoomRequestSchema.parse(body);
    const { voiceRoomId, userId } = validatedData;

    console.log(`[VoiceRooms] User ${userId} leaving room ${voiceRoomId}`);

    // Force remove the participant from LiveKit server first
    // This ensures they're disconnected even if client didn't disconnect properly
    await forceRemoveParticipant(voiceRoomId, userId);

    // Update participant record in database
    const { error: leaveError } = await db
      .from("voice_participant")
      .update({ leftAt: new Date().toISOString() })
      .eq("voiceRoomId", voiceRoomId)
      .eq("userId", userId)
      .is("leftAt", null);

    if (leaveError) {
      console.error("[VoiceRooms] Error leaving room:", leaveError);
      return c.json({ error: "Failed to leave Vibe Call" }, 500);
    }

    // Check if room is empty
    const { count } = await db
      .from("voice_participant")
      .select("*", { count: "exact", head: true })
      .eq("voiceRoomId", voiceRoomId)
      .is("leftAt", null);

    console.log(`[VoiceRooms] Remaining participants in room ${voiceRoomId}: ${count}`);

    // If empty, close the room and stop recording
    if (count === 0) {
      console.log(`[VoiceRooms] Room ${voiceRoomId} is empty, ending call`);
      
      // Get the room to check for egress ID
      const { data: room } = await db
        .from("voice_room")
        .select("liveKitRoomId")
        .eq("id", voiceRoomId)
        .single();
      
      // Stop recording if active
      if (room?.liveKitRoomId) {
        stopRoomRecording(room.liveKitRoomId).catch((err) => {
          console.error("[VoiceRooms] Error stopping recording:", err);
        });
      }
      
      await db
        .from("voice_room")
        .update({ 
          isActive: false,
          endedAt: new Date().toISOString()
        })
        .eq("id", voiceRoomId);
        
      console.log(`[VoiceRooms] Room ${voiceRoomId} marked as ended`);
    }

    const response: LeaveVoiceRoomResponse = { success: true };
    return c.json(response);
  } catch (error) {
    console.error("[VoiceRooms] Leave error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;

