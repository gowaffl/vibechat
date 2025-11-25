#!/usr/bin/env bun
/**
 * Backfill script to tag existing messages in the database
 * Run with: bun run src/scripts/backfill-tags.ts
 */

import { db } from "../db";
import { tagMultipleMessages } from "../services/message-tagger";

async function main() {
  console.log("🏷️  Starting message tagging backfill...");

  // Get all messages that don't have tags yet
  // Supabase doesn't support complex "where not exists" in one go easily without raw SQL or join
  // So we'll fetch recent text messages and filter in memory or use !inner join if possible
  
  // Fetch last 100 text messages
  const { data: messages, error } = await db
    .from("message")
    .select("id, content")
    .eq("messageType", "text")
    .neq("content", "")
    .order("createdAt", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching messages:", error);
    return;
  }

  console.log(`📝 Found ${messages.length} recent messages to check`);

  if (messages.length === 0) {
    console.log("✅ No messages to tag!");
    return;
  }

  // Filter out messages that already have tags
  const messageIds = messages.map(m => m.id);
  
  const { data: existingTags } = await db
    .from("message_tag")
    .select("messageId")
    .in("messageId", messageIds);

  const messagesWithTags = new Set((existingTags || []).map(t => t.messageId));
  const messagesToTag = messages.filter(m => !messagesWithTags.has(m.id));

  console.log(`🔍 ${messagesWithTags.size} messages already tagged`);
  console.log(`🚀 Tagging ${messagesToTag.length} new messages...`);

  if (messagesToTag.length === 0) {
    console.log("✅ All checked messages already tagged!");
    return;
  }

  // Tag messages in batches
  await tagMultipleMessages(messagesToTag);

  console.log("✅ Backfill complete!");

  // Show summary
  const { count } = await db
    .from("message_tag")
    .select("*", { count: 'exact', head: true });
    
  console.log(`📊 Total tags in database: ${count}`);
}

main()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
