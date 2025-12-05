import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppType } from "../types";
import { db } from "../db";
import { openai } from "../env";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import {
  acquireAIResponseLock,
  releaseAIResponseLock,
  isAIResponseLocked,
} from "../services/ai-locks";
import { executeGPT51Response } from "../services/gpt-responses";
import { saveResponseImages } from "../services/image-storage";
import { smartRepliesRequestSchema } from "../../../shared/contracts";
import { tagMessage } from "../services/message-tagger";
import { uploadFileToStorage } from "../services/storage";
import {
  checkContentSafety,
  getSafetySystemPrompt,
  getUserAgeContext,
  filterAIOutput,
  logSafetyEvent,
} from "../services/content-safety";

const ai = new Hono<AppType>();

// Request schema for AI chat
const aiChatRequestSchema = z.object({
  userId: z.string(),
  userMessage: z.string(),
  chatId: z.string(),
  aiFriendId: z.string().optional(), // Optional AI friend ID to specify which AI to use
});

// Request schema for image generation
const generateImageRequestSchema = z.object({
  prompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  aspectRatio: z.string().optional().default("1:1"),
  referenceImageUrls: z.array(z.string()).optional(), // Optional reference images to use as basis
  preview: z.boolean().optional().default(false),
});

// Request schema for meme generation
const generateMemeRequestSchema = z.object({
  prompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  referenceImageUrl: z.string().optional(), // Optional reference image for meme
  preview: z.boolean().optional().default(false),
});

// Request schema for confirming previewed image
const confirmImageRequestSchema = z.object({
  imageUrl: z.string(),
  prompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  type: z.enum(["image", "meme", "remix"]),
  metadata: z.record(z.any()).optional(),
});

// Request schema for editing image
const editImageRequestSchema = z.object({
  originalImageUrl: z.string(),
  editPrompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  preview: z.boolean().optional().default(true),
});

