import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { db, executeWithRetry } from "../db";
import { formatTimestamp, buildUpdateObject } from "../utils/supabase-helpers";
import { openai } from "../env";
import { executeGPT51Response } from "../services/gpt-responses";
import { 
  streamGPT51Response, 
  buildPersonalChatSystemPrompt,
  analyzePromptComplexity,
  type StreamEvent 
} from "../services/gpt-streaming-service";
import { saveResponseImages } from "../services/image-storage";
import { generateChatTitle } from "../services/title-generator";
import { 
  checkContentSafety, 
  getUserAgeContext, 
  filterAIOutput, 
  getSafetySystemPrompt,
  logSafetyEvent 
} from "../services/content-safety";
import {
  getPersonalConversationsRequestSchema,
  createPersonalConversationRequestSchema,
  getPersonalConversationRequestSchema,
  updatePersonalConversationRequestSchema,
  deletePersonalConversationRequestSchema,
  bulkDeletePersonalConversationsRequestSchema,
  sendPersonalMessageRequestSchema,
  deletePersonalMessageRequestSchema,
  generatePersonalChatImageRequestSchema,
  getTopAgentsRequestSchema,
  getAllUserAgentsRequestSchema,
  trackAgentUsageRequestSchema,
} from "@shared/contracts";

const personalChats = new Hono();

// ============================================================================
// CONVERSATION ENDPOINTS
// ============================================================================

// GET /api/personal-chats - Get all personal conversations for a user
personalChats.get("/", zValidator("query", getPersonalConversationsRequestSchema), async (c) => {
  const { userId } = c.req.valid("query");

  try {
    // Get all conversations with their AI friend details
    const { data: conversations, error } = await db
      .from("personal_conversation")
      .select(`
        *,
        ai_friend:aiFriendId (
          id,
          name,
          personality,
          tone,
          color,
          chatId
        )
      `)
      .eq("userId", userId)
      .order("lastMessageAt", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("[PersonalChats] Error fetching conversations:", error);
      return c.json({ error: "Failed to fetch conversations" }, 500);
    }

    return c.json(
      conversations.map((conv) => ({
        id: conv.id,
        userId: conv.userId,
        aiFriendId: conv.aiFriendId,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt ? formatTimestamp(conv.lastMessageAt) : null,
        createdAt: formatTimestamp(conv.createdAt),
        updatedAt: formatTimestamp(conv.updatedAt),
        aiFriend: conv.ai_friend ? {
          id: conv.ai_friend.id,
          name: conv.ai_friend.name,
          personality: conv.ai_friend.personality,
          tone: conv.ai_friend.tone,
          color: conv.ai_friend.color,
          chatId: conv.ai_friend.chatId,
        } : null,
      }))
    );
  } catch (error) {
    console.error("[PersonalChats] Error fetching conversations:", error);
    return c.json({ error: "Failed to fetch conversations" }, 500);
  }
});

// POST /api/personal-chats - Create a new personal conversation
personalChats.post("/", zValidator("json", createPersonalConversationRequestSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // If aiFriendId is provided, verify the user has access to this agent
    if (data.aiFriendId) {
      const { data: aiFriend, error: aiFriendError } = await db
        .from("ai_friend")
        .select("id, chatId")
        .eq("id", data.aiFriendId)
        .single();

      if (aiFriendError || !aiFriend) {
        return c.json({ error: "AI friend not found" }, 404);
      }

      // Verify user is a member of the chat that contains this AI friend
      const { data: membership } = await db
        .from("chat_member")
        .select("id")
        .eq("chatId", aiFriend.chatId)
        .eq("userId", data.userId)
        .single();

      if (!membership) {
        return c.json({ error: "You don't have access to this AI friend" }, 403);
      }
    }

    // Create new conversation
    const { data: conversation, error } = await db
      .from("personal_conversation")
      .insert({
        userId: data.userId,
        aiFriendId: data.aiFriendId || null,
        title: data.title || "New Conversation",
      })
      .select(`
        *,
        ai_friend:aiFriendId (
          id,
          name,
          personality,
          tone,
          color,
          chatId
        )
      `)
      .single();

    if (error) {
      console.error("[PersonalChats] Error creating conversation:", error);
      return c.json({ error: "Failed to create conversation" }, 500);
    }

    return c.json({
      id: conversation.id,
      userId: conversation.userId,
      aiFriendId: conversation.aiFriendId,
      title: conversation.title,
      lastMessageAt: conversation.lastMessageAt ? formatTimestamp(conversation.lastMessageAt) : null,
      createdAt: formatTimestamp(conversation.createdAt),
      updatedAt: formatTimestamp(conversation.updatedAt),
      aiFriend: conversation.ai_friend ? {
        id: conversation.ai_friend.id,
        name: conversation.ai_friend.name,
        personality: conversation.ai_friend.personality,
        tone: conversation.ai_friend.tone,
        color: conversation.ai_friend.color,
        chatId: conversation.ai_friend.chatId,
      } : null,
    });
  } catch (error) {
    console.error("[PersonalChats] Error creating conversation:", error);
    return c.json({ error: "Failed to create conversation" }, 500);
  }
});

// ============================================================================
// AGENT ENDPOINTS (Must be before /:conversationId to avoid route conflicts)
// ============================================================================

