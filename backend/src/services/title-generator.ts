/**
 * Title Generator Service
 * 
 * Generates concise, descriptive titles for personal chat conversations
 * based on the initial user message.
 */

import { openai } from "../env";

/**
 * Generate a short, descriptive title for a conversation based on the first message
 * @param firstMessage - The first user message in the conversation
 * @returns A short title (max 40 characters) or null on error
 */
export async function generateChatTitle(firstMessage: string): Promise<string | null> {
  console.log("[TitleGenerator] Starting title generation for message:", firstMessage.substring(0, 100));
  
  try {
    // Truncate long messages for efficiency
    const truncatedMessage = firstMessage.length > 500 
      ? firstMessage.substring(0, 500) + "..." 
      : firstMessage;

    console.log("[TitleGenerator] Calling gpt-5-nano...");
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: `You are a title generator. Given a user's message, generate a very short, descriptive title that captures the main topic or intent.

Rules:
- Maximum 40 characters
- No quotes or special characters
- Be specific but concise
- Use title case
- Do not include "Help with" or similar prefixes

Examples:
- "What's the weather like?" → "Weather Inquiry"
- "Can you help me write a poem about love?" → "Love Poem Writing"
- "Explain quantum computing" → "Quantum Computing Basics"
- "I need advice about my relationship" → "Relationship Advice"
- "Write code to sort an array" → "Array Sorting Code"`,
        },
        {
          role: "user",
          content: truncatedMessage,
        },
      ],
      max_completion_tokens: 500, // gpt-5-nano uses significant tokens for reasoning
      // Note: gpt-5-nano only supports default temperature (1)
    });

    const title = response.choices[0]?.message?.content?.trim();
    console.log("[TitleGenerator] Received title from gpt-5-nano:", title);
    
    if (!title) {
      console.log("[TitleGenerator] No title generated, returning null");
      return null;
    }

    // Ensure title doesn't exceed 40 characters
    if (title.length > 40) {
      const truncated = title.substring(0, 37) + "...";
      console.log("[TitleGenerator] Truncated title to:", truncated);
      return truncated;
    }

    console.log("[TitleGenerator] Returning title:", title);
    return title;
  } catch (error) {
    console.error("[TitleGenerator] Error generating title:", error);
    return null;
  }
}

