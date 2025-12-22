import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";

import { env } from "./env";
import { db } from "./db";
import { rateLimiter } from "./middleware/rate-limiter";

// Test database connectivity at startup
async function testDatabaseConnection() {
  console.log("🔌 Testing database connection with service role...");
  try {
    const { count, error } = await db
      .from("chat")
      .select("*", { count: "exact", head: true });
    
    if (error) {
      console.error("❌ Database connection test FAILED:", error.message);
      console.error("   Error code:", error.code);
      console.error("   Error details:", error.details);
    } else {
      console.log(`✅ Database connection test PASSED - Found ${count} chats`);
    }

    // Also test chat_member table
    const { count: memberCount, error: memberError } = await db
      .from("chat_member")
      .select("*", { count: "exact", head: true });
    
    if (memberError) {
      console.error("❌ chat_member table test FAILED:", memberError.message);
    } else {
      console.log(`✅ chat_member table test PASSED - Found ${memberCount} memberships`);
    }
  } catch (e) {
    console.error("❌ Database connection test threw exception:", e);
  }
}

// Run the test immediately
testDatabaseConnection();

// Run periodic connection health checks every 2 minutes
setInterval(async () => {
  console.log("🔄 Running periodic database health check...");
  await testDatabaseConnection();
}, 2 * 60 * 1000); // Every 2 minutes
export type { AppType } from "./types";
import { uploadRouter } from "./routes/upload";
import { imageProxy } from "./routes/image-proxy";
import usersRouter from "./routes/users";
import messagesRouter from "./routes/messages";
import aiRouter from "./routes/ai";
import groupSettingsRouter from "./routes/group-settings";
import reactionsRouter from "./routes/reactions";
import customCommandsRouter from "./routes/custom-commands";
import chatsRouter from "./routes/chats";
import inviteRouter from "./routes/invite";
import searchRouter from "./routes/search";
import { linkPreviewRouter } from "./routes/link-preview";
import bookmarksRouter from "./routes/bookmarks";
import aiFriendsRouter from "./routes/ai-friends";
// AI Super Features routes
import threadsRouter from "./routes/threads";
import eventsRouter from "./routes/events";
import reactorRouter from "./routes/reactor";
import catchupRouter from "./routes/catchup";
import pollsRouter from "./routes/polls";
import voiceRoomsRouter from "./routes/voice-rooms";
import webhooksRouter from "./routes/webhooks";
// import notificationsRouter from "./routes/notifications"; // Moved to chats router
import authRouter from "./routes/auth";
import { startAvatarCron } from "./services/avatar-cron";
import { startAIEngagementService } from "./services/ai-engagement";
// AI Workflow Automation
import workflowsRouter from "./routes/workflows";
import { startWorkflowService } from "./services/ai-workflows";
import { startWorkflowScheduler } from "./services/workflow-scheduler";
// Community Marketplace
import communityRouter from "./routes/community";
// AI-Native Communication
import aiNativeRouter from "./routes/ai-native";

const app = new Hono();

console.log("🔧 Initializing Hono application...");
app.use("*", logger());
app.use("/*", cors());
// Rate limiting to protect against runaway clients
// Applies different limits based on endpoint type (auth, heavy, light, default)
app.use("/api/*", rateLimiter());

// Serve uploaded images statically
// Files in uploads/ directory are accessible at /uploads/* URLs
console.log("📁 Serving static files from uploads/ directory");
app.use("/uploads/*", serveStatic({ root: "./" }));

// Mount route modules
console.log("🔐 Mounting phone auth routes at /api/auth");
app.route("/api/auth", authRouter);

console.log("📤 Mounting upload routes at /api/upload");
app.route("/api/upload", uploadRouter);

console.log("🖼️  Mounting image proxy routes at /api/images");
app.route("/api/images", imageProxy);

console.log("👥 Mounting users routes at /api/users");
app.route("/api/users", usersRouter);

console.log("💬 Mounting chats routes at /api/chats");
app.route("/api/chats", chatsRouter);

console.log("🎟️  Mounting invite routes at /api/invite");
app.route("/api/invite", inviteRouter);

console.log("🔍 Mounting search routes at /api/search");
app.route("/api/search", searchRouter);

console.log("💬 Mounting messages routes at /api/messages");
app.route("/api/messages", messagesRouter);

console.log("🤖 Mounting AI routes at /api/ai");
app.route("/api/ai", aiRouter);

console.log("⚙️  Mounting group settings routes at /api/group-settings");
app.route("/api/group-settings", groupSettingsRouter);

console.log("👍 Mounting reactions routes at /api/reactions");
app.route("/api/reactions", reactionsRouter);

console.log("⚡ Mounting custom commands routes at /api/custom-commands");
app.route("/api/custom-commands", customCommandsRouter);

