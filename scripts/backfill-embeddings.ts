import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("Script starting...");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error("Missing required environment variables.");
  console.log("Supabase URL:", !!supabaseUrl);
  console.log("Supabase Key:", !!supabaseKey);
  console.log("OpenAI Key:", !!openaiApiKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function generateEmbedding(text: string) {
  const sanitizedText = text.replace(/\n/g, " ");
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: sanitizedText,
    encoding_format: "float",
  });
  return response.data[0].embedding;
}

async function backfill() {
  console.log("Starting embedding backfill...");
  
  let processed = 0;
  let hasMore = true;
  
  while (hasMore) {
    // Fetch batch of messages without embeddings
    const { data: messages, error } = await supabase
      .from("message")
      .select("id, content")
      .is("embedding", null)
      .neq("content", "")
      .in("messageType", ["text", "voice"])
      .limit(50);

    if (error) {
      console.error("Error fetching messages:", error);
      break;
    }

    if (!messages || messages.length === 0) {
      console.log("No more messages to process.");
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${messages.length} messages...`);

    for (const msg of messages) {
      try {
        if (!msg.content) continue;
        
        const embedding = await generateEmbedding(msg.content);
        
        const { error: updateError } = await supabase
          .from("message")
          .update({ embedding })
          .eq("id", msg.id);

        if (updateError) {
          console.error(`Failed to update message ${msg.id}:`, updateError);
        } else {
          processed++;
          process.stdout.write(".");
        }
      } catch (e) {
        console.error(`Error processing message ${msg.id}:`, e);
      }
    }
    console.log(`\nProcessed ${processed} total messages so far.`);
  }
  
  console.log(`Backfill complete. processed ${processed} messages.`);
}

backfill().catch(console.error);

