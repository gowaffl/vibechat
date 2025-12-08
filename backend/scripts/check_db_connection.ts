import { env } from "../src/env";
import { db } from "../src/db";

async function main() {
  console.log("--- DB Connection Check ---");
  // Note: Only log safe values, never credentials or keys
  console.log("Supabase URL configured:", !!env.SUPABASE_URL);
  console.log("Service Role Key configured:", !!env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log("Querying 'chat' table count...");
  const { count, error } = await db.from("chat").select("*", { count: "exact", head: true });
  
  if (error) {
    console.error("Error querying chat table:", error);
  } else {
    console.log("Chat count:", count);
  }

  console.log("Querying 'chat_member' table count...");
  const { count: memberCount, error: memberError } = await db.from("chat_member").select("*", { count: "exact", head: true });
  
  if (memberError) {
    console.error("Error querying chat_member table:", memberError);
  } else {
    console.log("Chat Member count:", memberCount);
  }
}

main();