// GET /api/personal-chats/top-agents - Get user's top 3 most used agents
personalChats.get("/top-agents", zValidator("query", getTopAgentsRequestSchema), async (c) => {
  const { userId, limit } = c.req.valid("query");
  const agentLimit = limit || 3;

  try {
    // Get top agents by usage count
    const { data: topUsage, error } = await db
      .from("user_agent_usage")
      .select(`
        *,
        ai_friend:aiFriendId (
          id,
          name,
          personality,
          tone,
          color,
          chatId,
          engagementMode,
          engagementPercent,
          sortOrder,
          createdAt,
          updatedAt
        )
      `)
      .eq("userId", userId)
      .order("usageCount", { ascending: false })
      .limit(agentLimit);

    if (error) {
      console.error("[PersonalChats] Error fetching top agents:", error);
      return c.json({ error: "Failed to fetch top agents" }, 500);
    }

    return c.json(
      topUsage
        .filter((u) => u.ai_friend) // Only return if AI friend still exists
        .map((u) => ({
          id: u.id,
          userId: u.userId,
          aiFriendId: u.aiFriendId,
          usageCount: u.usageCount,
          lastUsedAt: formatTimestamp(u.lastUsedAt),
          createdAt: formatTimestamp(u.createdAt),
          aiFriend: {
            id: u.ai_friend.id,
            name: u.ai_friend.name,
            personality: u.ai_friend.personality,
            tone: u.ai_friend.tone,
            color: u.ai_friend.color,
            chatId: u.ai_friend.chatId,
            engagementMode: u.ai_friend.engagementMode,
            engagementPercent: u.ai_friend.engagementPercent,
            sortOrder: u.ai_friend.sortOrder,
            createdAt: formatTimestamp(u.ai_friend.createdAt),
            updatedAt: formatTimestamp(u.ai_friend.updatedAt),
          },
        }))
    );
  } catch (error) {
    console.error("[PersonalChats] Error fetching top agents:", error);
    return c.json({ error: "Failed to fetch top agents" }, 500);
  }
});

// GET /api/personal-chats/all-agents - Get all agents available to user (from all their chats)
personalChats.get("/all-agents", zValidator("query", getAllUserAgentsRequestSchema), async (c) => {
  const { userId } = c.req.valid("query");

  try {
    // Get all chats user is a member of
    const { data: memberships, error: memberError } = await db
      .from("chat_member")
      .select("chatId, chat:chatId(name)")
      .eq("userId", userId);

    if (memberError) {
      console.error("[PersonalChats] Error fetching user memberships:", memberError);
      return c.json({ error: "Failed to fetch user chats" }, 500);
    }

    if (!memberships || memberships.length === 0) {
      return c.json([]);
    }

    const chatIds = memberships.map((m) => m.chatId);
    const chatNames = new Map(memberships.map((m) => [m.chatId, (m.chat as any)?.name || "Unknown Chat"]));

    // Get all AI friends from these chats
    const { data: aiFriends, error: friendsError } = await db
      .from("ai_friend")
      .select("*")
      .in("chatId", chatIds)
      .order("name", { ascending: true });

    if (friendsError) {
      console.error("[PersonalChats] Error fetching AI friends:", friendsError);
      return c.json({ error: "Failed to fetch AI friends" }, 500);
    }

    return c.json(
      aiFriends.map((f) => ({
        id: f.id,
        chatId: f.chatId,
        name: f.name,
        personality: f.personality,
        tone: f.tone,
        engagementMode: f.engagementMode,
        engagementPercent: f.engagementPercent,
        color: f.color,
        sortOrder: f.sortOrder,
        createdAt: formatTimestamp(f.createdAt),
        updatedAt: formatTimestamp(f.updatedAt),
        chatName: chatNames.get(f.chatId) || "Unknown Chat",
      }))
    );
  } catch (error) {
    console.error("[PersonalChats] Error fetching all agents:", error);
    return c.json({ error: "Failed to fetch agents" }, 500);
  }
});

// ============================================================================
// CONVERSATION DETAIL ENDPOINTS
// ============================================================================

// GET /api/personal-chats/:conversationId - Get a specific conversation with messages
personalChats.get("/:conversationId", zValidator("query", getPersonalConversationRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const { userId } = c.req.valid("query");

  try {
    // Get conversation with AI friend details
    const { data: conversation, error } = await db
      .from("personal_conversation")
      .select(`
        *,
        ai_friend:aiFriendId (
          id,
          name,
          personality,
          tone,
          color,
          chatId
        )
      `)
      .eq("id", conversationId)
      .eq("userId", userId)
      .single();

    if (error || !conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // Get all messages for this conversation
    const { data: messages, error: messagesError } = await db
      .from("personal_message")
      .select("*")
      .eq("conversationId", conversationId)
      .order("createdAt", { ascending: true });

    if (messagesError) {
      console.error("[PersonalChats] Error fetching messages:", messagesError);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }

    return c.json({
      id: conversation.id,
      userId: conversation.userId,
      aiFriendId: conversation.aiFriendId,
      title: conversation.title,
      lastMessageAt: conversation.lastMessageAt ? formatTimestamp(conversation.lastMessageAt) : null,
      createdAt: formatTimestamp(conversation.createdAt),
      updatedAt: formatTimestamp(conversation.updatedAt),
      aiFriend: conversation.ai_friend ? {
        id: conversation.ai_friend.id,
        name: conversation.ai_friend.name,
        personality: conversation.ai_friend.personality,
        tone: conversation.ai_friend.tone,
        color: conversation.ai_friend.color,
        chatId: conversation.ai_friend.chatId,
      } : null,
      messages: messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        content: msg.content,
        role: msg.role,
        imageUrl: msg.imageUrl,
        generatedImageUrl: msg.generatedImageUrl,
        metadata: msg.metadata,
        createdAt: formatTimestamp(msg.createdAt),
      })),
    });
  } catch (error) {
    console.error("[PersonalChats] Error fetching conversation:", error);
    return c.json({ error: "Failed to fetch conversation" }, 500);
  }
});

