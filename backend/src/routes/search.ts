import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { globalSearchRequestSchema, globalSearchResponseSchema } from "../../../shared/contracts";
import { db } from "../db";
import type { AppType } from "../index";
import { decryptMessages } from "../services/message-encryption";

const search = new Hono<AppType>();

// POST /api/search/global - Unified Global Search
search.post("/global", zValidator("json", globalSearchRequestSchema), async (c) => {
  const { query, userId, limit = 20, chatId } = c.req.valid("json");

  if (!query || query.trim().length === 0) {
    return c.json({ chats: [], users: [], messages: [] });
  }

  const trimmedQuery = query.trim();
  const ilikeQuery = `%${trimmedQuery}%`;

  try {
    // 1. Search Chats (skip if chatId is provided, we are searching INSIDE a chat)
    let chats: any[] = [];
    if (!chatId) {
        const chatsResult = await db
        .from("chat")
        .select(`
            *,
            chat_member!inner(userId),
            members:chat_member(count)
        `)
        .eq("chat_member.userId", userId)
        .ilike("name", ilikeQuery)
        .limit(5);

        chats = (chatsResult.data || []).map((chat: any) => ({
        ...chat,
        memberCount: chat.members?.[0]?.count || 0,
        isCreator: chat.creatorId === userId,
        // Default optional fields
        lastMessage: null,
        lastMessageAt: null
        }));
    }

    // 2. Search Users (skip if chatId is provided)
    let users: any[] = [];
    if (!chatId) {
        const usersResult = await db
        .from("user")
        .select("*")
        .neq("id", userId)
        .or(`name.ilike.${ilikeQuery},phone.ilike.${ilikeQuery}`)
        .limit(5);
        users = usersResult.data || [];
    }

    // 3. Search Messages (using optimized full-text search)
    // If chatId is provided, we filter by it. Otherwise, we fetch all user's chats.
    let filterChatIds: string[] = [];
    
    if (chatId) {
        filterChatIds = [chatId];
    } else {
        const userChatsResult = await db
        .from("chat_member")
        .select("chatId")
        .eq("userId", userId);
        filterChatIds = userChatsResult.data?.map(c => c.chatId) || [];
    }

    // Now run message search restricted to these chats
    const { data: messagesData, error: messagesError } = await db.rpc("search_messages_text", {
      search_query: trimmedQuery,
      match_count: limit,
      filter_user_id: null,
      filter_chat_ids: filterChatIds, 
      filter_message_types: null,
      filter_date_from: null,
      filter_date_to: null
    });

    // We need to enrich messages with sender user and chat info for the UI
    let enrichedMessages: any[] = [];
    if (messagesData && messagesData.length > 0) {
      // Fetch full message details + user + chat for the found IDs
      const messageIds = messagesData.map((m: any) => m.id);
      
      const { data: fullMessages } = await db
        .from("message")
        .select(`
          *,
          user:userId (*),
          chat:chatId (id, name, image)
        `)
        .in("id", messageIds);

      // CRITICAL: Decrypt messages before returning them
      const decryptedMessages = await decryptMessages(fullMessages || []);

      // Sort back by rank/relevance from the RPC result
      if (decryptedMessages && decryptedMessages.length > 0) {
        const messageMap = new Map(decryptedMessages.map(m => [m.id, m]));
        enrichedMessages = messagesData
          .map((m: any) => {
            const fullMsg = messageMap.get(m.id);
            if (!fullMsg) return null;
            return {
              message: fullMsg,
              chat: fullMsg.chat,
              similarity: m.rank, // Use text search rank
              matchedField: "content"
            };
          })
          .filter(Boolean);
      }
    }

    return c.json({
      chats: chats,
      users: users,
      messages: enrichedMessages
    });

  } catch (error) {
    console.error("Global search error:", error);
    return c.json({ chats: [], users: [], messages: [] }, 500);
  }
});

export default search;

