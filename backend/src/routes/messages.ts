import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppType } from "../index";
import {
  getMessagesResponseSchema,
  sendMessageRequestSchema,
  sendMessageResponseSchema,
  clearMessagesResponseSchema,
  updateMessageDescriptionRequestSchema,
  updateMessageDescriptionResponseSchema,
  editMessageRequestSchema,
  editMessageResponseSchema,
  unsendMessageRequestSchema,
  unsendMessageResponseSchema,
  searchMessagesRequestSchema,
  searchMessagesResponseSchema,
} from "../../../shared/contracts";
import { db } from "../db";
import { generateImageDescription } from "../services/image-description";
import { generateVoiceTranscription } from "../services/voice-transcription";
import { generateEmbedding } from "../services/embeddings";
import { analyzeMessageForProactiveAction } from "../services/proactive-agent";
import { extractFirstUrl } from "../utils/url-utils";
import { fetchLinkPreview } from "../services/link-preview";
import { tagMessage } from "../services/message-tagger";
import { decryptMessages } from "../services/message-encryption";

const messages = new Hono<AppType>();

// POST /api/messages/search - Search messages globally
messages.post("/search", zValidator("json", searchMessagesRequestSchema), async (c) => {
  try {
    const { userId, query: rawQuery, mode = "text" } = c.req.valid("json");
    
    // Ensure query is trimmed
    const query = rawQuery?.trim() || "";

    if (query.length === 0) {
      return c.json([]);
    }

    // 1. Find all chats the user is a member of
    const { data: userChats, error: chatError } = await db
      .from("chat_member")
      .select("chatId")
      .eq("userId", userId);

    if (chatError || !userChats || userChats.length === 0) {
      return c.json([]);
    }

    const chatIds = userChats.map((c) => c.chatId);
    let matchedMessageIds: string[] = [];

    if (mode === "semantic") {
      console.log(`🧠 [Messages] Semantic search for: "${query}"`);
      try {
        const queryEmbedding = await generateEmbedding(query);
        const { data: matches, error: matchError } = await db.rpc("match_messages", {
          query_embedding: queryEmbedding,
          match_threshold: 0.3, // Lower threshold for better recall
          match_count: 50,
          filter_user_id: null,
          filter_chat_ids: chatIds,
        });

        if (matchError) {
          console.error("[Messages] Semantic match error:", matchError);
          // Fallback to text search if semantic fails? Or just return error?
          // Let's fallback for resilience
        } else if (matches) {
          matchedMessageIds = matches.map((m: any) => m.id);
        }
      } catch (embError) {
        console.error("[Messages] Embedding generation error:", embError);
      }
    } 
    
    // If text mode OR semantic search yielded no results (fallback), run text search
    if (mode === "text" || (mode === "semantic" && matchedMessageIds.length === 0)) {
      // 2. Find users matching the query (to search by sender name)
      const { data: matchedUsers } = await db
        .from("user")
        .select("id")
        .ilike("name", `%${query}%`)
        .limit(20);
      
      const matchedUserIds = matchedUsers?.map(u => u.id) || [];

      // 3. Search messages in those chats (content match OR sender match)
      let messageQuery = db
        .from("message")
        .select("id")
        .in("chatId", chatIds);

      if (matchedUserIds.length > 0) {
        const sanitizedQuery = query.replace(/,/g, " ");
        messageQuery = messageQuery.or(`content.ilike.%${sanitizedQuery}%,userId.in.(${matchedUserIds.join(',')})`);
      } else {
        messageQuery = messageQuery.ilike("content", `%${query}%`);
      }

      const { data: textMatches, error: searchError } = await messageQuery
        .order("createdAt", { ascending: false })
        .limit(50);

      if (searchError) {
        console.error("[Messages] Text search error:", searchError);
        return c.json({ error: "Search failed" }, 500);
      }
      
      if (textMatches) {
        matchedMessageIds = textMatches.map((m) => m.id);
      }
    }

    if (matchedMessageIds.length === 0) {
      return c.json([]);
    }

    // Fetch full message details for matched IDs
    const { data: messages, error: fetchError } = await db
      .from("message")
      .select(`
        *,
        user:userId (*),
        chat:chatId (id, name, image),
        aiFriend:aiFriendId (*),
        replyTo:replyToId (
          *,
          user:userId (*)
        ),
        reactions:reaction (
          *,
          user:userId (*)
        ),
        mentions:mention (
          *,
          mentionedUser:mentionedUserId (*)
        )
      `)
      .in("id", matchedMessageIds)
      .limit(50);

    if (fetchError) {
      console.error("[Messages] Error fetching matched messages:", fetchError);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }

    // 3. Decrypt and Format
    const decryptedMessages = await decryptMessages(messages || []);

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

    const results = decryptedMessages.map((msg: any) => {
      // Parse metadata
      let parsedMetadata = msg.metadata;
      if (typeof msg.metadata === "string") {
        try {
          parsedMetadata = JSON.parse(msg.metadata);
        } catch {
          parsedMetadata = null;
        }
      }

      const formattedMessage = {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        imageUrl: msg.imageUrl,
        imageDescription: msg.imageDescription,
        voiceUrl: msg.voiceUrl,
        voiceDuration: msg.voiceDuration,
        voiceTranscription: msg.voiceTranscription,
        eventId: msg.eventId,
        pollId: msg.pollId,
        userId: msg.userId,
        chatId: msg.chatId,
        replyToId: msg.replyToId,
        vibeType: msg.vibeType || null,
        metadata: parsedMetadata,
        aiFriendId: msg.aiFriendId,
        editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
        isUnsent: msg.isUnsent,
        editHistory: msg.editHistory,
        createdAt: new Date(msg.createdAt).toISOString(),
        linkPreview: msg.linkPreviewUrl ? {
          url: msg.linkPreviewUrl,
          title: msg.linkPreviewTitle,
          description: msg.linkPreviewDescription,
          image: msg.linkPreviewImage,
          siteName: msg.linkPreviewSiteName,
          favicon: msg.linkPreviewFavicon,
        } : null,
        user: msg.user ? {
          id: msg.user.id,
          name: msg.user.name,
          phone: msg.user.phone || "",
          bio: msg.user.bio,
          image: msg.user.image,
          hasCompletedOnboarding: msg.user.hasCompletedOnboarding || false,
          createdAt: new Date(msg.user.createdAt).toISOString(),
          updatedAt: new Date(msg.user.updatedAt).toISOString(),
        } : null,
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
        replyTo: msg.replyTo ? {
          id: msg.replyTo.id,
          content: msg.replyTo.content,
          messageType: msg.replyTo.messageType,
          imageUrl: msg.replyTo.imageUrl,
          userId: msg.replyTo.userId,
          chatId: msg.replyTo.chatId,
          createdAt: new Date(msg.replyTo.createdAt).toISOString(),
          user: msg.replyTo.user ? {
            id: msg.replyTo.user.id,
            name: msg.replyTo.user.name,
            phone: msg.replyTo.user.phone || "",
            bio: msg.replyTo.user.bio,
            image: msg.replyTo.user.image,
            hasCompletedOnboarding: msg.replyTo.user.hasCompletedOnboarding || false,
            createdAt: new Date(msg.replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(msg.replyTo.user.updatedAt).toISOString(),
          } : null,
        } : null,
        reactions: (msg.reactions || []).map((reaction: any) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          messageId: reaction.messageId,
          chatId: reaction.chatId,
          createdAt: new Date(reaction.createdAt).toISOString(),
          user: reaction.user ? {
            id: reaction.user.id,
            name: reaction.user.name,
            phone: reaction.user.phone || "",
            bio: reaction.user.bio,
            image: reaction.user.image,
            hasCompletedOnboarding: reaction.user.hasCompletedOnboarding || false,
            createdAt: new Date(reaction.user.createdAt).toISOString(),
            updatedAt: new Date(reaction.user.updatedAt).toISOString(),
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
            phone: mention.mentionedUser.phone || "",
            bio: mention.mentionedUser.bio,
            image: mention.mentionedUser.image,
            hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding || false,
            createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
            updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
          } : null,
        })),
      };

      return {
        message: formattedMessage,
        chat: msg.chat,
      };
    });

    // Filter out messages where user is null (required by schema)
    // Also, match in-chat search logic: content match OR sender name match
    // The initial SQL query handles the content/sender matching, but we should double check here
    // especially for AI messages which might have null userId but we still want them if they match query
    const validResults = results.filter((r: any) => {
      // 1. Must have a valid message object
      if (!r.message) return false;
      
      // 2. Schema requires 'user' to be non-null. 
      // If it's an AI message (userId is null), we need to ensure we don't break the schema.
      // However, the current schema implementation (searchMessageResultSchema -> messageSchema) 
      // DOES require 'user' to be present.
      // If it's an AI message, we might need to synthesize a "user" object or the schema needs to allow null.
      // Based on messageSchema in contracts.ts, user is REQUIRED (user: User).
      // So filtering out null users is correct for SCHEMA VALIDATION, but might hide AI messages.
      // If AI messages are desired, we would need to mock a user object for them or update schema.
      // For now, adhering to strict schema validation as requested.
      return r.message.user !== null;
    });

    return c.json(searchMessagesResponseSchema.parse(validResults));
  } catch (error) {
    console.error("[Messages] Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// GET /api/messages - Get all messages (optimized single query with all relations)
messages.get("/", async (c) => {
  // Optimized: Single query with all relations - eliminates N+1 problem
  const { data: allMessages, error } = await db
    .from("message")
    .select(`
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
      )
    `)
    .order("createdAt", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[Messages] Error fetching messages:", error);
    return c.json({ error: "Failed to fetch messages" }, 500);
  }

  // Decrypt any encrypted messages
  const decryptedMessages = await decryptMessages(allMessages || []);

  // Format messages synchronously (no additional queries needed)
  const formattedMessages = decryptedMessages.map((msg: any) => {
    // Parse metadata
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
      editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
      isUnsent: msg.isUnsent,
      editHistory: msg.editHistory,
      createdAt: new Date(msg.createdAt).toISOString(),
      linkPreview: msg.linkPreviewUrl ? {
        url: msg.linkPreviewUrl,
        title: msg.linkPreviewTitle,
        description: msg.linkPreviewDescription,
        image: msg.linkPreviewImage,
        siteName: msg.linkPreviewSiteName,
        favicon: msg.linkPreviewFavicon,
      } : null,
      user: msg.user ? {
        id: msg.user.id,
        name: msg.user.name,
        phone: msg.user.phone || "",
        bio: msg.user.bio,
        image: msg.user.image,
        hasCompletedOnboarding: msg.user.hasCompletedOnboarding || false,
        createdAt: new Date(msg.user.createdAt).toISOString(),
        updatedAt: new Date(msg.user.updatedAt).toISOString(),
      } : null,
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
      replyTo: msg.replyTo ? {
        id: msg.replyTo.id,
        content: msg.replyTo.content,
        messageType: msg.replyTo.messageType,
        imageUrl: msg.replyTo.imageUrl,
        imageDescription: msg.replyTo.imageDescription,
        userId: msg.replyTo.userId,
        chatId: msg.replyTo.chatId,
        replyToId: msg.replyTo.replyToId,
        aiFriendId: msg.replyTo.aiFriendId,
        editedAt: msg.replyTo.editedAt ? new Date(msg.replyTo.editedAt).toISOString() : null,
        isUnsent: msg.replyTo.isUnsent,
        editHistory: msg.replyTo.editHistory,
        createdAt: new Date(msg.replyTo.createdAt).toISOString(),
        user: msg.replyTo.user ? {
          id: msg.replyTo.user.id,
          name: msg.replyTo.user.name,
          phone: msg.replyTo.user.phone || "",
          bio: msg.replyTo.user.bio,
          image: msg.replyTo.user.image,
          hasCompletedOnboarding: msg.replyTo.user.hasCompletedOnboarding || false,
          createdAt: new Date(msg.replyTo.user.createdAt).toISOString(),
          updatedAt: new Date(msg.replyTo.user.updatedAt).toISOString(),
        } : null,
        aiFriend: msg.replyTo.aiFriend ? {
          id: msg.replyTo.aiFriend.id,
          name: msg.replyTo.aiFriend.name,
          color: msg.replyTo.aiFriend.color,
        } : null,
      } : null,
      reactions: (msg.reactions || []).map((reaction: any) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        messageId: reaction.messageId,
        chatId: reaction.chatId,
        createdAt: new Date(reaction.createdAt).toISOString(),
        user: reaction.user ? {
          id: reaction.user.id,
          name: reaction.user.name,
          phone: reaction.user.phone || "",
          bio: reaction.user.bio,
          image: reaction.user.image,
          hasCompletedOnboarding: reaction.user.hasCompletedOnboarding || false,
          createdAt: new Date(reaction.user.createdAt).toISOString(),
          updatedAt: new Date(reaction.user.updatedAt).toISOString(),
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
          phone: mention.mentionedUser.phone || "",
          bio: mention.mentionedUser.bio,
          image: mention.mentionedUser.image,
          hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding || false,
          createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
          updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
        } : null,
      })),
    };
  });

  return c.json(getMessagesResponseSchema.parse(formattedMessages));
});

