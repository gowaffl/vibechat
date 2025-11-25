import { db } from "../db";
import { openai } from "../env";

interface TaggingResult {
  topics: string[];
  entities: string[];
  people: string[];
  sentiment?: "positive" | "negative" | "neutral";
  keywords?: string[]; // Verbatim keywords
  themes?: string[];   // Broad concepts/hypernyms
}

/**
 * Use AI to automatically tag messages with topics, entities, and sentiment
 * for smart thread filtering
 */
export async function tagMessage(messageId: string, content: string): Promise<void> {
  try {
    // Skip empty messages or very short messages (minimum 3 characters for things like "yes", "no", etc.)
    if (!content || content.trim().length < 3) {
      console.log("[Message Tagger] Skipping tagging for empty/very short message:", messageId);
      return;
    }

    // Skip system messages (event creation, etc.)
    if (content.includes("created a new event:") || 
        content.includes("finalized event:") ||
        content.includes("cancelled event:")) {
      console.log("[Message Tagger] Skipping system message:", messageId);
      return;
    }

    console.log("[Message Tagger] Tagging message:", messageId, "Content length:", content.length);

    // Check for @thread mentions and create guaranteed thread tags
    const threadMentionRegex = /@(\w+)/g;
    const threadMentions = Array.from(content.matchAll(threadMentionRegex))
      .map(match => match[1])
      .filter((m): m is string => m !== undefined)
      .map(m => m.toLowerCase());
    
    if (threadMentions.length > 0) {
      console.log("[Message Tagger] Found thread mentions:", threadMentions);
      
      // Get the message to find its chatId
      const { data: message } = await db
        .from("message")
        .select("chatId")
        .eq("id", messageId)
        .single();

      if (message) {
        // Find threads in this chat that match the @mentions
        const { data: threads } = await db
          .from("thread")
          .select("id, name")
          .eq("chatId", message.chatId);

        if (!threads) return;

        // Create guaranteed thread tags for matching thread names
        const guaranteedTags: Array<{
          messageId: string;
          tagType: string;
          tagValue: string;
          confidence: number;
        }> = [];

        for (const thread of threads) {
          const threadNameLower = thread.name.toLowerCase();
          if (threadMentions.includes(threadNameLower)) {
            guaranteedTags.push({
              messageId,
              tagType: "thread",
              tagValue: thread.name,
              confidence: 1.0, // Guaranteed match
            });
          }
        }

        if (guaranteedTags.length > 0) {
          // Create tags one by one to avoid duplicates
          for (const tag of guaranteedTags) {
            const { error } = await db
              .from("message_tag")
              .insert({
                messageId: tag.messageId,
                tagType: tag.tagType,
                tagValue: tag.tagValue,
                confidence: tag.confidence
              });
              
            if (error) {
              // Ignore duplicate errors
              console.log(`[Message Tagger] Skipping duplicate thread tag for message ${messageId}`);
            }
          }
          console.log(`[Message Tagger] ✅ Created ${guaranteedTags.length} guaranteed thread tags for message ${messageId}`);
        }
      }
    }

    // Use GPT-5-nano to extract topics, entities, people, and sentiment
    // Note: GPT-5-nano is a reasoning model - don't use response_format as it needs tokens for reasoning
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 10000, // High limit: GPT-5-nano uses significant tokens for reasoning before output
      messages: [
        {
          role: "system",
          content: `You are a semantic tagging assistant. Analyze messages and extract structured tags for filtering purposes. Always respond with valid JSON in this exact format:
{
  "topics": ["Topic1", "Topic2"],
  "people": ["Person1", "Person2"],
  "entities": ["Entity1", "Entity2"],
  "sentiment": "neutral",
  "keywords": ["Keyword1", "Keyword2"],
  "themes": ["BroadCategory1", "BroadCategory2"]
}

Be EXTREMELY generous with tagging - it's better to over-tag than under-tag.`,
        },
        {
          role: "user",
          content: `Analyze this message and extract semantic tags:

1. **Topics**: Main themes and related concepts
   - Use 1-3 word phrases, capitalize first letter of each word
   - Include both specific AND broad related topics
   - Examples:
     * "Christianity" → also tag "Baptism", "Church", "Faith", "Religion"
     * "Technology" → also tag "Programming", "AI", "Software", "Computing"
     * "Food" → include specific foods like "Pizza", "Waffles", "Burger", cuisine types, restaurants, cooking
     * "Sports" → include specific sports, teams, players
   - Be VERY generous - include ALL semantically related concepts

2. **People**: Any person names mentioned
   - First names, last names, nicknames, usernames
   - Look for names like "Aj", "John", "Sarah", "Mike", "Zach", "Money Man"
   - Include @mentions if present
   - Even single-word names that could be people

3. **Entities**: Named entities (places, organizations, products, brands)
   - Proper nouns that are NOT people
   - Restaurants, companies, products, locations, brands

4. **Sentiment**: Overall emotional tone (positive, negative, or neutral)

5. **Keywords**: Specific important words from the message (verbatim or lemmatized)
   - Key terms that someone might search for
   - Exclude common stop words

6. **Themes**: Broad categories, hypernyms, and classifications
   - High-level concepts the message belongs to
   - Think hierarchically: City -> State -> Country -> Region -> Continent
   - Think associatively: "Coding" -> "Software", "Engineering", "Tech", "Stem", "Work"
   - Example: "Tennessee" -> "Place", "US State", "Location", "South", "USA"
   - Example: "Apple" -> "Technology Company", "Brand", "Big Tech", "Consumer Electronics", "Stocks"
   - Example: "Waffles" -> "Breakfast", "Food", "Dessert", "Cooking", "Meal"
   - This is CRITICAL for broad filtering like "Places" or "Food"

Message: "${content}"

Respond with ONLY the JSON object, no other text.`,
        },
      ],
    });

    // Parse AI response
    const textContent = response.choices[0]?.message?.content;
    if (!textContent) {
      console.error("[Message Tagger] No content in response for message", messageId);
      // Create fallback sentiment tag
      await db.from("message_tag").insert({
        messageId,
        tagType: "sentiment",
        tagValue: "neutral",
        confidence: 0.5,
      });
      console.log("[Message Tagger] Created fallback sentiment tag for message", messageId);
      return;
    }

    let result: TaggingResult;
    try {
      result = JSON.parse(textContent);
      console.log("[Message Tagger] Tagging result for message", messageId, ":", result);
    } catch (parseError) {
      console.error("[Message Tagger] Failed to parse JSON for message", messageId, ":", textContent);
      // Create fallback sentiment tag
      await db.from("message_tag").insert({
        messageId,
        tagType: "sentiment",
        tagValue: "neutral",
        confidence: 0.5,
      });
      console.log("[Message Tagger] Created fallback sentiment tag for message", messageId);
      return;
    }

    // Create tags in database
    const tagsToCreate: Array<{
      messageId: string;
      tagType: string;
      tagValue: string;
      confidence: number;
    }> = [];

    // Add topic tags
    for (const topic of result.topics || []) {
      if (topic && topic.trim()) {
        tagsToCreate.push({
          messageId,
          tagType: "topic",
          tagValue: topic.trim(),
          confidence: 0.9,
        });
      }
    }

    // Add people tags (person names)
    for (const person of result.people || []) {
      if (person && person.trim()) {
        tagsToCreate.push({
          messageId,
          tagType: "person",
          tagValue: person.trim(),
          confidence: 0.85,
        });
      }
    }

    // Add entity tags
    for (const entity of result.entities || []) {
      if (entity && entity.trim()) {
        tagsToCreate.push({
          messageId,
          tagType: "entity",
          tagValue: entity.trim(),
          confidence: 0.85,
        });
      }
    }

    // Add sentiment tag
    if (result.sentiment) {
      tagsToCreate.push({
        messageId,
        tagType: "sentiment",
        tagValue: result.sentiment,
        confidence: 0.8,
      });
    }

    // Add keyword tags
    for (const keyword of result.keywords || []) {
      if (keyword && keyword.trim()) {
        tagsToCreate.push({
          messageId,
          tagType: "keyword",
          tagValue: keyword.trim(),
          confidence: 0.8,
        });
      }
    }

    // Add theme tags
    for (const theme of result.themes || []) {
      if (theme && theme.trim()) {
        tagsToCreate.push({
          messageId,
          tagType: "theme", // We treat themes as broad topics
          tagValue: theme.trim(),
          confidence: 0.85,
        });
        // Also add as a topic so it appears in topic filters easily
        tagsToCreate.push({
          messageId,
          tagType: "topic",
          tagValue: theme.trim(),
          confidence: 0.85,
        });
      }
    }

    // Batch create all tags
    if (tagsToCreate.length > 0) {
      await db.from("message_tag").insert(tagsToCreate);
      console.log(`[Message Tagger] ✅ Created ${tagsToCreate.length} tags for message ${messageId}`);
    } else {
      console.warn("[Message Tagger] ⚠️  No tags extracted for message:", messageId, "Content:", content.substring(0, 100));
      // Create at least a neutral sentiment tag so we know it was processed
      await db.from("message_tag").insert({
        messageId,
        tagType: "sentiment",
        tagValue: "neutral",
        confidence: 0.5,
      });
      console.log(`[Message Tagger] Created fallback neutral sentiment tag for message ${messageId}`);
    }
  } catch (error) {
    console.error("[Message Tagger] ❌ Error tagging message", messageId, ":", error);
    // Don't throw - tagging failures shouldn't break message sending
  }
}

/**
 * Batch tag multiple messages (useful for backfilling existing messages)
 */
export async function tagMultipleMessages(messages: Array<{ id: string; content: string }>): Promise<void> {
  console.log(`[Message Tagger] Batch tagging ${messages.length} messages`);

  for (const message of messages) {
    await tagMessage(message.id, message.content);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log("[Message Tagger] Batch tagging complete");
}
