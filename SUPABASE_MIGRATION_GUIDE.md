# Supabase Migration Guide

## ✅ Completed Steps

1. **Schema Migration** - All tables, indexes, RLS policies, and triggers have been applied to Supabase
2. **Supabase Client Setup** - Created `@supabase/supabase-js` client in `backend/src/db.ts`
3. **Environment Configuration** - Updated `backend/src/env.ts` to include Supabase variables
4. **Users Route** - Fully migrated to Supabase queries
5. **Helper Utilities** - Created `backend/src/utils/supabase-helpers.ts` for common patterns

## 📋 Required Environment Variables

Add these to `/home/user/workspace/backend/.env`:

```bash
SUPABASE_URL=https://xxekfvxdzixesjrbxoju.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZWtmdnhkeml4ZXNqcmJ4b2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTg0MDAsImV4cCI6MjA3OTUzNDQwMH0.XRDV0omjpEd0e6zwYZ05w4B8hK5gJ_pbOchk8e8OFoQ
SUPABASE_SERVICE_ROLE_KEY=<GET_FROM_SUPABASE_DASHBOARD>
```

**Important:** Get your `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard → Settings → API

## 🔄 Prisma to Supabase Query Patterns

### Basic CRUD Operations

#### Prisma → Supabase Conversion

```typescript
// ❌ PRISMA - Find One
const user = await db.user.findUnique({ where: { id } });

// ✅ SUPABASE
const { data: user, error } = await db
  .from("user")
  .select("*")
  .eq("id", id)
  .single();

// ❌ PRISMA - Find Many
const users = await db.user.findMany({
  where: { hasCompletedOnboarding: true },
  orderBy: { name: "asc" },
});

// ✅ SUPABASE
const { data: users, error } = await db
  .from("user")
  .select("*")
  .eq("hasCompletedOnboarding", true)
  .order("name", { ascending: true });

// ❌ PRISMA - Create
const user = await db.user.create({
  data: { id, name, image },
});

// ✅ SUPABASE
const { data: user, error } = await db
  .from("user")
  .insert({ id, name, image })
  .select()
  .single();

// ❌ PRISMA - Update
const user = await db.user.update({
  where: { id },
  data: { name, bio },
});

// ✅ SUPABASE
const { data: user, error } = await db
  .from("user")
  .update({ name, bio })
  .eq("id", id)
  .select()
  .single();

// ❌ PRISMA - Delete
await db.user.delete({ where: { id } });

// ✅ SUPABASE
const { error } = await db
  .from("user")
  .delete()
  .eq("id", id);
```

### Complex Queries with Relations

```typescript
// ❌ PRISMA - With Include
const message = await db.message.findUnique({
  where: { id },
  include: {
    user: true,
    replyTo: {
      include: {
        user: true,
      },
    },
    reactions: true,
  },
});

// ✅ SUPABASE - Manual Fetching (Option 1)
const { data: message } = await db
  .from("message")
  .select("*")
  .eq("id", id)
  .single();

// Fetch related user
const { data: user } = await db
  .from("user")
  .select("*")
  .eq("id", message.userId)
  .single();

message.user = user;

// Fetch replyTo with user
if (message.replyToId) {
  const { data: replyTo } = await db
    .from("message")
    .select("*")
    .eq("id", message.replyToId)
    .single();

  const { data: replyToUser } = await db
    .from("user")
    .select("*")
    .eq("id", replyTo.userId)
    .single();

  replyTo.user = replyToUser;
  message.replyTo = replyTo;
}

// Fetch reactions
const { data: reactions } = await db
  .from("reaction")
  .select("*")
  .eq("messageId", id);

message.reactions = reactions;

// ✅ SUPABASE - Using PostgREST Foreign Tables (Option 2 - Better)
const { data: message } = await db
  .from("message")
  .select(`
    *,
    user:userId(*),
    replyTo:replyToId(
      *,
      user:userId(*)
    ),
    reactions(*)
  `)
  .eq("id", id)
  .single();
```

### Aggregations and Counts

```typescript
// ❌ PRISMA - Count
const count = await db.message.count({
  where: { chatId },
});

// ✅ SUPABASE
const { count, error } = await db
  .from("message")
  .select("*", { count: "exact", head: true })
  .eq("chatId", chatId);

// ❌ PRISMA - With _count
const chat = await db.chat.findUnique({
  where: { id },
  include: {
    _count: {
      select: { members: true },
    },
  },
});

// ✅ SUPABASE
const { data: chat } = await db
  .from("chat")
  .select("*")
  .eq("id", id)
  .single();

const { count: memberCount } = await db
  .from("chat_member")
  .select("*", { count: "exact", head: true })
  .eq("chatId", id);

chat.memberCount = memberCount;
```

### Create Many

```typescript
// ❌ PRISMA
await db.mention.createMany({
  data: mentionedUserIds.map(mentionedUserId => ({
    messageId,
    mentionedUserId,
    mentionedByUserId: userId,
  })),
  skipDuplicates: true,
});

// ✅ SUPABASE
const { error } = await db
  .from("mention")
  .insert(
    mentionedUserIds.map(mentionedUserId => ({
      messageId,
      mentionedUserId,
      mentionedByUserId: userId,
    }))
  );
