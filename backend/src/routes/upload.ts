import { Hono } from "hono";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type AppType } from "../index";
import { zValidator } from "@hono/zod-validator";
import { uploadImageRequestSchema, type UploadImageResponse, type UploadVideoResponse } from "../../../shared/contracts";
import { uploadFileToStorage, getSignedUrl, getSignedUrls, extractPathFromUrl } from "../services/storage";
import { verifyToken } from "../auth";

const uploadRouter = new Hono<AppType>();

// Allowed MIME types for images and audio
const ALLOWED_IMAGE_AUDIO_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/aac",
  "audio/mp3",
  "audio/3gpp",
  "audio/amr",
  "audio/ogg",
];

// Allowed MIME types for videos
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov files
  "video/x-m4v", // .m4v files
  "video/3gpp",
  "video/webm",
];

// ============================================
// POST /api/upload/image - Upload an image
// ============================================
// Accepts multipart/form-data with "image" field
// Validates file type and size before saving
// Returns URL to access the uploaded image
uploadRouter.post("/image", zValidator("form", uploadImageRequestSchema), async (c) => {
  const { image } = c.req.valid("form");
  console.log("📤 [Upload] Image upload request received");

  try {
    // Check if file exists in request
    if (!image) {
      console.log("❌ [Upload] No image file provided in request");
      return c.json({ error: "No image file provided" }, 400);
    }
    console.log(
      `📄 [Upload] File received: ${image.name} (${image.type}, ${(image.size / 1024).toFixed(2)} KB)`,
    );

    // Validate file type - allow images, audio, and video/mp4 (iOS uses this for m4a)
    const allowedTypes = [...ALLOWED_IMAGE_AUDIO_TYPES, "video/mp4"];
    if (!allowedTypes.includes(image.type)) {
      console.log(`❌ [Upload] Invalid file type: ${image.type}`);
      return c.json(
        { error: `Invalid file type: ${image.type}. Only JPEG, PNG, GIF, WebP images and audio files are allowed` },
        400,
      );
    }
    console.log(`✅ [Upload] File type validated: ${image.type}`);

    // Validate file size (10MB limit for images/audio)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (image.size > maxSize) {
      console.log(
        `❌ [Upload] File too large: ${(image.size / 1024 / 1024).toFixed(2)} MB (max: 10 MB)`,
      );
      return c.json({ error: "File too large. Maximum size is 10MB" }, 400);
    }
    console.log(`✅ [Upload] File size validated: ${(image.size / 1024).toFixed(2)} KB`);

    // Generate unique filename to prevent collisions
    const fileExtension = path.extname(image.name);
    const uniqueFilename = `${randomUUID()}${fileExtension}`;
    console.log(`🔑 [Upload] Generated unique filename: ${uniqueFilename}`);

    // Save file to Supabase Storage
    console.log(`💾 [Upload] Uploading file to Supabase Storage...`);
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const imageUrl = await uploadFileToStorage(uniqueFilename, buffer, image.type);
    console.log(`✅ [Upload] File uploaded successfully`);
    
    console.log(`🎉 [Upload] Upload complete! Image URL: ${imageUrl}`);

    return c.json({
      success: true,
      message: "Image uploaded successfully",
      url: imageUrl,
      filename: uniqueFilename,
    } satisfies UploadImageResponse);
  } catch (error) {
    console.error("💥 [Upload] Upload error:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace available",
    );
    return c.json({ error: "Failed to upload image" }, 500);
  }
});

// ============================================
// POST /api/upload/video - Upload a video
// ============================================
// Accepts multipart/form-data with "video" field
// Validates file type and size (50MB limit for videos)
// Returns URL to access the uploaded video
const uploadVideoFormSchema = z.object({
  video: z.instanceof(File),
});

