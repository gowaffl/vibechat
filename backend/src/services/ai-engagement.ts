/**
 * AI Engagement Service
 *
 * This service handles automatic AI engagement in chat conversations.
 * It uses Supabase Realtime to listen for new messages instantly,
 * calculates engagement probability based on context, and
 * uses distributed locks to ensure safe concurrent execution.
 */

import { db } from "../db";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  acquireAIResponseLock,
  releaseAIResponseLock,
  isInCooldown,
  updateLastResponseTime,
} from "./ai-locks";
import { executeGPT51Response } from "./gpt-responses";
import { saveResponseImages } from "./image-storage";
import { tagMessage } from "./message-tagger";
import {
  getSafetySystemPrompt,
  filterAIOutput,
  logSafetyEvent,
} from "./content-safety";
import { setAITypingStatus } from "../routes/chats";
import { decryptMessages, decryptMessageContent } from "./message-encryption";

// Subscription reference to keep connection alive
let engagementSubscription: RealtimeChannel | null = null;

/**
 * Calculate weighted engagement probability based on context
 */
function calculateEngagementProbability(
  basePercent: number,
  recentMessageCount: number,
  timeSinceLastAIResponse: number,
  messageContent: string,
  timeSinceLastActivity: number
): number {
  let probability = basePercent;
  
  // Activity boost: +10% for every 3 messages in the last batch (capped at 30%)
  probability += Math.min(30, Math.floor(recentMessageCount / 3) * 10);
  
  // Recency penalty: -20% if AI responded very recently (within 5 mins)
  if (timeSinceLastAIResponse < 5 * 60 * 1000 && timeSinceLastAIResponse > 0) {
    probability -= 20;
  }
  
  // Direct question boost: +30% if message ends with a question mark
  if (messageContent && messageContent.trim().endsWith('?')) {
    probability += 30;
  }
  
  // Staleness boost: +15% if this is the first message after 30+ mins of silence
  // (Helping to revive dead conversations)
  if (timeSinceLastActivity > 30 * 60 * 1000) {
    probability += 15;
  }
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, probability));
}

/**
 * Check if message contains @ai mention
 */
function containsAIMention(content: string, aiName: string): boolean {
  if (!content) return false;
  const normalizedContent = content.toLowerCase();
  const normalizedAiName = aiName.toLowerCase();

  // Check for @ai or @[ai name]
  return (
    normalizedContent.includes("@ai") ||
    normalizedContent.includes(`@${normalizedAiName}`)
  );
}

/**
 * Generate AI response for a message using a specific AI friend
 */
