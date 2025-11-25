import * as fs from "fs/promises";
import * as path from "path";
import type { ResponseImageResult } from "./gpt-responses";

/**
 * Persist base64-encoded images returned from GPT Responses API into /uploads.
 * Returns the public URLs for any successfully saved images.
 */
export async function saveResponseImages(
  images: ResponseImageResult[] | undefined,
  prefix = "ai-response"
): Promise<string[]> {
  if (!images || images.length === 0) {
    return [];
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

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
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, buffer);
    saved.push(`/uploads/${fileName}`);
  }

  return saved;
}

