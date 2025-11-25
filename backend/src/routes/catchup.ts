import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { generateCatchUpRequestSchema, getCatchUpRequestSchema } from "@shared/contracts";
import { openai } from "../env";

const catchup = new Hono();

// POST /api/catchup/generate - Generate catch-up summary
catchup.post("/generate", zValidator("json", generateCatchUpRequestSchema), async (c) => {
  const { chatId, userId, summaryType, sinceMessageId } = c.req.valid("json");
  console.log("[Catch-Up] === Starting catch-up generation ===");
  console.log("[Catch-Up] Request params:", { chatId, userId, summaryType, sinceMessageId });

  let messages: any[] = []; // Declare messages outside try block for error handling

  try {

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    // Get user info for personalization
    const { data: user, error: userError } = await db
      .from("user")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Determine which messages to summarize
    let query = db
      .from("message")
      .select("*")
      .eq("chatId", chatId)
      .neq("userId", userId); // Exclude user's own messages

    let sinceDate: Date | null = null;

    if (sinceMessageId) {
      const { data: sinceMessage } = await db
        .from("message")
        .select("createdAt")
        .eq("id", sinceMessageId)
        .single();

      if (sinceMessage) {
        sinceDate = new Date(sinceMessage.createdAt);
      }
    } else {
      // Get messages from the last time user read the chat
      const { data: lastReadReceipt } = await db
        .from("read_receipt")
        .select("messageId, readAt")
        .eq("userId", userId)
        .eq("chatId", chatId)
        .order("readAt", { ascending: false })
        .limit(1)
        .single();

      if (lastReadReceipt) {
        const { data: lastReadMessage } = await db
          .from("message")
          .select("createdAt")
          .eq("id", lastReadReceipt.messageId)
          .single();

        if (lastReadMessage) {
          sinceDate = new Date(lastReadMessage.createdAt);
        }
      } else {
        // If no read receipt, get last 50 messages
        const { data: allMessages = [] } = await db
          .from("message")
          .select("createdAt")
          .eq("chatId", chatId)
          .order("createdAt", { ascending: false })
          .limit(50);

        if (allMessages.length > 0) {
          const lastMessage = allMessages[allMessages.length - 1];
          if (lastMessage) {
            sinceDate = new Date(lastMessage.createdAt);
          }
        }
      }
    }

    // Apply date filter if we have one
    if (sinceDate) {
      query = query.gt("createdAt", sinceDate.toISOString());
    }

    // Fetch messages to summarize
    const { data: messagesData = [], error: messagesError } = await query
      .order("createdAt", { ascending: true })
      .limit(100);

    if (messagesError) {
      console.error("[Catch-Up] Error fetching messages:", messagesError);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }

    // Fetch users for messages
    const userIds = [...new Set(messagesData.map((m: any) => m.userId))];
    const { data: users = [] } = userIds.length > 0 ? await db
      .from("user")
      .select("*")
      .in("id", userIds) : { data: [] };
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Attach user data to messages
    messages = messagesData.map((m: any) => ({
      ...m,
      user: userMap.get(m.userId),
    }));

    if (messages.length === 0) {
      console.log("[Catch-Up] No new messages found to summarize");
      return c.json({
        error: "No new messages to summarize",
        details: "You're all caught up! There are no new messages since you last checked."
      }, 404);
    }

    console.log(`[Catch-Up] Found ${messages.length} messages to summarize`);

    // Build conversation context
    const conversationText = messages
      .map((msg) => {
        const timestamp = new Date(msg.createdAt).toLocaleString();
        return `[${timestamp}] ${msg.user.name}: ${msg.content}`;
      })
      .join("\n");

    // Generate summary based on type
    let systemPrompt = "";
    if (summaryType === "quick") {
      systemPrompt = `You are a hyper-concise conversation summarizer. Create a 15-20 second read (2-3 bullet points max):

• [Main topic/decision]
• [Critical action item if any]
• [Time-sensitive info if any]

Rules:
- ONLY the most critical info
- Skip small talk completely
- One line per bullet
- NO explanations or context`;
    } else if (summaryType === "detailed") {
      systemPrompt = `You are a concise conversation analyst. Create a 25-30 second read with 4-5 bullet points MAX:

Format:
• [Key decision/outcome]
• [Important action item]
• [Notable question/issue]
• [Other critical info]

Rules:
- Bullet points only, no paragraphs
- One clear point per line
- Skip casual chat and minor details
- Maximum 10-12 words per bullet`;
    } else {
      // personalized
      systemPrompt = `You are a personalized AI assistant for ${user.name}. Create an ULTRA-CONCISE summary (20-25 second read) in bullet point format.

ONLY include bullets for:
• Direct mentions of ${user.name} (questions, requests, tags)
• Decisions that directly impact ${user.name}
• Action items assigned to ${user.name}
• Critical info ${user.name} must know

Rules:
- 3-4 bullet points MAXIMUM
- Start each bullet with action/context (e.g., "Sarah asked you about...", "Team decided...", "You were mentioned...")
- 8-12 words per bullet
- NO filler, NO small talk, NO general conversation
- If nothing important for ${user.name}, return: "• No direct mentions or action items for you"`;
    }

    console.log(`[Catch-Up] Calling OpenAI with model: gpt-5-mini`);
    console.log(`[Catch-Up] Summary type: ${summaryType}`);
    console.log(`[Catch-Up] Conversation text length: ${conversationText.length} characters`);
    console.log(`[Catch-Up] System prompt length: ${systemPrompt.length} characters`);
    console.log(`[Catch-Up] Token limit: ${summaryType === "quick" ? 600 : summaryType === "personalized" ? 800 : 1200}`);

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize this conversation:\n\n${conversationText}` },
      ],
      // GPT-5-mini does not support temperature parameter - it uses default temperature of 1
      // GPT-5-mini uses many tokens for internal reasoning (e.g., 512 reasoning tokens for ~25 output tokens)
      // For ultra-concise summaries, we use lower token limits to encourage brevity
      max_completion_tokens: summaryType === "quick" ? 600 : summaryType === "personalized" ? 800 : 1200,
    });

    console.log(`[Catch-Up] ✅ OpenAI response received`);
    console.log(`[Catch-Up] Response usage:`, response.usage);
    console.log(`[Catch-Up] Response choices length:`, response.choices?.length);

    // GPT-5-mini may have content in different formats due to reasoning tokens
    const choice = response.choices?.[0];
    console.log(`[Catch-Up] First choice:`, JSON.stringify(choice, null, 2));

    const summaryText = choice?.message?.content?.trim();

    console.log(`[Catch-Up] Summary text extracted: ${summaryText ? '"' + summaryText.substring(0, 100) + '..."' : 'null/undefined'}`);
    console.log(`[Catch-Up] Summary text length: ${summaryText?.length || 0} characters`);

    if (!summaryText || summaryText.length === 0) {
      console.error("[Catch-Up] ❌ Failed to generate summary - no content in response");
      console.error("[Catch-Up] Full response for debugging:", JSON.stringify(response, null, 2));
      return c.json({
        error: "Failed to generate summary",
        details: "AI returned empty response"
      }, 500);
    }

    // Extract key points from AI response
    const lines = summaryText.split("\n").filter((line) => line.trim());
    const keyPoints: string[] = [];

    // Extract bullet points and numbered lists
    for (const line of lines) {
      const trimmed = line.trim();
      // Match bullet points (•, -, *) or numbered lists (1., 2., etc.)
      if (/^[•\-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const cleaned = trimmed.replace(/^[•\-*]\s*/, "").replace(/^\d+\.\s*/, "").trim();
        // Only include non-empty points (at least 5 chars for ultra-concise format)
        if (cleaned.length >= 5) {
          keyPoints.push(cleaned);
        }
      }
    }

    // Limit based on summary type - personalized should be most concise
    const maxKeyPoints = summaryType === "personalized" ? 4 : summaryType === "quick" ? 3 : 5;
    const limitedKeyPoints = keyPoints.slice(0, maxKeyPoints);

    // Find highlights (messages with most engagement)
    const messageIds = messages.map((m: any) => m.id);
    const { data: reactions = [] } = messageIds.length > 0 ? await db
      .from("reaction")
      .select("messageId")
      .in("messageId", messageIds) : { data: [] };

    // Count reactions per message
    const reactionCounts = new Map<string, number>();
    reactions.forEach((r: any) => {
      reactionCounts.set(r.messageId, (reactionCounts.get(r.messageId) || 0) + 1);
    });

    // Sort by engagement (reaction count) and get top 3
    const sortedByEngagement = messages
      .map((msg: any) => ({
        message: msg,
        engagementScore: reactionCounts.get(msg.id) || 0,
      }))
      .filter((item: any) => item.engagementScore > 0)
      .sort((a: any, b: any) => b.engagementScore - a.engagementScore)
      .slice(0, 3);

    const highlightData = sortedByEngagement.map((item: any) => ({
      messageId: item.message.id,
      preview: item.message.content.substring(0, 60) + (item.message.content.length > 60 ? "..." : ""),
      reason: `${item.engagementScore} reaction${item.engagementScore > 1 ? 's' : ''}`,
      author: item.message.user?.name || "Unknown",
    }));

    // Improved sentiment detection
    const positiveWords = ["great", "awesome", "love", "happy", "excited", "cool", "nice", "perfect", "excellent", "amazing", "wonderful", "congrats", "congratulations", "yes", "agree", "thanks", "thank you"];
    const negativeWords = ["bad", "sad", "angry", "upset", "problem", "issue", "wrong", "terrible", "horrible", "hate", "no", "disagree", "sorry", "unfortunately", "unfortunately", "concern", "worried"];
    const neutralWords = ["okay", "ok", "maybe", "perhaps", "thinking", "unsure", "question"];

    const textLower = conversationText.toLowerCase();
    const positiveCount = positiveWords.filter((word) => textLower.includes(word)).length;
    const negativeCount = negativeWords.filter((word) => textLower.includes(word)).length;

    let sentiment: "positive" | "negative" | "neutral" | "mixed" = "neutral";
    if (positiveCount > negativeCount + 1 && positiveCount >= 3) {
      sentiment = "positive";
    } else if (negativeCount > positiveCount + 1 && negativeCount >= 3) {
      sentiment = "negative";
    } else if (positiveCount >= 2 && negativeCount >= 2) {
      sentiment = "mixed";
    }

    // Save summary (only include fields that have meaningful data)
    const contentData: any = {
      summary: summaryText,
      sentiment,
    };

    // Only include key points if we found substantial ones
    if (limitedKeyPoints.length > 0) {
      contentData.keyPoints = limitedKeyPoints;
    }

    // Only include highlights if we found messages with engagement
    if (highlightData.length > 0) {
      contentData.highlights = highlightData;
    }

    const { data: summary, error: summaryError } = await db
      .from("conversation_summary")
      .insert({
        chatId,
        userId,
        summaryType,
        content: JSON.stringify(contentData),
        messageRange: JSON.stringify({
          startMessageId: messages[0]?.id,
          endMessageId: messages[messages.length - 1]?.id,
          count: messages.length,
        }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("*")
      .single();

    if (summaryError || !summary) {
      console.error("[Catch-Up] Error saving summary:", summaryError);
      return c.json({ error: "Failed to save summary" }, 500);
    }

    console.log(`[Catch-Up] ✅ Summary saved successfully with ID: ${summary.id}`);

    // Parse content and messageRange for response
    const messageRange = JSON.parse(summary.messageRange);
    const parsedSummary = {
      id: summary.id,
      chatId: summary.chatId,
      userId: summary.userId,
      summaryType: summary.summaryType,
      content: JSON.parse(summary.content),
      startMessageId: messageRange.startMessageId,
      endMessageId: messageRange.endMessageId,
      createdAt: new Date(summary.createdAt).toISOString(),
      expiresAt: new Date(summary.expiresAt).toISOString(),
    };

    return c.json(parsedSummary, 201);
  } catch (error) {
    console.error("[Catch-Up] Error generating catch-up:", error);

    // For connection errors to OpenAI proxy, return a more helpful error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[Catch-Up] Error details:", {
      message: errorMessage,
      stack: errorStack,
      chatId,
      userId,
      summaryType,
      messageCount: messages?.length || 0,
    });

    if (errorMessage.includes("Connection error") || errorMessage.includes("ConnectionRefused") || errorMessage.includes("FailedToOpenSocket")) {
      console.error("[Catch-Up] Connection error detected - OpenAI proxy unavailable");
      return c.json({
        error: "Unable to generate catch-up summary",
        details: "The AI service is temporarily unavailable. Please try again later."
      }, 503); // Service Unavailable
    }

    // Check for authentication errors
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("Invalid API key")) {
      console.error("[Catch-Up] Authentication error - check OpenAI API key");
      return c.json({
        error: "Unable to generate catch-up summary",
        details: "AI service authentication failed. Please check configuration."
      }, 500);
    }

    // Check for rate limiting
    if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
      console.error("[Catch-Up] Rate limit error");
      return c.json({
        error: "Unable to generate catch-up summary",
        details: "AI service rate limit reached. Please try again in a moment."
      }, 429);
    }

    return c.json({
      error: "Failed to generate catch-up summary",
      details: errorMessage
    }, 500);
  }
});

// GET /api/catchup/:chatId - Get cached catch-up summary
catchup.get("/:chatId", zValidator("query", getCatchUpRequestSchema.omit({ chatId: true })), async (c) => {
  try {
    const { chatId } = c.req.param();
    const { userId } = c.req.valid("query");

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "User not authorized" }, 403);
    }

    // Get most recent non-expired summary for this user
    const { data: summary, error: summaryError } = await db
      .from("conversation_summary")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (summaryError || !summary) {
      return c.json(null, 404);
    }

    // Parse JSON fields for response
    const messageRange = JSON.parse(summary.messageRange);
    const parsedSummary = {
      id: summary.id,
      chatId: summary.chatId,
      userId: summary.userId,
      summaryType: summary.summaryType,
      content: JSON.parse(summary.content),
      startMessageId: messageRange.startMessageId,
      endMessageId: messageRange.endMessageId,
      createdAt: new Date(summary.createdAt).toISOString(),
      expiresAt: new Date(summary.expiresAt).toISOString(),
    };

    return c.json(parsedSummary);
  } catch (error) {
    console.error("[Catch-Up] Error fetching catch-up:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "Failed to fetch catch-up summary",
      details: errorMessage
    }, 500);
  }
});

export default catchup;

