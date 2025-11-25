import { tagMessage } from "../services/message-tagger";
import { db } from "../db";

async function testMessageTagging() {
  console.log("🧪 Testing message tagging directly...\n");

  // Find a recent message (we can't easily filter by "no tags" efficiently without complex query, 
  // so we'll just pick a recent message and re-tag it for testing purposes)
  const { data: messages } = await db
    .from("message")
    .select("id, content, createdAt")
    .eq("messageType", "text")
    .neq("content", "")
    .order("createdAt", { ascending: false })
    .limit(1);

  const untaggedMessage = messages?.[0];

  if (!untaggedMessage) {
    console.log("❌ No messages found");
    return;
  }

  console.log(`📨 Found message to test (re-tagging):`);
  console.log(`   ID: ${untaggedMessage.id}`);
  console.log(`   Content: "${untaggedMessage.content.substring(0, 100)}"`);
  console.log(`   Created: ${new Date(untaggedMessage.createdAt).toISOString()}`);
  console.log();

  console.log("🏷️  Calling tagMessage()...\n");

  try {
    await tagMessage(untaggedMessage.id, untaggedMessage.content);
    console.log("✅ tagMessage() completed without errors\n");

    // Check if tags were created
    const { data: tags } = await db
      .from("message_tag")
      .select("tagType, tagValue")
      .eq("messageId", untaggedMessage.id);

    if (tags && tags.length > 0) {
      console.log(`✅ SUCCESS! Found ${tags.length} tags:`);
      const tagsByType: Record<string, string[]> = {};
      for (const tag of tags) {
        if (!tagsByType[tag.tagType]) {
          tagsByType[tag.tagType] = [];
        }
        tagsByType[tag.tagType].push(tag.tagValue);
      }
      for (const [type, values] of Object.entries(tagsByType)) {
        console.log(`   - ${type}: ${values.join(", ")}`);
      }
    } else {
      console.log("❌ FAILURE: No tags were created (or they were already there and skipped)!");
    }
  } catch (error) {
    console.error("❌ ERROR calling tagMessage():", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
  }
}

testMessageTagging()
  .catch(console.error);
