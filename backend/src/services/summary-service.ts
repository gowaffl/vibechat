import { openai } from "../env";

/**
 * Generate a summary of a Vibe Call using gpt-5-nano (GPT-4o)
 * 
 * @param transcription - The full transcription of the call
 * @param participantNames - Comma-separated list of participant names
 * @returns A clean, structured summary of the call
 */
export async function generateVibeCallSummary(
  transcription: string,
  participantNames: string
): Promise<string> {
  try {
    console.log(`[SummaryService] Generating summary for call with: ${participantNames}`);
    
    // Truncate very long transcriptions to avoid token limits
    const maxTranscriptionLength = 15000; // ~4k tokens
    const truncatedTranscription = transcription.length > maxTranscriptionLength
      ? transcription.slice(0, maxTranscriptionLength) + "\n\n[... transcription truncated for length ...]"
      : transcription;
    
    const systemPrompt = `You are an AI assistant that creates concise, helpful summaries of voice calls.
Your summaries should:
- Be clear and easy to scan
- Highlight key topics discussed
- Note any decisions made or action items mentioned
- Keep a friendly, conversational tone
- Be 2-4 paragraphs max

Do NOT include:
- Verbatim quotes unless very important
- Filler words or casual banter
- Technical details about the call itself

Format the summary as plain text with line breaks between sections. Do not use markdown headers.`;

    const userPrompt = `Please summarize this Vibe Call transcription.

Participants: ${participantNames}

Transcription:
${truncatedTranscription}`;

    // Note: gpt-5-nano only supports default temperature (1) and uses max_completion_tokens
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 500,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    
    if (!summary) {
      console.error("[SummaryService] No summary generated");
      return "Unable to generate summary for this call.";
    }
    
    console.log(`[SummaryService] Summary generated successfully`);
    return summary;
    
  } catch (error) {
    console.error("[SummaryService] Error generating summary:", error);
    return "Unable to generate summary for this call.";
  }
}

/**
 * Generate a short one-line summary for notifications
 */
export async function generateVibeCallOneLiner(
  transcription: string
): Promise<string> {
  try {
    // Note: gpt-5-nano only supports default temperature (1) and uses max_completion_tokens
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { 
          role: "system", 
          content: "Generate a single sentence (max 100 characters) summarizing what this call was about. Be specific but brief." 
        },
        { 
          role: "user", 
          content: `Summarize in one line: ${transcription.slice(0, 2000)}` 
        },
      ],
      max_completion_tokens: 100,
    });

    return response.choices[0]?.message?.content?.trim() || "Vibe Call ended";
  } catch (error) {
    console.error("[SummaryService] Error generating one-liner:", error);
    return "Vibe Call ended";
  }
}

