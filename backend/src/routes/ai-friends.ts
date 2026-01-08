import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, executeWithRetry } from "../db";
import { formatTimestamp, buildUpdateObject } from "../utils/supabase-helpers";
import {
  getAIFriendsRequestSchema,
  createAIFriendRequestSchema,
  updateAIFriendRequestSchema,
  deleteAIFriendRequestSchema,
  reorderAIFriendsRequestSchema,
} from "@shared/contracts";

const aiFriends = new Hono();

// Color palette for AI friends
const AI_FRIEND_COLORS = [
  "#34C759", // Green
  "#007AFF", // Blue
  "#FF9F0A", // Orange
  "#AF52DE", // Purple
  "#FF453A", // Red
  "#FFD60A", // Yellow
  "#64D2FF", // Cyan
  "#FF375F", // Pink
];

// GET /api/ai-friends/:chatId - Get all AI friends for a chat
aiFriends.get("/:chatId", zValidator("query", getAIFriendsRequestSchema), async (c) => {
  const chatId = c.req.param("chatId");
  const { userId } = c.req.valid("query");

  try {
    // Verify user is a member of this chat (with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Get all AI friends for this chat, ordered by sortOrder
    const { data: friends, error } = await db
      .from("ai_friend")
      .select("*")
      .eq("chatId", chatId)
      .order("sortOrder", { ascending: true });

    if (error) {
      console.error("[AIFriends] Error fetching AI friends:", error);
      return c.json({ error: "Failed to fetch AI friends" }, 500);
    }

    return c.json(
      friends.map((friend) => ({
        id: friend.id,
        chatId: friend.chatId,
        name: friend.name,
        personality: friend.personality,
        tone: friend.tone,
        engagementMode: friend.engagementMode,
        engagementPercent: friend.engagementPercent,
        color: friend.color,
        sortOrder: friend.sortOrder,
        createdBy: friend.createdBy,
        createdAt: formatTimestamp(friend.createdAt),
        updatedAt: formatTimestamp(friend.updatedAt),
      }))
    );
  } catch (error) {
    console.error("[AIFriends] Error fetching AI friends:", error);
    return c.json({ error: "Failed to fetch AI friends" }, 500);
  }
});

// POST /api/ai-friends - Create new AI friend
aiFriends.post("/", zValidator("json", createAIFriendRequestSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Verify user is a member of this chat (with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", data.chatId)
        .eq("userId", data.userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for restricted mode: If restricted, only creator can add AI friends
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", data.chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === data.userId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can add AI friends in restricted mode" }, 403);
      }
    }

    // HIGH-A: Any chat member can now add AI friends (not just creator)
    // Get existing AI friends to determine next sortOrder and color
    const { data: existingFriends, error: friendsError } = await db
      .from("ai_friend")
      .select("*")
      .eq("chatId", data.chatId)
      .order("sortOrder", { ascending: true });

    if (friendsError) {
      console.error("[AIFriends] Error fetching existing friends:", friendsError);
      return c.json({ error: "Failed to fetch existing AI friends" }, 500);
    }

    const nextSortOrder = existingFriends.length;
    const usedColors = new Set(existingFriends.map((f) => f.color));
    
    // Find the first unused color, or cycle back to the beginning
    let assignedColor = AI_FRIEND_COLORS[0];
    for (const color of AI_FRIEND_COLORS) {
      if (!usedColors.has(color)) {
        assignedColor = color;
        break;
      }
    }
    // If all colors are used, use the next color in rotation
    if (usedColors.size >= AI_FRIEND_COLORS.length) {
      assignedColor = AI_FRIEND_COLORS[nextSortOrder % AI_FRIEND_COLORS.length];
    }

    // Create new AI friend
    const { data: newFriend, error: createError } = await db
      .from("ai_friend")
      .insert({
        chatId: data.chatId,
        name: data.name || "AI Friend",
        personality: data.personality || null,
        tone: data.tone || null,
        engagementMode: data.engagementMode || "on-call",
        engagementPercent: data.engagementPercent || null,
        color: assignedColor,
        sortOrder: nextSortOrder,
        createdBy: data.userId, // Track who created this agent
      })
      .select()
      .single();

    if (createError) {
      console.error("[AIFriends] Error creating AI friend:", createError);
      return c.json({ error: "Failed to create AI friend" }, 500);
    }

    return c.json({
      id: newFriend.id,
      chatId: newFriend.chatId,
      name: newFriend.name,
      personality: newFriend.personality,
      tone: newFriend.tone,
      engagementMode: newFriend.engagementMode,
      engagementPercent: newFriend.engagementPercent,
      color: newFriend.color,
      sortOrder: newFriend.sortOrder,
      createdBy: newFriend.createdBy,
      createdAt: formatTimestamp(newFriend.createdAt),
      updatedAt: formatTimestamp(newFriend.updatedAt),
    });
  } catch (error) {
    console.error("[AIFriends] Error creating AI friend:", error);
    return c.json({ error: "Failed to create AI friend" }, 500);
  }
});

