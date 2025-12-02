/**
 * AI Engagement Service
 *
 * This service handles automatic AI engagement in chat conversations based on
 * the configured engagement mode and percentage. It runs in the background
 * and periodically checks for new messages that the AI should respond to.
 */

import { db } from "../db";
import {
  acquireAIResponseLock,
  releaseAIResponseLock,
  acquireChatProcessingLock,
  releaseChatProcessingLock,
  isInCooldown,
  updateLastResponseTime,
  lastProcessedMessageId,
} from "./ai-locks";
import { executeGPT51Response } from "./gpt-responses";
import { saveResponseImages } from "./image-storage";
import { tagMessage } from "./message-tagger";

/**
 * Check if AI should engage based on engagement settings
 */
function shouldAIEngage(mode: string, percent: number | null): boolean {
  if (mode === "off") return false;
  if (mode === "on-call") return false; // Only respond to @ai mentions
  if (mode === "percentage" && percent !== null) {
    // Generate random number 0-100 and check if it's less than the percentage
    const roll = Math.random() * 100;
    return roll < percent;
  }
  return false;
}

/**
 * Check if message contains @ai mention
 */
function containsAIMention(content: string, aiName: string): boolean {
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
  
  // RACE CONDITION PREVENTION: Acquire lock using shared lock module
  // If lock acquisition fails, another response is already in progress
  if (!acquireAIResponseLock(chatId)) {
    console.log(`[AI Engagement] [${requestId}] ❌ BLOCKED: Lock already held for chat ${chatId} - response already in progress`);
    return;
  }

  try {
    console.log(`[AI Engagement] [${requestId}] ✅ Lock acquired successfully for chat ${chatId}`);

    // CRITICAL: Check if last message is from AI BEFORE doing anything else
    // This is the FIRST check after acquiring the lock
    const { data: lastMessageCheck } = await db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    // AI messages are identified by having an aiFriendId (not by userId)
    if (lastMessageCheck && lastMessageCheck.aiFriendId) {
      console.log(`[AI Engagement] [${requestId}] ❌ BLOCKED: Last message in chat ${chatId} is already from AI (messageId: ${lastMessageCheck.id}, aiFriendId: ${lastMessageCheck.aiFriendId}). AI cannot send consecutive messages.`);
      return;
    }

    console.log(`[AI Engagement] [${requestId}] ✅ Last message check passed. Last message from: userId=${lastMessageCheck?.userId || "none"}, aiFriendId=${lastMessageCheck?.aiFriendId || "none"}`);


    // Check cooldown - prevent AI from responding too frequently
    if (isInCooldown(chatId)) {
      return;
    }

    // Get the specific AI friend with chat
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

    // Fetch last 100 messages from this chat
    const { data: allMessages } = await db
      .from("message")
      .select(`
        *,
        user:userId (*)
      `)
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(100);

    // Reverse to get chronological order
    const messagesInOrder = (allMessages || []).reverse().map((msg: any) => ({
      ...msg,
      user: Array.isArray(msg.user) ? msg.user[0] : msg.user,
    }));

    // Get AI name from AI friend (not chat)
    const aiName = aiFriend.name || "AI Friend";

    // Extract unique participant names (exclude AI name and check for null user)
    const uniqueParticipants = Array.from(
      new Set(messagesInOrder.map((msg) => msg.user?.name).filter((name) => name && name !== aiName && name !== "AI Friend"))
    );
    const participantList = uniqueParticipants.join(", ");

    // Build custom personality instruction if provided (from AI friend, not chat)
    let personalityInstruction = "";
    if (aiFriend.personality) {
      personalityInstruction = `\n\nYour personality traits: ${aiFriend.personality}`;
    }

    // Build tone instruction if provided (from AI friend, not chat)
    let toneInstruction = "";
    if (aiFriend.tone) {
      toneInstruction = `\nYour conversational tone: ${aiFriend.tone}`;
    }

    // Analyze conversation recency and flow
    const currentTime = new Date();
    const lastMessage = messagesInOrder[messagesInOrder.length - 1];
    const timeSinceLastMessage = lastMessage ? (currentTime.getTime() - new Date(lastMessage.createdAt).getTime()) / 1000 : 0;

    // Get last 10 messages with more weight on recent ones
    const recentMessages = messagesInOrder.slice(-10);
    const lastFiveMessages = messagesInOrder.slice(-5);

    // Helper function to format link preview context
    const formatLinkContext = (msg: any): string => {
      if (msg.linkPreviewTitle || msg.linkPreviewDescription) {
        const title = msg.linkPreviewTitle || msg.linkPreviewSiteName || "Link";
        const desc = msg.linkPreviewDescription ? ` - ${msg.linkPreviewDescription.substring(0, 100)}` : "";
        return ` [Link: "${title}"${desc}]`;
      }
      return "";
    };

    // Format recent conversation context
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

    // Format earlier context (messages 5-10 from the end) - include image/link context
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

    // Create an enhanced, natural system prompt
    const systemPrompt = `You are ${aiName}, a friend in this group chat. You're part of the conversation naturally - think of yourself as another person in the group, not a formal AI friend.

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

# Current Conversation

${earlierContextText ? `Earlier:\n${earlierContextText}\n\n` : ""}Right now:
${recentContextText}

Should you jump in? If yes, what would you naturally say as a friend? Keep it brief and real.`;

    // Construct a more natural user input
    const userInput = `Based on the conversation, should you respond? If yes, say something brief and natural. If not, stay quiet.`;

    const tools: any[] = [
      { type: "web_search" },
      { type: "image_generation" },
      { type: "code_interpreter", container: { type: "auto" } },
    ];

    console.log("[AI Engagement] Calling GPT-5.1 Responses API with hosted tools...");
    const response = await executeGPT51Response({
      systemPrompt,
      userPrompt: userInput,
      tools,
      reasoningEffort: "none",
      temperature: 1,
      maxTokens: 2048,
    });

    console.log(
      "[AI Engagement] Response received successfully with status:",
      response.status,
      "and",
      response.images.length,
      "image(s)"
    );

    const savedImageUrls = await saveResponseImages(response.images, "ai-auto");
    const primaryImageUrl = savedImageUrls[0] ?? null;
    const aiResponseText = response.content?.trim() || "";

    if (!aiResponseText && !primaryImageUrl) {
      console.log("[AI Engagement] AI decided not to respond (empty response)");
      return;
    }

    // CRITICAL DOUBLE-CHECK: Verify AGAIN that last message isn't from AI
    // This catches race conditions where an AI message was created between
    // the initial check and now (after OpenAI API call completed)
    console.log(`[AI Engagement] [${requestId}] Performing final check before saving AI message...`);
    const { data: finalCheck } = await db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    // AI messages are identified by having an aiFriendId (not by userId)
    if (finalCheck && finalCheck.aiFriendId) {
      console.log(`[AI Engagement] [${requestId}] ⚠️ RACE CONDITION DETECTED! Last message in chat ${chatId} is now from AI (messageId: ${finalCheck.id}, aiFriendId: ${finalCheck.aiFriendId}). Aborting to prevent duplicate.`);
      return;
    }

    console.log(`[AI Engagement] [${requestId}] ✅ Final check passed. Saving AI message to database...`);

    // Create the AI's message in the database with aiFriendId
    // NOTE: userId is set to null for AI messages - the aiFriendId identifies which AI sent it
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

    // Auto-tag AI message for smart threads (fire-and-forget, immediate)
    if (aiResponseText && aiResponseText.trim().length > 0) {
      tagMessage(aiMessage.id, aiResponseText).catch(error => {
        console.error(`[AI Engagement] Failed to tag message ${aiMessage.id}:`, error);
      });
    }

    // Update the last AI response time for this chat
    updateLastResponseTime(chatId);

    console.log(`[AI Engagement] AI response saved to database for chat ${chatId}`);
  } catch (error) {
    console.error("[AI Engagement] Error generating AI response:", error);
  } finally {
    // Always release the lock, even if there was an error
    releaseAIResponseLock(chatId);
  }
}

