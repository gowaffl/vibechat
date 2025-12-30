import { Hono } from "hono";
import { db, createUserClient, executeWithRetry } from "../db";
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
import { z } from "zod";
import { decryptMessages } from "../services/message-encryption";

const chats = new Hono<AppType>();

// In-memory typing indicator store: chatId -> { userId -> timestamp }
const typingIndicators = new Map<string, Map<string, number>>();
const TYPING_TIMEOUT = 3000; // 3 seconds for users

// Separate store for AI friend typing: chatId -> { aiFriendId -> { timestamp, name, color } }
interface AITypingInfo {
  timestamp: number;
  name: string;
  color: string;
}
const aiTypingIndicators = new Map<string, Map<string, AITypingInfo>>();
const AI_TYPING_TIMEOUT = 60000; // 60 seconds for AI (can take longer to respond)

// TTL-based cleanup for typing indicator Maps to prevent memory leaks
// Runs every 30 seconds to clean up expired entries and empty chat maps
const CLEANUP_INTERVAL = 30000; // 30 seconds
setInterval(() => {
  const now = Date.now();
  let cleanedUsers = 0;
  let cleanedAI = 0;
  let removedChats = 0;
  
  // Clean up user typing indicators
  for (const [chatId, chatTypers] of typingIndicators.entries()) {
    for (const [userId, timestamp] of chatTypers.entries()) {
      if (now - timestamp > TYPING_TIMEOUT) {
        chatTypers.delete(userId);
        cleanedUsers++;
      }
    }
    // Remove empty chat maps to free memory
    if (chatTypers.size === 0) {
      typingIndicators.delete(chatId);
      removedChats++;
    }
  }
  
  // Clean up AI typing indicators
  for (const [chatId, chatAITypers] of aiTypingIndicators.entries()) {
    for (const [aiFriendId, info] of chatAITypers.entries()) {
      if (now - info.timestamp > AI_TYPING_TIMEOUT) {
        chatAITypers.delete(aiFriendId);
        cleanedAI++;
      }
    }
    // Remove empty chat maps to free memory
    if (chatAITypers.size === 0) {
      aiTypingIndicators.delete(chatId);
    }
  }
  
  // Only log if cleanup actually did something
  if (cleanedUsers > 0 || cleanedAI > 0 || removedChats > 0) {
    console.log(`[TypingCleanup] Cleaned ${cleanedUsers} user indicators, ${cleanedAI} AI indicators, removed ${removedChats} empty chat maps`);
  }
}, CLEANUP_INTERVAL);

