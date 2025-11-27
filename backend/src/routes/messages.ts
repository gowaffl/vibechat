import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppType } from "../index";
import {
  getMessagesResponseSchema,
  sendMessageRequestSchema,
  sendMessageResponseSchema,
  clearMessagesResponseSchema,
  updateMessageDescriptionRequestSchema,
  updateMessageDescriptionResponseSchema,
  editMessageRequestSchema,
  editMessageResponseSchema,
  unsendMessageRequestSchema,
  unsendMessageResponseSchema,
} from "../../../shared/contracts";
import { db } from "../db";
import { generateImageDescription } from "../services/image-description";
import { extractFirstUrl } from "../utils/url-utils";
import { fetchLinkPreview } from "../services/link-preview";
import { tagMessage } from "../services/message-tagger";

const messages = new Hono<AppType>();

// GET /api/messages - Get all messages
messages.get("/", async (c) => {
  const { data: allMessages, error } = await db
    .from("message")
    .select(`
      *,
      user:user!message_userId_fkey(*),
      replyTo:message(
        *,
        user:user!message_userId_fkey(*)
      ),
      reactions:reaction(*)
    `)
    .order("createdAt", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[Messages] Error fetching messages:", error);
    return c.json({ error: "Failed to fetch messages" }, 500);
  }

  const formattedMessages = await Promise.all(allMessages.map(async (msg: any) => {
    // Fetch user for this message
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", msg.userId)
      .single();

    // Fetch replyTo message if exists
    let replyTo = null;
    if (msg.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", msg.replyToId)
        .single();
      
      if (replyToMsg) {
        const { data: replyToUser } = await db
          .from("user")
          .select("*")
          .eq("id", replyToMsg.userId)
          .single();
        
        replyTo = replyToUser ? {
          id: replyToMsg.id,
          content: replyToMsg.content,
          messageType: replyToMsg.messageType,
          imageUrl: replyToMsg.imageUrl,
          imageDescription: replyToMsg.imageDescription,
          userId: replyToMsg.userId,
          chatId: replyToMsg.chatId,
          replyToId: replyToMsg.replyToId,
          editedAt: replyToMsg.editedAt ? new Date(replyToMsg.editedAt).toISOString() : null,
          isUnsent: replyToMsg.isUnsent,
          editHistory: replyToMsg.editHistory,
          createdAt: new Date(replyToMsg.createdAt).toISOString(),
          user: {
            id: replyToUser.id,
            name: replyToUser.name,
            bio: replyToUser.bio,
            image: replyToUser.image,
            hasCompletedOnboarding: replyToUser.hasCompletedOnboarding,
            createdAt: new Date(replyToUser.createdAt).toISOString(),
            updatedAt: new Date(replyToUser.updatedAt).toISOString(),
          },
        } : null;
      }
    }

    // Fetch reactions for this message
    const { data: reactions = [] } = await db
      .from("reaction")
      .select("*")
      .eq("messageId", msg.id);

    return {
      id: msg.id,
      content: msg.content,
      messageType: msg.messageType,
      imageUrl: msg.imageUrl,
      imageDescription: msg.imageDescription,
      userId: msg.userId,
      chatId: msg.chatId,
      replyToId: msg.replyToId,
      editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
      isUnsent: msg.isUnsent,
      editHistory: msg.editHistory,
      createdAt: new Date(msg.createdAt).toISOString(),
      linkPreview: msg.linkPreviewUrl ? {
        url: msg.linkPreviewUrl,
        title: msg.linkPreviewTitle,
        description: msg.linkPreviewDescription,
        image: msg.linkPreviewImage,
        siteName: msg.linkPreviewSiteName,
        favicon: msg.linkPreviewFavicon,
      } : null,
      user: user ? {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      } : null,
      replyTo,
      reactions: reactions.map((reaction: any) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        messageId: reaction.messageId,
        createdAt: new Date(reaction.createdAt).toISOString(),
      })),
    };
  }));

  return c.json(getMessagesResponseSchema.parse(formattedMessages));
});