async function generateAIResponse(chatId: string, triggerMessageId: string, aiFriendId: string): Promise<void> {
  const requestId = `auto-${chatId}-${Date.now()}`;
  console.log(`[AI Engagement] [${requestId}] Auto-engagement triggered for chat ${chatId}, triggered by message ${triggerMessageId}, AI friend ${aiFriendId}`);
  
  // RACE CONDITION PREVENTION: Acquire distributed lock
  if (!await acquireAIResponseLock(chatId)) {
    console.log(`[AI Engagement] [${requestId}] ❌ BLOCKED: Lock already held for chat ${chatId} - response already in progress`);
    return;
  }

  try {
    console.log(`[AI Engagement] [${requestId}] ✅ Lock acquired successfully for chat ${chatId}`);

    // Double check cooldown (DB based now)
    if (await isInCooldown(chatId)) {
      console.log(`[AI Engagement] [${requestId}] ❌ BLOCKED: Chat is in cooldown`);
      return;
    }

    // Get the specific AI friend with chat details
    const { data: aiFriend } = await db
      .from("ai_friend")
      .select(`
        *,
        chat:chatId (*)
      `)
      .eq("id", aiFriendId)
      .single();

    if (!aiFriend) {
      console.error(`[AI Engagement] AI friend ${aiFriendId} not found`);
      return;
    }

    const chat = Array.isArray(aiFriend.chat) ? aiFriend.chat[0] : aiFriend.chat;

    // Fetch last 50 messages for context
    const { data: allMessages } = await db
      .from("message")
      .select(`
        *,
        user:userId (*)
      `)
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(50);

    // Decrypt any encrypted messages
    const decryptedMessages = await decryptMessages(allMessages || []);

    // Reverse to get chronological order
    const messagesInOrder = decryptedMessages.reverse().map((msg: any) => ({
      ...msg,
      user: Array.isArray(msg.user) ? msg.user[0] : msg.user,
    }));

    // Verify last message isn't from AI (check DB again to be safe)
    const lastMsg = messagesInOrder[messagesInOrder.length - 1];
    if (lastMsg && lastMsg.aiFriendId) {
       console.log(`[AI Engagement] [${requestId}] ❌ BLOCKED: Last message is from AI. Aborting.`);
       return;
    }

    // Get AI name
    const aiName = aiFriend.name || "AI Friend";

    // Extract unique participant names
    const uniqueParticipants = Array.from(
      new Set(messagesInOrder.map((msg) => msg.user?.name).filter((name) => name && name !== aiName && name !== "AI Friend"))
    );
    const participantList = uniqueParticipants.join(", ");

    // Build personality instructions
    let personalityInstruction = "";
    if (aiFriend.personality) {
      personalityInstruction = `\n\nYour personality traits: ${aiFriend.personality}`;
    }

    let toneInstruction = "";
    if (aiFriend.tone) {
      toneInstruction = `\nYour conversational tone: ${aiFriend.tone}`;
    }

    // Analyze conversation flow
    const currentTime = new Date();
    const recentMessages = messagesInOrder.slice(-10);
    const lastFiveMessages = messagesInOrder.slice(-5);

    // Helper to format link context
    const formatLinkContext = (msg: any): string => {
      if (msg.linkPreviewTitle || msg.linkPreviewDescription) {
        const title = msg.linkPreviewTitle || msg.linkPreviewSiteName || "Link";
        const desc = msg.linkPreviewDescription ? ` - ${msg.linkPreviewDescription.substring(0, 100)}` : "";
        return ` [Link: "${title}"${desc}]`;
      }
      return "";
    };

    // Format context
    const recentContextText = lastFiveMessages
      .map((msg) => {
        const userName = msg.user?.name || "Unknown";
        const timeAgo = Math.floor((currentTime.getTime() - new Date(msg.createdAt).getTime()) / 1000);
        const timeDesc = timeAgo < 60 ? "just now" : timeAgo < 300 ? "a few minutes ago" : "earlier";
        const linkContext = formatLinkContext(msg);

        if (msg.messageType === "image" && msg.imageDescription) {
          return `${userName} (${timeDesc}): [shared image: ${msg.imageDescription}]${msg.content ? ` "${msg.content}"` : ""}${linkContext}`;
        } else if (msg.messageType === "image") {
          return `${userName} (${timeDesc}): [shared an image]${msg.content ? ` "${msg.content}"` : ""}${linkContext}`;
        }
        return `${userName} (${timeDesc}): "${msg.content}"${linkContext}`;
      })
      .join("\n");

    const earlierContext = recentMessages.slice(0, -5);
    const earlierContextText = earlierContext.length > 0
      ? earlierContext
          .map((msg) => {
            const userName = msg.user?.name || "Unknown";
            const linkContext = formatLinkContext(msg);
            
            if (msg.messageType === "image" && msg.imageDescription) {
              return `${userName}: [shared image: ${msg.imageDescription}]${msg.content ? ` "${msg.content}"` : ""}${linkContext}`;
            } else if (msg.messageType === "image") {
              return `${userName}: [shared an image]${msg.content ? ` "${msg.content}"` : ""}${linkContext}`;
            }
            return `${userName}: "${msg.content}"${linkContext}`;
          })
          .join("\n")
      : "";

    // Safety instructions
    const safetyInstructions = getSafetySystemPrompt(false);

    // System Prompt
    const systemPrompt = `${safetyInstructions}

You are ${aiName}, a friend in this group chat. You're part of the conversation naturally - think of yourself as another person in the group, not a formal AI friend.

# Chat Context
Group: "${chat.name}"${chat.bio ? `\nAbout: ${chat.bio}` : ""}
Friends in chat: ${participantList}${personalityInstruction}${toneInstruction}

# How to Act Naturally

**Think like a friend texting:**
- Be concise and natural (1-2 sentences usually, like how friends text)
- Read the room. What's the vibe? Match the energy.
- Use casual language: contractions, natural phrasing
- React authentically - you don't need to be overly helpful
- If you're not sure, be honest

**Conversation Flow:**
- Focus on the last 2-3 messages - that's what's happening RIGHT NOW
- Don't respond to everything. Sometimes conversations don't need your input
- If someone's making a point across multiple messages, let them finish

**When NOT to respond:**
- Single word responses from others ("ok", "cool", "lol")
- People clearly talking 1-on-1
- The topic doesn't relate to you
- You have nothing valuable to add

**When TO respond:**
- Someone's stuck or confused and you can help
- There's a direct question
- You have a genuine reaction or insight
- The topic is something you can meaningfully contribute to

**Response Style:**
- Keep it short and conversational (like texting a friend)
- Start naturally: "oh yeah," "totally," "wait," "hmm," "nah"
- Show personality, be authentic
- Use the person's name casually if responding to them
- NEVER announce what you're doing - don't say "I'll jump in" or "I'll stay quiet" or explain your participation. Just talk naturally in the flow of conversation.

# Current Conversation

${earlierContextText ? `Earlier:\n${earlierContextText}\n\n` : ""}Right now:
${recentContextText}

Respond naturally to what's happening in the conversation. Keep it brief and real.`;

    const userInput = `What would you naturally say here? Keep it brief and conversational.`;

    const tools: any[] = [
      { type: "web_search" },
      { type: "image_generation" },
      { type: "code_interpreter", container: { type: "auto" } },
    ];

    // Set AI typing status BEFORE calling GPT
    setAITypingStatus(chatId, aiFriendId, true, aiName, aiFriend.color || "#14B8A6");
    console.log(`[AI Engagement] [${requestId}] 💬 AI typing indicator set for ${aiName}`);

    console.log("[AI Engagement] Calling GPT-5.1 Responses API with hosted tools...");
    const response = await executeGPT51Response({
      systemPrompt,
      userPrompt: userInput,
      tools,
      reasoningEffort: "none",
      temperature: 1,
      maxTokens: 2048,
    });

    const savedImageUrls = await saveResponseImages(response.images, "ai-auto");
    const primaryImageUrl = savedImageUrls[0] ?? null;
    let aiResponseText = response.content?.trim() || "";

    // Filter AI output
    if (aiResponseText) {
      const outputFilter = filterAIOutput(aiResponseText);
      if (outputFilter.wasModified) {
        aiResponseText = outputFilter.filtered;
        logSafetyEvent("filtered", { chatId, flags: ["output_filtered_auto_engagement"] });
      }
    }

    if (!aiResponseText && !primaryImageUrl) {
      console.log("[AI Engagement] AI decided not to respond (empty response)");
      return;
    }

    // Final check for race conditions
    const { data: finalCheck } = await db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (finalCheck && finalCheck.aiFriendId) {
      console.log(`[AI Engagement] [${requestId}] ⚠️ RACE CONDITION: Last message is from AI. Aborting.`);
      return;
    }

    console.log(`[AI Engagement] [${requestId}] ✅ Saving AI message...`);

    const { data: aiMessage, error: insertError } = await db
      .from("message")
      .insert({
        content: aiResponseText || "Generated image attached.",
        messageType: primaryImageUrl ? "image" : "text",
        imageUrl: primaryImageUrl,
        userId: null,
        chatId: chatId,
        aiFriendId: aiFriendId,
      })
      .select()
      .single();

    if (insertError || !aiMessage) {
      console.error(`[AI Engagement] [${requestId}] Failed to create message:`, insertError);
      return;
    }

    // Auto-tag
    if (aiResponseText && aiResponseText.trim().length > 0) {
      tagMessage(aiMessage.id, aiResponseText).catch(error => {
        console.error(`[AI Engagement] Failed to tag message ${aiMessage.id}:`, error);
      });
    }

    // Update last response time for this friend/chat
    await updateLastResponseTime(chatId, aiFriendId);

    // Clear AI typing status after message is saved
    setAITypingStatus(chatId, aiFriendId, false);
    console.log(`[AI Engagement] [${requestId}] 💬 AI typing indicator cleared for ${aiName}`);

    console.log(`[AI Engagement] AI response saved for chat ${chatId}`);
  } catch (error) {
    console.error("[AI Engagement] Error generating AI response:", error);
    // Clear typing status on error as well
    setAITypingStatus(chatId, aiFriendId, false);
  } finally {
    await releaseAIResponseLock(chatId);
  }
}

