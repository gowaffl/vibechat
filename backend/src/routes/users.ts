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
  deleteUserAccountRequestSchema,
  deleteUserAccountResponseSchema,
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

// DELETE /api/users/:id - Delete user account and all associated data
// This endpoint complies with Apple App Store guidelines (5.1.1(v))
// Deletes all personal data except what is legally required to retain
users.delete("/:id", zValidator("json", deleteUserAccountRequestSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const { confirmText, feedback } = c.req.valid("json");
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Verify user wants to delete by checking confirmation text
    if (confirmText !== "DELETE") {
      return c.json({ error: "Invalid confirmation text. Please type DELETE to confirm." }, 400);
    }

    // Use user-scoped client if token exists, otherwise fall back to db (admin)
    const client = token ? createUserClient(token) : db;

    console.log(`[Users] DELETE /${id} - Starting account deletion process`);
    
    // Log feedback if provided (for improvement purposes)
    if (feedback && feedback.trim()) {
      console.log(`[Users] DELETE /${id} - User feedback: ${feedback}`);
      // TODO: Consider storing feedback in a separate analytics table for future analysis
      // This could help improve the product by understanding why users leave
    }

    // Step 1: Delete all user-related data
    // Note: We rely on database CASCADE constraints for related data
    // But we'll explicitly delete some tables to be thorough

    // Delete reactions by user
    const { error: reactionsError } = await db
      .from("reaction")
      .delete()
      .eq("userId", id);
    if (reactionsError) {
      console.error("[Users] Error deleting reactions:", reactionsError);
    }

    // Delete read receipts by user
    const { error: readReceiptsError } = await db
      .from("read_receipt")
      .delete()
      .eq("userId", id);
    if (readReceiptsError) {
      console.error("[Users] Error deleting read receipts:", readReceiptsError);
    }

    // Delete bookmarks by user
    const { error: bookmarksError } = await db
      .from("bookmark")
      .delete()
      .eq("userId", id);
    if (bookmarksError) {
      console.error("[Users] Error deleting bookmarks:", bookmarksError);
    }

    // Delete mentions (both by and of user)
    const { error: mentionsError } = await db
      .from("mention")
      .delete()
      .or(`mentionedUserId.eq.${id},mentionedByUserId.eq.${id}`);
    if (mentionsError) {
      console.error("[Users] Error deleting mentions:", mentionsError);
    }

    // Delete event responses by user
    const { error: eventResponsesError } = await db
      .from("event_response")
      .delete()
      .eq("userId", id);
    if (eventResponsesError) {
      console.error("[Users] Error deleting event responses:", eventResponsesError);
    }

    // Delete media reactions by user
    const { error: mediaReactionsError } = await db
      .from("media_reaction")
      .delete()
      .eq("userId", id);
    if (mediaReactionsError) {
      console.error("[Users] Error deleting media reactions:", mediaReactionsError);
    }

    // Delete conversation summaries for user
    const { error: summariesError } = await db
      .from("conversation_summary")
      .delete()
      .eq("userId", id);
    if (summariesError) {
      console.error("[Users] Error deleting conversation summaries:", summariesError);
    }

    // Delete thread memberships
    const { error: threadMembersError } = await db
      .from("thread_member")
      .delete()
      .eq("userId", id);
    if (threadMembersError) {
      console.error("[Users] Error deleting thread memberships:", threadMembersError);
    }

    // Delete threads created by user
    const { error: threadsError } = await db
      .from("thread")
      .delete()
      .eq("creatorId", id);
    if (threadsError) {
      console.error("[Users] Error deleting threads:", threadsError);
    }

    // Delete messages by user (this will cascade to reactions, mentions, etc.)
    const { error: messagesError } = await db
      .from("message")
      .delete()
      .eq("userId", id);
    if (messagesError) {
      console.error("[Users] Error deleting messages:", messagesError);
    }

    // Delete chat memberships
    const { error: chatMembersError } = await db
      .from("chat_member")
      .delete()
      .eq("userId", id);
    if (chatMembersError) {
      console.error("[Users] Error deleting chat memberships:", chatMembersError);
    }

    // Get chats created by user to potentially delete them
    const { data: createdChats } = await db
      .from("chat")
      .select("id")
      .eq("creatorId", id);

    // For each chat created by user, delete associated data
    if (createdChats && createdChats.length > 0) {
      for (const chat of createdChats) {
        // Delete AI friends in the chat
        await db.from("ai_friend").delete().eq("chatId", chat.id);
        
        // Delete custom commands in the chat
        await db.from("custom_slash_command").delete().eq("chatId", chat.id);
        
        // Delete events in the chat
        await db.from("event").delete().eq("chatId", chat.id);
        
        // Delete threads in the chat
        await db.from("thread").delete().eq("chatId", chat.id);
      }

      // Delete chats created by user
      const { error: chatsError } = await db
        .from("chat")
        .delete()
        .eq("creatorId", id);
      if (chatsError) {
        console.error("[Users] Error deleting chats:", chatsError);
      }
    }

    // Step 2: Finally, delete the user account
    const { error: userError } = await client
      .from("user")
      .delete()
      .eq("id", id);

    if (userError) {
      console.error("[Users] Error deleting user account:", userError);
      return c.json({ error: "Failed to delete user account" }, 500);
    }

    console.log(`[Users] DELETE /${id} - Account deletion completed successfully`);

    return c.json(deleteUserAccountResponseSchema.parse({
      success: true,
      message: "Account and all associated data have been permanently deleted",
    }));
  } catch (error) {
    console.error("[Users] Error deleting user account:", error);
    return c.json({ error: "Failed to delete user account" }, 500);
  }
});

export default users;
