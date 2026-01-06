/**
 * GPT-5.1 Responses API Service
 * 
 * This service uses OpenAI's Responses API (not Chat Completions) for GPT-5.1,
 * which supports hosted tools like web_search and image_generation natively.
 */

import OpenAI from "openai";
import { openai } from "../env";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";

export interface ResponseImageResult {
  id: string;
  base64: string;
}

export interface CreateResponseOptions {
  systemPrompt: string;
  userPrompt: string;
  tools?: OpenAI.Responses.Tool[];
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  // Note: gpt-5.1 does not support temperature parameter
}

export interface ResponseResult {
  content: string;
  images: ResponseImageResult[];
  responseId: string;
  status: string;
}

/**
 * Create and execute a Response with GPT-5.1 using Responses API
 * The Responses API handles tool execution automatically
 */
export async function executeGPT51Response(
  options: CreateResponseOptions
): Promise<ResponseResult> {
  const {
    systemPrompt,
    userPrompt,
    tools,
    reasoningEffort = "none", // Use "none" for hosted tools
    maxTokens = 4096,
  } = options;

  console.log("[GPT-Responses] Creating GPT-5.1 response via Responses API with reasoning effort:", reasoningEffort);

  try {
    const reasoningConfig =
      reasoningEffort && reasoningEffort !== "none"
        ? {
            effort: reasoningEffort as Exclude<ReasoningEffort, "none">,
          }
        : undefined;

    // Note: gpt-5.1 does not support temperature parameter
    const response = await openai.responses.create({
      model: "gpt-5.1",
      instructions: systemPrompt,
      input: userPrompt,
      tools,
      max_output_tokens: maxTokens,
      reasoning: reasoningConfig,
      include: ["web_search_call.action.sources", "code_interpreter_call.outputs"],
    });

    console.log("[GPT-Responses] Response created:", response.id);
    console.log("[GPT-Responses] Response status:", response.status);

    const textContent = extractResponseText(response);
    const imageResults = extractImageResults(response);

    console.log("[GPT-Responses] Response completed successfully with", imageResults.length, "image(s)");

    return {
      content: textContent,
      images: imageResults,
      responseId: response.id,
      status: response.status,
    };
  } catch (error: any) {
    console.error("[GPT-Responses] Error executing response:", error);
    console.error("[GPT-Responses] Error details:", JSON.stringify(error, null, 2));
    throw new Error(`GPT-5.1 Response execution failed: ${error?.message || "Unknown error"}`);
  }
}

function extractResponseText(response: OpenAI.Responses.Response): string {
  if (response.output_text && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  if (!response.output?.length) {
    return "";
  }

  const pieces: string[] = [];
  for (const item of response.output) {
    if ((item as any).type === "message") {
      const message = item as OpenAI.Responses.ResponseOutputMessage;
      for (const content of message.content) {
        if (content.type === "output_text") {
          pieces.push(content.text);
        } else if (content.type === "refusal") {
          pieces.push(content.refusal);
        }
      }
    }
  }

  return pieces.join("\n\n").trim();
}

function extractImageResults(response: OpenAI.Responses.Response): ResponseImageResult[] {
  if (!response.output?.length) {
    return [];
  }

  const images: ResponseImageResult[] = [];
  for (const item of response.output) {
    if ((item as any).type === "image_generation_call") {
      const imageCall = item as OpenAI.Responses.ResponseOutputItem.ImageGenerationCall;
      if (imageCall.result) {
        images.push({
          id: imageCall.id,
          base64: imageCall.result,
        });
      }
    }
  }

  return images;
}

/**
 * Determine appropriate reasoning effort based on command complexity
 */
export function determineReasoningEffort(
  commandPrompt: string,
  userMessage: string
): ReasoningEffort {
  const combinedText = `${commandPrompt} ${userMessage}`.toLowerCase();

  // High effort indicators: complex analysis, multi-step reasoning, coding
  const highEffortKeywords = [
    "analyze",
    "compare",
    "evaluate",
    "calculate",
    "optimize",
    "debug",
    "complex",
    "detailed analysis",
    "step by step",
    "comprehensive",
  ];

  // Low effort indicators: simple tasks, quick lookups
  const lowEffortKeywords = [
    "what is",
    "define",
    "quick",
    "simple",
    "just",
    "only",
    "briefly",
  ];

  const hasHighEffortKeyword = highEffortKeywords.some((keyword) =>
    combinedText.includes(keyword)
  );
  const hasLowEffortKeyword = lowEffortKeywords.some((keyword) =>
    combinedText.includes(keyword)
  );

  if (hasHighEffortKeyword && !hasLowEffortKeyword) {
    return "high";
  } else if (hasLowEffortKeyword && !hasHighEffortKeyword) {
    return "low";
  } else {
    return "medium"; // Default to medium
  }
}

/**
 * Create enhanced system prompt following GPT-5.1 best practices
 */
export function buildGPT51SystemPrompt(
  aiName: string,
  commandPrompt: string,
  tools: Array<{ type: string }>
): string {
  const toolDescriptions = tools
    .map((tool) => {
      if (tool.type === "web_search") {
        return `- **web_search**: Search the web for current, real-time information`;
      }
      if (tool.type === "image_generation") {
        return `- **image_generation**: Generate images based on text descriptions`;
      }
      if (tool.type === "code_interpreter") {
        return `- **code_interpreter**: Execute Python code and analyze data`;
      }
      return `- **${tool.type}**: Available tool`;
    })
    .join("\n");

  return `You are "${aiName}", an AI assistant executing a custom slash command with autonomous tool selection capabilities.

**Your Name:** ${aiName}

**Command Instructions:**
${commandPrompt}

**Tools Available:**
${toolDescriptions}

**CRITICAL INSTRUCTIONS - GPT-5.1 with reasoning_effort: "none":**

1. **Persistence & Completeness**: You are an agent - please keep going until the user's query is completely resolved, before ending your turn. Always complete the task fully. Do not stop prematurely. If a task requires multiple steps or tool calls, execute all of them to provide a comprehensive response.

2. **Plan Before Tool Use**: You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls, ensuring user's query is completely resolved. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully. In addition, ensure function calls have the correct arguments.

3. **Autonomous Tool Usage**: When you need to use a tool, call it directly without explanation. Do not output text like "I'll search for..." or "Let me generate...". Simply make the tool call, receive the result, and then provide your final response.

4. **Tool Selection**: Intelligently choose which tools to use based on the command instructions and user's request. You may:
   - Use no tools (respond from knowledge)
   - Use one tool
   - Use multiple tools in sequence
   - Use the same tool multiple times if needed

5. **Verify Tool Results**: When using tools, verify the results meet all user requirements before responding. Quote relevant details back for confirmation.

6. **Response Quality**: After using tools, synthesize the information into a clear, accurate, and helpful response. Integrate tool results naturally without mentioning that you used tools unless specifically relevant.

7. **Error Handling**: If a tool fails or returns incomplete information, acknowledge it gracefully and provide the best response possible with available information.

**Important:**
- Follow the command instructions precisely
- Provide thoughtful, accurate responses
- Be concise but complete
- Maintain conversation context from the chat history`;
}

