import { Hono } from "hono";
import { db, createUserClient } from "../db";
import type { AppType } from "../index";
import {
  createChatRequestSchema,
  updateChatRequestSchema,
  deleteChatRequestSchema,
  inviteUserToChatRequestSchema,
  removeChatMemberRequestSchema,
  getChatMessagesRequestSchema,
  sendChatMessageRequestSchema,
  clearChatMessagesRequestSchema,
  generateInviteLinkRequestSchema,
  joinChatViaInviteRequestSchema,
  pinChatRequestSchema,
} from "../../../shared/contracts";
import { sendChatPushNotifications } from "../services/push-notifications";
import { tagMessage } from "../services/message-tagger";
import { extractFirstUrl } from "../utils/url-utils";
import { fetchLinkPreview } from "../services/link-preview";

const chats = new Hono<AppType>();

// In-memory typing indicator store: chatId -> { userId -> timestamp }
const typingIndicators = new Map<string, Map<string, number>>();
const TYPING_TIMEOUT = 3000; // 3 seconds

// GET /api/chats - Get all chats for a user
chats.get("/", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    const client = token ? createUserClient(token) : db;

    // Get all chats where user is a member
    const { data: chatMemberships, error } = await client
      .from("chat_member")
      .select("*, chatId, isPinned, pinnedAt")
      .eq("userId", userId)
      .order("isPinned", { ascending: false })
      .order("pinnedAt", { ascending: true });

    if (error) {
      console.error("[Chats] Error fetching user chats:", error);
      return c.json({ error: "Failed to fetch chats" }, 500);
    }

    // Fetch chat details for each membership
    const chatIds = chatMemberships?.map((m: any) => m.chatId) || [];
    const { data: chatsData } = await client
      .from("chat")
      .select("*")
      .in("id", chatIds);
    const chats = chatsData || [];

    // Fetch last messages for each chat
    const lastMessages = await Promise.all(
      chatIds.map(async (chatId: string) => {
        const { data } = await client
          .from("message")
          .select("*")
          .eq("chatId", chatId)
          .order("createdAt", { ascending: false })
          .limit(1);
        return { chatId, message: data?.[0] || null };
      })
    );

    // Fetch member counts for each chat
    const memberCounts = await Promise.all(
      chatIds.map(async (chatId: string) => {
        const { count } = await client
          .from("chat_member")
          .select("*", { count: "exact", head: true })
          .eq("chatId", chatId);
        return { chatId, count: count || 0 };
      })
    );

    const chatMap = new Map(chats.map((c: any) => [c.id, c]));
    const lastMessageMap = new Map(lastMessages.map((m: any) => [m.chatId, m.message]));
    const memberCountMap = new Map(memberCounts.map((m: any) => [m.chatId, m.count]));

    const chatsWithMetadata = (chatMemberships || []).map((membership: any) => {
      const chat = chatMap.get(membership.chatId);
      const lastMessage = lastMessageMap.get(membership.chatId);
      const memberCount = memberCountMap.get(membership.chatId) || 0;

      if (!chat) return null;

      return {
        id: chat.id,
        name: chat.name,
        bio: chat.bio,
        image: chat.image,
        aiPersonality: chat.aiPersonality,
        aiTone: chat.aiTone,
        aiName: chat.aiName,
        aiEngagementMode: chat.aiEngagementMode,
        aiEngagementPercent: chat.aiEngagementPercent,
        lastAvatarGenDate: chat.lastAvatarGenDate ? new Date(chat.lastAvatarGenDate).toISOString() : null,
        avatarPromptUsed: chat.avatarPromptUsed,
        inviteToken: chat.inviteToken,
        creatorId: chat.creatorId,
        createdAt: new Date(chat.createdAt).toISOString(),
        updatedAt: new Date(chat.updatedAt).toISOString(),
        memberCount,
        isCreator: chat.creatorId === userId,
        lastMessage: lastMessage?.content || null,
        lastMessageAt: lastMessage?.createdAt ? new Date(lastMessage.createdAt).toISOString() : null,
        isPinned: membership.isPinned,
        pinnedAt: membership.pinnedAt ? new Date(membership.pinnedAt).toISOString() : null,
      };
    }).filter(Boolean);

    return c.json(chatsWithMetadata);
  } catch (error) {
    console.error("[Chats] Error fetching user chats:", error);
    return c.json({ error: "Failed to fetch chats" }, 500);
  }
});

// POST /api/chats - Create a new chat
chats.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validated = createChatRequestSchema.parse(body);
    const token = c.req.header("Authorization")?.replace("Bearer ", "");

    console.log(`[Chats] Creating chat. Creator: ${validated.creatorId}, Token present: ${!!token}`);

    // Use user-scoped client if token is available to respect RLS and set auth.uid()
    const client = token ? createUserClient(token) : db;

    // Create the chat using RPC function to safely bypass RLS and ensure atomicity
    const { data: newChat, error: chatError } = await client.rpc("create_chat", {
      name: validated.name,
      creator_id: validated.creatorId,
      bio: validated.bio || null,
      image: validated.image || null,
    }).single();

    if (chatError || !newChat) {
      console.error("[Chats] Error creating chat:", chatError);
      return c.json({ error: "Failed to create chat" }, 500);
    }

    // Note: Member addition is handled inside the create_chat RPC function now
    const chat = newChat as any;
    
    return c.json({
      id: chat.id,
      name: chat.name,
      bio: chat.bio,
      image: chat.image,
      aiPersonality: chat.aiPersonality,
      aiTone: chat.aiTone,
      aiName: chat.aiName,
      lastAvatarGenDate: chat.lastAvatarGenDate ? new Date(chat.lastAvatarGenDate).toISOString() : null,
      avatarPromptUsed: chat.avatarPromptUsed,
      creatorId: chat.creatorId,
      createdAt: new Date(chat.createdAt).toISOString(),
      updatedAt: new Date(chat.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error("[Chats] Error creating chat:", error);
    return c.json({ error: "Failed to create chat" }, 500);
  }
});