// PATCH /api/personal-chats/:conversationId - Update conversation (title, agent)
personalChats.patch("/:conversationId", zValidator("json", updatePersonalConversationRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const data = c.req.valid("json");

  try {
    // Verify ownership
    const { data: existingConv, error: convError } = await db
      .from("personal_conversation")
      .select("id")
      .eq("id", conversationId)
      .eq("userId", data.userId)
      .single();

    if (convError || !existingConv) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // If changing aiFriendId, verify access
    if (data.aiFriendId !== undefined && data.aiFriendId !== null) {
      const { data: aiFriend, error: aiFriendError } = await db
        .from("ai_friend")
        .select("id, chatId")
        .eq("id", data.aiFriendId)
        .single();

      if (aiFriendError || !aiFriend) {
        return c.json({ error: "AI friend not found" }, 404);
      }

      // Verify user is a member of the chat
      const { data: membership } = await db
        .from("chat_member")
        .select("id")
        .eq("chatId", aiFriend.chatId)
        .eq("userId", data.userId)
        .single();

      if (!membership) {
        return c.json({ error: "You don't have access to this AI friend" }, 403);
      }
    }

    // Build update object
    const updateData = buildUpdateObject({
      title: data.title,
      aiFriendId: data.aiFriendId,
    });

    if (Object.keys(updateData).length === 0) {
      // No changes, return existing
      const { data: conv } = await db
        .from("personal_conversation")
        .select(`
          *,
          ai_friend:aiFriendId (id, name, personality, tone, color, chatId)
        `)
        .eq("id", conversationId)
        .single();

      return c.json({
        id: conv.id,
        userId: conv.userId,
        aiFriendId: conv.aiFriendId,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt ? formatTimestamp(conv.lastMessageAt) : null,
        createdAt: formatTimestamp(conv.createdAt),
        updatedAt: formatTimestamp(conv.updatedAt),
        aiFriend: conv.ai_friend,
      });
    }

    // Update conversation
    const { data: updated, error: updateError } = await db
      .from("personal_conversation")
      .update(updateData)
      .eq("id", conversationId)
      .select(`
        *,
        ai_friend:aiFriendId (id, name, personality, tone, color, chatId)
      `)
      .single();

    if (updateError) {
      console.error("[PersonalChats] Error updating conversation:", updateError);
      return c.json({ error: "Failed to update conversation" }, 500);
    }

    return c.json({
      id: updated.id,
      userId: updated.userId,
      aiFriendId: updated.aiFriendId,
      title: updated.title,
      lastMessageAt: updated.lastMessageAt ? formatTimestamp(updated.lastMessageAt) : null,
      createdAt: formatTimestamp(updated.createdAt),
      updatedAt: formatTimestamp(updated.updatedAt),
      aiFriend: updated.ai_friend ? {
        id: updated.ai_friend.id,
        name: updated.ai_friend.name,
        personality: updated.ai_friend.personality,
        tone: updated.ai_friend.tone,
        color: updated.ai_friend.color,
        chatId: updated.ai_friend.chatId,
      } : null,
    });
  } catch (error) {
    console.error("[PersonalChats] Error updating conversation:", error);
    return c.json({ error: "Failed to update conversation" }, 500);
  }
});

// DELETE /api/personal-chats/:conversationId - Delete a conversation
personalChats.delete("/:conversationId", zValidator("json", deletePersonalConversationRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const { userId } = c.req.valid("json");

  try {
    // Verify ownership and delete (cascade will delete messages)
    const { error } = await db
      .from("personal_conversation")
      .delete()
      .eq("id", conversationId)
      .eq("userId", userId);

    if (error) {
      console.error("[PersonalChats] Error deleting conversation:", error);
      return c.json({ error: "Failed to delete conversation" }, 500);
    }

    return c.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("[PersonalChats] Error deleting conversation:", error);
    return c.json({ error: "Failed to delete conversation" }, 500);
  }
});

// DELETE /api/personal-chats/bulk - Bulk delete conversations
personalChats.delete("/bulk", zValidator("json", bulkDeletePersonalConversationsRequestSchema), async (c) => {
  const { userId, conversationIds } = c.req.valid("json");

  try {
    // Delete all specified conversations owned by user
    const { error, count } = await db
      .from("personal_conversation")
      .delete()
      .eq("userId", userId)
      .in("id", conversationIds);

    if (error) {
      console.error("[PersonalChats] Error bulk deleting conversations:", error);
      return c.json({ error: "Failed to delete conversations" }, 500);
    }

    return c.json({
      success: true,
      deletedCount: count || 0,
    });
  } catch (error) {
    console.error("[PersonalChats] Error bulk deleting conversations:", error);
    return c.json({ error: "Failed to delete conversations" }, 500);
  }
});