// POST /api/ai/chat - Get AI response
ai.post("/chat", zValidator("json", aiChatRequestSchema), async (c) => {
  const { userId, userMessage, chatId, aiFriendId } = c.req.valid("json");

  try {
    const requestId = `${chatId}-${Date.now()}`;
    console.log(`[AI] [${requestId}] Processing AI chat request for chat ${chatId} from user ${userId} with AI friend ${aiFriendId}`);
    
    // RACE CONDITION PREVENTION: Acquire lock using shared lock module
    // This ensures the auto-engagement service and API endpoint can't both respond simultaneously
    if (!acquireAIResponseLock(chatId)) {
      console.log(`[AI] [${requestId}] ❌ BLOCKED: Lock already held for chat ${chatId} - response already in progress`);
      return c.json({
        error: "AI is already responding to this chat. Please wait.",
        blocked: true
      }, 429); // 429 Too Many Requests
    }

    console.log(`[AI] [${requestId}] ✅ Lock acquired successfully for chat ${chatId}`);

    // NOTE: We intentionally DO NOT check if last message is from AI here.
    // @ai is a USER-INITIATED command - users should be able to call the AI
    // even if the AI just responded. The lock ensures we don't interfere with
    // ongoing AI responses, and prevents duplicate processing.

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // CRIT-1/2/3: Content Safety Check
    const userAgeContext = await getUserAgeContext(userId);
    const safetyResult = await checkContentSafety({
      userMessage,
      userId,
      chatId,
      isMinor: userAgeContext.isMinor,
    });

    // Handle crisis situation (CRIT-2)
    if (safetyResult.crisisDetected && safetyResult.crisisResponse) {
      logSafetyEvent("crisis", { chatId, userId, flags: safetyResult.flags });
      
      // Create a supportive response message instead of the user's request
      const { data: crisisMessage } = await db
        .from("message")
        .insert({
          content: safetyResult.crisisResponse,
          messageType: "text",
          userId: null, // AI message
          chatId: chatId,
          aiFriendId: aiFriendId,
        })
        .select()
        .single();

      releaseAIResponseLock(chatId);
      return c.json({
        id: crisisMessage?.id,
        content: safetyResult.crisisResponse,
        userId: null,
        aiFriendId: aiFriendId,
        chatId: chatId,
        createdAt: new Date().toISOString(),
        isCrisisResponse: true,
      });
    }

    // Handle blocked content (CRIT-1)
    if (safetyResult.isBlocked) {
      logSafetyEvent("blocked", { chatId, userId, flags: safetyResult.flags });
      releaseAIResponseLock(chatId);
      return c.json({
        error: safetyResult.blockReason || "I can't help with that request.",
        blocked: true,
      }, 400);
    }

    // Get the specific AI friend (or default to first one if not specified)
    let aiFriend;
    if (aiFriendId) {
      const { data: foundFriend } = await db
        .from("ai_friend")
        .select("*, chat:chat(*)")
        .eq("id", aiFriendId)
        .single();
      aiFriend = foundFriend;

      if (!aiFriend) {
        return c.json({ error: "AI friend not found" }, 404);
      }

      // Verify the AI friend belongs to this chat
      if (aiFriend.chatId !== chatId) {
        return c.json({ error: "AI friend does not belong to this chat" }, 400);
      }
    } else {
      // If no aiFriendId specified, use the first AI friend in the chat
      const { data: foundFriend } = await db
        .from("ai_friend")
        .select("*, chat:chat(*)")
        .eq("chatId", chatId)
        .order("sortOrder", { ascending: true })
        .limit(1)
        .single();
      aiFriend = foundFriend;

      if (!aiFriend) {
        return c.json({ error: "No AI friends found in this chat" }, 404);
      }
    }

    const chat = aiFriend.chat;

    // Fetch last 100 messages from this chat
    const { data: allMessages = [] } = await db
      .from("message")
      .select("*, user:user(*)")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(100);

    // Reverse to get chronological order
    const messagesInOrder = allMessages.reverse();

    // Get last 10 messages for recent context, last 5 for immediate context
    const recentMessages = messagesInOrder.slice(-10);
    const lastFiveMessages = messagesInOrder.slice(-5);

    // Analyze conversation timing
    const now = new Date();

    // Get AI name from AI friend
    const aiName = aiFriend.name || "AI Friend";

    // Helper function to format link preview context
    const formatLinkContext = (msg: any): string => {
      if (msg.linkPreviewTitle || msg.linkPreviewDescription) {
        const title = msg.linkPreviewTitle || msg.linkPreviewSiteName || "Link";
        const desc = msg.linkPreviewDescription ? ` - ${msg.linkPreviewDescription.substring(0, 100)}` : "";
        return ` [Link: "${title}"${desc}]`;
      }
      return "";
    };

    // Format immediate context (last 5 messages) with time awareness
    const recentContextText = lastFiveMessages
      .filter((msg) => msg.user) // Filter out messages without users
      .map((msg) => {
        const timeAgo = Math.floor((now.getTime() - new Date(msg.createdAt).getTime()) / 1000);
        const timeDesc = timeAgo < 60 ? "just now" : timeAgo < 300 ? "a few minutes ago" : "earlier";
        const userName = msg.user?.name || "Unknown";
        const linkContext = formatLinkContext(msg);

        if (msg.messageType === "image" && msg.imageDescription) {
          return `${userName} (${timeDesc}): [shared image: ${msg.imageDescription}]${msg.content ? ` "${msg.content}"` : ""}${linkContext}`;
        } else if (msg.messageType === "image") {
          return `${userName} (${timeDesc}): [shared an image]${msg.content ? ` "${msg.content}"` : ""}${linkContext}`;
        }
        return `${userName} (${timeDesc}): "${msg.content}"${linkContext}`;
      })
      .join("\n");

    // Format earlier context for recall (messages 5-10 back) - include image/link context
    const earlierContext = recentMessages.slice(0, -5);
    const earlierContextText = earlierContext.length > 0
      ? earlierContext
          .filter((msg) => msg.user) // Filter out messages without users
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

    // Extract unique participant names (exclude AI name)
    const uniqueParticipants = Array.from(
      new Set(messagesInOrder.filter((msg) => msg.user).map((msg) => msg.user.name).filter((name) => name !== aiName && name !== "AI Friend"))
    );
    const participantList = uniqueParticipants.join(", ");

    // Build custom personality instruction if provided
    let personalityInstruction = "";
    if (aiFriend.personality) {
      personalityInstruction = `\n\nYour personality traits: ${aiFriend.personality}`;
    }

    // Build tone instruction if provided
    let toneInstruction = "";
    if (aiFriend.tone) {
      toneInstruction = `\nYour conversational tone: ${aiFriend.tone}`;
    }

    // Get safety system prompt based on user age (CRIT-1/3)
    const safetyInstructions = getSafetySystemPrompt(userAgeContext.isMinor);

    // Create an enhanced, natural system prompt with safety instructions
    const systemPrompt = `${safetyInstructions}

You are ${aiName}, a friend in this group chat. Someone just mentioned you (@${aiName}), so they're asking for your input directly.

# Chat Context
Group: "${chat.name}"${chat.bio ? `\nAbout: ${chat.bio}` : ""}
Friends in chat: ${participantList}${personalityInstruction}${toneInstruction}

# How to Respond Naturally

**Be conversational:**
- Talk like a friend texting, not a formal assistant
- Be concise (1-2 sentences usually, like texting)
- Use natural language: contractions, casual phrasing
- Match the group's energy and tone
- Reference what people just said

**Response style:**
- Keep it short unless they clearly want detail
- Start naturally: "oh yeah," "hmm," "totally," "wait," "nah"
- Be direct and helpful when answering questions
- Show personality - react authentically
- If you're not certain, be honest

# Current Conversation

${earlierContextText ? `Earlier:\n${earlierContextText}\n\n` : ""}Recent messages:
${recentContextText}

Someone mentioned you. Respond naturally like a friend would.`;

    // Construct the user input
    const userInput = `${userMessage}

Respond naturally and concisely based on the conversation.`;

    // Token limit check (approx 4 chars per token)
    // This prevents abuse of AI token usage and API calls
    const totalInputLength = systemPrompt.length + userInput.length;
    const estimatedTokens = Math.ceil(totalInputLength / 4);
    
    if (estimatedTokens > 10000) {
      console.log(`[AI] ❌ Request rejected: Input too long (${estimatedTokens} tokens)`);
      // finally block will release the lock
      return c.json({ 
        error: "Whoa, this convo is getting super long! 📚",
        details: `I can't read this much history at once (over 10k tokens!). Let's start a fresh chat to keep the vibes flowing perfectly. ✨`
      }, 400);
    }

    const tools = [
      { type: "web_search" },
      { type: "image_generation" },
      { type: "code_interpreter", container: { type: "auto" } },
    ];

    // MED-19: Enhanced logging and error handling for AI response
    const startTime = Date.now();
    console.log(`[AI] Calling GPT-5.1 Responses API for chat ${chatId}, user ${userId}`);
    
    let response;
    try {
      response = await executeGPT51Response({
        systemPrompt,
        userPrompt: userInput,
        tools,
        reasoningEffort: "none",
        temperature: 1,
        maxTokens: 2048,
      });
    } catch (gptError: any) {
      const duration = Date.now() - startTime;
      console.error(`[AI] GPT-5.1 execution FAILED after ${duration}ms:`, {
        error: gptError.message || gptError,
        chatId,
        userId,
        aiFriendId,
      });
      
      // Provide user-friendly error message
      const isTimeout = gptError.message?.includes("timeout") || gptError.name === "AbortError";
      const errorMessage = isTimeout 
        ? "The AI is taking too long to respond. Try a shorter message or try again."
        : "The AI encountered an error. Please try again.";
      
      return c.json({ error: errorMessage }, 500);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[AI] Response received in ${duration}ms with status:`,
      response.status,
      "and",
      response.images.length,
      "image(s)"
    );

    const savedImageUrls = await saveResponseImages(response.images, "ai-chat");
    const primaryImageUrl = savedImageUrls[0] ?? null;
    let aiResponseText = response.content?.trim() || "";

    // CRIT-1: Filter AI output for safety before saving
    if (aiResponseText) {
      const outputFilter = filterAIOutput(aiResponseText);
      if (outputFilter.wasModified) {
        aiResponseText = outputFilter.filtered;
        logSafetyEvent("filtered", { chatId, userId, flags: ["output_filtered"] });
      }
    }

    if (!aiResponseText && !primaryImageUrl) {
      console.error("[AI] No text or image found in response");
      return c.json({ error: "No response from AI" }, 500);
    }

    // NOTE: No final check here because this is a USER-INITIATED @ai callout.
    // Users should be able to request AI responses even if AI just responded.
    // The lock ensures we don't interfere with ongoing AI responses.

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
      console.error(`[AI Chat] Failed to create message:`, insertError);
      releaseAIResponseLock(chatId);
      return c.json({ error: "Failed to create AI message" }, 500);
    }

    // Auto-tag AI message for smart threads (fire-and-forget, immediate)
    if (aiResponseText && aiResponseText.trim().length > 0) {
      tagMessage(aiMessage.id, aiResponseText).catch(error => {
        console.error(`[AI] Failed to tag message ${aiMessage.id}:`, error);
      });
    }

    // Return the AI message
    // Note: userId is null for AI messages - frontend will use aiFriendId to display correct AI info
    return c.json({
      id: aiMessage.id,
      content: aiMessage.content,
      userId: aiMessage.userId, // null for AI messages
      aiFriendId: aiMessage.aiFriendId,
      chatId: aiMessage.chatId,
      createdAt: typeof aiMessage.createdAt === 'string' ? aiMessage.createdAt : aiMessage.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[AI] Error during chat:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("[AI] Error name:", error.name);
      console.error("[AI] Error message:", error.message);
      console.error("[AI] Error stack:", error.stack);
    }

    // Check if it's an OpenAI API error
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as any;
      console.error("[AI] API Error response:", JSON.stringify(apiError.response, null, 2));
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "Failed to get AI response",
      details: errorMessage
    }, 500);
  } finally {
    // Always release the lock, even if there was an error
    releaseAIResponseLock(chatId);
  }
});

// POST /api/ai/generate-image - Generate image with Gemini 3 Pro Image Preview
ai.post("/generate-image", zValidator("json", generateImageRequestSchema), async (c) => {
  const { prompt, userId, chatId, aspectRatio, referenceImageUrls, preview } = c.req.valid("json");

  try {
    const requestId = `img-${chatId}-${Date.now()}`;
    console.log(`[AI Image] [${requestId}] Generating image for chat ${chatId}`);
    if (referenceImageUrls && referenceImageUrls.length > 0) {
      console.log(`[AI Image] [${requestId}] Using ${referenceImageUrls.length} reference image(s):`, referenceImageUrls);
    }

    // RACE CONDITION PREVENTION: Acquire lock
    if (!acquireAIResponseLock(chatId)) {
      console.log(`[AI Image] [${requestId}] ❌ BLOCKED: Lock already held for chat ${chatId}`);
      return c.json({
        error: "AI is already responding to this chat. Please wait.",
        blocked: true
      }, 429);
    }

    console.log(`[AI Image] [${requestId}] ✅ Lock acquired successfully`);

    // NOTE: We intentionally DO NOT check if last message is from AI here.
    // This is a user-initiated command - they should be able to generate images
    // even if the AI just responded. The FINAL check before saving will still
    // prevent actual duplicate AI messages in case of race conditions.

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    console.log("[AI Image] Generating image with Gemini 3 Pro Image Preview:", prompt);
    console.log("[AI Image] API Key available:", !!process.env.GOOGLE_API_KEY);
    console.log("[AI Image] API Key length:", process.env.GOOGLE_API_KEY?.length);

    // If reference images are provided, read them and include in the request
    const referenceImages: Array<{ base64: string; mimeType: string }> = [];

    if (referenceImageUrls && referenceImageUrls.length > 0) {
      console.log(`[AI Image] Processing ${referenceImageUrls.length} reference image URL(s)...`);
      for (const referenceImageUrl of referenceImageUrls) {
        console.log(`[AI Image] Processing URL: ${referenceImageUrl}`);
        // Keep full URL if it starts with http, otherwise treat as relative upload
        const imagePath = referenceImageUrl.startsWith('http') 
          ? referenceImageUrl 
          : `./uploads/${referenceImageUrl.split('/uploads/')[1]}`;
        
        console.log(`[AI Image] Resolved image path/url: ${imagePath}`);
        
        if (imagePath) {
          try {
            // If it's an absolute URL, fetch it
            if (referenceImageUrl.startsWith('http')) {
              console.log(`[AI Image] Fetching remote image from: ${referenceImageUrl}`);
              const imageResponse = await fetch(referenceImageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch remote image: ${imageResponse.status}`);
              }
              const arrayBuffer = await imageResponse.arrayBuffer();
              const imageBuffer = Buffer.from(arrayBuffer);
              
              // Detect mime type from Content-Type header or extension
              const contentType = imageResponse.headers.get('content-type');
              let mimeType = contentType || 'image/png'; // Default to png if not found
              
              // Fallback to extension if content-type is generic or missing
              if (!contentType || contentType === 'application/octet-stream') {
                if (referenceImageUrl.toLowerCase().endsWith('.jpg') || referenceImageUrl.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
                else if (referenceImageUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                else if (referenceImageUrl.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
              }
              
              referenceImages.push({ base64: imageBuffer.toString('base64'), mimeType });
              console.log(`[AI Image] ✅ Remote reference image loaded! Size: ${imageBuffer.length} bytes, Type: ${mimeType}`);
            } else {
              // It's a local path
              console.log(`[AI Image] Reading local image from: ${imagePath}`);
              const imageBuffer = await fs.readFile(imagePath);
              const base64 = imageBuffer.toString('base64');
              
              // Determine mime type from file extension
              let mimeType: string;
              if (imagePath.endsWith('.png')) {
                mimeType = 'image/png';
              } else if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
                mimeType = 'image/jpeg';
              } else if (imagePath.endsWith('.webp')) {
                mimeType = 'image/webp';
              } else {
                mimeType = 'image/png'; // default
              }
              
              referenceImages.push({ base64, mimeType });
              console.log("[AI Image] ✅ Local reference image loaded successfully! Size:", imageBuffer.length, "bytes, type:", mimeType);
            }
          } catch (readError) {
            console.error("[AI Image] ❌ Failed to read reference image:", readError);
            // Continue with other images
          }
        } else {
          console.log("[AI Image] ⚠️ Skipping invalid image path");
        }
      }
    } else {
      console.log("[AI Image] No reference images provided");
    }

    // Build the parts array for the API request
    const parts: any[] = [];
    
    // Add all reference images first
    for (const img of referenceImages) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64
        }
      });
    }
    
    if (referenceImages.length > 0) {
      console.log(`[AI Image] ✅ Including ${referenceImages.length} reference image(s) in request`);
    } else {
      console.log(`[AI Image] ℹ️ No reference images to include, generating from text prompt only`);
    }
    
    // Build the text prompt with explicit instructions about reference images
    const finalPrompt = referenceImages.length > 0
      ? `Using the provided reference image(s) as the PRIMARY BASIS and starting point, ${prompt}. IMPORTANT: You MUST use the reference image(s) as the foundation. Keep the main elements, composition, and style from the reference image(s) and apply the requested modifications.`
      : prompt;
    
    // Add the text prompt
    parts.push({ text: finalPrompt });
    
    console.log(`[AI Image] Final prompt:`, finalPrompt);
    console.log(`[AI Image] Final parts array has ${parts.length} parts (${referenceImages.length} images + 1 text prompt)`);

    // Call Gemini 3 Pro Image Preview API
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GOOGLE_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: aspectRatio || "1:1" }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Image] Gemini 3 Pro Image Preview API error:", errorText);

      // Try to parse error as JSON for better error handling
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use raw text
        return c.json({ error: "Failed to generate image", details: errorText }, response.status);
      }

      // Check for rate limiting (429)
      if (errorData.error?.code === 429 || errorData.error?.status === "RESOURCE_EXHAUSTED") {
        console.error("[AI Image] Rate limit exceeded");
        const retryDelay = errorData.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay;

        return c.json({
          error: "Image generation rate limit reached",
          details: `Google Gemini API quota exceeded. ${retryDelay ? `Please retry in ${retryDelay}.` : 'Please try again later.'}`,
          retryAfter: retryDelay
        }, 429);
      }

      // Check for authentication errors
      if (errorData.error?.code === 401 || errorData.error?.code === 403) {
        console.error("[AI Image] Authentication error");
        return c.json({
          error: "Image generation authentication failed",
          details: "API key is invalid or missing. Please check your Google API configuration."
        }, 403);
      }

      return c.json({
        error: "Failed to generate image",
        details: errorData.error?.message || errorText
      }, response.status);
    }

    const data = await response.json();
    console.log("[AI Image] Response data:", JSON.stringify(data, null, 2));

    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart) {
      console.error("[AI Image] No image generated in response");
      console.error("[AI Image] Full response:", JSON.stringify(data, null, 2));

      // Check finish reason
      const finishReason = data.candidates?.[0]?.finishReason;
      console.error("[AI Image] Finish reason:", finishReason);

      // Check if content was blocked
      if (data.promptFeedback?.blockReason) {
        console.error("[AI Image] Content blocked:", data.promptFeedback.blockReason);
        return c.json({
          error: "Image generation blocked by safety filters. Try a different prompt.",
          details: data.promptFeedback.blockReason
        }, 400);
      }

      // Check if NO_IMAGE finish reason
      if (finishReason === "NO_IMAGE") {
        console.error("[AI Image] Model refused to generate image");
        return c.json({
          error: "Unable to generate image for this prompt. Try simplifying or changing your request.",
          details: "Model declined to generate image"
        }, 400);
      }

      return c.json({
        error: "Failed to generate image. Please try a different prompt.",
        details: finishReason || "Unknown error"
      }, 500);
    }

    const base64Image = imagePart.inlineData.data;

    // Save the image to Supabase Storage
    const filename = `nano-banana-${Date.now()}.png`;
    const buffer = Buffer.from(base64Image, 'base64');
    
    const imageUrl = await uploadFileToStorage(filename, buffer, "image/png");
    console.log("[AI Image] Image saved successfully to Supabase Storage:", imageUrl);

    // If preview mode, return without creating message
    if (preview) {
      const previewId = `prev-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log("[AI Image] Returning preview response:", { imageUrl, previewId });
      return c.json({
        imageUrl,
        previewId,
        prompt
      });
    }

    // NOTE: No final check here because this is a USER-INITIATED command.
    // Users should be able to generate images even if AI just responded.
    // The lock ensures we don't interfere with ongoing AI responses.

    // Create a message in the database with the generated image
    // Note: User-initiated /image commands are credited to the user who submitted them
    const { data: message, error: insertError } = await db
      .from("message")
      .insert({
        content: prompt,
        messageType: "image",
        imageUrl: imageUrl,
        userId: userId, // Credit to the user who submitted the command
        chatId: chatId,
        aiFriendId: null, // No specific AI friend for these standalone images
      })
      .select()
      .single();

    if (insertError || !message) {
      console.error("[AI Image] Failed to create message:", insertError);
      return c.json({ error: "Failed to create message" }, 500);
    }

    return c.json({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      imageUrl: message.imageUrl,
      userId: message.userId,
      chatId: message.chatId,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("[AI Image] Error generating image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "Failed to generate image",
      details: errorMessage
    }, 500);
  } finally {
    releaseAIResponseLock(chatId);
  }
});

// POST /api/ai/generate-meme - Generate meme with Gemini 3 Pro Image Preview
ai.post("/generate-meme", zValidator("json", generateMemeRequestSchema), async (c) => {
  const body = c.req.valid("json");
  const { prompt, userId, chatId, referenceImageUrl, preview } = body;

  console.log("[AI Meme] Received request:", { prompt, userId, chatId, hasReference: !!referenceImageUrl, preview });

  try {
    const requestId = `meme-${chatId}-${Date.now()}`;
    console.log(`[AI Meme] [${requestId}] Generating meme for chat ${chatId}`);

    // RACE CONDITION PREVENTION: Acquire lock
    if (!acquireAIResponseLock(chatId)) {
      console.log(`[AI Meme] [${requestId}] ❌ BLOCKED: Lock already held for chat ${chatId}`);
      return c.json({
        error: "AI is already responding to this chat. Please wait.",
        blocked: true
      }, 429);
    }

    console.log(`[AI Meme] [${requestId}] ✅ Lock acquired successfully`);

    // NOTE: We intentionally DO NOT check if last message is from AI here.
    // This is a user-initiated command - they should be able to generate memes
    // even if the AI just responded. The FINAL check before saving will still
    // prevent actual duplicate AI messages in case of race conditions.

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    console.log("[AI Meme] Generating meme with Gemini 3 Pro Image Preview:", prompt);

    // Load reference image if provided
    let referenceImageBase64: string | undefined;
    let referenceMimeType: string | undefined;

    if (referenceImageUrl) {
      console.log(`[AI Meme] Processing reference image URL: ${referenceImageUrl}`);
      // Keep full URL if it starts with http, otherwise treat as relative upload
      const imagePath = referenceImageUrl.startsWith('http') 
        ? referenceImageUrl
        : `./uploads/${referenceImageUrl.split('/uploads/')[1]}`;
      
      console.log(`[AI Meme] Resolved image path/url: ${imagePath}`);
      
      if (imagePath) {
        try {
          if (referenceImageUrl.startsWith('http')) {
             console.log(`[AI Meme] Fetching remote image from: ${referenceImageUrl}`);
             const imageResponse = await fetch(referenceImageUrl);
             if (!imageResponse.ok) {
               throw new Error(`Failed to fetch remote image: ${imageResponse.status}`);
             }
             const arrayBuffer = await imageResponse.arrayBuffer();
             const imageBuffer = Buffer.from(arrayBuffer);
             
             referenceImageBase64 = imageBuffer.toString('base64');
             const contentType = imageResponse.headers.get('content-type');
             referenceMimeType = contentType || 'image/png';
             
             // Fallback detection
             if (!contentType || contentType === 'application/octet-stream') {
                if (referenceImageUrl.toLowerCase().endsWith('.jpg') || referenceImageUrl.toLowerCase().endsWith('.jpeg')) referenceMimeType = 'image/jpeg';
                else if (referenceImageUrl.toLowerCase().endsWith('.png')) referenceMimeType = 'image/png';
                else if (referenceImageUrl.toLowerCase().endsWith('.webp')) referenceMimeType = 'image/webp';
             }
             
             console.log(`[AI Meme] ✅ Remote reference image loaded! Size: ${imageBuffer.length} bytes, Type: ${referenceMimeType}`);
          } else {
             console.log(`[AI Meme] Reading local image from: ${imagePath}`);
             const imageBuffer = await fs.readFile(imagePath);
             referenceImageBase64 = imageBuffer.toString('base64');
             
             if (imagePath.endsWith('.png')) {
               referenceMimeType = 'image/png';
             } else if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
               referenceMimeType = 'image/jpeg';
             } else if (imagePath.endsWith('.webp')) {
               referenceMimeType = 'image/webp';
             } else {
               referenceMimeType = 'image/png'; // default
             }
             console.log("[AI Meme] ✅ Local reference image loaded successfully! Size:", imageBuffer.length, "bytes, type:", referenceMimeType);
          }
        } catch (readError) {
          console.error("[AI Meme] ❌ Failed to read reference image:", readError);
          referenceImageBase64 = undefined;
        }
      } else {
        console.log("[AI Meme] ⚠️ Skipping invalid image path");
      }
    } else {
      console.log("[AI Meme] No reference image provided");
    }

    // Enhance the prompt for meme generation
    const memePrompt = referenceImageBase64 
      ? `Generate a meme by incorporating this reference image into a recent, well-known meme template. The goal is to be incredibly relevant to the provided prompt: "${prompt}", and be both funny and poignant. Use the reference image as a key element within the meme template, blending it seamlessly into the format.`
      : `Generate a meme using a recent, well-known template that fits this prompt: "${prompt}". The goal of the meme should be to be incredibly relevant to the prompt and be both funny and poignant. Use your own words on the template.`;

    // Build parts array with optional reference image
    const parts: any[] = [];
    
    // CRITICAL: Add the reference image FIRST in the parts array if it exists
    // The model pays most attention to the first part for image-to-image generation
    if (referenceImageBase64 && referenceMimeType) {
      parts.push({
        inlineData: {
          mimeType: referenceMimeType,
          data: referenceImageBase64
        }
      });
      console.log("[AI Meme] ✅ Including reference image in request (FIRST part)");
    } else {
      console.log("[AI Meme] ℹ️ No reference image to include, generating from text prompt only");
    }
    
    // Add the text prompt as the second part
    parts.push({ text: memePrompt });
    
    console.log(`[AI Meme] Final parts array has ${parts.length} parts`);
    console.log(`[AI Meme] Meme prompt: ${memePrompt}`);

    // Call Gemini 3 Pro Image Preview API with meme-specific prompt
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GOOGLE_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts
          }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: "1:1" }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Meme] Gemini 3 Pro Image Preview API error:", errorText);

      // Try to parse error as JSON for better error handling
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use raw text
        return c.json({ error: "Failed to generate meme", details: errorText }, response.status);
      }

      // Check for rate limiting (429)
      if (errorData.error?.code === 429 || errorData.error?.status === "RESOURCE_EXHAUSTED") {
        console.error("[AI Meme] Rate limit exceeded");
        const retryDelay = errorData.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay;

        return c.json({
          error: "Meme generation rate limit reached",
          details: `Google Gemini API quota exceeded. ${retryDelay ? `Please retry in ${retryDelay}.` : 'Please try again later.'}`,
          retryAfter: retryDelay
        }, 429);
      }

      // Check for authentication errors
      if (errorData.error?.code === 401 || errorData.error?.code === 403) {
        console.error("[AI Meme] Authentication error");
        return c.json({
          error: "Meme generation authentication failed",
          details: "API key is invalid or missing. Please check your Google API configuration."
        }, 403);
      }

      return c.json({
        error: "Failed to generate meme",
        details: errorData.error?.message || errorText
      }, response.status);
    }

    const data = await response.json();
    console.log("[AI Meme] Response data:", JSON.stringify(data, null, 2));

    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart) {
      console.error("[AI Meme] No image generated in response");
      console.error("[AI Meme] Full response:", JSON.stringify(data, null, 2));

      // Check finish reason
      const finishReason = data.candidates?.[0]?.finishReason;
      console.error("[AI Meme] Finish reason:", finishReason);

      // Check if content was blocked
      if (data.promptFeedback?.blockReason) {
        console.error("[AI Meme] Content blocked:", data.promptFeedback.blockReason);
        return c.json({
          error: "Image generation blocked by safety filters. Try a different prompt.",
          details: data.promptFeedback.blockReason
        }, 400);
      }

      // Check if NO_IMAGE finish reason
      if (finishReason === "NO_IMAGE") {
        console.error("[AI Meme] Model refused to generate image");
        return c.json({
          error: "Unable to generate meme for this prompt. Try simplifying or changing your request.",
          details: "Model declined to generate image"
        }, 400);
      }

      return c.json({
        error: "Failed to generate meme. Please try a different prompt.",
        details: finishReason || "Unknown error"
      }, 500);
    }

    const base64Image = imagePart.inlineData.data;

    // Save the meme to Supabase Storage
    const filename = `meme-${Date.now()}.png`;
    const buffer = Buffer.from(base64Image, 'base64');
    
    const imageUrl = await uploadFileToStorage(filename, buffer, "image/png");
    console.log("[AI Meme] Meme saved successfully to Supabase Storage:", imageUrl);

    // If preview mode, return without creating message
    if (preview) {
      const previewId = `prev-meme-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log("[AI Meme] Returning preview response:", { imageUrl, previewId });
      return c.json({
        imageUrl,
        previewId,
        prompt
      });
    }

    // NOTE: No final check here because this is a USER-INITIATED command.
    // Users should be able to generate memes even if AI just responded.
    // The lock ensures we don't interfere with ongoing AI responses.

    // Create a message in the database with the generated meme
    // Note: User-initiated /meme commands are credited to the user who submitted them
    const { data: message, error: insertError } = await db
      .from("message")
      .insert({
        content: prompt,
        messageType: "image",
        imageUrl: imageUrl,
        userId: userId, // Credit to the user who submitted the command
        chatId: chatId,
        aiFriendId: null, // No specific AI friend for these standalone memes
      })
      .select()
      .single();

    if (insertError || !message) {
      console.error("[AI Meme] Failed to create message:", insertError);
      return c.json({ error: "Failed to create message" }, 500);
    }

    return c.json({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      imageUrl: message.imageUrl,
      userId: message.userId,
      chatId: message.chatId,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("[AI Meme] Error generating meme:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "Failed to generate meme",
      details: errorMessage
    }, 500);
  } finally {
    releaseAIResponseLock(chatId);
  }
});

