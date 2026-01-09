/**
 * Workflow Scheduler Service
 *
 * This service handles scheduled/cron-based workflow actions:
 * - Daily summaries
 * - Weekly recaps
 * - Scheduled reminders
 * - Custom scheduled actions
 */

import { db } from "../db";
import { openai } from "../env";
import { executeGPT51Response } from "./gpt-responses";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { decryptMessages } from "./message-encryption";

// ==========================================
// Types
// ==========================================

interface ScheduledAction {
  id: string;
  chatId: string;
  creatorId: string;
  actionType: "daily_summary" | "weekly_recap" | "reminder" | "custom";
  schedule: string;
  timezone: string;
  config: any;
  lastRunAt: string | null;
  nextRunAt: string | null;
  isEnabled: boolean;
  createdAt: string;
}

// ==========================================
// Scheduler State
// ==========================================

let schedulerInterval: NodeJS.Timeout | null = null;
const SCHEDULER_INTERVAL_MS = 60 * 1000; // Check every minute

// ==========================================
// Schedule Parsing
// ==========================================

/**
 * Parse schedule string and determine next run time IN USER'S TIMEZONE
 * Supports:
 * - ISO date strings (one-time)
 * - "daily:HH:MM" format (in user's local time)
 * - "weekly:day:HH:MM" format (e.g., "weekly:monday:09:00" in user's local time)
 * - Simple cron expressions (minute hour day month weekday) (in user's local time)
 * 
 * @param schedule - Schedule string
 * @param timezone - IANA timezone (e.g., "America/New_York", "Europe/London")
 * @returns Date in UTC representing the next run time
 */
function parseSchedule(schedule: string, timezone: string = "UTC"): Date | null {
  const now = new Date();
  
  // ISO date string (one-time) - already in UTC
  if (schedule.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      return new Date(schedule);
    } catch {
      return null;
    }
  }

  // Get current time in user's timezone
  const nowInUserTz = toZonedTime(now, timezone);

  // Daily format: "daily:HH:MM" (in user's local time)
  const dailyMatch = schedule.match(/^daily:(\d{2}):(\d{2})$/);
  if (dailyMatch) {
    const [, hours, minutes] = dailyMatch;
    
    // Create a date in user's timezone with the specified time
    const nextInUserTz = new Date(nowInUserTz);
    nextInUserTz.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // If time has passed today in user's timezone, schedule for tomorrow
    if (nextInUserTz <= nowInUserTz) {
      nextInUserTz.setDate(nextInUserTz.getDate() + 1);
    }
    
    // Convert user's local time to UTC
    return fromZonedTime(nextInUserTz, timezone);
  }

  // Weekly format: "weekly:day:HH:MM" (in user's local time)
  const weeklyMatch = schedule.match(/^weekly:(\w+):(\d{2}):(\d{2})$/);
  if (weeklyMatch) {
    const [, day, hours, minutes] = weeklyMatch;
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const targetDay = dayMap[day.toLowerCase()];
    if (targetDay === undefined) return null;

    // Create a date in user's timezone with the specified time
    const nextInUserTz = new Date(nowInUserTz);
    nextInUserTz.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const currentDay = nextInUserTz.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && nextInUserTz <= nowInUserTz)) {
      daysUntil += 7;
    }
    nextInUserTz.setDate(nextInUserTz.getDate() + daysUntil);
    
    // Convert user's local time to UTC
    return fromZonedTime(nextInUserTz, timezone);
  }

  // Simple cron: "minute hour * * weekday" (in user's local time)
  const cronMatch = schedule.match(/^(\d+|\*)\s+(\d+|\*)\s+\*\s+\*\s+(\d+|\*)$/);
  if (cronMatch) {
    const [, minute, hour, weekday] = cronMatch;
    const nextInUserTz = new Date(nowInUserTz);
    
    if (hour !== "*") {
      nextInUserTz.setHours(parseInt(hour));
    }
    if (minute !== "*") {
      nextInUserTz.setMinutes(parseInt(minute));
    }
    nextInUserTz.setSeconds(0, 0);

    // Handle weekday constraint
    if (weekday !== "*") {
      const targetDay = parseInt(weekday);
      const currentDay = nextInUserTz.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && nextInUserTz <= nowInUserTz)) {
        daysUntil += 7;
      }
      nextInUserTz.setDate(nextInUserTz.getDate() + daysUntil);
    } else if (nextInUserTz <= nowInUserTz) {
      // If no weekday constraint and time passed, go to next day
      nextInUserTz.setDate(nextInUserTz.getDate() + 1);
    }

    // Convert user's local time to UTC
    return fromZonedTime(nextInUserTz, timezone);
  }

  return null;
}

/**
 * Calculate next run time based on schedule
 */
function calculateNextRunTime(action: ScheduledAction): Date | null {
  return parseSchedule(action.schedule, action.timezone);
}