uploadRouter.post("/video", zValidator("form", uploadVideoFormSchema), async (c) => {
  const { video } = c.req.valid("form");
  console.log("🎬 [Upload] Video upload request received");

  try {
    // Check if file exists in request
    if (!video) {
      console.log("❌ [Upload] No video file provided in request");
      return c.json({ error: "No video file provided" }, 400);
    }
    console.log(
      `📄 [Upload] Video received: ${video.name} (${video.type}, ${(video.size / 1024 / 1024).toFixed(2)} MB)`,
    );

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(video.type)) {
      console.log(`❌ [Upload] Invalid video type: ${video.type}`);
      return c.json(
        { error: `Invalid file type: ${video.type}. Only MP4, MOV, M4V, 3GP, and WebM videos are allowed` },
        400,
      );
    }
    console.log(`✅ [Upload] Video type validated: ${video.type}`);

    // Validate file size (50MB limit for videos)
    const maxVideoSize = 50 * 1024 * 1024; // 50MB
    if (video.size > maxVideoSize) {
      console.log(
        `❌ [Upload] Video too large: ${(video.size / 1024 / 1024).toFixed(2)} MB (max: 50 MB)`,
      );
      return c.json({ error: "Video too large. Maximum size is 50MB" }, 400);
    }
    console.log(`✅ [Upload] Video size validated: ${(video.size / 1024 / 1024).toFixed(2)} MB`);

    // Generate unique filename to prevent collisions
    const fileExtension = path.extname(video.name) || ".mp4";
    const uniqueFilename = `videos/${randomUUID()}${fileExtension}`;
    console.log(`🔑 [Upload] Generated unique filename: ${uniqueFilename}`);

    // Save file to Supabase Storage
    console.log(`💾 [Upload] Uploading video to Supabase Storage...`);
    const arrayBuffer = await video.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const videoUrl = await uploadFileToStorage(uniqueFilename, buffer, video.type);
    console.log(`✅ [Upload] Video uploaded successfully`);
    
    console.log(`🎉 [Upload] Upload complete! Video URL: ${videoUrl}`);

    return c.json({
      success: true,
      message: "Video uploaded successfully",
      url: videoUrl,
      filename: uniqueFilename,
    } satisfies UploadVideoResponse);
  } catch (error) {
    console.error("💥 [Upload] Video upload error:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace available",
    );
    return c.json({ error: "Failed to upload video" }, 500);
  }
});

// ============================================
// POST /api/upload/signed-url - Get a signed URL for a file
// ============================================
// Requires authentication
// Accepts either a file path or a full URL (will extract path)
// Returns a signed URL valid for 24 hours
const signedUrlRequestSchema = z.object({
  path: z.string().optional(),
  url: z.string().optional(),
  expiresIn: z.number().optional().default(86400), // Default 24 hours
}).refine((data) => data.path || data.url, {
  message: "Either path or url must be provided",
});

uploadRouter.post("/signed-url", zValidator("json", signedUrlRequestSchema), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Authorization required" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const userId = await verifyToken(token);
  if (!userId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const { path: filePath, url, expiresIn } = c.req.valid("json");

  try {
    // Extract path from URL if provided
    let finalPath = filePath;
    if (!finalPath && url) {
      finalPath = extractPathFromUrl(url);
      if (!finalPath) {
        return c.json({ error: "Invalid storage URL provided" }, 400);
      }
    }

    if (!finalPath) {
      return c.json({ error: "No valid path could be determined" }, 400);
    }

    const signedUrl = await getSignedUrl(finalPath, "uploads", expiresIn);
    
    return c.json({
      success: true,
      signedUrl,
      expiresIn,
    });
  } catch (error) {
    console.error("💥 [Upload] Signed URL error:", error);
    return c.json({ error: "Failed to generate signed URL" }, 500);
  }
});

// ============================================
// POST /api/upload/signed-urls - Get signed URLs for multiple files
// ============================================
// Requires authentication
// Accepts an array of file paths or URLs
// Returns signed URLs valid for 24 hours
const bulkSignedUrlRequestSchema = z.object({
  items: z.array(z.object({
    path: z.string().optional(),
    url: z.string().optional(),
  })).min(1).max(50), // Limit to 50 items per request
  expiresIn: z.number().optional().default(86400),
});

uploadRouter.post("/signed-urls", zValidator("json", bulkSignedUrlRequestSchema), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Authorization required" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const userId = await verifyToken(token);
  if (!userId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const { items, expiresIn } = c.req.valid("json");

  try {
    // Extract paths from items
    const paths: string[] = [];
    for (const item of items) {
      let finalPath = item.path;
      if (!finalPath && item.url) {
        finalPath = extractPathFromUrl(item.url) || undefined;
      }
      if (finalPath) {
        paths.push(finalPath);
      }
    }

    if (paths.length === 0) {
      return c.json({ error: "No valid paths could be determined" }, 400);
    }

    const signedUrls = await getSignedUrls(paths, "uploads", expiresIn);
    
    return c.json({
      success: true,
      signedUrls,
      expiresIn,
    });
  } catch (error) {
    console.error("💥 [Upload] Bulk signed URL error:", error);
    return c.json({ error: "Failed to generate signed URLs" }, 500);
  }
});

export { uploadRouter };
