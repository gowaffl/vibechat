import { Hono } from "hono";
import type { AppType } from "../types";
import { db } from "../db";
import {
  addReactionRequestSchema,
  addReactionResponseSchema,
  deleteReactionResponseSchema,
} from "../../../shared/contracts";
import { formatTimestamp } from "../utils/supabase-helpers";

const reactions = new Hono<AppType>();

// POST /api/reactions - Add or toggle reaction
reactions.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = addReactionRequestSchema.parse(body);

    // First, get the message to obtain the chatId
    const { data: message, error: messageError } = await db
      .from("message")
      .select("chatId")
      .eq("id", validatedData.messageId)
      .single();

    if (messageError || !message) {
      console.error("[REACTIONS] Error fetching message:", messageError);
      return c.json({ error: "Message not found" }, 404);
    }

    const chatId = message.chatId;

    // Check if user already reacted with this emoji
    const { data: existingReaction } = await db
      .from("reaction")
      .select("*")
      .eq("userId", validatedData.userId)
      .eq("messageId", validatedData.messageId)
      .eq("emoji", validatedData.emoji)
      .single();

    if (existingReaction) {
      // If reaction exists, remove it (toggle off)
      const { error: deleteError } = await db
        .from("reaction")
        .delete()
        .eq("id", existingReaction.id);

      if (deleteError) {
        console.error("[REACTIONS] Error removing reaction:", deleteError);
        return c.json({ error: "Failed to remove reaction" }, 500);
      }

      return c.json({
        success: true,
        message: "Reaction removed",
      });
    }

    // Create new reaction
    const { data: reaction, error: createError } = await db
      .from("reaction")
      .insert({
        emoji: validatedData.emoji,
        userId: validatedData.userId,
        messageId: validatedData.messageId,
        chatId: chatId,
      })
      .select()
      .single();

    if (createError) {
      console.error("[REACTIONS] Error creating reaction:", createError);
      return c.json({ error: "Failed to add reaction" }, 500);
    }

    // Fetch user data
    const { data: user, error: userError } = await db
      .from("user")
      .select("*")
      .eq("id", reaction.userId)
      .single();

    if (userError) {
      console.error("[REACTIONS] Error fetching user:", userError);
    }

    return c.json({
      id: reaction.id,
      emoji: reaction.emoji,
      userId: reaction.userId,
      messageId: reaction.messageId,
      createdAt: formatTimestamp(reaction.createdAt),
      user: user ? {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: formatTimestamp(user.createdAt),
        updatedAt: formatTimestamp(user.updatedAt),
      } : null,
    });
  } catch (error) {
    console.error("[REACTIONS] Error adding reaction:", error);
    return c.json({ error: "Failed to add reaction" }, 500);
  }
});

// DELETE /api/reactions/:id - Remove reaction
reactions.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const { error } = await db
      .from("reaction")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[REACTIONS] Error removing reaction:", error);
      return c.json({ error: "Failed to remove reaction" }, 500);
    }

    return c.json({
      success: true,
      message: "Reaction removed",
    });
  } catch (error) {
    console.error("[REACTIONS] Error removing reaction:", error);
    return c.json({ error: "Failed to remove reaction" }, 500);
  }
});

export default reactions;