// POST /api/messages - Send message
messages.post("/", zValidator("json", sendMessageRequestSchema), async (c) => {
  const { content, messageType, imageUrl, voiceUrl, voiceDuration, userId, replyToId, mentionedUserIds } = c.req.valid("json");

  // Create the message
  const { data: message, error: messageError } = await db
    .from("message")
    .insert({
      content: content || "",
      messageType: messageType || "text",
      imageUrl: imageUrl || null,
      voiceUrl: voiceUrl || null,
      voiceDuration: voiceDuration || null,
      userId,
      replyToId: replyToId || null,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    console.error("[Messages] Error creating message:", messageError);
    return c.json({ error: "Failed to create message" }, 500);
  }

  // Fetch user
  const { data: user, error: userError } = await db
    .from("user")
    .select("*")
    .eq("id", message.userId)
    .single();

  if (userError || !user) {
    console.error("[Messages] Error fetching user:", userError);
    return c.json({ error: "Failed to fetch user" }, 500);
  }

  // Fetch replyTo if exists
  let replyTo = null;
  if (message.replyToId) {
    const { data: replyToMsg } = await db
      .from("message")
      .select("*")
      .eq("id", message.replyToId)
      .single();
    
    if (replyToMsg) {
      const { data: replyToUser } = await db
        .from("user")
        .select("*")
        .eq("id", replyToMsg.userId)
        .single();
      
      if (replyToUser) {
        replyTo = {
          ...replyToMsg,
          user: replyToUser,
        };
      }
    }
  }

  // Create mention records if any users were mentioned
  let mentions: any[] = [];
  if (mentionedUserIds && mentionedUserIds.length > 0) {
    console.log(`[@] Creating ${mentionedUserIds.length} mention(s) for message ${message.id}`);
    
    // Insert mentions
    const { error: mentionError } = await db
      .from("mention")
      .insert(
        mentionedUserIds.map(mentionedUserId => ({
          messageId: message.id,
          mentionedUserId,
          mentionedByUserId: userId,
        }))
      );
    
    if (mentionError) {
      console.error("[Messages] Error creating mentions:", mentionError);
    }
    
    // Fetch the created mentions with user data
    const { data: createdMentions } = await db
      .from("mention")
      .select("*")
      .eq("messageId", message.id);
    
    if (createdMentions) {
      mentions = await Promise.all(createdMentions.map(async (mention: any) => {
        const { data: mentionedUser } = await db
          .from("user")
          .select("*")
          .eq("id", mention.mentionedUserId)
          .single();
        
        const { data: mentionedBy } = await db
          .from("user")
          .select("*")
          .eq("id", mention.mentionedByUserId)
          .single();
        
        return {
          ...mention,
          mentionedUser,
          mentionedBy,
        };
      }));
    }
  }

  // Auto-tag message for smart threads (fire-and-forget, immediate)
  if (content && content.trim().length > 0) {
    tagMessage(message.id, content).catch(error => {
      console.error(`[Messages] Failed to tag message ${message.id}:`, error);
    });
  }

  // If this is an image message, trigger async description generation
  if (messageType === "image" && imageUrl) {
    console.log(`🖼️ [Messages] Image message created (${message.id}), triggering description generation`);

    // Get backend URL from environment or construct it
    const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
                       process.env.BACKEND_URL ||
                       `http://localhost:${process.env.PORT || 3000}`;

    // Fire-and-forget: Generate description in background
    Promise.resolve().then(async () => {
      try {
        console.log(`🔄 [Messages] Starting background description generation for message ${message.id}`);
        const description = await generateImageDescription(imageUrl, backendUrl);

        // Update the message with the description
        await db
          .from("message")
          .update({ imageDescription: description })
          .eq("id", message.id);

        console.log(`✅ [Messages] Description saved for message ${message.id}`);
      } catch (error) {
        console.error(`❌ [Messages] Failed to generate description for message ${message.id}:`, error);
      }
    });
  }

  // If this is a text message, check for URLs and fetch link preview
  if (messageType === "text" && content) {
    const url = extractFirstUrl(content);
    if (url) {
      console.log(`🔗 [Messages] URL detected in message (${message.id}), fetching link preview: ${url}`);

      // Fire-and-forget: Fetch link preview in background
      Promise.resolve().then(async () => {
        try {
          console.log(`🔄 [Messages] Starting background link preview fetch for message ${message.id}`);
          const linkPreview = await fetchLinkPreview(url);

          if (linkPreview) {
            // Update the message with the link preview
            await db
              .from("message")
              .update({
                linkPreviewUrl: linkPreview.url,
                linkPreviewTitle: linkPreview.title,
                linkPreviewDescription: linkPreview.description,
                linkPreviewImage: linkPreview.image,
                linkPreviewSiteName: linkPreview.siteName,
                linkPreviewFavicon: linkPreview.favicon,
              })
              .eq("id", message.id);

            console.log(`✅ [Messages] Link preview saved for message ${message.id}`);
          } else {
            console.log(`⚠️ [Messages] No link preview data available for ${url}`);
          }
        } catch (error) {
          console.error(`❌ [Messages] Failed to fetch link preview for message ${message.id}:`, error);
        }
      });
    }
  }

  return c.json(sendMessageResponseSchema.parse({
    id: message.id,
    content: message.content,
    messageType: message.messageType,
    imageUrl: message.imageUrl,
    imageDescription: message.imageDescription,
    userId: message.userId,
    chatId: message.chatId,
    replyToId: message.replyToId,
    editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
    isUnsent: message.isUnsent,
    editHistory: message.editHistory,
    createdAt: new Date(message.createdAt).toISOString(),
    linkPreview: null, // Will be populated asynchronously
    user: {
      id: user.id,
      name: user.name,
      bio: user.bio,
      image: user.image,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    },
    replyTo: replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          messageType: replyTo.messageType,
          imageUrl: replyTo.imageUrl,
          imageDescription: replyTo.imageDescription,
          userId: replyTo.userId,
          chatId: replyTo.chatId,
          replyToId: replyTo.replyToId,
          editedAt: replyTo.editedAt ? new Date(replyTo.editedAt).toISOString() : null,
          isUnsent: replyTo.isUnsent,
          editHistory: replyTo.editHistory,
          createdAt: new Date(replyTo.createdAt).toISOString(),
          user: {
            id: replyTo.user.id,
            name: replyTo.user.name,
            bio: replyTo.user.bio,
            image: replyTo.user.image,
            hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding,
            createdAt: new Date(replyTo.user.createdAt).toISOString(),
            updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
          },
        }
      : null,
    reactions: [],
    mentions: mentions.map((mention) => ({
      id: mention.id,
      messageId: mention.messageId,
      mentionedUserId: mention.mentionedUserId,
      mentionedByUserId: mention.mentionedByUserId,
      createdAt: new Date(mention.createdAt).toISOString(),
      mentionedUser: {
        id: mention.mentionedUser.id,
        name: mention.mentionedUser.name,
        bio: mention.mentionedUser.bio,
        image: mention.mentionedUser.image,
        hasCompletedOnboarding: mention.mentionedUser.hasCompletedOnboarding,
        createdAt: new Date(mention.mentionedUser.createdAt).toISOString(),
        updatedAt: new Date(mention.mentionedUser.updatedAt).toISOString(),
      },
      mentionedBy: {
        id: mention.mentionedBy.id,
        name: mention.mentionedBy.name,
        bio: mention.mentionedBy.bio,
        image: mention.mentionedBy.image,
        hasCompletedOnboarding: mention.mentionedBy.hasCompletedOnboarding,
        createdAt: new Date(mention.mentionedBy.createdAt).toISOString(),
        updatedAt: new Date(mention.mentionedBy.updatedAt).toISOString(),
      },
    })),
  }));
});

