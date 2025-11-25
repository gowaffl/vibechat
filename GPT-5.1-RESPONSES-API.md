# GPT-5.1 with Responses API - Implementation Guide

## Overview

Custom slash commands now use **OpenAI's Responses API** with GPT-5.1 and native hosted tools. This is the correct architecture for GPT-5.1's agentic capabilities.

## Key Architecture Changes

### ✅ Correct Implementation: Responses API

```typescript
// Use openai.responses.create(), NOT openai.chat.completions.create()
const response = await openai.responses.create({
  model: "gpt-5.1",
  instructions: systemPrompt,
  tools: [
    { type: "web_search" },
    { type: "image_generation" },
    { type: "code_interpreter", container: { type: "auto" } },
  ],
  input: userPrompt,
  reasoning: undefined, // set only when effort != "none"
  include: ["web_search_call.action.sources", "code_interpreter_call.outputs"],
});
```

### ❌ Previous Incorrect Implementation: Chat Completions API

```typescript
// This was wrong - don't use this
const response = await openai.chat.completions.create({
  model: "gpt-5.1",
  messages: [...],
  tools: [...],
});
```

## Hosted Tools

OpenAI provides these tools natively when using the Responses API with `reasoning_effort: "none"`:

### 1. Web Search
```typescript
{ type: "web_search" }
```
- Real-time web search capability
- Automatically executed by OpenAI
- No manual implementation needed
- Results incorporated into response automatically

### 2. Image Generation
```typescript
{ type: "image_generation" }
```
- Generates images based on text descriptions
- Replaces separate DALL-E API calls
- Images handled automatically by OpenAI
- May be embedded in response or returned separately

### 3. Code Interpreter
```typescript
{ type: "code_interpreter", container: { type: "auto" } }
```
- Run Python code
- Perform lightweight data analysis/calculations
- Container managed automatically by OpenAI

## Implementation Files

### 1. `backend/src/services/gpt-responses.ts`
Main service for Responses API integration:

```typescript
export async function executeGPT51Response(
  options: CreateResponseOptions
): Promise<ResponseResult> {
  const response = await openai.responses.create({
    model: "gpt-5.1",
    instructions: systemPrompt,
    input: userPrompt,
    tools,
    reasoning: reasoningEffort === "none" ? undefined : { effort: reasoningEffort },
    temperature,
    max_output_tokens: maxTokens,
    include: ["web_search_call.action.sources", "code_interpreter_call.outputs"],
  });

  return {
    content: extractResponseText(response),
    images: extractImageResults(response), // base64 payloads
    responseId: response.id,
    status: response.status,
  };
}
```

**Key Points:**
- Uses `openai.responses.create()` (not `chat.completions.create()`)
- Leverages `instructions` + `input` instead of `messages`
- Hosted tools are declared with `{ type: ... }`
- No manual tool execution loop—OpenAI executes everything
- Extracts assistant text + image results so the route can persist them
- OpenAI handles everything automatically

### 2. `backend/src/routes/custom-commands.ts`
Route handler for custom slash command execution:

```typescript
const tools: OpenAI.Responses.Tool[] = [
  { type: "web_search" },
  { type: "image_generation" },
  { type: "code_interpreter", container: { type: "auto" } },
];

const result = await executeGPT51Response({
  systemPrompt,
  userPrompt,
  tools,
  reasoningEffort: "none",
  temperature: 1,
  maxTokens: 4096,
});
```

**Key Points:**
- No tool handler function needed
- No manual DALL·E calls (image data arrives as base64)
- Tools are automatically executed by OpenAI
- Route now just saves images to `/uploads` and stores the chat message

## Environment Variables

```bash
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com.proxy.vibecodeapp.com/v1  # optional
GPT51_MAX_TOKENS=4096                                          # optional
```

## Reasoning Effort Levels

- `"none"`: Hosted tools enabled (default for slash commands)
- `"minimal" / "low" / "medium" / "high"`: Map to `reasoning: { effort: ... }`

Only set the `reasoning` object when you want additional reasoning beyond the hosted-tool flow.

## How It Works

1. **User triggers custom slash command** (e.g., `/ainews`)
2. **System builds prompt** with command instructions and context
3. **Responses API called** with GPT-5.1 and hosted tools
4. **GPT-5.1 decides** which tools to use based on the task
5. **OpenAI executes tools** automatically (web search, image generation, etc.)
6. **Final response returned** with all tool outputs incorporated
7. **Response saved** as message in chat

## Testing

To test the `/ainews` command:

```
/ainews
```

Expected behavior:
1. AI recognizes it needs current information
2. Automatically uses `web_search` tool
3. Searches for latest AI news
4. Returns formatted summary with sources

## Troubleshooting

### Error: "Model not found"
- GPT-5.1 may not be available in your region yet
- Check API key has access to GPT-5.1
- May be in preview/beta requiring special access

### Error: "Unknown parameter: reasoning_effort"
- Verify you're using the Responses API, not Chat Completions
- Check OpenAI SDK version is up to date

### No web search results
- Verify `reasoning_effort: "none"` is set
- Check that tool type is exactly `"web_search"` (not `"web_search" as any`)
- Ensure using Responses API, not Chat Completions

### Images not generating
- Verify tool type is `"image_generation"` (not a function tool)
- Check that Responses API is being used
- Ensure `reasoning_effort: "none"` is set

## Differences from Chat Completions API

| Feature | Chat Completions | Responses API |
|---------|-----------------|---------------|
| Method | `openai.chat.completions.create()` | `openai.responses.create()` |
| Input | `messages: []` array | `input: string` and `instructions: string` |
| Tools | Function definitions | Simple `{ type: string }` |
| Tool Execution | Manual in your code | Automatic by OpenAI |
| State | Stateless | Stateful across tool calls |
| Best For | Simple chat | Agentic workflows with tools |

## Benefits of Responses API

1. **Simpler Code** - No tool execution loop needed
2. **Better Performance** - OpenAI optimizes tool calling
3. **Automatic State** - Maintains context across tool calls
4. **Native Tools** - Web search and image generation built-in
5. **Reliability** - OpenAI handles errors and retries

## Next Steps

- Monitor for GPT-5.1 availability in your region
- Test custom commands with web search
- Test custom commands with image generation
- Consider adding `code_interpreter` tool for data analysis
- Monitor API responses for tool call metadata

## References

- OpenAI Responses API Documentation
- GPT-5.1 Prompting Guide (Cookbook)
- OpenAI Latest Model Guide