// Note: skipDuplicates is handled by UNIQUE constraints in the schema
```

## 📝 Files Requiring Migration

### ✅ Completed
- `backend/src/routes/users.ts`
- `backend/src/db.ts`
- `backend/src/env.ts`

### 🔄 In Progress
- `backend/src/routes/messages.ts` - Large file, needs systematic migration

### ⏳ Pending Routes
1. `backend/src/routes/chats.ts` - Complex with many relations
2. `backend/src/routes/reactions.ts` - Simple CRUD
3. `backend/src/routes/events.ts` - Event management
4. `backend/src/routes/threads.ts` - Thread queries
5. `backend/src/routes/catchup.ts` - Summary queries
6. `backend/src/routes/reactor.ts` - Media reactions
7. `backend/src/routes/bookmarks.ts` - Simple CRUD
8. `backend/src/routes/invite.ts` - Token management
9. `backend/src/routes/custom-commands.ts` - Simple CRUD
10. `backend/src/routes/group-settings.ts` - Chat settings
11. `backend/src/routes/ai.ts` - AI integration
12. `backend/src/routes/ai-friends.ts` - AI friends management
13. `backend/src/routes/link-preview.ts` - Link previews
14. `backend/src/routes/upload.ts` - File uploads
15. `backend/src/routes/notifications.ts` - Push notifications

### ⏳ Pending Services
1. `backend/src/services/message-tagger.ts`
2. `backend/src/services/avatar-cron.ts`
3. `backend/src/services/ai-engagement.ts`
4. `backend/src/scripts/*` - All scripts using Prisma

### ⏳ Better Auth Integration
The current Better Auth setup uses Prisma adapter. You have two options:

**Option 1: Use Supabase Auth (Recommended)**
- Supabase has built-in authentication
- Migrate to `@supabase/auth-helpers` or `@supabase/ssr`
- This is the cleanest approach for a Supabase-only setup

**Option 2: Keep Better Auth with Custom Adapter**
- Create auth tables in Supabase manually
- Use Better Auth with a custom adapter pointing to Supabase
- More complex but keeps existing auth flow

## 🚀 Migration Strategy

### Step 1: Complete Route Migrations
Migrate each route file following the patterns above. Priority order:
1. Simple CRUD routes (reactions, bookmarks, custom-commands)
2. Medium complexity (events, threads, ai-friends)
3. Complex routes (messages, chats, catchup)

### Step 2: Migrate Services
Update all service files that use database queries:
- message-tagger.ts
- avatar-cron.ts
- ai-engagement.ts
- push-notifications.ts

### Step 3: Update Scripts
Migrate all script files in `backend/src/scripts/`

### Step 4: Auth Migration
Decide on auth strategy and implement

### Step 5: Testing
- Test each route endpoint
- Verify all CRUD operations
- Check complex queries with relations
- Test RLS policies
- Verify data integrity

## 🔍 Common Issues & Solutions

### Issue: Date Handling
Supabase returns dates as strings, not Date objects

```typescript
// Solution: Use helper function
const formatTimestamp = (ts: string | Date) => 
  typeof ts === 'string' ? ts : new Date(ts).toISOString();
```

### Issue: Null vs Undefined
Supabase returns `null` for empty fields, Prisma uses `null` or `undefined`

```typescript
// Solution: Normalize in your formatter functions
const formatUser = (user: any) => ({
  ...user,
  bio: user.bio ?? null,
  image: user.image ?? null,
});
```

### Issue: Error Handling
Supabase returns errors differently than Prisma throws them

```typescript
// Solution: Always check error object
const { data, error } = await db.from("user").select("*");
if (error) {
  console.error("Database error:", error);
  return c.json({ error: "Database operation failed" }, 500);
}
```

### Issue: Relations
Prisma's `include` doesn't exist in Supabase

```typescript
// Solution: Use PostgREST's embedded resources
.select(`
  *,
  user:userId(*),
  chat:chatId(*)
`)
```

## 📊 Testing Checklist

After migration, test:
- [ ] User creation and updates
- [ ] Chat creation and management
- [ ] Message sending and editing
- [ ] Reactions
- [ ] Bookmarks
- [ ] Events and voting
- [ ] Threads
- [ ] AI features
- [ ] File uploads
- [ ] Push notifications
- [ ] Authentication flow

## 💡 Tips

1. **Use TypeScript**: The Supabase client is fully typed
2. **Batch Operations**: Use `insert` with arrays for bulk inserts
3. **RLS Policies**: Remember that service role bypasses RLS
4. **Transactions**: Supabase doesn't support transactions like Prisma - design around this
5. **Performance**: Add indexes for frequently queried fields
6. **Logging**: Log all errors for debugging during migration

## 📚 Resources

- [Supabase JS Client Docs](https://supabase.com/docs/reference/javascript)
- [PostgREST API Docs](https://postgrest.org/en/stable/api.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Better Auth Docs](https://better-auth.com/)

## 🎯 Next Steps

1. Add environment variables to `.env`
2. Restart your backend server to load new Supabase configuration
3. Start migrating routes one by one, testing each as you go
4. Use the helper functions in `utils/supabase-helpers.ts`
5. Follow the patterns established in `routes/users.ts`

Good luck with the migration! 🚀

