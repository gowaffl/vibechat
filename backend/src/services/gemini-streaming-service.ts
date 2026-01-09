/**
 * Gemini 3 Streaming Response Service
 * 
 * This service provides streaming capabilities for Google's Gemini 3 API,
 * using gemini-3-flash-preview for chat with Google Search grounding,
 * and adaptive thinking levels for dynamic response quality.
 */

// Re-export types for compatibility with existing code
export type ThinkingLevel = "none" | "low" | "medium" | "high";

export interface GeminiStreamingOptions {
  systemPrompt: string;
  userPrompt: string;
  enableWebSearch?: boolean;
  thinkingLevel?: ThinkingLevel;
  maxTokens?: number;
  chatHistory?: Array<{ role: "user" | "model"; content: string }>;
}

export type StreamEventType = 
  | "thinking_start"
  | "thinking_delta"
  | "thinking_end"
  | "tool_call_start"
  | "tool_call_progress"
  | "tool_call_end"
  | "content_delta"
  | "content_end"
  | "image_generated"
  | "error"
  | "done";

export interface StreamEvent {
  type: StreamEventType;
  data: {
    content?: string;
    toolName?: string;
    toolInput?: any;
    imageBase64?: string;
    imageId?: string;
    error?: string;
    sources?: any[];
    status?: string;
    thoughtSignature?: string;
  };
}

/**
 * Analyze the user's prompt to determine the appropriate thinking level
 * This allows the model to adaptively decide how much reasoning to do
 */
export function analyzePromptComplexity(userPrompt: string): ThinkingLevel {
  const promptLength = userPrompt.length;
  
  // High complexity indicators - require deep analysis
  const highComplexityPatterns = [
    /analyze\s+(in\s+)?detail/i,
    /comprehensive\s+(analysis|review|breakdown)/i,
    /step\s+by\s+step/i,
    /compare\s+and\s+contrast/i,
    /explain\s+(thoroughly|in\s+depth|completely)/i,
    /research\s+(and\s+)?(find|discover|analyze)/i,
    /complex\s+(problem|question|task)/i,
    /multi(-|\s+)step/i,
    /critically\s+(analyze|evaluate|assess)/i,
    /pros\s+and\s+cons/i,
    /advantages?\s+and\s+disadvantages?/i,
    /evaluate\s+(all|multiple|various)/i,
    /write\s+(a\s+)?(detailed|comprehensive|thorough)/i,
    /create\s+(a\s+)?(detailed|comprehensive|full)/i,
    /plan\s+(out|for|how)/i,
    /debug\s+(this|my|the)/i,
    /optimize\s+(this|my|the)/i,
    /code\s+(review|analysis)/i,
  ];
  
  // Medium complexity indicators
  const mediumComplexityPatterns = [
    /explain\s+(how|why|what)/i,
    /describe\s+the\s+process/i,
    /how\s+does?\s+.+\s+work/i,
    /what\s+(are|is)\s+the\s+(difference|relationship)/i,
    /help\s+me\s+(understand|figure\s+out)/i,
    /summarize/i,
    /write\s+(a|an)\s+/i,
    /create\s+(a|an)\s+/i,
    /generate\s+(a|an)\s+/i,
    /translate/i,
    /convert/i,
  ];
  
  // Low complexity indicators - simple questions
  const lowComplexityPatterns = [
    /^(what|who|when|where|which)\s+(is|are|was|were)\s+/i,
    /^(yes|no)\s+or\s+/i,
    /define\s+/i,
    /^(hi|hello|hey)/i,
    /quick\s+(question|answer|help)/i,
    /simple\s+(question|answer)/i,
    /just\s+(tell|give|show)\s+me/i,
    /^(can|could)\s+you\s+(just|quickly)/i,
    /what\s+time/i,
    /thank/i,
  ];
  
  // Check for web search indicators - needs at least medium thinking
  const needsWebSearch = /\b(latest|current|recent|today|now|2024|2025|2026|news|update)\b/i.test(userPrompt) ||
                         /\b(search|find|look\s+up|google)\b/i.test(userPrompt);
  
  // Score the prompt
  let score = 0;
  
  // Length-based scoring
  if (promptLength > 500) score += 2;
  else if (promptLength > 200) score += 1;
  
  // Pattern matching
  for (const pattern of highComplexityPatterns) {
    if (pattern.test(userPrompt)) {
      score += 3;
      break;
    }
  }
  
  for (const pattern of mediumComplexityPatterns) {
    if (pattern.test(userPrompt)) {
      score += 1;
    }
  }
  
  for (const pattern of lowComplexityPatterns) {
    if (pattern.test(userPrompt)) {
      score -= 1;
    }
  }
  
  // Adjust for special cases
  if (needsWebSearch) score = Math.max(score, 1);
  
  // Determine thinking level
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  if (score >= 1) return "low";
  return "none";
}

