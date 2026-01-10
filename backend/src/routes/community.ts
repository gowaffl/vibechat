/**
 * Community Marketplace API Routes
 *
 * Endpoints for the AI Personas, Slash Commands, and Workflows marketplace:
 * - Browse and search community items
 * - Share AI friends, commands, and workflows to community
 * - Clone items to user's chats
 * - Rankings and featured items
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import type { AppType } from "../index";

const app = new Hono<AppType>();

// ==========================================
// Validation Schemas
// ==========================================

const shareAIFriendSchema = z.object({
  userId: z.string(),
  aiFriendId: z.string(),
  description: z.string().max(500).optional(),
  category: z.enum(["productivity", "entertainment", "support", "creative", "utility", "other"]).optional().default("other"),
  tags: z.array(z.string()).max(10).optional().default([]),
});

const shareCommandSchema = z.object({
  userId: z.string(),
  commandId: z.string(),
  description: z.string().max(500).optional(),
  category: z.enum(["productivity", "entertainment", "creative", "utility", "other"]).optional().default("other"),
  tags: z.array(z.string()).max(10).optional().default([]),
});

const shareWorkflowSchema = z.object({
  userId: z.string(),
  workflowId: z.string(),
  description: z.string().max(500).optional(),
  category: z.enum(["productivity", "entertainment", "creative", "utility", "other"]).optional().default("other"),
  tags: z.array(z.string()).max(10).optional().default([]),
});

const cloneItemSchema = z.object({
  userId: z.string(),
  itemType: z.enum(["ai_friend", "command", "workflow"]),
  communityItemId: z.string(),
  targetChatIds: z.array(z.string()).max(10).optional().default([]),
  cloneToPersonal: z.boolean().optional().default(false),
}).refine(
  (data) => data.cloneToPersonal || data.targetChatIds.length > 0,
  { message: "Either cloneToPersonal must be true or targetChatIds must not be empty" }
);

// ==========================================
// Browse Community Items
// ==========================================

// GET /api/community/personas - List community AI personas
app.get("/personas", async (c) => {
  const category = c.req.query("category");
  const search = c.req.query("search");
  const sortBy = c.req.query("sortBy") || "cloneCount"; // cloneCount, createdAt
  const featured = c.req.query("featured") === "true";
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  try {
    let query = db
      .from("community_ai_friend")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true);

    if (category) {
      query = query.eq("category", category);
    }

    if (featured) {
      query = query.eq("isFeatured", true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (sortBy === "createdAt") {
      query = query.order("createdAt", { ascending: false });
    } else {
      query = query.order("cloneCount", { ascending: false });
    }

    const { data: personas, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("[Community] Error fetching personas:", error);
      return c.json({ error: "Failed to fetch personas" }, 500);
    }

    return c.json({
      items: personas || [],
      hasMore: (personas?.length || 0) === limit,
      offset: offset + (personas?.length || 0),
    });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/community/commands - List community commands
app.get("/commands", async (c) => {
  const category = c.req.query("category");
  const search = c.req.query("search");
  const sortBy = c.req.query("sortBy") || "cloneCount";
  const featured = c.req.query("featured") === "true";
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  try {
    let query = db
      .from("community_command")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true);

    if (category) {
      query = query.eq("category", category);
    }

    if (featured) {
      query = query.eq("isFeatured", true);
    }

    if (search) {
      query = query.or(`command.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (sortBy === "createdAt") {
      query = query.order("createdAt", { ascending: false });
    } else {
      query = query.order("cloneCount", { ascending: false });
    }

    const { data: commands, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("[Community] Error fetching commands:", error);
      return c.json({ error: "Failed to fetch commands" }, 500);
    }

    return c.json({
      items: commands || [],
      hasMore: (commands?.length || 0) === limit,
      offset: offset + (commands?.length || 0),
    });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/community/workflows - List community workflows
app.get("/workflows", async (c) => {
  const category = c.req.query("category");
  const search = c.req.query("search");
  const sortBy = c.req.query("sortBy") || "cloneCount";
  const featured = c.req.query("featured") === "true";
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  try {
    let query = db
      .from("community_workflow")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true);

    if (category) {
      query = query.eq("category", category);
    }

    if (featured) {
      query = query.eq("isFeatured", true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (sortBy === "createdAt") {
      query = query.order("createdAt", { ascending: false });
    } else {
      query = query.order("cloneCount", { ascending: false });
    }

    const { data: workflows, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("[Community] Error fetching workflows:", error);
      return c.json({ error: "Failed to fetch workflows" }, 500);
    }

    return c.json({
      items: workflows || [],
      hasMore: (workflows?.length || 0) === limit,
      offset: offset + (workflows?.length || 0),
    });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/community/rankings - Get top personas, commands, and workflows
app.get("/rankings", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 25);

  try {
    // Get top personas
    const { data: topPersonas } = await db
      .from("community_ai_friend")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true)
      .order("cloneCount", { ascending: false })
      .limit(limit);

    // Get top commands
    const { data: topCommands } = await db
      .from("community_command")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true)
      .order("cloneCount", { ascending: false })
      .limit(limit);

    // Get top workflows
    const { data: topWorkflows } = await db
      .from("community_workflow")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true)
      .order("cloneCount", { ascending: false })
      .limit(limit);

    // Get featured items
    const { data: featuredPersonas } = await db
      .from("community_ai_friend")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true)
      .eq("isFeatured", true)
      .order("cloneCount", { ascending: false })
      .limit(5);

    const { data: featuredCommands } = await db
      .from("community_command")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true)
      .eq("isFeatured", true)
      .order("cloneCount", { ascending: false })
      .limit(5);

    const { data: featuredWorkflows } = await db
      .from("community_workflow")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("isPublic", true)
      .eq("isFeatured", true)
      .order("cloneCount", { ascending: false })
      .limit(5);

    return c.json({
      topPersonas: topPersonas || [],
      topCommands: topCommands || [],
      topWorkflows: topWorkflows || [],
      featuredPersonas: featuredPersonas || [],
      featuredCommands: featuredCommands || [],
      featuredWorkflows: featuredWorkflows || [],
    });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/community/personas/:id - Get single persona details
app.get("/personas/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const { data: persona, error } = await db
      .from("community_ai_friend")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("id", id)
      .single();

    if (error || !persona) {
      return c.json({ error: "Persona not found" }, 404);
    }

    // Check if public or requester is creator
    if (!persona.isPublic) {
      const userId = c.req.query("userId");
      if (persona.creatorUserId !== userId) {
        return c.json({ error: "Not authorized to view this persona" }, 403);
      }
    }

    return c.json(persona);
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/community/commands/:id - Get single command details
app.get("/commands/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const { data: command, error } = await db
      .from("community_command")
      .select(`
        *,
        creator:creatorUserId (id, name, image)
      `)
      .eq("id", id)
      .single();

    if (error || !command) {
      return c.json({ error: "Command not found" }, 404);
    }

    if (!command.isPublic) {
      const userId = c.req.query("userId");
      if (command.creatorUserId !== userId) {
        return c.json({ error: "Not authorized to view this command" }, 403);
      }
    }

    return c.json(command);
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ==========================================
// Share to Community
// ==========================================

// POST /api/community/personas - Share AI friend to community
app.post("/personas", zValidator("json", shareAIFriendSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Get the original AI friend
    const { data: aiFriend, error: fetchError } = await db
      .from("ai_friend")
      .select("*, chat:chatId(creatorId)")
      .eq("id", data.aiFriendId)
      .single();

    if (fetchError || !aiFriend) {
      return c.json({ error: "AI friend not found" }, 404);
    }

    // Verify user has access (is member of the chat)
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", aiFriend.chatId)
      .eq("userId", data.userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not authorized to share this AI friend" }, 403);
    }

    // Check if already shared
    const { data: existing } = await db
      .from("community_ai_friend")
      .select("id")
      .eq("originalAiFriendId", data.aiFriendId)
      .single();

    if (existing) {
      return c.json({ error: "This AI friend is already shared to the community", existingId: existing.id }, 400);
    }

    // Create community entry
    const { data: communityItem, error: insertError } = await db
      .from("community_ai_friend")
      .insert({
        originalAiFriendId: data.aiFriendId,
        creatorUserId: data.userId,
        name: aiFriend.name,
        personality: aiFriend.personality,
        tone: aiFriend.tone,
        description: data.description || `A ${aiFriend.tone || "friendly"} AI friend named ${aiFriend.name}`,
        category: data.category,
        tags: data.tags,
        isPublic: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Community] Error sharing AI friend:", insertError);
      return c.json({ error: "Failed to share AI friend" }, 500);
    }

    return c.json(communityItem, 201);
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/community/commands - Share command to community
app.post("/commands", zValidator("json", shareCommandSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Get the original command
    const { data: command, error: fetchError } = await db
      .from("custom_slash_command")
      .select("*")
      .eq("id", data.commandId)
      .single();

    if (fetchError || !command) {
      return c.json({ error: "Command not found" }, 404);
    }

    // Verify user has access (is member of the chat)
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", command.chatId)
      .eq("userId", data.userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not authorized to share this command" }, 403);
    }

    // Check if already shared
    const { data: existing } = await db
      .from("community_command")
      .select("id")
      .eq("originalCommandId", data.commandId)
      .single();

    if (existing) {
      return c.json({ error: "This command is already shared to the community", existingId: existing.id }, 400);
    }

    // Create community entry
    const { data: communityItem, error: insertError } = await db
      .from("community_command")
      .insert({
        originalCommandId: data.commandId,
        creatorUserId: data.userId,
        command: command.command,
        prompt: command.prompt,
        description: data.description || `Custom command ${command.command}`,
        category: data.category,
        tags: data.tags,
        isPublic: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Community] Error sharing command:", insertError);
      return c.json({ error: "Failed to share command" }, 500);
    }

    return c.json(communityItem, 201);
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/community/workflows - Share workflow to community
app.post("/workflows", zValidator("json", shareWorkflowSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Get the original workflow
    const { data: workflow, error: fetchError } = await db
      .from("ai_workflow")
      .select("*")
      .eq("id", data.workflowId)
      .single();

    if (fetchError || !workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    // Verify user has access (is member of the chat)
    const { data: membership } = await db
      .from("chat_member")
      .select("*")
      .eq("chatId", workflow.chatId)
      .eq("userId", data.userId)
      .single();

    if (!membership) {
      return c.json({ error: "Not authorized to share this workflow" }, 403);
    }

    // Check if already shared
    const { data: existing } = await db
      .from("community_workflow")
      .select("id")
      .eq("originalWorkflowId", data.workflowId)
      .single();

    if (existing) {
      return c.json({ error: "This workflow is already shared to the community", existingId: existing.id }, 400);
    }

    // Create community entry
    const { data: communityItem, error: insertError } = await db
      .from("community_workflow")
      .insert({
        originalWorkflowId: data.workflowId,
        creatorUserId: data.userId,
        name: workflow.name,
        description: data.description || workflow.description || `Workflow: ${workflow.name}`,
        triggerType: workflow.triggerType,
        triggerConfig: workflow.triggerConfig,
        actionType: workflow.actionType,
        actionConfig: workflow.actionConfig,
        category: data.category,
        tags: data.tags,
        isPublic: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Community] Error sharing workflow:", insertError);
      return c.json({ error: "Failed to share workflow" }, 500);
    }

    return c.json(communityItem, 201);
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ==========================================
// Clone Items
// ==========================================

// POST /api/community/clone - Clone item to user's chat(s) or personal agents
app.post("/clone", zValidator("json", cloneItemSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Verify user is member of all target chats (only if not cloning to personal)
    if (!data.cloneToPersonal) {
      for (const chatId of data.targetChatIds) {
        const { data: membership } = await db
          .from("chat_member")
          .select("*")
          .eq("chatId", chatId)
          .eq("userId", data.userId)
          .single();

        if (!membership) {
          return c.json({ error: `Not a member of chat ${chatId}` }, 403);
        }
      }
    }

    const clonedItems: any[] = [];

    if (data.itemType === "ai_friend") {
      // Get community persona
      const { data: communityItem, error: fetchError } = await db
        .from("community_ai_friend")
        .select("*")
        .eq("id", data.communityItemId)
        .eq("isPublic", true)
        .single();

      if (fetchError || !communityItem) {
        return c.json({ error: "Community persona not found" }, 404);
      }

      if (data.cloneToPersonal) {
        // Clone to personal agents
        // Check if already cloned to personal agents
        const { data: existingPersonalAgent } = await db
          .from("ai_friend")
          .select("id")
          .eq("isPersonal", true)
          .eq("ownerUserId", data.userId)
          .eq("name", communityItem.name)
          .eq("personality", communityItem.personality)
          .single();

        if (existingPersonalAgent) {
          return c.json({ 
            error: "You already have a personal agent with the same name and personality" 
          }, 400);
        }

        // Get user's existing personal agents to determine color assignment
        const { data: existingAgents } = await db
          .from("ai_friend")
          .select("color")
          .eq("isPersonal", true)
          .eq("ownerUserId", data.userId);

        const usedColors = new Set((existingAgents || []).map((a: any) => a.color));
        const colors = ["#34C759", "#007AFF", "#FF9F0A", "#AF52DE", "#FF453A", "#FFD60A", "#64D2FF", "#FF375F"];
        
        // Find the first unused color, or cycle back to the beginning
        let assignedColor = colors[0];
        for (const color of colors) {
          if (!usedColors.has(color)) {
            assignedColor = color;
            break;
          }
        }
        // If all colors are used, use the next color in rotation
        if (usedColors.size >= colors.length) {
          assignedColor = colors[(existingAgents?.length || 0) % colors.length];
        }

        // Get user's first chat for the chatId (required field, but won't be used for personal agents)
        const { data: memberships } = await db
          .from("chat_member")
          .select("chatId")
          .eq("userId", data.userId)
          .limit(1);

        // Use a placeholder chatId if user has no chats (edge case)
        const chatId = memberships?.[0]?.chatId || "personal-placeholder";

        // Create personal AI agent
        const { data: newAgent, error: insertError } = await db
          .from("ai_friend")
          .insert({
            chatId,
            name: communityItem.name,
            personality: communityItem.personality,
            tone: communityItem.tone,
            engagementMode: "on-call",
            color: assignedColor,
            sortOrder: 0,
            createdBy: data.userId,
            isPersonal: true,
            ownerUserId: data.userId,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[Community] Error cloning AI friend to personal:", insertError);
          return c.json({ error: "Failed to clone to personal agents" }, 500);
        }

        // Record the clone (with null targetChatId for personal agents)
        await db.from("community_clone").insert({
          userId: data.userId,
          itemType: "ai_friend",
          communityItemId: data.communityItemId,
          targetChatId: null,
        });

        clonedItems.push({ personal: true, aiFriendId: newAgent.id });
      } else {
        // Clone to each target chat
        for (const chatId of data.targetChatIds) {
          // Check if already cloned to this chat
          const { data: existingClone } = await db
            .from("community_clone")
            .select("id")
            .eq("userId", data.userId)
            .eq("communityItemId", data.communityItemId)
            .eq("targetChatId", chatId)
            .single();

          if (existingClone) {
            continue; // Skip if already cloned
          }

          // Get existing AI friends count for sort order and color (exclude personal agents)
          const { data: existingFriends } = await db
            .from("ai_friend")
            .select("color")
            .eq("chatId", chatId)
            .or("isPersonal.is.null,isPersonal.eq.false");

          const usedColors = new Set((existingFriends || []).map((f: any) => f.color));
          const colors = ["#34C759", "#007AFF", "#FF9F0A", "#AF52DE", "#FF453A", "#FFD60A", "#64D2FF", "#FF375F"];
          let assignedColor = colors.find((c) => !usedColors.has(c)) || colors[0];

          // Create AI friend in target chat
          const { data: newFriend, error: insertError } = await db
            .from("ai_friend")
            .insert({
              chatId: chatId,
              name: communityItem.name,
              personality: communityItem.personality,
              tone: communityItem.tone,
              engagementMode: "on-call",
              color: assignedColor,
              sortOrder: existingFriends?.length || 0,
            })
            .select()
            .single();

          if (insertError) {
            console.error("[Community] Error cloning AI friend:", insertError);
            continue;
          }

          // Record the clone
          await db.from("community_clone").insert({
            userId: data.userId,
            itemType: "ai_friend",
            communityItemId: data.communityItemId,
            targetChatId: chatId,
          });

          clonedItems.push({ chatId, aiFriendId: newFriend.id });
        }
      }
    } else if (data.itemType === "command") {
      // Get community command
      const { data: communityItem, error: fetchError } = await db
        .from("community_command")
        .select("*")
        .eq("id", data.communityItemId)
        .eq("isPublic", true)
        .single();

      if (fetchError || !communityItem) {
        return c.json({ error: "Community command not found" }, 404);
      }

      // Clone to each target chat
      for (const chatId of data.targetChatIds) {
        // Check if already cloned to this chat
        const { data: existingClone } = await db
          .from("community_clone")
          .select("id")
          .eq("userId", data.userId)
          .eq("communityItemId", data.communityItemId)
          .eq("targetChatId", chatId)
          .single();

        if (existingClone) {
          continue;
        }

        // Check if command already exists in chat
        const { data: existingCommand } = await db
          .from("custom_slash_command")
          .select("id")
          .eq("chatId", chatId)
          .eq("command", communityItem.command)
          .single();

        if (existingCommand) {
          continue; // Skip if command name already exists
        }

        // Create command in target chat
        const { data: newCommand, error: insertError } = await db
          .from("custom_slash_command")
          .insert({
            chatId: chatId,
            command: communityItem.command,
            prompt: communityItem.prompt,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[Community] Error cloning command:", insertError);
          continue;
        }

        // Record the clone
        await db.from("community_clone").insert({
          userId: data.userId,
          itemType: "command",
          communityItemId: data.communityItemId,
          targetChatId: chatId,
        });

        clonedItems.push({ chatId, commandId: newCommand.id });
      }
    } else if (data.itemType === "workflow") {
      // Get community workflow
      const { data: communityItem, error: fetchError } = await db
        .from("community_workflow")
        .select("*")
        .eq("id", data.communityItemId)
        .eq("isPublic", true)
        .single();

      if (fetchError || !communityItem) {
        return c.json({ error: "Community workflow not found" }, 404);
      }

      // Clone to each target chat
      for (const chatId of data.targetChatIds) {
        // Check if already cloned to this chat
        const { data: existingClone } = await db
          .from("community_clone")
          .select("id")
          .eq("userId", data.userId)
          .eq("communityItemId", data.communityItemId)
          .eq("targetChatId", chatId)
          .single();

        if (existingClone) {
          continue;
        }

        // Create workflow in target chat
        const { data: newWorkflow, error: insertError } = await db
          .from("ai_workflow")
          .insert({
            chatId: chatId,
            creatorId: data.userId,
            name: communityItem.name,
            description: communityItem.description,
            triggerType: communityItem.triggerType,
            triggerConfig: communityItem.triggerConfig,
            actionType: communityItem.actionType,
            actionConfig: communityItem.actionConfig,
            isEnabled: true,
            cooldownMinutes: 5,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[Community] Error cloning workflow:", insertError);
          continue;
        }

        // Record the clone
        await db.from("community_clone").insert({
          userId: data.userId,
          itemType: "workflow",
          communityItemId: data.communityItemId,
          targetChatId: chatId,
        });

        clonedItems.push({ chatId, workflowId: newWorkflow.id });
      }
    }

    // Increment clone count for the community item
    if (clonedItems.length > 0) {
      const table = data.itemType === "ai_friend" 
        ? "community_ai_friend" 
        : data.itemType === "command"
        ? "community_command"
        : "community_workflow";
      
      // Get current clone count and increment
      const { data: currentItem } = await db
        .from(table)
        .select("cloneCount")
        .eq("id", data.communityItemId)
        .single();
      
      if (currentItem) {
        await db
          .from(table)
          .update({ cloneCount: (currentItem.cloneCount || 0) + clonedItems.length })
          .eq("id", data.communityItemId);
      }
    }

    return c.json({
      success: true,
      clonedItems,
      message: `Cloned to ${clonedItems.length} chat(s)`,
    });
  } catch (error) {
    console.error("[Community] Error cloning item:", error);
    console.error("[Community] Error details:", JSON.stringify(error, null, 2));
    return c.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ==========================================
// User's Shared Items
// ==========================================

// GET /api/community/my-shares - Get user's shared items
app.get("/my-shares", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const { data: personas } = await db
      .from("community_ai_friend")
      .select("*")
      .eq("creatorUserId", userId)
      .order("createdAt", { ascending: false });

    const { data: commands } = await db
      .from("community_command")
      .select("*")
      .eq("creatorUserId", userId)
      .order("createdAt", { ascending: false });

    const { data: workflows } = await db
      .from("community_workflow")
      .select("*")
      .eq("creatorUserId", userId)
      .order("createdAt", { ascending: false });

    return c.json({
      personas: personas || [],
      commands: commands || [],
      workflows: workflows || [],
    });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/community/personas/:id - Remove shared persona
app.delete("/personas/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const { data: persona } = await db
      .from("community_ai_friend")
      .select("creatorUserId")
      .eq("id", id)
      .single();

    if (!persona) {
      return c.json({ error: "Persona not found" }, 404);
    }

    if (persona.creatorUserId !== userId) {
      return c.json({ error: "Not authorized to delete this persona" }, 403);
    }

    await db.from("community_ai_friend").delete().eq("id", id);

    return c.json({ success: true, message: "Persona removed from community" });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/community/commands/:id - Remove shared command
app.delete("/commands/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const { data: command } = await db
      .from("community_command")
      .select("creatorUserId")
      .eq("id", id)
      .single();

    if (!command) {
      return c.json({ error: "Command not found" }, 404);
    }

    if (command.creatorUserId !== userId) {
      return c.json({ error: "Not authorized to delete this command" }, 403);
    }

    await db.from("community_command").delete().eq("id", id);

    return c.json({ success: true, message: "Command removed from community" });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/community/workflows/:id - Remove shared workflow
app.delete("/workflows/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const { data: workflow } = await db
      .from("community_workflow")
      .select("creatorUserId")
      .eq("id", id)
      .single();

    if (!workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    if (workflow.creatorUserId !== userId) {
      return c.json({ error: "Not authorized to delete this workflow" }, 403);
    }

    await db.from("community_workflow").delete().eq("id", id);

    return c.json({ success: true, message: "Workflow removed from community" });
  } catch (error) {
    console.error("[Community] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;