// GET /api/chats/unread-counts - Get unread message counts for all user's chats
// IMPORTANT: This route must come BEFORE /:id route to avoid matching "unread-counts" as a chat ID
chats.get("/unread-counts", async (c) => {
  try {
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    const client = token ? createUserClient(token) : db;

    // Get all chats the user is a member of
    const { data: memberships, error: memberError } = await client
      .from("chat_member")
      .select("chatId")
      .eq("userId", userId);

    if (memberError) {
      console.error("[Chats] Error fetching memberships:", memberError);
      return c.json({ error: "Failed to get unread counts" }, 500);
    }

    const chatIds = (memberships || []).map((m: any) => m.chatId);

    // For each chat, count unread messages
    const unreadCounts = await Promise.all(
      chatIds.map(async (chatId: string) => {
        // Get all messages in this chat (excluding current user and system messages)
        const { data: messagesData } = await client
          .from("message")
          .select("id")
          .eq("chatId", chatId)
          .neq("userId", userId)
          .neq("messageType", "system");

        const messages = messagesData || [];
        const messageIds = messages.map((m: any) => m.id);

        if (messageIds.length === 0) {
          return { chatId, unreadCount: 0 };
        }

        // Count messages that don't have a read receipt from this user
        const { data: readReceiptsData } = await client
          .from("read_receipt")
          .select("messageId")
          .eq("userId", userId)
          .eq("chatId", chatId)
          .in("messageId", messageIds);

        const readReceipts = readReceiptsData || [];

        const readMessageIdSet = new Set(readReceipts.map((r: any) => r.messageId));
        const unreadCount = messageIds.filter((id) => !readMessageIdSet.has(id)).length;

        return {
          chatId,
          unreadCount,
        };
      })
    );

    return c.json(unreadCounts);
  } catch (error) {
    console.error("[Chats] Error getting unread counts:", error);
    return c.json({ error: "Failed to get unread counts" }, 500);
  }
});

// GET /api/chats/:id - Get a specific chat
chats.get("/:id", async (c) => {
  const chatId = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Always use db (service role) for membership checks to bypass RLS
    // This ensures single-member chats work correctly
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .maybeSingle(); // Use maybeSingle() to avoid error when no rows found

    // If not a member, auto-add them and create a join message
    if (!membership) {
      // First check if the chat exists
      const { data: chatExists, error: chatCheckError } = await db
        .from("chat")
        .select("id")
        .eq("id", chatId)
        .maybeSingle(); // Use maybeSingle() to avoid error when no rows found

      if (chatCheckError || !chatExists) {
        return c.json({ error: "Chat not found" }, 404);
      }

      // Get user info
      const { data: user, error: userError } = await db
        .from("user")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Add user as member
      await db
        .from("chat_member")
        .insert({
          chatId,
          userId,
        });

      // Create a system join message
      await db
        .from("message")
        .insert({
          content: `${user.name} has joined the chat`,
          messageType: "system",
          userId: "system",
          chatId,
        });
    }

    // Get chat details
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    // Get chat members
    const { data: membersData } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId);
    const members = membersData || [];

    // Fetch user data for each member
    const memberUserIds = members.map((m: any) => m.userId);
    const { data: memberUsersData } = await db
      .from("user")
      .select("*")
      .in("id", memberUserIds);
    const memberUsers = memberUsersData || [];

    const userMap = new Map(memberUsers.map((u: any) => [u.id, u]));

    return c.json({
      id: chat.id,
      name: chat.name,
      bio: chat.bio,
      image: chat.image,
      aiPersonality: chat.aiPersonality,
      aiTone: chat.aiTone,
      aiName: chat.aiName,
      aiEngagementMode: chat.aiEngagementMode,
      aiEngagementPercent: chat.aiEngagementPercent,
      lastAvatarGenDate: chat.lastAvatarGenDate ? new Date(chat.lastAvatarGenDate).toISOString() : null,
      avatarPromptUsed: chat.avatarPromptUsed,
      inviteToken: chat.inviteToken,
      creatorId: chat.creatorId,
      createdAt: new Date(chat.createdAt).toISOString(),
      updatedAt: new Date(chat.updatedAt).toISOString(),
      members: members.map((m: any) => {
        const user = userMap.get(m.userId);
        return {
          id: m.id,
          chatId: m.chatId,
          userId: m.userId,
          joinedAt: new Date(m.joinedAt).toISOString(),
          user: user ? {
            id: user.id,
            name: user.name,
            bio: user.bio,
            image: user.image,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            createdAt: new Date(user.createdAt).toISOString(),
            updatedAt: new Date(user.updatedAt).toISOString(),
          } : null,
        };
      }),
      isCreator: chat.creatorId === userId,
    });
  } catch (error) {
    console.error("[Chats] Error fetching chat:", error);
    return c.json({ error: "Failed to fetch chat" }, 500);
  }
});

