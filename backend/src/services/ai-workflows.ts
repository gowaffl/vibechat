/**
 * AI Workflow Engine Service
 *
 * This service handles AI-powered workflow automation:
 * - Trigger detection (message patterns, keywords, AI mentions)
 * - Action execution (create events, polls, send messages, etc.)
 * - Workflow management and execution logging
 */

import { db } from "../db";
import { openai } from "../env";
import { executeGPT51Response } from "./gpt-responses";

// ==========================================
// Types
// ==========================================

export interface TriggerConfig {
  // For message_pattern trigger
  pattern?: string; // Regex pattern
  caseSensitive?: boolean;
  
  // For keyword trigger
  keywords?: string[];
  matchAll?: boolean; // If true, all keywords must match
  
  // For ai_mention trigger
  intentKeywords?: string[]; // e.g., ["remind", "schedule", "plan"]
  
  // For scheduled trigger
  cron?: string; // Cron expression
  time?: string; // Simple time format "HH:MM"
  days?: string[]; // ["monday", "wednesday", "friday"]
  
  // For time_based trigger
  afterMinutesInactive?: number;
  timeOfDay?: string; // "morning", "afternoon", "evening"
}

export interface ActionConfig {
  // For create_event action
  eventTitle?: string;
  eventType?: string;
  extractFromMessage?: boolean; // AI extracts details from trigger message
  
  // For create_poll action
  pollQuestion?: string;
  pollOptions?: string[];
  extractOptions?: boolean;
  
  // For send_message action
  messageTemplate?: string;
  useAI?: boolean;
  aiPrompt?: string;
  
  // For ai_response action
  aiFriendId?: string;
  systemPrompt?: string;
  
  // For summarize action
  summaryType?: "concise" | "detailed";
  messageCount?: number;
  
  // For remind action
  reminderMessage?: string;
  delayMinutes?: number;
}

export interface Workflow {
  id: string;
  chatId: string;
  creatorId: string;
  name: string;
  description: string | null;
  triggerType: "message_pattern" | "scheduled" | "ai_mention" | "keyword" | "time_based";
  triggerConfig: TriggerConfig;
  actionType: "create_event" | "create_poll" | "send_message" | "ai_response" | "summarize" | "remind";
  actionConfig: ActionConfig;
  isEnabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggeredBy: string | null;
  status: "success" | "failed" | "skipped";
  resultData: any;
  errorMessage: string | null;
  executedAt: string;
}

// ==========================================
// Trigger Detection
// ==========================================

/**
 * Check if a message matches a workflow's trigger conditions
 */
export function checkTrigger(
  workflow: Workflow,
  messageContent: string,
  messageId: string,
  userId: string
): boolean {
  const config = workflow.triggerConfig;
  const content = config.caseSensitive ? messageContent : messageContent.toLowerCase();

  switch (workflow.triggerType) {
    case "message_pattern":
      if (!config.pattern) return false;
      try {
        const flags = config.caseSensitive ? "" : "i";
        const regex = new RegExp(config.pattern, flags);
        return regex.test(messageContent);
      } catch (e) {
        console.error(`[Workflows] Invalid regex pattern: ${config.pattern}`);
        return false;
      }

    case "keyword":
      if (!config.keywords || config.keywords.length === 0) return false;
      const keywords = config.keywords.map((k) =>
        config.caseSensitive ? k : k.toLowerCase()
      );
      if (config.matchAll) {
        return keywords.every((k) => content.includes(k));
      }
      return keywords.some((k) => content.includes(k));

    case "ai_mention":
      // Check if message contains @ai or @[ai friend name] with intent
      const hasAIMention = content.includes("@ai") || content.includes("@assistant");
      if (!hasAIMention) return false;
      
      if (config.intentKeywords && config.intentKeywords.length > 0) {
        const intentKeywords = config.intentKeywords.map((k) => k.toLowerCase());
        return intentKeywords.some((k) => content.includes(k));
      }
      return true;

    case "scheduled":
      // Scheduled triggers are handled by the scheduler, not message-based
      return false;

    case "time_based":
      // Time-based triggers are handled separately (e.g., inactivity)
      return false;

    default:
      return false;
  }
}

/**
 * Check if workflow is in cooldown period
 */
export function isInCooldown(workflow: Workflow): boolean {
  if (!workflow.lastTriggeredAt) return false;
  
  const lastTriggered = new Date(workflow.lastTriggeredAt).getTime();
  const cooldownMs = workflow.cooldownMinutes * 60 * 1000;
  const now = Date.now();
  
  return now - lastTriggered < cooldownMs;
}

// ==========================================
// Action Execution
// ==========================================

/**
 * Execute a workflow's action
 */
