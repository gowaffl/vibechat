import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { globalSearchRequestSchema, globalSearchResponseSchema } from "../../../shared/contracts";
import { db } from "../db";
import type { AppType } from "../index";
import { decryptMessages } from "../services/message-encryption";
import { generateEmbedding } from "../services/embeddings";

const search = new Hono<AppType>();

// POST /api/search/global - Unified Global Search
search.post("/global", zValidator("json", globalSearchRequestSchema), async (c) => {
  const { query, userId, limit = 20, chatId, mode = "hybrid" } = c.req.valid("json");

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:13',message:'Search request received',data:{query,userId,limit,chatId,mode},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
  // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:72',message:'Filter chat IDs prepared',data:{filterChatIds,chatIdCount:filterChatIds.length,isSingleChat:!!chatId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // Prepare to collect and merge results
    const matchMap = new Map<string, { id: string; score: number; createdAt: string; similarity?: number; rank?: number }>();
    
    const addMatch = (
      id: string, 
      score: number, 
      createdAt: string,
      similarity?: number, 
      rank?: number
    ) => {
      const existing = matchMap.get(id);
      if (existing) {
        // If already exists, boost score (hybrid match)
        existing.score += score; 
        if (similarity && (!existing.similarity || similarity > existing.similarity)) {
          existing.similarity = similarity;
        }
        if (rank && (!existing.rank || rank > existing.rank)) {
          existing.rank = rank;
        }
      } else {
        matchMap.set(id, { id, score, createdAt, similarity, rank });
      }
    };

    const runSemanticSearch = ["semantic", "hybrid"].includes(mode);
    const runTextSearch = ["text", "hybrid"].includes(mode);

    // Run Semantic Search if enabled
    if (runSemanticSearch) {
      console.log(`🧠 [Global Search] Semantic search for: "${trimmedQuery}"`);
      try {
        const queryEmbedding = await generateEmbedding(trimmedQuery);
        
        const { data: matches, error: matchError } = await db.rpc("match_messages", {
          query_embedding: queryEmbedding,
          match_threshold: 0.25,
          match_count: limit * 2,
          filter_user_id: null,
          filter_chat_ids: filterChatIds,
          filter_message_types: null,
          filter_date_from: null,
          filter_date_to: null,
        });

        if (matchError) {
          console.error("[Global Search] Semantic match error:", matchError);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:119',message:'Semantic search error',data:{error:matchError.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        } else if (matches) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:124',message:'Semantic search results',data:{matchCount:matches?.length || 0,sampleIds:matches?.slice(0,3).map((m:any)=>m.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D'})}).catch(()=>{});
          // #endregion
          for (const m of matches) {
            // Semantic score 0-10
            addMatch(m.id, m.similarity * 10, m.createdAt, m.similarity); 
          }
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:146',message:'Text search error',data:{error:searchError.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } else if (textMatches) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:151',message:'Text search results',data:{matchCount:textMatches?.length || 0,sampleIds:textMatches?.slice(0,3).map((m:any)=>m.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
        // #endregion
        for (const m of textMatches) {
          // Text rank is usually 0.1-1.0. Multiply by 20 for weighting
          const rankScore = (m.rank || 0.1) * 20;
          addMatch(m.id, rankScore, m.createdAt, undefined, m.rank);
        }
      }
    }

    // Sort and paginate results
    let allResults = Array.from(matchMap.values());
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:163',message:'Merged results before sorting',data:{totalMatches:allResults.length,sampleIds:allResults.slice(0,3).map(r=>r.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // Sort by createdAt DESC (recency first)
    allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:179',message:'Full messages fetched',data:{requestedIds:resultIds.length,fetchedCount:fullMessages?.length || 0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // CRITICAL: Decrypt messages before returning them
      const decryptedMessages = await decryptMessages(fullMessages || []);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:186',message:'Messages decrypted',data:{decryptedCount:decryptedMessages?.length || 0,sampleContent:decryptedMessages?.[0]?.content?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      if (decryptedMessages && decryptedMessages.length > 0) {
        const messageMap = new Map(decryptedMessages.map(m => [m.id, m]));
        enrichedMessages = paginatedResults
          .map((r: any) => {
            const fullMsg = messageMap.get(r.id);
            if (!fullMsg) return null;
            return {
              message: fullMsg,
              chat: fullMsg.chat,
              similarity: r.similarity || r.rank, // Use semantic similarity or text rank
              matchedField: "content"
            };
          })
          .filter(Boolean);
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46a05f2d-60bc-49f4-9932-8a6a3fb39c17',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'search.ts:207',message:'Final response prepared',data:{chatCount:chats.length,userCount:users.length,messageCount:enrichedMessages.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion

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

