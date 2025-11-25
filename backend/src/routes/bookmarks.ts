import { Hono } from "hono";
import { db } from "../db";
import { formatTimestamp } from "../utils/supabase-helpers";

const app = new Hono();

// Get all bookmarks for a user in a specific chat
app.get("/", async (c) => {
  const { userId, chatId } = c.req.query();

  if (!userId || !chatId) {
    return c.json({ error: "userId and chatId are required" }, 400);
  }

  try {
    // Fetch bookmarks
    const { data: bookmarks, error: bookmarksError } = await db
      .from("bookmark")
      .select("*")
      .eq("userId", userId)
      .eq("chatId", chatId)
      .order("createdAt", { ascending: false });

    if (bookmarksError) {
      console.error("Error fetching bookmarks:", bookmarksError);
      return c.json({ error: "Failed to fetch bookmarks" }, 500);
    }

    // Fetch related messages and users
    const bookmarksWithData = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const { data: message, error: messageError } = await db
          .from("message")
          .select("*")
          .eq("id", bookmark.messageId)
          .single();

        if (messageError) {
          console.error("Error fetching message:", messageError);
          return { ...bookmark, message: null };
        }

        const { data: user, error: userError } = await db
          .from("user")
          .select("id, name, image")
          .eq("id", message.userId)
          .single();

        if (userError) {
          console.error("Error fetching user:", userError);
        }

        return {
          ...bookmark,
          message: {
            ...message,
            user: user || null,
          },
        };
      })
    );

    return c.json(bookmarksWithData);
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    return c.json({ error: "Failed to fetch bookmarks" }, 500);
  }
});

// Toggle bookmark (add if not exists, remove if exists)
app.post("/toggle", async (c) => {
  try {
    const { userId, chatId, messageId } = await c.req.json();

    if (!userId || !chatId || !messageId) {
      return c.json({ error: "userId, chatId, and messageId are required" }, 400);
    }

    // Check if bookmark already exists (using unique constraint)
    const { data: existingBookmark } = await db
      .from("bookmark")
      .select("*")
      .eq("userId", userId)
      .eq("messageId", messageId)
      .single();

    if (existingBookmark) {
      // Remove bookmark
      const { error: deleteError } = await db
        .from("bookmark")
        .delete()
        .eq("id", existingBookmark.id);

      if (deleteError) {
        console.error("Error removing bookmark:", deleteError);
        return c.json({ error: "Failed to remove bookmark" }, 500);
      }

      return c.json({ 
        action: "removed",
        bookmarkId: existingBookmark.id 
      });
    } else {
      // Add bookmark
      const { data: newBookmark, error: createError } = await db
        .from("bookmark")
        .insert({
          userId,
          chatId,
          messageId,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating bookmark:", createError);
        return c.json({ error: "Failed to create bookmark" }, 500);
      }

      return c.json({ 
        action: "added",
        bookmark: newBookmark 
      });
    }
  } catch (error) {
    console.error("Error toggling bookmark:", error);
    return c.json({ error: "Failed to toggle bookmark" }, 500);
  }
});

// Delete a specific bookmark
app.delete("/:bookmarkId", async (c) => {
  const bookmarkId = c.req.param("bookmarkId");
  const { userId } = c.req.query();

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Verify the bookmark belongs to the user before deleting
    const { data: bookmark, error: fetchError } = await db
      .from("bookmark")
      .select("*")
      .eq("id", bookmarkId)
      .single();

    if (fetchError || !bookmark) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    if (bookmark.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const { error: deleteError } = await db
      .from("bookmark")
      .delete()
      .eq("id", bookmarkId);

    if (deleteError) {
      console.error("Error deleting bookmark:", deleteError);
      return c.json({ error: "Failed to delete bookmark" }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting bookmark:", error);
    return c.json({ error: "Failed to delete bookmark" }, 500);
  }
});

export default app;
