import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import {
  generateCaptionRequestSchema,
  remixMediaRequestSchema,
  createMemeFromMediaRequestSchema,
} from "@shared/contracts";
import { openai } from "../env";
import { uploadFileToStorage } from "../services/storage";

const reactor = new Hono();

// POST /api/reactor/caption - Generate AI caption for media
reactor.post("/caption", zValidator("json", generateCaptionRequestSchema), async (c) => {
  try {
    const { messageId, userId, chatId } = c.req.valid("json");

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

    // Get the message with media
    const { data: message, error: messageError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError || !message || !message.imageUrl) {
      return c.json({ error: "Message not found or has no image" }, 404);
    }

    // Check if caption already exists
    const { data: existingCaption } = await db
      .from("media_reaction")
      .select("*")
      .eq("messageId", messageId)
      .eq("reactionType", "caption")
      .single();

    if (existingCaption) {
      return c.json(existingCaption);
    }

    // Generate caption using gpt-5-mini
    const imageUrl = message.imageUrl.startsWith("http")
      ? message.imageUrl
      : `${process.env.BACKEND_URL || "http://localhost:3000"}${message.imageUrl}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are a witty, creative caption writer. Generate a fun, engaging caption for images. Keep it concise (1-2 sentences) and add personality!",
        },
        {
          role: "user",
          content: `Generate a caption for this image: ${imageUrl}`,
        },
      ],
      temperature: 1,
      max_completion_tokens: 2048,
    });

    const captionText = response.choices[0]?.message?.content?.trim() || "";

    if (!captionText) {
      return c.json({ error: "Failed to generate caption" }, 500);
    }

    // Create a reply message with the caption
    const { data: captionMessage, error: captionError } = await db
      .from("message")
      .insert({
        content: `💬 ${captionText}`,
        messageType: "text",
        userId,
        chatId,
        replyToId: messageId,
      })
      .select("*")
      .single();

    if (captionError || !captionMessage) {
      console.error("Error creating caption message:", captionError);
      return c.json({ error: "Failed to create caption message" }, 500);
    }

    // Save caption as MediaReaction for tracking
    await db
      .from("media_reaction")
      .insert({
        messageId: captionMessage.id,
        userId,
        reactionType: "caption",
        resultUrl: null,
        metadata: JSON.stringify({
          originalMessageId: messageId,
          reactionType: "caption",
          model: "gpt-5",
        }),
      });

    return c.json(captionMessage, 201);
  } catch (error) {
    console.log("Error generating caption:", error);
    return c.json({ error: "Failed to generate caption" }, 500);
  }
});

// POST /api/reactor/remix - Remix media with AI
reactor.post("/remix", zValidator("json", remixMediaRequestSchema), async (c) => {
  try {
    const { messageId, userId, chatId, remixPrompt, preview } = c.req.valid("json");

    console.log("[Reactor] === Remix Request Received ===");
    console.log("[Reactor] Message ID:", messageId);
    console.log("[Reactor] User ID:", userId);
    console.log("[Reactor] Chat ID:", chatId);
    console.log("[Reactor] Remix Prompt:", remixPrompt);
    console.log("[Reactor] Preview Mode:", preview);

    // Verify user is a member of the chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", chatId)
      .eq("userId", userId)
      .single();

    if (membershipError || !membership) {
      console.error("[Reactor] User not authorized for chat");
      return c.json({ error: "User not authorized" }, 403);
    }


    console.log("[Reactor] User authorization verified");

    // Get the original message
    const { data: originalMessage, error: messageError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError || !originalMessage || !originalMessage.imageUrl) {
      console.error("[Reactor] Message not found or has no image");
      return c.json({ error: "Message not found or has no image" }, 404);
    }

    console.log("[Reactor] Original message found:", originalMessage.id);

    // Read the original image (from Supabase Storage URL or local disk) and convert to base64
    let originalImageBase64: string;
    let mimeType: string;
    
    try {
      let imageBuffer: Buffer;
      
      // Check if image is from Supabase Storage (starts with http/https)
      if (originalMessage.imageUrl.startsWith('http')) {
        console.log("[Reactor] Fetching image from Supabase Storage:", originalMessage.imageUrl);
        
        // Fetch the image from Supabase Storage
        const imageResponse = await fetch(originalMessage.imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        
        // Convert response to buffer
        const arrayBuffer = await imageResponse.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        
        // Determine mime type from Content-Type header or URL
        const contentType = imageResponse.headers.get('content-type');
        if (contentType) {
          mimeType = contentType;
        } else if (originalMessage.imageUrl.includes('.png')) {
          mimeType = 'image/png';
        } else if (originalMessage.imageUrl.includes('.jpg') || originalMessage.imageUrl.includes('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (originalMessage.imageUrl.includes('.webp')) {
          mimeType = 'image/webp';
        } else {
          mimeType = 'image/png'; // default
        }
      } else {
        // Local file path (legacy support)
        const imagePath = `./uploads/${originalMessage.imageUrl.split('/uploads/')[1]}`;
        console.log("[Reactor] Reading local image from:", imagePath);
        
        const fs = await import("fs/promises");
        imageBuffer = await fs.readFile(imagePath);
        
        // Determine mime type from file extension
        if (imagePath.endsWith('.png')) {
          mimeType = 'image/png';
        } else if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (imagePath.endsWith('.webp')) {
          mimeType = 'image/webp';
        } else {
          mimeType = 'image/png'; // default
        }
      }
      
      originalImageBase64 = imageBuffer.toString('base64');
      console.log("[Reactor] Original image loaded, size:", imageBuffer.length, "bytes, type:", mimeType);
    } catch (readError) {
      console.error("[Reactor] Failed to load original image:", readError);
      return c.json({ error: "Failed to load original image" }, 500);
    }

    // Use Gemini 3 Pro Image Preview to EDIT the original image based on the remix prompt
    console.log("[Reactor] Editing image with Gemini 3 Pro Image Preview:", remixPrompt);

    try {
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
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: originalImageBase64
                  }
                },
                {
                  text: remixPrompt
                }
              ]
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
        console.log("[Reactor] Gemini 3 Pro Image Preview API error:", errorText);

        // Try to parse error as JSON for better error handling
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use raw text
          return c.json({ error: "Failed to generate remix", details: errorText }, response.status as any);
        }

        // Check for rate limiting (429)
        if (errorData.error?.code === 429 || errorData.error?.status === "RESOURCE_EXHAUSTED") {
          console.error("[Reactor] Rate limit exceeded");
          const retryDelay = errorData.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay;

          return c.json({
            error: "Image remix rate limit reached",
            details: `Google Gemini API quota exceeded. ${retryDelay ? `Please retry in ${retryDelay}.` : 'Please try again later.'}`,
            retryAfter: retryDelay
          }, 429);
        }

        // Check for authentication errors
        if (errorData.error?.code === 401 || errorData.error?.code === 403) {
          console.error("[Reactor] Authentication error");
          return c.json({
            error: "Image remix authentication failed",
            details: "API key is invalid or missing. Please check your Google API configuration."
          }, 403);
        }

        return c.json({
          error: "Failed to generate remix",
          details: errorData.error?.message || errorText
        }, response.status as any);
      }

      const data = await response.json();
      const imagePart = (data as any).candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

      if (!imagePart) {
        console.log("[Reactor] No image generated in response");

        // Check if content was blocked
        if ((data as any).promptFeedback?.blockReason) {
          return c.json({
            error: "Image generation blocked by safety filters. Try a different prompt.",
            details: (data as any).promptFeedback?.blockReason
          }, 400);
        }

        // Check if NO_IMAGE finish reason
        const finishReason = (data as any).candidates?.[0]?.finishReason;
        if (finishReason === "NO_IMAGE") {
          return c.json({
            error: "Unable to generate remix for this prompt. Try simplifying or changing your request.",
            details: "Model declined to generate image"
          }, 400);
        }

        return c.json({ error: "No image generated" }, 500);
      }

      const base64Image = imagePart.inlineData.data;
      console.log("[Reactor] ✅ Image generated successfully, size:", base64Image.length, "bytes");

      // Save the image to Supabase Storage
      const filename = `remix_${Date.now()}.png`;
      const buffer = Buffer.from(base64Image, 'base64');
      const savedImageUrl = await uploadFileToStorage(filename, buffer, "image/png");
      console.log("[Reactor] ✅ Image saved to Supabase Storage:", savedImageUrl);

      // If preview mode, return without creating message
      if (preview) {
        const previewId = `prev-remix-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        console.log("[Reactor] Returning preview response:", { imageUrl: savedImageUrl, previewId });
        return c.json({
          imageUrl: savedImageUrl,
          previewId,
          prompt: remixPrompt,
          metadata: {
            originalMessageId: messageId,
            reactionType: "remix",
            model: "gemini-3-pro-image-preview"
          }
        });
      }

      // Create new message with remixed image
      const { data: remixedMessage, error: remixError } = await db
        .from("message")
        .insert({
          content: `🎨 Remixed: ${remixPrompt}`,
          messageType: "image",
          imageUrl: savedImageUrl,
          userId,
          chatId,
        })
        .select("*")
        .single();

      if (remixError || !remixedMessage) {
        console.error("[Reactor] Error creating remix message:", remixError);
        return c.json({ error: "Failed to create remix message" }, 500);
      }

      console.log("[Reactor] ✅ Remix message created successfully:", remixedMessage.id);

      // Create MediaReaction record
      await db
        .from("media_reaction")
        .insert({
          messageId: remixedMessage.id,
          userId,
          reactionType: "remix",
          resultUrl: savedImageUrl,
          metadata: JSON.stringify({
            originalMessageId: messageId,
            reactionType: "remix",
            prompt: remixPrompt,
            model: "gemini-3-pro-image-preview",
          }),
        });

      console.log("[Reactor] Remix complete, message created");
      return c.json(remixedMessage, 201);
    } catch (aiError: any) {
      console.log("[Reactor] Gemini 3 Pro Image Preview API error:", aiError.message);
      // Check if it's a service unavailability error
      if (aiError.message?.includes("503") || aiError.message?.includes("unavailable") || aiError.message?.includes("Connection")) {
        return c.json({
          error: "Image generation service temporarily unavailable",
          details: "Please try again in a few moments"
        }, 503);
      }
      throw aiError;
    }
  } catch (error) {
    console.log("Error remixing media:", error);
    return c.json({ error: "Failed to remix media" }, 500);
  }
});

