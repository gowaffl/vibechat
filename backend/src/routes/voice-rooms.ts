import { Hono } from "hono";
import { db } from "../db";
import { env } from "../env";
import { AccessToken } from "livekit-server-sdk";
import {
  joinVoiceRoomRequestSchema,
  leaveVoiceRoomRequestSchema,
  getActiveVoiceRoomRequestSchema,
  type JoinVoiceRoomResponse,
  type LeaveVoiceRoomResponse,
  type GetActiveVoiceRoomResponse,
} from "@shared/contracts";
import type { AppType } from "../index";

const app = new Hono<AppType>();

// GET /api/voice-rooms/:chatId/active - Get active voice room for a chat
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

// POST /api/voice-rooms/join - Join or create a voice room
app.post("/join", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = joinVoiceRoomRequestSchema.parse(body);
    const { chatId, userId } = validatedData;

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
          name: validatedData.name || "Voice Room",
          isActive: true,
          startedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !newRoom) {
        console.error("[VoiceRooms] Error creating room:", createError);
        return c.json({ error: "Failed to create voice room" }, 500);
      }
      activeRoom = newRoom;
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
        return c.json({ error: "Failed to join voice room" }, 500);
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

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: userId,
    });

    at.addGrant({ roomJoin: true, room: roomName });

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

// POST /api/voice-rooms/leave - Leave a voice room
app.post("/leave", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = leaveVoiceRoomRequestSchema.parse(body);
    const { voiceRoomId, userId } = validatedData;

    // Update participant record
    const { error: leaveError } = await db
      .from("voice_participant")
      .update({ leftAt: new Date().toISOString() })
      .eq("voiceRoomId", voiceRoomId)
      .eq("userId", userId)
      .is("leftAt", null);

    if (leaveError) {
      console.error("[VoiceRooms] Error leaving room:", leaveError);
      return c.json({ error: "Failed to leave room" }, 500);
    }

    // Check if room is empty
    const { count } = await db
      .from("voice_participant")
      .select("*", { count: "exact", head: true })
      .eq("voiceRoomId", voiceRoomId)
      .is("leftAt", null);

    // If empty, close the room
    if (count === 0) {
      await db
        .from("voice_room")
        .update({ 
          isActive: false,
          endedAt: new Date().toISOString()
        })
        .eq("id", voiceRoomId);
    }

    const response: LeaveVoiceRoomResponse = { success: true };
    return c.json(response);
  } catch (error) {
    console.error("[VoiceRooms] Leave error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;

