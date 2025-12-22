
import { db } from "../src/db";
import { decryptMessages } from "../src/services/message-encryption";

async function backfillSearchVector() {
  console.log("Starting search_vector backfill...");

  // 1. Count messages needing backfill
  const { count, error: countError } = await db
    .from("message")
    .select("*", { count: "exact", head: true })
    .is("search_vector", null)
    .neq("content", "") // Skip empty
    .not("content", "is", null);

  if (countError) {
    console.error("Error counting messages:", countError);
    return;
  }

  console.log(`Found ${count} messages needing search_vector backfill.`);

  if (count === 0) {
    console.log("No messages to backfill.");
    return;
  }

  const BATCH_SIZE = 50;
  let processed = 0;
  let successes = 0;
  let errors = 0;

  while (true) {
    // 2. Fetch batch
    const { data: messages, error: fetchError } = await db
      .from("message")
      .select("id, content, is_encrypted")
      .is("search_vector", null)
      .neq("content", "")
      .not("content", "is", null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching batch:", fetchError);
      break;
    }

    if (!messages || messages.length === 0) {
      break;
    }

    // 3. Decrypt messages
    const decryptedMessages = await decryptMessages(messages);

    // 4. Update each message
    for (const msg of decryptedMessages) {
      try {
        if (!msg.content) continue;

        // We use a raw SQL query to update using to_tsvector since supabase-js client
        // doesn't natively support setting tsvector easily from client-side string without raw SQL
        // or we can let the DB handle the conversion.
        
        // Easier approach: Update with RPC or just raw SQL update if possible.
        // Since we are in a script, we can use db.rpc if we had one, or just update the column.
        // Actually, we can just update the column with the string and let Postgres cast it if we formatted it, 
        // BUT `to_tsvector` is a function. 
        
        // Best approach for client-side update:
        // We can't easily call `to_tsvector` in a standard .update() call without a custom RPC or raw query.
        // Let's create a quick RPC for this specific update to be safe and efficient.
        
        const { error: updateError } = await db.rpc('update_message_search_vector', {
          message_id: msg.id,
          content_text: msg.content
        });

        if (updateError) {
           // Fallback: try raw query if RPC doesn't exist yet (we need to create it)
           console.error(`Failed to update message ${msg.id}:`, updateError);
           errors++;
        } else {
           successes++;
        }

      } catch (err) {
        console.error(`Error processing message ${msg.id}:`, err);
        errors++;
      }
    }

    processed += messages.length;
    console.log(`Progress: ${processed}/${count} (Success: ${successes}, Errors: ${errors})`);
  }

  console.log("Backfill complete!");
}

backfillSearchVector()
  .catch(console.error)
  .finally(() => process.exit());