console.log("🔗 Mounting link preview routes at /api/link-preview");
app.route("/api/link-preview", linkPreviewRouter);

console.log("🔖 Mounting bookmarks routes at /api/bookmarks");
app.route("/api/bookmarks", bookmarksRouter);

console.log("🤖 Mounting AI friends routes at /api/ai-friends");
app.route("/api/ai-friends", aiFriendsRouter);

// AI Super Features routes
console.log("🧵 Mounting threads routes at /api/threads");
app.route("/api/threads", threadsRouter);

console.log("📅 Mounting events routes at /api/events");
app.route("/api/events", eventsRouter);

console.log("🎨 Mounting reactor routes at /api/reactor");
app.route("/api/reactor", reactorRouter);

console.log("⚡ Mounting catchup routes at /api/catchup");
app.route("/api/catchup", catchupRouter);

console.log("📊 Mounting polls routes at /api/polls");
app.route("/api/polls", pollsRouter);

console.log("🎙️ Mounting voice rooms routes at /api/voice-rooms");
app.route("/api/voice-rooms", voiceRoomsRouter);

console.log("🔔 Mounting webhooks routes at /api/webhooks");
app.route("/api/webhooks", webhooksRouter);

// AI Workflow Automation
console.log("🔄 Mounting workflows routes at /api/workflows");
app.route("/api/workflows", workflowsRouter);

// Community Marketplace
console.log("🌐 Mounting community routes at /api/community");
app.route("/api/community", communityRouter);

// AI-Native Communication
console.log("🌍 Mounting AI-native routes at /api/ai-native");
app.route("/api/ai-native", aiNativeRouter);

// console.log("🔔 Mounting notifications routes at /api");
// app.route("/api", notificationsRouter); // Moved to chats router

// Health check endpoint
// Used by load balancers and monitoring tools to verify service is running
app.get("/health", (c) => {
  console.log("💚 Health check requested");
  return c.json({ status: "ok" });
});

// Start the server
console.log("⚙️  Starting server...");
serve({ fetch: app.fetch, port: Number(env.PORT) }, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🚀 Server is running on port ${env.PORT}`);
  console.log(`🔗 Base URL: http://localhost:${env.PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📚 Available endpoints:");
  console.log("  🔐 Auth:     /api/auth/*");
  console.log("  📤 Upload:   POST /api/upload/image");
  console.log("  👥 Users:    GET/POST/PATCH /api/users");
  console.log("  💬 Chats:    GET/POST/PATCH/DELETE /api/chats");
  console.log("  🎟️  Invite:   GET/POST /api/invite/:token");
  console.log("  💬 Messages: GET/POST /api/messages");
  console.log("  🤖 AI:       POST /api/ai/chat");
  console.log("  🖼️  Avatar:   POST /api/ai/generate-group-avatar");
  console.log("  ⚙️  Settings: GET/PATCH /api/group-settings");
  console.log("  👍 Reactions: POST/DELETE /api/reactions");
  console.log("  ⚡ Commands: GET/POST/PATCH/DELETE /api/custom-commands");
  console.log("  🔗 Link Preview: POST /api/link-preview/fetch");
  console.log("  🔖 Bookmarks: GET/POST/DELETE /api/bookmarks");
  console.log("  🔔 Notifications: POST /api/chats/:chatId/read-receipts");
  console.log("  🔔 Unread Counts: GET /api/chats/unread-counts");
  console.log("\n  🌟 AI Super Features:");
  console.log("  🧵 Threads:  GET/POST/PATCH/DELETE /api/threads");
  console.log("  📅 Events:   GET/POST/PATCH /api/events");
  console.log("  🎨 Reactor:  POST /api/reactor/*");
  console.log("  ⚡ Catch-Up: GET/POST /api/catchup");
  console.log("  📊 Polls:    GET/POST/PATCH/DELETE /api/polls");
  console.log("  🎙️  Vibe Call: GET/POST /api/voice-rooms");
  console.log("  🔔 Webhooks: POST /api/webhooks/livekit");
  console.log("\n  🤖 AI Mega Features:");
  console.log("  🔄 Workflows: GET/POST/PATCH/DELETE /api/workflows");
  console.log("  🌐 Community: GET/POST /api/community");
  console.log("  🌍 AI-Native: POST /api/ai-native/translate|adjust-tone|context-card");
  console.log("\n  💚 Health:   GET /health");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Daily avatar generation is manual only (via sparkle button in Group Settings)
  // Limit resets at midnight Eastern time
  // startAvatarCron(); // Disabled - manual generation only

  // Start AI engagement polling service
  startAIEngagementService();
  
  // Start AI Workflow Services
  console.log("🔄 Starting AI Workflow trigger service...");
  startWorkflowService();
  console.log("⏰ Starting AI Workflow scheduler service...");
  startWorkflowScheduler();
});
