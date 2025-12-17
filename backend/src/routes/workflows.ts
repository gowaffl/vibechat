/**
 * AI Workflows API Routes
 *
 * Endpoints for managing AI workflow automation:
 * - CRUD operations for workflows
 * - Scheduled action management
 * - Execution history
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import type { AppType } from "../index";
import {
  processMessageForWorkflows,
  getWorkflowExecutions,
  type Workflow,
  type TriggerConfig,
  type ActionConfig,
} from "../services/ai-workflows";
import {
  createScheduledAction,
  getScheduledActions,
  deleteScheduledAction,
  toggleScheduledAction,
} from "../services/workflow-scheduler";

const app = new Hono<AppType>();

// ==========================================
// Validation Schemas
// ==========================================

const triggerConfigSchema = z.object({
  pattern: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  matchAll: z.boolean().optional(),
  intentKeywords: z.array(z.string()).optional(),
  cron: z.string().optional(),
  time: z.string().optional(),
  days: z.array(z.string()).optional(),
  afterMinutesInactive: z.number().optional(),
  timeOfDay: z.string().optional(),
});

const actionConfigSchema = z.object({
  eventTitle: z.string().optional(),
  eventType: z.string().optional(),
  extractFromMessage: z.boolean().optional(),
  pollQuestion: z.string().optional(),
  pollOptions: z.array(z.string()).optional(),
  extractOptions: z.boolean().optional(),
  messageTemplate: z.string().optional(),
  useAI: z.boolean().optional(),
  aiPrompt: z.string().optional(),
  aiFriendId: z.string().optional(),
  systemPrompt: z.string().optional(),
  summaryType: z.enum(["concise", "detailed"]).optional(),
  messageCount: z.number().optional(),
  reminderMessage: z.string().optional(),
  delayMinutes: z.number().optional(),
});

const createWorkflowSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  triggerType: z.enum(["message_pattern", "scheduled", "ai_mention", "keyword", "time_based"]),
  triggerConfig: triggerConfigSchema,
  actionType: z.enum(["create_event", "create_poll", "send_message", "ai_response", "summarize", "remind"]),
  actionConfig: actionConfigSchema,
  cooldownMinutes: z.number().min(0).max(1440).optional().default(5),
});

const updateWorkflowSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  triggerConfig: triggerConfigSchema.optional(),
  actionConfig: actionConfigSchema.optional(),
  isEnabled: z.boolean().optional(),
  cooldownMinutes: z.number().min(0).max(1440).optional(),
});

const createScheduledActionSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  actionType: z.enum(["daily_summary", "weekly_recap", "reminder", "custom"]),
  schedule: z.string().min(1),
  timezone: z.string().optional().default("UTC"),
  config: z.any().optional(),
});

// ==========================================
// Workflow CRUD Routes
// ==========================================

// GET /api/workflows - Get all workflows for a chat
app.get("/", async (c) => {
  const chatId = c.req.query("chatId");
  const userId = c.req.query("userId");

  if (!chatId) {
    return c.json({ error: "chatId is required" }, 400);
  }

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
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

    // Get all workflows for this chat
    const { data: workflows, error } = await db
      .from("ai_workflow")
      .select("*")
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("[Workflows] Error fetching workflows:", error);
      return c.json({ error: "Failed to fetch workflows" }, 500);
    }

    return c.json(workflows || []);
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/workflows - Create a new workflow
app.post("/", zValidator("json", createWorkflowSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", data.chatId)
      .eq("userId", data.userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Create the workflow
    const { data: workflow, error } = await db
      .from("ai_workflow")
      .insert({
        chatId: data.chatId,
        creatorId: data.userId,
        name: data.name,
        description: data.description || null,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig,
        actionType: data.actionType,
        actionConfig: data.actionConfig,
        cooldownMinutes: data.cooldownMinutes,
        isEnabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error("[Workflows] Error creating workflow:", error);
      return c.json({ error: "Failed to create workflow" }, 500);
    }

    // If this is a scheduled workflow, create a scheduled action
    if (data.triggerType === "scheduled" && workflow) {
      // Get user's timezone
      const { data: user } = await db
        .from("user")
        .select("timezone")
        .eq("id", data.userId)
        .single();
      
      const userTimezone = user?.timezone || "UTC";
      const triggerConfig = data.triggerConfig as TriggerConfig;
      
      // Build schedule string
      let schedule = "";
      if (triggerConfig.time) {
        schedule = `daily:${triggerConfig.time}`;
      } else if (triggerConfig.cron) {
        schedule = triggerConfig.cron;
      }
      
      if (schedule) {
        // Map actionType to actionType for scheduled action
        let scheduledActionType: "daily_summary" | "weekly_recap" | "reminder" | "custom" = "custom";
        if (data.actionType === "summarize") {
          scheduledActionType = "daily_summary";
        }
        
        await createScheduledAction({
          chatId: data.chatId,
          creatorId: data.userId,
          actionType: scheduledActionType,
          schedule,
          timezone: userTimezone,
          config: {
            workflowId: workflow.id,
            workflowName: data.name,
            actionType: data.actionType,
            actionConfig: data.actionConfig,
          },
        });
        
        console.log(`[Workflows] ✅ Created scheduled action for workflow "${data.name}" at ${schedule} (${userTimezone})`);
      }
    }

    return c.json(workflow, 201);
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/workflows/:id - Update a workflow
app.patch("/:id", zValidator("json", updateWorkflowSchema), async (c) => {
  const workflowId = c.req.param("id");
  const data = c.req.valid("json");

  try {
    // Get workflow and verify ownership
    const { data: workflow, error: fetchError } = await db
      .from("ai_workflow")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (fetchError || !workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    if (workflow.creatorId !== data.userId) {
      return c.json({ error: "Not authorized to update this workflow" }, 403);
    }

    // Build update object
    const updates: any = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.triggerConfig !== undefined) updates.triggerConfig = data.triggerConfig;
    if (data.actionConfig !== undefined) updates.actionConfig = data.actionConfig;
    if (data.isEnabled !== undefined) updates.isEnabled = data.isEnabled;
    if (data.cooldownMinutes !== undefined) updates.cooldownMinutes = data.cooldownMinutes;

    const { data: updated, error: updateError } = await db
      .from("ai_workflow")
      .update(updates)
      .eq("id", workflowId)
      .select()
      .single();
    
    // If this is a scheduled workflow, update the scheduled action
    if (updated && workflow.triggerType === "scheduled") {
      const { data: scheduledActions } = await db
        .from("ai_scheduled_action")
        .select("*")
        .eq("chatId", workflow.chatId)
        .contains("config", { workflowId: workflowId });
      
      if (scheduledActions && scheduledActions.length > 0) {
        const scheduledAction = scheduledActions[0];
        const scheduledUpdates: any = {};
        
        // Update isEnabled if changed
        if (data.isEnabled !== undefined) {
          scheduledUpdates.isEnabled = data.isEnabled;
          console.log(`[Workflows] ${data.isEnabled ? 'Enabled' : 'Disabled'} scheduled action for workflow "${workflow.name}"`);
        }
        
        // Update schedule if triggerConfig changed
        if (data.triggerConfig !== undefined) {
          const triggerConfig = data.triggerConfig as TriggerConfig;
          let newSchedule = "";
          
          if (triggerConfig.time) {
            newSchedule = `daily:${triggerConfig.time}`;
          } else if (triggerConfig.cron) {
            newSchedule = triggerConfig.cron;
          }
          
          if (newSchedule && newSchedule !== scheduledAction.schedule) {
            scheduledUpdates.schedule = newSchedule;
            scheduledUpdates.nextRunAt = null; // Will be recalculated by scheduler
            console.log(`[Workflows] Updated schedule for workflow "${workflow.name}" to ${newSchedule}`);
          }
        }
        
        // Apply updates if any
        if (Object.keys(scheduledUpdates).length > 0) {
          await db
            .from("ai_scheduled_action")
            .update(scheduledUpdates)
            .eq("id", scheduledAction.id);
        }
      }
    }

    if (updateError) {
      console.error("[Workflows] Error updating workflow:", updateError);
      return c.json({ error: "Failed to update workflow" }, 500);
    }

    return c.json(updated);
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/workflows/:id - Delete a workflow
app.delete("/:id", async (c) => {
  const workflowId = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Get workflow and verify ownership
    const { data: workflow, error: fetchError } = await db
      .from("ai_workflow")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (fetchError || !workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    if (workflow.creatorId !== userId) {
      return c.json({ error: "Not authorized to delete this workflow" }, 403);
    }

    // If this is a scheduled workflow, delete associated scheduled actions
    if (workflow.triggerType === "scheduled") {
      const { data: scheduledActions } = await db
        .from("ai_scheduled_action")
        .select("id")
        .eq("chatId", workflow.chatId)
        .contains("config", { workflowId: workflowId });
      
      if (scheduledActions && scheduledActions.length > 0) {
        await db
          .from("ai_scheduled_action")
          .delete()
          .eq("id", scheduledActions[0].id);
        
        console.log(`[Workflows] Deleted scheduled action for workflow "${workflow.name}"`);
      }
    }

    const { error } = await db.from("ai_workflow").delete().eq("id", workflowId);

    if (error) {
      console.error("[Workflows] Error deleting workflow:", error);
      return c.json({ error: "Failed to delete workflow" }, 500);
    }

    return c.json({ success: true, message: "Workflow deleted" });
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/workflows/:id/executions - Get workflow execution history
app.get("/:id/executions", async (c) => {
  const workflowId = c.req.param("id");
  const userId = c.req.query("userId");
  const limit = parseInt(c.req.query("limit") || "20");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Get workflow and verify access
    const { data: workflow, error: fetchError } = await db
      .from("ai_workflow")
      .select("chatId")
      .eq("id", workflowId)
      .single();

    if (fetchError || !workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    // Verify user is a member of the chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", workflow.chatId)
      .eq("userId", userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not authorized to view this workflow" }, 403);
    }

    const executions = await getWorkflowExecutions(workflowId, limit);
    return c.json(executions);
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ==========================================
// Scheduled Action Routes
// ==========================================

// GET /api/workflows/scheduled/:chatId - Get all scheduled actions for a chat
app.get("/scheduled/:chatId", async (c) => {
  const chatId = c.req.param("chatId");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
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

    const actions = await getScheduledActions(chatId);
    return c.json(actions);
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/workflows/scheduled - Create a scheduled action
app.post("/scheduled", zValidator("json", createScheduledActionSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Verify user is a member of this chat
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", data.chatId)
      .eq("userId", data.userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not a member of this chat" }, 403);
    }

    // Get user's timezone from their profile
    const { data: user } = await db
      .from("user")
      .select("timezone")
      .eq("id", data.userId)
      .single();
    
    const userTimezone = user?.timezone || data.timezone || "UTC";

    const result = await createScheduledAction({
      chatId: data.chatId,
      creatorId: data.userId,
      actionType: data.actionType,
      schedule: data.schedule,
      timezone: userTimezone,
      config: data.config,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.action, 201);
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/workflows/scheduled/:id - Delete a scheduled action
app.delete("/scheduled/:id", async (c) => {
  const actionId = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const result = await deleteScheduledAction(actionId, userId);

    if (!result.success) {
      return c.json({ error: result.error }, result.error === "Action not found" ? 404 : 403);
    }

    return c.json({ success: true, message: "Scheduled action deleted" });
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/workflows/scheduled/:id/toggle - Toggle scheduled action enabled state
app.patch("/scheduled/:id/toggle", async (c) => {
  const actionId = c.req.param("id");
  const body = await c.req.json();
  const { userId, isEnabled } = body;

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  if (typeof isEnabled !== "boolean") {
    return c.json({ error: "isEnabled must be a boolean" }, 400);
  }

  try {
    const result = await toggleScheduledAction(actionId, userId, isEnabled);

    if (!result.success) {
      return c.json({ error: result.error }, result.error === "Action not found" ? 404 : 403);
    }

    return c.json({ success: true, isEnabled });
  } catch (error) {
    console.error("[Workflows] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ==========================================
// Workflow Templates
// ==========================================

// GET /api/workflows/templates - Get available workflow templates
app.get("/templates", async (c) => {
  // Pre-built workflow templates for common use cases
  const templates = [
    {
      id: "meeting-detector",
      name: "Meeting Detector",
      description: "Automatically creates an event when someone mentions a meeting",
      triggerType: "keyword",
      triggerConfig: {
        keywords: ["meeting", "let's meet", "schedule a call", "sync up"],
        matchAll: false,
      },
      actionType: "create_event",
      actionConfig: {
        extractFromMessage: true,
        eventType: "meeting",
      },
    },
    {
      id: "poll-helper",
      name: "Poll Helper",
      description: "Creates a poll when options are presented",
      triggerType: "message_pattern",
      triggerConfig: {
        pattern: "\\b(should we|what should|which one|pizza or|vote on)\\b",
        caseSensitive: false,
      },
      actionType: "create_poll",
      actionConfig: {
        extractOptions: true,
      },
    },
    {
      id: "daily-summary",
      name: "Daily Summary",
      description: "Posts a daily summary of chat activity every morning",
      triggerType: "scheduled",
      triggerConfig: {
        time: "09:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
      actionType: "summarize",
      actionConfig: {
        summaryType: "concise",
        messageCount: 100,
      },
    },
    {
      id: "reminder-assistant",
      name: "Reminder Assistant",
      description: "Sets reminders when @AI is mentioned with 'remind'",
      triggerType: "ai_mention",
      triggerConfig: {
        intentKeywords: ["remind", "reminder", "don't forget"],
      },
      actionType: "remind",
      actionConfig: {
        delayMinutes: 60,
      },
    },
    {
      id: "welcome-message",
      name: "Welcome Message",
      description: "AI welcomes users when the chat goes quiet for a while",
      triggerType: "time_based",
      triggerConfig: {
        afterMinutesInactive: 60,
      },
      actionType: "ai_response",
      actionConfig: {
        systemPrompt: "Greet the group and ask how everyone is doing or suggest a topic to discuss.",
      },
    },
  ];

  return c.json(templates);
});

export default app;

