import { db } from "../db";

/**
 * Upload a file to Supabase Storage
 * @param path The file path within the bucket
 * @param file The file content (Buffer, ArrayBuffer, or Blob)
 * @param contentType The MIME type of the file
 * @param bucket The storage bucket name (default: 'uploads')
 * @returns The public URL of the uploaded file
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

  const { data } = db.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}