// PATCH /api/chats/:id - Update chat (creator only)
chats.patch("/:id", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = updateChatRequestSchema.parse(body);

    // Check if user is the creator
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    if (chat.creatorId !== validated.userId) {
      return c.json({ error: "Only the creator can update chat settings" }, 403);
    }

    // Build update object
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.bio !== undefined) updateData.bio = validated.bio;
    if (validated.image !== undefined) updateData.image = validated.image;
    if (validated.aiPersonality !== undefined) updateData.aiPersonality = validated.aiPersonality;
    if (validated.aiTone !== undefined) updateData.aiTone = validated.aiTone;
    if (validated.aiName !== undefined) updateData.aiName = validated.aiName;
    if (validated.aiEngagementMode !== undefined) updateData.aiEngagementMode = validated.aiEngagementMode;
    if (validated.aiEngagementPercent !== undefined) updateData.aiEngagementPercent = validated.aiEngagementPercent;

    // Update chat
    const { data: updatedChat, error: updateError } = await db
      .from("chat")
      .update(updateData)
      .eq("id", chatId)
      .select("*")
      .single();

    if (updateError || !updatedChat) {
      console.error("[Chats] Error updating chat:", updateError);
      return c.json({ error: "Failed to update chat" }, 500);
    }

    return c.json({
      id: updatedChat.id,
      name: updatedChat.name,
      bio: updatedChat.bio,
      image: updatedChat.image,
      aiPersonality: updatedChat.aiPersonality,
      aiTone: updatedChat.aiTone,
      aiName: updatedChat.aiName,
      aiEngagementMode: updatedChat.aiEngagementMode,
      aiEngagementPercent: updatedChat.aiEngagementPercent,
      lastAvatarGenDate: updatedChat.lastAvatarGenDate ? new Date(updatedChat.lastAvatarGenDate).toISOString() : null,
      avatarPromptUsed: updatedChat.avatarPromptUsed,
      inviteToken: updatedChat.inviteToken,
      creatorId: updatedChat.creatorId,
      createdAt: new Date(updatedChat.createdAt).toISOString(),
      updatedAt: new Date(updatedChat.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error("[Chats] Error updating chat:", error);
    return c.json({ error: "Failed to update chat" }, 500);
  }
});

// DELETE /api/chats/:id - Delete chat (creator only)
chats.delete("/:id", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = deleteChatRequestSchema.parse(body);

    // Check if user is the creator
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    if (chat.creatorId !== validated.userId) {
      return c.json({ error: "Only the creator can delete this chat" }, 403);
    }

    // Delete chat (cascade will handle members, messages, etc.)
    const { error: deleteError } = await db
      .from("chat")
      .delete()
      .eq("id", chatId);

    if (deleteError) {
      console.error("[Chats] Error deleting chat:", deleteError);
      return c.json({ error: "Failed to delete chat" }, 500);
    }

    return c.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("[Chats] Error deleting chat:", error);
    return c.json({ error: "Failed to delete chat" }, 500);
  }
});

// POST /api/chats/:id/invite - Invite a user to a chat
chats.post("/:id/invite", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = inviteUserToChatRequestSchema.parse(body);

    // Check if inviter is a member
    const { data: inviterMembership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", validated.inviterId)
      .single();

    if (!inviterMembership) {
      return c.json({ error: "You must be a member to invite others" }, 403);
    }

    // Check if user to invite exists
    const { data: userToInvite, error: userError } = await db
      .from("user")
      .select("*")
      .eq("id", validated.userIdToInvite)
      .single();

    if (userError || !userToInvite) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if already a member
    const { data: existingMembership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", validated.userIdToInvite)
      .single();

    if (existingMembership) {
      return c.json({ error: "User is already a member" }, 400);
    }

    // Add user as member
    const { data: newMembership, error: memberError } = await db
      .from("chat_member")
      .insert({
        chatId,
        userId: validated.userIdToInvite,
      })
      .select("*")
      .single();

    if (memberError || !newMembership) {
      console.error("[Chats] Error adding member:", memberError);
      return c.json({ error: "Failed to invite user" }, 500);
    }

    // Create a system message to notify the chat
    await db
      .from("message")
      .insert({
        content: `${userToInvite.name} has joined the chat`,
        messageType: "system",
        userId: "system",
        chatId,
      });

    return c.json({
      id: newMembership.id,
      chatId: newMembership.chatId,
      userId: newMembership.userId,
      joinedAt: new Date(newMembership.joinedAt).toISOString(),
    });
  } catch (error) {
    console.error("[Chats] Error inviting user:", error);
    return c.json({ error: "Failed to invite user" }, 500);
  }
});

// DELETE /api/chats/:id/members/:userId - Remove member or leave chat
chats.delete("/:id/members/:userId", async (c) => {
  const chatId = c.req.param("id");
  const userIdToRemove = c.req.param("userId");

  try {
    const body = await c.req.json();
    const validated = removeChatMemberRequestSchema.parse(body);

    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    const isCreator = chat.creatorId === validated.removerId;
    const isSelf = validated.removerId === userIdToRemove;

    // Check permissions
    if (!isSelf && !isCreator) {
      return c.json({ error: "Only the creator can remove other members" }, 403);
    }

    // Don't allow creator to leave (they must delete the chat instead)
    if (isSelf && isCreator) {
      return c.json({ error: "Creator cannot leave chat. Delete the chat instead." }, 400);
    }

    // Remove membership
    const { error: deleteError } = await db
      .from("chat_member")
      .delete()
      .eq("chatId", chatId)
      .eq("userId", userIdToRemove);

    if (deleteError) {
      console.error("[Chats] Error removing member:", deleteError);
      return c.json({ error: "Failed to remove member" }, 500);
    }

    return c.json({
      success: true,
      message: isSelf ? "Left chat successfully" : "Member removed successfully",
    });
  } catch (error) {
    console.error("[Chats] Error removing member:", error);
    return c.json({ error: "Failed to remove member" }, 500);
  }
});

// PATCH /api/chats/:id/pin - Pin or unpin a chat for a user
chats.patch("/:id/pin", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = pinChatRequestSchema.parse(body);

    // Check if membership exists
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", validated.userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "Not a member of this chat" }, 404);
    }

    // Update pin status
    const { error: updateError } = await db
      .from("chat_member")
      .update({
        isPinned: validated.isPinned,
        pinnedAt: validated.isPinned ? new Date().toISOString() : null,
      })
      .eq("chatId", chatId)
      .eq("userId", validated.userId);

    if (updateError) {
      console.error("[Chats] Error pinning/unpinning chat:", updateError);
      return c.json({ error: "Failed to update pin status" }, 500);
    }

    return c.json({
      success: true,
      message: validated.isPinned ? "Chat pinned successfully" : "Chat unpinned successfully",
    });
  } catch (error) {
    console.error("[Chats] Error pinning/unpinning chat:", error);
    return c.json({ error: "Failed to update pin status" }, 500);
  }
});

