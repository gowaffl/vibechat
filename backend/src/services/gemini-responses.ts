/**
 * Gemini 3 Response Service (Non-Streaming)
 * 
 * This service provides non-streaming API calls for Google's Gemini 3 models:
 * - gemini-3-flash-preview: General chat and web search
 * - gemini-3-pro-image-preview: Image generation
 * 
 * Includes adaptive thinking levels for dynamic response quality.
 */

import { analyzePromptComplexity, ThinkingLevel, mapToGeminiThinkingLevel } from './gemini-streaming-service';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CHAT_MODEL = 'gemini-3-flash-preview';
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

  const data = await response.json();
  
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
        sources: candidate.groundingMetadata.groundingChunks.map((chunk: { web?: { title?: string; uri?: string }; snippet?: string }) => ({
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
 */
export async function generateGeminiImage(options: GeminiImageGenerationOptions): Promise<GeminiImageResponse> {
  const {
    prompt,
    numberOfImages = 1,
    aspectRatio = '1:1'
  } = options;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  // Build the request for image generation
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseModalities: ['image', 'text'],
      imagGenerationConfig: {
        numberOfImages,
        aspectRatio,
        outputImageFormat: 'png'
      }
    },
    // Enable thinking for better image understanding
    thinkingConfig: {
      thinkingLevel: 'low',
      includeThoughts: false
    }
  };

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

  const data = await response.json();
  
  const images: Array<{ base64Data: string; mimeType: string }> = [];
  let thoughtSignature: string | undefined;

  if (data.candidates && data.candidates[0]) {
    const candidate = data.candidates[0];
    
    // Extract thought signature if present
    if (candidate.thoughtSignature) {
      thoughtSignature = candidate.thoughtSignature;
    }

    // Extract images from parts
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          images.push({
            base64Data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          });
        }
      }
    }
  }

  if (images.length === 0) {
    throw new Error('No images generated by Gemini');
  }

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