// DELETE /api/messages/clear - Clear all messages
messages.delete("/clear", async (c) => {
  try {
    // Delete all messages
    const { error, count } = await db
      .from("message")
      .delete()
      .neq("id", "");  // Delete all (Supabase requires a condition)

    if (error) {
      console.error("Error clearing messages:", error);
      return c.json(clearMessagesResponseSchema.parse({
        success: false,
        message: "Failed to clear messages",
        deletedCount: 0,
      }), 500);
    }

    return c.json(clearMessagesResponseSchema.parse({
      success: true,
      message: "All messages cleared successfully",
      deletedCount: count || 0,
    }));
  } catch (error) {
    console.error("Error clearing messages:", error);
    return c.json(clearMessagesResponseSchema.parse({
      success: false,
      message: "Failed to clear messages",
      deletedCount: 0,
    }), 500);
  }
});

// PATCH /api/messages/:id/description - Update message description
messages.patch("/:id/description", zValidator("json", updateMessageDescriptionRequestSchema), async (c) => {
  try {
    const messageId = c.req.param("id");
    const { imageDescription } = c.req.valid("json");

    console.log(`📝 [Messages] Updating description for message ${messageId}`);

    // Update the message with the description
    const { data: updatedMessage, error: updateError } = await db
      .from("message")
      .update({ imageDescription })
      .eq("id", messageId)
      .select("*")
      .single();

    if (updateError || !updatedMessage) {
      console.error("Error updating message description:", updateError);
      return c.json({ error: "Failed to update message description" }, 500);
    }

    // Fetch user
    const { data: user, error: userError } = await db
      .from("user")
      .select("*")
      .eq("id", updatedMessage.userId)
      .single();

    if (userError || !user) {
      console.error("Error fetching user:", userError);
      return c.json({ error: "Failed to fetch user" }, 500);
    }

    console.log(`✅ [Messages] Description updated for message ${messageId}`);

    return c.json(updateMessageDescriptionResponseSchema.parse({
      id: updatedMessage.id,
      content: updatedMessage.content,
      messageType: updatedMessage.messageType,
      imageUrl: updatedMessage.imageUrl,
      imageDescription: updatedMessage.imageDescription,
      userId: updatedMessage.userId,
      createdAt: new Date(updatedMessage.createdAt).toISOString(),
      user: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      },
    }));
  } catch (error) {
    console.error("Error updating message description:", error);
    return c.json({ error: "Failed to update message description" }, 500);
  }
});

