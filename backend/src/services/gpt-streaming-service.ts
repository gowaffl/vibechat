/**
 * GPT-5.1 Streaming Response Service
 * 
 * This service provides streaming capabilities for the OpenAI Responses API,
 * allowing real-time streaming of thinking, tool calls, and content.
 */

import OpenAI from "openai";
import { openai } from "../env";

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface StreamingOptions {
  systemPrompt: string;
  userPrompt: string;
  tools?: OpenAI.Responses.Tool[];
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  // Note: gpt-5.1 does not support temperature parameter
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
  };
}

/**
 * Analyze the user's prompt to determine the appropriate reasoning effort
 * This allows the model to adaptively decide how much thinking to do
 */
export function analyzePromptComplexity(userPrompt: string): ReasoningEffort {
  const promptLower = userPrompt.toLowerCase();
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
  
  // Check for image generation requests - these need more thinking
  const isImageRequest = /\b(generate|create|draw|make|design|paint|illustrate)\b.*\b(image|picture|photo|art|illustration|drawing|painting)\b/i.test(userPrompt) ||
                         /\b(image|picture|photo|art)\b.*\b(of|showing|depicting|featuring)\b/i.test(userPrompt);
  
  // Check for web search indicators - needs medium thinking
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
  if (isImageRequest) score += 1;
  if (needsWebSearch) score = Math.max(score, 1);
  
  // Determine reasoning effort
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  if (score >= 1) return "low";
  return "none";
}

/**
 * Stream GPT-5.1 response using the Responses API
 * Yields events as they are received from OpenAI
 */