/**
 * Map complexity level to Gemini thinking level
 * This provides a clean mapping interface for external callers
 */
export function mapToGeminiThinkingLevel(complexity: ThinkingLevel): ThinkingLevel {
  // Gemini 3 uses the same thinking level names as our complexity analysis
  // This function serves as a mapping layer in case Gemini API changes
  return complexity;
}

/**
 * Parse SSE data from Gemini streaming response
 */
function parseSSEData(line: string): any | null {
  if (!line.startsWith('data: ')) return null;
  const jsonStr = line.slice(6).trim();
  if (!jsonStr || jsonStr === '[DONE]') return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Stream Gemini 3 Flash response using the generateContent API with SSE
 * Yields events as they are received from Google
 */
export async function* streamGeminiResponse(
  options: GeminiStreamingOptions
): AsyncGenerator<StreamEvent> {
  const {
    systemPrompt,
    userPrompt,
    enableWebSearch = true,
    thinkingLevel = "none",
    maxTokens = 4096,
    chatHistory = [],
  } = options;
  
  // Determine adaptive thinking level if not specified
  const adaptiveThinking = thinkingLevel === "none" 
    ? analyzePromptComplexity(userPrompt) 
    : thinkingLevel;
  
  console.log("[Gemini-Streaming] Starting streaming response");
  console.log("[Gemini-Streaming] Adaptive thinking level:", adaptiveThinking);
  console.log("[Gemini-Streaming] Web search enabled:", enableWebSearch);
  
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("[Gemini-Streaming] GOOGLE_API_KEY not configured");
    yield { type: "error", data: { error: "API key not configured" } };
    return;
  }
  
  try {
    // Build contents array with chat history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Add chat history
    for (const msg of chatHistory) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      });
    }
    
    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: userPrompt }]
    });
    
    // Build request body
    const requestBody: any = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: maxTokens,
      }
    };
    
    // Add thinking config if not "none"
    if (adaptiveThinking !== "none") {
      requestBody.generationConfig.thinkingConfig = {
        thinkingLevel: adaptiveThinking
      };
    }
    
    // Add Google Search tool if enabled
    if (enableWebSearch) {
      requestBody.tools = [{ googleSearch: {} }];
    }
    
    console.log("[Gemini-Streaming] Request body:", JSON.stringify({
      ...requestBody,
      systemInstruction: { parts: [{ text: "..." }] }, // Don't log full system prompt
      contents: contents.map(c => ({ role: c.role, parts: "..." })) // Don't log full content
    }));
    
    // Make streaming request to Gemini API
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse',
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
      console.error("[Gemini-Streaming] API error:", response.status, errorText);
      yield { 
        type: "error", 
        data: { error: `Gemini API error: ${response.status} - ${errorText}` } 
      };
      return;
    }
    
    if (!response.body) {
      yield { type: "error", data: { error: "No response body" } };
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let currentContent = "";
    let currentThinking = "";
    let isInThinking = false;
    let thoughtSignature: string | undefined;
    let hasEmittedThinkingStart = false;
    let isSearching = false;
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const data = parseSSEData(line);
        if (!data) continue;
        
        // Check for errors in the response
        if (data.error) {
          console.error("[Gemini-Streaming] Error in response:", data.error);
          yield { 
            type: "error", 
            data: { error: data.error.message || "Unknown error" } 
          };
          continue;
        }
        
        // Process candidates
        const candidates = data.candidates || [];
        for (const candidate of candidates) {
          const content = candidate.content;
          if (!content) continue;
          
          // Check for thought signature
          if (candidate.thoughtSignature) {
            thoughtSignature = candidate.thoughtSignature;
          }
          
          for (const part of content.parts || []) {
            // Handle thinking/reasoning content
            if (part.thought) {
              if (!hasEmittedThinkingStart) {
                hasEmittedThinkingStart = true;
                isInThinking = true;
                yield { type: "thinking_start", data: {} };
              }
              currentThinking += part.thought;
              yield { type: "thinking_delta", data: { content: part.thought } };
            }
            // Handle regular text content
            else if (part.text) {
              // If we were in thinking mode, end it first
              if (isInThinking) {
                isInThinking = false;
                yield { 
                  type: "thinking_end", 
                  data: { content: currentThinking, thoughtSignature } 
                };
              }
              
              currentContent += part.text;
              yield { type: "content_delta", data: { content: part.text } };
            }
          }
          
          // Check for grounding metadata (web search results)
          const groundingMetadata = candidate.groundingMetadata;
          if (groundingMetadata) {
            // Handle search queries
            if (groundingMetadata.searchEntryPoint && !isSearching) {
              isSearching = true;
              yield { 
                type: "tool_call_start", 
                data: { 
                  toolName: "web_search", 
                  toolInput: groundingMetadata.searchEntryPoint 
                } 
              };
            }
            
            // Handle grounding chunks (search results)
            if (groundingMetadata.groundingChunks || groundingMetadata.webSearchQueries) {
              const sources = groundingMetadata.groundingChunks?.map((chunk: any) => ({
                title: chunk.web?.title || chunk.retrievedContext?.title,
                uri: chunk.web?.uri || chunk.retrievedContext?.uri,
              })).filter((s: any) => s.uri) || [];
              
              if (sources.length > 0 || groundingMetadata.webSearchQueries) {
                yield { 
                  type: "tool_call_progress", 
                  data: { 
                    toolName: "web_search", 
                    status: "completed",
                    sources 
                  } 
                };
              }
            }
          }
          
          // Check finish reason
          if (candidate.finishReason) {
            console.log("[Gemini-Streaming] Finish reason:", candidate.finishReason);
            
            // End search if it was active
            if (isSearching) {
              isSearching = false;
              const sources = candidate.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
                title: chunk.web?.title,
                uri: chunk.web?.uri,
              })).filter((s: any) => s.uri) || [];
              
              yield { 
                type: "tool_call_end", 
                data: { toolName: "web_search", sources } 
              };
            }
            
            // End thinking if still active
            if (isInThinking) {
              isInThinking = false;
              yield { 
                type: "thinking_end", 
                data: { content: currentThinking, thoughtSignature } 
              };
            }
          }
        }
        
        // Check for usage metadata (final chunk usually)
        if (data.usageMetadata) {
          console.log("[Gemini-Streaming] Usage metadata:", data.usageMetadata);
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.trim()) {
      const data = parseSSEData(buffer);
      if (data && !data.error) {
        // Process final data similarly
        for (const candidate of data.candidates || []) {
          for (const part of candidate.content?.parts || []) {
            if (part.text) {
              currentContent += part.text;
              yield { type: "content_delta", data: { content: part.text } };
            }
          }
        }
      }
    }
    
    // Emit content end
    console.log("[Gemini-Streaming] Response completed");
    yield { 
      type: "content_end", 
      data: { content: currentContent, thoughtSignature } 
    };
    
    // Emit done
    yield { type: "done", data: { thoughtSignature } };
    console.log("[Gemini-Streaming] Done event yielded");
    
  } catch (error: any) {
    console.error("[Gemini-Streaming] Error:", error);
    yield { 
      type: "error", 
      data: { error: error?.message || "Unknown streaming error" } 
    };
  }
}

