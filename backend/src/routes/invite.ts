import { Hono } from "hono";
import { db } from "../db";
import type { AppType } from "../index";
import {
  joinChatViaInviteRequestSchema,
} from "../../../shared/contracts";

const invite = new Hono<AppType>();

// GET /api/invite/:token - Get chat info from invite token
invite.get("/:token", async (c) => {
  const token = c.req.param("token");

  try {
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("inviteToken", token)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Invalid invite link" }, 404);
    }

    // Check if invite token has expired
    if (chat.inviteTokenExpiresAt && new Date(chat.inviteTokenExpiresAt) < new Date()) {
      return c.json({ error: "Invite link has expired" }, 410);
    }

    // Count members
    const { count: memberCount, error: countError } = await db
      .from("chat_member")
      .select("*", { count: "exact", head: true })
      .eq("chatId", chat.id);

    if (countError) {
      console.error("[Invite] Error counting members:", countError);
    }

    return c.json({
      chatId: chat.id,
      chatName: chat.name,
      chatImage: chat.image,
      chatBio: chat.bio,
      memberCount: memberCount || 0,
    });
  } catch (error) {
    console.error("[Invite] Error fetching invite info:", error);
    return c.json({ error: "Failed to fetch invite info" }, 500);
  }
});

// POST /api/invite/:token/join - Join chat via invite token
invite.post("/:token/join", async (c) => {
  const token = c.req.param("token");

  try {
    const body = await c.req.json();
    const validated = joinChatViaInviteRequestSchema.parse(body);

    // Find the chat with this invite token
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("inviteToken", token)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Invalid invite link" }, 404);
    }

    // Check if invite token has expired
    if (chat.inviteTokenExpiresAt && new Date(chat.inviteTokenExpiresAt) < new Date()) {
      return c.json({ error: "Invite link has expired. Please ask for a new invite link." }, 410);
    }

    // Check if user is already a member
    const { data: existingMember } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chat.id)
      .eq("userId", validated.userId)
      .single();

    if (existingMember) {
      return c.json({
        success: true,
        chatId: chat.id,
        message: "You are already a member of this chat",
      });
    }

    // Get user info for the join message
    const { data: user, error: userError } = await db
      .from("user")
      .select("*")
      .eq("id", validated.userId)
      .single();

    if (userError || !user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Add user as member
    const { error: memberError } = await db
      .from("chat_member")
      .insert({
        chatId: chat.id,
        userId: validated.userId,
      });

    if (memberError) {
      console.error("[Invite] Error adding member:", memberError);
      return c.json({ error: "Failed to join chat" }, 500);
    }

    // Create a system join message
    const { error: messageError } = await db
      .from("message")
      .insert({
        content: `${user.name} has joined the chat`,
        messageType: "system",
        userId: "system",
        chatId: chat.id,
      });

    if (messageError) {
      console.error("[Invite] Error creating join message:", messageError);
    }

    return c.json({
      success: true,
      chatId: chat.id,
      message: "Successfully joined the chat",
    });
  } catch (error) {
    console.error("[Invite] Error joining chat:", error);
    return c.json({ error: "Failed to join chat" }, 500);
  }
});

export default invite;
