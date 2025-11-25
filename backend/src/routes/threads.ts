import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import {
  createThreadRequestSchema,
  getThreadsRequestSchema,
  getThreadMessagesRequestSchema,
  updateThreadRequestSchema,
  deleteThreadRequestSchema,
  reorderThreadsRequestSchema,
  type Thread,
  type Message,
} from "@shared/contracts";

const threads = new Hono();

// POST /api/threads/reorder - Reorder threads for a user
threads.post("/reorder", zValidator("json", reorderThreadsRequestSchema), async (c) => {
  try {
    const { chatId, userId, items } = c.req.valid("json");
    console.log("[POST /api/threads/reorder] Reordering threads for user:", userId);

    // Process updates - upsert each thread member
    for (const item of items) {
      // Check if thread member exists
      const { data: existing } = await db
        .from("thread_member")
        .select("id")
        .eq("threadId", item.threadId)
        .eq("userId", userId)
        .single();

      if (existing) {
        // Update existing
        await db
          .from("thread_member")
          .update({ sortOrder: item.sortOrder })
          .eq("threadId", item.threadId)
          .eq("userId", userId);
      } else {
        // Create new
        await db
          .from("thread_member")
          .insert({
            threadId: item.threadId,
            userId: userId,
            sortOrder: item.sortOrder,
          });
      }
    }

    return c.json({ success: true, message: "Threads reordered successfully" });
  } catch (error) {
    console.error("[POST /api/threads/reorder] Error reordering threads:", error);
    return c.json({ error: "Failed to reorder threads" }, 500);
  }
});

// POST /api/threads - Create a new smart thread
threads.post("/", zValidator("json", createThreadRequestSchema), async (c) => {
  try {
    const { chatId, creatorId, name, icon, isShared, filterRules } = c.req.valid("json");
    console.log("[POST /api/threads] Received request:", { chatId, creatorId, name, icon, isShared, filterRules });

    // Verify chat exists
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("id")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      console.log("[POST /api/threads] Chat not found:", chatId);
      return c.json({ error: "Chat not found" }, 404);
    }

    // Verify user is a member
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", creatorId)
      .single();

    if (!membership) {
      console.log("[POST /api/threads] User not authorized:", { chatId, creatorId });
      return c.json({ error: "User not authorized" }, 403);
    }
    console.log("[POST /api/threads] User authorized, creating thread...");

    // Automatically add thread name to keywords for guaranteed @threadname matching
    const enhancedFilterRules = {
      ...filterRules,
      keywords: [
        ...(filterRules.keywords || []),
        name, // Add thread name as a keyword for guaranteed matching
      ],
    };

    console.log("[POST /api/threads] Enhanced filter rules with auto-tag:", enhancedFilterRules);

    // Create thread
    const { data: thread, error: threadError } = await db
      .from("thread")
      .insert({
        chatId,
        name,
        icon: icon || "💬",
        creatorId,
        isShared,
        filterRules: JSON.stringify(enhancedFilterRules),
        memberIds: JSON.stringify([creatorId]),
      })
      .select("*")
      .single();

    if (threadError || !thread) {
      console.error("[POST /api/threads] Error creating thread:", threadError);
      return c.json({ error: "Failed to create thread" }, 500);
    }

    // Create thread membership record
    await db
      .from("thread_member")
      .insert({
        threadId: thread.id,
        userId: creatorId,
      });

    // Parse JSON fields before returning
    const parsedThread = {
      ...thread,
      filterRules: JSON.parse(thread.filterRules),
      memberIds: JSON.parse(thread.memberIds),
    };

    console.log("[POST /api/threads] Returning parsed thread:", parsedThread);
    return c.json(parsedThread, 201);
  } catch (error) {
    console.error("[POST /api/threads] Error creating thread:", error);
    return c.json({ error: "Failed to create thread" }, 500);
  }
});

