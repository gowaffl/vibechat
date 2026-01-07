import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, executeWithRetry } from "../db";
import { decryptMessages } from "../services/message-encryption";
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

    // Verify user is a member (with retry logic)
    const { data: membership } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", creatorId)
        .single();
    });

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

    // Verify user is a member of the chat (with retry logic)
    const { data: membership, error: membershipError } = await executeWithRetry(async () => {
      return await db
        .from("chat_member")
        .select("*")
        .eq("chatId", chatId)
        .eq("userId", userId)
        .single();
    });

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

    // Pagination parameters
    const limit = parseInt(c.req.query("limit") || "100");
    let cursor = c.req.query("cursor");

    // Unified Filtering Logic
    // We scan DB in batches until we find enough messages or exhaust DB.
    
    const hasSemanticFilters = 
      (filterRules.topics && filterRules.topics.length > 0) ||
      (filterRules.entities && filterRules.entities.length > 0) ||
      (filterRules.keywords && filterRules.keywords.length > 0) ||
      filterRules.sentiment;

    // Search terms for filtering
    const searchTerms = [
      ...(filterRules.topics || []),
      ...(filterRules.keywords || [])
    ];
    
    let collectedMessages: any[] = [];
    let hasMore = true;
    let nextCursor: string | null = null;
    let scannedCount = 0;
    const MAX_SCAN = 2000; // Scan up to 2000 messages deep to find matches
    const BATCH_SIZE = 200; // Fetch 200 raw messages at a time

    console.log(`[GET /api/threads/:threadId/messages] Starting scan with limit=${limit}, cursor=${cursor}, semantic=${hasSemanticFilters}`);

    while (collectedMessages.length < limit && scannedCount < MAX_SCAN) {
      // 1. Build Query for this batch
      let query = db
        .from("message")
        .select("*")
        .eq("chatId", thread.chatId);

      // Apply date range filter (DB level)
      if (filterRules.dateRange) {
        if (filterRules.dateRange.start) {
          query = query.gte("createdAt", new Date(filterRules.dateRange.start).toISOString());
        }
        if (filterRules.dateRange.end) {
          query = query.lte("createdAt", new Date(filterRules.dateRange.end).toISOString());
        }
      }

      // Apply people filter (DB level if UUIDs)
      if (filterRules.people && filterRules.people.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isAllUUIDs = filterRules.people.every((p: string) => uuidRegex.test(p));
        
        if (isAllUUIDs) {
          query = query.in("userId", filterRules.people);
        }
      }

      // Apply cursor
      if (cursor) {
        query = query.lt("createdAt", cursor);
      }

      // Fetch batch
      const { data: batch = [], error: batchError } = await query
        .order("createdAt", { ascending: false })
        .limit(BATCH_SIZE);

      if (batchError) {
        console.error("Error fetching message batch:", batchError);
        throw batchError;
      }

      if (batch.length === 0) {
        hasMore = false;
        nextCursor = null;
        break;
      }

      scannedCount += batch.length;
      
      // Update cursor for next iteration (tracking scan progress)
      // If we stop here and return, the frontend needs to resume from the last SCANNED message,
      // not the last FOUND message.
      const lastMsg = batch[batch.length - 1];
      cursor = lastMsg.createdAt;
      nextCursor = cursor;

      let validBatch = batch;

      // 2. Apply Semantic Filters (In-Memory)
      if (hasSemanticFilters) {
        const batchIds = batch.map((m: any) => m.id);

        // Fetch tags for this batch
        const { data: batchTags = [] } = batchIds.length > 0 ? await db
          .from("message_tag")
          .select("messageId, tagType, tagValue")
          .in("messageId", batchIds) : { data: [] };

        // Find matches
        const matchingMessageIds = new Set<string>();
        
        batchTags.forEach((tag: any) => {
          let matches = false;

          // Check search terms
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

        // Filter batch
        validBatch = batch.filter((m: any) => {
          // A. Check Tags
          if (matchingMessageIds.has(m.id)) return true;

          // B. Check Content
          if (searchTerms.length > 0 && m.content) {
            const contentLower = m.content.toLowerCase();
            return searchTerms.some((term: string) => contentLower.includes(term.toLowerCase()));
          }

          return false;
        });
      }

      // Add to collection
      collectedMessages.push(...validBatch);

      // If we've reached end of DB (batch < limit), stop
      if (batch.length < BATCH_SIZE) {
        hasMore = false;
        nextCursor = null;
        break;
      }
    }

    // Limit the results strictly to requested limit?
    // User requested up to 100. If we found 150 in one batch, we can slice.
    // However, if we slice, we MUST ensure nextCursor allows re-fetching the extras?
    // No, with this "scan until filled" logic, 'nextCursor' is the end of the scan range.
    // If we return fewer messages than we found (e.g. found 105, need 100), the next 5 are effectively "lost" 
    // because nextCursor is already past them.
    // So, we should return ALL messages we found in the batches we processed, 
    // OR we should have stopped processing immediately when collectedMessages >= limit.
    // The loop condition `collectedMessages.length < limit` handles this mostly, but the last batch might overflow.
    // Since this is a specialized "Smart Thread" view, returning slightly more than 100 (e.g. 150) is fine 
    // and better than losing data.
    
    // Assign messages to 'messages' variable for data hydration
    let messages = await decryptMessages(collectedMessages);

    // Fetch related data for messages (Only for the ones we are returning!)
    
    // 1. Get ReplyTo Messages first
    const replyToIds = [...new Set(messages.filter((m: any) => m.replyToId).map((m: any) => m.replyToId))];
    const { data: rawReplyToMessages = [] } = replyToIds.length > 0 ? await db
      .from("message")
      .select("*")
      .in("id", replyToIds) : { data: [] };
    
    const replyToMessages = await decryptMessages(rawReplyToMessages);
    const replyToMap = new Map(replyToMessages.map((m: any) => [m.id, m]));

    // 2. Get User IDs from both messages and replyTo messages
    const userIds = new Set<string>();
    messages.forEach((m: any) => { if (m.userId) userIds.add(m.userId); });
    replyToMessages.forEach((m: any) => { if (m.userId) userIds.add(m.userId); });
    
    // 3. Get AI Friend IDs from both
    const aiFriendIds = new Set<string>();
    messages.forEach((m: any) => { if (m.aiFriendId) aiFriendIds.add(m.aiFriendId); });
    replyToMessages.forEach((m: any) => { if (m.aiFriendId) aiFriendIds.add(m.aiFriendId); });

    // 4. Fetch Users
    const { data: users = [] } = userIds.size > 0 ? await db
      .from("user")
      .select("*")
      .in("id", Array.from(userIds)) : { data: [] };
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // 5. Fetch AI Friends
    const { data: aiFriends = [] } = aiFriendIds.size > 0 ? await db
      .from("ai_friend")
      .select("*")
      .in("id", Array.from(aiFriendIds)) : { data: [] };
    const aiFriendMap = new Map(aiFriends.map((af: any) => [af.id, af]));

    // 6. Fetch Reactions
    const messageIds = messages.map((m: any) => m.id);
    const { data: reactions = [] } = messageIds.length > 0 ? await db
      .from("reaction")
      .select("*")
      .in("messageId", messageIds) : { data: [] };
    
    // 7. Fetch Reaction Users
    const reactionUserIds = [...new Set(reactions.map((r: any) => r.userId))];
    const { data: reactionUsers = [] } = reactionUserIds.length > 0 ? await db
      .from("user")
      .select("*")
      .in("id", reactionUserIds) : { data: [] };
    const reactionUserMap = new Map(reactionUsers.map((u: any) => [u.id, u]));

    // 8. Attach related data to messages
    const formattedMessages = messages.map((msg: any) => {
      const user = userMap.get(msg.userId);
      const aiFriend = msg.aiFriendId ? aiFriendMap.get(msg.aiFriendId) : null;
      const replyToMsg = msg.replyToId ? replyToMap.get(msg.replyToId) : null;
      const msgReactions = reactions.filter((r: any) => r.messageId === msg.id);

      let replyToObj = null;
      if (replyToMsg) {
        const replyToUser = userMap.get(replyToMsg.userId);
        const replyToAiFriend = replyToMsg.aiFriendId ? aiFriendMap.get(replyToMsg.aiFriendId) : null;
        
        replyToObj = {
          id: replyToMsg.id,
          content: replyToMsg.content,
          messageType: replyToMsg.messageType,
          imageUrl: replyToMsg.imageUrl,
          imageDescription: replyToMsg.imageDescription,
          userId: replyToMsg.userId,
          chatId: replyToMsg.chatId,
          replyToId: replyToMsg.replyToId,
          aiFriendId: replyToMsg.aiFriendId,
          editedAt: replyToMsg.editedAt ? (typeof replyToMsg.editedAt === 'string' ? replyToMsg.editedAt : new Date(replyToMsg.editedAt).toISOString()) : null,
          isUnsent: replyToMsg.isUnsent,
          editHistory: replyToMsg.editHistory,
          voiceUrl: replyToMsg.voiceUrl,
          voiceDuration: replyToMsg.voiceDuration,
          createdAt: typeof replyToMsg.createdAt === 'string' ? replyToMsg.createdAt : new Date(replyToMsg.createdAt).toISOString(),
          linkPreview: null, // Don't nest link previews in replies
          mentions: [],
          reactions: [],
          user: replyToUser ? {
            id: replyToUser.id,
            name: replyToUser.name,
            bio: replyToUser.bio,
            image: replyToUser.image,
            hasCompletedOnboarding: replyToUser.hasCompletedOnboarding,
            createdAt: typeof replyToUser.createdAt === 'string' ? replyToUser.createdAt : new Date(replyToUser.createdAt).toISOString(),
            updatedAt: typeof replyToUser.updatedAt === 'string' ? replyToUser.updatedAt : new Date(replyToUser.updatedAt).toISOString(),
          } : null,
          aiFriend: replyToAiFriend ? {
            id: replyToAiFriend.id,
            name: replyToAiFriend.name,
            color: replyToAiFriend.color,
            personality: replyToAiFriend.personality,
            tone: replyToAiFriend.tone,
            engagementMode: replyToAiFriend.engagementMode,
            engagementPercent: replyToAiFriend.engagementPercent,
            chatId: replyToAiFriend.chatId,
            sortOrder: replyToAiFriend.sortOrder,
            createdAt: typeof replyToAiFriend.createdAt === 'string' ? replyToAiFriend.createdAt : new Date(replyToAiFriend.createdAt).toISOString(),
            updatedAt: typeof replyToAiFriend.updatedAt === 'string' ? replyToAiFriend.updatedAt : new Date(replyToAiFriend.updatedAt).toISOString(),
          } : null,
        };
      }

      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        imageUrl: msg.imageUrl,
        imageDescription: msg.imageDescription,
        userId: msg.userId,
        chatId: msg.chatId,
        replyToId: msg.replyToId,
        aiFriendId: msg.aiFriendId,
        editedAt: msg.editedAt ? (typeof msg.editedAt === 'string' ? msg.editedAt : new Date(msg.editedAt).toISOString()) : null,
        isUnsent: msg.isUnsent,
        editHistory: msg.editHistory,
        voiceUrl: msg.voiceUrl,
        voiceDuration: msg.voiceDuration,
        createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : new Date(msg.createdAt).toISOString(),
        linkPreview: msg.linkPreviewUrl ? {
          url: msg.linkPreviewUrl,
          title: msg.linkPreviewTitle,
          description: msg.linkPreviewDescription,
          image: msg.linkPreviewImage,
          siteName: msg.linkPreviewSiteName,
          favicon: msg.linkPreviewFavicon,
        } : null,
        mentions: [], // TODO: Add mentions if needed
        user: user ? {
          id: user.id,
          name: user.name,
          bio: user.bio,
          image: user.image,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          createdAt: typeof user.createdAt === 'string' ? user.createdAt : new Date(user.createdAt).toISOString(),
          updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : new Date(user.updatedAt).toISOString(),
        } : null,
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
          createdAt: typeof aiFriend.createdAt === 'string' ? aiFriend.createdAt : new Date(aiFriend.createdAt).toISOString(),
          updatedAt: typeof aiFriend.updatedAt === 'string' ? aiFriend.updatedAt : new Date(aiFriend.updatedAt).toISOString(),
        } : null,
        replyTo: replyToObj,
        reactions: msgReactions.map((reaction: any) => {
          const rUser = reactionUserMap.get(reaction.userId);
          return {
            id: reaction.id,
            emoji: reaction.emoji,
            userId: reaction.userId,
            messageId: reaction.messageId,
            createdAt: typeof reaction.createdAt === 'string' ? reaction.createdAt : new Date(reaction.createdAt).toISOString(),
            user: rUser ? {
              id: rUser.id,
              name: rUser.name,
              bio: rUser.bio,
              image: rUser.image,
              hasCompletedOnboarding: rUser.hasCompletedOnboarding,
              createdAt: typeof rUser.createdAt === 'string' ? rUser.createdAt : new Date(rUser.createdAt).toISOString(),
              updatedAt: typeof rUser.updatedAt === 'string' ? rUser.updatedAt : new Date(rUser.updatedAt).toISOString(),
            } : null,
          };
        }),
      };
    });

    return c.json({
      messages: formattedMessages,
      hasMore,
      nextCursor
    });
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

    // For shared threads, any chat member can edit
    // For private threads, only the creator can edit
    if (!thread.isShared && thread.creatorId !== userId) {
      return c.json({ error: "Only thread creator can update private threads" }, 403);
    }

    // If thread is shared, verify user is a member of the chat
    if (thread.isShared) {
      const { data: membership } = await db
        .from("chat_member")
        .select("*")
        .eq("chatId", thread.chatId)
        .eq("userId", userId)
        .single();

      if (!membership) {
        return c.json({ error: "User not a member of this chat" }, 403);
      }
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

    // For shared threads, any chat member can delete
    // For private threads, only the creator can delete
    if (!thread.isShared && thread.creatorId !== userId) {
      return c.json({ error: "Only thread creator can delete private threads" }, 403);
    }

    // If thread is shared, verify user is a member of the chat
    if (thread.isShared) {
      const { data: membership } = await db
        .from("chat_member")
        .select("*")
        .eq("chatId", thread.chatId)
        .eq("userId", userId)
        .single();

      if (!membership) {
        return c.json({ error: "User not a member of this chat" }, 403);
      }
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

