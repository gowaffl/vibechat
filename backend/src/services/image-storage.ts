import type { ResponseImageResult } from "./gpt-responses";
import { uploadFileToStorage } from "./storage";

/**
 * Persist base64-encoded images returned from GPT Responses API into Supabase Storage.
 * Returns the public URLs for any successfully saved images.
 */
export async function saveResponseImages(
  images: ResponseImageResult[] | undefined,
  prefix = "ai-response"
): Promise<string[]> {
  if (!images || images.length === 0) {
    return [];
  }

  const saved: string[] = [];
  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    if (!image?.base64) {
      continue;
    }

    const payload = image.base64.includes(",")
      ? image.base64.split(",").pop()!
      : image.base64;
    const buffer = Buffer.from(payload, "base64");
    const fileName = `${prefix}-${Date.now()}-${index}.png`;

    try {
      const publicUrl = await uploadFileToStorage(fileName, buffer, "image/png");
      saved.push(publicUrl);
    } catch (error) {
      console.error(`[Image Storage] Failed to upload image ${fileName}:`, error);
    }
  }

  return saved;
}