// POST /api/messages/batch - Get multiple messages by IDs (for gap recovery and batch fetching)
messages.post("/batch", async (c) => {
  try {
    const body = await c.req.json();
    const { messageIds } = body as { messageIds: string[] };
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return c.json({ error: "messageIds array is required" }, 400);
    }
    
    // Limit batch size to prevent abuse
    if (messageIds.length > 100) {
      return c.json({ error: "Maximum 100 messages per batch request" }, 400);
    }
    
    const { data: messages, error } = await db
      .from("message")
      .select(`
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
        )
      `)
      .in("id", messageIds);
    
    if (error) {
      console.error("[Messages] Error batch fetching messages:", error);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
    
    // Decrypt any encrypted messages
    const decryptedMessages = await decryptMessages(messages || []);
    
    const formattedMessages = decryptedMessages.map((msg: any) => {
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
        voiceTranscription: msg.voiceTranscription,
        eventId: msg.eventId,
        pollId: msg.pollId,
        userId: msg.userId,
        chatId: msg.chatId,
        replyToId: msg.replyToId,
        vibeType: msg.vibeType || null,
        metadata: parsedMetadata,
        aiFriendId: msg.aiFriendId,
        editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
        isUnsent: msg.isUnsent,
        editHistory: msg.editHistory,
        createdAt: new Date(msg.createdAt).toISOString(),
        linkPreview: msg.linkPreviewUrl ? {
          url: msg.linkPreviewUrl,
          title: msg.linkPreviewTitle,
          description: msg.linkPreviewDescription,
          image: msg.linkPreviewImage,
          siteName: msg.linkPreviewSiteName,
          favicon: msg.linkPreviewFavicon,
        } : null,
        user: msg.user ? {
          id: msg.user.id,
          name: msg.user.name,
          phone: msg.user.phone || "",
          bio: msg.user.bio,
          image: msg.user.image,
          hasCompletedOnboarding: msg.user.hasCompletedOnboarding || false,
          createdAt: new Date(msg.user.createdAt).toISOString(),
          updatedAt: new Date(msg.user.updatedAt).toISOString(),
        } : null,
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
        replyTo: msg.replyTo ? {
          id: msg.replyTo.id,
          content: msg.replyTo.content,
          messageType: msg.replyTo.messageType,
          imageUrl: msg.replyTo.imageUrl,
          userId: msg.replyTo.userId,
          chatId: msg.replyTo.chatId,
          aiFriendId: msg.replyTo.aiFriendId,
          createdAt: new Date(msg.replyTo.createdAt).toISOString(),
          user: msg.replyTo.user ? {
            id: msg.replyTo.user.id,
            name: msg.replyTo.user.name,
            phone: msg.replyTo.user.phone || "",
            bio: msg.replyTo.user.bio,
            image: msg.replyTo.user.image,
            hasCompletedOnboarding: msg.replyTo.user.hasCompletedOnboarding || false,
            createdAt: new Date(msg.replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(msg.replyTo.user.updatedAt).toISOString(),
          } : null,
          aiFriend: msg.replyTo.aiFriend ? {
            id: msg.replyTo.aiFriend.id,
            name: msg.replyTo.aiFriend.name,
            color: msg.replyTo.aiFriend.color,
          } : null,
        } : null,
        reactions: (msg.reactions || []).map((reaction: any) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          messageId: reaction.messageId,
          chatId: reaction.chatId,
          createdAt: new Date(reaction.createdAt).toISOString(),
          user: reaction.user ? {
            id: reaction.user.id,
            name: reaction.user.name,
            phone: reaction.user.phone || "",
            bio: reaction.user.bio,
            image: reaction.user.image,
            hasCompletedOnboarding: reaction.user.hasCompletedOnboarding || false,
            createdAt: new Date(reaction.user.createdAt).toISOString(),
            updatedAt: new Date(reaction.user.updatedAt).toISOString(),
          } : null,
        })),
        mentions: (msg.mentions || []).map((mention: any) => ({
          id: mention.id,
          messageId: mention.messageId,
          mentionedUserId: mention.mentionedUserId,
          createdAt: new Date(mention.createdAt).toISOString(),
          mentionedUser: mention.mentionedUser ? {
            id: mention.mentionedUser.id,
            name: mention.mentionedUser.name,
            phone: mention.mentionedUser.phone || "",
            bio: mention.mentionedUser.bio,
            image: mention.mentionedUser.image,
            hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding || false,
            createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
            updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
          } : null,
        })),
      };
    });
    
    return c.json({ messages: formattedMessages });
  } catch (error) {
    console.error("[Messages] Error in batch endpoint:", error);
    return c.json({ error: "Failed to batch fetch messages" }, 500);
  }
});

