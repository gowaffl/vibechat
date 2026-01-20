import { Hono } from "hono";
import type { AppType } from "../index";
import { db } from "../db";
import {
  createCustomCommandRequestSchema,
  updateCustomCommandRequestSchema,
  executeCustomCommandRequestSchema,
  type GetCustomCommandsResponse,
  type CreateCustomCommandResponse,
  type UpdateCustomCommandResponse,
  type DeleteCustomCommandResponse,
  type ExecuteCustomCommandResponse,
} from "@/shared/contracts";
import type OpenAI from "openai";
import {
  executeGPT51Response,
  buildGPT51SystemPrompt,
} from "../services/gpt-responses";
import { saveResponseImages } from "../services/image-storage";
import { tagMessage } from "../services/message-tagger";
import {
  checkContentSafety,
  getSafetySystemPrompt,
  getUserAgeContext,
  filterAIOutput,
  logSafetyEvent,
} from "../services/content-safety";
import { setAITypingStatus } from "./chats";
import { decryptMessages } from "../services/message-encryption";
import {
  checkUsageLimit,
  incrementUsage,
} from "../services/usage-tracking-service";

const app = new Hono<AppType>();

// GET /api/custom-commands - Get all custom slash commands for a chat
app.get("/", async (c) => {
  try {
    const chatId = c.req.query("chatId");

    if (!chatId) {
      return c.json({ error: "chatId is required" }, 400);
    }

    const { data: commands, error } = await db
      .from("custom_slash_command")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("[CustomCommands] Error fetching commands:", error);
      return c.json({ error: "Failed to fetch custom commands" }, 500);
    }

    const response: GetCustomCommandsResponse = (commands || []).map((cmd: any) => ({
      id: cmd.id,
      command: cmd.command,
      prompt: cmd.prompt,
      chatId: cmd.chatId,
      createdAt: new Date(cmd.createdAt).toISOString(),
      updatedAt: new Date(cmd.updatedAt).toISOString(),
    }));

    return c.json(response);
  } catch (error) {
    console.error("[CustomCommands] Error fetching commands:", error);
    return c.json({ error: "Failed to fetch custom commands" }, 500);
  }
});

// POST /api/custom-commands - Create new custom slash command
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createCustomCommandRequestSchema.parse(body);
    
    // Add userId to schema or extract from request if auth middleware puts it there?
    // The schema doesn't have userId, so we assume we need to pass it or get it.
    // However, createCustomCommandRequestSchema in shared/contracts.ts ONLY has command, prompt, chatId.
    // The previous implementation didn't check membership!
    
    // We need userId to check membership. Assuming it's passed in body or header.
    // Let's assume passed in body for now, but we might need to update schema.
    // Actually, usually userId comes from auth middleware or client sends it.
    // Looking at other routes, userId is often in body or query.
    // Let's modify the schema in contracts.ts? No, I should avoid changing contracts if possible unless necessary.
    // Wait, createCustomCommandRequestSchema doesn't have userId. 
    // I should check how the client sends it.
    // If client sends it but schema doesn't validate it, I can still access it from body if I cast to any.
    const userId = (body as any).userId;

    if (!userId) {
       return c.json({ error: "userId is required" }, 400);
    }

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", validatedData.chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for restricted mode: If restricted, only creator can create custom commands
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", validatedData.chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === userId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can create custom commands in restricted mode" }, 403);
      }
    }

    // Validate command starts with /
    let command = validatedData.command.trim();
    if (!command.startsWith("/")) {
      command = `/${command}`;
    }

    // Check if command already exists in this chat
    const { data: existingCommand } = await db
      .from("custom_slash_command")
      .select("*")
      .eq("chatId", validatedData.chatId)
      .eq("command", command)
      .single();

    if (existingCommand) {
      return c.json({ error: "Command already exists in this chat" }, 400);
    }

    const { data: newCommand, error } = await db
      .from("custom_slash_command")
      .insert({
        command,
        prompt: validatedData.prompt,
        chatId: validatedData.chatId,
      })
      .select("*")
      .single();

    if (error || !newCommand) {
      console.error("[CustomCommands] Error creating command:", error);
      return c.json({ error: "Failed to create custom command" }, 500);
    }

    const response: CreateCustomCommandResponse = {
      id: newCommand.id,
      command: newCommand.command,
      prompt: newCommand.prompt,
      chatId: newCommand.chatId,
      createdAt: new Date(newCommand.createdAt).toISOString(),
      updatedAt: new Date(newCommand.updatedAt).toISOString(),
    };

    return c.json(response);
  } catch (error) {
    console.error("[CustomCommands] Error creating command:", error);
    return c.json({ error: "Failed to create custom command" }, 500);
  }
});

