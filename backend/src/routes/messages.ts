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

// Helper type for merged results
type SearchResult = {
  id: string;
  score: number;
  matchedField: "content" | "transcription" | "description";
  similarity?: number;
  rank?: number;
  createdAt: string;
};

// POST /api/messages/search - Search messages globally
messages.post("/search", zValidator("json", searchMessagesRequestSchema), async (c) => {
  try {
    const { 
      userId, 
      query: rawQuery, 
      mode = "hybrid", 
      chatId, 
      fromUserId, 
      messageTypes, 
      dateFrom, 
      dateTo,
      limit = 30,
      cursor
    } = c.req.valid("json");
    
    // Ensure query is trimmed
    const query = rawQuery?.trim() || "";
    if (query.length === 0) return c.json([]);

    // 1. Resolve Chat IDs scope
    let targetChatIds: string[] = [];
    
    if (chatId) {
      // Verify membership for specific chat
      const { data: member } = await db
        .from("chat_member")
        .select("id")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .single();
        
      if (!member) {
        return c.json({ error: "Not a member of this chat" }, 403);
      }
      targetChatIds = [chatId];
    } else {
      // Get all chats user is member of
      const { data: userChats, error: chatError } = await db
        .from("chat_member")
        .select("chatId")
        .eq("userId", userId);

      if (chatError || !userChats || userChats.length === 0) {
        return c.json([]);
      }
      targetChatIds = userChats.map((c) => c.chatId);
    }

    // Calculate effective dateTo for cursor-based pagination
    // If cursor is provided, it acts as an upper bound for createdAt (exclusive)
    let effectiveDateTo = dateTo;
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        // Subtract 1ms to ensure strict < cursor (exclusive)
        const nextDate = new Date(cursorDate.getTime() - 1);
        const nextDateIso = nextDate.toISOString();
        
        // If user provided dateTo, take the earlier one
        if (effectiveDateTo) {
           effectiveDateTo = new Date(effectiveDateTo) < nextDate ? effectiveDateTo : nextDateIso;
        } else {
           effectiveDateTo = nextDateIso;
        }
      }
    }

    // Prepare to collect results
    // We'll store results as a Map to deduplicate by ID
    const matchMap = new Map<string, SearchResult>();
    
    // Helper to add matches
    const addMatch = (
      id: string, 
      score: number, 
      field: "content" | "transcription" | "description", 
      createdAt: string,
      similarity?: number, 
      rank?: number
    ) => {
      const existing = matchMap.get(id);
      if (existing) {
        // If already exists, boost score (hybrid match) and keep best metrics
        existing.score += score; 
        if (similarity && (!existing.similarity || similarity > existing.similarity)) {
          existing.similarity = similarity;
        }
        if (rank && (!existing.rank || rank > existing.rank)) {
          existing.rank = rank;
        }
      } else {
        matchMap.set(id, { id, score, matchedField: field, similarity, rank, createdAt });
      }
    };

    const runSemanticSearch = ["semantic", "hybrid"].includes(mode);
    const runTextSearch = ["text", "hybrid"].includes(mode);

    // 2. Run Semantic Search
    if (runSemanticSearch) {
      console.log(`🧠 [Messages] Semantic search for: "${query}"`);
      try {
        const queryEmbedding = await generateEmbedding(query);
        
        const { data: matches, error: matchError } = await db.rpc("match_messages", {
          query_embedding: queryEmbedding,
          match_threshold: 0.4, // Increased from 0.3 for better quality
          match_count: limit * 2,
          filter_user_id: fromUserId || null,
          filter_chat_ids: targetChatIds,
          filter_message_types: messageTypes || null,
          filter_date_from: dateFrom || null,
          filter_date_to: effectiveDateTo || null,
        });

        if (matchError) {
          console.error("[Messages] Semantic match error:", matchError);
        } else if (matches) {
          for (const m of matches) {
            // Semantic score 0-10
            addMatch(m.id, m.similarity * 10, "content", m.createdAt, m.similarity); 
          }
        }
      } catch (embError) {
        console.error("[Messages] Embedding generation error:", embError);
      }
    }

    // 3. Run Text Search
    if (runTextSearch) {
      console.log(`🔍 [Messages] Text search for: "${query}"`);
      
      const { data: textMatches, error: searchError } = await db.rpc("search_messages_text", {
        search_query: query,
        match_count: limit * 2,
        filter_user_id: fromUserId || null,
        filter_chat_ids: targetChatIds,
        filter_message_types: messageTypes || null,
        filter_date_from: dateFrom || null,
        filter_date_to: effectiveDateTo || null,
      });

      if (searchError) {
        console.error("[Messages] Text search error:", searchError);
      } else if (textMatches) {
        for (const m of textMatches) {
          // Text rank is usually 0.1-1.0. Multiply by 20 to give weight over loose semantic matches.
          // Exact matches (via FTS) will naturally score higher.
          const rankScore = (m.rank || 0.1) * 20;
          addMatch(m.id, rankScore, "content", m.createdAt, undefined, m.rank);
        }
      }
    }

    // 4. Sort and Pagination
    let allResults = Array.from(matchMap.values());
    
    // Sort strictly by createdAt DESC (recency first) as requested
    allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply limit
    const paginatedResults = allResults.slice(0, limit);
    const resultIds = paginatedResults.map(r => r.id);

    if (resultIds.length === 0) {
      return c.json([]);
    }

    // 5. Fetch Full Messages
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
      .in("id", resultIds);

    if (fetchError) {
      console.error("[Messages] Error fetching matched messages:", fetchError);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }

    // 6. Apply final post-filters & decrypt
    // (Most filters are handled by RPC, but we need to verify visibility and decrypt)
    const decryptedMessages = await decryptMessages(messages || []);
    
    // Map back to result structure
    // Create a map for quick lookup
    const messageMap = new Map(decryptedMessages.map((m: any) => [m.id, m]));
    
    const formattedResults = paginatedResults
      .map(r => {
        const msg = messageMap.get(r.id);
        if (!msg) return null;
        
        let parsedMetadata = msg.metadata;
        if (typeof msg.metadata === "string") {
          try { parsedMetadata = JSON.parse(msg.metadata); } catch { parsedMetadata = null; }
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
          similarity: r.similarity,
          matchedField: r.matchedField
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return c.json(searchMessagesResponseSchema.parse(formattedResults));
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
            personality: msg.replyTo.aiFriend.personality,
            tone: msg.replyTo.aiFriend.tone,
            engagementMode: msg.replyTo.aiFriend.engagementMode,
            engagementPercent: msg.replyTo.aiFriend.engagementPercent,
            chatId: msg.replyTo.aiFriend.chatId,
            sortOrder: msg.replyTo.aiFriend.sortOrder,
            createdAt: new Date(msg.replyTo.aiFriend.createdAt).toISOString(),
            updatedAt: new Date(msg.replyTo.aiFriend.updatedAt).toISOString(),
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
    
    return c.json({ messages: formattedMessages });
  } catch (error) {
    console.error("[Messages] Error in batch endpoint:", error);
    return c.json({ error: "Failed to batch fetch messages" }, 500);
  }
});

// ... (rest of the file)
