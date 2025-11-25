import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppType } from "../index";
import {
  markMessagesAsReadRequestSchema,
  markMessagesAsReadResponseSchema,
  getUnreadCountsRequestSchema,
  getUnreadCountsResponseSchema,
} from "../../../shared/contracts";
import { db } from "../db";

const notifications = new Hono<AppType>();

// POST /api/chats/:chatId/read-receipts - Mark messages as read
notifications.post("/chats/:chatId/read-receipts", zValidator("json", markMessagesAsReadRequestSchema), async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const { userId, messageIds } = c.req.valid("json");

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "User is not a member of this chat" }, 403);
    }

    // Create read receipts for all messages that don't already have one
    const readReceipts = await Promise.all(
      messageIds.map(async (messageId: string) => {
        // Check if read receipt already exists
        const { data: existing } = await db
          .from("read_receipt")
          .select("id")
          .eq("userId", userId)
          .eq("messageId", messageId)
          .single();

        if (existing) {
          // Update existing
          return db
            .from("read_receipt")
            .update({ readAt: new Date().toISOString() })
            .eq("userId", userId)
            .eq("messageId", messageId);
        } else {
          // Create new
          return db
            .from("read_receipt")
            .insert({
              userId,
              chatId,
              messageId,
            });
        }
      })
    );

    return c.json(markMessagesAsReadResponseSchema.parse({
      success: true,
      message: "Messages marked as read",
      markedCount: readReceipts.length,
    }));
  } catch (error) {
    console.error("[Notifications] Error marking messages as read:", error);
    return c.json({ error: "Failed to mark messages as read" }, 500);
  }
});

// GET /api/chats/unread-counts - Get unread message counts for all user's chats
notifications.get("/chats/unread-counts", async (c) => {
  try {
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    // Get all chats the user is a member of
    const { data: memberships = [], error: memberError } = await db
      .from("chat_member")
      .select("chatId")
      .eq("userId", userId);

    if (memberError) {
      console.error("[Notifications] Error fetching memberships:", memberError);
      return c.json({ error: "Failed to get unread counts" }, 500);
    }

    const chatIds = memberships.map((m: any) => m.chatId);

    // For each chat, count unread messages
    const unreadCounts = await Promise.all(
      chatIds.map(async (chatId: string) => {
        // Get all messages in this chat (excluding current user and system messages)
        const { data: messages = [] } = await db
          .from("message")
          .select("id")
          .eq("chatId", chatId)
          .neq("userId", userId)
          .neq("messageType", "system");

        const messageIds = messages.map((m: any) => m.id);

        if (messageIds.length === 0) {
          return { chatId, unreadCount: 0 };
        }

        // Count messages that don't have a read receipt from this user
        const { data: readReceipts = [] } = await db
          .from("read_receipt")
          .select("messageId")
          .eq("userId", userId)
          .eq("chatId", chatId)
          .in("messageId", messageIds);

        const readMessageIdSet = new Set(readReceipts.map((r: any) => r.messageId));
        const unreadCount = messageIds.filter((id: string) => !readMessageIdSet.has(id)).length;

        return {
          chatId,
          unreadCount,
        };
      })
    );

    return c.json(getUnreadCountsResponseSchema.parse(unreadCounts));
  } catch (error) {
    console.error("[Notifications] Error getting unread counts:", error);
    return c.json({ error: "Failed to get unread counts" }, 500);
  }
});

export default notifications;