export async function executeAction(
  workflow: Workflow,
  triggerMessageId: string,
  triggerContent: string,
  triggerUserId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const config = workflow.actionConfig;

  try {
    switch (workflow.actionType) {
      case "create_event":
        return await executeCreateEvent(workflow, triggerContent, config);

      case "create_poll":
        return await executeCreatePoll(workflow, triggerContent, config);

      case "send_message":
        return await executeSendMessage(workflow, triggerContent, config);

      case "ai_response":
        return await executeAIResponse(workflow, triggerContent, config);

      case "summarize":
        return await executeSummarize(workflow, config);

      case "remind":
        return await executeRemind(workflow, triggerContent, config);

      default:
        return { success: false, error: `Unknown action type: ${workflow.actionType}` };
    }
  } catch (error: any) {
    console.error(`[Workflows] Action execution failed:`, error);
    return { success: false, error: error.message || "Action execution failed" };
  }
}

/**
 * Create an event from workflow trigger
 */
async function executeCreateEvent(
  workflow: Workflow,
  triggerContent: string,
  config: ActionConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  let eventTitle = config.eventTitle || "New Event";
  let eventType = config.eventType || "other";
  let eventDate: string | null = null;

  // Use AI to extract event details if configured
  if (config.extractFromMessage) {
    try {
      const extraction = await extractEventDetails(triggerContent);
      if (extraction.title) eventTitle = extraction.title;
      if (extraction.type) eventType = extraction.type;
      if (extraction.date) eventDate = extraction.date;
    } catch (e) {
      console.error("[Workflows] Failed to extract event details:", e);
    }
  }

  // Get chat creator for the event
  const { data: chat } = await db
    .from("chat")
    .select("creatorId")
    .eq("id", workflow.chatId)
    .single();

  if (!chat) {
    return { success: false, error: "Chat not found" };
  }

  // Create the event
  const { data: event, error } = await db
    .from("event")
    .insert({
      chatId: workflow.chatId,
      title: eventTitle,
      eventType: eventType,
      status: "proposed",
      eventDate: eventDate,
      createdBy: workflow.creatorId,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Create a message announcing the event
  await db.from("message").insert({
    chatId: workflow.chatId,
    content: `📅 New event created: **${eventTitle}**\n\n_Created automatically by workflow "${workflow.name}"_`,
    messageType: "text",
    userId: workflow.creatorId,
    eventId: event.id,
  });

  return { success: true, data: { eventId: event.id, title: eventTitle } };
}

/**
 * Create a poll from workflow trigger
 */
async function executeCreatePoll(
  workflow: Workflow,
  triggerContent: string,
  config: ActionConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  let question = config.pollQuestion || "Vote on this:";
  let options = config.pollOptions || ["Option 1", "Option 2"];

  // Use AI to extract poll details if configured
  if (config.extractOptions) {
    try {
      const extraction = await extractPollDetails(triggerContent);
      if (extraction.question) question = extraction.question;
      if (extraction.options && extraction.options.length >= 2) {
        options = extraction.options.slice(0, 4); // Max 4 options
      }
    } catch (e) {
      console.error("[Workflows] Failed to extract poll details:", e);
    }
  }

  // Create the poll
  const { data: poll, error: pollError } = await db
    .from("poll")
    .insert({
      chatId: workflow.chatId,
      creatorId: workflow.creatorId,
      question: question,
      status: "open",
    })
    .select()
    .single();

  if (pollError || !poll) {
    return { success: false, error: pollError?.message || "Failed to create poll" };
  }

  // Create poll options
  const optionInserts = options.map((opt, idx) => ({
    pollId: poll.id,
    optionText: opt,
    sortOrder: idx,
  }));

  const { error: optionsError } = await db.from("poll_option").insert(optionInserts);

  if (optionsError) {
    // Clean up poll
    await db.from("poll").delete().eq("id", poll.id);
    return { success: false, error: optionsError.message };
  }

  // Create a message with the poll
  await db.from("message").insert({
    chatId: workflow.chatId,
    content: `📊 Poll created: **${question}**\n\n_Created automatically by workflow "${workflow.name}"_`,
    messageType: "text",
    userId: workflow.creatorId,
    pollId: poll.id,
  });

  return { success: true, data: { pollId: poll.id, question } };
}

/**
 * Send a message from workflow trigger
 */
async function executeSendMessage(
  workflow: Workflow,
  triggerContent: string,
  config: ActionConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  let messageContent = config.messageTemplate || "";

  // Use AI to generate message if configured
  if (config.useAI && config.aiPrompt) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant in a group chat. Keep responses concise and friendly.",
          },
          {
            role: "user",
            content: `${config.aiPrompt}\n\nContext (trigger message): "${triggerContent}"`,
          },
        ],
        max_tokens: 500,
      });
      messageContent = response.choices[0]?.message?.content || messageContent;
    } catch (e) {
      console.error("[Workflows] Failed to generate AI message:", e);
    }
  }

  // Replace template variables
  messageContent = messageContent
    .replace(/\{trigger\}/g, triggerContent)
    .replace(/\{workflow\}/g, workflow.name);

  if (!messageContent.trim()) {
    return { success: false, error: "No message content to send" };
  }

  // Send the message
  const { data: message, error } = await db
    .from("message")
    .insert({
      chatId: workflow.chatId,
      content: messageContent,
      messageType: "text",
      userId: workflow.creatorId,
      metadata: JSON.stringify({ workflowId: workflow.id }),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { messageId: message.id } };
}