// POST /api/reactor/meme-from-media - Create meme from media
reactor.post("/meme-from-media", zValidator("json", createMemeFromMediaRequestSchema), async (c) => {
  try {
    const { messageId, userId, chatId, memePrompt, preview } = c.req.valid("json");

    console.log("[Reactor] === Meme Request Received ===");
    console.log("[Reactor] Message ID:", messageId);
    console.log("[Reactor] User ID:", userId);
    console.log("[Reactor] Chat ID:", chatId);
    console.log("[Reactor] Meme Prompt:", memePrompt);
    console.log("[Reactor] Preview Mode:", preview);

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

    // Get the original message
    const { data: originalMessage, error: messageError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError || !originalMessage || !originalMessage.imageUrl) {
      return c.json({ error: "Message not found or has no image" }, 404);
    }

    console.log("[Reactor] Original message found:", originalMessage.id);

    // Read the original image (from Supabase Storage URL or local disk) and convert to base64
    let originalImageBase64: string;
    let mimeType: string;
    
    try {
      let imageBuffer: Buffer;
      
      // Check if image is from Supabase Storage (starts with http/https)
      if (originalMessage.imageUrl.startsWith('http')) {
        console.log("[Reactor] Fetching image from Supabase Storage:", originalMessage.imageUrl);
        
        // Fetch the image from Supabase Storage
        const imageResponse = await fetch(originalMessage.imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        
        // Convert response to buffer
        const arrayBuffer = await imageResponse.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        
        // Determine mime type from Content-Type header or URL
        const contentType = imageResponse.headers.get('content-type');
        if (contentType) {
          mimeType = contentType;
        } else if (originalMessage.imageUrl.includes('.png')) {
          mimeType = 'image/png';
        } else if (originalMessage.imageUrl.includes('.jpg') || originalMessage.imageUrl.includes('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (originalMessage.imageUrl.includes('.webp')) {
          mimeType = 'image/webp';
        } else {
          mimeType = 'image/png'; // default
        }
      } else {
        // Local file path (legacy support)
        const imagePath = `./uploads/${originalMessage.imageUrl.split('/uploads/')[1]}`;
        console.log("[Reactor] Reading local image from:", imagePath);
        
        const fs = await import("fs/promises");
        imageBuffer = await fs.readFile(imagePath);
        
        // Determine mime type from file extension
        if (imagePath.endsWith('.png')) {
          mimeType = 'image/png';
        } else if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (imagePath.endsWith('.webp')) {
          mimeType = 'image/webp';
        } else {
          mimeType = 'image/png'; // default
        }
      }
      
      originalImageBase64 = imageBuffer.toString('base64');
      console.log("[Reactor] Original image loaded for meme, size:", imageBuffer.length, "bytes, type:", mimeType);
    } catch (readError) {
      console.error("[Reactor] Failed to load original image:", readError);
      return c.json({ error: "Failed to load original image" }, 500);
    }

    // Generate meme using Gemini 3 Pro Image Preview - transform the original image into a meme
    const fullMemePrompt = memePrompt 
      ? `Transform this image by incorporating it into a recent, well-known meme template based on this prompt: "${memePrompt}". The goal is to be incredibly relevant to the prompt and image, and be both funny and poignant. Use the original image as a key element within the meme template.`
      : `Transform this image by incorporating it into a recent, well-known meme template. The goal is to be incredibly relevant to the image content, and be both funny and poignant. Use the original image as a key element within the meme template to create a viral-style meme.`;
    
    console.log("[Reactor] Creating meme from image with Gemini 3 Pro Image Preview:", fullMemePrompt);

    try {
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
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: originalImageBase64
                  }
                },
                {
                  text: fullMemePrompt
                }
              ]
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
        console.log("[Reactor] Gemini 3 Pro Image Preview API error:", errorText);

        // Try to parse error as JSON for better error handling
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use raw text
          return c.json({ error: "Failed to generate meme", details: errorText }, response.status as any);
        }

        // Check for rate limiting (429)
        if (errorData.error?.code === 429 || errorData.error?.status === "RESOURCE_EXHAUSTED") {
          console.error("[Reactor] Rate limit exceeded");
          const retryDelay = errorData.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay;

          return c.json({
            error: "Meme generation rate limit reached",
            details: `Google Gemini API quota exceeded. ${retryDelay ? `Please retry in ${retryDelay}.` : 'Please try again later.'}`,
            retryAfter: retryDelay
          }, 429);
        }

        // Check for authentication errors
        if (errorData.error?.code === 401 || errorData.error?.code === 403) {
          console.error("[Reactor] Authentication error");
          return c.json({
            error: "Meme generation authentication failed",
            details: "API key is invalid or missing. Please check your Google API configuration."
          }, 403);
        }

        return c.json({
          error: "Failed to generate meme",
          details: errorData.error?.message || errorText
        }, response.status as any);
      }

      const data = await response.json();
      const imagePart = (data as any).candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

      if (!imagePart) {
        console.log("[Reactor] No meme generated in response");

        // Check if content was blocked
        if ((data as any).promptFeedback?.blockReason) {
          return c.json({
            error: "Meme generation blocked by safety filters. Try a different style.",
            details: (data as any).promptFeedback?.blockReason
          }, 400);
        }

        // Check if NO_IMAGE finish reason
        const finishReason = (data as any).candidates?.[0]?.finishReason;
        if (finishReason === "NO_IMAGE") {
          return c.json({
            error: "Unable to generate meme. Try a different style or concept.",
            details: "Model declined to generate image"
          }, 400);
        }

        return c.json({ error: "No meme generated" }, 500);
      }

      const base64Image = imagePart.inlineData.data;
      console.log("[Reactor] Meme generated successfully");

      // Save the meme to Supabase Storage
      const filename = `meme_${Date.now()}.png`;
      const buffer = Buffer.from(base64Image, 'base64');
      const savedImageUrl = await uploadFileToStorage(filename, buffer, "image/png");
      console.log("[Reactor] Meme saved to Supabase Storage:", savedImageUrl);

      // If preview mode, return without creating message
      if (preview) {
        const previewId = `prev-meme-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        console.log("[Reactor] Returning preview response:", { imageUrl: savedImageUrl, previewId });
        return c.json({
          imageUrl: savedImageUrl,
          previewId,
          prompt: fullMemePrompt, // Return the FULL prompt used
          metadata: {
            originalMessageId: messageId,
            reactionType: "meme",
            prompt: fullMemePrompt,
            model: "gemini-3-pro-image-preview"
          }
        });
      }

      // Create new message with meme
      const { data: memeMessage, error: memeError } = await db
        .from("message")
        .insert({
          content: memePrompt ? `🔥 ${memePrompt}` : "🔥 Fresh meme just dropped!",
          messageType: "image",
          imageUrl: savedImageUrl,
          userId,
          chatId,
        })
        .select("*")
        .single();

      if (memeError || !memeMessage) {
        console.error("[Reactor] Error creating meme message:", memeError);
        return c.json({ error: "Failed to create meme message" }, 500);
      }

      console.log("[Reactor] ✅ Meme message created successfully:", memeMessage.id);

      // Create MediaReaction record
      await db
        .from("media_reaction")
        .insert({
          messageId: memeMessage.id,
          userId,
          reactionType: "meme",
          resultUrl: savedImageUrl,
          metadata: JSON.stringify({
            originalMessageId: messageId,
            reactionType: "meme",
            prompt: fullMemePrompt,
            model: "gemini-3-pro-image-preview",
          }),
        });

      console.log("[Reactor] Meme complete, message created");
      return c.json(memeMessage, 201);
    } catch (aiError: any) {
      console.log("[Reactor] Gemini 3 Pro Image Preview API error:", aiError.message);
      // Check if it's a service unavailability error
      if (aiError.message?.includes("503") || aiError.message?.includes("unavailable") || aiError.message?.includes("Connection")) {
        return c.json({
          error: "Image generation service temporarily unavailable",
          details: "Please try again in a few moments"
        }, 503);
      }
      throw aiError;
    }
  } catch (error) {
    console.log("Error creating meme:", error);
    return c.json({ error: "Failed to create meme" }, 500);
  }
});

export default reactor;