// GET /api/messages/:id/context - Get message context (surrounding messages)
messages.get("/:id/context", async (c) => {
  const messageId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "50"); // Messages before/after
  
  try {
    // 1. Get the target message first to find its createdAt and chatId
    const { data: targetMessage, error: targetError } = await db
      .from("message")
      .select("id, chatId, createdAt")
      .eq("id", messageId)
      .single();

    if (targetError || !targetMessage) {
      return c.json({ error: "Message not found" }, 404);
    }

    const { chatId, createdAt } = targetMessage;

    // 2. Fetch messages BEFORE the target (older)
    const { data: olderMessages, error: olderError } = await db
      .from("message")
      .select(`
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
        )
      `)
      .eq("chatId", chatId)
      .lt("createdAt", createdAt)
      .order("createdAt", { ascending: false }) // Newest to oldest
      .limit(limit);

    if (olderError) {
      console.error("[Messages] Error fetching older context:", olderError);
      throw olderError;
    }

    // 3. Fetch messages AFTER the target (newer)
    const { data: newerMessages, error: newerError } = await db
      .from("message")
      .select(`
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
        )
      `)
      .eq("chatId", chatId)
      .gt("createdAt", createdAt)
      .order("createdAt", { ascending: true }) // Oldest to newest
      .limit(limit);

    if (newerError) {
      console.error("[Messages] Error fetching newer context:", newerError);
      throw newerError;
    }

    // 4. Fetch the target message with full details
    const { data: fullTargetMessage, error: fullTargetError } = await db
      .from("message")
      .select(`
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
        )
      `)
      .eq("id", messageId)
      .single();

    if (fullTargetError) {
      throw fullTargetError;
    }

    // Combine all messages: newer (reversed to be newest first) + target + older
    // The frontend expects descending order (Newest -> Oldest)
    const newer = (newerMessages || []).reverse(); // Make newest first
    const older = olderMessages || [];
    
    const allRawMessages = [...newer, fullTargetMessage, ...older];

    // Decrypt everything
    const decryptedMessages = await decryptMessages(allRawMessages);

    // Format messages
    const formattedMessages = decryptedMessages.map((msg: any) => {
      // Parse metadata
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
        voiceTranscription: msg.voiceTranscription,
        eventId: msg.eventId,
        pollId: msg.pollId,
        userId: msg.userId,
        chatId: msg.chatId,
        replyToId: msg.replyToId,
        vibeType: msg.vibeType || null,
        metadata: parsedMetadata,
        aiFriendId: msg.aiFriendId,
        editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
        isUnsent: msg.isUnsent,
        editHistory: msg.editHistory,
        createdAt: new Date(msg.createdAt).toISOString(),
        linkPreview: msg.linkPreviewUrl ? {
          url: msg.linkPreviewUrl,
          title: msg.linkPreviewTitle,
          description: msg.linkPreviewDescription,
          image: msg.linkPreviewImage,
          siteName: msg.linkPreviewSiteName,
          favicon: msg.linkPreviewFavicon,
        } : null,
        user: msg.user ? {
          id: msg.user.id,
          name: msg.user.name,
          phone: msg.user.phone || "",
          bio: msg.user.bio,
          image: msg.user.image,
          hasCompletedOnboarding: msg.user.hasCompletedOnboarding || false,
          createdAt: new Date(msg.user.createdAt).toISOString(),
          updatedAt: new Date(msg.user.updatedAt).toISOString(),
        } : null,
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
        replyTo: msg.replyTo ? {
          id: msg.replyTo.id,
          content: msg.replyTo.content,
          messageType: msg.replyTo.messageType,
          imageUrl: msg.replyTo.imageUrl,
          imageDescription: msg.replyTo.imageDescription,
          userId: msg.replyTo.userId,
          chatId: msg.replyTo.chatId,
          replyToId: msg.replyTo.replyToId,
          aiFriendId: msg.replyTo.aiFriendId,
          editedAt: msg.replyTo.editedAt ? new Date(msg.replyTo.editedAt).toISOString() : null,
          isUnsent: msg.replyTo.isUnsent,
          editHistory: msg.replyTo.editHistory,
          createdAt: new Date(msg.replyTo.createdAt).toISOString(),
          user: msg.replyTo.user ? {
            id: msg.replyTo.user.id,
            name: msg.replyTo.user.name,
            phone: msg.replyTo.user.phone || "",
            bio: msg.replyTo.user.bio,
            image: msg.replyTo.user.image,
            hasCompletedOnboarding: msg.replyTo.user.hasCompletedOnboarding || false,
            createdAt: new Date(msg.replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(msg.replyTo.user.updatedAt).toISOString(),
          } : null,
          aiFriend: msg.replyTo.aiFriend ? {
            id: msg.replyTo.aiFriend.id,
            name: msg.replyTo.aiFriend.name,
            color: msg.replyTo.aiFriend.color,
          } : null,
        } : null,
        reactions: (msg.reactions || []).map((reaction: any) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          messageId: reaction.messageId,
          chatId: reaction.chatId,
          createdAt: new Date(reaction.createdAt).toISOString(),
          user: reaction.user ? {
            id: reaction.user.id,
            name: reaction.user.name,
            phone: reaction.user.phone || "",
            bio: reaction.user.bio,
            image: reaction.user.image,
            hasCompletedOnboarding: reaction.user.hasCompletedOnboarding || false,
            createdAt: new Date(reaction.user.createdAt).toISOString(),
            updatedAt: new Date(reaction.user.updatedAt).toISOString(),
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
            phone: mention.mentionedUser.phone || "",
            bio: mention.mentionedUser.bio,
            image: mention.mentionedUser.image,
            hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding || false,
            createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
            updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
          } : null,
          mentionedBy: mention.mentionedBy ? {
            id: mention.mentionedBy.id,
            name: mention.mentionedBy.name,
            phone: mention.mentionedBy.phone || "",
            bio: mention.mentionedBy.bio,
            image: mention.mentionedBy.image,
            hasCompletedOnboarding: mention.mentionedBy.hasCompletedOnboarding || false,
            createdAt: new Date(mention.mentionedBy.createdAt).toISOString(),
            updatedAt: new Date(mention.mentionedBy.updatedAt).toISOString(),
          } : null,
        })),
      };
    });

    const nextCursor = olderMessages && olderMessages.length > 0 ? olderMessages[olderMessages.length - 1].createdAt : null;
    const prevCursor = newerMessages && newerMessages.length > 0 ? newerMessages[newerMessages.length - 1].createdAt : null;

    return c.json({
      messages: formattedMessages,
      targetMessageId: messageId,
      nextCursor,
      prevCursor
    });

  } catch (error) {
    console.error("[Messages] Error fetching message context:", error);
    return c.json({ error: "Failed to fetch message context" }, 500);
  }
});

