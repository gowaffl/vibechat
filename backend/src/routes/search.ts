import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { globalSearchRequestSchema, globalSearchResponseSchema } from "../../../shared/contracts";
import { db } from "../db";
import type { AppType } from "../index";
import { decryptMessages } from "../services/message-encryption";
import { generateEmbedding } from "../services/embeddings";

const search = new Hono<AppType>();

/**
 * Calculate recency multiplier using exponential decay
 * Recent messages are naturally more relevant to ongoing conversations
 * 
 * @param createdAt - ISO timestamp of message creation
 * @returns Multiplier between 0.1 and 1.0
 * 
 * Examples:
 * - 1 day old = 1.0x (full relevance)
 * - 1 week old = 0.8x
 * - 2 weeks old = 0.5x (half-life)
 * - 1 month old = 0.35x
 * - 1 year old = 0.1x (minimum floor)
 */
function calculateRecencyMultiplier(createdAt: string): number {
  const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const halfLife = 14; // Messages "half as relevant" after 2 weeks
  return Math.max(0.1, Math.exp(-0.693 * ageInDays / halfLife));
}

// POST /api/search/global - Unified Global Search
search.post("/global", zValidator("json", globalSearchRequestSchema), async (c) => {
  const { query, userId, limit = 20, chatId, mode = "hybrid" } = c.req.valid("json");

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

    // 3. Search Messages (using text search, semantic search, or hybrid)
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

    // Collect results from both search types
    const textResults = new Map<string, { rank: number; createdAt: string }>();
    const semanticResults = new Map<string, { similarity: number; createdAt: string }>();

    const runSemanticSearch = ["semantic", "hybrid"].includes(mode);
    const runTextSearch = ["text", "hybrid"].includes(mode);

    // Run Semantic Search if enabled
    if (runSemanticSearch) {
      console.log(`🧠 [Global Search] Semantic search for: "${trimmedQuery}"`);
      try {
        const queryEmbedding = await generateEmbedding(trimmedQuery);
        
        const { data: matches, error: matchError } = await db.rpc("match_messages", {
          query_embedding: queryEmbedding,
          match_threshold: 0.5, // Increased threshold for quality matches only
          match_count: limit * 2,
          filter_user_id: null,
          filter_chat_ids: filterChatIds,
          filter_message_types: null,
          filter_date_from: null,
          filter_date_to: null,
        });

        if (matchError) {
          console.error("[Global Search] Semantic match error:", matchError);
        } else if (matches) {
          for (const m of matches) {
            semanticResults.set(m.id, { similarity: m.similarity, createdAt: m.createdAt });
          }
          console.log(`✅ Semantic: ${matches.length} matches (threshold: 0.5)`);
        }
      } catch (embError) {
        console.error("[Global Search] Embedding generation error:", embError);
      }
    }

    // Run Text Search if enabled
    if (runTextSearch) {
      console.log(`🔍 [Global Search] Text search for: "${trimmedQuery}"`);
      
      const { data: textMatches, error: searchError } = await db.rpc("search_messages_text", {
        search_query: trimmedQuery,
        match_count: limit * 2,
        filter_user_id: null,
        filter_chat_ids: filterChatIds,
        filter_message_types: null,
        filter_date_from: null,
        filter_date_to: null,
      });

      if (searchError) {
        console.error("[Global Search] Text search error:", searchError);
      } else if (textMatches) {
        for (const m of textMatches) {
          textResults.set(m.id, { rank: m.rank, createdAt: m.createdAt });
        }
        console.log(`✅ Text: ${textMatches.length} matches`);
      }
    }

    // Combine results with balanced hybrid scoring
    const combinedResults = new Map<string, { id: string; score: number; createdAt: string; textRank?: number; semanticScore?: number }>();
    
    // Weights for hybrid scoring
    const TEXT_WEIGHT = 0.6;      // 60% weight for exact text matches
    const SEMANTIC_WEIGHT = 0.4;  // 40% weight for semantic similarity

    // Process all unique message IDs
    const allMessageIds = new Set([...textResults.keys(), ...semanticResults.keys()]);
    
    for (const messageId of allMessageIds) {
      const textMatch = textResults.get(messageId);
      const semanticMatch = semanticResults.get(messageId);
      
      // Normalize scores to 0-1 range (text rank already 0-1, semantic similarity is 0-1)
      const textRank = textMatch?.rank || 0;
      const semanticScore = semanticMatch?.similarity || 0;
      
      // Calculate weighted hybrid score
      let hybridScore = (textRank * TEXT_WEIGHT) + (semanticScore * SEMANTIC_WEIGHT);
      
      // Boost for perfect matches (high in both text and semantic)
      if (textRank > 0.8 && semanticScore > 0.7) {
        hybridScore *= 1.5; // 50% boost for messages that match both ways
        console.log(`🎯 Perfect match bonus for message ${messageId.substring(0, 8)}`);
      }
      
      // Apply recency decay
      const createdAt = textMatch?.createdAt || semanticMatch?.createdAt || new Date().toISOString();
      const recencyMultiplier = calculateRecencyMultiplier(createdAt);
      const finalScore = hybridScore * recencyMultiplier;
      
      combinedResults.set(messageId, {
        id: messageId,
        score: finalScore,
        createdAt,
        textRank,
        semanticScore
      });
    }
    
    console.log(`📊 Combined: ${combinedResults.size} unique messages`);

    // Sort and paginate results
    // Sort by final score only (recency already baked into score)
    let allResults = Array.from(combinedResults.values());
    allResults.sort((a, b) => b.score - a.score);
    
    // Apply limit
    const paginatedResults = allResults.slice(0, limit);
    const resultIds = paginatedResults.map(r => r.id);

    // Fetch and enrich messages
    let enrichedMessages: any[] = [];
    if (resultIds.length > 0) {
      const { data: fullMessages } = await db
        .from("message")
        .select(`
          *,
          user:userId (*),
          chat:chatId (id, name, image)
        `)
        .in("id", resultIds);

      // CRITICAL: Decrypt messages before returning them
      const decryptedMessages = await decryptMessages(fullMessages || []);

      if (decryptedMessages && decryptedMessages.length > 0) {
        const messageMap = new Map(decryptedMessages.map(m => [m.id, m]));
        enrichedMessages = paginatedResults
          .map((r: any) => {
            const fullMsg = messageMap.get(r.id);
            if (!fullMsg) return null;
            return {
              message: fullMsg,
              chat: fullMsg.chat,
              similarity: r.score, // Final score with recency applied
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

