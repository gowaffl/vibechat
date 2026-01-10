/**
 * Gemini 3 Response Service (Non-Streaming)
 * 
 * This service provides non-streaming API calls for Google's Gemini 3 models:
 * - gemini-3-flash-preview: General chat and web search
 * - gemini-3-pro-image-preview: Image generation
 * 
 * Includes adaptive thinking levels for dynamic response quality.
 */

import { analyzePromptComplexity, mapToGeminiThinkingLevel } from './gemini-streaming-service';
import type { ThinkingLevel } from './gemini-streaming-service';

// Type for Gemini API response
interface GeminiAPIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
    };
    thoughtSignature?: string;
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { title?: string; uri?: string };
        snippet?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CHAT_MODEL = 'gemini-3-flash-preview';
// Gemini 3 Pro Image Preview for image generation
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

export interface GeminiResponseOptions {
  systemPrompt: string;
  userPrompt: string;
  enableWebSearch?: boolean;
  thinkingLevel?: ThinkingLevel;
  maxTokens?: number;
  chatHistory?: Array<{ role: "user" | "model"; content: string }>;
}

export interface GeminiImageGenerationOptions {
  prompt: string;
  numberOfImages?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  /** Optional reference images to use as basis for image generation */
  referenceImages?: Array<{
    base64: string;
    mimeType: string;
  }>;
}

export interface GeminiResponse {
  content: string;
  thoughtSignature?: string;
  searchGrounding?: {
    sources: Array<{
      title: string;
      url: string;
      snippet?: string;
    }>;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GeminiImageResponse {
  images: Array<{
    base64Data: string;
    mimeType: string;
  }>;
  thoughtSignature?: string;
}

/**
 * Execute a non-streaming Gemini response
 */
export async function executeGeminiResponse(options: GeminiResponseOptions): Promise<GeminiResponse> {
  const {
    systemPrompt,
    userPrompt,
    enableWebSearch = false,
    thinkingLevel,
    maxTokens = 8192,
    chatHistory = []
  } = options;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  // Determine thinking level - use provided or analyze prompt
  const effectiveThinkingLevel = thinkingLevel ?? mapToGeminiThinkingLevel(analyzePromptComplexity(userPrompt));

  // Build contents array with chat history
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  
  // Add chat history
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }
  
  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  // Build tools array
  const tools: Array<Record<string, unknown>> = [];
  if (enableWebSearch) {
    tools.push({ googleSearch: {} });
  }

  // Build generation config
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
    temperature: effectiveThinkingLevel === 'high' ? 0.7 : 
                 effectiveThinkingLevel === 'medium' ? 0.8 : 
                 effectiveThinkingLevel === 'low' ? 0.9 : 1.0,
  };

  // Add thinking configuration for higher complexity requests
  if (effectiveThinkingLevel !== 'none') {
    generationConfig.thinkingConfig = {
      thinkingLevel: effectiveThinkingLevel,
      includeThoughts: true
    };
  }

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    }
  };

  if (tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${CHAT_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini Response] API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as GeminiAPIResponse;
  
  // Extract response content
  let content = '';
  let thoughtSignature: string | undefined;
  let searchGrounding: GeminiResponse['searchGrounding'] | undefined;

  if (data.candidates && data.candidates[0]) {
    const candidate = data.candidates[0];
    
    // Extract thought signature if present
    if (candidate.thoughtSignature) {
      thoughtSignature = candidate.thoughtSignature;
    }

    // Extract content from parts
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        }
      }
    }

    // Extract search grounding metadata
    if (candidate.groundingMetadata?.groundingChunks) {
      searchGrounding = {
        sources: candidate.groundingMetadata.groundingChunks.map((chunk) => ({
          title: chunk.web?.title || 'Source',
          url: chunk.web?.uri || '',
          snippet: chunk.snippet
        }))
      };
    }
  }

  // Extract usage metadata
  const usage = data.usageMetadata ? {
    promptTokens: data.usageMetadata.promptTokenCount || 0,
    completionTokens: data.usageMetadata.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata.totalTokenCount || 0
  } : undefined;

  return {
    content,
    thoughtSignature,
    searchGrounding,
    usage
  };
}

/**
 * Execute Gemini web search with grounding
 * Convenience wrapper that enables web search by default
 */
export async function executeGeminiWebSearch(options: Omit<GeminiResponseOptions, 'enableWebSearch'>): Promise<GeminiResponse> {
  return executeGeminiResponse({
    ...options,
    enableWebSearch: true
  });
}