// GET /api/messages/:id - Get a single message details
messages.get("/:id", async (c) => {
  const messageId = c.req.param("id");
  
  try {
    const { data: msg, error } = await db
      .from("message")
      .select(`
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
        )
      `)
      .eq("id", messageId)
      .single();

    if (error || !msg) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Decrypt message if encrypted
    const [decryptedMsg] = await decryptMessages([msg]);

    // Decrypt replyTo if it exists
    if (decryptedMsg.replyTo) {
      const [decryptedReplyTo] = await decryptMessages([decryptedMsg.replyTo]);
      decryptedMsg.replyTo = decryptedReplyTo;
    }

    // Parse metadata
    let parsedMetadata = decryptedMsg.metadata;
    if (typeof msg.metadata === "string") {
      try {
        parsedMetadata = JSON.parse(msg.metadata);
      } catch {
        parsedMetadata = null;
      }
    }

    const formattedMessage = {
      id: decryptedMsg.id,
      content: decryptedMsg.content,
      messageType: decryptedMsg.messageType,
      imageUrl: decryptedMsg.imageUrl,
      imageDescription: decryptedMsg.imageDescription,
      voiceUrl: decryptedMsg.voiceUrl,
      voiceDuration: decryptedMsg.voiceDuration,
      voiceTranscription: decryptedMsg.voiceTranscription,
      eventId: decryptedMsg.eventId,
      pollId: decryptedMsg.pollId,
      userId: decryptedMsg.userId,
      chatId: decryptedMsg.chatId,
      replyToId: decryptedMsg.replyToId,
      vibeType: decryptedMsg.vibeType || null,
      metadata: parsedMetadata,
      aiFriendId: decryptedMsg.aiFriendId,
      aiFriend: decryptedMsg.aiFriend ? {
        id: decryptedMsg.aiFriend.id,
        name: decryptedMsg.aiFriend.name,
        color: decryptedMsg.aiFriend.color,
        personality: decryptedMsg.aiFriend.personality,
        tone: decryptedMsg.aiFriend.tone,
        engagementMode: decryptedMsg.aiFriend.engagementMode,
        engagementPercent: decryptedMsg.aiFriend.engagementPercent,
        chatId: decryptedMsg.aiFriend.chatId,
        sortOrder: decryptedMsg.aiFriend.sortOrder,
        createdAt: new Date(decryptedMsg.aiFriend.createdAt).toISOString(),
        updatedAt: new Date(decryptedMsg.aiFriend.updatedAt).toISOString(),
      } : null,
      editedAt: decryptedMsg.editedAt ? new Date(decryptedMsg.editedAt).toISOString() : null,
      isUnsent: decryptedMsg.isUnsent,
      editHistory: decryptedMsg.editHistory,
      user: decryptedMsg.user ? {
        id: decryptedMsg.user.id,
        name: decryptedMsg.user.name,
        phone: decryptedMsg.user.phone || "",
        bio: decryptedMsg.user.bio,
        image: decryptedMsg.user.image,
        hasCompletedOnboarding: decryptedMsg.user.hasCompletedOnboarding || false,
        createdAt: new Date(decryptedMsg.user.createdAt).toISOString(),
        updatedAt: new Date(decryptedMsg.user.updatedAt).toISOString(),
      } : null,
      replyTo: decryptedMsg.replyTo ? {
        id: decryptedMsg.replyTo.id,
        content: decryptedMsg.replyTo.content,
        messageType: decryptedMsg.replyTo.messageType,
        imageUrl: decryptedMsg.replyTo.imageUrl,
        imageDescription: decryptedMsg.replyTo.imageDescription,
        voiceUrl: decryptedMsg.replyTo.voiceUrl,
        voiceDuration: decryptedMsg.replyTo.voiceDuration,
        userId: decryptedMsg.replyTo.userId,
        chatId: decryptedMsg.replyTo.chatId,
        replyToId: decryptedMsg.replyTo.replyToId,
        aiFriendId: decryptedMsg.replyTo.aiFriendId,
        editedAt: decryptedMsg.replyTo.editedAt ? new Date(decryptedMsg.replyTo.editedAt).toISOString() : null,
        isUnsent: decryptedMsg.replyTo.isUnsent,
        editHistory: decryptedMsg.replyTo.editHistory,
        user: decryptedMsg.replyTo.user ? {
          id: decryptedMsg.replyTo.user.id,
          name: decryptedMsg.replyTo.user.name,
          phone: decryptedMsg.replyTo.user.phone || "",
          bio: decryptedMsg.replyTo.user.bio,
          image: decryptedMsg.replyTo.user.image,
          hasCompletedOnboarding: decryptedMsg.replyTo.user.hasCompletedOnboarding || false,
          createdAt: new Date(decryptedMsg.replyTo.user.createdAt).toISOString(),
          updatedAt: new Date(decryptedMsg.replyTo.user.updatedAt).toISOString(),
        } : null,
        aiFriend: decryptedMsg.replyTo.aiFriend ? {
          id: decryptedMsg.replyTo.aiFriend.id,
          name: decryptedMsg.replyTo.aiFriend.name,
          color: decryptedMsg.replyTo.aiFriend.color,
          personality: decryptedMsg.replyTo.aiFriend.personality,
          tone: decryptedMsg.replyTo.aiFriend.tone,
          engagementMode: decryptedMsg.replyTo.aiFriend.engagementMode,
          engagementPercent: decryptedMsg.replyTo.aiFriend.engagementPercent,
          chatId: decryptedMsg.replyTo.aiFriend.chatId,
          sortOrder: decryptedMsg.replyTo.aiFriend.sortOrder,
          createdAt: new Date(decryptedMsg.replyTo.aiFriend.createdAt).toISOString(),
          updatedAt: new Date(decryptedMsg.replyTo.aiFriend.updatedAt).toISOString(),
        } : null,
        createdAt: new Date(decryptedMsg.replyTo.createdAt).toISOString(),
      } : null,
      reactions: (decryptedMsg.reactions || []).map((r: any) => ({
        id: r.id,
        emoji: r.emoji,
        userId: r.userId,
        messageId: r.messageId,
        createdAt: new Date(r.createdAt).toISOString(),
        user: r.user ? {
          id: r.user.id,
          name: r.user.name,
          phone: r.user.phone || "",
          bio: r.user.bio,
          image: r.user.image,
          hasCompletedOnboarding: r.user.hasCompletedOnboarding || false,
          createdAt: new Date(r.user.createdAt).toISOString(),
          updatedAt: new Date(r.user.updatedAt).toISOString(),
        } : null,
      })),
      mentions: (decryptedMsg.mentions || []).map((mention: any) => ({
        id: mention.id,
        messageId: mention.messageId,
        mentionedUserId: mention.mentionedUserId,
        mentionedByUserId: mention.mentionedByUserId,
        createdAt: new Date(mention.createdAt).toISOString(),
        mentionedUser: mention.mentionedUser ? {
          id: mention.mentionedUser.id,
          name: mention.mentionedUser.name,
          phone: mention.mentionedUser.phone || "",
          bio: mention.mentionedUser.bio,
          image: mention.mentionedUser.image,
          hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding || false,
          createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
          updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
        } : null,
        mentionedBy: mention.mentionedBy ? {
          id: mention.mentionedBy.id,
          name: mention.mentionedBy.name,
          phone: mention.mentionedBy.phone || "",
          bio: mention.mentionedBy.bio,
          image: mention.mentionedBy.image,
          hasCompletedOnboarding: mention.mentionedBy.hasCompletedOnboarding || false,
          createdAt: new Date(mention.mentionedBy.createdAt).toISOString(),
          updatedAt: new Date(mention.mentionedBy.updatedAt).toISOString(),
        } : null,
      })),
      linkPreview: decryptedMsg.linkPreviewUrl ? {
        url: decryptedMsg.linkPreviewUrl,
        title: decryptedMsg.linkPreviewTitle,
        description: decryptedMsg.linkPreviewDescription,
        image: decryptedMsg.linkPreviewImage,
        siteName: decryptedMsg.linkPreviewSiteName,
        favicon: decryptedMsg.linkPreviewFavicon,
      } : null,
      createdAt: new Date(decryptedMsg.createdAt).toISOString(),
    };

    return c.json(formattedMessage);
  } catch (error) {
    console.error("[Messages] Error fetching message:", error);
    return c.json({ error: "Failed to fetch message" }, 500);
  }
});

