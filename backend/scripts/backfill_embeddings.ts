
import { db } from "../src/db";
import { generateEmbedding } from "../src/services/embeddings";

async function backfillEmbeddings() {
  console.log("Starting embedding backfill...");

  // 1. Count messages needing embeddings
  const { count, error: countError } = await db
    .from("message")
    .select("*", { count: "exact", head: true })
    .is("embedding", null);

  if (countError) {
    console.error("Error counting messages:", countError);
    return;
  }

  console.log(`Found ${count} messages without embeddings.`);

  if (count === 0) {
    console.log("No messages to backfill.");
    return;
  }

  const BATCH_SIZE = 50;
  let processed = 0;

  while (true) {
    // 2. Fetch batch
    const { data: messages, error: fetchError } = await db
      .from("message")
      .select("id, content")
      .is("embedding", null)
      .not("content", "is", null) // Only text messages usually have content
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching batch:", fetchError);
      break;
    }

    if (!messages || messages.length === 0) {
      break;
    }

    console.log(`Processing batch of ${messages.length} messages...`);

    // 3. Generate and Update
    for (const msg of messages) {
      if (!msg.content || msg.content.trim().length === 0) continue;

      try {
        const embedding = await generateEmbedding(msg.content);
        
        const { error: updateError } = await db
          .from("message")
          .update({ embedding } as any) // Type casting if needed
          .eq("id", msg.id);

        if (updateError) {
          console.error(`Failed to update message ${msg.id}:`, updateError);
        } else {
          // console.log(`Updated message ${msg.id}`);
        }
      } catch (err) {
        console.error(`Failed to generate embedding for message ${msg.id}:`, err);
      }
    }

    processed += messages.length;
    console.log(`Progress: ${processed}/${count}`);
  }

  console.log("Backfill complete!");
}

backfillEmbeddings().catch(console.error);


