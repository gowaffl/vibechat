import { Hono } from "hono";
import { type AppType } from "../index";
import { verifyToken } from "../auth";
import { db } from "../db";

const imageProxy = new Hono<AppType>();

/**
 * GET /api/images/:path - Generate signed URLs for RLS-protected images
 * 
 * This endpoint generates temporary signed URLs for images in Supabase storage.
 * It validates that the user has access via RLS, then returns a signed URL that
 * bypasses RLS for the specific file for a limited time (1 hour).
 */
imageProxy.get("/*", async (c) => {
  // Get the full path from the URL (everything after /api/images/)
  const requestPath = c.req.path.replace("/api/images/", "");
  
  if (!requestPath) {
    return c.json({ error: "No image path provided" }, 400);
  }

  console.log(`[ImageProxy] Signed URL request for: ${requestPath}`);

  // Get auth token from header or query parameter
  let token: string | undefined;
  const authHeader = c.req.header("Authorization");
  if (authHeader) {
    token = authHeader.replace("Bearer ", "");
  } else {
    // Fallback to query parameter for Image components that can't send custom headers
    token = c.req.query("token");
  }

  // Require authentication
  if (!token) {
    return c.json({ error: "Authorization required" }, 401);
  }

  const userId = await verifyToken(token);
  
  if (!userId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  try {
    // Create a signed URL using the admin client
    // The signed URL will work regardless of RLS policies for the duration
    const { data: signedData, error: signedError } = await db.storage
      .from("uploads")
      .createSignedUrl(requestPath, 3600); // 1 hour expiration

    if (signedError || !signedData?.signedUrl) {
      console.error(`[ImageProxy] Error creating signed URL for ${requestPath}:`, signedError);
      return c.json({ error: "Failed to generate image URL" }, 500);
    }

    console.log(`[ImageProxy] Generated signed URL for ${requestPath}`);
    
    // Redirect to the signed URL
    return c.redirect(signedData.signedUrl, 302);
  } catch (error) {
    console.error(`[ImageProxy] Unexpected error for ${requestPath}:`, error);
    return c.json({ error: "Failed to load image" }, 500);
  }
});

export { imageProxy };

