/**
 * AI-Native Communication API Routes
 *
 * Features only possible with AI:
 * - Live Translation: Real-time message translation
 * - Tone Adjustment: Rewrite text professionally/casually
 * - Context Cards: AI-generated background on topics
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { executeGPT51Response } from "../services/gpt-responses";
import { env } from "../env";
import type { AppType } from "../index";
import { decryptMessageContent, decryptMessages } from "../services/message-encryption";

const app = new Hono<AppType>();

// ==========================================
// Validation Schemas
// ==========================================

const translateMessageSchema = z.object({
  userId: z.string(),
  messageId: z.string(),
  targetLanguage: z.string(), // ISO language code (e.g., 'es', 'fr', 'ja')
  sourceText: z.string().optional(), // If not provided, will fetch from message
});

const adjustToneSchema = z.object({
  userId: z.string(),
  text: z.string().min(1).max(2000),
  targetTone: z.enum(["professional", "casual", "friendly", "formal", "enthusiastic", "empathetic", "concise", "detailed"]),
  context: z.string().optional(), // Additional context for better adjustment
});

const generateContextCardSchema = z.object({
  userId: z.string(),
  chatId: z.string(),
  messageId: z.string().optional(),
  topic: z.string().min(1).max(200),
});

const updateTranslationPreferenceSchema = z.object({
  userId: z.string(),
  preference: z.enum(["off", "on", "auto"]),
  preferredLanguage: z.string().optional(), // ISO language code
});

// Language names for prompts
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  nl: "Dutch",
  sv: "Swedish",
  pl: "Polish",
  tr: "Turkish",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
  tl: "Tagalog",
};

// ==========================================
// Live Translation
// ==========================================

// POST /api/ai-native/translate - Translate a message
app.post("/translate", zValidator("json", translateMessageSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    let sourceText = data.sourceText;

    // If no source text provided, fetch from message
    if (!sourceText) {
      const { data: message, error } = await db
        .from("message")
        .select("content, chatId, is_encrypted")
        .eq("id", data.messageId)
        .single();

      if (error || !message) {
        return c.json({ error: "Message not found" }, 404);
      }

      // Verify user is member of chat
      const { data: membership } = await db
        .from("chat_member")
        .select("*")
        .eq("chatId", message.chatId)
        .eq("userId", data.userId)
        .single();

      if (!membership) {
        return c.json({ error: "Not authorized to translate this message" }, 403);
      }

      // Decrypt the message content before translating
      const decryptedMessage = await decryptMessageContent(message);
      sourceText = decryptedMessage.content;
    }

    // Check cache first
    const { data: cachedTranslation } = await db
      .from("message_translation")
      .select("*")
      .eq("messageId", data.messageId)
      .eq("targetLanguage", data.targetLanguage)
      .single();

    if (cachedTranslation) {
      return c.json({
        translatedText: cachedTranslation.translatedContent,
        targetLanguage: data.targetLanguage,
        cached: true,
      });
    }

    const targetLanguageName = LANGUAGE_NAMES[data.targetLanguage] || data.targetLanguage;

    // Generate translation using GPT
    const response = await executeGPT51Response({
      systemPrompt: `You are a professional translator. Translate the following text to ${targetLanguageName}. 
Preserve the original meaning, tone, and any emojis or formatting.
Only output the translated text, nothing else.
If the text is already in ${targetLanguageName}, return it unchanged.`,
      userPrompt: sourceText,
      reasoningEffort: "low",
      maxTokens: 1000,
    });

    const translatedText = response.content?.trim() || sourceText;

    // Cache the translation
    await db.from("message_translation").insert({
      messageId: data.messageId,
      targetLanguage: data.targetLanguage,
      translatedContent: translatedText,
    });

    return c.json({
      translatedText,
      targetLanguage: data.targetLanguage,
      cached: false,
    });
  } catch (error) {
    console.error("[AI-Native] Translation error:", error);
    return c.json({ error: "Translation failed" }, 500);
  }
});

// POST /api/ai-native/translate-batch - Translate multiple messages
app.post("/translate-batch", async (c) => {
  const body = await c.req.json();
  const { userId, messageIds, targetLanguage } = body;

  if (!userId || !messageIds || !targetLanguage || !Array.isArray(messageIds)) {
    return c.json({ error: "Invalid request parameters" }, 400);
  }

  try {
    const translations: Record<string, string> = {};

    // Check cache for all messages
    const { data: cachedTranslations } = await db
      .from("message_translation")
      .select("messageId, translatedContent")
      .in("messageId", messageIds)
      .eq("targetLanguage", targetLanguage);

    const cachedMap = new Map(
      (cachedTranslations || []).map((t: any) => [t.messageId, t.translatedContent])
    );

    const uncachedIds = messageIds.filter((id: string) => !cachedMap.has(id));

    // Add cached translations to result
    cachedMap.forEach((text, id) => {
      translations[id] = text;
    });

    // Fetch uncached messages
    if (uncachedIds.length > 0) {
      const { data: messages } = await db
        .from("message")
        .select("id, content, chatId, is_encrypted")
        .in("id", uncachedIds);

      // Decrypt all messages first
      const decryptedMessages = await decryptMessages(messages || []);

      const targetLanguageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

      // Translate each message (could be optimized with batch API calls)
      for (const message of decryptedMessages) {
        try {
          const response = await executeGPT51Response({
            systemPrompt: `Translate to ${targetLanguageName}. Only output translated text.`,
            userPrompt: message.content,
            reasoningEffort: "low",
            maxTokens: 500,
          });

          const translatedText = response.content?.trim() || message.content;
          translations[message.id] = translatedText;

          // Cache it
          await db.from("message_translation").upsert({
            messageId: message.id,
            targetLanguage,
            translatedContent: translatedText,
          }, { onConflict: "messageId,targetLanguage" });
        } catch (err) {
          translations[message.id] = message.content; // Fallback to original
        }
      }
    }

    return c.json({ translations });
  } catch (error) {
    console.error("[AI-Native] Batch translation error:", error);
    return c.json({ error: "Batch translation failed" }, 500);
  }
});

// GET /api/ai-native/translation-preference - Get user's translation settings
app.get("/translation-preference", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const { data: user } = await db
      .from("user")
      .select("translationPreference, preferredLanguage")
      .eq("id", userId)
      .single();

    return c.json({
      preference: user?.translationPreference || "off",
      preferredLanguage: user?.preferredLanguage || "en",
    });
  } catch (error) {
    console.error("[AI-Native] Error fetching preference:", error);
    return c.json({ error: "Failed to fetch preference" }, 500);
  }
});

// PATCH /api/ai-native/translation-preference - Update translation settings
app.patch("/translation-preference", zValidator("json", updateTranslationPreferenceSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const updateData: any = { translationPreference: data.preference };
    if (data.preferredLanguage) {
      updateData.preferredLanguage = data.preferredLanguage;
    }

    const { error } = await db
      .from("user")
      .update(updateData)
      .eq("id", data.userId);

    if (error) {
      console.error("[AI-Native] Error updating preference:", error);
      return c.json({ error: "Failed to update preference" }, 500);
    }

    return c.json({ success: true, ...updateData });
  } catch (error) {
    console.error("[AI-Native] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ==========================================
// Tone Adjustment
// ==========================================

// POST /api/ai-native/adjust-tone - Rewrite text with different tone
app.post("/adjust-tone", zValidator("json", adjustToneSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const toneInstructions: Record<string, string> = {
      professional: "Rewrite this text in a professional, business-appropriate tone. Use proper grammar, avoid slang, and maintain clarity.",
      casual: "Rewrite this text in a casual, relaxed tone. Feel free to use contractions and friendly language.",
      friendly: "Rewrite this text in a warm, friendly tone. Be approachable and personable.",
      formal: "Rewrite this text in a formal, official tone. Use proper titles and avoid contractions.",
      enthusiastic: "Rewrite this text with enthusiasm and energy. Show excitement while maintaining the core message.",
      empathetic: "Rewrite this text with empathy and understanding. Show that you care about the recipient's feelings.",
      concise: "Rewrite this text to be more concise and to-the-point. Remove unnecessary words while keeping the meaning.",
      detailed: "Expand this text with more detail and explanation. Be thorough while staying on topic.",
    };

    const instruction = toneInstructions[data.targetTone] || toneInstructions.professional;
    const contextInfo = data.context ? `\nContext: ${data.context}` : "";

    const response = await executeGPT51Response({
      systemPrompt: `You are a writing assistant that helps people communicate better.
${instruction}${contextInfo}

Guidelines:
- Preserve the original meaning and intent
- Keep any specific names, dates, or facts unchanged
- Maintain appropriate length (don't drastically change message length)
- Output only the rewritten text, no explanations`,
      userPrompt: data.text,
      reasoningEffort: "low",
      maxTokens: 1000,
    });

    const adjustedText = response.content?.trim() || data.text;

    return c.json({
      originalText: data.text,
      adjustedText,
      targetTone: data.targetTone,
    });
  } catch (error) {
    console.error("[AI-Native] Tone adjustment error:", error);
    return c.json({ error: "Tone adjustment failed" }, 500);
  }
});

// POST /api/ai-native/tone-suggestions - Get multiple tone variations
app.post("/tone-suggestions", async (c) => {
  const body = await c.req.json();
  const { userId, text } = body;

  if (!userId || !text) {
    return c.json({ error: "userId and text are required" }, 400);
  }

  try {
    const response = await executeGPT51Response({
      systemPrompt: `You are a writing assistant. Given a text, provide 3 different tone variations.
Output as JSON array with objects containing "tone" and "text" fields.
Tones to provide: professional, friendly, concise.
Only output valid JSON, no explanations.`,
      userPrompt: text,
      reasoningEffort: "low",
      maxTokens: 1500,
    });

    try {
      const suggestions = JSON.parse(response.content || "[]");
      return c.json({ suggestions });
    } catch {
      // Fallback if JSON parsing fails
      return c.json({
        suggestions: [
          { tone: "professional", text },
          { tone: "friendly", text },
          { tone: "concise", text },
        ],
      });
    }
  } catch (error) {
    console.error("[AI-Native] Tone suggestions error:", error);
    return c.json({ error: "Failed to generate suggestions" }, 500);
  }
});

// ==========================================
// Context Cards
// ==========================================

// POST /api/ai-native/context-card - Generate context card for a topic
app.post("/context-card", zValidator("json", generateContextCardSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Verify user is member of chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", data.chatId)
      .eq("userId", data.userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check if we already have a recent context card for this topic
    const { data: existingCard } = await db
      .from("context_card")
      .select("*")
      .eq("chatId", data.chatId)
      .ilike("topic", data.topic)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    // If card exists and is less than 24 hours old, return it
    if (existingCard) {
      const cardAge = Date.now() - new Date(existingCard.createdAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (cardAge < twentyFourHours) {
        return c.json({
          ...existingCard,
          cached: true,
        });
      }
    }

    // Get recent chat context for better card generation
    const { data: recentMessages } = await db
      .from("message")
      .select("content, userId, createdAt, is_encrypted")
      .eq("chatId", data.chatId)
      .order("createdAt", { ascending: false })
      .limit(10);

    // Decrypt messages before using them as context
    const decryptedRecentMessages = await decryptMessages(recentMessages || []);

    const chatContext = decryptedRecentMessages
      ?.map((m: any) => m.content)
      .reverse()
      .join("\n") || "";

    const response = await executeGPT51Response({
      systemPrompt: `You are an AI assistant that generates helpful context cards about topics.
Given a topic and optional chat context, create a brief but informative context card.

Your response should be a JSON object with:
- "title": A clear, engaging title for the card
- "summary": 2-3 sentences explaining the topic
- "keyPoints": Array of 3-5 key facts or points (strings)
- "relevance": Why this might be relevant to the conversation (1 sentence)

Output only valid JSON, no markdown or explanations.`,
      userPrompt: `Topic: ${data.topic}

Recent chat context:
${chatContext || "No recent context available"}`,
      reasoningEffort: "medium",
      maxTokens: 800,
    });

    let cardContent;
    try {
      cardContent = JSON.parse(response.content || "{}");
    } catch {
      cardContent = {
        title: data.topic,
        summary: "Unable to generate summary for this topic.",
        keyPoints: [],
        relevance: "This topic was mentioned in the conversation.",
      };
    }

    // Save the context card
    const { data: newCard, error: insertError } = await db
      .from("context_card")
      .insert({
        chatId: data.chatId,
        messageId: data.messageId || null,
        topic: data.topic,
        title: cardContent.title,
        summary: cardContent.summary,
        keyPoints: cardContent.keyPoints,
        relevance: cardContent.relevance,
        generatedBy: "ai",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[AI-Native] Error saving context card:", insertError);
      return c.json({
        ...cardContent,
        topic: data.topic,
        cached: false,
      });
    }

    return c.json({
      ...newCard,
      cached: false,
    });
  } catch (error) {
    console.error("[AI-Native] Context card error:", error);
    return c.json({ error: "Failed to generate context card" }, 500);
  }
});

// GET /api/ai-native/context-cards - Get context cards for a chat
app.get("/context-cards", async (c) => {
  const chatId = c.req.query("chatId");
  const userId = c.req.query("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

  if (!chatId || !userId) {
    return c.json({ error: "chatId and userId are required" }, 400);
  }

  try {
    // Verify membership
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    const { data: cards } = await db
      .from("context_card")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(limit);

    return c.json({ cards: cards || [] });
  } catch (error) {
    console.error("[AI-Native] Error fetching context cards:", error);
    return c.json({ error: "Failed to fetch context cards" }, 500);
  }
});

// DELETE /api/ai-native/context-cards/:id - Delete a context card
app.delete("/context-cards/:id", async (c) => {
  const cardId = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Get the card to verify chat membership
    const { data: card } = await db
      .from("context_card")
      .select("chatId")
      .eq("id", cardId)
      .single();

    if (!card) {
      return c.json({ error: "Context card not found" }, 404);
    }

    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", card.chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not authorized to delete this card" }, 403);
    }

    await db.from("context_card").delete().eq("id", cardId);

    return c.json({ success: true, message: "Context card deleted" });
  } catch (error) {
    console.error("[AI-Native] Error deleting context card:", error);
    return c.json({ error: "Failed to delete context card" }, 500);
  }
});

// ==========================================
// Detect Language
// ==========================================

// POST /api/ai-native/detect-language - Detect the language of text
app.post("/detect-language", async (c) => {
  const body = await c.req.json();
  const { text } = body;

  if (!text) {
    return c.json({ error: "text is required" }, 400);
  }

  try {
    const response = await executeGPT51Response({
      systemPrompt: `Detect the language of the given text. 
Output only the ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'ja').
If unsure, output 'en'.`,
      userPrompt: text.slice(0, 500), // Limit text for detection
      reasoningEffort: "low",
      maxTokens: 10,
    });

    const detectedLanguage = response.content?.trim().toLowerCase() || "en";

    return c.json({
      languageCode: detectedLanguage,
      languageName: LANGUAGE_NAMES[detectedLanguage] || detectedLanguage,
    });
  } catch (error) {
    console.error("[AI-Native] Language detection error:", error);
    return c.json({ languageCode: "en", languageName: "English" });
  }
});

export default app;