// GET /api/chats/:id/messages - Get messages for a specific chat
chats.get("/:id/messages", async (c) => {
  const chatId = c.req.param("id");
  const userId = c.req.query("userId");

  console.log(`[Chats] Fetching messages for chat ${chatId}, user ${userId}`);

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  // Debug: Test if service role can access the database at all
  const { count: totalChats, error: debugError } = await db
    .from("chat")
    .select("*", { count: "exact", head: true });
  console.log(`[Chats] Debug - Service role test: totalChats=${totalChats}, error=${debugError?.message}`);

  try {
    // Check if user is a member
    const { data: membership, error: membershipError, status, statusText } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when no rows found

    console.log(`[Chats] Membership check result:`, { 
      membership: !!membership, 
      membershipData: membership,
      error: membershipError?.message,
      errorCode: membershipError?.code,
      errorDetails: membershipError?.details,
      status,
      statusText,
      chatId,
      userId
    });

    // If not a member, auto-add them and create a join message
    if (!membership) {
      // First check if the chat exists
      console.log(`[Chats] User not a member, checking if chat exists: ${chatId}`);
      const { data: chatExists, error: chatCheckError, status: chatStatus, statusText: chatStatusText } = await db
        .from("chat")
        .select("id")
        .eq("id", chatId)
        .maybeSingle(); // Use maybeSingle() to avoid error when no rows found

      console.log(`[Chats] Chat exists check:`, { 
        chatExists: !!chatExists, 
        chatData: chatExists,
        error: chatCheckError?.message,
        errorCode: chatCheckError?.code,
        errorDetails: chatCheckError?.details,
        status: chatStatus,
        statusText: chatStatusText
      });

      if (chatCheckError || !chatExists) {
        console.error(`[Chats] Chat ${chatId} not found - returning 404`);
        return c.json({ error: "Chat not found" }, 404);
      }

      // Get user info
      const { data: user, error: userError } = await db
        .from("user")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Add user as member
      await db
        .from("chat_member")
        .insert({
          chatId,
          userId,
        });

      // Create a system join message
      await db
        .from("message")
        .insert({
          content: `${user.name} has joined the chat`,
          messageType: "system",
          userId: "system",
          chatId,
        });
    }

    // HIGH-8: Support pagination for message history
    const limit = parseInt(c.req.query("limit") || "100");
    const cursor = c.req.query("cursor"); // ISO date string for cursor-based pagination
    
    // Build query with optional cursor
    let query = db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more
    
    // If cursor is provided, fetch messages older than cursor
    if (cursor) {
      query = query.lt("createdAt", cursor);
    }
    
    const { data: messagesData, error: messagesError } = await query;
    
    // Check if there are more messages
    const hasMore = messagesData && messagesData.length > limit;
    const messages = (messagesData || []).slice(0, limit); // Remove the extra item
    const nextCursor = hasMore && messages.length > 0 
      ? messages[messages.length - 1].createdAt 
      : null;

    if (messagesError) {
      console.error("[Chats] Error fetching messages:", messagesError);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }

    // Fetch all related data for messages
    const messageIds = messages.map((m: any) => m.id);
    const userIds = [...new Set(messages.map((m: any) => m.userId))];
    const replyToIds = [...new Set(messages.filter((m: any) => m.replyToId).map((m: any) => m.replyToId))];
    const aiFriendIds = [...new Set(messages.filter((m: any) => m.aiFriendId).map((m: any) => m.aiFriendId))];

    // Fetch users
    const { data: usersData } = await db
      .from("user")
      .select("*")
      .in("id", userIds);
    const users = usersData || [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Fetch AI friends
    const { data: aiFriendsData } = aiFriendIds.length > 0 ? await db
      .from("ai_friend")
      .select("*")
      .in("id", aiFriendIds) : { data: [] };
    const aiFriends = aiFriendsData || [];
    const aiFriendMap = new Map(aiFriends.map((af: any) => [af.id, af]));

    // Fetch replyTo messages
    const { data: replyToMessagesData } = replyToIds.length > 0 ? await db
      .from("message")
      .select("*")
      .in("id", replyToIds) : { data: [] };
    const replyToMessages = replyToMessagesData || [];
    const replyToMap = new Map(replyToMessages.map((m: any) => [m.id, m]));

    // Fetch reactions
    const { data: reactionsData } = messageIds.length > 0 ? await db
      .from("reaction")
      .select("*")
      .in("messageId", messageIds) : { data: [] };
    const reactions = reactionsData || [];

    // Fetch reaction users
    const reactionUserIds = [...new Set(reactions.map((r: any) => r.userId))];
    const { data: reactionUsersData } = reactionUserIds.length > 0 ? await db
      .from("user")
      .select("*")
      .in("id", reactionUserIds) : { data: [] };
    const reactionUsers = reactionUsersData || [];
    const reactionUserMap = new Map(reactionUsers.map((u: any) => [u.id, u]));

    // Fetch mentions
    const { data: mentionsData } = messageIds.length > 0 ? await db
      .from("mention")
      .select("*")
      .in("messageId", messageIds) : { data: [] };
    const mentions = mentionsData || [];

    // Fetch mention users
    const mentionUserIds = [...new Set([
      ...mentions.map((m: any) => m.mentionedUserId),
      ...mentions.map((m: any) => m.mentionedByUserId)
    ])];
    const { data: mentionUsersData } = mentionUserIds.length > 0 ? await db
      .from("user")
      .select("*")
      .in("id", mentionUserIds) : { data: [] };
    const mentionUsers = mentionUsersData || [];
    const mentionUserMap = new Map(mentionUsers.map((u: any) => [u.id, u]));

    // Group reactions and mentions by message
    const reactionsByMessage = new Map();
    reactions.forEach((r: any) => {
      if (!reactionsByMessage.has(r.messageId)) {
        reactionsByMessage.set(r.messageId, []);
      }
      reactionsByMessage.get(r.messageId).push(r);
    });

    const mentionsByMessage = new Map();
    mentions.forEach((m: any) => {
      if (!mentionsByMessage.has(m.messageId)) {
        mentionsByMessage.set(m.messageId, []);
      }
      mentionsByMessage.get(m.messageId).push(m);
    });

    console.log(`[Chats] Successfully fetched ${messages.length} messages for chat ${chatId}`);

    const formattedMessages = messages.reverse().map((msg: any) => {
      const user = userMap.get(msg.userId);
      const aiFriend = msg.aiFriendId ? aiFriendMap.get(msg.aiFriendId) : null;
      const replyTo = msg.replyToId ? replyToMap.get(msg.replyToId) : null;
      const msgReactions = reactionsByMessage.get(msg.id) || [];
      const msgMentions = mentionsByMessage.get(msg.id) || [];

      // Parse metadata if it's a string (from JSONB column)
      let parsedMetadata = msg.metadata;
      if (typeof msg.metadata === "string") {
        try {
          parsedMetadata = JSON.parse(msg.metadata);
        } catch {
          parsedMetadata = null;
        }
      }

      return {
      id: msg.id,
      content: msg.content,
      messageType: msg.messageType as "text" | "image" | "voice" | "video",
      imageUrl: msg.imageUrl,
      imageDescription: msg.imageDescription,
      voiceUrl: msg.voiceUrl,
      voiceDuration: msg.voiceDuration,
      eventId: msg.eventId,
      pollId: msg.pollId,
      userId: msg.userId,
      chatId: msg.chatId,
      replyToId: msg.replyToId,
      vibeType: msg.vibeType || null,
      metadata: parsedMetadata,
      aiFriendId: msg.aiFriendId, // Include AI friend ID
      aiFriend: aiFriend ? {
        id: aiFriend.id,
        name: aiFriend.name,
        color: aiFriend.color,
        personality: aiFriend.personality,
        tone: aiFriend.tone,
        engagementMode: aiFriend.engagementMode,
        engagementPercent: aiFriend.engagementPercent,
        chatId: aiFriend.chatId,
        sortOrder: aiFriend.sortOrder,
        createdAt: new Date(aiFriend.createdAt).toISOString(),
        updatedAt: new Date(aiFriend.updatedAt).toISOString(),
      } : null,
      editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
      isUnsent: msg.isUnsent,
      editHistory: msg.editHistory,
      user: user ? {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      } : null,
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        messageType: replyTo.messageType as "text" | "image" | "voice" | "video",
        imageUrl: replyTo.imageUrl,
        imageDescription: replyTo.imageDescription,
        voiceUrl: replyTo.voiceUrl,
        voiceDuration: replyTo.voiceDuration,
        userId: replyTo.userId,
        chatId: replyTo.chatId,
        replyToId: replyTo.replyToId,
        aiFriendId: replyTo.aiFriendId, // Include AI friend ID for replied-to message
        editedAt: replyTo.editedAt ? new Date(replyTo.editedAt).toISOString() : null,
        isUnsent: replyTo.isUnsent,
        editHistory: replyTo.editHistory,
        user: userMap.get(replyTo.userId) ? {
          id: userMap.get(replyTo.userId).id,
          name: userMap.get(replyTo.userId).name,
          bio: userMap.get(replyTo.userId).bio,
          image: userMap.get(replyTo.userId).image,
          hasCompletedOnboarding: userMap.get(replyTo.userId).hasCompletedOnboarding,
          createdAt: new Date(userMap.get(replyTo.userId).createdAt).toISOString(),
          updatedAt: new Date(userMap.get(replyTo.userId).updatedAt).toISOString(),
        } : null,
        // Include AI friend data for replied-to message
        aiFriend: replyTo.aiFriendId && aiFriendMap.get(replyTo.aiFriendId) ? {
          id: aiFriendMap.get(replyTo.aiFriendId).id,
          name: aiFriendMap.get(replyTo.aiFriendId).name,
          color: aiFriendMap.get(replyTo.aiFriendId).color,
          personality: aiFriendMap.get(replyTo.aiFriendId).personality,
          tone: aiFriendMap.get(replyTo.aiFriendId).tone,
          engagementMode: aiFriendMap.get(replyTo.aiFriendId).engagementMode,
          engagementPercent: aiFriendMap.get(replyTo.aiFriendId).engagementPercent,
          chatId: aiFriendMap.get(replyTo.aiFriendId).chatId,
          sortOrder: aiFriendMap.get(replyTo.aiFriendId).sortOrder,
          createdAt: new Date(aiFriendMap.get(replyTo.aiFriendId).createdAt).toISOString(),
          updatedAt: new Date(aiFriendMap.get(replyTo.aiFriendId).updatedAt).toISOString(),
        } : null,
        createdAt: new Date(replyTo.createdAt).toISOString(),
      } : null,
      reactions: msgReactions.map((r: any) => {
        const reactionUser = reactionUserMap.get(r.userId);
        return {
          id: r.id,
          emoji: r.emoji,
          userId: r.userId,
          messageId: r.messageId,
          createdAt: new Date(r.createdAt).toISOString(),
          user: reactionUser ? {
            id: reactionUser.id,
            name: reactionUser.name,
            bio: reactionUser.bio,
            image: reactionUser.image,
            hasCompletedOnboarding: reactionUser.hasCompletedOnboarding,
            createdAt: new Date(reactionUser.createdAt).toISOString(),
            updatedAt: new Date(reactionUser.updatedAt).toISOString(),
          } : null,
        };
      }),
      mentions: msgMentions.map((mention: any) => {
        const mentionedUser = mentionUserMap.get(mention.mentionedUserId);
        const mentionedBy = mentionUserMap.get(mention.mentionedByUserId);
        return {
          id: mention.id,
          messageId: mention.messageId,
          mentionedUserId: mention.mentionedUserId,
          mentionedByUserId: mention.mentionedByUserId,
          createdAt: new Date(mention.createdAt).toISOString(),
          mentionedUser: mentionedUser ? {
            id: mentionedUser.id,
            name: mentionedUser.name,
            bio: mentionedUser.bio,
            image: mentionedUser.image,
            hasCompletedOnboarding: mentionedUser.hasCompletedOnboarding,
            createdAt: new Date(mentionedUser.createdAt).toISOString(),
            updatedAt: new Date(mentionedUser.updatedAt).toISOString(),
          } : null,
          mentionedBy: mentionedBy ? {
            id: mentionedBy.id,
            name: mentionedBy.name,
            bio: mentionedBy.bio,
            image: mentionedBy.image,
            hasCompletedOnboarding: mentionedBy.hasCompletedOnboarding,
            createdAt: new Date(mentionedBy.createdAt).toISOString(),
            updatedAt: new Date(mentionedBy.updatedAt).toISOString(),
          } : null,
        };
      }),
      linkPreview:
        msg.linkPreviewUrl
          ? {
              url: msg.linkPreviewUrl,
              title: msg.linkPreviewTitle,
              description: msg.linkPreviewDescription,
              image: msg.linkPreviewImage,
              siteName: msg.linkPreviewSiteName,
              favicon: msg.linkPreviewFavicon,
            }
          : null,
      createdAt: new Date(msg.createdAt).toISOString(),
    };
    });

    // HIGH-8: Return pagination info with messages
    return c.json({
      messages: formattedMessages,
      hasMore: hasMore,
      nextCursor: nextCursor,
    });
  } catch (error) {
    console.error("[Chats] Error fetching messages:", error);
    return c.json({ error: "Failed to fetch messages" }, 500);
  }
});