// ==========================================
// Action Execution
// ==========================================

/**
 * Execute a scheduled action
 */
async function executeScheduledAction(action: ScheduledAction): Promise<{ success: boolean; error?: string }> {
  console.log(`[Scheduler] Executing action ${action.id} (${action.actionType}) for chat ${action.chatId}`);

  try {
    switch (action.actionType) {
      case "daily_summary":
        return await executeDailySummary(action);

      case "weekly_recap":
        return await executeWeeklyRecap(action);

      case "reminder":
        return await executeReminder(action);

      case "custom":
        return await executeCustomAction(action);

      default:
        return { success: false, error: `Unknown action type: ${action.actionType}` };
    }
  } catch (error: any) {
    console.error(`[Scheduler] Action execution failed:`, error);
    return { success: false, error: error.message || "Execution failed" };
  }
}

/**
 * Generate and post daily summary
 */
async function executeDailySummary(action: ScheduledAction): Promise<{ success: boolean; error?: string }> {
  // Get messages from last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const { data: messages } = await db
    .from("message")
    .select("*, user:userId(name)")
    .eq("chatId", action.chatId)
    .gte("createdAt", yesterday.toISOString())
    .order("createdAt", { ascending: true });

  if (!messages || messages.length === 0) {
    console.log(`[Scheduler] No messages to summarize for chat ${action.chatId}`);
    return { success: true }; // Not an error, just nothing to summarize
  }

  // Decrypt messages before summarizing
  const decryptedMessages = await decryptMessages(messages);

  const messagesText = decryptedMessages
    .map((m: any) => `${m.user?.name || "Unknown"}: ${m.content}`)
    .join("\n");

  // Generate summary
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that creates daily chat summaries. Be concise but capture the key points, decisions, and notable moments from the day.",
      },
      {
        role: "user",
        content: `Create a daily summary of this group chat from the last 24 hours. Include key topics, decisions made, and any action items.\n\nMessages:\n${messagesText}`,
      },
    ],
    max_tokens: 800,
  });

  const summary = response.choices[0]?.message?.content;
  if (!summary) {
    return { success: false, error: "Failed to generate summary" };
  }

  // Get AI friend for posting (exclude personal agents)
  const { data: aiFriend } = await db
    .from("ai_friend")
    .select("id, name")
    .eq("chatId", action.chatId)
    .or("isPersonal.is.null,isPersonal.eq.false")
    .order("sortOrder", { ascending: true })
    .limit(1)
    .single();

  // Post the summary
  const { error } = await db.from("message").insert({
    chatId: action.chatId,
    content: `☀️ **Daily Summary**\n\n${summary}\n\n_${messages.length} messages summarized_`,
    messageType: "text",
    userId: null,
    aiFriendId: aiFriend?.id || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Generate and post weekly recap
 */
async function executeWeeklyRecap(action: ScheduledAction): Promise<{ success: boolean; error?: string }> {
  // Get messages from last 7 days
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const { data: messages } = await db
    .from("message")
    .select("*, user:userId(name)")
    .eq("chatId", action.chatId)
    .gte("createdAt", lastWeek.toISOString())
    .order("createdAt", { ascending: true });

  if (!messages || messages.length === 0) {
    console.log(`[Scheduler] No messages for weekly recap in chat ${action.chatId}`);
    return { success: true };
  }

  // Decrypt messages before generating recap
  const decryptedMessages = await decryptMessages(messages);

  // Get poll results from the week
  const { data: polls } = await db
    .from("poll")
    .select("*, options:poll_option(*), votes:poll_vote(*)")
    .eq("chatId", action.chatId)
    .gte("createdAt", lastWeek.toISOString());

  // Get events from the week
  const { data: events } = await db
    .from("event")
    .select("*")
    .eq("chatId", action.chatId)
    .gte("createdAt", lastWeek.toISOString());

  const messagesText = decryptedMessages
    .map((m: any) => `${m.user?.name || "Unknown"}: ${m.content}`)
    .join("\n");

  // Generate recap
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that creates engaging weekly chat recaps. Include highlights, memorable moments, key decisions, and trends from the week.",
      },
      {
        role: "user",
        content: `Create a weekly recap of this group chat. Include:
- Key highlights and memorable moments
- Decisions made
- Topics that were discussed most
- Any patterns or trends
${polls && polls.length > 0 ? `\nPolls created this week: ${polls.length}` : ""}
${events && events.length > 0 ? `\nEvents planned this week: ${events.length}` : ""}

Messages:\n${messagesText.slice(0, 10000)}`, // Truncate if too long
      },
    ],
    max_tokens: 1200,
  });

  const recap = response.choices[0]?.message?.content;
  if (!recap) {
    return { success: false, error: "Failed to generate recap" };
  }

  // Get AI friend for posting (exclude personal agents)
  const { data: aiFriend } = await db
    .from("ai_friend")
    .select("id, name")
    .eq("chatId", action.chatId)
    .or("isPersonal.is.null,isPersonal.eq.false")
    .order("sortOrder", { ascending: true })
    .limit(1)
    .single();

  // Post the recap
  const { error } = await db.from("message").insert({
    chatId: action.chatId,
    content: `📅 **Weekly Recap**\n\n${recap}\n\n_${messages.length} messages from the past week_`,
    messageType: "text",
    userId: null,
    aiFriendId: aiFriend?.id || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Execute a reminder action
 */
async function executeReminder(action: ScheduledAction): Promise<{ success: boolean; error?: string }> {
  const config = action.config || {};
  const message = config.message || "⏰ Reminder!";

  // Get AI friend for posting (exclude personal agents)
  const { data: aiFriend } = await db
    .from("ai_friend")
    .select("id, name")
    .eq("chatId", action.chatId)
    .or("isPersonal.is.null,isPersonal.eq.false")
    .order("sortOrder", { ascending: true })
    .limit(1)
    .single();

  // Post the reminder
  const { error } = await db.from("message").insert({
    chatId: action.chatId,
    content: message,
    messageType: "text",
    userId: null,
    aiFriendId: aiFriend?.id || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Reminders are typically one-time, disable after execution
  await db.from("ai_scheduled_action").update({ isEnabled: false }).eq("id", action.id);

  return { success: true };
}

/**
 * Execute a custom scheduled action
 */
async function executeCustomAction(action: ScheduledAction): Promise<{ success: boolean; error?: string }> {
  const config = action.config || {};
  
  if (config.type === "message") {
    // Custom message
    const { error } = await db.from("message").insert({
      chatId: action.chatId,
      content: config.content || "Custom scheduled message",
      messageType: "text",
      userId: action.creatorId,
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  if (config.type === "ai_prompt") {
    // AI-generated response based on prompt (exclude personal agents)
    const { data: aiFriend } = await db
      .from("ai_friend")
      .select("id, name, personality, tone")
      .eq("chatId", action.chatId)
      .or("isPersonal.is.null,isPersonal.eq.false")
      .order("sortOrder", { ascending: true })
      .limit(1)
      .single();

    // Note: gpt-5.1 does not support temperature parameter
    const result = await executeGPT51Response({
      systemPrompt: `You are ${aiFriend?.name || "AI Assistant"} in a group chat. ${aiFriend?.personality || ""} Keep responses natural and conversational.`,
      userPrompt: config.prompt || "Say something interesting to the group.",
      tools: [],
      reasoningEffort: "none",
      maxTokens: 500,
    });

    if (!result.content) {
      return { success: false, error: "Failed to generate AI response" };
    }

    const { error } = await db.from("message").insert({
      chatId: action.chatId,
      content: result.content,
      messageType: "text",
      userId: null,
      aiFriendId: aiFriend?.id || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  return { success: false, error: "Unknown custom action type" };
}

// ==========================================
// Scheduler Loop
// ==========================================

/**
 * Check for due scheduled actions and execute them
 */
async function checkScheduledActions(): Promise<void> {
  const now = new Date();
  
  // Get all due actions
  const { data: actions, error } = await db
    .from("ai_scheduled_action")
    .select("*")
    .eq("isEnabled", true)
    .lte("nextRunAt", now.toISOString());

  if (error) {
    console.error("[Scheduler] Error fetching due actions:", error);
    return;
  }

  if (!actions || actions.length === 0) {
    return;
  }

  console.log(`[Scheduler] Found ${actions.length} due action(s)`);

  for (const action of actions) {
    try {
      const result = await executeScheduledAction(action as ScheduledAction);
      
      // Update last run time
      await db
        .from("ai_scheduled_action")
        .update({ lastRunAt: now.toISOString() })
        .eq("id", action.id);

      // Calculate and set next run time
      const nextRun = calculateNextRunTime(action as ScheduledAction);
      if (nextRun && nextRun > now) {
        await db
          .from("ai_scheduled_action")
          .update({ nextRunAt: nextRun.toISOString() })
          .eq("id", action.id);
      } else if (!action.schedule.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Not a one-time schedule, but couldn't calculate next time - disable
        console.warn(`[Scheduler] Could not calculate next run for action ${action.id}, disabling`);
        await db
          .from("ai_scheduled_action")
          .update({ isEnabled: false })
          .eq("id", action.id);
      }

      if (!result.success) {
        console.error(`[Scheduler] Action ${action.id} failed:`, result.error);
      }
    } catch (error) {
      console.error(`[Scheduler] Error executing action ${action.id}:`, error);
    }
  }
}

// ==========================================
// Public API
// ==========================================

/**
 * Initialize any scheduled actions with null nextRunAt
 */
async function initializeScheduledActions(): Promise<void> {
  console.log("[Scheduler] Initializing scheduled actions with null nextRunAt...");
  
  const { data: actions, error } = await db
    .from("ai_scheduled_action")
    .select("*")
    .eq("isEnabled", true)
    .is("nextRunAt", null);

  if (error) {
    console.error("[Scheduler] Error fetching uninitialized actions:", error);
    return;
  }

  if (!actions || actions.length === 0) {
    console.log("[Scheduler] All scheduled actions are initialized");
    return;
  }

  console.log(`[Scheduler] Found ${actions.length} uninitialized action(s), calculating nextRunAt...`);

  for (const action of actions) {
    try {
      const nextRun = calculateNextRunTime(action as ScheduledAction);
      if (nextRun) {
        await db
          .from("ai_scheduled_action")
          .update({ nextRunAt: nextRun.toISOString() })
          .eq("id", action.id);
        console.log(`[Scheduler] Initialized action ${action.id}: next run at ${nextRun.toISOString()}`);
      } else {
        console.warn(`[Scheduler] Could not calculate next run for action ${action.id} (schedule: ${action.schedule})`);
      }
    } catch (error) {
      console.error(`[Scheduler] Error initializing action ${action.id}:`, error);
    }
  }
}

/**
 * Start the workflow scheduler
 */
export function startWorkflowScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Scheduler already running");
    return;
  }

  console.log("[Scheduler] Starting workflow scheduler...");
  
  // Initialize any actions with null nextRunAt
  initializeScheduledActions()
    .then(() => {
      // Then check for due actions
      return checkScheduledActions();
    })
    .catch(console.error);
  
  // Then run every minute
  schedulerInterval = setInterval(() => {
    checkScheduledActions().catch(console.error);
  }, SCHEDULER_INTERVAL_MS);

  console.log("[Scheduler] Scheduler started, checking every minute");
}

/**
 * Stop the workflow scheduler
 */
export function stopWorkflowScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

/**
 * Create a new scheduled action
 */
export async function createScheduledAction(params: {
  chatId: string;
  creatorId: string;
  actionType: "daily_summary" | "weekly_recap" | "reminder" | "custom";
  schedule: string;
  timezone?: string;
  config?: any;
}): Promise<{ success: boolean; action?: ScheduledAction; error?: string }> {
  const timezone = params.timezone || "UTC";
  
  // Validate schedule and calculate next run
  const nextRun = parseSchedule(params.schedule, timezone);
  if (!nextRun) {
    return { success: false, error: "Invalid schedule format" };
  }

  const { data: action, error } = await db
    .from("ai_scheduled_action")
    .insert({
      chatId: params.chatId,
      creatorId: params.creatorId,
      actionType: params.actionType,
      schedule: params.schedule,
      timezone: timezone,
      config: params.config || {},
      nextRunAt: nextRun.toISOString(),
      isEnabled: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, action: action as ScheduledAction };
}

/**
 * Get all scheduled actions for a chat
 */
export async function getScheduledActions(chatId: string): Promise<ScheduledAction[]> {
  const { data, error } = await db
    .from("ai_scheduled_action")
    .select("*")
    .eq("chatId", chatId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("[Scheduler] Error fetching scheduled actions:", error);
    return [];
  }

  return (data || []) as ScheduledAction[];
}

/**
 * Delete a scheduled action
 */
export async function deleteScheduledAction(actionId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  // Verify ownership
  const { data: action } = await db
    .from("ai_scheduled_action")
    .select("creatorId")
    .eq("id", actionId)
    .single();

  if (!action) {
    return { success: false, error: "Action not found" };
  }

  if (action.creatorId !== userId) {
    return { success: false, error: "Not authorized to delete this action" };
  }

  const { error } = await db
    .from("ai_scheduled_action")
    .delete()
    .eq("id", actionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Toggle a scheduled action's enabled state
 */
export async function toggleScheduledAction(actionId: string, userId: string, isEnabled: boolean): Promise<{ success: boolean; error?: string }> {
  // Verify ownership
  const { data: action } = await db
    .from("ai_scheduled_action")
    .select("creatorId, schedule, timezone")
    .eq("id", actionId)
    .single();

  if (!action) {
    return { success: false, error: "Action not found" };
  }

  if (action.creatorId !== userId) {
    return { success: false, error: "Not authorized to modify this action" };
  }

  const updates: any = { isEnabled };
  
  // If enabling, recalculate next run time
  if (isEnabled) {
    const nextRun = parseSchedule(action.schedule, action.timezone);
    if (nextRun) {
      updates.nextRunAt = nextRun.toISOString();
    }
  }

  const { error } = await db
    .from("ai_scheduled_action")
    .update(updates)
    .eq("id", actionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

