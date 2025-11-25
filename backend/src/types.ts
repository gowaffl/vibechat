import type { User, Session } from "@supabase/supabase-js";

// ============================================
// AppType - Shared Hono context type
// ============================================
// This type defines the context variables available in all routes
// - user: The authenticated user object (null if not logged in)
// - session: The session object (null if no active session)
//
// Usage in routes:
//   const user = c.get("user");
//   const session = c.get("session");
//
// All routers should use this type: new Hono<AppType>()
export type AppType = {
  Variables: {
    user: User | null;
    session: Session | null;
  };
};