// ============================================================================
// MESSAGE ENDPOINTS
// ============================================================================

// POST /api/personal-chats/:conversationId/messages - Send a message and get AI response
personalChats.post("/:conversationId/messages", zValidator("json", sendPersonalMessageRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const { userId, content, imageUrl } = c.req.valid("json");

  try {
    // Get conversation with AI friend details
    const { data: conversation, error: convError } = await db
      .from("personal_conversation")
      .select(`
        *,
        ai_friend:aiFriendId (
          id,
          name,
          personality,
          tone,
          color,
          chatId
        )
      `)
      .eq("id", conversationId)
      .eq("userId", userId)
      .single();

    if (convError || !conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // ============================================================================
    // CONTENT SAFETY CHECK - Same as group chat
    // ============================================================================
    console.log("[PersonalChats] Running content safety check for user:", userId);
    
    const userAgeContext = await getUserAgeContext(userId);
    const safetyResult = await checkContentSafety({
      userMessage: content,
      userId,
      chatId: conversationId, // Use conversationId as chatId for logging
      isMinor: userAgeContext.isMinor,
    });

    // Handle crisis situation (CRIT-2)
    if (safetyResult.crisisDetected && safetyResult.crisisResponse) {
      console.log("[PersonalChats] Crisis detected, returning crisis resources");
      return c.json({
        crisis: true,
        response: safetyResult.crisisResponse,
      });
    }

    // Handle blocked content (CRIT-1)
    if (safetyResult.isBlocked && safetyResult.blockReason) {
      console.log("[PersonalChats] Content blocked:", safetyResult.flags);
      return c.json({
        blocked: true,
        reason: safetyResult.blockReason,
        flags: safetyResult.flags,
      }, 400);
    }

    // Get recent messages for context (last 20)
    const { data: recentMessages } = await db
      .from("personal_message")
      .select("content, role")
      .eq("conversationId", conversationId)
      .order("createdAt", { ascending: false })
      .limit(20);

    const chatHistory = recentMessages?.reverse() || [];

    // Save user message
    const { data: userMessage, error: userMsgError } = await db
      .from("personal_message")
      .insert({
        conversationId,
        content,
        role: "user",
        imageUrl: imageUrl || null,
        metadata: imageUrl ? { attachedImageUrls: [imageUrl] } : {},
      })
      .select()
      .single();

    if (userMsgError) {
      console.error("[PersonalChats] Error saving user message:", userMsgError);
      return c.json({ error: "Failed to save message" }, 500);
    }

    // Track agent usage if an AI friend is selected
    if (conversation.aiFriendId) {
      await trackAgentUsageInternal(userId, conversation.aiFriendId);
    }

    // Build system prompt with safety guidelines
    const aiFriend = conversation.ai_friend;
    const systemPrompt = buildPersonalChatSystemPrompt(
      aiFriend?.name || "AI Assistant",
      aiFriend?.personality,
      aiFriend?.tone,
      chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
      userAgeContext.isMinor // Pass isMinor flag for appropriate safety guidelines
    );

    // Build conversation context
    let userPrompt = "";
    
    // Add chat history for context
    for (const msg of chatHistory) {
      const role = msg.role === "user" ? "User" : "Assistant";
      userPrompt += `${role}: ${msg.content}\n\n`;
    }
    
    // Add current message
    userPrompt += `User: ${content}`;
    
    if (imageUrl) {
      userPrompt += `\n[User attached an image: ${imageUrl}]`;
    }

    // Call GPT-5.1 with web search and image generation tools
    let aiResponseContent = "";
    let generatedImageUrl: string | null = null;
    let metadata: Record<string, any> = {};

    try {
      const result = await executeGPT51Response({
        systemPrompt,
        userPrompt,
        tools: [
          { type: "web_search" },
          { type: "image_generation" },
        ],
        reasoningEffort: "none", // Required for hosted tools
        // Note: gpt-5.1 does not support temperature parameter
        maxTokens: 4096,
      });

      aiResponseContent = result.content;

      // ============================================================================
      // OUTPUT FILTERING - Same as group chat
      // ============================================================================
      if (aiResponseContent) {
        const outputFilter = filterAIOutput(aiResponseContent);
        if (outputFilter.wasModified) {
          console.log("[PersonalChats] AI output was filtered for safety");
          aiResponseContent = outputFilter.filtered;
          logSafetyEvent("filtered", { 
            chatId: conversationId, 
            userId, 
            flags: ["output_filtered_personal_chat"] 
          });
        }
      }

      // If images were generated, save them
      if (result.images && result.images.length > 0) {
        const savedImages = await saveResponseImages(result.images, conversationId);
        if (savedImages.length > 0) {
          generatedImageUrl = savedImages[0];
          metadata.generatedImagePrompt = content;
        }
      }

      // Mark if web search was used
      if (result.status === "completed") {
        metadata.toolsUsed = [];
        if (aiResponseContent.includes("[Source") || aiResponseContent.includes("Source:")) {
          metadata.toolsUsed.push("web_search");
        }
        if (generatedImageUrl) {
          metadata.toolsUsed.push("image_generation");
        }
      }
    } catch (aiError) {
      console.error("[PersonalChats] Error generating AI response:", aiError);
      aiResponseContent = "I apologize, but I encountered an error processing your request. Please try again.";
    }

    // Save AI response
    const { data: assistantMessage, error: assistantMsgError } = await db
      .from("personal_message")
      .insert({
        conversationId,
        content: aiResponseContent,
        role: "assistant",
        generatedImageUrl,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error("[PersonalChats] Error saving AI message:", assistantMsgError);
      return c.json({ error: "Failed to save AI response" }, 500);
    }

    // Update conversation lastMessageAt and potentially title
    const updateData: Record<string, any> = {
      lastMessageAt: new Date().toISOString(),
    };

    // Generate title from first message if still default
    console.log("[PersonalChats] Title generation check:", {
      currentTitle: conversation.title,
      chatHistoryLength: chatHistory.length,
      shouldGenerate: conversation.title === "New Conversation" && chatHistory.length === 0
    });

    if (conversation.title === "New Conversation" && chatHistory.length === 0) {
      console.log("[PersonalChats] Generating title for first message:", content.substring(0, 100));
      try {
        const generatedTitle = await generateChatTitle(content);
        console.log("[PersonalChats] Generated title:", generatedTitle);
        if (generatedTitle) {
          updateData.title = generatedTitle;
        }
      } catch (titleError) {
        console.error("[PersonalChats] Error generating title:", titleError);
        // Fall back to truncated content
        updateData.title = content.length > 30 ? content.substring(0, 30) + "..." : content;
      }
    }

    console.log("[PersonalChats] Updating conversation with data:", updateData);
    await db
      .from("personal_conversation")
      .update(updateData)
      .eq("id", conversationId);

    return c.json({
      userMessage: {
        id: userMessage.id,
        conversationId: userMessage.conversationId,
        content: userMessage.content,
        role: userMessage.role,
        imageUrl: userMessage.imageUrl,
        generatedImageUrl: userMessage.generatedImageUrl,
        metadata: userMessage.metadata,
        createdAt: formatTimestamp(userMessage.createdAt),
      },
      assistantMessage: {
        id: assistantMessage.id,
        conversationId: assistantMessage.conversationId,
        content: assistantMessage.content,
        role: assistantMessage.role,
        imageUrl: assistantMessage.imageUrl,
        generatedImageUrl: assistantMessage.generatedImageUrl,
        metadata: assistantMessage.metadata,
        createdAt: formatTimestamp(assistantMessage.createdAt),
      },
    });
  } catch (error) {
    console.error("[PersonalChats] Error processing message:", error);
    return c.json({ error: "Failed to process message" }, 500);
  }
});

// ============================================================================
// STREAMING MESSAGE ENDPOINT
// ============================================================================

// POST /api/personal-chats/:conversationId/messages/stream - Send message with streaming response
personalChats.post("/:conversationId/messages/stream", zValidator("json", sendPersonalMessageRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const { userId, content, imageUrl: attachedImageUrl, aiFriendId: requestedAiFriendId } = c.req.valid("json");

  console.log("[PersonalChats] Streaming message request:", { 
    conversationId, 
    userId, 
    contentLength: content?.length,
    requestedAiFriendId 
  });

  // Verify conversation exists and belongs to user
  const { data: conversation, error: convError } = await db
    .from("personal_conversation")
    .select(`
      id,
      userId,
      title,
      aiFriendId,
      ai_friend:aiFriendId (
        id,
        name,
        personality,
        tone,
        color
      )
    `)
    .eq("id", conversationId)
    .eq("userId", userId)
    .single();

  if (convError || !conversation) {
    console.error("[PersonalChats] Conversation not found:", convError);
    return c.json({ error: "Conversation not found" }, 404);
  }

  // ============================================================================
  // CONTENT SAFETY CHECK - Same as group chat
  // ============================================================================
  console.log("[PersonalChats] [Streaming] Running content safety check for user:", userId);
  
  const userAgeContext = await getUserAgeContext(userId);
  const safetyResult = await checkContentSafety({
    userMessage: content,
    userId,
    chatId: conversationId, // Use conversationId as chatId for logging
    isMinor: userAgeContext.isMinor,
  });

  // Handle crisis situation (CRIT-2)
  if (safetyResult.crisisDetected && safetyResult.crisisResponse) {
    console.log("[PersonalChats] [Streaming] Crisis detected, returning crisis resources");
    return c.json({
      crisis: true,
      response: safetyResult.crisisResponse,
    });
  }

  // Handle blocked content (CRIT-1)
  if (safetyResult.isBlocked && safetyResult.blockReason) {
    console.log("[PersonalChats] [Streaming] Content blocked:", safetyResult.flags);
    return c.json({
      blocked: true,
      reason: safetyResult.blockReason,
      flags: safetyResult.flags,
    }, 400);
  }

  // Determine which AI friend to use - prefer requestedAiFriendId over conversation's
  let aiFriend = conversation.ai_friend as any;
  const effectiveAiFriendId = requestedAiFriendId || conversation.aiFriendId;

  // If a different AI friend is requested, fetch it
  if (requestedAiFriendId && requestedAiFriendId !== conversation.aiFriendId) {
    const { data: requestedAiFriend, error: aiFriendError } = await db
      .from("ai_friend")
      .select("id, name, personality, tone, color")
      .eq("id", requestedAiFriendId)
      .single();

    if (!aiFriendError && requestedAiFriend) {
      aiFriend = requestedAiFriend;
      console.log("[PersonalChats] Using requested AI friend:", requestedAiFriend.name);
      
      // Update conversation's aiFriendId for future messages
      await db
        .from("personal_conversation")
        .update({ aiFriendId: requestedAiFriendId })
        .eq("id", conversationId);
    }
  }

  // Log the AI friend being used
  if (aiFriend) {
    console.log("[PersonalChats] AI Friend for response:", { 
      name: aiFriend.name, 
      personality: aiFriend.personality?.substring(0, 50),
      tone: aiFriend.tone 
    });
  } else {
    console.log("[PersonalChats] No AI friend selected, using default AI Assistant");
  }

  // Get recent chat history for context
  const { data: recentMessages } = await db
    .from("personal_message")
    .select("content, role")
    .eq("conversationId", conversationId)
    .order("createdAt", { ascending: false })
    .limit(10);

  const chatHistory = (recentMessages || []).reverse().map(msg => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Save user message immediately
  const { data: userMessage, error: userMsgError } = await db
    .from("personal_message")
    .insert({
      conversationId,
      content,
      role: "user",
      imageUrl: attachedImageUrl || null,
    })
    .select()
    .single();

  if (userMsgError) {
    console.error("[PersonalChats] Error saving user message:", userMsgError);
    return c.json({ error: "Failed to save message" }, 500);
  }

  // Track agent usage if AI friend is associated
  if (aiFriend?.id) {
    try {
      const { data: existingUsage } = await db
        .from("user_agent_usage")
        .select("id, usageCount")
        .eq("userId", userId)
        .eq("aiFriendId", aiFriend.id)
        .single();

      if (existingUsage) {
        await db
          .from("user_agent_usage")
          .update({
            usageCount: existingUsage.usageCount + 1,
            lastUsedAt: new Date().toISOString(),
          })
          .eq("id", existingUsage.id);
      } else {
        await db
          .from("user_agent_usage")
          .insert({
            userId,
            aiFriendId: aiFriend.id,
            usageCount: 1,
            lastUsedAt: new Date().toISOString(),
          });
      }
    } catch (usageError) {
      console.error("[PersonalChats] Error tracking agent usage:", usageError);
    }
  }

  // Build system prompt with safety guidelines
  const systemPrompt = buildPersonalChatSystemPrompt(
    aiFriend?.name || "AI Assistant",
    aiFriend?.personality,
    aiFriend?.tone,
    chatHistory,
    userAgeContext.isMinor // Pass isMinor flag for appropriate safety guidelines
  );

  // Build user prompt with context
  let userPrompt = "";
  for (const msg of chatHistory) {
    const role = msg.role === "user" ? "User" : "Assistant";
    userPrompt += `${role}: ${msg.content}\n\n`;
  }
  userPrompt += `User: ${content}`;
  if (attachedImageUrl) {
    userPrompt += `\n[User attached an image: ${attachedImageUrl}]`;
  }

  // Analyze prompt complexity for adaptive reasoning
  const reasoningEffort = analyzePromptComplexity(content);
  console.log("[PersonalChats] Adaptive reasoning effort:", reasoningEffort);

  // Set SSE headers to prevent proxy buffering (important for Render, Cloudflare, Nginx, etc.)
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("X-Accel-Buffering", "no");
  c.header("Connection", "keep-alive");

  // Stream the response using SSE
  return streamSSE(c, async (stream) => {
    let fullContent = "";
    let generatedImages: Array<{ id: string; base64: string }> = [];
    let metadata: Record<string, any> = { toolsUsed: [] };

    try {
      // Send initial ping to establish connection immediately
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ status: "connected", conversationId }),
      });

      // Send initial event with user message info
      await stream.writeSSE({
        event: "user_message",
        data: JSON.stringify({
          id: userMessage.id,
          conversationId: userMessage.conversationId,
          content: userMessage.content,
          role: "user",
          imageUrl: userMessage.imageUrl,
          createdAt: formatTimestamp(userMessage.createdAt),
        }),
      });

      // Send reasoning effort info
      await stream.writeSSE({
        event: "reasoning_effort",
        data: JSON.stringify({ effort: reasoningEffort }),
      });

      // Start a keep-alive interval to prevent proxy timeout (sends ping every 10 seconds)
      const keepAliveInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: "ping",
            data: JSON.stringify({ timestamp: Date.now() }),
          });
        } catch (e) {
          // Stream might be closed, clear interval
          clearInterval(keepAliveInterval);
        }
      }, 10000);

      // Stream GPT response
      const responseStream = streamGPT51Response({
        systemPrompt,
        userPrompt,
        tools: [
          { type: "web_search" },
          { type: "image_generation" },
        ],
        reasoningEffort,
        // Note: gpt-5.1 does not support temperature parameter
        maxTokens: 4096,
      });

      for await (const event of responseStream) {
        switch (event.type) {
          case "thinking_start":
            await stream.writeSSE({
              event: "thinking_start",
              data: JSON.stringify({}),
            });
            break;

          case "thinking_delta":
            await stream.writeSSE({
              event: "thinking_delta",
              data: JSON.stringify({ content: event.data.content }),
            });
            break;

          case "thinking_end":
            await stream.writeSSE({
              event: "thinking_end",
              data: JSON.stringify({ content: event.data.content }),
            });
            break;

          case "tool_call_start":
            await stream.writeSSE({
              event: "tool_call_start",
              data: JSON.stringify({
                toolName: event.data.toolName,
                toolInput: event.data.toolInput,
              }),
            });
            if (event.data.toolName && !metadata.toolsUsed.includes(event.data.toolName)) {
              metadata.toolsUsed.push(event.data.toolName);
            }
            break;

          case "tool_call_progress":
            await stream.writeSSE({
              event: "tool_call_progress",
              data: JSON.stringify(event.data),
            });
            break;

          case "tool_call_end":
            await stream.writeSSE({
              event: "tool_call_end",
              data: JSON.stringify({
                toolName: event.data.toolName,
                sources: event.data.sources,
              }),
            });
            break;

          case "content_delta":
            if (event.data.content) {
              fullContent += event.data.content;
              await stream.writeSSE({
                event: "content_delta",
                data: JSON.stringify({ content: event.data.content }),
              });
            }
            break;

          case "content_end":
            await stream.writeSSE({
              event: "content_end",
              data: JSON.stringify({ content: fullContent }),
            });
            break;

          case "image_generated":
            if (event.data.imageBase64) {
              generatedImages.push({
                id: event.data.imageId || `img_${Date.now()}`,
                base64: event.data.imageBase64,
              });
              await stream.writeSSE({
                event: "image_generated",
                data: JSON.stringify({ imageId: event.data.imageId }),
              });
            }
            break;

          case "error":
            console.error("[PersonalChats] Streaming error:", event.data.error);
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify({ error: event.data.error }),
            });
            break;

          case "done":
            console.log("[PersonalChats] Received done event, saving message...");
            console.log("[PersonalChats] Generated images count:", generatedImages.length);
            console.log("[PersonalChats] Full content length:", fullContent.length);
            
            // ============================================================================
            // OUTPUT FILTERING - Same as group chat
            // ============================================================================
            if (fullContent) {
              const outputFilter = filterAIOutput(fullContent);
              if (outputFilter.wasModified) {
                console.log("[PersonalChats] [Streaming] AI output was filtered for safety");
                fullContent = outputFilter.filtered;
                logSafetyEvent("filtered", { 
                  chatId: conversationId, 
                  userId, 
                  flags: ["output_filtered_personal_chat_streaming"] 
                });
              }
            }
            
            // Save the AI response to database
            let generatedImageUrl: string | null = null;
            
            if (generatedImages.length > 0) {
              console.log("[PersonalChats] Saving generated images to storage...");
              try {
                const savedImages = await saveResponseImages(generatedImages, conversationId);
                console.log("[PersonalChats] Images saved, URLs:", savedImages);
                if (savedImages.length > 0) {
                  generatedImageUrl = savedImages[0];
                  metadata.generatedImagePrompt = fullContent;
                }
              } catch (imgError) {
                console.error("[PersonalChats] Error saving images:", imgError);
              }
            }

            // Save assistant message
            // If we have an image but no content, provide a simple message
            const messageContent = fullContent || (generatedImageUrl ? "Here's the image you requested:" : "I apologize, but I couldn't generate a response.");
            
            const { data: assistantMessage, error: assistantMsgError } = await db
              .from("personal_message")
              .insert({
                conversationId,
                content: messageContent,
                role: "assistant",
                generatedImageUrl,
                metadata: Object.keys(metadata).length > 0 ? metadata : null,
              })
              .select()
              .single();

            if (assistantMsgError) {
              console.error("[PersonalChats] Error saving assistant message:", assistantMsgError);
            }

            // Update conversation lastMessageAt and potentially title
            const updateData: Record<string, any> = {
              lastMessageAt: new Date().toISOString(),
            };

            if (conversation.title === "New Conversation" && chatHistory.length === 0) {
              try {
                const generatedTitle = await generateChatTitle(content);
                if (generatedTitle) {
                  updateData.title = generatedTitle;
                }
              } catch (titleError) {
                console.error("[PersonalChats] Error generating title:", titleError);
                updateData.title = content.length > 30 ? content.substring(0, 30) + "..." : content;
              }
            }

            await db
              .from("personal_conversation")
              .update(updateData)
              .eq("id", conversationId);

            // Send final message with assistant response
            await stream.writeSSE({
              event: "assistant_message",
              data: JSON.stringify({
                id: assistantMessage?.id,
                conversationId,
                content: fullContent,
                role: "assistant",
                generatedImageUrl,
                metadata,
                createdAt: assistantMessage?.createdAt ? formatTimestamp(assistantMessage.createdAt) : new Date().toISOString(),
              }),
            });

            // Send completion event
            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({ 
                success: true,
                updatedTitle: updateData.title,
              }),
            });
            break;
        }
      }

      // Clear the keep-alive interval when streaming completes
      clearInterval(keepAliveInterval);
    } catch (error: any) {
      // Clear the keep-alive interval on error
      clearInterval(keepAliveInterval);
      console.error("[PersonalChats] Streaming error:", error);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ error: error?.message || "An error occurred" }),
      });
    }
  });
});

