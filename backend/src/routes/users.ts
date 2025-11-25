import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppType } from "../index";
import {
  createUserRequestSchema,
  createUserResponseSchema,
  updateUserRequestSchema,
  updateUserResponseSchema,
  getUserResponseSchema,
  registerPushTokenRequestSchema,
  registerPushTokenResponseSchema,
  updateNotificationPreferencesRequestSchema,
  updateNotificationPreferencesResponseSchema,
} from "../../../shared/contracts";
import { db, createUserClient } from "../db";

const users = new Hono<AppType>();

// Helper function to format user response
const formatUserResponse = (user: any) => ({
  id: user.id,
  phone: user.phone,
  name: user.name,
  bio: user.bio,
  image: user.image,
  birthdate: user.birthdate,
  hasCompletedOnboarding: user.hasCompletedOnboarding,
  createdAt: typeof user.createdAt === 'string' ? user.createdAt : new Date(user.createdAt).toISOString(),
  updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : new Date(user.updatedAt).toISOString(),
});

// POST /api/users - Create or get user
users.post("/", zValidator("json", createUserRequestSchema), async (c) => {
  const { id, name, image } = c.req.valid("json");

  // Check if user already exists
  const { data: existingUser } = await db
    .from("user")
    .select("*")
    .eq("id", id)
    .single();

  let user = existingUser;

  if (!user) {
    // Create new user
    const { data: newUser, error } = await db
      .from("user")
      .insert({
        id,
        name: name || "Anonymous",
        image: image || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Users] Error creating user:", error);
      return c.json({ error: "Failed to create user" }, 500);
    }

    user = newUser;
  }

  return c.json(createUserResponseSchema.parse(formatUserResponse(user)));
});

// PATCH /api/users/:id - Update user
users.patch("/:id", zValidator("json", updateUserRequestSchema), async (c) => {
  const id = c.req.param("id");
  const { name, bio, image, birthdate, hasCompletedOnboarding } = c.req.valid("json");
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (bio !== undefined) updateData.bio = bio;
  if (image !== undefined) updateData.image = image;
  if (birthdate !== undefined) updateData.birthdate = birthdate;
  if (hasCompletedOnboarding !== undefined) updateData.hasCompletedOnboarding = hasCompletedOnboarding;

  // Use user-scoped client if token exists, otherwise fall back to db (admin)
  const client = token ? createUserClient(token) : db;

  console.log(`[Users] PATCH /${id} - Update data:`, updateData);
  console.log(`[Users] PATCH /${id} - Token present:`, !!token);

  const { data: user, error } = await client
    .from("user")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Users] Error updating user:", error);
    return c.json({ error: "Failed to update user" }, 500);
  }
  
  console.log(`[Users] PATCH /${id} - Success:`, user);

  return c.json(updateUserResponseSchema.parse(formatUserResponse(user)));
});

// GET /api/users/:id - Get user by ID
users.get("/:id", async (c) => {
  const id = c.req.param("id");

  const { data: user, error } = await db
    .from("user")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(getUserResponseSchema.parse(formatUserResponse(user)));
});

// GET /api/users - Get all users (for inviting to chats)
users.get("/", async (c) => {
  try {
    const { data: users, error } = await db
      .from("user")
      .select("*")
      .eq("hasCompletedOnboarding", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("[Users] Error fetching all users:", error);
      return c.json({ error: "Failed to fetch users" }, 500);
    }

    return c.json(users.map(formatUserResponse));
  } catch (error) {
    console.error("[Users] Error fetching all users:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// POST /api/users/:id/push-token - Register push notification token
users.post("/:id/push-token", zValidator("json", registerPushTokenRequestSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const { pushToken } = c.req.valid("json");

    const { error } = await db
      .from("user")
      .update({ pushToken })
      .eq("id", id);

    if (error) {
      console.error("[Users] Error registering push token:", error);
      return c.json({ error: "Failed to register push token" }, 500);
    }

    return c.json(registerPushTokenResponseSchema.parse({
      success: true,
      message: "Push token registered successfully",
    }));
  } catch (error) {
    console.error("[Users] Error registering push token:", error);
    return c.json({ error: "Failed to register push token" }, 500);
  }
});

// PATCH /api/users/:id/notifications - Update notification preferences
users.patch("/:id/notifications", zValidator("json", updateNotificationPreferencesRequestSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const { pushNotificationsEnabled } = c.req.valid("json");

    const { error } = await db
      .from("user")
      .update({ pushNotificationsEnabled })
      .eq("id", id);

    if (error) {
      console.error("[Users] Error updating notification preferences:", error);
      return c.json({ error: "Failed to update notification preferences" }, 500);
    }

    return c.json(updateNotificationPreferencesResponseSchema.parse({
      success: true,
      message: "Notification preferences updated successfully",
      pushNotificationsEnabled,
    }));
  } catch (error) {
    console.error("[Users] Error updating notification preferences:", error);
    return c.json({ error: "Failed to update notification preferences" }, 500);
  }
});

export default users;