/**
 * Handle a new message event from Realtime
 */
async function handleNewMessage(payload: any) {
  const { chatId, id: messageId, content, userId, createdAt, is_encrypted } = payload.new || payload;
  
  if (!chatId || !content) return;

  // Skip if we can't verify parameters
  if (!userId) {
    // Sometimes payload structure varies, try to fetch if needed
    // But usually payload.new has the row
  }

  console.log(`[AI Engagement] Processing new message ${messageId} in chat ${chatId}`);

  // Decrypt message content if needed
  let decryptedContent = content;
  if (is_encrypted) {
    try {
      const decryptedMessage = await decryptMessageContent({
        id: messageId,
        content: content,
        is_encrypted: is_encrypted,
      });
      decryptedContent = decryptedMessage.content || content;
      console.log(`[AI Engagement] Decrypted message content for engagement processing`);
    } catch (error) {
      console.error(`[AI Engagement] Failed to decrypt message ${messageId}:`, error);
      // Continue with original content as fallback
    }
  }

  // 1. Check Cooldown First
  if (await isInCooldown(chatId)) {
    console.log(`[AI Engagement] Chat ${chatId} is in cooldown, skipping`);
    return;
  }

  // 2. Get AI Friends for this chat
  const { data: aiFriends } = await db
    .from("ai_friend")
    .select("*")
    .eq("chatId", chatId)
    .order("sortOrder", { ascending: true });

  if (!aiFriends || aiFriends.length === 0) return;

  // 3. Check for Mentions (Skip if mentioned, frontend handles it) - Use DECRYPTED content
  let hasMention = false;
  for (const friend of aiFriends) {
    if (containsAIMention(decryptedContent, friend.name)) {
      hasMention = true;
      break;
    }
  }

  if (hasMention) {
    console.log(`[AI Engagement] Skipping mention in chat ${chatId} - handled by frontend`);
    return;
  }

  // 4. Check qualifying friends based on Smart Probability
  const qualifyingFriends: any[] = [];
  
  // We need some stats for probability calculation
  // Let's get recent message count and time since last activity
  const { count: recentCount } = await db
    .from("message")
    .select("*", { count: "exact", head: true })
    .eq("chatId", chatId)
    .gt("createdAt", new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Last 10 mins

  // Calculate time since last activity (roughly, based on this message vs previous)
  // We can assume "now" vs "createdAt" of this message is negligible for realtime
  // But we might want to know the gap BEFORE this message.
  // For simplicity, we'll use the timestamp of the message before this one.
  const { data: prevMessage } = await db
    .from("message")
    .select("createdAt")
    .eq("chatId", chatId)
    .lt("createdAt", createdAt)
    .order("createdAt", { ascending: false })
    .limit(1)
    .single();

  const timeSinceLastActivity = prevMessage 
    ? new Date(createdAt).getTime() - new Date(prevMessage.createdAt).getTime()
    : 0;

  for (const friend of aiFriends) {
    if (friend.engagementMode === "percentage" && friend.engagementPercent !== null) {
      
      const timeSinceLastAIResponse = friend.last_response_at 
        ? Date.now() - new Date(friend.last_response_at).getTime()
        : 1000000; // Long time ago

      const probability = calculateEngagementProbability(
        friend.engagementPercent,
        recentCount || 0,
        timeSinceLastAIResponse,
        decryptedContent,
        timeSinceLastActivity
      );

      console.log(`[AI Engagement] Friend ${friend.name}: Probability calculated: ${probability}% (Base: ${friend.engagementPercent}%)`);

      // Roll the dice
      const roll = Math.random() * 100;
      if (roll < probability) {
        qualifyingFriends.push(friend);
      }
    }
  }

  // 5. Select one and engage
  if (qualifyingFriends.length > 0) {
    const selectedFriend = qualifyingFriends[Math.floor(Math.random() * qualifyingFriends.length)];
    console.log(`[AI Engagement] 🎲 Winner: ${selectedFriend.name} for chat ${chatId}`);
    
    // Fire and forget response generation (it handles locking)
    generateAIResponse(chatId, messageId, selectedFriend.id).catch(err => {
      console.error("[AI Engagement] Background generation failed:", err);
    });
  }
}

/**
 * Start the AI engagement service (Realtime Listener)
 */
export function startAIEngagementService() {
  console.log("[AI Engagement] Starting Realtime engagement service...");

  // Unsubscribe if existing
  if (engagementSubscription) {
    engagementSubscription.unsubscribe();
  }

  // Subscribe to INSERT events on the message table
  engagementSubscription = db
    .channel('ai-engagement-service')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message',
      },
      (payload) => {
        // Only process user messages, not AI messages or system messages
        // payload.new contains the new record
        const newMsg = payload.new as any;
        
        if (newMsg && !newMsg.aiFriendId && newMsg.messageType !== 'system') {
          handleNewMessage(payload).catch(error => {
            console.error(`[AI Engagement] Error processing message ${newMsg.id}:`, error);
          });
        }
      }
    )
    .subscribe((status) => {
      console.log(`[AI Engagement] Subscription status: ${status}`);
    });
    
  console.log("[AI Engagement] Listening for new messages...");
}