// POST /api/chats/:id/messages - Send a message to a specific chat
chats.post("/:id/messages", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = sendChatMessageRequestSchema.parse(body);

    // Check if user is a member
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", validated.userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Create message
    const { data: message, error: messageError } = await db
      .from("message")
      .insert({
        content: validated.content,
        messageType: validated.messageType,
        imageUrl: validated.imageUrl,
        voiceUrl: validated.voiceUrl,
        voiceDuration: validated.voiceDuration,
        userId: validated.userId,
        chatId,
        replyToId: validated.replyToId,
        vibeType: validated.vibeType || null,
        metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
      })
      .select("*")
      .single();

    if (messageError || !message) {
      console.error("[Chats] Error creating message:", messageError);
      return c.json({ error: "Failed to send message" }, 500);
    }

    // Fetch user
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", message.userId)
      .single();

    // Fetch replyTo if exists
    let replyTo = null;
    if (message.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", message.replyToId)
        .single();
      
      if (replyToMsg) {
        const { data: replyToUser } = await db
          .from("user")
          .select("*")
          .eq("id", replyToMsg.userId)
          .single();
        
        if (replyToUser) {
          replyTo = {
            ...replyToMsg,
            user: replyToUser,
          };
        }
      }
    }

    // Auto-tag message for smart threads (fire-and-forget, immediate)
    // This ensures real-time tagging for background AI processing
    if (message.content && message.content.trim().length > 0) {
      tagMessage(message.id, message.content).catch(error => {
        console.error(`[Chats] Failed to tag message ${message.id}:`, error);
      });
    }

    // If this is a text message, check for URLs and fetch link preview
    if (message.messageType === "text" && message.content) {
      const url = extractFirstUrl(message.content);
      if (url) {
        console.log(`🔗 [Chats] URL detected in message (${message.id}), fetching link preview: ${url}`);

        // Fire-and-forget: Fetch link preview in background
        Promise.resolve().then(async () => {
          try {
            console.log(`🔄 [Chats] Starting background link preview fetch for message ${message.id}`);
            const linkPreview = await fetchLinkPreview(url);

            if (linkPreview) {
              // Update the message with the link preview
              await db
                .from("message")
                .update({
                  linkPreviewUrl: linkPreview.url,
                  linkPreviewTitle: linkPreview.title,
                  linkPreviewDescription: linkPreview.description,
                  linkPreviewImage: linkPreview.image,
                  linkPreviewSiteName: linkPreview.siteName,
                  linkPreviewFavicon: linkPreview.favicon,
                })
                .eq("id", message.id);

              console.log(`✅ [Chats] Link preview saved for message ${message.id}`);
            } else {
              console.log(`⚠️ [Chats] No link preview data available for ${url}`);
            }
          } catch (error) {
            console.error(`❌ [Chats] Failed to fetch link preview for message ${message.id}:`, error);
          }
        });
      }
    }

    // Get chat info for notifications
    const { data: chat } = await db
      .from("chat")
      .select("name")
      .eq("id", chatId)
      .single();

    // Send push notifications to other members (non-blocking)
    if (chat && message.messageType !== "system") {
      const messagePreview = message.messageType === "image"
        ? "📷 Image"
        : message.messageType === "voice"
        ? "🎤 Voice message"
        : message.messageType === "video"
        ? "🎬 Video"
        : (message.content || "New message");

      sendChatPushNotifications({
        chatId,
        chatName: chat?.name || "Chat",
        senderId: message.userId,
        senderName: user?.name || "Unknown",
        messagePreview: messagePreview.substring(0, 100), // Limit preview length
      }).catch((err) => console.error("[Push] Error sending notifications:", err));
    }

    // If it's an image message, trigger async image description generation
    if (message.messageType === "image" && message.imageUrl) {
      // Import and call the image description service (non-blocking)
      import("../services/image-description").then(({ generateImageDescription }) => {
        generateImageDescription(message.id, message.imageUrl!).catch((err) =>
          console.error("[Image Description] Failed:", err)
        );
      });
    }

    // Parse metadata if it's a string
    let parsedMessageMetadata = message.metadata;
    if (typeof message.metadata === "string") {
      try {
        parsedMessageMetadata = JSON.parse(message.metadata);
      } catch {
        parsedMessageMetadata = null;
      }
    }

    return c.json({
      id: message.id,
      content: message.content,
      messageType: message.messageType as "text" | "image" | "voice" | "video",
      imageUrl: message.imageUrl,
      imageDescription: message.imageDescription,
      voiceUrl: message.voiceUrl,
      voiceDuration: message.voiceDuration,
      userId: message.userId,
      chatId: message.chatId,
      replyToId: message.replyToId,
      vibeType: message.vibeType || null,
      metadata: parsedMessageMetadata,
      user: user ? {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      } : null,
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        messageType: replyTo.messageType as "text" | "image" | "voice" | "video",
        imageUrl: replyTo.imageUrl,
        imageDescription: replyTo.imageDescription,
        voiceUrl: replyTo.voiceUrl,
        voiceDuration: replyTo.voiceDuration,
        userId: replyTo.userId,
        chatId: replyTo.chatId,
        replyToId: replyTo.replyToId,
        user: {
          id: replyTo.user.id,
          name: replyTo.user.name,
          bio: replyTo.user.bio,
          image: replyTo.user.image,
          hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding,
          createdAt: new Date(replyTo.user.createdAt).toISOString(),
          updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
        },
        createdAt: new Date(replyTo.createdAt).toISOString(),
      } : null,
      reactions: [],
      linkPreview: null,
      createdAt: new Date(message.createdAt).toISOString(),
    });
  } catch (error) {
    console.error("[Chats] Error sending message:", error);
    return c.json({ error: "Failed to send message" }, 500);
  }
});