export async function* streamGPT51Response(
  options: StreamingOptions
): AsyncGenerator<StreamEvent> {
  const {
    systemPrompt,
    userPrompt,
    tools,
    reasoningEffort = "none",
    maxTokens = 4096,
  } = options;
  
  // Determine if we should use reasoning based on prompt complexity
  const adaptiveReasoning = reasoningEffort === "none" 
    ? analyzePromptComplexity(userPrompt) 
    : reasoningEffort;
  
  console.log("[GPT-Streaming] Starting streaming response");
  console.log("[GPT-Streaming] Adaptive reasoning effort:", adaptiveReasoning);
  
  try {
    // Build reasoning config
    const reasoningConfig = adaptiveReasoning !== "none" 
      ? { effort: adaptiveReasoning as Exclude<ReasoningEffort, "none"> }
      : undefined;
    
    // Create streaming response
    // Note: gpt-5.1 does not support temperature parameter
    const stream = await openai.responses.create({
      model: "gpt-5.1",
      instructions: systemPrompt,
      input: userPrompt,
      tools,
      max_output_tokens: maxTokens,
      reasoning: reasoningConfig,
      stream: true,
      include: ["web_search_call.action.sources", "code_interpreter_call.outputs"],
    });
    
    let currentThinking = "";
    let currentContent = "";
    let isInThinking = false;
    let currentToolCall: { name: string; input: any } | null = null;
    
    // Process streaming events
    for await (const event of stream) {
      const eventType = (event as any).type;
      
      // Handle different event types based on OpenAI Responses API streaming
      switch (eventType) {
        case "response.created":
          console.log("[GPT-Streaming] Response created:", (event as any).response?.id);
          break;
          
        case "response.in_progress":
          // Response is being processed
          break;
          
        case "response.output_item.added":
          const addedItem = (event as any).item;
          if (addedItem?.type === "reasoning") {
            isInThinking = true;
            yield { type: "thinking_start", data: {} };
          } else if (addedItem?.type === "web_search_call") {
            currentToolCall = { name: "web_search", input: addedItem.action };
            yield { 
              type: "tool_call_start", 
              data: { toolName: "web_search", toolInput: addedItem.action } 
            };
          } else if (addedItem?.type === "image_generation_call") {
            currentToolCall = { name: "image_generation", input: addedItem.action };
            yield { 
              type: "tool_call_start", 
              data: { toolName: "image_generation", toolInput: addedItem.action } 
            };
          }
          break;
        
        // Handle web search lifecycle events
        case "response.web_search_call.in_progress":
          console.log("[GPT-Streaming] Web search in progress");
          yield { 
            type: "tool_call_progress", 
            data: { toolName: "web_search", status: "in_progress" } 
          };
          break;
          
        case "response.web_search_call.searching":
          console.log("[GPT-Streaming] Web search searching");
          yield { 
            type: "tool_call_progress", 
            data: { toolName: "web_search", status: "searching" } 
          };
          break;
          
        case "response.web_search_call.completed":
          console.log("[GPT-Streaming] Web search completed");
          const searchResults = (event as any).item || (event as any);
          yield { 
            type: "tool_call_end", 
            data: { 
              toolName: "web_search",
              sources: searchResults?.action?.sources || searchResults?.sources
            } 
          };
          currentToolCall = null;
          break;
        
        // Handle image generation lifecycle events
        case "response.image_generation_call.in_progress":
          console.log("[GPT-Streaming] Image generation in progress");
          yield { 
            type: "tool_call_progress", 
            data: { toolName: "image_generation", status: "in_progress" } 
          };
          break;
          
        case "response.image_generation_call.generating":
          console.log("[GPT-Streaming] Image generation generating");
          yield { 
            type: "tool_call_progress", 
            data: { toolName: "image_generation", status: "generating" } 
          };
          break;
          
        case "response.image_generation_call.partial_image":
          console.log("[GPT-Streaming] Image generation partial image received");
          // Just log for now - we'll wait for the final image in output_item.done
          // This prevents partial/incomplete images from being saved
          yield { 
            type: "tool_call_progress", 
            data: { toolName: "image_generation", status: "generating_preview" } 
          };
          break;
          
        case "response.image_generation_call.completed":
          console.log("[GPT-Streaming] Image generation completed event");
          const imageResult = (event as any).item || (event as any);
          const imageData = imageResult?.result || imageResult?.image || imageResult?.data || imageResult?.output;
          
          if (imageData) {
            console.log("[GPT-Streaming] Found completed image data");
            yield { 
              type: "image_generated", 
              data: { 
                imageBase64: imageData,
                imageId: imageResult?.id || `img_${Date.now()}`
              } 
            };
          } else {
            console.error("[GPT-Streaming] No image data in completed event:", JSON.stringify(imageResult, null, 2));
          }
          
          yield { type: "tool_call_end", data: { toolName: "image_generation" } };
          currentToolCall = null;
          break;
          
        case "response.output_item.done":
          const doneItem = (event as any).item;
          if (doneItem?.type === "reasoning") {
            isInThinking = false;
            yield { type: "thinking_end", data: { content: currentThinking } };
            currentThinking = "";
          } else if (doneItem?.type === "web_search_call") {
            // Only emit tool_call_end if not already handled by web_search_call.completed
            if (currentToolCall?.name === "web_search") {
              yield { 
                type: "tool_call_end", 
                data: { 
                  toolName: "web_search",
                  sources: doneItem.action?.sources 
                } 
              };
              currentToolCall = null;
            }
          } else if (doneItem?.type === "image_generation_call") {
            console.log("[GPT-Streaming] Image generation done, checking for result...");
            console.log("[GPT-Streaming] Done item keys:", Object.keys(doneItem || {}));
            
            // Try multiple possible field names for the image data
            const imageData = doneItem.result || doneItem.image || doneItem.data || doneItem.output;
            
            if (imageData) {
              console.log("[GPT-Streaming] Found image data, type:", typeof imageData);
              yield { 
                type: "image_generated", 
                data: { 
                  imageBase64: imageData,
                  imageId: doneItem.id || `img_${Date.now()}`
                } 
              };
            } else {
              console.error("[GPT-Streaming] No image data found in doneItem:", JSON.stringify(doneItem, null, 2));
            }
            
            yield { type: "tool_call_end", data: { toolName: "image_generation" } };
            currentToolCall = null;
          }
          break;
          
        case "response.content_part.added":
          // Content part starting
          break;
          
        case "response.content_part.delta":
        case "response.output_text.delta":
          const deltaText = (event as any).delta || (event as any).text || "";
          if (isInThinking) {
            currentThinking += deltaText;
            yield { type: "thinking_delta", data: { content: deltaText } };
          } else if (deltaText) {
            currentContent += deltaText;
            yield { type: "content_delta", data: { content: deltaText } };
          }
          break;
          
        case "response.content_part.done":
        case "response.output_text.done":
          // Content part finished
          break;
          
        case "response.completed":
        case "response.done":
          console.log("[GPT-Streaming] Response completed");
          yield { type: "content_end", data: { content: currentContent } };
          break;
          
        case "response.failed":
          const error = (event as any).error;
          console.error("[GPT-Streaming] Response failed:", error);
          yield { 
            type: "error", 
            data: { error: error?.message || "Response generation failed" } 
          };
          break;
          
        default:
          // Log unknown event types for debugging (ignore common events)
          if (eventType && !eventType.startsWith("rate_limits")) {
            console.log("[GPT-Streaming] Unhandled event type:", eventType);
          }
      }
    }
    
    console.log("[GPT-Streaming] Stream loop completed, yielding done event");
    yield { type: "done", data: {} };
    console.log("[GPT-Streaming] Done event yielded");
    
  } catch (error: any) {
    console.error("[GPT-Streaming] Error:", error);
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
  // This adds the same safety guidelines used in group chat
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

**TOOL USAGE:**
- When the user asks about current events, news, or real-time information, use web_search
- When the user explicitly asks for an image or visual content, use image_generation
- You can decide to use tools autonomously when they would help answer the user's question
- After using a tool, integrate the results naturally into your response

**IMPORTANT:**
- Be conversational and engaging, not robotic
- Adapt your language complexity to match the user's style
- Show personality while remaining helpful
- If uncertain, ask clarifying questions
- Don't over-explain simple things, but don't under-explain complex topics`;

  return prompt;
}