// Helper to set AI typing status (exported for use in other routes)
// Also broadcasts via Supabase Realtime so clients receive updates instantly
export function setAITypingStatus(chatId: string, aiFriendId: string, isTyping: boolean, name?: string, color?: string): void {
  if (!aiTypingIndicators.has(chatId)) {
    aiTypingIndicators.set(chatId, new Map());
  }
  const chatAITypers = aiTypingIndicators.get(chatId)!;

  if (isTyping && name) {
    chatAITypers.set(aiFriendId, {
      timestamp: Date.now(),
      name: name,
      color: color || "#14B8A6",
    });
  } else {
    chatAITypers.delete(aiFriendId);
  }
  
  // Broadcast AI typing status via Supabase Realtime
  // This replaces the need for clients to poll the typing endpoint
  db.channel(`chat:${chatId}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        isAI: true,
        aiFriendId,
        aiFriendName: name || 'AI Friend',
        aiFriendColor: color || '#14B8A6',
        isTyping,
      },
    })
    .catch((err: Error) => {
      console.error(`[Chats] Error broadcasting AI typing status:`, err);
    });
}

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
      .select("*, chatId, isPinned, pinnedAt, isMuted")
      .eq("userId", userId);

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

    // Fetch last messages for each chat and decrypt them
    const lastMessages = await Promise.all(
      chatIds.map(async (chatId: string) => {
        const { data } = await client
          .from("message")
          .select("*")
          .eq("chatId", chatId)
          .order("createdAt", { ascending: false })
          .limit(1);
        
        // Decrypt message if it exists and is encrypted
        if (data && data.length > 0) {
          const decryptedMessages = await decryptMessages(data);
          let message = decryptedMessages[0] || null;

          // Check if we need to translate the preview
          const membership = chatMemberships?.find((m: any) => m.chatId === chatId);
          if (message && membership?.translation_enabled && membership?.translation_language && message.content) {
             try {
                // Try to find cached translation
                const { data: cached } = await db
                  .from("message_translation")
                  .select("translatedContent")
                  .eq("messageId", message.id)
                  .eq("targetLanguage", membership.translation_language)
                  .single();
                  
                if (cached) {
                    message = { ...message, content: cached.translatedContent };
                }
             } catch (err) {
                 // Ignore errors, return original
             }
          }

          return { chatId, message };
        }
        return { chatId, message: null };
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
        isMuted: membership.isMuted,
        translationEnabled: membership.translation_enabled || false,
        translationLanguage: membership.translation_language || "en",
        isRestricted: chat.isRestricted,
      };
    }).filter(Boolean);

    // Sort chats:
    // 1. Pinned chats first (sorted by pinnedAt if needed, but usually just grouped)
    // 2. Then by last message date (descending)
    // 3. If no last message, use createdAt (descending)
    chatsWithMetadata.sort((a: any, b: any) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        // If both are pinned or both are not pinned, sort by date
        // Pinned items could be sorted by pinnedAt, but user wants "recent message" sorting generally.
        // However, user said "Unless the chat has been pinned... keep that chat at the very top".
        // This implies pinned chats stay top, but maybe sorted amongst themselves? 
        // Let's sort pinned by pinnedAt (recently pinned first? or oldest pinned first? usually user controlled, but we don't have drag-drop yet).
        // Let's stick to: Pinned -> Last Message Date
        
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
        
        return dateB - dateA;
    });

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
// OPTIMIZED: Uses single database function instead of N+1 queries (2N queries -> 1 query)
chats.get("/unread-counts", async (c) => {
  try {
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    // Use optimized database function that calculates all unread counts in a single query
    // This replaces the previous N+1 pattern that was causing 400ms+ response times
    const { data, error } = await db.rpc("get_unread_counts", { p_user_id: userId });

    if (error) {
      console.error("[Chats] Error getting unread counts:", error);
      return c.json({ error: "Failed to get unread counts" }, 500);
    }

    // Transform to expected format (chatId instead of chat_id)
    const unreadCounts = (data || []).map((row: { chat_id: string; unread_count: number }) => ({
      chatId: row.chat_id,
      unreadCount: Number(row.unread_count),
    }));

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
      isRestricted: chat.isRestricted,
      createdAt: new Date(chat.createdAt).toISOString(),
      updatedAt: new Date(chat.updatedAt).toISOString(),
      members: members.map((m: any) => {
        const user = userMap.get(m.userId);
        return {
          id: m.id,
          chatId: m.chatId,
          userId: m.userId,
          joinedAt: new Date(m.joinedAt).toISOString(),
          isMuted: m.isMuted,
          translationEnabled: m.translation_enabled || false,
          translationLanguage: m.translation_language || "en",
          user: user ? {
            id: user.id,
            name: user.name,
            phone: user.phone || "",
            bio: user.bio,
            image: user.image,
            hasCompletedOnboarding: user.hasCompletedOnboarding || false,
            createdAt: new Date(user.createdAt).toISOString(),
            updatedAt: new Date(user.updatedAt).toISOString(),
          } : null,
        };
      }),
      isCreator: chat.creatorId === userId,
      isRestricted: chat.isRestricted,
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

    const isCreator = chat.creatorId === validated.userId;

    // Check permissions based on what is being updated and chat mode
    
    // 1. Changing restricted mode: Only creator allowed
    if (validated.isRestricted !== undefined) {
      if (!isCreator) {
        return c.json({ error: "Only the creator can change restricted mode settings" }, 403);
      }
    }

    // 2. Updating other settings
    if (!isCreator) {
      // If chat is restricted, only creator can update settings
      if (chat.isRestricted) {
        return c.json({ error: "Only the creator can update chat settings in restricted mode" }, 403);
      }

      // If chat is unrestricted, verify user is a member
      const { data: membership } = await db
        .from("chat_member")
        .select("id")
        .eq("chatId", chatId)
        .eq("userId", validated.userId)
        .single();

      if (!membership) {
        return c.json({ error: "You must be a member to update chat settings" }, 403);
      }
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
    if (validated.isRestricted !== undefined) updateData.isRestricted = validated.isRestricted;

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
      isRestricted: updatedChat.isRestricted,
      createdAt: new Date(updatedChat.createdAt).toISOString(),
      updatedAt: new Date(updatedChat.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error("[Chats] Error updating chat:", error);
    return c.json({ error: "Failed to update chat" }, 500);
  }
});

// POST /api/chats/:id/image - Upload chat profile image
chats.post("/:id/image", async (c) => {
  const chatId = c.req.param("id");

  try {
    const formData = await c.req.formData();
    const image = formData.get("image") as File;
    const userId = formData.get("userId") as string;

    if (!image) {
      return c.json({ error: "No image file provided" }, 400);
    }

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    console.log(`[Chats] Image upload request for chat ${chatId} by user ${userId}`);

    // Check if user is creator or member
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    const isCreator = chat.creatorId === userId;

    // Check permissions based on restricted mode
    if (!isCreator) {
      // If chat is restricted, only creator can update image
      if (chat.isRestricted) {
        return c.json({ error: "Only the creator can update chat image in restricted mode" }, 403);
      }

      // If chat is unrestricted, verify user is a member
      const { data: membership } = await db
        .from("chat_member")
        .select("id")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .single();

      if (!membership) {
        return c.json({ error: "You must be a member to update chat image" }, 403);
      }
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(image.type)) {
      console.log(`[Chats] Invalid file type: ${image.type}`);
      return c.json({ error: `Invalid file type: ${image.type}. Only JPEG, PNG, GIF, and WebP images are allowed` }, 400);
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (image.size > maxSize) {
      console.log(`[Chats] File too large: ${(image.size / 1024 / 1024).toFixed(2)} MB`);
      return c.json({ error: "File too large. Maximum size is 10MB" }, 400);
    }

    // Upload to storage
    const path = await import("node:path");
    const { randomUUID } = await import("node:crypto");
    const { uploadFileToStorage } = await import("../services/storage");

    const fileExtension = path.extname(image.name);
    const uniqueFilename = `chat-${chatId}-${randomUUID()}${fileExtension}`;
    
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const imageUrl = await uploadFileToStorage(uniqueFilename, buffer, image.type);
    console.log(`[Chats] Image uploaded successfully: ${imageUrl}`);

    // Update chat with new image
    const { data: updatedChat, error: updateError } = await db
      .from("chat")
      .update({ image: imageUrl })
      .eq("id", chatId)
      .select("*")
      .single();

    if (updateError || !updatedChat) {
      console.error("[Chats] Error updating chat image:", updateError);
      return c.json({ error: "Failed to update chat image" }, 500);
    }

    console.log(`[Chats] Chat ${chatId} image updated successfully`);
    return c.json({ imageUrl });
  } catch (error) {
    console.error("[Chats] Error uploading chat image:", error);
    return c.json({ error: "Failed to upload chat image" }, 500);
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

    // Check for restricted mode: If restricted, only creator can invite
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === validated.inviterId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can invite members in restricted mode" }, 403);
      }
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
      user: {
        id: userToInvite.id,
        name: userToInvite.name,
        phone: userToInvite.phone || "",
        bio: userToInvite.bio,
        image: userToInvite.image,
        hasCompletedOnboarding: userToInvite.hasCompletedOnboarding || false,
        createdAt: new Date(userToInvite.createdAt).toISOString(),
        updatedAt: new Date(userToInvite.updatedAt).toISOString(),
      },
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

// PATCH /api/chats/:id/mute - Mute or unmute a chat for a user
const muteChatRequestSchema = z.object({
  userId: z.string(),
  isMuted: z.boolean(),
});

chats.patch("/:id/mute", async (c) => {
  const chatId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = muteChatRequestSchema.parse(body);

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

    // Update mute status
    const { error: updateError } = await db
      .from("chat_member")
      .update({
        isMuted: validated.isMuted,
      })
      .eq("chatId", chatId)
      .eq("userId", validated.userId);

    if (updateError) {
      console.error("[Chats] Error muting/unmuting chat:", updateError);
      return c.json({ error: "Failed to update mute status" }, 500);
    }

    return c.json({
      success: true,
      message: validated.isMuted ? "Chat muted successfully" : "Chat unmuted successfully",
    });
  } catch (error) {
    console.error("[Chats] Error muting/unmuting chat:", error);
    return c.json({ error: "Failed to update mute status" }, 500);
  }
});

// PATCH /api/chats/:id/translation - Update translation settings
chats.patch("/:id/translation", async (c) => {
  const chatId = c.req.param("id");
  
  try {
    const body = await c.req.json();
    const { userId, translationEnabled, translationLanguage } = body;
    
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    
    // Update chat member settings
    const updateData: any = {};
    if (translationEnabled !== undefined) updateData.translation_enabled = translationEnabled;
    if (translationLanguage !== undefined) updateData.translation_language = translationLanguage;
    
    if (Object.keys(updateData).length === 0) {
        return c.json({ success: true, message: "No changes requested" });
    }

    const { error } = await db
      .from("chat_member")
      .update(updateData)
      .eq("chatId", chatId)
      .eq("userId", userId);
      
    if (error) {
      console.error("[Chats] Error updating translation settings:", error);
      return c.json({ error: "Failed to update settings" }, 500);
    }
    
    return c.json({ success: true, message: "Translation settings updated" });
    
  } catch (error) {
    console.error("[Chats] Error updating translation settings:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

// GET /api/chats/:id/messages - Get messages for a specific chat
chats.get("/:id/messages", async (c) => {
  const chatId = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Check if user is a member (with retry logic for connection issues)
    const { data: membership, error: membershipError } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .maybeSingle();
    });

    // If not a member, auto-add them and create a join message
    if (!membership) {
      // First check if the chat exists (with retry logic)
      const { data: chatExists, error: chatCheckError } = await executeWithRetry(async () => {
        return await db
          .from("chat")
          .select("id")
          .eq("id", chatId)
          .maybeSingle();
      });

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

    // HIGH-8: Support pagination for message history
    const limit = parseInt(c.req.query("limit") || "100");
    const cursor = c.req.query("cursor"); // ISO date string for cursor-based pagination
    const since = c.req.query("since"); // ISO date string for gap recovery (fetch messages AFTER this timestamp)
    const around = c.req.query("around"); // Message ID to jump to (fetch context around this message)
    
    // Optimize: Fetch messages with all relations in a single query
    const selectQuery = `
        *,
        user:userId (*),
        aiFriend:aiFriendId (*),
        replyTo:replyToId (
          *,
          user:userId (*),
          aiFriend:aiFriendId (*)
        ),
        reactions:reaction (
          *,
          user:userId (*)
        ),
        mentions:mention (
          *,
          mentionedUser:mentionedUserId (*),
          mentionedBy:mentionedByUserId (*)
        ),
        tags:message_tag (*)
      `;

    let messagesData: any[] = [];
    let hasMore = false;
    let nextCursor: string | null = null;

    if (around) {
      // Contextual Fetch: Get message + 50 before + 50 after
      // 1. Get target message details
      const { data: targetMsg, error: targetError } = await db
        .from("message")
        .select(selectQuery)
        .eq("id", around)
        .eq("chatId", chatId)
        .single();

      if (targetError || !targetMsg) {
        return c.json({ error: "Target message not found" }, 404);
      }

      const targetDate = targetMsg.createdAt;

      // 2. Fetch older messages (before target)
      const { data: beforeData } = await db
        .from("message")
        .select(selectQuery)
        .eq("chatId", chatId)
        .lt("createdAt", targetDate)
        .order("createdAt", { ascending: false })
        .limit(50); // Fetch 50 older

      // 3. Fetch newer messages (after target)
      const { data: afterData } = await db
        .from("message")
        .select(selectQuery)
        .eq("chatId", chatId)
        .gt("createdAt", targetDate)
        .order("createdAt", { ascending: true })
        .limit(50); // Fetch 50 newer

      // Combine: [...after (reversed to be newest first?), target, ...before]
      // Our frontend expects newest at index 0 (descending order)
      // So: [...after.reverse(), target, ...before]
      const after = (afterData || []).reverse(); // Newest to Oldest (closest to target)
      const before = (beforeData || []); // Closest to target to Oldest

      messagesData = [...after, targetMsg, ...before];
      
      // For 'around' queries, hasMore/nextCursor logic is different or disabled for simplicity
      // Client usually replaces entire list
      hasMore = false; 
      nextCursor = null;

    } else if (since) {
      // Gap Recovery
      const { data, error } = await db
        .from("message")
        .select(selectQuery)
        .eq("chatId", chatId)
        .gt("createdAt", since)
        .order("createdAt", { ascending: true }) // Oldest first for recovery
        .limit(limit);
        
      if (error) throw error;
      messagesData = data || [];
      hasMore = false;
      nextCursor = null;
    } else {
      // Standard Pagination
      let query = db
        .from("message")
        .select(selectQuery)
        .eq("chatId", chatId)
        .order("createdAt", { ascending: false })
        .limit(limit + 1);
      
      if (cursor) {
        query = query.lt("createdAt", cursor);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[Chats] Error fetching messages:", error);
        return c.json({ error: "Failed to fetch messages" }, 500);
      }
      messagesData = data || [];
      
      hasMore = messagesData.length > limit;
      if (hasMore) messagesData = messagesData.slice(0, limit); // Remove extra
      nextCursor = hasMore && messagesData.length > 0 ? messagesData[messagesData.length - 1].createdAt : null;
    }
    
    let messages = messagesData;


    // Decrypt any encrypted messages
    const decryptedMessages = await decryptMessages(messages);

    // Decrypt nested replyTo messages if they exist
    const replyToMessages = decryptedMessages
      .filter((m: any) => m.replyTo)
      .map((m: any) => m.replyTo);

    if (replyToMessages.length > 0) {
      const decryptedReplyTos = await decryptMessages(replyToMessages);
      const replyToMap = new Map(decryptedReplyTos.map((m: any) => [m.id, m]));
      
      decryptedMessages.forEach((msg: any) => {
        if (msg.replyTo && replyToMap.has(msg.replyTo.id)) {
          msg.replyTo = replyToMap.get(msg.replyTo.id);
        }
      });
    }

    const formattedMessages = decryptedMessages.map((msg: any) => {
      // Parse metadata if it's a string
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
        messageType: msg.messageType,
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
        aiFriendId: msg.aiFriendId,
        aiFriend: msg.aiFriend ? {
          id: msg.aiFriend.id,
          name: msg.aiFriend.name,
          color: msg.aiFriend.color,
          personality: msg.aiFriend.personality,
          tone: msg.aiFriend.tone,
          engagementMode: msg.aiFriend.engagementMode,
          engagementPercent: msg.aiFriend.engagementPercent,
          chatId: msg.aiFriend.chatId,
          sortOrder: msg.aiFriend.sortOrder,
          createdAt: new Date(msg.aiFriend.createdAt).toISOString(),
          updatedAt: new Date(msg.aiFriend.updatedAt).toISOString(),
      } : null,
      editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
      isUnsent: msg.isUnsent,
      editHistory: msg.editHistory,
        user: msg.user ? {
          id: msg.user.id,
          name: msg.user.name,
          bio: msg.user.bio,
          image: msg.user.image,
          hasCompletedOnboarding: msg.user.hasCompletedOnboarding,
          createdAt: new Date(msg.user.createdAt).toISOString(),
          updatedAt: new Date(msg.user.updatedAt).toISOString(),
      } : null,
        replyTo: msg.replyTo ? {
          id: msg.replyTo.id,
          content: msg.replyTo.content,
          messageType: msg.replyTo.messageType,
          imageUrl: msg.replyTo.imageUrl,
          imageDescription: msg.replyTo.imageDescription,
          voiceUrl: msg.replyTo.voiceUrl,
          voiceDuration: msg.replyTo.voiceDuration,
          userId: msg.replyTo.userId,
          chatId: msg.replyTo.chatId,
          replyToId: msg.replyTo.replyToId,
          aiFriendId: msg.replyTo.aiFriendId,
          editedAt: msg.replyTo.editedAt ? new Date(msg.replyTo.editedAt).toISOString() : null,
          isUnsent: msg.replyTo.isUnsent,
          editHistory: msg.replyTo.editHistory,
          user: msg.replyTo.user ? {
            id: msg.replyTo.user.id,
            name: msg.replyTo.user.name,
            bio: msg.replyTo.user.bio,
            image: msg.replyTo.user.image,
            hasCompletedOnboarding: msg.replyTo.user.hasCompletedOnboarding,
            createdAt: new Date(msg.replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(msg.replyTo.user.updatedAt).toISOString(),
        } : null,
          aiFriend: msg.replyTo.aiFriend ? {
            id: msg.replyTo.aiFriend.id,
            name: msg.replyTo.aiFriend.name,
            color: msg.replyTo.aiFriend.color,
            personality: msg.replyTo.aiFriend.personality,
            tone: msg.replyTo.aiFriend.tone,
            engagementMode: msg.replyTo.aiFriend.engagementMode,
            engagementPercent: msg.replyTo.aiFriend.engagementPercent,
            chatId: msg.replyTo.aiFriend.chatId,
            sortOrder: msg.replyTo.aiFriend.sortOrder,
            createdAt: new Date(msg.replyTo.aiFriend.createdAt).toISOString(),
            updatedAt: new Date(msg.replyTo.aiFriend.updatedAt).toISOString(),
        } : null,
          createdAt: new Date(msg.replyTo.createdAt).toISOString(),
      } : null,
        reactions: (msg.reactions || []).map((r: any) => ({
          id: r.id,
          emoji: r.emoji,
          userId: r.userId,
          messageId: r.messageId,
          createdAt: new Date(r.createdAt).toISOString(),
          user: r.user ? {
            id: r.user.id,
            name: r.user.name,
            bio: r.user.bio,
            image: r.user.image,
            hasCompletedOnboarding: r.user.hasCompletedOnboarding,
            createdAt: new Date(r.user.createdAt).toISOString(),
            updatedAt: new Date(r.user.updatedAt).toISOString(),
          } : null,
        })),
        mentions: (msg.mentions || []).map((mention: any) => ({
          id: mention.id,
          messageId: mention.messageId,
          mentionedUserId: mention.mentionedUserId,
          mentionedByUserId: mention.mentionedByUserId,
          createdAt: new Date(mention.createdAt).toISOString(),
          mentionedUser: mention.mentionedUser ? {
            id: mention.mentionedUser.id,
            name: mention.mentionedUser.name,
            bio: mention.mentionedUser.bio,
            image: mention.mentionedUser.image,
            hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding,
            createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
            updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
          } : null,
          mentionedBy: mention.mentionedBy ? {
            id: mention.mentionedBy.id,
            name: mention.mentionedBy.name,
            bio: mention.mentionedBy.bio,
            image: mention.mentionedBy.image,
            hasCompletedOnboarding: mention.mentionedBy.hasCompletedOnboarding,
            createdAt: new Date(mention.mentionedBy.createdAt).toISOString(),
            updatedAt: new Date(mention.mentionedBy.updatedAt).toISOString(),
          } : null,
        })),
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

    // Decrypt the message immediately for processing
    const [decryptedMessage] = await decryptMessages([message]);

    // Fetch user
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", message.userId)
      .single();

    // Fetch replyTo if exists and decrypt if encrypted
    let replyTo = null;
    if (message.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", message.replyToId)
        .single();
      
      if (replyToMsg) {
        // Decrypt replyTo content if encrypted
        const [decryptedReplyTo] = await decryptMessages([replyToMsg]);
        
        const { data: replyToUser } = await db
          .from("user")
          .select("*")
          .eq("id", decryptedReplyTo.userId)
          .single();
        
        if (replyToUser) {
          replyTo = {
            ...decryptedReplyTo,
            user: replyToUser,
          };
        }
      }
    }

    // Create mention records if any users were mentioned
    let mentions: any[] = [];
    if (validated.mentionedUserIds && validated.mentionedUserIds.length > 0) {
      console.log(`[@] Creating ${validated.mentionedUserIds.length} mention(s) for message ${message.id}`);
      
      // Insert mentions
      const { error: mentionError } = await db
        .from("mention")
        .insert(
          validated.mentionedUserIds.map(mentionedUserId => ({
            messageId: message.id,
            mentionedUserId,
            mentionedByUserId: validated.userId,
          }))
        );
      
      if (mentionError) {
        console.error("[Chats] Error creating mentions:", mentionError);
      }
      
      // Fetch the created mentions with user data
      const { data: createdMentions } = await db
        .from("mention")
        .select("*")
        .eq("messageId", message.id);
      
      if (createdMentions) {
        mentions = await Promise.all(createdMentions.map(async (mention: any) => {
          const { data: mentionedUser } = await db
            .from("user")
            .select("*")
            .eq("id", mention.mentionedUserId)
            .single();
          
          const { data: mentionedBy } = await db
            .from("user")
            .select("*")
            .eq("id", mention.mentionedByUserId)
            .single();
          
          return {
            ...mention,
            mentionedUser,
            mentionedBy,
          };
        }));
      }
    }

    // Auto-tag message for smart threads (fire-and-forget, immediate)
    // This ensures real-time tagging for background AI processing
    if (decryptedMessage.content && decryptedMessage.content.trim().length > 0) {
      tagMessage(decryptedMessage.id, decryptedMessage.content).catch(error => {
        console.error(`[Chats] Failed to tag message ${message.id}:`, error);
      });
    }

    // If this is a text message, check for URLs and fetch link preview
    if (message.messageType === "text" && decryptedMessage.content) {
      const url = extractFirstUrl(decryptedMessage.content);
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
      // IMPORTANT: Use original content from request, not encrypted message.content
      const messagePreview = message.messageType === "image"
        ? "📷 Image"
        : message.messageType === "voice"
        ? "🎤 Voice message"
        : message.messageType === "video"
        ? "🎬 Video"
        : (decryptedMessage.content || "New message"); // Use plaintext from decrypted message

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

    // IMPORTANT: Return the original content from request, not message.content which is encrypted
    return c.json({
      id: message.id,
      content: validated.content || "", // Use original content, not encrypted message.content
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
      mentions: mentions.map((mention) => ({
        id: mention.id,
        messageId: mention.messageId,
        mentionedUserId: mention.mentionedUserId,
        mentionedByUserId: mention.mentionedByUserId,
        createdAt: new Date(mention.createdAt).toISOString(),
        mentionedUser: mention.mentionedUser ? {
          id: mention.mentionedUser.id,
          phone: mention.mentionedUser.phone,
          name: mention.mentionedUser.name,
          bio: mention.mentionedUser.bio,
          image: mention.mentionedUser.image,
          hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding,
          createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
          updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
        } : undefined,
        mentionedBy: mention.mentionedBy ? {
          id: mention.mentionedBy.id,
          phone: mention.mentionedBy.phone,
          name: mention.mentionedBy.name,
          bio: mention.mentionedBy.bio,
          image: mention.mentionedBy.image,
          hasCompletedOnboarding: mention.mentionedBy.hasCompletedOnboarding,
          createdAt: new Date(mention.mentionedBy.createdAt).toISOString(),
          updatedAt: new Date(mention.mentionedBy.updatedAt).toISOString(),
        } : undefined,
      })),
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
    // Use upsert with onConflict to handle race conditions gracefully
    // Note: unique constraint is on (userId, messageId) only
    const { error: insertError } = await client
      .from("read_receipt")
      .upsert(
        idsToMark.map((messageId: string) => ({
          userId,
          chatId,
          messageId,
          readAt: new Date().toISOString()
        })),
        { 
          onConflict: 'userId,messageId',
          ignoreDuplicates: true 
        }
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

// POST /api/chats/:id/typing - Set typing indicator (supports both users and AI friends)
chats.post("/:id/typing", async (c) => {
  try {
    const chatId = c.req.param("id");
    const body = await c.req.json();
    const { userId, aiFriendId, isTyping, aiFriendName, aiFriendColor } = body;

    // Handle AI friend typing
    if (aiFriendId) {
      setAITypingStatus(chatId, aiFriendId, isTyping, aiFriendName, aiFriendColor);
      return c.json({ success: true });
    }

    // Handle user typing (original behavior)
    if (!userId) {
      return c.json({ error: "userId or aiFriendId is required" }, 400);
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

// GET /api/chats/:id/typing - Get typing users and AI friends
chats.get("/:id/typing", async (c) => {
  try {
    const chatId = c.req.param("id");
    const currentUserId = c.req.query("userId");
    const now = Date.now();

    // Get active user typers
    const chatTypers = typingIndicators.get(chatId);
    const activeTypers: string[] = [];
    
    if (chatTypers && chatTypers.size > 0) {
      for (const [userId, timestamp] of chatTypers.entries()) {
        if (now - timestamp > TYPING_TIMEOUT) {
          chatTypers.delete(userId);
        } else if (userId !== currentUserId) {
          activeTypers.push(userId);
        }
      }
    }

    // Get active AI typers
    const chatAITypers = aiTypingIndicators.get(chatId);
    const activeAITypers: { id: string; name: string; color: string }[] = [];
    
    if (chatAITypers && chatAITypers.size > 0) {
      for (const [aiFriendId, info] of chatAITypers.entries()) {
        if (now - info.timestamp > AI_TYPING_TIMEOUT) {
          chatAITypers.delete(aiFriendId);
        } else {
          activeAITypers.push({
            id: aiFriendId,
            name: info.name,
            color: info.color,
          });
        }
      }
    }

    // Build response
    const typingUsers: { id: string; name: string; isAI?: boolean; color?: string }[] = [];

    // Fetch user names for active user typers
    if (activeTypers.length > 0) {
      const { data: usersData } = await db
        .from("user")
        .select("id, name")
        .in("id", activeTypers);
      const users = usersData || [];

      for (const u of users) {
        typingUsers.push({
          id: u.id,
          name: u.name,
        });
      }
    }

    // Add AI friends to typing list
    for (const ai of activeAITypers) {
      typingUsers.push({
        id: ai.id,
        name: ai.name,
        isAI: true,
        color: ai.color,
      });
    }

    return c.json({ typingUsers });
  } catch (error) {
    console.error("[Chats] Error getting typing users:", error);
    return c.json({ error: "Failed to get typing users" }, 500);
  }
});

// GET /api/chats/:id/media - Get all media messages for a chat
chats.get("/:id/media", async (c) => {
  const chatId = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Check membership (using service role to bypass RLS for reading)
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("id")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .maybeSingle();

    if (membershipError || !membership) {
      // Check if chat exists
      const { data: chatExists } = await db
        .from("chat")
        .select("id")
        .eq("id", chatId)
        .maybeSingle();
      
      if (!chatExists) {
        return c.json({ error: "Chat not found" }, 404);
      }
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Fetch all media messages (image and video)
    // We select specific fields to keep the response light
    const { data: mediaMessages, error: mediaError } = await db
      .from("message")
      .select(`
        id,
        content,
        messageType,
        imageUrl,
        voiceUrl,
        metadata,
        createdAt,
        userId,
        user:userId (
          id,
          name,
          image
        )
      `)
      .eq("chatId", chatId)
      .in("messageType", ["image", "video"])
      .is("isUnsent", false) // Exclude unsent messages
      .order("createdAt", { ascending: false });

    if (mediaError) {
      console.error("[Chats] Error fetching media messages:", mediaError);
      return c.json({ error: "Failed to fetch media messages" }, 500);
    }

    // Process messages to handle encryption and formatting
    // Note: We don't fully decrypt content as we mostly care about URLs which are not encrypted in these columns
    // but metadata might be stringified JSON
    const processedMedia = (mediaMessages || []).map((msg: any) => {
      let metadata = msg.metadata;
      if (typeof metadata === "string") {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          metadata = null;
        }
      }

      // Handle multi-image messages (stored in metadata)
      const items: any[] = [];
      
      if (msg.messageType === "video") {
        // Video messages
        const videoUrl = metadata?.videoUrl || msg.voiceUrl; // Legacy support or metadata
        if (videoUrl) {
          items.push({
            id: msg.id,
            messageId: msg.id,
            messageType: "video",
            createdAt: msg.createdAt,
            user: msg.user,
            url: videoUrl,
            thumbnailUrl: metadata?.videoThumbnailUrl || msg.imageUrl,
            metadata
          });
        }
      } else if (msg.messageType === "image") {
        // Image messages
        if (metadata?.mediaUrls && Array.isArray(metadata.mediaUrls) && metadata.mediaUrls.length > 0) {
          // Multi-image message
          metadata.mediaUrls.forEach((url: string, index: number) => {
            items.push({
              id: `${msg.id}_${index}`,
              messageId: msg.id,
              messageType: "image",
              createdAt: msg.createdAt,
              user: msg.user,
              url: url,
              thumbnailUrl: url,
              metadata
            });
          });
        } else if (msg.imageUrl) {
          // Single image message
          items.push({
            id: msg.id,
            messageId: msg.id,
            messageType: "image",
            createdAt: msg.createdAt,
            user: msg.user,
            url: msg.imageUrl,
            thumbnailUrl: msg.imageUrl,
            metadata
          });
        }
      }

      return items;
    }).flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json(processedMedia);
  } catch (error) {
    console.error("[Chats] Error fetching media:", error);
    return c.json({ error: "Failed to fetch media" }, 500);
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

// GET /:chatId - Get chat details including translation settings
chats.get("/:chatId", async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    console.log(`[Chats] Fetching chat details for chat ${chatId}, user ${userId}`);

    // Fetch chat details
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      console.error("[Chats] Error fetching chat:", chatError);
      return c.json({ error: "Chat not found" }, 404);
    }

    // Fetch chat members with translation settings
    const { data: members, error: membersError } = await db
      .from("chat_member")
      .select("*, user:userId(*)")
      .eq("chatId", chatId);

    if (membersError) {
      console.error("[Chats] Error fetching members:", membersError);
      return c.json({ error: "Failed to fetch members" }, 500);
    }

    // Find current user's member record for translation settings
    const myMember = members?.find((m: any) => m.userId === userId);

    console.log(`[Chats] Found chat ${chatId} with ${members?.length || 0} members. User translation settings:`, {
      translationEnabled: myMember?.translation_enabled,
      translationLanguage: myMember?.translation_language
    });

    return c.json({
      ...chat,
      members,
      translationEnabled: myMember?.translation_enabled || false,
      translationLanguage: myMember?.translation_language || ""
    });
  } catch (error) {
    console.error("[Chats] Error fetching chat details:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /:chatId/translation - Update per-chat translation settings for a user
chats.patch("/:chatId/translation", async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const body = await c.req.json();
    const { userId, translationEnabled, translationLanguage } = body;

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    console.log(`[Chats] Updating translation settings for user ${userId} in chat ${chatId}:`, {
      translationEnabled,
      translationLanguage
    });

    // Build update object dynamically based on what's provided
    const updateData: any = {};
    if (translationEnabled !== undefined) {
      updateData.translation_enabled = translationEnabled;
    }
    if (translationLanguage !== undefined) {
      updateData.translation_language = translationLanguage;
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "No translation settings provided" }, 400);
    }

    // Update the chat_member record
    const { error } = await db
      .from("chat_member")
      .update(updateData)
      .eq("chatId", chatId)
      .eq("userId", userId);

    if (error) {
      console.error("[Chats] Error updating translation settings:", error);
      return c.json({ error: "Failed to update translation settings" }, 500);
    }

    console.log(`[Chats] Successfully updated translation settings for user ${userId} in chat ${chatId}`);
    return c.json({ success: true, ...updateData });
  } catch (error) {
    console.error("[Chats] Error in translation settings update:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default chats;
