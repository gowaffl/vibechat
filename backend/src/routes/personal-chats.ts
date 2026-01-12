import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { db, executeWithRetry } from "../db";
import { formatTimestamp, buildUpdateObject } from "../utils/supabase-helpers";
import { openai } from "../env";
// Legacy GPT imports - kept for fallback/reference
import { executeGPT51Response } from "../services/gpt-responses";
import { 
  streamGPT51Response, 
  buildPersonalChatSystemPrompt,
  type StreamEvent as GPTStreamEvent
} from "../services/gpt-streaming-service";
// Gemini imports - primary AI backend for personal chat
import {
  streamGeminiResponse,
  analyzePromptComplexity,
  mapToGeminiThinkingLevel,
  shouldEnableWebSearch,
  type StreamEvent,
} from "../services/gemini-streaming-service";
import {
  executeGeminiResponse,
  generateGeminiImage,
  uploadGeneratedImage,
} from "../services/gemini-responses";
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
  extractURLsFromText,
  extractMultipleURLs,
  formatURLContentForPrompt,
  isURLAnalysisRequest,
} from "../services/url-content-extractor";
import {
  extractMultipleDocuments,
  formatDocumentsForPrompt,
  isExtractableDocument,
  isImageFile,
} from "../services/document-extractor";
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
  // Folder schemas
  getFoldersRequestSchema,
  createFolderRequestSchema,
  updateFolderRequestSchema,
  deleteFolderRequestSchema,
  moveConversationToFolderRequestSchema,
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
        folderId: conv.folderId || null,
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

  console.log("[PersonalChats] Creating conversation with data:", data);

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
        folderId: data.folderId || null,
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

    console.log("[PersonalChats] Created conversation:", { id: conversation.id, folderId: conversation.folderId });

    return c.json({
      id: conversation.id,
      userId: conversation.userId,
      aiFriendId: conversation.aiFriendId,
      folderId: conversation.folderId || null,
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

// GET /api/personal-chats/all-agents - Get all agents available to user (from all their chats + personal agents)
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

    const chatIds = memberships?.map((m) => m.chatId) || [];
    const chatNames = new Map(memberships?.map((m) => [m.chatId, (m.chat as any)?.name || "Unknown Chat"]) || []);

    // Get all non-personal AI friends from user's chats
    let groupChatAgents: any[] = [];
    if (chatIds.length > 0) {
      const { data: aiFriends, error: friendsError } = await db
        .from("ai_friend")
        .select("*")
        .in("chatId", chatIds)
        .or("isPersonal.is.null,isPersonal.eq.false")
        .order("name", { ascending: true });

      if (friendsError) {
        console.error("[PersonalChats] Error fetching AI friends:", friendsError);
      } else {
        groupChatAgents = aiFriends || [];
      }
    }

    // Get all personal agents owned by this user
    const { data: personalAgents, error: personalError } = await db
      .from("ai_friend")
      .select("*")
      .eq("isPersonal", true)
      .eq("ownerUserId", userId)
      .order("name", { ascending: true });

    if (personalError) {
      console.error("[PersonalChats] Error fetching personal agents:", personalError);
    }

    // Combine both lists
    const allAgents = [
      ...(personalAgents || []).map((f) => ({
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
        chatName: "Personal Agent",
        isPersonal: true,
      })),
      ...groupChatAgents.map((f) => ({
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
        isPersonal: false,
      })),
    ];

    return c.json(allAgents);
  } catch (error) {
    console.error("[PersonalChats] Error fetching all agents:", error);
    return c.json({ error: "Failed to fetch agents" }, 500);
  }
});

// Color palette for personal AI agents
const PERSONAL_AGENT_COLORS = [
  "#34C759", // Green
  "#007AFF", // Blue
  "#FF9F0A", // Orange
  "#AF52DE", // Purple
  "#FF453A", // Red
  "#FFD60A", // Yellow
  "#64D2FF", // Cyan
  "#FF375F", // Pink
];

