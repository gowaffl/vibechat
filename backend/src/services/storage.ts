import { db } from "../db";

// Signed URL expiration times (in seconds)
const SIGNED_URL_EXPIRATION = {
  SHORT: 60 * 60,           // 1 hour - for temporary access
  MEDIUM: 60 * 60 * 24,     // 24 hours - for message media
  LONG: 60 * 60 * 24 * 7,   // 7 days - for profile images
};

/**
 * Upload a file to Supabase Storage
 * @param path The file path within the bucket
 * @param file The file content (Buffer, ArrayBuffer, or Blob)
 * @param contentType The MIME type of the file
 * @param bucket The storage bucket name (default: 'uploads')
 * @returns The signed URL of the uploaded file (valid for 24 hours)
 */
export async function uploadFileToStorage(
  path: string,
  file: Buffer | ArrayBuffer | Blob,
  contentType: string,
  bucket: string = "uploads"
): Promise<string> {
  
  // Using the admin client (db) allows bypassing RLS for server-side uploads
  // This is important for AI-generated content or system uploads
  const { error } = await db.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("[Storage] Upload error:", error);
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }

  // Generate a signed URL instead of public URL for security
  // The signed URL expires after 24 hours - clients should refresh as needed
  const { data: signedData, error: signedError } = await db.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRATION.MEDIUM);

  if (signedError || !signedData?.signedUrl) {
    console.error("[Storage] Signed URL generation error:", signedError);
    throw new Error(`Failed to generate signed URL: ${signedError?.message || 'Unknown error'}`);
  }

  return signedData.signedUrl;
}

/**
 * Generate a signed URL for an existing file
 * @param path The file path within the bucket
 * @param bucket The storage bucket name (default: 'uploads')
 * @param expiresIn Expiration time in seconds (default: 24 hours)
 * @returns The signed URL
 */
export async function getSignedUrl(
  path: string,
  bucket: string = "uploads",
  expiresIn: number = SIGNED_URL_EXPIRATION.MEDIUM
): Promise<string> {
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("[Storage] Signed URL generation error:", error);
    throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

/**
 * Generate signed URLs for multiple files at once
 * @param paths Array of file paths within the bucket
 * @param bucket The storage bucket name (default: 'uploads')
 * @param expiresIn Expiration time in seconds (default: 24 hours)
 * @returns Array of objects with path and signedUrl
 */
export async function getSignedUrls(
  paths: string[],
  bucket: string = "uploads",
  expiresIn: number = SIGNED_URL_EXPIRATION.MEDIUM
): Promise<{ path: string; signedUrl: string }[]> {
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);

  if (error || !data) {
    console.error("[Storage] Bulk signed URL generation error:", error);
    throw new Error(`Failed to generate signed URLs: ${error?.message || 'Unknown error'}`);
  }

  return data.map((item) => ({
    path: item.path || '',
    signedUrl: item.signedUrl || '',
  }));
}

/**
 * Extract the file path from a Supabase storage URL
 * Works with both public URLs and signed URLs
 * @param url The Supabase storage URL
 * @returns The file path within the bucket, or null if not a valid storage URL
 */
export function extractPathFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    
    // Handle signed URLs: /storage/v1/object/sign/uploads/filename.jpg
    const signedMatch = urlObj.pathname.match(/\/storage\/v1\/object\/sign\/uploads\/(.+)/);
    if (signedMatch) {
      return signedMatch[1].split('?')[0]; // Remove query params
    }
    
    // Handle public URLs: /storage/v1/object/public/uploads/filename.jpg
    const publicMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/uploads\/(.+)/);
    if (publicMatch) {
      return publicMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Refresh a signed URL if it's a Supabase storage URL
 * @param url The URL to refresh
 * @param bucket The storage bucket name (default: 'uploads')
 * @returns A new signed URL, or the original URL if not a storage URL
 */
export async function refreshSignedUrl(
  url: string,
  bucket: string = "uploads"
): Promise<string> {
  const path = extractPathFromUrl(url);
  
  if (!path) {
    // Not a Supabase storage URL, return as-is
    return url;
  }
  
  return getSignedUrl(path, bucket);
}











