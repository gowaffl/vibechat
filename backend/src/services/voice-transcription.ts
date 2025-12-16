import * as fs from "node:fs";
import * as path from "node:path";
import { openai } from "../env";

/**
 * Generate a transcription of a voice message using Whisper
 * @param voiceUrl - The URL of the voice file (relative path like /uploads/xxx)
 * @returns The transcribed text
 */
export async function generateVoiceTranscription(
  voiceUrl: string
): Promise<string> {
  try {
    console.log(`🎙️ [VoiceTranscription] Generating transcription for: ${voiceUrl}`);

    // Convert relative URL to file path
    // Assuming backend runs in root of backend folder where uploads/ is adjacent or inside
    // image-description uses process.cwd()/uploads
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filename = path.basename(voiceUrl);
    const filePath = path.join(uploadsDir, filename);

    console.log(`📁 [VoiceTranscription] Reading voice file from: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ [VoiceTranscription] File not found: ${filePath}`);
      return "Transcription unavailable (file not found)";
    }

    // Create a read stream
    const fileStream = fs.createReadStream(filePath);

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
      language: "en", // Optional: Auto-detect if not specified, but usually safer to default or let it be
      response_format: "text",
    });

    console.log(`✅ [VoiceTranscription] Transcription result: ${transcription.slice(0, 50)}...`);
    
    // cast to string because response_format: 'text' returns a string
    return transcription as unknown as string;

  } catch (error) {
    console.error("❌ [VoiceTranscription] Error generating transcription:", error);
    return "Transcription failed";
  }
}
