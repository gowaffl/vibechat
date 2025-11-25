# GPT-5.1 Custom Slash Commands – Current Implementation

## Overview

Custom slash commands now run on **GPT-5.1 via the OpenAI Responses API**. The assistant plans, uses hosted tools (web search, image generation, code interpreter), and returns both text and media that we persist to chat threads.

---

## Key Components

### `backend/src/services/gpt-responses.ts`
- Thin wrapper around `openai.responses.create`.
- Accepts system prompt, user prompt, and a list of OpenAI hosted tools.
- Maps the legacy `reasoning_effort` flag (with `"none"` for hosted tools) onto the new `reasoning` object. Any value except `"none"` becomes `{ effort: <value> }`.
- Extracts assistant text via `response.output_text` fallback logic.
- Collects every `image_generation_call` result, returning base64 payloads so the route can persist them.
- Returns `{ content, images[], responseId, status }`.

### `backend/src/routes/custom-commands.ts`
- Validates command, chat membership, and history context.
- Declares hosted tools for each execution:
  ```ts
  const tools: OpenAI.Responses.Tool[] = [
    { type: "web_search" },
    { type: "image_generation" },
    { type: "code_interpreter", container: { type: "auto" } },
  ];
  ```
- Builds GPT-5.1 system instructions (persistence, planning, autonomous tool usage).
- Calls `executeGPT51Response()` with `reasoningEffort: "none"`.
- Saves any returned images to `/uploads` (base64 → Buffer).
- Persists a chat message (text or image) and schedules async tagging.

### Image Persistence Helper

At the bottom of `custom-commands.ts`, `persistResponseImages()` decodes each base64 string, stores it under `/uploads/custom-command-<timestamp>-<index>.png`, and returns the public URLs for message creation.

---

## Hosted Tools & Capabilities

| Tool              | Purpose                                                     | Notes |
|-------------------|-------------------------------------------------------------|-------|
| `web_search`      | Real-time OpenAI-hosted search (no Google/Bing APIs)        | Sources can be requested via `include` (`web_search_call.action.sources`). |
| `image_generation`| GPT-native image generation (replaces manual DALL·E calls)  | Returns base64 directly in the Responses payload. |
| `code_interpreter`| Python sandbox for calculations & lightweight data analysis | We use `{ type: "auto" }` container; OpenAI manages execution. |

No manual tool loop is required—OpenAI orchestrates tool calls end-to-end when using the Responses API.

---

## Environment

```bash
OPENAI_API_KEY=your-api-key                       # required
OPENAI_BASE_URL=https://api.openai.com.proxy.vibecodeapp.com/v1  # optional proxy
GPT51_MAX_TOKENS=4096                             # optional override
```

- **Do not** set any Google search keys—the hosted `web_search` tool is the only implementation.
- Continue using the `"none"` value for `reasoningEffort` when you want GPT-5.1 to access hosted tools.

---

## Execution Flow

1. User invokes `/command` inside chat.
2. Route loads command prompt + message history and builds the system/user prompts.
3. Hosted tools array is attached (`web_search`, `image_generation`, `code_interpreter`).
4. `executeGPT51Response()` calls GPT-5.1 via Responses API.
5. OpenAI plans autonomously, runs tools, and returns text + media.
6. Route saves images (if any), creates the AI message, and schedules tagging.

---

## Testing

| Scenario  | Expected Behavior |
|-----------|-------------------|
| `/ainews` | GPT-5.1 triggers `web_search`, returns fresh AI headlines (look for citations). |
| `/design` | GPT-5.1 calls `image_generation`; image saved to `/uploads` and attached to chat. |
| `/analyze`| GPT-5.1 leverages `code_interpreter` for light data analysis / calculations. |

Use backend logs:
- `[GPT-Responses] …` shows raw Responses lifecycle and counts of generated images.
- `[CustomCommands] …` logs saved image paths and message IDs.

---

## Troubleshooting

| Issue | Mitigation |
|-------|------------|
| “Failed to generate” | Ensure `OPENAI_API_KEY` is set and GPT-5.1 access is enabled. Inspect `/api/custom-commands/execute` request + server logs. |
| Web search missing | Confirm `reasoningEffort: "none"` and `{ type: "web_search" }` exist in tools array. |
| Image not attached | Check `/uploads` write permissions, ensure base64 decoding succeeded, verify `imageUrl` persisted on the `Message`. |

---

## References

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [GPT-5.1 Prompting Guide](https://cookbook.openai.com/examples/gpt-5/gpt-5-1_prompting_guide)
- [Hosted Tools Overview](https://platform.openai.com/docs/guides/tools)