// PATCH /api/ai-friends/:id - Update AI friend
aiFriends.patch("/:id", zValidator("json", updateAIFriendRequestSchema), async (c) => {
  const aiFriendId = c.req.param("id");
  const data = c.req.valid("json");

  try {
    // Get the AI friend
    const { data: aiFriend, error: friendError } = await db
      .from("ai_friend")
      .select("*")
      .eq("id", aiFriendId)
      .single();

    if (friendError || !aiFriend) {
      return c.json({ error: "AI friend not found" }, 404);
    }

    // HIGH-A: Verify user is a member of this chat (any member can now edit AI friends, with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", aiFriend.chatId)
        .eq("userId", data.userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for restricted mode: If restricted, only creator can update AI friends
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", aiFriend.chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === data.userId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can edit AI friends in restricted mode" }, 403);
      }
    }

    // Build update object
    const updateData = buildUpdateObject({
      name: data.name,
      personality: data.personality,
      tone: data.tone,
      engagementMode: data.engagementMode,
      engagementPercent: data.engagementPercent,
    });

    if (Object.keys(updateData).length === 0) {
      return c.json({
        id: aiFriend.id,
        chatId: aiFriend.chatId,
        name: aiFriend.name,
        personality: aiFriend.personality,
        tone: aiFriend.tone,
        engagementMode: aiFriend.engagementMode,
        engagementPercent: aiFriend.engagementPercent,
        color: aiFriend.color,
        sortOrder: aiFriend.sortOrder,
        createdBy: aiFriend.createdBy,
        createdAt: formatTimestamp(aiFriend.createdAt),
        updatedAt: formatTimestamp(aiFriend.updatedAt),
      });
    }

    // Update AI friend
    const { data: updated, error: updateError } = await db
      .from("ai_friend")
      .update(updateData)
      .eq("id", aiFriendId)
      .select()
      .single();

    if (updateError) {
      console.error("[AIFriends] Error updating AI friend:", updateError);
      return c.json({ error: "Failed to update AI friend" }, 500);
    }

    return c.json({
      id: updated.id,
      chatId: updated.chatId,
      name: updated.name,
      personality: updated.personality,
      tone: updated.tone,
      engagementMode: updated.engagementMode,
      engagementPercent: updated.engagementPercent,
      color: updated.color,
      sortOrder: updated.sortOrder,
      createdBy: updated.createdBy,
      createdAt: formatTimestamp(updated.createdAt),
      updatedAt: formatTimestamp(updated.updatedAt),
    });
  } catch (error) {
    console.error("[AIFriends] Error updating AI friend:", error);
    return c.json({ error: "Failed to update AI friend" }, 500);
  }
});

// DELETE /api/ai-friends/:id - Delete AI friend
aiFriends.delete("/:id", zValidator("json", deleteAIFriendRequestSchema), async (c) => {
  const aiFriendId = c.req.param("id");
  const { userId } = c.req.valid("json");

  try {
    // Get the AI friend
    const { data: aiFriend, error: friendError } = await db
      .from("ai_friend")
      .select("*")
      .eq("id", aiFriendId)
      .single();

    if (friendError || !aiFriend) {
      return c.json({ error: "AI friend not found" }, 404);
    }

    // HIGH-A: Verify user is a member of this chat (any member can now delete AI friends, with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", aiFriend.chatId)
        .eq("userId", userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for restricted mode: If restricted, only creator can delete AI friends
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", aiFriend.chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === userId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can delete AI friends in restricted mode" }, 403);
      }
    }

    // Check if this is the last AI friend
    const { count, error: countError } = await db
      .from("ai_friend")
      .select("*", { count: "exact", head: true })
      .eq("chatId", aiFriend.chatId);

    if (countError) {
      console.error("[AIFriends] Error counting AI friends:", countError);
      return c.json({ error: "Failed to count AI friends" }, 500);
    }

    if (count && count <= 1) {
      return c.json({ 
        error: "Cannot delete the last AI friend. Each chat must have at least one AI friend." 
      }, 400);
    }

    // Delete AI friend
    const { error: deleteError } = await db
      .from("ai_friend")
      .delete()
      .eq("id", aiFriendId);

    if (deleteError) {
      console.error("[AIFriends] Error deleting AI friend:", deleteError);
      return c.json({ error: "Failed to delete AI friend" }, 500);
    }

    return c.json({
      success: true,
      message: "AI friend deleted successfully",
    });
  } catch (error) {
    console.error("[AIFriends] Error deleting AI friend:", error);
    return c.json({ error: "Failed to delete AI friend" }, 500);
  }
});

// PATCH /api/ai-friends/reorder - Reorder AI friends
aiFriends.patch("/reorder", zValidator("json", reorderAIFriendsRequestSchema), async (c) => {
  const { chatId, userId, items } = c.req.valid("json");

  try {
    // HIGH-A: Verify user is a member of this chat (any member can now reorder AI friends, with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .single();
    });

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Update sortOrder for each AI friend
    await Promise.all(
      items.map(async (item) => {
        const { error } = await db
          .from("ai_friend")
          .update({ sortOrder: item.sortOrder })
          .eq("id", item.aiFriendId);

        if (error) {
          console.error(`[AIFriends] Error updating sortOrder for ${item.aiFriendId}:`, error);
        }
      })
    );

    return c.json({
      success: true,
      message: "AI friends reordered successfully",
    });
  } catch (error) {
    console.error("[AIFriends] Error reordering AI friends:", error);
    return c.json({ error: "Failed to reorder AI friends" }, 500);
  }
});

export default aiFriends;
