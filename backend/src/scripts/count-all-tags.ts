import { db } from "../db";

async function countAllTags() {
  const { count: totalTags } = await db
    .from("message_tag")
    .select("*", { count: 'exact', head: true });
    
  console.log(`📊 Total tags in entire database: ${totalTags}`);
  
  // Supabase/PostgREST doesn't support GROUP BY directly in the client API in the same way Prisma does.
  // We can use .rpc() if we had a stored procedure, or fetch all and aggregate (slow), 
  // or just skip the breakdown if it's expensive.
  // For now, we'll skip the detailed breakdown or try to do it if the count is small.
  
  // Let's just get counts for each type using separate queries as it's simpler than writing SQL/RPC for a script
  const types = ["topic", "sentiment", "person", "entity", "intent"];
  console.log('\n📈 Tags by type (approx):');
  
  for (const type of types) {
    const { count } = await db
      .from("message_tag")
      .select("*", { count: 'exact', head: true })
      .eq("tagType", type);
    console.log(`   - ${type}: ${count}`);
  }
  
  // Count messages with tags
  // We can't easily do "messages with tags" count efficiently without a join or distinct count
  // approximating by checking distinct messageIds in message_tag
  // But we can't do distinct count easily via API without fetching data.
  // We'll skip the "messages with tags" count to avoid fetching all rows.
  
  const { count: totalMessages } = await db
    .from("message")
    .select("*", { count: 'exact', head: true });
  
  console.log(`\n📨 Total messages: ${totalMessages}`);
}

countAllTags()
  .catch(console.error);