// POST /api/ai/confirm-image - Confirm and post a previewed image
ai.post("/confirm-image", zValidator("json", confirmImageRequestSchema), async (c) => {
  const { imageUrl, prompt, userId, chatId, type, metadata } = c.req.valid("json");

  try {
    console.log(`[AI Confirm] Confirming ${type} for chat ${chatId} by user ${userId}`);

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Prepare message data
    const messageData: any = {
      content: prompt,
      messageType: "image",
      imageUrl: imageUrl,
      userId: userId,
      chatId: chatId,
      aiFriendId: null,
    };

    // Add metadata if present (e.g. for reactor)
    if (metadata) {
      // If it's a remix or meme from reactor, we might want to store that in metadata
      // but for now, the message schema handles imageUrl and content.
      // We can add reactor metadata if we want to track origin.
      messageData.metadata = metadata;
    }

    // Create message
    const { data: message, error: insertError } = await db
      .from("message")
      .insert(messageData)
      .select()
      .single();

    if (insertError || !message) {
      console.error("[AI Confirm] Failed to create message:", insertError);
      return c.json({ error: "Failed to create message" }, 500);
    }

    console.log(`[AI Confirm] Message created successfully: ${message.id}`);

    return c.json({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      imageUrl: message.imageUrl,
      userId: message.userId,
      chatId: message.chatId,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("[AI Confirm] Error confirming image:", error);
    return c.json({ error: "Failed to confirm image" }, 500);
  }
});

// POST /api/ai/edit-image - Edit/refine a generated image
ai.post("/edit-image", zValidator("json", editImageRequestSchema), async (c) => {
  const { originalImageUrl, editPrompt, userId, chatId, preview } = c.req.valid("json");

  try {
    const requestId = `edit-${chatId}-${Date.now()}`;
    console.log(`[AI Edit] [${requestId}] Editing image for chat ${chatId}`);

    // Verify user is a member
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check lock - though for edits we might be more lenient? 
    // Stick to lock to prevent abuse/parallel heavy requests
    if (!acquireAIResponseLock(chatId)) {
       return c.json({
        error: "AI is already responding to this chat. Please wait.",
        blocked: true
      }, 429);
    }

    // Fetch original image
    let originalImageBase64: string;
    let mimeType: string = "image/png";

    try {
      // Resolve path if local
      const imagePath = originalImageUrl.startsWith('http') 
        ? originalImageUrl
        : `./uploads/${originalImageUrl.split('/uploads/')[1]}`;
      
      if (originalImageUrl.startsWith('http')) {
        const imageResponse = await fetch(originalImageUrl);
        if (!imageResponse.ok) throw new Error("Failed to fetch original image");
        const buffer = await imageResponse.arrayBuffer();
        originalImageBase64 = Buffer.from(buffer).toString('base64');
        mimeType = imageResponse.headers.get('content-type') || "image/png";
      } else {
        const buffer = await fs.readFile(imagePath);
        originalImageBase64 = buffer.toString('base64');
        // Guess mime
        if (imagePath.endsWith('.jpg')) mimeType = "image/jpeg";
        else if (imagePath.endsWith('.webp')) mimeType = "image/webp";
      }
    } catch (e) {
      console.error("[AI Edit] Failed to load original image:", e);
      releaseAIResponseLock(chatId);
      return c.json({ error: "Failed to load original image for editing" }, 400);
    }

    const parts = [
      {
        inlineData: {
          mimeType: mimeType,
          data: originalImageBase64
        }
      },
      {
        text: `Edit this image according to the following instruction: ${editPrompt}. Maintain the overall style and composition unless the instruction implies otherwise.`
      }
    ];

    // Call Gemini
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GOOGLE_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: "1:1" } // Default to square for now
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Edit] API error:", errorText);
      releaseAIResponseLock(chatId);
      return c.json({ error: "Failed to edit image", details: errorText }, 500);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart) {
      releaseAIResponseLock(chatId);
      return c.json({ error: "No image generated" }, 500);
    }

    const base64Image = imagePart.inlineData.data;
    const filename = `edit-${Date.now()}.png`;
    const buffer = Buffer.from(base64Image, 'base64');
    const imageUrl = await uploadFileToStorage(filename, buffer, "image/png");

    releaseAIResponseLock(chatId);

    if (preview) {
      const previewId = `prev-edit-${Date.now()}`;
      return c.json({
        imageUrl,
        previewId,
        prompt: editPrompt
      });
    }

    // If not preview (direct confirm? probably not used directly often but good to have)
    // ... create message logic similar to others ...
    // For now, edit endpoint mainly implies preview per requirements ("Three options... Edit option... submit follow-up")
    // The requirement says: "The user could then either try again or not... They should have an edit option... And then same thing happens when it finishes generating and comes back they should have the same three options."
    // So it should behave like a preview.

    return c.json({
       imageUrl,
       previewId: `direct-${Date.now()}`, // Fallback
       prompt: editPrompt
    });

  } catch (error) {
    console.error("[AI Edit] Error:", error);
    releaseAIResponseLock(chatId);
    return c.json({ error: "Failed to edit image" }, 500);
  }
});

