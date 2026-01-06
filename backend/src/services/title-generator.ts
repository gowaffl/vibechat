/**
 * Title Generator Service
 * 
 * Generates concise, descriptive titles for personal chat conversations
 * based on the initial user message.
 */

import { openai } from "../env";

/**
 * Generate a fallback title from the first message
 * Extracts key words or truncates intelligently
 */
function generateFallbackTitle(message: string): string {
  // Clean the message
  const cleaned = message
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // If short enough, use as-is with title case
  if (cleaned.length <= 35) {
    return cleaned
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
  
  // Extract first few meaningful words
  const words = cleaned.split(" ").filter(w => w.length > 2);
  let title = "";
  for (const word of words) {
    const potential = title ? `${title} ${word}` : word;
    if (potential.length > 32) break;
    title = potential;
  }
  
  // Title case and add ellipsis if truncated
  const titleCased = title
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  
  return titleCased.length < cleaned.length ? `${titleCased}...` : titleCased;
}

/**
 * Generate a short, descriptive title for a conversation based on the first message
 * @param firstMessage - The first user message in the conversation
 * @returns A short title (max 40 characters) - always returns a title, never null
 */
export async function generateChatTitle(firstMessage: string): Promise<string | null> {
  console.log("[TitleGenerator] Starting title generation for message:", firstMessage.substring(0, 100));
  
  try {
    // Truncate long messages for efficiency
    const truncatedMessage = firstMessage.length > 500 
      ? firstMessage.substring(0, 500) + "..." 
      : firstMessage;

    console.log("[TitleGenerator] Calling gpt-4o-mini...");
    // Use gpt-4o-mini which is more reliable for simple tasks
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Generate a very short title (max 35 characters) for this conversation. Rules:
- Maximum 35 characters
- No quotes, no special characters, no prefixes like "Help with"
- Title case
- Be specific but concise

Output ONLY the title, nothing else.`,
        },
        {
          role: "user",
          content: truncatedMessage,
        },
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    const rawTitle = response.choices[0]?.message?.content?.trim();
    console.log("[TitleGenerator] Raw response from gpt-4o-mini:", rawTitle);
    
    // Clean the title - remove quotes and extra whitespace
    let title = rawTitle
      ?.replace(/^["']|["']$/g, "") // Remove surrounding quotes
      ?.replace(/\s+/g, " ")
      ?.trim();
    
    console.log("[TitleGenerator] Cleaned title:", title);
    
    // If still no title or too short, use fallback
    if (!title || title.length < 3) {
      console.log("[TitleGenerator] Title too short or empty, using fallback");
      return generateFallbackTitle(firstMessage);
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
    // Return fallback title instead of null
    return generateFallbackTitle(firstMessage);
  }
}