// DELETE /api/chats/:id/messages - Clear all messages in a chat (creator only)
chats.delete("/:id/messages", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = clearChatMessagesRequestSchema.parse(body);

    // Check if user is the creator
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    if (chat.creatorId !== validated.userId) {
      return c.json({ error: "Only the creator can clear messages" }, 403);
    }

    // Delete all messages
    const { error: deleteError, count } = await db
      .from("message")
      .delete()
      .eq("chatId", chatId);

    if (deleteError) {
      console.error("[Chats] Error clearing messages:", deleteError);
      return c.json({ error: "Failed to clear messages" }, 500);
    }

    return c.json({
      success: true,
      message: "All messages cleared successfully",
      deletedCount: count || 0,
    });
  } catch (error) {
    console.error("[Chats] Error clearing messages:", error);
    return c.json({ error: "Failed to clear messages" }, 500);
  }
});

// POST /api/chats/:id/invite-link - Generate or get invite link for a chat
chats.post("/:id/invite-link", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = generateInviteLinkRequestSchema.parse(body);

    // Check if user is a member of this chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", validated.userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "You must be a member of this chat to generate an invite link" }, 403);
    }

    // Check if chat already has an invite token
    let { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    // Check if invite token needs to be generated or regenerated
    const now = new Date();
    const needsNewToken = !chat.inviteToken ||
                         !chat.inviteTokenExpiresAt ||
                         chat.inviteTokenExpiresAt < now;

    if (needsNewToken) {
      // Generate a unique 8-character token
      const generateToken = () => {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let token = "";
        for (let i = 0; i < 8; i++) {
          token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
      };

      let inviteToken = generateToken();

      // Ensure uniqueness
      let { data: existingChat } = await db
        .from("chat")
        .select("id")
        .eq("inviteToken", inviteToken)
        .single();

      while (existingChat) {
        inviteToken = generateToken();
        const result = await db
          .from("chat")
          .select("id")
          .eq("inviteToken", inviteToken)
          .single();
        existingChat = result.data;
      }

      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Update chat with new invite token and expiration
      const { data: updatedChat, error: updateError } = await db
        .from("chat")
        .update({
          inviteToken,
          inviteTokenExpiresAt: expiresAt.toISOString(),
        })
        .eq("id", chatId)
        .select("*")
        .single();

      if (updateError) {
        console.error("[Chats] Error updating invite token:", updateError);
        return c.json({ error: "Failed to generate invite link" }, 500);
      }

      chat = updatedChat;
    }

    // Use custom scheme for invite token
    // Format: vibechat://invite?token=abc123
    const inviteLink = `vibechat://invite?token=${chat.inviteToken}`;

    return c.json({
      inviteToken: chat.inviteToken!,
      inviteLink,
    });
  } catch (error) {
    console.error("[Chats] Error generating invite link:", error);
    return c.json({ error: "Failed to generate invite link" }, 500);
  }
});