// GET /api/threads/:chatId - Get all threads for a chat
threads.get("/:chatId", zValidator("query", getThreadsRequestSchema), async (c) => {
  try {
    const { chatId } = c.req.param();
    const { userId } = c.req.valid("query");
    console.log("[GET /api/threads/:chatId] Received request:", { chatId, userId });

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (membershipError || !membership) {
      console.log("[GET /api/threads/:chatId] User not authorized:", { chatId, userId });
      return c.json({ error: "User not authorized" }, 403);
    }
    console.log("[GET /api/threads/:chatId] User authorized, fetching threads...");

    // Get all threads user can access (created by user or shared)
    const { data: allThreads = [], error: threadsError } = await db
      .from("thread")
      .select("*")
      .eq("chatId", chatId)
      .order("updatedAt", { ascending: false });

    if (threadsError) {
      console.error("[GET /api/threads/:chatId] Error fetching threads:", threadsError);
      return c.json({ error: "Failed to fetch threads" }, 500);
    }

    // Filter for threads user can access
    const accessibleThreads = allThreads.filter((t: any) => {
      const memberIds = JSON.parse(t.memberIds || "[]");
      return t.creatorId === userId || t.isShared || memberIds.includes(userId);
    });

    // Get thread members for sort order
    const threadIds = accessibleThreads.map((t: any) => t.id);
    const { data: threadMembers = [] } = threadIds.length > 0 ? await db
      .from("thread_member")
      .select("threadId, sortOrder")
      .eq("userId", userId)
      .in("threadId", threadIds) : { data: [] };

    const sortOrderMap = new Map(threadMembers.map((m: any) => [m.threadId, m.sortOrder]));

    // Sort by user-specific sortOrder, then by updatedAt
    const sortedThreads = accessibleThreads.sort((a: any, b: any) => {
      const orderA = sortOrderMap.get(a.id) ?? 0;
      const orderB = sortOrderMap.get(b.id) ?? 0;

      // Primary sort: User's custom order (ascending)
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Secondary sort: Newest first (if no custom order)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Parse JSON fields before returning
    const parsedThreads = sortedThreads.map((thread: any) => ({
      ...thread,
      filterRules: JSON.parse(thread.filterRules),
      memberIds: JSON.parse(thread.memberIds),
      sortOrder: sortOrderMap.get(thread.id) ?? 0,
    }));

    console.log("[GET /api/threads/:chatId] Found threads:", threads.length, "Returning:", parsedThreads.map(t => ({ id: t.id, name: t.name })));
    return c.json(parsedThreads);
  } catch (error) {
    console.error("[GET /api/threads/:chatId] Error fetching threads:", error);
    return c.json({ error: "Failed to fetch threads" }, 500);
  }
});

// GET /api/threads/:threadId/messages - Get messages matching thread filter
threads.get("/:threadId/messages", zValidator("query", getThreadMessagesRequestSchema), async (c) => {
  try {
    const { threadId } = c.req.param();
    const { userId } = c.req.valid("query");
    
    console.log("[GET /api/threads/:threadId/messages] Received request:", { threadId, userId });

    // Get thread and verify access
    const { data: thread, error: threadError } = await db
      .from("thread")
      .select("*")
      .eq("id", threadId)
      .single();

    if (threadError || !thread) {
      console.log("[GET /api/threads/:threadId/messages] Thread not found");
      return c.json({ error: "Thread not found" }, 404);
    }

    // Parse JSON fields
    const memberIds = JSON.parse(thread.memberIds || "[]");
    const filterRules = JSON.parse(thread.filterRules || "{}");
    
    console.log("[GET /api/threads/:threadId/messages] Thread found:", {
      threadName: thread.name,
      chatId: thread.chatId,
      filterRules,
    });

    // Check if user has access
    const hasAccess =
      thread.creatorId === userId ||
      thread.isShared ||
      memberIds.includes(userId);

    if (!hasAccess) {
      return c.json({ error: "User not authorized" }, 403);
    }
    const whereConditions: any = {
      chatId: thread.chatId,
    };

    // Apply date range filter
    if (filterRules.dateRange) {
      whereConditions.createdAt = {};
      if (filterRules.dateRange.start) {
        whereConditions.createdAt.gte = new Date(filterRules.dateRange.start);
      }
      if (filterRules.dateRange.end) {
        whereConditions.createdAt.lte = new Date(filterRules.dateRange.end);
      }
    }

    // Apply people filter (specific users)
    if (filterRules.people && filterRules.people.length > 0) {
      // FIX: Check if values are UUIDs (User IDs) or Names
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isAllUUIDs = filterRules.people.every((p: string) => uuidRegex.test(p));

      // Only filter by userId in DB if all values are UUIDs (likely User IDs)
      // If we have names (e.g. "AJ"), we can't filter by userId here effectively
      if (isAllUUIDs) {
        whereConditions.userId = { in: filterRules.people };
      }
    }

    // Apply keyword filter (content search)
    // This is now INTEGRATED with the tag filtering below for a unified OR condition
    // We do NOT apply it here as a strict AND condition anymore.

    // Get messages matching base filters (Chat ID, Date Range, People)
    let query = db
      .from("message")
      .select("*")
      .eq("chatId", thread.chatId);

    // Apply date range filter
    if (filterRules.dateRange) {
      if (filterRules.dateRange.start) {
        query = query.gte("createdAt", new Date(filterRules.dateRange.start).toISOString());
      }
      if (filterRules.dateRange.end) {
        query = query.lte("createdAt", new Date(filterRules.dateRange.end).toISOString());
      }
    }

    // Apply people filter
    if (filterRules.people && filterRules.people.length > 0) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isAllUUIDs = filterRules.people.every((p: string) => uuidRegex.test(p));
      
      if (isAllUUIDs) {
        query = query.in("userId", filterRules.people);
      }
    }

    let { data: messages = [], error: messagesError } = await query.order("createdAt", { ascending: true });

    if (messagesError) {
      console.error("[GET /api/threads/:threadId/messages] Error fetching messages:", messagesError);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }

    // Fetch related data for messages
    const messageIds = messages.map((m: any) => m.id);
    const userIds = [...new Set(messages.map((m: any) => m.userId))];
    const replyToIds = [...new Set(messages.filter((m: any) => m.replyToId).map((m: any) => m.replyToId))];

    // Fetch users
    const { data: users = [] } = userIds.length > 0 ? await db
      .from("user")
      .select("*")
      .in("id", userIds) : { data: [] };
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Fetch reactions
    const { data: reactions = [] } = messageIds.length > 0 ? await db
      .from("reaction")
      .select("*")
      .in("messageId", messageIds) : { data: [] };
    
    // Fetch reaction users
    const reactionUserIds = [...new Set(reactions.map((r: any) => r.userId))];
    const { data: reactionUsers = [] } = reactionUserIds.length > 0 ? await db
      .from("user")
      .select("*")
      .in("id", reactionUserIds) : { data: [] };
    const reactionUserMap = new Map(reactionUsers.map((u: any) => [u.id, u]));

    // Fetch replyTo messages
    const { data: replyToMessages = [] } = replyToIds.length > 0 ? await db
      .from("message")
      .select("*")
      .in("id", replyToIds) : { data: [] };
    const replyToMap = new Map(replyToMessages.map((m: any) => [m.id, m]));

    // Attach related data to messages
    messages = messages.map((msg: any) => ({
      ...msg,
      user: userMap.get(msg.userId),
      replyTo: msg.replyToId && replyToMap.get(msg.replyToId) ? {
        ...replyToMap.get(msg.replyToId),
        user: userMap.get(replyToMap.get(msg.replyToId).userId),
      } : null,
      reactions: reactions.filter((r: any) => r.messageId === msg.id).map((r: any) => ({
        ...r,
        user: reactionUserMap.get(r.userId),
      })),
    }));

    // Apply Unified Tag & Keyword Filter
    // Goal: Message is included if it matches ANY of the criteria:
    // 1. Tag matches Topic/Entity/Theme
    // 2. Tag matches Sentiment
    // 3. Content matches Keyword/Topic (Case-insensitive)
    // 4. Tag matches Keyword/Topic

    const hasSemanticFilters = 
      (filterRules.topics && filterRules.topics.length > 0) ||
      (filterRules.entities && filterRules.entities.length > 0) ||
      (filterRules.keywords && filterRules.keywords.length > 0) ||
      filterRules.sentiment;

    if (hasSemanticFilters) {
      const messageIds = messages.map((m: any) => m.id);

      // 1. Find messages with matching TAGS
      const tagOrConditions: string[] = [];

      // Topics/Keywords from settings -> Match against Topic, Theme, Entity, Keyword tags
      const searchTerms = [
        ...(filterRules.topics || []),
        ...(filterRules.keywords || [])
      ];

      // Fetch all tags for these messages
      const { data: allTags = [] } = messageIds.length > 0 ? await db
        .from("message_tag")
        .select("messageId, tagType, tagValue")
        .in("messageId", messageIds) : { data: [] };

      // Find matching message IDs based on tags
      const matchingMessageIds = new Set<string>();
      
      allTags.forEach((tag: any) => {
        let matches = false;

        // Check search terms (topics/keywords)
        if (searchTerms.length > 0) {
          if (["topic", "theme", "entity", "keyword", "thread"].includes(tag.tagType)) {
            matches = searchTerms.some(term => 
              tag.tagValue.toLowerCase().includes(term.toLowerCase())
            );
          }
        }

        // Check guaranteed @thread tag match
        if (tag.tagType === "thread" && tag.tagValue === thread.name) {
          matches = true;
        }

        // Check entities
        if (filterRules.entities && filterRules.entities.length > 0) {
          if (tag.tagType === "entity") {
            matches = filterRules.entities.some((entity: string) =>
              tag.tagValue.toLowerCase().includes(entity.toLowerCase())
            );
          }
        }

        // Check sentiment
        if (filterRules.sentiment && tag.tagType === "sentiment" && tag.tagValue === filterRules.sentiment) {
          matches = true;
        }

        if (matches) {
          matchingMessageIds.add(tag.messageId);
        }
      });

      // 2. Filter the messages in memory
      // Keep message if:
      // A) It has a matching tag (found above)
      // B) OR its CONTENT matches any keyword/topic directly
      
      messages = messages.filter((m: any) => {
        // A. Check Tags
        if (matchingMessageIds.has(m.id)) return true;

        // B. Check Content (Case-insensitive search for all terms)
        if (searchTerms.length > 0 && m.content) {
          const contentLower = m.content.toLowerCase();
          return searchTerms.some((term: string) => contentLower.includes(term.toLowerCase()));
        }

        return false;
      });
    }

    console.log("[GET /api/threads/:threadId/messages] Returning messages:", {
      count: messages.length,
      messageIds: messages.map(m => m.id).slice(0, 5), // First 5 IDs
    });

    // Format messages to match the Message type with linkPreview
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      messageType: msg.messageType,
      imageUrl: msg.imageUrl,
      imageDescription: msg.imageDescription,
      userId: msg.userId,
      chatId: msg.chatId,
      replyToId: msg.replyToId,
      editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
      isUnsent: msg.isUnsent,
      editHistory: msg.editHistory,
      voiceUrl: msg.voiceUrl,
      voiceDuration: msg.voiceDuration,
      createdAt: new Date(msg.createdAt).toISOString(),
      linkPreview: msg.linkPreviewUrl ? {
        url: msg.linkPreviewUrl,
        title: msg.linkPreviewTitle,
        description: msg.linkPreviewDescription,
        image: msg.linkPreviewImage,
        siteName: msg.linkPreviewSiteName,
        favicon: msg.linkPreviewFavicon,
      } : null,
      mentions: [], // TODO: Add mentions if needed
      user: {
        id: msg.user.id,
        name: msg.user.name,
        bio: msg.user.bio,
        image: msg.user.image,
        hasCompletedOnboarding: msg.user.hasCompletedOnboarding,
        createdAt: msg.user.createdAt.toISOString(),
        updatedAt: msg.user.updatedAt.toISOString(),
      },
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            content: msg.replyTo.content,
            messageType: msg.replyTo.messageType,
            imageUrl: msg.replyTo.imageUrl,
            imageDescription: msg.replyTo.imageDescription,
            userId: msg.replyTo.userId,
            chatId: msg.replyTo.chatId,
            replyToId: msg.replyTo.replyToId,
            editedAt: msg.replyTo.editedAt?.toISOString() || null,
            isUnsent: msg.replyTo.isUnsent,
            editHistory: msg.replyTo.editHistory,
            voiceUrl: msg.replyTo.voiceUrl,
            voiceDuration: msg.replyTo.voiceDuration,
            createdAt: msg.replyTo.createdAt.toISOString(),
            linkPreview: null, // Don't nest link previews in replies
            mentions: [],
            reactions: [],
            user: {
              id: msg.replyTo.user.id,
              name: msg.replyTo.user.name,
              bio: msg.replyTo.user.bio,
              image: msg.replyTo.user.image,
              hasCompletedOnboarding: msg.replyTo.user.hasCompletedOnboarding,
              createdAt: msg.replyTo.user.createdAt.toISOString(),
              updatedAt: msg.replyTo.user.updatedAt.toISOString(),
            },
          }
        : null,
      reactions: msg.reactions.map((reaction) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        messageId: reaction.messageId,
        createdAt: reaction.createdAt.toISOString(),
        user: {
          id: reaction.user.id,
          name: reaction.user.name,
          bio: reaction.user.bio,
          image: reaction.user.image,
          hasCompletedOnboarding: reaction.user.hasCompletedOnboarding,
          createdAt: reaction.user.createdAt.toISOString(),
          updatedAt: reaction.user.updatedAt.toISOString(),
        },
      })),
    }));

    return c.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    return c.json({ error: "Failed to fetch thread messages" }, 500);
  }
});