// POST /api/messages - Send message
messages.post("/", zValidator("json", sendMessageRequestSchema), async (c) => {
  const { content, messageType, imageUrl, voiceUrl, voiceDuration, userId, replyToId, mentionedUserIds } = c.req.valid("json");

  // Create the message
  const { data: message, error: messageError } = await db
    .from("message")
    .insert({
      content: content || "",
      messageType: messageType || "text",
      imageUrl: imageUrl || null,
      voiceUrl: voiceUrl || null,
      voiceDuration: voiceDuration || null,
      userId,
      replyToId: replyToId || null,
      metadata: (c.req.valid("json") as any).metadata || null,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    console.error("[Messages] Error creating message:", messageError);
    return c.json({ error: "Failed to create message" }, 500);
  }

  // Decrypt the message immediately for processing
  const [decryptedMessage] = await decryptMessages([message]);

  // Fetch user
  const { data: user, error: userError } = await db
    .from("user")
    .select("*")
    .eq("id", message.userId)
    .single();

  if (userError || !user) {
    console.error("[Messages] Error fetching user:", userError);
    return c.json({ error: "Failed to fetch user" }, 500);
  }

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
  if (mentionedUserIds && mentionedUserIds.length > 0) {
    console.log(`[@] Creating ${mentionedUserIds.length} mention(s) for message ${message.id}`);
    
    // Insert mentions
    const { error: mentionError } = await db
      .from("mention")
      .insert(
        mentionedUserIds.map(mentionedUserId => ({
          messageId: message.id,
          mentionedUserId,
          mentionedByUserId: userId,
        }))
      );
    
    if (mentionError) {
      console.error("[Messages] Error creating mentions:", mentionError);
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
  if (decryptedMessage.content && decryptedMessage.content.trim().length > 0) {
    tagMessage(decryptedMessage.id, decryptedMessage.content).catch(error => {
      console.error(`[Messages] Failed to tag message ${message.id}:`, error);
    });

    // Generate embedding for semantic search (fire-and-forget)
    if (messageType === "text") {
      Promise.resolve().then(async () => {
        try {
          console.log(`🧠 [Messages] Generating embedding for message ${message.id}`);
          const embedding = await generateEmbedding(decryptedMessage.content);
          
          await db
            .from("message")
            .update({ embedding })
            .eq("id", message.id);
            
          console.log(`✅ [Messages] Embedding saved for message ${message.id}`);
        } catch (error) {
          console.error(`❌ [Messages] Failed to generate embedding for message ${message.id}:`, error);
        }
      });

      // Trigger Proactive AI analysis (fire-and-forget)
      Promise.resolve().then(() => 
        analyzeMessageForProactiveAction(message.id, decryptedMessage.content, message.chatId)
      );
    }
  }

  // If this is an image message, trigger async description generation
  if (messageType === "image" && imageUrl) {
    console.log(`🖼️ [Messages] Image message created (${message.id}), triggering description generation`);

    // Get backend URL from environment or construct it
    const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
                       process.env.BACKEND_URL ||
                       `http://localhost:${process.env.PORT || 3000}`;

    // Fire-and-forget: Generate description in background
    Promise.resolve().then(async () => {
      try {
        console.log(`🔄 [Messages] Starting background description generation for message ${message.id}`);
        const description = await generateImageDescription(imageUrl, backendUrl);

        // Update the message with the description
        await db
          .from("message")
          .update({ imageDescription: description })
          .eq("id", message.id);

        console.log(`✅ [Messages] Description saved for message ${message.id}`);
      } catch (error) {
        console.error(`❌ [Messages] Failed to generate description for message ${message.id}:`, error);
      }
    });
  }

  // If this is a voice message, trigger async transcription
  if ((messageType === "audio" || messageType === "voice" || voiceUrl) && voiceUrl) {
    console.log(`🎙️ [Messages] Voice message created (${message.id}), triggering transcription`);

    // Fire-and-forget: Generate transcription in background
    Promise.resolve().then(async () => {
      try {
        console.log(`🔄 [Messages] Starting background transcription for message ${message.id}`);
        const transcription = await generateVoiceTranscription(voiceUrl);

        // Update the message with the transcription
        await db
          .from("message")
          .update({ voiceTranscription: transcription })
          .eq("id", message.id);

        console.log(`✅ [Messages] Transcription saved for message ${message.id}`);
      } catch (error) {
        console.error(`❌ [Messages] Failed to generate transcription for message ${message.id}:`, error);
      }
    });
  }

  // If this is a text message, check for URLs and fetch link preview
  if (messageType === "text" && decryptedMessage.content) {
    const url = extractFirstUrl(decryptedMessage.content);
    if (url) {
      console.log(`🔗 [Messages] URL detected in message (${message.id}), fetching link preview: ${url}`);

      // Fire-and-forget: Fetch link preview in background
      Promise.resolve().then(async () => {
        try {
          console.log(`🔄 [Messages] Starting background link preview fetch for message ${message.id}`);
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

            console.log(`✅ [Messages] Link preview saved for message ${message.id}`);
          } else {
            console.log(`⚠️ [Messages] No link preview data available for ${url}`);
          }
        } catch (error) {
          console.error(`❌ [Messages] Failed to fetch link preview for message ${message.id}:`, error);
        }
      });
    }
  }

  // IMPORTANT: Return the original content, not message.content which is encrypted by the DB trigger
  return c.json(sendMessageResponseSchema.parse({
    id: message.id,
    content: content || "", // Use original content, not encrypted message.content
    messageType: message.messageType,
    imageUrl: message.imageUrl,
    imageDescription: message.imageDescription,
    voiceUrl: message.voiceUrl,
    voiceDuration: message.voiceDuration,
    voiceTranscription: message.voiceTranscription,
    userId: message.userId,
    chatId: message.chatId,
    replyToId: message.replyToId,
    editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
    isUnsent: message.isUnsent,
    editHistory: message.editHistory,
    createdAt: new Date(message.createdAt).toISOString(),
    linkPreview: null, // Will be populated asynchronously
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone || "",
      bio: user.bio,
      image: user.image,
      hasCompletedOnboarding: user.hasCompletedOnboarding || false,
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    },
    replyTo: replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          messageType: replyTo.messageType,
          imageUrl: replyTo.imageUrl,
          imageDescription: replyTo.imageDescription,
          voiceUrl: replyTo.voiceUrl,
          voiceDuration: replyTo.voiceDuration,
          voiceTranscription: replyTo.voiceTranscription,
          userId: replyTo.userId,
          chatId: replyTo.chatId,
          replyToId: replyTo.replyToId,
          editedAt: replyTo.editedAt ? new Date(replyTo.editedAt).toISOString() : null,
          isUnsent: replyTo.isUnsent,
          editHistory: replyTo.editHistory,
          createdAt: new Date(replyTo.createdAt).toISOString(),
          user: {
            id: replyTo.user.id,
            name: replyTo.user.name,
            phone: replyTo.user.phone || "",
            bio: replyTo.user.bio,
            image: replyTo.user.image,
            hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding || false,
            createdAt: new Date(replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
          },
        }
      : null,
    reactions: [],
    mentions: mentions.map((mention) => ({
      id: mention.id,
      messageId: mention.messageId,
      mentionedUserId: mention.mentionedUserId,
      mentionedByUserId: mention.mentionedByUserId,
      createdAt: new Date(mention.createdAt).toISOString(),
      mentionedUser: {
        id: mention.mentionedUser.id,
        name: mention.mentionedUser.name,
        phone: mention.mentionedUser.phone || "",
        bio: mention.mentionedUser.bio,
        image: mention.mentionedUser.image,
        hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding || false,
        createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
        updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
      },
      mentionedBy: {
        id: mention.mentionedBy.id,
        name: mention.mentionedBy.name,
        phone: mention.mentionedBy.phone || "",
        bio: mention.mentionedBy.bio,
        image: mention.mentionedBy.image,
        hasCompletedOnboarding: mention.mentionedBy.hasCompletedOnboarding || false,
        createdAt: new Date(mention.mentionedBy.createdAt).toISOString(),
        updatedAt: new Date(mention.mentionedBy.updatedAt).toISOString(),
      },
    })),
  }));
});

// DELETE /api/messages/clear - Clear all messages
messages.delete("/clear", async (c) => {
  try {
    // Delete all messages
    const { error, count } = await db
      .from("message")
      .delete()
      .neq("id", "");  // Delete all (Supabase requires a condition)

    if (error) {
      console.error("Error clearing messages:", error);
      return c.json(clearMessagesResponseSchema.parse({
        success: false,
        message: "Failed to clear messages",
        deletedCount: 0,
      }), 500);
    }

    return c.json(clearMessagesResponseSchema.parse({
      success: true,
      message: "All messages cleared successfully",
      deletedCount: count || 0,
    }));
  } catch (error) {
    console.error("Error clearing messages:", error);
    return c.json(clearMessagesResponseSchema.parse({
      success: false,
      message: "Failed to clear messages",
      deletedCount: 0,
    }), 500);
  }
});

// PATCH /api/messages/:id/description - Update message description
messages.patch("/:id/description", zValidator("json", updateMessageDescriptionRequestSchema), async (c) => {
  try {
    const messageId = c.req.param("id");
    const { imageDescription } = c.req.valid("json");

    console.log(`📝 [Messages] Updating description for message ${messageId}`);

    // Update the message with the description
    const { data: updatedMessage, error: updateError } = await db
      .from("message")
      .update({ imageDescription })
      .eq("id", messageId)
      .select("*")
      .single();

    if (updateError || !updatedMessage) {
      console.error("Error updating message description:", updateError);
      return c.json({ error: "Failed to update message description" }, 500);
    }

    // Fetch user
    const { data: user, error: userError } = await db
      .from("user")
      .select("*")
      .eq("id", updatedMessage.userId)
      .single();

    if (userError || !user) {
      console.error("Error fetching user:", userError);
      return c.json({ error: "Failed to fetch user" }, 500);
    }

    console.log(`✅ [Messages] Description updated for message ${messageId}`);

    return c.json(updateMessageDescriptionResponseSchema.parse({
      id: updatedMessage.id,
      content: updatedMessage.content,
      messageType: updatedMessage.messageType,
      imageUrl: updatedMessage.imageUrl,
      imageDescription: updatedMessage.imageDescription,
      userId: updatedMessage.userId,
      createdAt: new Date(updatedMessage.createdAt || (updatedMessage as any).created_at).toISOString(),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone || "",
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding || false,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      },
    }));
  } catch (error) {
    console.error("Error updating message description:", error);
    return c.json({ error: "Failed to update message description" }, 500);
  }
});