// DELETE /api/personal-chats/:conversationId/messages/:messageId - Delete a single message
personalChats.delete("/:conversationId/messages/:messageId", zValidator("json", deletePersonalMessageRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const messageId = c.req.param("messageId");
  const { userId } = c.req.valid("json");

  try {
    // Verify ownership of conversation
    const { data: conversation } = await db
      .from("personal_conversation")
      .select("id")
      .eq("id", conversationId)
      .eq("userId", userId)
      .single();

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // Delete the message
    const { error } = await db
      .from("personal_message")
      .delete()
      .eq("id", messageId)
      .eq("conversationId", conversationId);

    if (error) {
      console.error("[PersonalChats] Error deleting message:", error);
      return c.json({ error: "Failed to delete message" }, 500);
    }

    return c.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("[PersonalChats] Error deleting message:", error);
    return c.json({ error: "Failed to delete message" }, 500);
  }
});

// ============================================================================
// IMAGE GENERATION ENDPOINT
// ============================================================================

// POST /api/personal-chats/generate-image - Generate image in personal chat
personalChats.post("/generate-image", zValidator("json", generatePersonalChatImageRequestSchema), async (c) => {
  const { userId, conversationId, prompt, aspectRatio } = c.req.valid("json");

  try {
    // Verify ownership
    const { data: conversation, error: convError } = await db
      .from("personal_conversation")
      .select("id, aiFriendId")
      .eq("id", conversationId)
      .eq("userId", userId)
      .single();

    if (convError || !conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // Generate image using GPT-5.1
    const result = await executeGPT51Response({
      systemPrompt: "You are an image generation assistant. Generate images based on the user's description.",
      userPrompt: `Generate an image with the following description: ${prompt}`,
      tools: [{ type: "image_generation" }],
      reasoningEffort: "none",
    });

    if (!result.images || result.images.length === 0) {
      return c.json({ error: "Failed to generate image" }, 500);
    }

    // Save the generated image
    const savedImages = await saveResponseImages(result.images, conversationId);
    if (savedImages.length === 0) {
      return c.json({ error: "Failed to save generated image" }, 500);
    }

    const generatedImageUrl = savedImages[0];

    // Save as assistant message
    const { data: message, error: msgError } = await db
      .from("personal_message")
      .insert({
        conversationId,
        content: `Here's the image I generated based on your request: "${prompt}"`,
        role: "assistant",
        generatedImageUrl,
        metadata: {
          generatedImagePrompt: prompt,
          toolsUsed: ["image_generation"],
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error("[PersonalChats] Error saving image message:", msgError);
      return c.json({ error: "Failed to save image message" }, 500);
    }

    // Update lastMessageAt
    await db
      .from("personal_conversation")
      .update({ lastMessageAt: new Date().toISOString() })
      .eq("id", conversationId);

    return c.json({
      imageUrl: generatedImageUrl,
      message: {
        id: message.id,
        conversationId: message.conversationId,
        content: message.content,
        role: message.role,
        imageUrl: message.imageUrl,
        generatedImageUrl: message.generatedImageUrl,
        metadata: message.metadata,
        createdAt: formatTimestamp(message.createdAt),
      },
    });
  } catch (error) {
    console.error("[PersonalChats] Error generating image:", error);
    return c.json({ error: "Failed to generate image" }, 500);
  }
});

// ============================================================================
// AGENT USAGE ENDPOINTS
// ============================================================================

// Helper function to track agent usage
async function trackAgentUsageInternal(userId: string, aiFriendId: string) {
  try {
    // Try to update existing record
    const { data: existing } = await db
      .from("user_agent_usage")
      .select("id, usageCount")
      .eq("userId", userId)
      .eq("aiFriendId", aiFriendId)
      .single();

    if (existing) {
      // Update existing
      await db
        .from("user_agent_usage")
        .update({
          usageCount: existing.usageCount + 1,
          lastUsedAt: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new
      await db
        .from("user_agent_usage")
        .insert({
          userId,
          aiFriendId,
          usageCount: 1,
          lastUsedAt: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("[PersonalChats] Error tracking agent usage:", error);
    // Don't throw - this is non-critical
  }
}

// POST /api/personal-chats/track-agent-usage - Manually track agent usage
personalChats.post("/track-agent-usage", zValidator("json", trackAgentUsageRequestSchema), async (c) => {
  const { userId, aiFriendId } = c.req.valid("json");

  try {
    await trackAgentUsageInternal(userId, aiFriendId);

    // Get updated usage
    const { data: usage } = await db
      .from("user_agent_usage")
      .select("*")
      .eq("userId", userId)
      .eq("aiFriendId", aiFriendId)
      .single();

    return c.json({
      id: usage?.id || "",
      userId: usage?.userId || userId,
      aiFriendId: usage?.aiFriendId || aiFriendId,
      usageCount: usage?.usageCount || 1,
      lastUsedAt: usage?.lastUsedAt ? formatTimestamp(usage.lastUsedAt) : new Date().toISOString(),
      createdAt: usage?.createdAt ? formatTimestamp(usage.createdAt) : new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PersonalChats] Error tracking agent usage:", error);
    return c.json({ error: "Failed to track agent usage" }, 500);
  }
});

export default personalChats;