// POST /api/ai/generate-group-avatar - Generate chat avatar based on messages
ai.post("/generate-group-avatar", async (c) => {
  try {
    const body = await c.req.json();
    const { chatId } = body;

    if (!chatId) {
      return c.json({ error: "chatId is required" }, 400);
    }

    console.log("[AI Avatar] Starting chat avatar generation for chat:", chatId);
    console.log("[AI Avatar] GOOGLE_API_KEY available:", !!process.env.GOOGLE_API_KEY);
    console.log("[AI Avatar] GOOGLE_API_KEY length:", process.env.GOOGLE_API_KEY?.length);

    // Get chat
    const { data: chat } = await db
      .from("chat")
      .select("*")
      .eq("id", chatId)
      .single();

    if (!chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    // Check if avatar was already generated today (Eastern time)
    const getEasternDate = (date: Date = new Date()): string => {
      return date.toLocaleDateString("en-US", { 
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    };

    const todayEastern = getEasternDate();

    if (chat.lastAvatarGenDate) {
      const lastGenDateEastern = getEasternDate(new Date(chat.lastAvatarGenDate));

      if (lastGenDateEastern === todayEastern) {
        console.log("[AI Avatar] Avatar already generated today (Eastern time)");
        return c.json({
          message: "Avatar already generated today. Come back tomorrow!",
          imageUrl: chat.image,
          alreadyGenerated: true
        });
      }
    }

    // Fetch last 100 messages from this chat
    const { data: recentMessages = [] } = await db
      .from("message")
      .select("*, user:user(*)")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false })
      .limit(100);

    let prompt: string;

    if (recentMessages.length === 0) {
      // No messages, generate based on chat name
      prompt = `Create a beautiful, modern, and vibrant group chat avatar image for a chat group named "${chat.name}". ${chat.bio ? `The group is about: ${chat.bio}. ` : ""}Make it colorful, friendly, and welcoming. The image should represent community and conversation.`;
      console.log("[AI Avatar] No messages found, generating based on chat name");
    } else {
      // Analyze messages to create prompt
      const messagesInOrder = recentMessages.reverse();

      // Collect key themes and topics from messages
      const messageContents = messagesInOrder
        .map(msg => {
          if (msg.messageType === "image" && msg.imageDescription) {
            return msg.imageDescription;
          }
          return msg.content;
        })
        .filter(content => content && content.trim().length > 0)
        .join(" ");

      prompt = `Analyze the following conversation and determine the main topic, theme, and overall sentiment. Then create a beautiful, modern group chat avatar image that represents that primary theme and sentiment. Do not try to combine multiple elements or create a mashup. Focus on creating a clean, cohesive image that captures the essence of what the conversation was mainly about. Conversation: "${messageContents.substring(0, 800)}". Make the avatar colorful, modern, and visually appealing.`;
      console.log("[AI Avatar] Generating based on message content");
    }

    console.log("[AI Avatar] Using prompt:", prompt.substring(0, 100) + "...");

    // Call Gemini 3 Pro Image Preview API to generate avatar
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GOOGLE_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: "1:1" }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Avatar] Gemini 3 Pro Image Preview API error:", errorText);

      // Try to parse error as JSON for better error handling
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use raw text
        return c.json({ error: "Failed to generate avatar", details: errorText }, response.status);
      }

      // Check for rate limiting (429)
      if (errorData.error?.code === 429 || errorData.error?.status === "RESOURCE_EXHAUSTED") {
        console.error("[AI Avatar] Rate limit exceeded");
        const retryDelay = errorData.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay;

        return c.json({
          error: "Avatar generation rate limit reached",
          details: `Google Gemini API quota exceeded. ${retryDelay ? `Please retry in ${retryDelay}.` : 'Please try again later.'}`,
          retryAfter: retryDelay
        }, 429);
      }

      // Check for authentication errors
      if (errorData.error?.code === 401 || errorData.error?.code === 403) {
        console.error("[AI Avatar] Authentication error");
        return c.json({
          error: "Avatar generation authentication failed",
          details: "API key is invalid or missing. Please check your Google API configuration."
        }, 403);
      }

      return c.json({
        error: "Failed to generate avatar",
        details: errorData.error?.message || errorText
      }, response.status);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart) {
      console.error("[AI Avatar] No image generated in response");
      return c.json({ error: "No avatar generated" }, 500);
    }

    const base64Image = imagePart.inlineData.data;

    // Save the avatar to Supabase Storage
    const filename = `group-avatar-${Date.now()}.png`;
    const buffer = Buffer.from(base64Image, 'base64');
    
    const imageUrl = await uploadFileToStorage(filename, buffer, "image/png");
    console.log("[AI Avatar] Avatar saved successfully to Supabase Storage:", imageUrl);

    // Update chat with new avatar
    const { error: updateError } = await db
      .from("chat")
      .update({
        image: imageUrl,
        lastAvatarGenDate: new Date().toISOString(),
        avatarPromptUsed: prompt,
      })
      .eq("id", chatId);

    if (updateError) {
      console.error("[AI Avatar] Failed to update chat:", updateError);
      return c.json({ error: "Failed to update chat with new avatar" }, 500);
    }

    console.log("[AI Avatar] Chat updated with new avatar");

    return c.json({
      message: "Avatar generated successfully",
      imageUrl: imageUrl,
      prompt: prompt,
      alreadyGenerated: false
    });
  } catch (error) {
    console.error("[AI Avatar] Error generating avatar:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.json({
      error: "Failed to generate avatar",
      details: errorMessage
    }, 500);
  }
});