// PATCH /api/messages/:id - Edit a message
messages.patch("/:id", zValidator("json", editMessageRequestSchema), async (c) => {
  try {
    const messageId = c.req.param("id");
    const { content, userId } = c.req.valid("json");

    console.log(`✏️  [Messages] Edit request for message ${messageId} by user ${userId}`);

    // Fetch the message to check ownership and timestamp
    const { data: message, error: fetchError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Check ownership - only the message sender can edit
    if (message.userId !== userId) {
      return c.json({ error: "You can only edit your own messages" }, 403);
    }

    // Check if message is within 15 minute edit window
    const now = new Date();
    const messageAge = now.getTime() - new Date(message.createdAt).getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (messageAge > fifteenMinutes) {
      return c.json({ error: "Message can only be edited within 15 minutes of sending" }, 400);
    }

    // Store edit history
    let editHistory: any[] = [];
    if (message.editHistory) {
      try {
        editHistory = JSON.parse(message.editHistory);
      } catch (e) {
        editHistory = [];
      }
    }
    
    editHistory.push({
      content: message.content,
      editedAt: now.toISOString(),
    });

    // Update the message
    const { data: updatedMessage, error: updateError } = await db
      .from("message")
      .update({
        content,
        editedAt: now.toISOString(),
        editHistory: JSON.stringify(editHistory),
      })
      .eq("id", messageId)
      .select("*")
      .single();

    if (updateError || !updatedMessage) {
      console.error("Error updating message:", updateError);
      return c.json({ error: "Failed to edit message" }, 500);
    }

    // Fetch user
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", updatedMessage.userId)
      .single();

    // Fetch reactions
    const { data: reactions = [] } = await db
      .from("reaction")
      .select("*")
      .eq("messageId", updatedMessage.id);

    // Fetch replyTo if exists
    let replyTo = null;
    if (updatedMessage.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", updatedMessage.replyToId)
        .single();
      
      if (replyToMsg) {
        const { data: replyToUser } = await db
          .from("user")
          .select("*")
          .eq("id", replyToMsg.userId)
          .single();
        
        if (replyToUser) {
          replyTo = {
            ...replyToMsg,
            user: replyToUser,
          };
        }
      }
    }

    console.log(`✅ [Messages] Message ${messageId} edited successfully`);

    return c.json(editMessageResponseSchema.parse({
      id: updatedMessage.id,
      content: updatedMessage.content,
      messageType: updatedMessage.messageType,
      imageUrl: updatedMessage.imageUrl,
      imageDescription: updatedMessage.imageDescription,
      userId: updatedMessage.userId,
      chatId: updatedMessage.chatId,
      replyToId: updatedMessage.replyToId,
      editedAt: updatedMessage.editedAt ? new Date(updatedMessage.editedAt).toISOString() : null,
      isUnsent: updatedMessage.isUnsent,
      editHistory: updatedMessage.editHistory,
      createdAt: new Date(updatedMessage.createdAt).toISOString(),
      user: user ? {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      } : null,
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        messageType: replyTo.messageType,
        imageUrl: replyTo.imageUrl,
        imageDescription: replyTo.imageDescription,
        userId: replyTo.userId,
        chatId: replyTo.chatId,
        replyToId: replyTo.replyToId,
        createdAt: new Date(replyTo.createdAt).toISOString(),
        user: {
          id: replyTo.user.id,
          name: replyTo.user.name,
          bio: replyTo.user.bio,
          image: replyTo.user.image,
          hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding,
          createdAt: new Date(replyTo.user.createdAt).toISOString(),
          updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
        },
      } : null,
      reactions: reactions.map((reaction: any) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        messageId: reaction.messageId,
        createdAt: new Date(reaction.createdAt).toISOString(),
      })),
    }));
  } catch (error) {
    console.error("Error editing message:", error);
    return c.json({ error: "Failed to edit message" }, 500);
  }
});