// POST /api/chats/:id/read-receipts - Mark messages as read
chats.post("/:id/read-receipts", async (c) => {
  try {
    const chatId = c.req.param("id");
    const body = await c.req.json();
    const { userId, messageIds } = body;

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const token = c.req.header("Authorization")?.replace("Bearer ", "");
    const client = token ? createUserClient(token) : db;

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await client
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "User is not a member of this chat" }, 403);
    }

    let idsToMark = messageIds;

    // If no messageIds provided, mark ALL unread messages as read
    if (!idsToMark || !Array.isArray(idsToMark)) {
      // Get all messages in this chat (excluding current user and system messages)
      const { data: messagesData } = await client
        .from("message")
        .select("id")
        .eq("chatId", chatId)
        .neq("userId", userId)
        .neq("messageType", "system");

      const messages = messagesData || [];
      idsToMark = messages.map((m: any) => m.id);
    }

    if (idsToMark.length === 0) {
      return c.json({
        success: true,
        message: "No messages to mark as read",
        markedCount: 0,
      });
    }

    // Always filter out messages that are already read to prevent unique constraint violations
    const { data: readReceiptsData } = await client
      .from("read_receipt")
      .select("messageId")
      .eq("userId", userId)
      .eq("chatId", chatId)
      .in("messageId", idsToMark);

    const readReceipts = readReceiptsData || [];
    const readMessageIdSet = new Set(readReceipts.map((r: any) => r.messageId));
    
    // Filter out already read messages
    idsToMark = idsToMark.filter((id: string) => !readMessageIdSet.has(id));

    if (idsToMark.length === 0) {
      return c.json({
        success: true,
        message: "All messages already read",
        markedCount: 0,
      });
    }

    // Create read receipts for the identified messages
    const { error: insertError } = await client
      .from("read_receipt")
      .insert(
        idsToMark.map((messageId: string) => ({
          userId,
          chatId,
          messageId,
          readAt: new Date().toISOString()
        }))
      );

    if (insertError) {
      console.error("[Chats] Error inserting read receipts:", insertError);
      return c.json({ error: "Failed to mark messages as read" }, 500);
    }

    return c.json({
      success: true,
      message: "Messages marked as read",
      markedCount: idsToMark.length,
    });
  } catch (error) {
    console.error("[Chats] Error marking messages as read:", error);
    return c.json({ error: "Failed to mark messages as read" }, 500);
  }
});

