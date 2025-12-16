import { openai } from "../env";

/**
 * Generate a vector embedding for a given text using OpenAI's text-embedding-3-small model.
 * @param text - The text to embed
 * @returns An array of numbers representing the embedding (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Sanitize input
    const sanitizedText = text.replace(/\n/g, " ");

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: sanitizedText,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ [Embeddings] Error generating embedding:", error);
    throw error;
  }
}