// POST /api/personal-chats/create-agent - Create a new personal AI agent
personalChats.post("/create-agent", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, name, personality, tone, engagementMode, engagementPercent } = body;

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    if (!name) {
      return c.json({ error: "name is required" }, 400);
    }

    // Verify user exists
    const { data: user, error: userError } = await db
      .from("user")
      .select("id")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get user's existing personal agents to determine color assignment
    const { data: existingAgents } = await db
      .from("ai_friend")
      .select("color")
      .eq("isPersonal", true)
      .eq("ownerUserId", userId);

    const usedColors = new Set((existingAgents || []).map((a) => a.color));
    
    // Find the first unused color, or cycle back to the beginning
    let assignedColor = PERSONAL_AGENT_COLORS[0];
    for (const color of PERSONAL_AGENT_COLORS) {
      if (!usedColors.has(color)) {
        assignedColor = color;
        break;
      }
    }
    // If all colors are used, use the next color in rotation
    if (usedColors.size >= PERSONAL_AGENT_COLORS.length) {
      assignedColor = PERSONAL_AGENT_COLORS[(existingAgents?.length || 0) % PERSONAL_AGENT_COLORS.length];
    }

    // Get user's first chat for the chatId (required field, but won't be used for personal agents)
    // Personal agents need a chatId for database consistency, but isPersonal flag makes them invisible in group chats
    const { data: memberships } = await db
      .from("chat_member")
      .select("chatId")
      .eq("userId", userId)
      .limit(1);

    // Use a placeholder chatId if user has no chats (edge case)
    const chatId = memberships?.[0]?.chatId || "personal-placeholder";

    // Create the personal agent
    const { data: newAgent, error: createError } = await db
      .from("ai_friend")
      .insert({
        chatId,
        name: name,
        personality: personality || null,
        tone: tone || null,
        engagementMode: engagementMode || "on-call",
        engagementPercent: engagementPercent || null,
        color: assignedColor,
        sortOrder: 0,
        createdBy: userId,
        isPersonal: true,
        ownerUserId: userId,
      })
      .select()
      .single();

    if (createError) {
      console.error("[PersonalChats] Error creating personal agent:", createError);
      return c.json({ error: "Failed to create personal agent" }, 500);
    }

    console.log("[PersonalChats] Created personal agent:", newAgent.id, "for user:", userId);

    return c.json({
      id: newAgent.id,
      chatId: newAgent.chatId,
      name: newAgent.name,
      personality: newAgent.personality,
      tone: newAgent.tone,
      engagementMode: newAgent.engagementMode,
      engagementPercent: newAgent.engagementPercent,
      color: newAgent.color,
      sortOrder: newAgent.sortOrder,
      createdBy: newAgent.createdBy,
      createdAt: formatTimestamp(newAgent.createdAt),
      updatedAt: formatTimestamp(newAgent.updatedAt),
      isPersonal: true,
    });
  } catch (error) {
    console.error("[PersonalChats] Error creating personal agent:", error);
    return c.json({ error: "Failed to create personal agent" }, 500);
  }
});

// ============================================================================
// FOLDER ENDPOINTS (Must be before /:conversationId to avoid route conflicts)
// ============================================================================