/**
 * Process new messages for a chat and determine if AI should engage
 */
async function processNewMessages(chatId: string): Promise<void> {
  // PREVENT CONCURRENT PROCESSING: If this chat is already being processed, skip it
  if (!acquireChatProcessingLock(chatId)) {
    console.log(`[AI Engagement] Chat ${chatId} is already being processed, skipping`);
    return;
  }

  try {
    // Get all AI friends for this chat
    const { data: aiFriends } = await db
      .from("ai_friend")
      .select("*")
      .eq("chatId", chatId)
      .order("sortOrder", { ascending: true });

    if (!aiFriends || aiFriends.length === 0) {
      console.log(`[AI Engagement] No AI friends found for chat ${chatId}`);
      return;
    }

    // Check if ANY AI friend has engagement enabled
    const hasEngagementEnabled = aiFriends.some(
      (friend) => friend.engagementMode === "percentage"
    );

    if (!hasEngagementEnabled) {
      return; // No AI friends have auto-engagement enabled
    }

    // Check if the last message in the chat is from the AI
    // If so, do NOT respond until a user sends a message
    const { data: lastMessage } = await db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    // AI messages are identified by having an aiFriendId (not by userId)
    if (lastMessage && lastMessage.aiFriendId) {
      console.log(`[AI Engagement] Last message in chat ${chatId} is from AI (aiFriendId: ${lastMessage.aiFriendId}). Waiting for user interaction.`);
      return;
    }

    // Get the last processed message ID for this chat
    const lastProcessed = lastProcessedMessageId.get(chatId);

    let query = db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .is("aiFriendId", null) // Don't respond to AI messages (identified by aiFriendId being set)
      .neq("messageType", "system") // Don't respond to system messages
      .order("createdAt", { ascending: true })
      .limit(10); // Process up to 10 new messages at a time

    // If we have a lastProcessed message, only get messages after it
    if (lastProcessed) {
      const { data: lastProcessedMsg } = await db
        .from("message")
        .select("createdAt")
        .eq("id", lastProcessed)
        .single();
      
      if (lastProcessedMsg?.createdAt) {
        query = query.gt("createdAt", lastProcessedMsg.createdAt);
      }
    } else {
      // INITIALIZATION CASE:
      // If we haven't processed this chat yet (e.g. server restart),
      // we only want to pick up messages from the last 2 minutes.
      // This prevents replying to old messages while ensuring we catch
      // "just sent" messages if the server just restarted.
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      query = query.gt("createdAt", twoMinutesAgo);
    }

    const { data: newMessages } = await query;

    if (!newMessages || newMessages.length === 0) {
      // If no new/recent messages found on init, we still need a cursor
      // to avoid querying "last 2 mins" forever.
      if (!lastProcessed) {
        const { data: latestMsg } = await db
          .from("message")
          .select("id")
          .eq("chatId", chatId)
          .order("createdAt", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (latestMsg) {
          console.log(`[AI Engagement] Initializing cursor for chat ${chatId} to latest message ${latestMsg.id}`);
          lastProcessedMessageId.set(chatId, latestMsg.id);
        }
      }
      return;
    }

    // Check each message for automatic engagement
    // NOTE: We deliberately SKIP @mentions here because they are handled
    // by the frontend's direct API call to /api/ai/chat. This prevents double responses.
    for (const message of newMessages) {
      // Update cursor as we process each message
      // This ensures that if we exit early (e.g. after responding), 
      // we resume from the correct spot next time
      lastProcessedMessageId.set(chatId, message.id);

      // Check if message contains any AI friend mentions
      let hasMention = false;
      for (const friend of aiFriends) {
        if (containsAIMention(message.content, friend.name)) {
          hasMention = true;
          break;
        }
      }

      // SKIP mentions - they're handled by the frontend to prevent double responses
      if (hasMention) {
        console.log(`[AI Engagement] Skipping AI friend mention in chat ${chatId} - handled by frontend`);
        continue; // Skip this message, continue to next
      }

      // Collect AI friends that qualify for auto-engagement on this message
      const qualifyingFriends: any[] = [];
      
      for (const friend of aiFriends) {
        // Check for automatic engagement based on percentage
        if (friend.engagementMode === "percentage" && friend.engagementPercent !== null) {
          if (shouldAIEngage(friend.engagementMode, friend.engagementPercent)) {
            qualifyingFriends.push(friend);
          }
        }
      }

      // If multiple AI friends qualify, select one randomly
      // This ensures only ONE AI friend responds per message
      if (qualifyingFriends.length > 0) {
        const selectedFriend = qualifyingFriends[Math.floor(Math.random() * qualifyingFriends.length)];
        console.log(`[AI Engagement] Automatic engagement triggered for chat ${chatId} with AI friend ${selectedFriend.name} (${selectedFriend.engagementPercent}% chance, ${qualifyingFriends.length} qualified)`);
        await generateAIResponse(chatId, message.id, selectedFriend.id);
        return; // Only respond once per polling cycle
      }
    }
  } catch (error) {
    console.log(`[AI Engagement] Error processing messages for chat ${chatId}:`, error);
  } finally {
    // Always release the processing lock
    releaseChatProcessingLock(chatId);
  }
}

/**
 * Main polling loop - checks all active chats for new messages
 */
export async function pollForEngagement() {
  try {
    // Get all chats that have at least one AI friend with engagement enabled
    const { data: aiFriendsWithEngagement } = await db
      .from("ai_friend")
      .select("chatId")
      .eq("engagementMode", "percentage");

    if (!aiFriendsWithEngagement || aiFriendsWithEngagement.length === 0) {
      return;
    }

    // Get unique chat IDs
    const uniqueChatIds = [...new Set(aiFriendsWithEngagement.map((af: any) => af.chatId))];

    // Process each chat
    for (const chatId of uniqueChatIds) {
      await processNewMessages(chatId);
    }
  } catch (error) {
    console.error("[AI Engagement] Error in polling loop:", error);
  }
}

/**
 * Start the AI engagement polling service
 * Polls every 5 seconds for new messages to engage with
 */
export function startAIEngagementService() {
  console.log("[AI Engagement] Starting AI engagement service...");

  // Poll every 5 seconds
  setInterval(pollForEngagement, 5000);

  // Run immediately on start
  pollForEngagement();
}

