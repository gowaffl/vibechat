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
    console.log(`[VoiceTranscription] Generating transcription for: ${voiceUrl}`);

    // Convert relative URL to file path
    // Assuming backend runs in root of backend folder where uploads/ is adjacent or inside
    // image-description uses process.cwd()/uploads
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filename = path.basename(voiceUrl);
    const filePath = path.join(uploadsDir, filename);

    console.log(`[VoiceTranscription] Reading voice file from: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`[VoiceTranscription] File not found: ${filePath}`);
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

    console.log(`[VoiceTranscription] Transcription result: ${transcription.slice(0, 50)}...`);
    
    // cast to string because response_format: 'text' returns a string
    return transcription as unknown as string;

  } catch (error) {
    console.error("[VoiceTranscription] Error generating transcription:", error);
    return "Transcription failed";
  }
}

/**
 * Transcribe audio from a remote URL (e.g., S3/Supabase Storage)
 * Downloads the file temporarily and transcribes it
 * 
 * @param audioUrl - The full URL to the audio file
 * @returns The transcribed text
 */
export async function transcribeFromUrl(audioUrl: string): Promise<string> {
  try {
    console.log(`[VoiceTranscription] Transcribing from URL: ${audioUrl}`);
    
    // Fetch the audio file
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      console.error(`[VoiceTranscription] Failed to fetch audio: ${response.status} ${response.statusText}`);
      return "Transcription failed (could not fetch audio)";
    }
    
    // Get the audio as a buffer
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer]);
    
    // Determine file extension from URL or content-type
    const contentType = response.headers.get("content-type") || "audio/mp4";
    let extension = "mp4";
    if (contentType.includes("webm")) extension = "webm";
    else if (contentType.includes("ogg")) extension = "ogg";
    else if (contentType.includes("wav")) extension = "wav";
    else if (contentType.includes("mp3") || contentType.includes("mpeg")) extension = "mp3";
    
    // Create a File object for the OpenAI API
    const audioFile = new File([audioBlob], `recording.${extension}`, { type: contentType });
    
    console.log(`[VoiceTranscription] Audio file size: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    
    // Check file size - Whisper has a 25MB limit
    if (audioBuffer.byteLength > 25 * 1024 * 1024) {
      console.error(`[VoiceTranscription] Audio file too large for Whisper API (max 25MB)`);
      return "Transcription failed (file too large)";
    }
    
    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text",
    });
    
    const result = transcription as unknown as string;
    console.log(`[VoiceTranscription] Transcription complete (${result.length} chars)`);
    
    return result;
    
  } catch (error) {
    console.error("[VoiceTranscription] Error transcribing from URL:", error);
    return "Transcription failed";
  }
}
