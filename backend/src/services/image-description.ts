import * as fs from "node:fs";
import * as path from "node:path";
import { openai } from "../env";

/**
 * Generate a detailed description of an image using GPT-5 mini vision model
 * @param imageUrl - The URL of the image to analyze (relative path like /uploads/xxx)
 * @param backendBaseUrl - The base URL of the backend server (not used with base64)
 * @returns A detailed description of the image content
 */
export async function generateImageDescription(
  imageUrl: string,
  backendBaseUrl: string
): Promise<string> {
  try {
    console.log(`🖼️ [ImageDescription] Generating description for image: ${imageUrl}`);

    // Convert relative URL to file path
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filename = path.basename(imageUrl);
    const filePath = path.join(uploadsDir, filename);

    console.log(`📁 [ImageDescription] Reading image from: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found: ${filePath}`);
    }

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine MIME type from file extension
    const ext = path.extname(filename).toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".webp") mimeType = "image/webp";

    console.log(`🔢 [ImageDescription] Converted to base64 (${(base64Image.length / 1024).toFixed(2)} KB encoded, MIME: ${mimeType})`);

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 64000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Provide an extremely detailed description of this image. Include:
- All visible objects and their positions
- Colors, textures, and visual qualities
- Any text or writing visible in the image
- People (if any): their appearance, expressions, actions, clothing
- Setting and environment details
- Mood, atmosphere, and emotional tone
- Spatial relationships between elements
- Any notable artistic or compositional elements

Be comprehensive and precise. This description will be used by an AI assistant to understand the image content in conversation.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const description = response.choices[0]?.message?.content || "";

    if (!description) {
      console.error("❌ [ImageDescription] No description returned from OpenAI");
      throw new Error("No description returned from OpenAI");
    }

    console.log(`✅ [ImageDescription] Description generated successfully (${description.length} chars)`);
    return description;
  } catch (error) {
    console.error("💥 [ImageDescription] Error generating description:", error);
    throw error;
  }
}