/**
 * Build system prompt for personal chat with adaptive response guidance
 */
export function buildPersonalChatSystemPrompt(
  agentName: string,
  personality?: string,
  tone?: string,
  chatHistory: Array<{ role: string; content: string }> = [],
  isMinor: boolean = false
): string {
  // Import safety system prompt from content-safety service
  const { getSafetySystemPrompt } = require("./content-safety");
  const safetyPrompt = getSafetySystemPrompt(isMinor);
  
  let prompt = `You are "${agentName}", having a private one-on-one conversation with the user.`;
  
  if (personality) {
    prompt += `\n\n**Your Personality:** ${personality}`;
  }
  
  if (tone) {
    prompt += `\n**Your Tone:** ${tone}`;
  }
  
  // Add safety guidelines at the start - CRITICAL for content moderation
  prompt += `\n\n${safetyPrompt}\n`;
  
  prompt += `

**ADAPTIVE RESPONSE GUIDELINES:**

You have the ability to decide how detailed and in-depth your response should be based on what the user is asking:

1. **For simple questions** (greetings, quick facts, yes/no questions):
   - Keep responses concise and direct
   - No need for extensive formatting
   - A few sentences is usually sufficient

2. **For moderate requests** (explanations, summaries, creative writing):
   - Provide a balanced response with appropriate detail
   - Use formatting when it helps readability
   - Include relevant examples when helpful

3. **For complex tasks** (analysis, research, detailed explanations, code):
   - Provide comprehensive, thorough responses
   - Use structured formatting (headers, lists, code blocks)
   - Break down complex topics into digestible sections
   - Show your reasoning process when appropriate

**RESPONSE FORMATTING:**
- Use **bold** for emphasis and key terms
- Use bullet points and numbered lists for organization
- Use code blocks for any code or technical content
- Use headers (##) to organize longer responses
- Include relevant examples and analogies

**WEB SEARCH:**
- When the user asks about current events, news, or real-time information, you may use Google Search to find accurate information
- Integrate search results naturally into your response
- Cite sources when providing factual information from search results

**IMPORTANT:**
- Be conversational and engaging, not robotic
- Adapt your language complexity to match the user's style
- Show personality while remaining helpful
- If uncertain, ask clarifying questions
- Don't over-explain simple things, but don't under-explain complex topics`;

  return prompt;
}