/**
 * Generate an AI response from workflow trigger
 */
async function executeAIResponse(
  workflow: Workflow,
  triggerContent: string,
  config: ActionConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Get AI friend or use default
  let aiFriendId = config.aiFriendId;
  let aiFriend: any = null;

  if (aiFriendId) {
    const { data } = await db.from("ai_friend").select("*").eq("id", aiFriendId).single();
    aiFriend = data;
  }

  if (!aiFriend) {
    // Get first AI friend for this chat
    const { data } = await db
      .from("ai_friend")
      .select("*")
      .eq("chatId", workflow.chatId)
      .order("sortOrder", { ascending: true })
      .limit(1)
      .single();
    aiFriend = data;
    aiFriendId = aiFriend?.id;
  }

  if (!aiFriend) {
    return { success: false, error: "No AI friend found for this chat" };
  }

  // Build system prompt
  const systemPrompt = config.systemPrompt || 
    `You are ${aiFriend.name}, an AI friend in a group chat. ${aiFriend.personality || ""} ${aiFriend.tone ? `Your tone is ${aiFriend.tone}.` : ""}`;

  // Get recent messages for context
  const { data: recentMessages } = await db
    .from("message")
    .select("*, user:userId(name)")
    .eq("chatId", workflow.chatId)
    .order("createdAt", { ascending: false })
    .limit(10);

  const context = (recentMessages || [])
    .reverse()
    .map((m: any) => `${m.user?.name || "Unknown"}: ${m.content}`)
    .join("\n");

  // Generate response
  const result = await executeGPT51Response({
    systemPrompt: `${systemPrompt}\n\nThis response is triggered by a workflow named "${workflow.name}".`,
    userPrompt: `Recent conversation:\n${context}\n\nTrigger message: ${triggerContent}\n\nRespond naturally as ${aiFriend.name}.`,
    tools: [],
    reasoningEffort: "none",
    temperature: 0.9,
    maxTokens: 1024,
  });

  const responseContent = result.content?.trim();
  if (!responseContent) {
    return { success: false, error: "AI generated empty response" };
  }

  // Send the AI message
  const { data: message, error } = await db
    .from("message")
    .insert({
      chatId: workflow.chatId,
      content: responseContent,
      messageType: "text",
      userId: null,
      aiFriendId: aiFriendId,
      metadata: JSON.stringify({ workflowId: workflow.id }),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { messageId: message.id, aiFriendId } };
}

/**
 * Generate a summary from workflow trigger
 */
async function executeSummarize(
  workflow: Workflow,
  config: ActionConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  const messageCount = config.messageCount || 50;
  const summaryType = config.summaryType || "concise";

  // Get recent messages
  const { data: messages } = await db
    .from("message")
    .select("*, user:userId(name)")
    .eq("chatId", workflow.chatId)
    .order("createdAt", { ascending: false })
    .limit(messageCount);

  if (!messages || messages.length === 0) {
    return { success: false, error: "No messages to summarize" };
  }

  const messagesText = messages
    .reverse()
    .map((m: any) => `${m.user?.name || "Unknown"}: ${m.content}`)
    .join("\n");

  // Generate summary
  const prompt = summaryType === "detailed"
    ? "Provide a detailed summary of this conversation including key points, decisions made, and action items."
    : "Provide a brief, concise summary of this conversation in 2-3 sentences.";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that summarizes group chat conversations.",
      },
      {
        role: "user",
        content: `${prompt}\n\nConversation:\n${messagesText}`,
      },
    ],
    max_tokens: 1000,
  });

  const summary = response.choices[0]?.message?.content;
  if (!summary) {
    return { success: false, error: "Failed to generate summary" };
  }

  // Get AI friend for posting
  const { data: aiFriend } = await db
    .from("ai_friend")
    .select("id, name")
    .eq("chatId", workflow.chatId)
    .order("sortOrder", { ascending: true })
    .limit(1)
    .single();

  // Post the summary
  const { data: message, error } = await db
    .from("message")
    .insert({
      chatId: workflow.chatId,
      content: `📋 **Chat Summary**\n\n${summary}\n\n_Generated by workflow "${workflow.name}"_`,
      messageType: "text",
      userId: null,
      aiFriendId: aiFriend?.id || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { messageId: message.id, summary } };
}