// POST /api/chats/:id/typing - Set typing indicator
chats.post("/:id/typing", async (c) => {
  try {
    const chatId = c.req.param("id");
    const body = await c.req.json();
    const { userId, isTyping } = body;

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    // Get or create typing map for this chat
    if (!typingIndicators.has(chatId)) {
      typingIndicators.set(chatId, new Map());
    }
    const chatTypers = typingIndicators.get(chatId)!;

    if (isTyping) {
      // Set typing timestamp
      chatTypers.set(userId, Date.now());
    } else {
      // Remove typing indicator
      chatTypers.delete(userId);
    }

    // Clean up expired typing indicators
    const now = Date.now();
    for (const [uid, timestamp] of chatTypers.entries()) {
      if (now - timestamp > TYPING_TIMEOUT) {
        chatTypers.delete(uid);
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("[Chats] Error setting typing indicator:", error);
    return c.json({ error: "Failed to set typing indicator" }, 500);
  }
});

// GET /api/chats/:id/typing - Get typing users
chats.get("/:id/typing", async (c) => {
  try {
    const chatId = c.req.param("id");
    const currentUserId = c.req.query("userId");

    const chatTypers = typingIndicators.get(chatId);
    if (!chatTypers || chatTypers.size === 0) {
      return c.json({ typingUsers: [] });
    }

    // Clean up expired typing indicators
    const now = Date.now();
    const activeTypers: string[] = [];
    for (const [userId, timestamp] of chatTypers.entries()) {
      if (now - timestamp > TYPING_TIMEOUT) {
        chatTypers.delete(userId);
      } else if (userId !== currentUserId) {
        // Don't include current user in typing list
        activeTypers.push(userId);
      }
    }

    // Fetch user names for active typers
    if (activeTypers.length > 0) {
      const { data: usersData } = await db
        .from("user")
        .select("id, name")
        .in("id", activeTypers);
      const users = usersData || [];

      const typingUsers = users.map((u: any) => ({
        id: u.id,
        name: u.name,
      }));

      return c.json({ typingUsers });
    }

    return c.json({ typingUsers: [] });
  } catch (error) {
    console.error("[Chats] Error getting typing users:", error);
    return c.json({ error: "Failed to get typing users" }, 500);
  }
});

// POST /api/chats/debug-link-preview - Force refresh link preview for a message
chats.post("/debug-link-preview", async (c) => {
  try {
    const body = await c.req.json();
    const { messageId } = body;

    if (!messageId) {
      return c.json({ error: "messageId is required" }, 400);
    }

    console.log(`[Debug] Force refreshing link preview for message: ${messageId}`);

    // 1. Fetch message content
    const { data: message, error: msgError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (msgError || !message) {
      return c.json({ error: "Message not found", details: msgError }, 404);
    }

    console.log(`[Debug] Message content: "${message.content}"`);

    // 2. Extract URL
    const url = extractFirstUrl(message.content);
    console.log(`[Debug] Extracted URL: "${url}"`);

    if (!url) {
      return c.json({ error: "No URL found in message" }, 400);
    }

    // 3. Fetch Link Preview
    console.log(`[Debug] Fetching link preview...`);
    const linkPreview = await fetchLinkPreview(url);
    console.log(`[Debug] Link preview result:`, linkPreview);

    if (!linkPreview) {
      return c.json({ error: "Failed to fetch link preview data" }, 500);
    }

    // 4. Update Database
    const { error: updateError } = await db
      .from("message")
      .update({
        linkPreviewUrl: linkPreview.url,
        linkPreviewTitle: linkPreview.title,
        linkPreviewDescription: linkPreview.description,
        linkPreviewImage: linkPreview.image,
        linkPreviewSiteName: linkPreview.siteName,
        linkPreviewFavicon: linkPreview.favicon,
      })
      .eq("id", messageId);

    if (updateError) {
      console.error(`[Debug] Database update failed:`, updateError);
      return c.json({ error: "Database update failed", details: updateError }, 500);
    }

    return c.json({ 
      success: true, 
      message: "Link preview updated", 
      data: linkPreview 
    });

  } catch (error) {
    console.error("[Debug] Error in debug-link-preview:", error);
    return c.json({ error: "Internal server error", details: String(error) }, 500);
  }
});

export default chats;