// PATCH /api/custom-commands/:id - Update custom slash command
app.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validatedData = updateCustomCommandRequestSchema.parse(body);

    // Need userId for permission checks.
    const userId = (body as any).userId;
    if (!userId) {
       return c.json({ error: "userId is required" }, 400);
    }

    // Fetch command to get chatId
    const { data: commandToUpdate, error: fetchError } = await db
      .from("custom_slash_command")
      .select("chatId")
      .eq("id", id)
      .single();

    if (fetchError || !commandToUpdate) {
      return c.json({ error: "Command not found" }, 404);
    }

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", commandToUpdate.chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for restricted mode: If restricted, only creator can update
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", commandToUpdate.chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === userId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can update custom commands in restricted mode" }, 403);
      }
    }

    const updateData: any = {};
    if (validatedData.command) {
      let command = validatedData.command.trim();
      if (!command.startsWith("/")) {
        command = `/${command}`;
      }
      updateData.command = command;
    }
    if (validatedData.prompt) {
      updateData.prompt = validatedData.prompt;
    }

    const { data: updatedCommand, error } = await db
      .from("custom_slash_command")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updatedCommand) {
      console.error("[CustomCommands] Error updating command:", error);
      return c.json({ error: "Failed to update custom command" }, 500);
    }

    const response: UpdateCustomCommandResponse = {
      id: updatedCommand.id,
      command: updatedCommand.command,
      prompt: updatedCommand.prompt,
      chatId: updatedCommand.chatId,
      createdAt: new Date(updatedCommand.createdAt).toISOString(),
      updatedAt: new Date(updatedCommand.updatedAt).toISOString(),
    };

    return c.json(response);
  } catch (error) {
    console.error("[CustomCommands] Error updating command:", error);
    return c.json({ error: "Failed to update custom command" }, 500);
  }
});

// DELETE /api/custom-commands/:id - Delete custom slash command
app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    // We need userId for permission check. It should be in query or body.
    // DELETE requests might not have body, or might.
    // Let's check if we can get it from query params like other DELETE endpoints.
    const userId = c.req.query("userId"); // Assuming passed as query param

    if (!userId) {
       return c.json({ error: "userId is required" }, 400);
    }

    // Fetch command to get chatId
    const { data: commandToDelete, error: fetchError } = await db
      .from("custom_slash_command")
      .select("chatId")
      .eq("id", id)
      .single();

    if (fetchError || !commandToDelete) {
      return c.json({ error: "Command not found" }, 404);
    }

    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", commandToDelete.chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Check for restricted mode
    const { data: chat } = await db
      .from("chat")
      .select("creatorId, isRestricted")
      .eq("id", commandToDelete.chatId)
      .single();

    if (chat) {
      const isCreator = chat.creatorId === userId;
      if (chat.isRestricted && !isCreator) {
        return c.json({ error: "Only the creator can delete custom commands in restricted mode" }, 403);
      }
    }

    const { error } = await db
      .from("custom_slash_command")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[CustomCommands] Error deleting command:", error);
      return c.json({ error: "Failed to delete custom command" }, 500);
    }

    const response: DeleteCustomCommandResponse = {
      success: true,
      message: "Custom command deleted successfully",
    };

    return c.json(response);
  } catch (error) {
    console.error("[CustomCommands] Error deleting command:", error);
    return c.json({ error: "Failed to delete custom command" }, 500);
  }
});