// POST /api/ai/smart-replies - Generate contextual smart replies
ai.post("/smart-replies", zValidator("json", smartRepliesRequestSchema), async (c) => {
  const { chatId, userId, lastMessages } = c.req.valid("json");

  try {
    console.log("=== [Smart Replies] Starting generation ===");
    console.log("[Smart Replies] Chat ID:", chatId);
    console.log("[Smart Replies] User ID:", userId);
    console.log("[Smart Replies] Last messages count:", lastMessages.length);
    console.log("[Smart Replies] Last messages:", JSON.stringify(lastMessages, null, 2));

    // Don't generate if the last message is from the current user
    const lastMessage = lastMessages[lastMessages.length - 1];
    if (lastMessages.length > 0 && lastMessage?.isCurrentUser) {
      console.log("[Smart Replies] Last message is from current user, skipping");
      return c.json({ replies: [] });
    }

    // Build conversation context with emphasis on the most recent message
    const conversationLines = lastMessages.map((msg, index) => {
      const isLast = index === lastMessages.length - 1;
      const prefix = isLast ? ">>> MOST RECENT" : "Earlier";
      return `${prefix} - ${msg.userName}: ${msg.content}`;
    });
    const conversationContext = conversationLines.join("\n");

    console.log("[Smart Replies] Conversation context:", conversationContext);
    console.log("[Smart Replies] Calling OpenAI with model: gpt-5-mini");

    // Create a timeout promise that rejects after 25 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API call timeout after 25 seconds")), 25000);
    });

    // Call GPT-5 mini to generate smart replies with optimized parameters
    const completionPromise = openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at generating contextual quick reply suggestions for chat conversations.

YOUR TASK:
Generate exactly 3 natural, contextually relevant quick reply suggestions that directly respond to the MOST RECENT message in the conversation.

CRITICAL RULES:
1. Focus primarily on the MOST RECENT message (marked with >>>) - this is what you're replying to
2. Use earlier messages ONLY for additional context about tone and relationship
3. Each reply must be SHORT (2-6 words maximum)
4. Replies must sound NATURAL and CONVERSATIONAL
5. Match the tone: casual, friendly, professional, humorous, etc.
6. Vary the replies - give different types of responses (agreement, question, statement, emoji-enhanced)
7. Make replies ACTIONABLE - things a real person would actually send

OUTPUT FORMAT (CRITICAL):
- Generate EXACTLY 3 replies
- One reply per line
- NO numbering, NO bullets, NO quotes, NO markdown, NO extra text
- Just the raw reply text, nothing else
- Each reply on a new line

EXAMPLES:
If someone says "Want to grab lunch?"
Sure, when works?
Sounds great!
What time? 🍕

If someone says "I'm so tired"
Same here 😴
Get some rest!
Coffee time? ☕`,
        },
        {
          role: "user",
          content: `Generate quick reply suggestions for this conversation:\n\n${conversationContext}`,
        },
      ],
      // GPT-5-mini only supports default temperature (1) and no top_p
      max_completion_tokens: 2048, // Increased token limit to prevent truncation errors
    });

    // Race between the OpenAI call and the timeout
    const completion = await Promise.race([completionPromise, timeoutPromise]) as any;

    console.log("[Smart Replies] OpenAI response received");
    console.log("[Smart Replies] Full completion object:", JSON.stringify(completion, null, 2));
    
    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    console.log("[Smart Replies] Raw response text:", JSON.stringify(responseText));
    console.log("[Smart Replies] Response length:", responseText.length);
    
    // Parse the replies with enhanced cleaning
    let replies = responseText
      .split("\n")
      .map(r => {
        // Remove common prefixes/suffixes that AI might add
        let cleaned = r.trim();
        // Remove numbered lists (1., 2., etc.)
        cleaned = cleaned.replace(/^\d+[\.\)]\s*/, "");
        // Remove bullet points (-, *, •)
        cleaned = cleaned.replace(/^[-*•]\s*/, "");
        // Remove quotes
        cleaned = cleaned.replace(/^["'](.*)["']$/, "$1");
        return cleaned.trim();
      })
      .filter(r => {
        // Filter criteria:
        // - Must have content
        // - Not too short (at least 1 char)
        // - Not too long (max 100 chars)
        // - Not just punctuation or numbers
        return r.length > 0 && 
               r.length <= 100 && 
               /[a-zA-Z0-9]/.test(r);
      });
    
    console.log("[Smart Replies] Parsed replies count:", replies.length);
    console.log("[Smart Replies] Parsed replies:", JSON.stringify(replies, null, 2));
    
    // Take exactly 3 replies (as requested in prompt)
    if (replies.length > 3) {
      replies = replies.slice(0, 3);
      console.log("[Smart Replies] Trimmed to 3 replies:", JSON.stringify(replies));
    }
    
    // If we got fewer than 3 or no replies, log detailed error
    if (replies.length === 0) {
      console.error("[Smart Replies] ⚠️ AI generated no usable replies!");
      console.error("[Smart Replies] Raw response was:", responseText);
      console.error("[Smart Replies] Finish reason:", completion.choices[0]?.finish_reason);
      console.error("[Smart Replies] Usage:", JSON.stringify(completion.usage));
      return c.json({ replies: [] });
    }
    
    if (replies.length < 3) {
      console.warn("[Smart Replies] ⚠️ Only generated", replies.length, "replies (expected 3)");
      console.warn("[Smart Replies] Returning what we got:", JSON.stringify(replies));
    }

    console.log("[Smart Replies] ✅ Successfully generated", replies.length, "replies:", JSON.stringify(replies));
    console.log("=== [Smart Replies] Complete ===");

    return c.json({ replies });
  } catch (error) {
    console.error("=== [Smart Replies] ❌ ERROR ===");
    console.error("[Smart Replies] Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("[Smart Replies] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[Smart Replies] Full error:", JSON.stringify(error, null, 2));
    
    // Check if it's an OpenAI API error
    if (error && typeof error === 'object') {
      const apiError = error as any;
      if (apiError.response) {
        console.error("[Smart Replies] API Error response:", JSON.stringify(apiError.response, null, 2));
      }
      if (apiError.status) {
        console.error("[Smart Replies] API Error status:", apiError.status);
      }
      if (apiError.code) {
        console.error("[Smart Replies] API Error code:", apiError.code);
      }
    }
    console.error("=== [Smart Replies] ERROR END ===");

    // For timeout errors, gracefully return empty replies
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("timeout")) {
      console.log("[Smart Replies] ⏱️ Request timed out - returning empty replies gracefully");
      return c.json({ replies: [] }); // Graceful degradation for timeouts
    }
    
    // For connection errors to OpenAI proxy, gracefully return empty replies
    // This prevents frontend errors for a non-critical feature
    if (errorMessage.includes("Connection error") || errorMessage.includes("ConnectionRefused") || errorMessage.includes("FailedToOpenSocket")) {
      console.log("[Smart Replies] Connection error detected - returning empty replies gracefully");
      return c.json({ replies: [] }); // Graceful degradation for connection issues
    }

    // For other errors, also return empty replies to avoid breaking the UI
    // Smart replies are a nice-to-have feature, not critical
    console.log("[Smart Replies] Returning empty replies due to error");
    return c.json({ replies: [] });
  }
});

export default ai;
