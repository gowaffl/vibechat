import { PrismaClient } from "../../generated/prisma";
import { tagMessage } from "../services/message-tagger";

const prisma = new PrismaClient();

/**
 * Backfill tags for messages that don't have any tags yet
 */
async function backfillMissingTags() {
  console.log("🔍 Finding messages without tags...");

  // Find all messages that have content but no tags
  const untaggedMessages = await prisma.message.findMany({
    where: {
      AND: [
        { content: { not: "" } },
        { tags: { none: {} } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📊 Found ${untaggedMessages.length} messages without tags\n`);

  if (untaggedMessages.length === 0) {
    console.log("✅ All messages are already tagged!");
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < untaggedMessages.length; i++) {
    const message = untaggedMessages[i];
    const progress = `[${i + 1}/${untaggedMessages.length}]`;

    // Skip system messages
    if (
      message.content.includes("created a new event:") ||
      message.content.includes("finalized event:") ||
      message.content.includes("cancelled event:")
    ) {
      console.log(`${progress} ⏭️  Skipping system message:`, message.content.substring(0, 50));
      skipCount++;
      continue;
    }

    // Skip very short messages
    if (message.content.trim().length < 3) {
      console.log(`${progress} ⏭️  Skipping very short message:`, message.content);
      skipCount++;
      continue;
    }

    try {
      console.log(`${progress} 🏷️  Tagging: "${message.content.substring(0, 80)}..."`);
      await tagMessage(message.id, message.content);
      successCount++;

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`${progress} ❌ Error tagging message ${message.id}:`, error);
      errorCount++;
    }
  }

  console.log("\n📈 Backfill Complete!");
  console.log(`✅ Successfully tagged: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  await prisma.$disconnect();
}

// Run the backfill
backfillMissingTags().catch((error) => {
  console.error("Fatal error during backfill:", error);
  process.exit(1);
});