// POST /api/messages/:id/unsend - Unsend a message
messages.post("/:id/unsend", zValidator("json", unsendMessageRequestSchema), async (c) => {
  try {
    const messageId = c.req.param("id");
    const { userId } = c.req.valid("json");

    console.log(`🚫 [Messages] Unsend request for message ${messageId} by user ${userId}`);

    // Fetch the message to check ownership and timestamp
    const { data: message, error: fetchError } = await db
      .from("message")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Check ownership - only the message sender can unsend
    if (message.userId !== userId) {
      return c.json({ error: "You can only unsend your own messages" }, 403);
    }

    // Check if message is within 2 minute unsend window
    const now = new Date();
    const messageAge = now.getTime() - new Date(message.createdAt).getTime();
    const twoMinutes = 2 * 60 * 1000;

    if (messageAge > twoMinutes) {
      return c.json({ error: "Message can only be unsent within 2 minutes of sending" }, 400);
    }

    // Fetch chat name for system message
    const { data: chat } = await db
      .from("chat")
      .select("name")
      .eq("id", message.chatId)
      .single();

    // Mark message as unsent
    const { data: updatedMessage, error: updateError } = await db
      .from("message")
      .update({
        isUnsent: true,
        content: "", // Clear content for unsent messages
      })
      .eq("id", messageId)
      .select("*")
      .single();

    if (updateError || !updatedMessage) {
      console.error("Error unsending message:", updateError);
      return c.json({ error: "Failed to unsend message" }, 500);
    }

    // Fetch user
    const { data: user } = await db
      .from("user")
      .select("*")
      .eq("id", updatedMessage.userId)
      .single();

    // Fetch reactions
    const { data: reactions = [] } = await db
      .from("reaction")
      .select("*")
      .eq("messageId", updatedMessage.id);

    // Fetch replyTo if exists
    let replyTo = null;
    if (updatedMessage.replyToId) {
      const { data: replyToMsg } = await db
        .from("message")
        .select("*")
        .eq("id", updatedMessage.replyToId)
        .single();
      
      if (replyToMsg) {
        const { data: replyToUser } = await db
          .from("user")
          .select("*")
          .eq("id", replyToMsg.userId)
          .single();
        
        if (replyToUser) {
          replyTo = {
            ...replyToMsg,
            user: replyToUser,
          };
        }
      }
    }

    // Create a system message indicating the unsend action
    await db
      .from("message")
      .insert({
        content: `You unsent a message. ${chat?.name || "The chat"} may still see the message on devices where the software hasn't been updated.`,
        messageType: "system",
        userId: "system",
        chatId: message.chatId,
      });

    console.log(`✅ [Messages] Message ${messageId} unsent successfully`);

    return c.json(unsendMessageResponseSchema.parse({
      id: updatedMessage.id,
      content: updatedMessage.content,
      messageType: updatedMessage.messageType,
      imageUrl: updatedMessage.imageUrl,
      imageDescription: updatedMessage.imageDescription,
      userId: updatedMessage.userId,
      chatId: updatedMessage.chatId,
      replyToId: updatedMessage.replyToId,
      editedAt: updatedMessage.editedAt ? new Date(updatedMessage.editedAt).toISOString() : null,
      isUnsent: updatedMessage.isUnsent,
      editHistory: updatedMessage.editHistory,
      createdAt: new Date(updatedMessage.createdAt).toISOString(),
      user: user ? {
        id: user.id,
        name: user.name,
        bio: user.bio,
        image: user.image,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      } : null,
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        messageType: replyTo.messageType,
        imageUrl: replyTo.imageUrl,
        imageDescription: replyTo.imageDescription,
        userId: replyTo.userId,
        chatId: replyTo.chatId,
        replyToId: replyTo.replyToId,
        createdAt: new Date(replyTo.createdAt).toISOString(),
        user: {
          id: replyTo.user.id,
          name: replyTo.user.name,
          bio: replyTo.user.bio,
          image: replyTo.user.image,
          hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding,
          createdAt: new Date(replyTo.user.createdAt).toISOString(),
          updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
        },
      } : null,
      reactions: reactions.map((reaction: any) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        messageId: reaction.messageId,
        createdAt: new Date(reaction.createdAt).toISOString(),
      })),
    }));
  } catch (error) {
    console.error("Error unsending message:", error);
    return c.json({ error: "Failed to unsend message" }, 500);
  }
});

