import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppType } from "../index";
import { db } from "../db";
import { updateGroupSettingsRequestSchema, type MessageHistoryEntry } from "../../../shared/contracts";

const groupSettings = new Hono<AppType>();

// Helper function to parse message history from JSON string
const parseMessageHistory = (messageHistory: string): MessageHistoryEntry[] => {
  try {
    return JSON.parse(messageHistory);
  } catch {
    return [];
  }
};

// GET /api/group-settings - Get group settings
groupSettings.get("/", async (c) => {
  try {
    // Try to get existing settings
    const { data: settings, error } = await db
      .from("group_settings")
      .select("*")
      .eq("id", "global-chat")
      .single();

    if (error) {
      console.error("[GroupSettings] Error fetching settings:", error);
      return c.json({ error: "Failed to fetch group settings" }, 500);
    }

    // Settings should exist from migration, but this is a safety check
    if (!settings) {
      return c.json({ error: "Group settings not found" }, 404);
    }

    return c.json({
      id: settings.id,
      name: settings.name,
      bio: settings.bio,
      image: settings.image,
      aiPersonality: settings.aiPersonality,
      aiTone: settings.aiTone,
      messageHistory: parseMessageHistory(settings.messageHistory),
      createdAt: new Date(settings.createdAt).toISOString(),
      updatedAt: new Date(settings.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error("[GroupSettings] Error fetching settings:", error);
    return c.json({ error: "Failed to fetch group settings" }, 500);
  }
});

// PATCH /api/group-settings - Update group settings
groupSettings.patch("/", zValidator("json", updateGroupSettingsRequestSchema), async (c) => {
  try {
    const updates = c.req.valid("json");

    // Update settings
    const { data: updatedSettings, error } = await db
      .from("group_settings")
      .update(updates)
      .eq("id", "global-chat")
      .select("*")
      .single();

    if (error || !updatedSettings) {
      console.error("[GroupSettings] Error updating settings:", error);
      return c.json({ error: "Failed to update group settings" }, 500);
    }

    return c.json({
      id: updatedSettings.id,
      name: updatedSettings.name,
      bio: updatedSettings.bio,
      image: updatedSettings.image,
      aiPersonality: updatedSettings.aiPersonality,
      aiTone: updatedSettings.aiTone,
      messageHistory: parseMessageHistory(updatedSettings.messageHistory),
      createdAt: new Date(updatedSettings.createdAt).toISOString(),
      updatedAt: new Date(updatedSettings.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error("[GroupSettings] Error updating settings:", error);
    return c.json({ error: "Failed to update group settings" }, 500);
  }
});

export default groupSettings;