/**
 * Schedule a reminder from workflow trigger
 */
async function executeRemind(
  workflow: Workflow,
  triggerContent: string,
  config: ActionConfig
): Promise<{ success: boolean; data?: any; error?: string }> {
  const delayMinutes = config.delayMinutes || 30;
  const reminderMessage = config.reminderMessage || `Reminder: ${triggerContent}`;

  // Calculate next run time
  const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // Create scheduled action for the reminder
  const { data: action, error } = await db
    .from("ai_scheduled_action")
    .insert({
      chatId: workflow.chatId,
      creatorId: workflow.creatorId,
      actionType: "reminder",
      schedule: nextRunAt.toISOString(),
      timezone: "UTC",
      config: {
        message: reminderMessage,
        originalTrigger: triggerContent,
        workflowId: workflow.id,
      },
      nextRunAt: nextRunAt.toISOString(),
      isEnabled: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Acknowledge the reminder was set
  await db.from("message").insert({
    chatId: workflow.chatId,
    content: `⏰ Reminder set for ${delayMinutes} minutes from now.\n\n_Set by workflow "${workflow.name}"_`,
    messageType: "text",
    userId: workflow.creatorId,
  });

  return { success: true, data: { scheduledActionId: action.id, nextRunAt: nextRunAt.toISOString() } };
}

// ==========================================
// AI Extraction Helpers
// ==========================================

async function extractEventDetails(
  content: string
): Promise<{ title?: string; type?: string; date?: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract event details from the message. Return JSON with: title (string), type (one of: meeting, hangout, meal, activity, other), date (ISO string or null).`,
      },
      {
        role: "user",
        content,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

async function extractPollDetails(
  content: string
): Promise<{ question?: string; options?: string[] }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract poll details from the message. Return JSON with: question (string), options (array of 2-4 strings).`,
      },
      {
        role: "user",
        content,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

// ==========================================
// Workflow Processing
// ==========================================

/**
 * Process a new message and check for workflow triggers
 */
export async function processMessageForWorkflows(
  chatId: string,
  messageId: string,
  content: string,
  userId: string
): Promise<void> {
  console.log(`[Workflows] Processing message ${messageId} for workflows in chat ${chatId}`);

  // Get all enabled workflows for this chat
  const { data: workflows, error } = await db
    .from("ai_workflow")
    .select("*")
    .eq("chatId", chatId)
    .eq("isEnabled", true);

  if (error || !workflows || workflows.length === 0) {
    return;
  }

  for (const workflow of workflows) {
    try {
      // Check if trigger matches
      if (!checkTrigger(workflow as Workflow, content, messageId, userId)) {
        continue;
      }

      console.log(`[Workflows] Workflow "${workflow.name}" triggered by message ${messageId}`);

      // Check cooldown
      if (isInCooldown(workflow as Workflow)) {
        console.log(`[Workflows] Workflow "${workflow.name}" is in cooldown, skipping`);
        
        // Log skipped execution
        await db.from("ai_workflow_execution").insert({
          workflowId: workflow.id,
          triggeredBy: messageId,
          status: "skipped",
          resultData: { reason: "cooldown" },
        });
        continue;
      }

      // Execute the action
      const result = await executeAction(
        workflow as Workflow,
        messageId,
        content,
        userId
      );

      // Log execution
      await db.from("ai_workflow_execution").insert({
        workflowId: workflow.id,
        triggeredBy: messageId,
        status: result.success ? "success" : "failed",
        resultData: result.data || null,
        errorMessage: result.error || null,
      });

      // Update last triggered time
      if (result.success) {
        await db
          .from("ai_workflow")
          .update({ lastTriggeredAt: new Date().toISOString() })
          .eq("id", workflow.id);
      }

      console.log(
        `[Workflows] Workflow "${workflow.name}" execution ${result.success ? "succeeded" : "failed"}:`,
        result
      );
    } catch (error: any) {
      console.error(`[Workflows] Error processing workflow ${workflow.id}:`, error);
      
      // Log failed execution
      await db.from("ai_workflow_execution").insert({
        workflowId: workflow.id,
        triggeredBy: messageId,
        status: "failed",
        errorMessage: error.message || "Unknown error",
      });
    }
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowExecutions(
  workflowId: string,
  limit: number = 20
): Promise<WorkflowExecution[]> {
  const { data, error } = await db
    .from("ai_workflow_execution")
    .select("*")
    .eq("workflowId", workflowId)
    .order("executedAt", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[Workflows] Error fetching executions:`, error);
    return [];
  }

  return data || [];
}