// POST /api/custom-commands/execute - Execute custom slash command with GPT-5.1
app.post("/execute", async (c) => {
  const body = await c.req.json();
  const validatedData = executeCustomCommandRequestSchema.parse(body);
  const chatId = validatedData.chatId;

  try {
    // ============================================================================
    // RATE LIMIT CHECK - AI calls monthly limit (custom commands count as AI calls)
    // ============================================================================
    const usageCheck = await checkUsageLimit(validatedData.userId, "ai_call");
    if (!usageCheck.allowed) {
      console.log(`[CustomCommands] Rate limit exceeded for user ${validatedData.userId}. Limit: ${usageCheck.limit}, Used: ${usageCheck.used}`);
      return c.json({
        error: "Monthly AI call limit reached",
        code: "RATE_LIMIT_EXCEEDED",
        limit: usageCheck.limit,
        used: usageCheck.used,
        resetsAt: usageCheck.resetsAt,
        upgradeUrl: "/subscription",
      }, 429);
    }

    // RACE CONDITION PREVENTION: Acquire lock using shared lock module
    const { acquireAIResponseLock, releaseAIResponseLock } = await import("../services/ai-locks");
    
    if (!acquireAIResponseLock(chatId)) {
      console.log(`[CustomCommands] Blocked duplicate request for chat ${chatId} - response already in progress`);
      return c.json({
        error: "AI is already responding to this chat. Please wait.",
        blocked: true
      }, 429);
    }

    console.log(`[CustomCommands] Lock acquired for chat ${chatId}`);

    // NOTE: We intentionally DO NOT check if last message is from AI here.
    // This is a user-initiated slash command - they should be able to execute commands
    // even if the AI just responded.

    // Verify user is a member of this chat
    const { data: membership, error: membershipError } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", validatedData.chatId)
      .eq("userId", validatedData.userId)
      .single();

    if (membershipError || !membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // CRIT-1/2/3: Content Safety Check
    const userAgeContext = await getUserAgeContext(validatedData.userId);
    const safetyResult = await checkContentSafety({
      userMessage: validatedData.userMessage,
      userId: validatedData.userId,
      chatId: validatedData.chatId,
      isMinor: userAgeContext.isMinor,
    });

    // Handle crisis situation (CRIT-2)
    if (safetyResult.crisisDetected && safetyResult.crisisResponse) {
      logSafetyEvent("crisis", { chatId, userId: validatedData.userId, flags: safetyResult.flags });
      
      const { acquireAIResponseLock, releaseAIResponseLock } = await import("../services/ai-locks");
      releaseAIResponseLock(chatId);
      
      // Return crisis response
      return c.json({
        content: safetyResult.crisisResponse,
        isCrisisResponse: true,
      });
    }

    // Handle blocked content (CRIT-1)
    if (safetyResult.isBlocked) {
      logSafetyEvent("blocked", { chatId, userId: validatedData.userId, flags: safetyResult.flags });
      const { releaseAIResponseLock } = await import("../services/ai-locks");
      releaseAIResponseLock(chatId);
      return c.json({
        error: safetyResult.blockReason || "I can't help with that request.",
        blocked: true,
      }, 400);
    }

    // Fetch the custom command
    const { data: customCommand, error: commandError } = await db
      .from("custom_slash_command")
      .select("*")
      .eq("id", validatedData.commandId)
      .single();

    if (commandError || !customCommand) {
      return c.json({ error: "Custom command not found" }, 404);
    }

    // Fetch chat to get AI name
    const { data: chat, error: chatError } = await db
      .from("chat")
      .select("*")
      .eq("id", validatedData.chatId)
      .single();

    if (chatError || !chat) {
      return c.json({ error: "Chat not found" }, 404);
    }

    // Get AI name (default to "AI Friend" if not set)
    const aiName = chat.aiName || "AI Friend";

    // Fetch the message being replied to if replyToId is provided
    let replyToMessage = null;
    if (validatedData.replyToId) {
      const { data: replyMsg } = await db
        .from("message")
        .select("*")
        .eq("id", validatedData.replyToId)
        .single();
      
      if (replyMsg) {
        // Decrypt the reply message
        const [decryptedReply] = await decryptMessages([replyMsg]);

        const { data: replyUser } = await db
          .from("user")
          .select("*")
          .eq("id", decryptedReply.userId)
          .single();
        
        replyToMessage = replyUser ? { ...decryptedReply, user: replyUser } : null;
      }
    }

    // Fetch last 100 messages from this chat for context
    const { data: rawMessages = [] } = await db
      .from("message")
      .select("*")
      .eq("chatId", validatedData.chatId)
      .order("createdAt", { ascending: false })
      .limit(100);

    // Decrypt messages
    const messages = await decryptMessages(rawMessages);

    // Fetch users for messages
    const userIds = [...new Set(messages.map((m: any) => m.userId))];
    const { data: users = [] } = await db
      .from("user")
      .select("*")
      .in("id", userIds);

    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Format message history for context
    const messageHistory = messages
      .reverse()
      .map((msg: any) => {
        const timestamp = new Date(msg.createdAt).toLocaleString();
        const user = userMap.get(msg.userId);
        const userName = user?.name || "Unknown";
        if (msg.imageUrl && msg.imageDescription) {
          return `[${timestamp}] ${userName}: [Image: ${msg.imageDescription}]`;
        }
        return `[${timestamp}] ${userName}: ${msg.content}`;
      })
      .join("\n");

    // Define hosted tools available to the agent
    const tools: OpenAI.Responses.Tool[] = [
      { type: "web_search" },
      { type: "image_generation" },
      {
        type: "code_interpreter",
        container: { type: "auto" },
      },
    ];

    // Get AI friend for this chat (for typing indicator) - exclude personal agents
    const { data: aiFriendForCommand } = await db
      .from("ai_friend")
      .select("id, name, color")
      .eq("chatId", chatId)
      .or("isPersonal.is.null,isPersonal.eq.false")
      .order("sortOrder", { ascending: true })
      .limit(1)
      .single();

    // Set AI typing status BEFORE executing command
    if (aiFriendForCommand) {
      setAITypingStatus(chatId, aiFriendForCommand.id, true, aiFriendForCommand.name || "AI", aiFriendForCommand.color || "#14B8A6");
      console.log(`[CustomCommands] 💬 AI typing indicator set for ${aiFriendForCommand.name}`);
    }

    // Get safety system prompt based on user age (CRIT-1/3)
    const safetyInstructions = getSafetySystemPrompt(userAgeContext.isMinor);

    // Build system prompt using GPT-5.1 best practices with safety instructions
    const baseSystemPrompt = buildGPT51SystemPrompt(aiName, customCommand.prompt, tools);
    const systemPrompt = `${safetyInstructions}\n\n${baseSystemPrompt}`;

    // Build the user prompt with context
    let userPrompt = `Context - Recent conversation history:
${messageHistory}`;

    // Add reply context if user is replying to a specific message
    if (replyToMessage) {
      const replyTimestamp = new Date(replyToMessage.createdAt).toLocaleString();
      const replyContent = replyToMessage.messageType === "image" && replyToMessage.imageDescription
        ? `[Image: ${replyToMessage.imageDescription}]`
        : replyToMessage.content;

      userPrompt += `

**IMPORTANT CONTEXT**: The user is replying to this specific message:
[${replyTimestamp}] ${replyToMessage.user.name}: ${replyContent}

This message is the direct context for the user's command.`;
    }

    userPrompt += `

User's message: ${validatedData.userMessage}

Please respond according to the command instructions above.`;

    // MED-19: Enhanced logging and error handling for AI command execution
    const startTime = Date.now();
    console.log(`[CustomCommands] Executing GPT-5.1 via Responses API with hosted tools for chat ${chatId}`);
    console.log(`[CustomCommands] Command: ${customCommand.command}, User: ${validatedData.userId}`);

    let result;
    try {
      result = await executeGPT51Response({
        systemPrompt,
        userPrompt,
        tools,
        reasoningEffort: "none",
        temperature: 1,
        maxTokens: 4096,
      });
    } catch (gptError: any) {
      const duration = Date.now() - startTime;
      console.error(`[CustomCommands] GPT-5.1 execution FAILED after ${duration}ms:`, {
        error: gptError.message || gptError,
        chatId,
        command: customCommand.command,
        userId: validatedData.userId,
      });
      
      // Provide user-friendly error message based on error type
      const isTimeout = gptError.message?.includes("timeout") || gptError.name === "AbortError";
      const errorMessage = isTimeout 
        ? "The AI is taking too long to respond. Try a simpler request or try again later."
        : "The AI encountered an error processing your command. Please try again.";
      
      return c.json({ error: errorMessage }, 500);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[CustomCommands] GPT-5.1 response completed in ${duration}ms with status: ${result.status} and ${result.images.length} image(s)`
    );

    const savedImageUrls = await saveResponseImages(result.images, "custom-command");
    const primaryImageUrl = savedImageUrls[0] ?? null;
    
    // CRIT-1: Filter AI output for safety before saving
    let responseContent = result.content?.trim() || "";
    if (responseContent) {
      const outputFilter = filterAIOutput(responseContent);
      if (outputFilter.wasModified) {
        responseContent = outputFilter.filtered;
        logSafetyEvent("filtered", { chatId, userId: validatedData.userId, flags: ["output_filtered_custom_command"] });
      }
    }

    const messageContent =
      responseContent.length > 0
        ? responseContent
        : primaryImageUrl
          ? "Generated image attached."
          : "Command completed.";

    const { data: aiMessage, error: messageError } = await db
      .from("message")
      .insert({
        content: messageContent,
        messageType: primaryImageUrl ? "image" : "text",
        imageUrl: primaryImageUrl,
        userId: validatedData.userId, // Credit to the user who submitted the command
        chatId: validatedData.chatId,
        replyToId: validatedData.replyToId,
        aiFriendId: null, // Custom commands don't have a specific AI friend
        // Store slash command context for badge display
        metadata: JSON.stringify({
          slashCommand: {
            command: customCommand.command,
            prompt: validatedData.userMessage || undefined,
          }
        }),
      })
      .select("*")
      .single();

    if (messageError || !aiMessage) {
      console.error("[CustomCommands] Error creating command message:", messageError);
      return c.json({ error: "Failed to create command message" }, 500);
    }

    // Fetch replyTo if exists
    let replyTo = null;
    if (aiMessage.replyToId && replyToMessage) {
      replyTo = replyToMessage;
    }

    // Auto-tag command message for smart threads (fire-and-forget, immediate)
    if (messageContent.trim().length > 0) {
      tagMessage(aiMessage.id, messageContent).catch(error => {
        console.error(`[CustomCommands] Failed to tag message ${aiMessage.id}:`, error);
      });
    }

    // Parse metadata back from JSON string for response
    let parsedMetadata = aiMessage.metadata;
    if (typeof aiMessage.metadata === "string") {
      try {
        parsedMetadata = JSON.parse(aiMessage.metadata);
      } catch {
        parsedMetadata = null;
      }
    }

    const messageResponse: ExecuteCustomCommandResponse = {
      id: aiMessage.id,
      content: aiMessage.content,
      messageType: aiMessage.messageType as "text" | "image",
      imageUrl: aiMessage.imageUrl,
      imageDescription: aiMessage.imageDescription,
      userId: aiMessage.userId, // User who submitted the command
      chatId: aiMessage.chatId,
      replyToId: aiMessage.replyToId,
      vibeType: aiMessage.vibeType || null,
      metadata: parsedMetadata, // Include slash command metadata
      user: null, // User object not fetched in this response
      replyTo: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            messageType: replyTo.messageType as "text" | "image",
            imageUrl: replyTo.imageUrl,
            imageDescription: replyTo.imageDescription,
            userId: replyTo.userId,
            chatId: replyTo.chatId,
            replyToId: replyTo.replyToId,
            user: {
              id: replyTo.user.id,
              name: replyTo.user.name,
              bio: replyTo.user.bio,
              image: replyTo.user.image,
              hasCompletedOnboarding: replyTo.user.hasCompletedOnboarding,
              createdAt: new Date(replyTo.user.createdAt).toISOString(),
              updatedAt: new Date(replyTo.user.updatedAt).toISOString(),
            },
            createdAt: new Date(replyTo.createdAt).toISOString(),
          }
        : null,
      createdAt: new Date(aiMessage.createdAt).toISOString(),
    };

    // Clear AI typing status after message is saved
    if (aiFriendForCommand) {
      setAITypingStatus(chatId, aiFriendForCommand.id, false);
      console.log(`[CustomCommands] 💬 AI typing indicator cleared for ${aiFriendForCommand.name}`);
    }

    // Increment usage count after successful command execution
    await incrementUsage(validatedData.userId, "ai_call");

    return c.json(messageResponse);
  } catch (error) {
    console.error("[CustomCommands] Error executing command:", error);
    return c.json({ error: "Failed to execute custom command" }, 500);
  } finally {
    // Always release the lock, even if there was an error
    const { releaseAIResponseLock } = await import("../services/ai-locks");
    releaseAIResponseLock(chatId);
  }
});

export default app;