// GET /api/personal-chats/folders - Get all folders for a user
personalChats.get("/folders", zValidator("query", getFoldersRequestSchema), async (c) => {
  const { userId } = c.req.valid("query");

  try {
    // Get all folders with conversation count
    const { data: folders, error } = await db
      .from("personal_chat_folder")
      .select("*")
      .eq("userId", userId)
      .order("sortOrder", { ascending: true });

    if (error) {
      console.error("[PersonalChats] Error fetching folders:", error);
      return c.json({ error: "Failed to fetch folders" }, 500);
    }

    // Get conversation counts for each folder
    const folderIds = folders.map((f) => f.id);
    let conversationCounts: Record<string, number> = {};
    
    if (folderIds.length > 0) {
      const { data: counts, error: countError } = await db
        .from("personal_conversation")
        .select("folderId")
        .eq("userId", userId)
        .in("folderId", folderIds);

      if (!countError && counts) {
        conversationCounts = counts.reduce((acc, conv) => {
          if (conv.folderId) {
            acc[conv.folderId] = (acc[conv.folderId] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
      }
    }

    return c.json(
      folders.map((folder) => ({
        id: folder.id,
        userId: folder.userId,
        name: folder.name,
        sortOrder: folder.sortOrder,
        createdAt: formatTimestamp(folder.createdAt),
        updatedAt: formatTimestamp(folder.updatedAt),
        conversationCount: conversationCounts[folder.id] || 0,
      }))
    );
  } catch (error) {
    console.error("[PersonalChats] Error fetching folders:", error);
    return c.json({ error: "Failed to fetch folders" }, 500);
  }
});

// POST /api/personal-chats/folders - Create a new folder
personalChats.post("/folders", zValidator("json", createFolderRequestSchema), async (c) => {
  const { userId, name } = c.req.valid("json");

  try {
    // Get the max sortOrder for existing folders
    const { data: existingFolders } = await db
      .from("personal_chat_folder")
      .select("sortOrder")
      .eq("userId", userId)
      .order("sortOrder", { ascending: false })
      .limit(1);

    const nextSortOrder = (existingFolders?.[0]?.sortOrder ?? -1) + 1;

    // Create the folder
    const { data: folder, error } = await db
      .from("personal_chat_folder")
      .insert({
        userId,
        name,
        sortOrder: nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("[PersonalChats] Error creating folder:", error);
      return c.json({ error: "Failed to create folder" }, 500);
    }

    return c.json({
      id: folder.id,
      userId: folder.userId,
      name: folder.name,
      sortOrder: folder.sortOrder,
      createdAt: formatTimestamp(folder.createdAt),
      updatedAt: formatTimestamp(folder.updatedAt),
      conversationCount: 0,
    });
  } catch (error) {
    console.error("[PersonalChats] Error creating folder:", error);
    return c.json({ error: "Failed to create folder" }, 500);
  }
});

// PATCH /api/personal-chats/folders/:folderId - Update a folder
personalChats.patch("/folders/:folderId", zValidator("json", updateFolderRequestSchema), async (c) => {
  const folderId = c.req.param("folderId");
  const { userId, name, sortOrder } = c.req.valid("json");

  try {
    // Verify folder belongs to user
    const { data: existingFolder, error: fetchError } = await db
      .from("personal_chat_folder")
      .select("id")
      .eq("id", folderId)
      .eq("userId", userId)
      .single();

    if (fetchError || !existingFolder) {
      return c.json({ error: "Folder not found" }, 404);
    }

    // Build update object
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    // Update the folder
    const { data: folder, error } = await db
      .from("personal_chat_folder")
      .update(updates)
      .eq("id", folderId)
      .select()
      .single();

    if (error) {
      console.error("[PersonalChats] Error updating folder:", error);
      return c.json({ error: "Failed to update folder" }, 500);
    }

    return c.json({
      id: folder.id,
      userId: folder.userId,
      name: folder.name,
      sortOrder: folder.sortOrder,
      createdAt: formatTimestamp(folder.createdAt),
      updatedAt: formatTimestamp(folder.updatedAt),
    });
  } catch (error) {
    console.error("[PersonalChats] Error updating folder:", error);
    return c.json({ error: "Failed to update folder" }, 500);
  }
});

// DELETE /api/personal-chats/folders/:folderId - Delete a folder (conversations move to no folder)
personalChats.delete("/folders/:folderId", zValidator("json", deleteFolderRequestSchema), async (c) => {
  const folderId = c.req.param("folderId");
  const { userId } = c.req.valid("json");

  try {
    // Verify folder belongs to user
    const { data: existingFolder, error: fetchError } = await db
      .from("personal_chat_folder")
      .select("id")
      .eq("id", folderId)
      .eq("userId", userId)
      .single();

    if (fetchError || !existingFolder) {
      return c.json({ error: "Folder not found" }, 404);
    }

    // Move all conversations in this folder to no folder (folderId = null)
    await db
      .from("personal_conversation")
      .update({ folderId: null })
      .eq("folderId", folderId);

    // Delete the folder
    const { error } = await db
      .from("personal_chat_folder")
      .delete()
      .eq("id", folderId);

    if (error) {
      console.error("[PersonalChats] Error deleting folder:", error);
      return c.json({ error: "Failed to delete folder" }, 500);
    }

    return c.json({
      success: true,
      message: "Folder deleted successfully",
    });
  } catch (error) {
    console.error("[PersonalChats] Error deleting folder:", error);
    return c.json({ error: "Failed to delete folder" }, 500);
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

// PATCH /api/personal-chats/:conversationId/folder - Move conversation to folder
personalChats.patch("/:conversationId/folder", zValidator("json", moveConversationToFolderRequestSchema), async (c) => {
  const conversationId = c.req.param("conversationId");
  const { userId, folderId } = c.req.valid("json");

  try {
    // Verify conversation belongs to user
    const { data: existingConv, error: convError } = await db
      .from("personal_conversation")
      .select("id")
      .eq("id", conversationId)
      .eq("userId", userId)
      .single();

    if (convError || !existingConv) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // If folderId is provided, verify the folder exists and belongs to user
    if (folderId) {
      const { data: folder, error: folderError } = await db
        .from("personal_chat_folder")
        .select("id")
        .eq("id", folderId)
        .eq("userId", userId)
        .single();

      if (folderError || !folder) {
        return c.json({ error: "Folder not found" }, 404);
      }
    }

    // Update the conversation's folderId
    const { error: updateError } = await db
      .from("personal_conversation")
      .update({ folderId: folderId, updatedAt: new Date().toISOString() })
      .eq("id", conversationId);

    if (updateError) {
      console.error("[PersonalChats] Error moving conversation to folder:", updateError);
      return c.json({ error: "Failed to move conversation" }, 500);
    }

    return c.json({
      success: true,
      conversationId,
      folderId,
    });
  } catch (error) {
    console.error("[PersonalChats] Error moving conversation to folder:", error);
    return c.json({ error: "Failed to move conversation" }, 500);
  }
});

// DELETE /api/personal-chats/bulk - Bulk delete conversations
// NOTE: This route MUST come before /:conversationId to avoid matching "bulk" as a conversationId
personalChats.delete("/bulk", zValidator("json", bulkDeletePersonalConversationsRequestSchema), async (c) => {
  const { userId, conversationIds } = c.req.valid("json");

  console.log("[PersonalChats] Bulk delete request:", { userId, conversationIds, count: conversationIds.length });

  try {
    // Delete all specified conversations owned by user
    const { error, count } = await db
      .from("personal_conversation")
      .delete()
      .eq("userId", userId)
      .in("id", conversationIds);

    console.log("[PersonalChats] Bulk delete result:", { error, count });

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

    // Call Gemini with web search grounding (gemini-3-flash-preview)
    let aiResponseContent = "";
    let generatedImageUrl: string | null = null;
    let metadata: Record<string, any> = {};

    // Analyze prompt to determine if it's an image generation request
    // More flexible regex to match phrases like "create me an image", "make me a picture", etc.
    const isImageRequest = /\b(generate|create|make|draw|design|paint|illustrate|sketch)\b.{0,30}\b(image|picture|photo|illustration|artwork|drawing|painting)\b/i.test(content);

    try {
      if (isImageRequest) {
        // Use gemini-3-pro-image-preview for image generation
        console.log("[PersonalChats] Detected image generation request");
        const imageResult = await generateGeminiImage({
          prompt: content,
          numberOfImages: 1,
          aspectRatio: '1:1',
        });

        if (imageResult.images.length > 0) {
          // Save the generated image
          const savedImages = await saveResponseImages(
            imageResult.images.map((img, idx) => ({
              id: `img_${Date.now()}_${idx}`,
              base64: img.base64Data,
            })),
            conversationId
          );
          
          if (savedImages.length > 0) {
            generatedImageUrl = savedImages[0];
            metadata.generatedImagePrompt = content;
            metadata.toolsUsed = ["image_generation"];
          }
        }
        
        aiResponseContent = "Here's the image I generated based on your request:";
      } else {
        // Use gemini-3-flash-preview for chat with optional web search
        const thinkingLevel = mapToGeminiThinkingLevel(analyzePromptComplexity(content));
        console.log("[PersonalChats] Using Gemini with thinking level:", thinkingLevel);
        
        // Detect if web search would be helpful
        const needsWebSearch = /\b(current|latest|recent|today|news|weather|stock|price|score|update|2024|2025|2026)\b/i.test(content) ||
          /\bwhat is happening\b/i.test(content) ||
          /\bsearch\b/i.test(content);

        const result = await executeGeminiResponse({
          systemPrompt,
          userPrompt,
          enableWebSearch: needsWebSearch,
          thinkingLevel,
          maxTokens: 8192,
          chatHistory: chatHistory.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            content: msg.content,
          })),
        });

        aiResponseContent = result.content;
        
        // Track tools and grounding
        metadata.toolsUsed = [];
        if (result.searchGrounding?.sources && result.searchGrounding.sources.length > 0) {
          metadata.toolsUsed.push("web_search");
          metadata.searchSources = result.searchGrounding.sources;
        }
        
        // Store thought signature for follow-up requests
        if (result.thoughtSignature) {
          metadata.thoughtSignature = result.thoughtSignature;
        }
      }

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
    } catch (aiError: any) {
      console.error("[PersonalChats] Error generating AI response:", aiError);
      
      // Provide more specific error messages based on the error type
      const errorMessage = aiError?.message?.toLowerCase() || "";
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
        aiResponseContent = "I'm currently handling a lot of requests. Please wait a moment and try again.";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
        aiResponseContent = "That request took too long to process. Could you try a shorter message or simpler request?";
      } else if (errorMessage.includes("blocked") || errorMessage.includes("safety")) {
        aiResponseContent = "I wasn't able to respond to that request. Could you try rephrasing your question?";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        aiResponseContent = "I had trouble connecting to my services. Please check your connection and try again.";
      } else {
        aiResponseContent = "I encountered an unexpected issue processing your request. Please try again, and if the problem persists, try rephrasing your message.";
      }
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
  const { userId, content, imageUrl: attachedImageUrl, aiFriendId: requestedAiFriendId, files } = c.req.valid("json");

  console.log("[PersonalChats] Streaming message request:", { 
    conversationId, 
    userId, 
    contentLength: content?.length,
    requestedAiFriendId,
    filesCount: files?.length || 0,
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

  // Build metadata for user message - include attached files info
  const userMessageMetadata: Record<string, any> = {};
  if (attachedImageUrl) {
    userMessageMetadata.attachedImageUrls = [attachedImageUrl];
  }
  if (files && files.length > 0) {
    // Store file metadata (name, mimeType) - don't store base64 to save space
    userMessageMetadata.attachedFiles = files.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
    }));
    console.log(`[PersonalChats] [Streaming] User message includes ${files.length} attached file(s)`);
  }

  // Save user message immediately
  const { data: userMessage, error: userMsgError } = await db
    .from("personal_message")
    .insert({
      conversationId,
      content,
      role: "user",
      imageUrl: attachedImageUrl || null,
      metadata: Object.keys(userMessageMetadata).length > 0 ? userMessageMetadata : null,
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
  // Add description of attached files to help AI understand what files are attached
  if (files && files.length > 0) {
    const fileDescriptions = files.map(f => `${f.name} (${f.mimeType})`).join(', ');
    userPrompt += `\n[User attached files: ${fileDescriptions}]`;
    console.log(`[PersonalChats] Added file descriptions to prompt: ${fileDescriptions}`);
  }

  // Analyze prompt complexity for adaptive thinking level
  const promptComplexity = analyzePromptComplexity(content);
  const thinkingLevel = mapToGeminiThinkingLevel(promptComplexity);
  console.log("[PersonalChats] Adaptive thinking level:", thinkingLevel, "(from complexity:", promptComplexity, ")");

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

      // Send thinking level info
      await stream.writeSSE({
        event: "thinking_level",
        data: JSON.stringify({ level: thinkingLevel, complexity: promptComplexity }),
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

      // ===========================================================================
      // URL CONTENT EXTRACTION - Fetch website content for AI analysis
      // ===========================================================================
      const urlsInMessage = extractURLsFromText(content);
      let urlContentContext = "";
      
      if (urlsInMessage.length > 0 || isURLAnalysisRequest(content)) {
        console.log(`[PersonalChats] [URL] Found ${urlsInMessage.length} URL(s) in message`);
        
        if (urlsInMessage.length > 0) {
          // Notify client that we're fetching URL content
          await stream.writeSSE({
            event: "tool_call_start",
            data: JSON.stringify({ toolName: "url_fetch", toolInput: urlsInMessage }),
          });
          metadata.toolsUsed.push("url_fetch");
          
          try {
            const urlResults = await extractMultipleURLs(urlsInMessage);
            urlContentContext = formatURLContentForPrompt(urlResults);
            
            // Log success/failure
            const successCount = urlResults.filter(r => !r.error).length;
            console.log(`[PersonalChats] [URL] Extracted content from ${successCount}/${urlsInMessage.length} URL(s)`);
            
            await stream.writeSSE({
              event: "tool_call_end",
              data: JSON.stringify({ 
                toolName: "url_fetch",
                urls: urlResults.map(r => ({
                  url: r.url,
                  title: r.title,
                  success: !r.error,
                  error: r.error,
                  wordCount: r.wordCount,
                })),
              }),
            });
            
            // Store URL metadata for the message
            metadata.fetchedUrls = urlResults.map(r => ({
              url: r.url,
              title: r.title,
              success: !r.error,
              wordCount: r.wordCount,
            }));
          } catch (urlError) {
            console.error("[PersonalChats] [URL] Error fetching URL content:", urlError);
            await stream.writeSSE({
              event: "tool_call_end",
              data: JSON.stringify({ 
                toolName: "url_fetch",
                error: "Failed to fetch URL content",
              }),
            });
          }
        }
      }

      // ===========================================================================
      // DOCUMENT CONTENT EXTRACTION - Extract text from PDF, CSV, etc.
      // ===========================================================================
      let documentContentContext = "";
      
      if (files && files.length > 0) {
        // Filter for extractable documents (not images - those go to AI vision directly)
        const documentFiles = files.filter(f => isExtractableDocument(f.mimeType));
        
        if (documentFiles.length > 0) {
          console.log(`[PersonalChats] [Docs] Found ${documentFiles.length} extractable document(s)`);
          
          // Notify client that we're extracting document content
          await stream.writeSSE({
            event: "tool_call_start",
            data: JSON.stringify({ 
              toolName: "document_extract", 
              toolInput: documentFiles.map(f => f.name),
            }),
          });
          metadata.toolsUsed.push("document_extract");
          
          try {
            const docResults = await extractMultipleDocuments(documentFiles);
            documentContentContext = formatDocumentsForPrompt(docResults);
            
            // Log success/failure
            const successCount = docResults.filter(r => !r.error).length;
            console.log(`[PersonalChats] [Docs] Extracted content from ${successCount}/${documentFiles.length} document(s)`);
            
            await stream.writeSSE({
              event: "tool_call_end",
              data: JSON.stringify({ 
                toolName: "document_extract",
                documents: docResults.map(r => ({
                  filename: r.filename,
                  mimeType: r.mimeType,
                  success: !r.error,
                  error: r.error,
                  wordCount: r.metadata.wordCount,
                  truncated: r.metadata.truncated,
                })),
              }),
            });
            
            // Store document metadata for the message
            metadata.extractedDocuments = docResults.map(r => ({
              filename: r.filename,
              mimeType: r.mimeType,
              success: !r.error,
              wordCount: r.metadata.wordCount,
            }));
          } catch (docError) {
            console.error("[PersonalChats] [Docs] Error extracting document content:", docError);
            await stream.writeSSE({
              event: "tool_call_end",
              data: JSON.stringify({ 
                toolName: "document_extract",
                error: "Failed to extract document content",
              }),
            });
          }
        }
      }

      // Detect if web search would be helpful for this request
      // Uses centralized pattern detection for consistency
      const needsWebSearch = shouldEnableWebSearch(content) ||
        (urlsInMessage.length > 0 && urlContentContext === ""); // Enable search if URL fetch failed
      
      // Detect if this is an image generation request
      // More flexible regex to match phrases like "create me an image", "make me a picture", etc.
      const isImageRequest = /\b(generate|create|make|draw|design|paint|illustrate|sketch)\b.{0,30}\b(image|picture|photo|illustration|artwork|drawing|painting)\b/i.test(content);

      // If this is an image request, handle it specially with Gemini image generation
      if (isImageRequest) {
        console.log("[PersonalChats] [Streaming] Image generation request detected");
        metadata.toolsUsed.push("image_generation");
        
        // Extract image files from attachments to use as reference images
        const referenceImages: Array<{ base64: string; mimeType: string }> = [];
        if (files && files.length > 0) {
          for (const file of files) {
            // Only include image files as reference images
            if (file.mimeType?.startsWith('image/') && file.base64) {
              referenceImages.push({
                base64: file.base64,
                mimeType: file.mimeType,
              });
              console.log(`[PersonalChats] [Image] Added reference image: ${file.name} (${file.mimeType})`);
            }
          }
        }
        
        if (referenceImages.length > 0) {
          console.log(`[PersonalChats] [Streaming] Using ${referenceImages.length} reference image(s) for generation`);
        }
        
        // Notify client that image generation is starting
        await stream.writeSSE({
          event: "tool_call_start",
          data: JSON.stringify({ toolName: "image_generation", toolInput: content }),
        });
        
        // Start a more frequent ping interval during image generation to keep XHR connection alive
        // React Native XHR may not trigger onprogress if there's a long gap without data
        const imageGenPingInterval = setInterval(async () => {
          try {
            console.log("[PersonalChats] [Image] Sending keep-alive ping during generation");
            await stream.writeSSE({
              event: "ping",
              data: JSON.stringify({ timestamp: Date.now(), status: "generating" }),
            });
          } catch (e) {
            clearInterval(imageGenPingInterval);
          }
        }, 2000); // Ping every 2 seconds during image generation

        try {
          const imageResult = await generateGeminiImage({
            prompt: content,
            numberOfImages: 1,
            aspectRatio: '1:1',
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          });
          
          // Clear the frequent ping interval now that generation is complete
          clearInterval(imageGenPingInterval);
          
          if (imageResult.images.length > 0) {
            const imageId = `img_${Date.now()}`;
            generatedImages.push({
              id: imageId,
              base64: imageResult.images[0].base64Data,
            });
            
            // Save the image and notify client
            console.log("[PersonalChats] [Image] Saving generated image to storage...");
            const savedImages = await saveResponseImages(generatedImages, conversationId);
            console.log("[PersonalChats] [Image] Saved images count:", savedImages.length);
            
            if (savedImages.length > 0) {
              metadata.generatedImageUrl = savedImages[0];
              console.log("[PersonalChats] [Image] Sending image_generated event with URL:", savedImages[0]);
              await stream.writeSSE({
                event: "image_generated",
                data: JSON.stringify({ imageId, imageUrl: savedImages[0] }),
              });
              console.log("[PersonalChats] [Image] image_generated event sent successfully");
              
              // Small delay to ensure event is flushed to client before next event
              await new Promise(resolve => setTimeout(resolve, 50));
            } else {
              console.error("[PersonalChats] [Image] saveResponseImages returned empty array!");
            }
          } else {
            console.error("[PersonalChats] [Image] generateGeminiImage returned no images!");
          }
          
          console.log("[PersonalChats] [Image] Sending tool_call_end event");
          await stream.writeSSE({
            event: "tool_call_end",
            data: JSON.stringify({ toolName: "image_generation" }),
          });
          
          // Small delay to ensure event is flushed
          await new Promise(resolve => setTimeout(resolve, 50));
          
          fullContent = "Here's the image I generated based on your request:";
          await stream.writeSSE({
            event: "content_delta",
            data: JSON.stringify({ content: fullContent }),
          });
          await stream.writeSSE({
            event: "content_end",
            data: JSON.stringify({ content: fullContent }),
          });
        } catch (imgError) {
          // Clear the frequent ping interval on error
          clearInterval(imageGenPingInterval);
          console.error("[PersonalChats] Image generation error:", imgError);
          fullContent = "I apologize, but I encountered an error generating the image. Please try again.";
          await stream.writeSSE({
            event: "content_delta",
            data: JSON.stringify({ content: fullContent }),
          });
          await stream.writeSSE({
            event: "content_end",
            data: JSON.stringify({ content: fullContent }),
          });
        }
        
        // Skip to done event handling (will be handled in a synthetic done event below)
        // Create synthetic done event data
        const syntheticDoneEvent = { type: "done" as const, data: {} };
        
        // Process done event
        console.log("[PersonalChats] [Image] Processing done event after image generation");
        
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
        let generatedImageUrl: string | null = metadata.generatedImageUrl || null;
        
        // Save assistant message
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
        console.log("[PersonalChats] [Image] Sending assistant_message event with generatedImageUrl:", generatedImageUrl);
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
        
        // Small delay to ensure event is flushed before done event
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send completion event
        console.log("[PersonalChats] [Image] Sending done event");
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ 
            success: true,
            updatedTitle: updateData.title,
          }),
        });
        
        console.log("[PersonalChats] [Image] All events sent, closing stream");
        // Clear keep-alive and return early
        clearInterval(keepAliveInterval);
        return;
      }

      // Build the final user prompt with URL and document content if available
      let finalUserPrompt = userPrompt;
      
      // Add URL content context
      if (urlContentContext) {
        finalUserPrompt = `${urlContentContext}\n\n${finalUserPrompt}`;
        console.log(`[PersonalChats] Added URL content context (${urlContentContext.length} chars) to prompt`);
      }
      
      // Add document content context
      if (documentContentContext) {
        finalUserPrompt = `${documentContentContext}\n\n${finalUserPrompt}`;
        console.log(`[PersonalChats] Added document content context (${documentContentContext.length} chars) to prompt`);
      }

      // Stream Gemini response using gemini-3-flash-preview for text/web search
      const responseStream = streamGeminiResponse({
        systemPrompt,
        userPrompt: finalUserPrompt,
        enableWebSearch: needsWebSearch,
        thinkingLevel,
        maxTokens: 8192,
        chatHistory: chatHistory.map(msg => ({
          role: msg.role === "assistant" ? "model" : "user",
          content: msg.content,
        })),
        // Pass attached files to Gemini for context
        files: files || [],
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
              const imageId = event.data.imageId || `img_${Date.now()}`;
              generatedImages.push({
                id: imageId,
                base64: event.data.imageBase64,
              });
              
              // Save the image immediately so we can send the URL to the frontend
              try {
                console.log("[PersonalChats] Saving generated image immediately...");
                const savedImages = await saveResponseImages([{ id: imageId, base64: event.data.imageBase64 }], conversationId);
                if (savedImages.length > 0) {
                  const imageUrl = savedImages[0];
                  console.log("[PersonalChats] Image saved, sending URL to frontend:", imageUrl);
                  await stream.writeSSE({
                    event: "image_generated",
                    data: JSON.stringify({ 
                      imageId,
                      imageUrl,
                    }),
                  });
                  
                  // Store the URL so we don't save it again in the done event
                  if (!metadata.generatedImageUrl) {
                    metadata.generatedImageUrl = imageUrl;
                  }
                } else {
                  console.error("[PersonalChats] Failed to save image immediately");
                  await stream.writeSSE({
                    event: "image_generated",
                    data: JSON.stringify({ imageId }),
                  });
                }
              } catch (imgError) {
                console.error("[PersonalChats] Error saving image:", imgError);
                await stream.writeSSE({
                  event: "image_generated",
                  data: JSON.stringify({ imageId }),
                });
              }
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
            
            // Check if image was already saved during streaming
            if (metadata.generatedImageUrl) {
              console.log("[PersonalChats] Using already-saved image URL:", metadata.generatedImageUrl);
              generatedImageUrl = metadata.generatedImageUrl;
              metadata.generatedImagePrompt = fullContent;
            } else if (generatedImages.length > 0) {
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
      
      // Categorize the error and provide a user-friendly message
      let userFriendlyError = "An unexpected error occurred. Please try again.";
      let errorCode = "UNKNOWN_ERROR";
      
      const errorMessage = error?.message?.toLowerCase() || "";
      const errorStatus = error?.status || error?.code;
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("quota") || errorStatus === 429) {
        userFriendlyError = "The AI service is currently busy. Please wait a moment and try again.";
        errorCode = "RATE_LIMIT";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("abort") || error?.name === "AbortError") {
        userFriendlyError = "The request took too long. Try a shorter message or simpler request.";
        errorCode = "TIMEOUT";
      } else if (errorMessage.includes("blocked") || errorMessage.includes("safety") || errorMessage.includes("content policy")) {
        userFriendlyError = "This request couldn't be processed due to content guidelines. Please rephrase your message.";
        errorCode = "CONTENT_BLOCKED";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection") || errorMessage.includes("enotfound") || errorMessage.includes("econnrefused")) {
        userFriendlyError = "Network connection issue. Please check your internet and try again.";
        errorCode = "NETWORK_ERROR";
      } else if (errorMessage.includes("api key") || errorMessage.includes("unauthorized") || errorMessage.includes("authentication") || errorStatus === 401 || errorStatus === 403) {
        userFriendlyError = "Service configuration issue. Please contact support.";
        errorCode = "AUTH_ERROR";
      } else if (errorMessage.includes("invalid") || errorMessage.includes("malformed")) {
        userFriendlyError = "There was an issue with your request. Please try rephrasing.";
        errorCode = "INVALID_REQUEST";
      } else if (errorMessage.includes("model") || errorMessage.includes("gemini") || errorMessage.includes("openai")) {
        userFriendlyError = "The AI service encountered an issue. Please try again in a moment.";
        errorCode = "AI_SERVICE_ERROR";
      }
      
      // Log the full error for debugging
      console.error(`[PersonalChats] Error categorized as ${errorCode}:`, {
        originalMessage: error?.message,
        status: errorStatus,
        stack: error?.stack?.substring(0, 500),
      });
      
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ 
          error: userFriendlyError,
          code: errorCode,
          retryable: ["RATE_LIMIT", "TIMEOUT", "NETWORK_ERROR", "AI_SERVICE_ERROR"].includes(errorCode),
        }),
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

    // Generate image using Gemini gemini-3-pro-image-preview
    console.log("[PersonalChats] Generating image with Gemini:", prompt);
    const imageResult = await generateGeminiImage({
      prompt,
      numberOfImages: 1,
      aspectRatio: aspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4' || '1:1',
    });

    if (!imageResult.images || imageResult.images.length === 0) {
      return c.json({ error: "Failed to generate image" }, 500);
    }

    // Save the generated image
    const savedImages = await saveResponseImages(
      imageResult.images.map((img, idx) => ({
        id: `img_${Date.now()}_${idx}`,
        base64: img.base64Data,
      })),
      conversationId
    );
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

