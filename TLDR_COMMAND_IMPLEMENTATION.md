# Add /tldr AI Command

This plan implements a new `/tldr` command that allows users to generate summaries of recent messages. The command will be context-aware (Smart Threads vs. Main Chat) and support a customizable message limit.

## Backend Implementation
`backend/src/routes/ai.ts`
- Add a new `POST /tldr` endpoint.
- Define a request schema validating `chatId`, `userId`, `threadId` (optional), and `limit` (max 100, default 25).
- Implement message fetching logic:
  - If `threadId` is provided: Fetch thread details and use filtering logic (similar to `threads.ts`) to get relevant messages.
  - If `threadId` is missing: Fetch the last `limit` messages from the main chat.
- Construct a structured prompt for the AI (GPT-5) to generate a TLDR summary.
- Call the AI service and save the response as a message.

## Frontend Implementation
`src/components/AttachmentsMenu.tsx` and `src/components/AIToolsMenu.tsx`
- Add the `/tldr` command to the `builtInCommands` list.
  - Icon: `FileText` or `List` (or similar available icon like `AlignLeft`).
  - Description: "Summarize recent messages".
  - Color: Distinctive (e.g., #9D4EDD for Purple).

`src/screens/ChatScreen.tsx`
- Modify `handleSend` to intercept messages starting with `/tldr`.
- Parse the command to extract the optional limit (e.g., `/tldr 50`).
- Resolve the `currentThreadId` from state.
- Make a POST request to `/api/ai/tldr` with the context and limit.
- Clear the input field immediately.

## Testing
- Verify the command appears in the attachments menu.
- Test `/tldr` in the main chat (should summarize recent messages).
- Test `/tldr 10` (should respect limit).
- Test `/tldr` in a Smart Thread (should only summarize messages belonging to that thread).
- Verify the AI response is formatted correctly.