/**
 * Generate images using Gemini 3 Pro Image Preview
 * 
 * Based on Gemini 3 API documentation:
 * - Uses `imageConfig` inside `generationConfig`
 * - Supports aspectRatio: "1:1", "3:4", "4:3", "9:16", "16:9"
 * - Supports imageSize: "1K", "2K", "4K"
 * - Can optionally use googleSearch tool for grounded generation
 */
export async function generateGeminiImage(options: GeminiImageGenerationOptions): Promise<GeminiImageResponse> {
  const {
    prompt,
    numberOfImages = 1,
    aspectRatio = '1:1',
    referenceImages = []
  } = options;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  console.log('[Gemini Image] Generating image with prompt:', prompt.substring(0, 100) + '...');
  console.log('[Gemini Image] Config: aspectRatio:', aspectRatio, 'numberOfImages:', numberOfImages);
  console.log('[Gemini Image] Reference images:', referenceImages.length);
  
  // Build parts array - reference images first, then text prompt
  // CRITICAL: Add reference images FIRST in the parts array
  // The model pays most attention to the first parts for image-to-image generation
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  
  // Add all reference images first
  for (const img of referenceImages) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    });
  }
  
  if (referenceImages.length > 0) {
    console.log(`[Gemini Image] ✅ Including ${referenceImages.length} reference image(s) in request`);
  }
  
  // Build the text prompt with explicit instructions about reference images
  const finalPrompt = referenceImages.length > 0
    ? `Using the provided reference image(s) as the PRIMARY BASIS and starting point, ${prompt}. IMPORTANT: You MUST use the reference image(s) as the foundation. Keep the main elements, composition, and style from the reference image(s) and apply the requested modifications.`
    : prompt;
  
  // Add the text prompt
  parts.push({ text: finalPrompt });
  
  console.log(`[Gemini Image] Final parts array has ${parts.length} parts (${referenceImages.length} images + 1 text prompt)`);
  
  // Build request body per Gemini 3 API documentation
  // Reference: https://ai.google.dev/gemini-api/docs/image-generation
  const requestBody: Record<string, any> = {
    contents: [{
      parts
    }],
    generationConfig: {
      imageConfig: {
        aspectRatio,
        imageSize: '2K' // Good balance of quality and speed
      }
    }
  };

  // Add Google Search grounding for factual/current information requests
  const needsGrounding = /current|today|now|latest|weather|news|stock|price/i.test(prompt);
  if (needsGrounding) {
    requestBody.tools = [{ googleSearch: {} }];
    console.log('[Gemini Image] Adding Google Search grounding');
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${IMAGE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini Image] API error:', response.status, errorText);
    throw new Error(`Gemini Image API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as GeminiAPIResponse;
  console.log('[Gemini Image] Response received, candidates:', data.candidates?.length || 0);
  
  const images: Array<{ base64Data: string; mimeType: string }> = [];
  let thoughtSignature: string | undefined;

  if (data.candidates && data.candidates[0]) {
    const candidate = data.candidates[0];
    console.log('[Gemini Image] Candidate parts:', candidate.content?.parts?.length || 0);
    
    // Extract thought signature if present
    if (candidate.thoughtSignature) {
      thoughtSignature = candidate.thoughtSignature;
    }

    // Extract images from parts
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          console.log('[Gemini Image] Found image, mimeType:', part.inlineData.mimeType);
          images.push({
            base64Data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          });
        } else if (part.text) {
          // Model might return text alongside or instead of image
          console.log('[Gemini Image] Found text part:', part.text.substring(0, 100));
        }
      }
    }
  } else {
    console.error('[Gemini Image] No candidates in response:', JSON.stringify(data).substring(0, 500));
  }

  if (images.length === 0) {
    console.error('[Gemini Image] No images extracted from response');
    throw new Error('No images generated by Gemini');
  }
  
  console.log('[Gemini Image] Successfully generated', images.length, 'image(s)');

  return {
    images,
    thoughtSignature
  };
}

/**
 * Upload generated image to storage and return URL
 * This helper uploads a base64 image to Supabase storage
 */
export async function uploadGeneratedImage(
  base64Data: string,
  mimeType: string,
  supabaseClient: { storage: { from: (bucket: string) => { upload: (path: string, data: Buffer, options: Record<string, unknown>) => Promise<{ data: { path: string } | null; error: Error | null }> } } },
  bucketName: string = 'ai-generated-images'
): Promise<string> {
  const buffer = Buffer.from(base64Data, 'base64');
  const extension = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
  const filePath = `generated/${fileName}`;

  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    console.error('[Gemini Image Upload] Error:', error);
    throw new Error(`Failed to upload generated image: ${error.message}`);
  }

  // Return the public URL path
  return `${bucketName}/${data?.path || filePath}`;
}