// DELETE /api/messages/:id - Delete a specific message
messages.delete("/:id", async (c) => {
  try {
    const messageId = c.req.param("id");
    const userId = c.req.query("userId");
    const chatId = c.req.query("chatId");

    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    if (!chatId) {
      return c.json({ error: "chatId is required" }, 400);
    }

    console.log(`🗑️  [Messages] Delete request for message ${messageId} by user ${userId}`);

    // Fetch the message to check ownership
    const { data: message, error: fetchError } = await db
      .from("message")
      .select("userId, chatId")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Fetch chat to check creator
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("creatorId")
      .eq("id", message.chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    // Check permissions:
    // 1. User can delete their own messages
    // 2. Chat creator can delete AI messages (identified by having an aiFriendId)
    const isOwnMessage = message.userId === userId;
    const isAIMessage = message.aiFriendId !== null; // AI messages have an aiFriendId
    const isCreator = chat.creatorId === userId;

    if (!isOwnMessage && !(isAIMessage && isCreator)) {
      return c.json({ error: "You don't have permission to delete this message" }, 403);
    }

    // Delete the message (will cascade delete reactions)
    const { error: deleteError } = await db
      .from("message")
      .delete()
      .eq("id", messageId);

    if (deleteError) {
      console.error("Error deleting message:", deleteError);
      return c.json({ error: "Failed to delete message" }, 500);
    }

    console.log(`✅ [Messages] Message ${messageId} deleted successfully`);

    return c.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return c.json({ error: "Failed to delete message" }, 500);
  }
});

export default messages;
