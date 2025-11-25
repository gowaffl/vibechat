import { db } from "../db";

async function checkTagsStatus() {
  console.log("🔍 Checking message tags in Waffl Kings chat...\n");

  // Find the Waffl Kings chat
  const { data: chats } = await db
    .from("chat")
    .select("*")
    .ilike("name", "%Waffl%")
    .limit(1);

  const chat = chats?.[0];

  if (!chat) {
    console.log("❌ Waffl Kings chat not found");
    return;
  }

  console.log(`✅ Found chat: "${chat.name}" (ID: ${chat.id})\n`);

  // Get all messages with their tags
  const { data: messages, error } = await db
    .from("message")
    .select(`
      id,
      content,
      createdAt,
      user:userId (name),
      tags:message_tag (
        id,
        tagType,
        tagValue,
        confidence
      )
    `)
    .eq("chatId", chat.id)
    .order("createdAt", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching messages:", error);
    return;
  }

  console.log(`📊 Found ${messages.length} messages (showing last 20)\n`);
  console.log("=" .repeat(100));

  let totalWithTags = 0;
  let totalWithoutTags = 0;

  for (const message of messages) {
    const preview = message.content.substring(0, 70);
    // @ts-ignore - Accessing joined user data
    const authorName = message.user?.name || "Unknown";
    const timeAgo = new Date(message.createdAt).toLocaleString();
    
    console.log(`\n📨 [${timeAgo}] ${authorName}: "${preview}${message.content.length > 70 ? "..." : ""}"`);
    console.log(`   ID: ${message.id}`);
    
    // @ts-ignore - Accessing joined tags
    if (!message.tags || message.tags.length === 0) {
      console.log(`   🏷️  Tags: ❌ NO TAGS`);
      totalWithoutTags++;
    } else {
      // @ts-ignore
      console.log(`   🏷️  Tags (${message.tags.length}):`);
      
      // Group tags by type
      const tagsByType: Record<string, string[]> = {};
      // @ts-ignore
      for (const tag of message.tags) {
        if (!tagsByType[tag.tagType]) {
          tagsByType[tag.tagType] = [];
        }
        tagsByType[tag.tagType].push(tag.tagValue);
      }
      
      // Display grouped tags
      for (const [type, values] of Object.entries(tagsByType)) {
        const displayValues = values.slice(0, 5).join(", ");
        const moreCount = values.length > 5 ? ` (+${values.length - 5} more)` : "";
        console.log(`      - ${type}: ${displayValues}${moreCount}`);
      }
      totalWithTags++;
    }
    console.log("-".repeat(100));
  }

  // Summary
  console.log("\n" + "=".repeat(100));
  console.log("📈 SUMMARY\n");
  console.log(`✅ Messages with tags: ${totalWithTags}`);
  console.log(`❌ Messages without tags: ${totalWithoutTags}`);
  
  // Get unique tag values for food-related topics
  // We need to fetch tags for messages in this chat. 
  // Supabase doesn't support deep nested filtering easily in one query for this specific aggregation,
  // but we can fetch tags where messageId is in the list of messages we just fetched, or fetch all tags for the chat
  // Let's just fetch all tags for messages in this chat via a join
  
  const { data: allTags } = await db
    .from("message_tag")
    .select("tagType, tagValue, message!inner(chatId)")
    .eq("message.chatId", chat.id);

  const topicTags = new Set<string>();
  const peopleTags = new Set<string>();
  const entityTags = new Set<string>();
  
  if (allTags) {
    for (const tag of allTags) {
      if (tag.tagType === "topic") topicTags.add(tag.tagValue);
      if (tag.tagType === "person") peopleTags.add(tag.tagValue);
      if (tag.tagType === "entity") entityTags.add(tag.tagValue);
    }
  }

  console.log(`\n📊 Total unique tags across all messages in chat:`);
  console.log(`   - Topics: ${topicTags.size}`);
  console.log(`   - People: ${peopleTags.size}`);
  console.log(`   - Entities: ${entityTags.size}`);

  if (topicTags.size > 0) {
    const topicArray = Array.from(topicTags).sort();
    console.log(`\n🏷️  All unique TOPIC tags:`);
    console.log(`   ${topicArray.join(", ")}`);
  }

  if (peopleTags.size > 0) {
    console.log(`\n👤 All unique PEOPLE tags:`);
    console.log(`   ${Array.from(peopleTags).sort().join(", ")}`);
  }

  // Check for food-related tags specifically
  const foodRelatedTopics = Array.from(topicTags).filter(t => 
    t.toLowerCase().includes("food") || 
    t.toLowerCase().includes("waffle") || 
    t.toLowerCase().includes("breakfast") ||
    t.toLowerCase().includes("cooking")
  );

  if (foodRelatedTopics.length > 0) {
    console.log(`\n🍽️  Food-related topic tags found (${foodRelatedTopics.length}):`);
    console.log(`   ${foodRelatedTopics.join(", ")}`);
  } else {
    console.log(`\n⚠️  WARNING: No food-related topic tags found! This could be why smart threads aren't working.`);
  }

  console.log("\n" + "=".repeat(100));
}

checkTagsStatus()
  .catch(console.error);