// PATCH /api/threads/:threadId - Update thread
threads.patch("/:threadId", zValidator("json", updateThreadRequestSchema), async (c) => {
  try {
    const { threadId } = c.req.param();
    const { userId, ...updates } = c.req.valid("json");

    // Get thread and verify ownership
    const { data: thread, error: threadError } = await db
      .from("thread")
      .select("*")
      .eq("id", threadId)
      .single();

    if (threadError || !thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    if (thread.creatorId !== userId) {
      return c.json({ error: "Only thread creator can update" }, 403);
    }

    // Stringify JSON fields if present
    const dataToUpdate: any = {};
    if (updates.name) dataToUpdate.name = updates.name;
    if (updates.icon) dataToUpdate.icon = updates.icon;
    if (updates.isShared !== undefined) dataToUpdate.isShared = updates.isShared;
    
    // Automatically ensure thread name is in keywords for guaranteed matching
    if (updates.filterRules) {
      const threadName = updates.name || thread.name;
      const enhancedFilterRules = {
        ...updates.filterRules,
        keywords: [
          ...(updates.filterRules.keywords || []).filter((k: string) => k.toLowerCase() !== threadName.toLowerCase()),
          threadName, // Always include current thread name
        ],
      };
      dataToUpdate.filterRules = JSON.stringify(enhancedFilterRules);
    }
    
    if (updates.memberIds) dataToUpdate.memberIds = JSON.stringify(updates.memberIds);

    // Update thread
    const { data: updatedThread, error: updateError } = await db
      .from("thread")
      .update(dataToUpdate)
      .eq("id", threadId)
      .select("*")
      .single();

    if (updateError || !updatedThread) {
      console.error("Error updating thread:", updateError);
      return c.json({ error: "Failed to update thread" }, 500);
    }

    // Parse JSON fields before returning
    const parsedUpdatedThread = {
      ...updatedThread,
      filterRules: JSON.parse(updatedThread.filterRules),
      memberIds: JSON.parse(updatedThread.memberIds),
    };

    return c.json(parsedUpdatedThread);
  } catch (error) {
    console.error("Error updating thread:", error);
    return c.json({ error: "Failed to update thread" }, 500);
  }
});

// DELETE /api/threads/:threadId - Delete thread
threads.delete("/:threadId", zValidator("query", deleteThreadRequestSchema), async (c) => {
  try {
    const { threadId } = c.req.param();
    const { userId } = c.req.valid("query");

    // Get thread and verify ownership
    const { data: thread, error: threadError } = await db
      .from("thread")
      .select("*")
      .eq("id", threadId)
      .single();

    if (threadError || !thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    if (thread.creatorId !== userId) {
      return c.json({ error: "Only thread creator can delete" }, 403);
    }

    // Delete thread and associated memberships
    await db
      .from("thread_member")
      .delete()
      .eq("threadId", threadId);

    const { error: deleteError } = await db
      .from("thread")
      .delete()
      .eq("id", threadId);

    if (deleteError) {
      console.error("Error deleting thread:", deleteError);
      return c.json({ error: "Failed to delete thread" }, 500);
    }

    return c.json({ success: true, message: "Thread deleted successfully" });
  } catch (error) {
    console.error("Error deleting thread:", error);
    return c.json({ error: "Failed to delete thread" }, 500);
  }
});

export default threads;