// PATCH /api/messages/:id - Edit a message
messages.patch("/:id", zValidator("json", editMessageRequestSchema), async (c) => {
  try {
    const messageId = c.req.param("id");
    const { 
      content, 
      userId, 
      messageType, 
      imageUrl, 
      voiceUrl, 
      voiceDuration, 
      mentionedUserIds, 
      metadata 
    } = c.req.valid("json");

    console.log(`✏️  [Messages] Edit request for message ${messageId} by user ${userId}`);

    // Fetch the message to check ownership and timestamp
    const { data: message, error: fetchError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Check ownership - only the message sender can edit
    if (message.userId !== userId) {
      return c.json({ error: "You can only edit your own messages" }, 403);
    }

    // Check if message is within 15 minute edit window
    const now = new Date();
    const messageAge = now.getTime() - new Date(message.createdAt).getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (messageAge > fifteenMinutes) {
      return c.json({ error: "Message can only be edited within 15 minutes of sending" }, 400);
    }

    // Store edit history - decrypt the old content first
    let editHistory: any[] = [];
    if (message.editHistory) {
      try {
        editHistory = JSON.parse(message.editHistory);
      } catch (e) {
        editHistory = [];
      }
    }
    
    // Decrypt the old message content before storing in history
    const [decryptedOldMessage] = await decryptMessages([message]);
    editHistory.push({
      content: decryptedOldMessage.content,
      editedAt: now.toISOString(),
    });

    // Update the message
    const { data: updatedMessage, error: updateError } = await db
      .from("message")
      .update({
        content,
        editedAt: now.toISOString(),
        editHistory: JSON.stringify(editHistory),
        ...(messageType ? { messageType } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(voiceUrl !== undefined ? { voiceUrl } : {}),
        ...(voiceDuration !== undefined ? { voiceDuration } : {}),
        ...(metadata !== undefined ? { metadata: metadata ? JSON.stringify(metadata) : null } : {}),
      })
      .eq("id", messageId)
      .select("*")
      .single();

    if (updateError || !updatedMessage) {
      console.error("Error updating message:", updateError);
      return c.json({ error: "Failed to edit message" }, 500);
    }

    // Handle mentions if provided
    let mentions: any[] = [];
    
    if (mentionedUserIds !== undefined) {
      // 1. Delete existing mentions
      await db.from("mention").delete().eq("messageId", messageId);
      
      // 2. Insert new mentions if any
      if (mentionedUserIds.length > 0) {
        console.log(`[@] Updating mentions for message ${messageId}: ${mentionedUserIds.length} users`);
        
        const { error: mentionError } = await db
          .from("mention")
          .insert(
            mentionedUserIds.map(mentionedUserId => ({
              messageId: messageId,
              mentionedUserId,
              mentionedByUserId: userId,
            }))
          );
        
        if (mentionError) {
          console.error("[Messages] Error creating mentions:", mentionError);
        }
      }
    }

    // Fetch final mentions
    const { data: currentMentions } = await db
      .from("mention")
      .select("*, mentionedUser:user!mentionedUserId(*), mentionedBy:user!mentionedByUserId(*)")
      .eq("messageId", messageId);
      
    mentions = currentMentions || [];

    // Fetch user
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", updatedMessage.userId)
      .single();

    // Fetch reactions
    const { data: reactions = [] } = await db
      .from("reaction")
      .select("*")
      .eq("messageId", updatedMessage.id);

    // Fetch replyTo if exists
    let replyTo = null;
    if (updatedMessage.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", updatedMessage.replyToId)
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

    console.log(`✅ [Messages] Message ${messageId} edited successfully`);

    // Parse and validate the response
    // IMPORTANT: Return the new content from request, not encrypted updatedMessage.content
    try {
      const response = editMessageResponseSchema.parse({
        id: updatedMessage.id,
        content: content, // Use original content, not encrypted updatedMessage.content
        messageType: updatedMessage.messageType,
        imageUrl: updatedMessage.imageUrl,
        imageDescription: updatedMessage.imageDescription,
        voiceUrl: updatedMessage.voiceUrl,
        voiceDuration: updatedMessage.voiceDuration,
        voiceTranscription: updatedMessage.voiceTranscription,
        userId: updatedMessage.userId,
        chatId: updatedMessage.chatId,
        replyToId: updatedMessage.replyToId,
        editedAt: updatedMessage.editedAt ? new Date(updatedMessage.editedAt).toISOString() : null,
        isUnsent: updatedMessage.isUnsent,
        editHistory: typeof updatedMessage.editHistory === 'object' ? JSON.stringify(updatedMessage.editHistory) : updatedMessage.editHistory,
        createdAt: new Date(updatedMessage.createdAt || (updatedMessage as any).created_at).toISOString(),
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
        replyTo: replyTo ? {
          id: replyTo.id,
          content: replyTo.content,
          messageType: replyTo.messageType,
          imageUrl: replyTo.imageUrl,
          imageDescription: replyTo.imageDescription,
          voiceUrl: replyTo.voiceUrl,
          voiceDuration: replyTo.voiceDuration,
          voiceTranscription: replyTo.voiceTranscription,
          userId: replyTo.userId,
          chatId: replyTo.chatId,
          replyToId: replyTo.replyToId,
          createdAt: new Date(replyTo.createdAt).toISOString(),
          user: {
            id: replyTo.user.id,
            name: replyTo.user.name,
            phone: replyTo.user.phone || "",
            bio: replyTo.user.bio,
            image: replyTo.user.image,
            hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding || false,
            createdAt: new Date(replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
          },
        } : null,
        reactions: reactions.map((reaction: any) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          messageId: reaction.messageId,
          createdAt: new Date(reaction.createdAt).toISOString(),
        })),
        mentions: mentions.map((m: any) => ({
          id: m.id,
          messageId: m.messageId,
          mentionedUserId: m.mentionedUserId,
          mentionedByUserId: m.mentionedByUserId,
          createdAt: new Date(m.createdAt).toISOString(),
          mentionedUser: m.mentionedUser ? {
            id: m.mentionedUser.id,
            name: m.mentionedUser.name,
            phone: m.mentionedUser.phone || "",
            bio: m.mentionedUser.bio,
            image: m.mentionedUser.image,
            hasCompletedOnboarding: m.mentionedUser.hasCompletedOnboarding || false,
            createdAt: new Date(m.mentionedUser.createdAt).toISOString(),
            updatedAt: new Date(m.mentionedUser.updatedAt).toISOString(),
          } : undefined,
          mentionedBy: m.mentionedBy ? {
            id: m.mentionedBy.id,
            name: m.mentionedBy.name,
            phone: m.mentionedBy.phone || "",
            bio: m.mentionedBy.bio,
            image: m.mentionedBy.image,
            hasCompletedOnboarding: m.mentionedBy.hasCompletedOnboarding || false,
            createdAt: new Date(m.mentionedBy.createdAt).toISOString(),
            updatedAt: new Date(m.mentionedBy.updatedAt).toISOString(),
          } : undefined,
        })),
        metadata: updatedMessage.metadata ? (typeof updatedMessage.metadata === 'string' ? JSON.parse(updatedMessage.metadata) : updatedMessage.metadata) : null,
      });

      return c.json(response);
    } catch (parseError) {
      console.error("Error parsing edit message response:", parseError);
      // Return success anyway since the message was actually edited
      return c.json({ 
        id: updatedMessage.id,
        content: content,
        messageType: updatedMessage.messageType,
        userId: updatedMessage.userId,
        chatId: updatedMessage.chatId,
        createdAt: new Date(updatedMessage.createdAt || (updatedMessage as any).created_at).toISOString(),
        user: user || null,
      } as any);
    }
  } catch (error) {
    console.error("Error editing message:", error);
    return c.json({ error: "Failed to edit message" }, 500);
  }
});

// POST /api/messages/:id/unsend - Unsend a message
messages.post("/:id/unsend", zValidator("json", unsendMessageRequestSchema), async (c) => {
  try {
    const messageId = c.req.param("id");
    const { userId } = c.req.valid("json");

    console.log(`🚫 [Messages] Unsend request for message ${messageId} by user ${userId}`);

    // Fetch the message to check ownership and timestamp
    const { data: message, error: fetchError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Check ownership - only the message sender can unsend
    if (message.userId !== userId) {
      return c.json({ error: "You can only unsend your own messages" }, 403);
    }

    // Check if message is within 2 minute unsend window
    const now = new Date();
    const messageAge = now.getTime() - new Date(message.createdAt).getTime();
    const twoMinutes = 2 * 60 * 1000;

    if (messageAge > twoMinutes) {
      return c.json({ error: "Message can only be unsent within 2 minutes of sending" }, 400);
    }

    // Fetch chat name for system message
    const { data: chat } = await db
      .from("chat")
      .select("name")
      .eq("id", message.chatId)
      .single();

    // Mark message as unsent
    const { data: updatedMessage, error: updateError } = await db
      .from("message")
      .update({
        isUnsent: true,
        content: "", // Clear content for unsent messages
      })
      .eq("id", messageId)
      .select("*")
      .single();

    if (updateError || !updatedMessage) {
      console.error("Error unsending message:", updateError);
      return c.json({ error: "Failed to unsend message" }, 500);
    }

    // Fetch user
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", updatedMessage.userId)
      .single();

    // Fetch reactions
    const { data: reactions = [] } = await db
      .from("reaction")
      .select("*")
      .eq("messageId", updatedMessage.id);

    // Fetch replyTo if exists
    let replyTo = null;
    if (updatedMessage.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", updatedMessage.replyToId)
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

    // Create a system message indicating the unsend action
    await db
      .from("message")
      .insert({
        content: `You unsent a message. ${chat?.name || "The chat"} may still see the message on devices where the software hasn't been updated.`,
        messageType: "system",
        userId: "system",
        chatId: message.chatId,
      });

    console.log(`✅ [Messages] Message ${messageId} unsent successfully`);

    // Safely construct the response object handling potential snake_case/camelCase issues
    const responseObj = {
      id: updatedMessage.id,
      content: updatedMessage.content,
      messageType: updatedMessage.messageType,
      imageUrl: updatedMessage.imageUrl,
      imageDescription: updatedMessage.imageDescription,
      userId: updatedMessage.userId,
      chatId: updatedMessage.chatId,
      replyToId: updatedMessage.replyToId,
      editedAt: updatedMessage.editedAt ? new Date(updatedMessage.editedAt).toISOString() : null,
      isUnsent: updatedMessage.isUnsent,
      editHistory: typeof updatedMessage.editHistory === 'object' ? JSON.stringify(updatedMessage.editHistory) : updatedMessage.editHistory,
      // Handle both camelCase and snake_case for createdAt
      createdAt: new Date(updatedMessage.createdAt || (updatedMessage as any).created_at || new Date()).toISOString(),
      user: user ? {
        id: user.id,
        name: user.name,
        phone: user.phone || "",
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding || false,
        createdAt: new Date(user.createdAt || (user as any).created_at || new Date()).toISOString(),
        updatedAt: new Date(user.updatedAt || (user as any).updated_at || new Date()).toISOString(),
      } : null,
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        messageType: replyTo.messageType,
        imageUrl: replyTo.imageUrl,
        imageDescription: replyTo.imageDescription,
        userId: replyTo.userId,
        chatId: replyTo.chatId,
        replyToId: replyTo.replyToId,
        // Handle both camelCase and snake_case for replyTo.createdAt
        createdAt: new Date(replyTo.createdAt || (replyTo as any).created_at || new Date()).toISOString(),
        user: {
          id: replyTo.user.id,
          name: replyTo.user.name,
          phone: replyTo.user.phone || "",
          bio: replyTo.user.bio,
          image: replyTo.user.image,
          hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding || false,
          createdAt: new Date(replyTo.user.createdAt || (replyTo.user as any).created_at || new Date()).toISOString(),
          updatedAt: new Date(replyTo.user.updatedAt || (replyTo.user as any).updated_at || new Date()).toISOString(),
        },
      } : null,
      reactions: reactions.map((reaction: any) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        messageId: reaction.messageId,
        createdAt: new Date(reaction.createdAt || reaction.created_at || new Date()).toISOString(),
      })),
      // Include default values for fields required by schema but potentially missing from DB update result
      mentions: [], // We don't fetch mentions for unsent message response
      linkPreview: null,
    };

    return c.json(unsendMessageResponseSchema.parse(responseObj));
  } catch (error) {
    console.error("Error unsending message:", error);
    return c.json({ error: "Failed to unsend message" }, 500);
  }
});

// DELETE /api/messages/:id - Delete a specific message
messages.delete("/:id", async (c) => {
  try {
    const messageId = c.req.param("id");
    const userId = c.req.query("userId");
    const chatId = c.req.query("chatId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    if (!chatId) {
      return c.json({ error: "chatId is required" }, 400);
    }

    console.log(`🗑️  [Messages] Delete request for message ${messageId} by user ${userId}`);

    // Fetch the message to check ownership
    const { data: message, error: fetchError } = await db
      .from("message")
      .select("userId, chatId")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Fetch chat to check creator
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("creatorId")
      .eq("id", message.chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    // Check permissions:
    // 1. User can delete their own messages
    // 2. Chat creator can delete AI messages (identified by having an aiFriendId)
    const isOwnMessage = message.userId === userId;
    const isAIMessage = message.aiFriendId !== null; // AI messages have an aiFriendId
    const isCreator = chat.creatorId === userId;

    if (!isOwnMessage && !(isAIMessage && isCreator)) {
      return c.json({ error: "You don't have permission to delete this message" }, 403);
    }

    // Delete the message (will cascade delete reactions)
    const { error: deleteError } = await db
      .from("message")
      .delete()
      .eq("id", messageId);

    if (deleteError) {
      console.error("Error deleting message:", deleteError);
      return c.json({ error: "Failed to delete message" }, 500);
    }

    console.log(`✅ [Messages] Message ${messageId} deleted successfully`);

    return c.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return c.json({ error: "Failed to delete message" }, 500);
  }
});

export default messages;
