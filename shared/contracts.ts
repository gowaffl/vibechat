// contracts.ts
// Shared API contracts (schemas and types) used by both the server and the app.
// Import in the app as: `import { type GetMessagesResponse } from "@shared/contracts"`
// Import in the server as: `import { createUserRequestSchema } from "@shared/contracts"`

import { z } from "zod";

// Message History Entry schema
export const messageHistoryEntrySchema = z.object({
  date: z.string(), // ISO date string
  senderName: z.string(),
  text: z.string(),
});
export type MessageHistoryEntry = z.infer<typeof messageHistoryEntrySchema>;

// User schemas
export const userSchema = z.object({
  id: z.string(),
  phone: z.string(), // Phone number in E.164 format (e.g., +12396998960)
  name: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  birthdate: z.string().nullable().optional(), // ISO date string
  hasCompletedOnboarding: z.boolean(),
  summaryPreference: z.enum(["concise", "detailed"]).default("concise"), // AI catch-up summary preference
  hasSeenSummaryPreferencePrompt: z.boolean().default(false), // Whether user has seen the first-time preference prompt
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

// Reaction schemas
export const reactionSchema = z.object({
  id: z.string(),
  emoji: z.string(),
  userId: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  user: userSchema.optional(),
});
export type Reaction = z.infer<typeof reactionSchema>;

// Mention schemas
export const mentionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  mentionedUserId: z.string(),
  mentionedByUserId: z.string(),
  createdAt: z.string(),
  mentionedUser: userSchema.optional(),
  mentionedBy: userSchema.optional(),
});
export type Mention = z.infer<typeof mentionSchema>;

// Link Preview schema
export const linkPreviewSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  siteName: z.string().nullable(),
  favicon: z.string().nullable(),
});
export type LinkPreview = z.infer<typeof linkPreviewSchema>;

// Chat schemas
export const chatSchema = z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  aiPersonality: z.string().nullable(),
  aiTone: z.string().nullable(),
  aiName: z.string().nullable(),
  aiEngagementMode: z.enum(["on-call", "percentage", "off"]).default("on-call"),
  aiEngagementPercent: z.number().int().min(0).max(100).nullable(),
  lastAvatarGenDate: z.string().nullable(),
  avatarPromptUsed: z.string().nullable(),
  inviteToken: z.string().nullable(),
  creatorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Chat = z.infer<typeof chatSchema>;

// Chat member schemas
export const chatMemberSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  userId: z.string(),
  joinedAt: z.string(),
  isMuted: z.boolean().optional().default(false),
  user: userSchema.optional(),
});
export type ChatMember = z.infer<typeof chatMemberSchema>;

// Chat with metadata (includes member count, is creator, etc.)
export const chatWithMetadataSchema = chatSchema.extend({
  memberCount: z.number(),
  isCreator: z.boolean(),
  lastMessage: z.string().nullable().optional(),
  lastMessageAt: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  pinnedAt: z.string().nullable().optional(),
  isMuted: z.boolean().optional(),
});
export type ChatWithMetadata = z.infer<typeof chatWithMetadataSchema>;

// Chat with members (full details including member list)
export const chatWithMembersSchema = chatSchema.extend({
  members: z.array(chatMemberSchema),
  isCreator: z.boolean(),
});
export type ChatWithMembers = z.infer<typeof chatWithMembersSchema>;

// VibeWrapper type for emotional message context
export const vibeTypeSchema = z.enum(["genuine", "playful", "serious", "soft", "hype"]);
export type VibeType = z.infer<typeof vibeTypeSchema>;

// Message metadata schema for multi-image and video support
export const messageMetadataSchema = z.object({
  mediaUrls: z.array(z.string()).optional(), // Array of image URLs for multi-image messages
  videoUrl: z.string().optional(), // URL for video file
  videoThumbnailUrl: z.string().optional(), // Generated thumbnail for video preview
  videoDuration: z.number().optional(), // Video duration in seconds
  // Slash command context for custom commands
  slashCommand: z.object({
    command: z.string(), // e.g., "/roast"
    prompt: z.string().optional(), // User's input after the command
  }).optional(),
}).passthrough(); // Allow additional fields
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// Message schemas (recursive for replyTo)
export const messageSchema: z.ZodType<{
  id: string;
  content: string;
  messageType: "text" | "image" | "system" | "voice" | "video";
  imageUrl?: string | null;
  imageDescription?: string | null;
  userId: string;
  chatId: string;
  replyToId?: string | null;
  aiFriendId?: string | null;
  aiFriend?: any | null; // AIFriend type, but using any to avoid circular dependency
  editedAt?: string | null;
  isUnsent?: boolean;
  editHistory?: string | null;
  voiceUrl?: string | null;
  voiceDuration?: number | null;
  eventId?: string | null;
  pollId?: string | null;
  vibeType?: "genuine" | "playful" | "serious" | "soft" | "hype" | null;
  metadata?: MessageMetadata | null;
  user: User;
  replyTo?: Message | null;
  reactions?: Reaction[];
  mentions?: Mention[];
  tags?: MessageTag[];
  linkPreview?: LinkPreview | null;
  createdAt: string;
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    content: z.string(),
    messageType: z.enum(["text", "image", "system", "voice", "video"]).default("text"),
    imageUrl: z.string().nullable().optional(),
    imageDescription: z.string().nullable().optional(),
    userId: z.string(),
    chatId: z.string(),
    replyToId: z.string().nullable().optional(),
    aiFriendId: z.string().nullable().optional(),
    aiFriend: z.any().nullable().optional(), // Will be validated as AIFriend at runtime
    editedAt: z.string().nullable().optional(),
    isUnsent: z.boolean().optional(),
    editHistory: z.string().nullable().optional(),
    voiceUrl: z.string().nullable().optional(),
    voiceDuration: z.number().nullable().optional(),
    eventId: z.string().nullable().optional(),
    pollId: z.string().nullable().optional(),
    vibeType: vibeTypeSchema.nullable().optional(),
    metadata: messageMetadataSchema.nullable().optional(),
    user: userSchema,
    replyTo: messageSchema.nullable().optional(),
    reactions: z.array(reactionSchema).optional(),
    mentions: z.array(mentionSchema).optional(),
    tags: z.array(messageTagSchema).optional(),
    linkPreview: linkPreviewSchema.nullable().optional(),
    createdAt: z.string(),
  })
);
export type Message = z.infer<typeof messageSchema>;

// Bookmark schemas
export const bookmarkSchema = z.object({
  id: z.string(),
  userId: z.string(),
  chatId: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  message: messageSchema.optional(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const toggleBookmarkRequestSchema = z.object({
  userId: z.string(),
  chatId: z.string(),
  messageId: z.string(),
});
export type ToggleBookmarkRequest = z.infer<typeof toggleBookmarkRequestSchema>;

export const toggleBookmarkResponseSchema = z.object({
  action: z.enum(["added", "removed"]),
  bookmark: bookmarkSchema.optional(),
  bookmarkId: z.string().optional(),
});
export type ToggleBookmarkResponse = z.infer<typeof toggleBookmarkResponseSchema>;

export const getBookmarksResponseSchema = z.array(bookmarkSchema);
export type GetBookmarksResponse = z.infer<typeof getBookmarksResponseSchema>;

// POST /api/users - Create or get user (deprecated - use phone auth instead)
export const createUserRequestSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().optional(),
  image: z.string().optional(),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export const createUserResponseSchema = userSchema;
export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;

// PATCH /api/users/:id - Update user
export const updateUserRequestSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
  image: z.string().optional(),
  birthdate: z.string().optional(),
  hasCompletedOnboarding: z.boolean().optional(),
  summaryPreference: z.enum(["concise", "detailed"]).optional(),
  hasSeenSummaryPreferencePrompt: z.boolean().optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export const updateUserResponseSchema = userSchema;
export type UpdateUserResponse = z.infer<typeof updateUserResponseSchema>;

// GET /api/users/:id - Get user by ID
export const getUserResponseSchema = userSchema;
export type GetUserResponse = z.infer<typeof getUserResponseSchema>;

// GET /api/messages - Get all messages
export const getMessagesResponseSchema = z.array(messageSchema);
export type GetMessagesResponse = z.infer<typeof getMessagesResponseSchema>;

// POST /api/messages - Send message
export const sendMessageRequestSchema = z.object({
  content: z.string().default(""),
  messageType: z.enum(["text", "image", "voice", "video"]).default("text"),
  imageUrl: z.string().optional(),
  voiceUrl: z.string().optional(),
  voiceDuration: z.number().optional(),
  userId: z.string(),
  replyToId: z.string().optional(),
  vibeType: vibeTypeSchema.nullable().optional(),
  mentionedUserIds: z.array(z.string()).optional(),
  metadata: messageMetadataSchema.optional(), // For multi-image and video data
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
export const sendMessageResponseSchema = messageSchema;
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

// DELETE /api/messages/:id - Delete a message
export const deleteMessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteMessageResponse = z.infer<typeof deleteMessageResponseSchema>;

// PATCH /api/messages/:id - Edit a message
export const editMessageRequestSchema = z.object({
  content: z.string(),
  userId: z.string(),
});
export type EditMessageRequest = z.infer<typeof editMessageRequestSchema>;
export const editMessageResponseSchema = messageSchema;
export type EditMessageResponse = z.infer<typeof editMessageResponseSchema>;

// POST /api/messages/:id/unsend - Unsend a message
export const unsendMessageRequestSchema = z.object({
  userId: z.string(),
});
export type UnsendMessageRequest = z.infer<typeof unsendMessageRequestSchema>;
export const unsendMessageResponseSchema = messageSchema;
export type UnsendMessageResponse = z.infer<typeof unsendMessageResponseSchema>;

// POST /api/reactions - Add reaction
export const addReactionRequestSchema = z.object({
  emoji: z.string(),
  userId: z.string(),
  messageId: z.string(),
});
export type AddReactionRequest = z.infer<typeof addReactionRequestSchema>;
export const addReactionResponseSchema = reactionSchema;
export type AddReactionResponse = z.infer<typeof addReactionResponseSchema>;

// DELETE /api/reactions/:id - Remove reaction
export const deleteReactionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteReactionResponse = z.infer<typeof deleteReactionResponseSchema>;

// POST /api/upload/image
export const uploadImageRequestSchema = z.object({
  image: z.instanceof(File),
});
export type UploadImageRequest = z.infer<typeof uploadImageRequestSchema>;
export const uploadImageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  url: z.string(),
  filename: z.string(),
});
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;

// POST /api/upload/video
export const uploadVideoRequestSchema = z.object({
  video: z.instanceof(File),
});
export type UploadVideoRequest = z.infer<typeof uploadVideoRequestSchema>;
export const uploadVideoResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().optional(), // Generated thumbnail
  filename: z.string(),
  duration: z.number().optional(), // Duration in seconds
});
export type UploadVideoResponse = z.infer<typeof uploadVideoResponseSchema>;

// POST /api/ai/chat - AI assistant
export const aiChatRequestSchema = z.object({
  userId: z.string(),
  userMessage: z.string(),
  chatId: z.string(),
  aiFriendId: z.string(),
});
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
export const aiChatResponseSchema = messageSchema;
export type AiChatResponse = z.infer<typeof aiChatResponseSchema>;

// POST /api/ai/smart-replies - Generate smart reply suggestions
export const smartRepliesRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  lastMessages: z.array(z.object({
    content: z.string(),
    userId: z.string().nullable(), // Nullable for AI messages
    userName: z.string(),
    isCurrentUser: z.boolean(),
  })).max(3),
});
export type SmartRepliesRequest = z.infer<typeof smartRepliesRequestSchema>;
export const smartRepliesResponseSchema = z.object({
  replies: z.array(z.string()),
});
export type SmartRepliesResponse = z.infer<typeof smartRepliesResponseSchema>;

// Group Settings schemas
export const groupSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  aiPersonality: z.string().nullable(),
  aiTone: z.string().nullable(),
  messageHistory: z.array(messageHistoryEntrySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GroupSettings = z.infer<typeof groupSettingsSchema>;

// GET /api/group-settings - Get group settings
export const getGroupSettingsResponseSchema = groupSettingsSchema;
export type GetGroupSettingsResponse = z.infer<typeof getGroupSettingsResponseSchema>;

// PATCH /api/group-settings - Update group settings
export const updateGroupSettingsRequestSchema = z.object({
  name: z.string().optional(),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  aiPersonality: z.string().nullable().optional(),
  aiTone: z.string().nullable().optional(),
});
export type UpdateGroupSettingsRequest = z.infer<typeof updateGroupSettingsRequestSchema>;
export const updateGroupSettingsResponseSchema = groupSettingsSchema;
export type UpdateGroupSettingsResponse = z.infer<typeof updateGroupSettingsResponseSchema>;

// DELETE /api/messages/clear - Clear all messages
export const clearMessagesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  deletedCount: z.number(),
});
export type ClearMessagesResponse = z.infer<typeof clearMessagesResponseSchema>;

// PATCH /api/messages/:id/description - Update message description
export const updateMessageDescriptionRequestSchema = z.object({
  imageDescription: z.string(),
});
export type UpdateMessageDescriptionRequest = z.infer<typeof updateMessageDescriptionRequestSchema>;
export const updateMessageDescriptionResponseSchema = messageSchema;
export type UpdateMessageDescriptionResponse = z.infer<typeof updateMessageDescriptionResponseSchema>;

// POST /api/ai/generate-image - Generate image with NANO-BANANA
export const generateImageRequestSchema = z.object({
  prompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  aspectRatio: z.string().optional().default("1:1"),
  referenceImageUrls: z.array(z.string()).optional(), // Optional reference images (max 2) to use as basis
  preview: z.boolean().optional().default(false),
});
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;

export const imagePreviewResponseSchema = z.object({
  imageUrl: z.string(),
  previewId: z.string(), // Unique ID for this preview session
  prompt: z.string(),
  metadata: z.any().optional(),
});
export type ImagePreviewResponse = z.infer<typeof imagePreviewResponseSchema>;

// Union type for response - either Message (if direct) or Preview
export const generateImageResponseSchema = z.union([messageSchema, imagePreviewResponseSchema]);
export type GenerateImageResponse = z.infer<typeof generateImageResponseSchema>;

// POST /api/ai/generate-meme - Generate meme with NANO-BANANA
export const generateMemeRequestSchema = z.object({
  prompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  referenceImageUrl: z.string().optional(),
  preview: z.boolean().optional().default(false),
});
export type GenerateMemeRequest = z.infer<typeof generateMemeRequestSchema>;
export const generateMemeResponseSchema = z.union([messageSchema, imagePreviewResponseSchema]);
export type GenerateMemeResponse = z.infer<typeof generateMemeResponseSchema>;

// POST /api/ai/confirm-image - Confirm and post a previewed image
export const confirmImageRequestSchema = z.object({
  imageUrl: z.string(),
  prompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  type: z.enum(["image", "meme", "remix"]),
  metadata: z.any().optional(),
});
export type ConfirmImageRequest = z.infer<typeof confirmImageRequestSchema>;
export const confirmImageResponseSchema = messageSchema;
export type ConfirmImageResponse = z.infer<typeof confirmImageResponseSchema>;

// POST /api/ai/edit-image - Edit/refine a generated image
export const editImageRequestSchema = z.object({
  originalImageUrl: z.string(),
  editPrompt: z.string(),
  userId: z.string(),
  chatId: z.string(),
  preview: z.boolean().optional().default(true),
});
export type EditImageRequest = z.infer<typeof editImageRequestSchema>;
export const editImageResponseSchema = z.union([messageSchema, imagePreviewResponseSchema]);
export type EditImageResponse = z.infer<typeof editImageResponseSchema>;

// POST /api/ai/generate-group-avatar - Generate group avatar based on messages
export const generateGroupAvatarRequestSchema = z.object({
  chatId: z.string(),
});
export type GenerateGroupAvatarRequest = z.infer<typeof generateGroupAvatarRequestSchema>;
export const generateGroupAvatarResponseSchema = z.object({
  message: z.string(),
  imageUrl: z.string().nullable(),
  prompt: z.string().optional(),
  alreadyGenerated: z.boolean(),
});
export type GenerateGroupAvatarResponse = z.infer<typeof generateGroupAvatarResponseSchema>;

// Custom Slash Command schemas
export const customSlashCommandSchema = z.object({
  id: z.string(),
  command: z.string(),
  prompt: z.string(),
  chatId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomSlashCommand = z.infer<typeof customSlashCommandSchema>;

// GET /api/custom-commands - Get all custom slash commands for a chat
export const getCustomCommandsRequestSchema = z.object({
  chatId: z.string(),
});
export type GetCustomCommandsRequest = z.infer<typeof getCustomCommandsRequestSchema>;
export const getCustomCommandsResponseSchema = z.array(customSlashCommandSchema);
export type GetCustomCommandsResponse = z.infer<typeof getCustomCommandsResponseSchema>;

// POST /api/custom-commands - Create custom slash command
export const createCustomCommandRequestSchema = z.object({
  command: z.string().min(1).max(50),
  prompt: z.string().min(1).max(1000),
  chatId: z.string(),
});
export type CreateCustomCommandRequest = z.infer<typeof createCustomCommandRequestSchema>;
export const createCustomCommandResponseSchema = customSlashCommandSchema;
export type CreateCustomCommandResponse = z.infer<typeof createCustomCommandResponseSchema>;

// PATCH /api/custom-commands/:id - Update custom slash command
export const updateCustomCommandRequestSchema = z.object({
  command: z.string().min(1).max(50).optional(),
  prompt: z.string().min(1).max(1000).optional(),
});
export type UpdateCustomCommandRequest = z.infer<typeof updateCustomCommandRequestSchema>;
export const updateCustomCommandResponseSchema = customSlashCommandSchema;
export type UpdateCustomCommandResponse = z.infer<typeof updateCustomCommandResponseSchema>;

// DELETE /api/custom-commands/:id - Delete custom slash command
export const deleteCustomCommandResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteCustomCommandResponse = z.infer<typeof deleteCustomCommandResponseSchema>;

// POST /api/custom-commands/execute - Execute custom slash command with Gemini
export const executeCustomCommandRequestSchema = z.object({
  commandId: z.string(),
  userId: z.string(),
  userMessage: z.string(),
  chatId: z.string(),
  replyToId: z.string().optional(),
  vibeType: vibeTypeSchema.nullable().optional(),
});
export type ExecuteCustomCommandRequest = z.infer<typeof executeCustomCommandRequestSchema>;
export const executeCustomCommandResponseSchema = messageSchema;
export type ExecuteCustomCommandResponse = z.infer<typeof executeCustomCommandResponseSchema>;

// Data Analysis Tool schemas (used internally by GPT-5.1 agent)
export const dataAnalysisRequestSchema = z.object({
  data: z.string(),
  format: z.enum(["csv", "json", "auto"]),
  operation: z.enum(["describe", "calculate", "filter", "transform", "summarize", "auto"]),
  options: z.object({
    columns: z.array(z.string()).optional(),
    filters: z.record(z.string(), z.any()).optional(),
    calculations: z.array(z.string()).optional(),
  }).optional(),
});
export type DataAnalysisRequest = z.infer<typeof dataAnalysisRequestSchema>;

export const dataAnalysisResultSchema = z.object({
  success: z.boolean(),
  summary: z.string(),
  details: z.object({
    rowCount: z.number().optional(),
    columnCount: z.number().optional(),
    columns: z.array(z.string()).optional(),
    statistics: z.record(z.string(), z.any()).optional(),
    filtered: z.array(z.any()).optional(),
    calculated: z.record(z.string(), z.number()).optional(),
  }).optional(),
  error: z.string().optional(),
});
export type DataAnalysisResult = z.infer<typeof dataAnalysisResultSchema>;

// Reasoning effort configuration for GPT-5.1
// "none" is required for hosted tools like web_search
export const reasoningEffortSchema = z.enum(["none", "low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;

// Tool call metadata for tracking agent behavior
export const toolCallMetadataSchema = z.object({
  name: z.string(),
  args: z.any(),
  result: z.string(),
});
export type ToolCallMetadata = z.infer<typeof toolCallMetadataSchema>;

// POST /api/link-preview/fetch - Fetch link preview metadata
export const fetchLinkPreviewRequestSchema = z.object({
  url: z.string().url(),
});
export type FetchLinkPreviewRequest = z.infer<typeof fetchLinkPreviewRequestSchema>;
export const fetchLinkPreviewResponseSchema = linkPreviewSchema;
export type FetchLinkPreviewResponse = z.infer<typeof fetchLinkPreviewResponseSchema>;

// GET /api/chats - Get all chats for a user
export const getUserChatsRequestSchema = z.object({
  userId: z.string(),
});
export type GetUserChatsRequest = z.infer<typeof getUserChatsRequestSchema>;
export const getUserChatsResponseSchema = z.array(chatWithMetadataSchema);
export type GetUserChatsResponse = z.infer<typeof getUserChatsResponseSchema>;

// POST /api/chats - Create a new chat
export const createChatRequestSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  creatorId: z.string(),
});
export type CreateChatRequest = z.infer<typeof createChatRequestSchema>;
export const createChatResponseSchema = chatSchema;
export type CreateChatResponse = z.infer<typeof createChatResponseSchema>;

// GET /api/chats/:id - Get a specific chat
export const getChatRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});
export type GetChatRequest = z.infer<typeof getChatRequestSchema>;
export const getChatResponseSchema = chatSchema.extend({
  members: z.array(chatMemberSchema.extend({ user: userSchema })),
  isCreator: z.boolean(),
});
export type GetChatResponse = z.infer<typeof getChatResponseSchema>;

// PATCH /api/chats/:id - Update chat settings (creator only)
export const updateChatRequestSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(100).optional(),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  aiPersonality: z.string().nullable().optional(),
  aiTone: z.string().nullable().optional(),
  aiName: z.string().nullable().optional(),
  aiEngagementMode: z.enum(["on-call", "percentage", "off"]).optional(),
  aiEngagementPercent: z.number().int().min(0).max(100).nullable().optional(),
});
export type UpdateChatRequest = z.infer<typeof updateChatRequestSchema>;
export const updateChatResponseSchema = chatSchema;
export type UpdateChatResponse = z.infer<typeof updateChatResponseSchema>;

// DELETE /api/chats/:id - Delete a chat (creator only)
export const deleteChatRequestSchema = z.object({
  userId: z.string(),
});
export type DeleteChatRequest = z.infer<typeof deleteChatRequestSchema>;
export const deleteChatResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteChatResponse = z.infer<typeof deleteChatResponseSchema>;

// POST /api/chats/:id/invite - Invite a user to a chat
export const inviteUserToChatRequestSchema = z.object({
  inviterId: z.string(),
  userIdToInvite: z.string(),
});
export type InviteUserToChatRequest = z.infer<typeof inviteUserToChatRequestSchema>;
export const inviteUserToChatResponseSchema = chatMemberSchema;
export type InviteUserToChatResponse = z.infer<typeof inviteUserToChatResponseSchema>;

// DELETE /api/chats/:id/members/:userId - Remove member or leave chat
export const removeChatMemberRequestSchema = z.object({
  removerId: z.string(), // The user performing the action
});
export type RemoveChatMemberRequest = z.infer<typeof removeChatMemberRequestSchema>;
export const removeChatMemberResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type RemoveChatMemberResponse = z.infer<typeof removeChatMemberResponseSchema>;

// PATCH /api/chats/:id/pin - Pin or unpin a chat
export const pinChatRequestSchema = z.object({
  userId: z.string(),
  isPinned: z.boolean(),
});
export type PinChatRequest = z.infer<typeof pinChatRequestSchema>;
export const pinChatResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type PinChatResponse = z.infer<typeof pinChatResponseSchema>;

// PATCH /api/chats/:id/mute - Mute or unmute a chat
export const muteChatRequestSchema = z.object({
  userId: z.string(),
  isMuted: z.boolean(),
});
export type MuteChatRequest = z.infer<typeof muteChatRequestSchema>;
export const muteChatResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type MuteChatResponse = z.infer<typeof muteChatResponseSchema>;

// GET /api/chats/:id/messages - Get messages for a specific chat
export const getChatMessagesRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});
export type GetChatMessagesRequest = z.infer<typeof getChatMessagesRequestSchema>;
export const getChatMessagesResponseSchema = z.array(messageSchema);
export type GetChatMessagesResponse = z.infer<typeof getChatMessagesResponseSchema>;

// POST /api/chats/:id/messages - Send a message to a specific chat
export const sendChatMessageRequestSchema = z.object({
  content: z.string().default(""),
  messageType: z.enum(["text", "image", "voice", "video"]).default("text"),
  imageUrl: z.string().optional(),
  voiceUrl: z.string().optional(),
  voiceDuration: z.number().optional(),
  userId: z.string(),
  replyToId: z.string().optional(),
  vibeType: vibeTypeSchema.nullable().optional(),
  mentionedUserIds: z.array(z.string()).optional(),
  metadata: messageMetadataSchema.optional(), // For multi-image and video data
});
export type SendChatMessageRequest = z.infer<typeof sendChatMessageRequestSchema>;
export const sendChatMessageResponseSchema = messageSchema;
export type SendChatMessageResponse = z.infer<typeof sendChatMessageResponseSchema>;

// DELETE /api/chats/:id/messages - Clear all messages in a chat (creator only)
export const clearChatMessagesRequestSchema = z.object({
  userId: z.string(),
});
export type ClearChatMessagesRequest = z.infer<typeof clearChatMessagesRequestSchema>;
export const clearChatMessagesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  deletedCount: z.number(),
});
export type ClearChatMessagesResponse = z.infer<typeof clearChatMessagesResponseSchema>;

// GET /api/users - Get all users (for inviting)
export const getAllUsersResponseSchema = z.array(userSchema);
export type GetAllUsersResponse = z.infer<typeof getAllUsersResponseSchema>;

// POST /api/chats/:id/invite-link - Generate invite link for a chat
export const generateInviteLinkRequestSchema = z.object({
  userId: z.string(),
});
export type GenerateInviteLinkRequest = z.infer<typeof generateInviteLinkRequestSchema>;
export const generateInviteLinkResponseSchema = z.object({
  inviteToken: z.string(),
  inviteLink: z.string(),
});
export type GenerateInviteLinkResponse = z.infer<typeof generateInviteLinkResponseSchema>;

// GET /api/invite/:token - Get chat info from invite token
export const getInviteInfoResponseSchema = z.object({
  chatId: z.string(),
  chatName: z.string(),
  chatImage: z.string().nullable(),
  chatBio: z.string().nullable(),
  memberCount: z.number(),
});
export type GetInviteInfoResponse = z.infer<typeof getInviteInfoResponseSchema>;

// POST /api/invite/:token/join - Join chat via invite token
export const joinChatViaInviteRequestSchema = z.object({
  userId: z.string(),
});
export type JoinChatViaInviteRequest = z.infer<typeof joinChatViaInviteRequestSchema>;
export const joinChatViaInviteResponseSchema = z.object({
  success: z.boolean(),
  chatId: z.string(),
  message: z.string(),
});
export type JoinChatViaInviteResponse = z.infer<typeof joinChatViaInviteResponseSchema>;

// POST /api/users/:id/push-token - Register push notification token
export const registerPushTokenRequestSchema = z.object({
  pushToken: z.string(),
});
export type RegisterPushTokenRequest = z.infer<typeof registerPushTokenRequestSchema>;
export const registerPushTokenResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type RegisterPushTokenResponse = z.infer<typeof registerPushTokenResponseSchema>;

// PATCH /api/users/:id/notifications - Update notification preferences
export const updateNotificationPreferencesRequestSchema = z.object({
  pushNotificationsEnabled: z.boolean(),
});
export type UpdateNotificationPreferencesRequest = z.infer<typeof updateNotificationPreferencesRequestSchema>;
export const updateNotificationPreferencesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  pushNotificationsEnabled: z.boolean(),
});
export type UpdateNotificationPreferencesResponse = z.infer<typeof updateNotificationPreferencesResponseSchema>;

// DELETE /api/users/:id - Delete user account and all associated data
export const deleteUserAccountRequestSchema = z.object({
  confirmText: z.string(), // User must type "DELETE" to confirm
  feedback: z.string().optional(), // Optional feedback about why user is leaving
});
export type DeleteUserAccountRequest = z.infer<typeof deleteUserAccountRequestSchema>;
export const deleteUserAccountResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteUserAccountResponse = z.infer<typeof deleteUserAccountResponseSchema>;

// POST /api/chats/:chatId/read-receipts - Mark messages as read
export const markMessagesAsReadRequestSchema = z.object({
  userId: z.string(),
  messageIds: z.array(z.string()),
});
export type MarkMessagesAsReadRequest = z.infer<typeof markMessagesAsReadRequestSchema>;
export const markMessagesAsReadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  markedCount: z.number(),
});
export type MarkMessagesAsReadResponse = z.infer<typeof markMessagesAsReadResponseSchema>;

// GET /api/chats/unread-counts - Get unread message counts for all user's chats
export const getUnreadCountsRequestSchema = z.object({
  userId: z.string(),
});
export type GetUnreadCountsRequest = z.infer<typeof getUnreadCountsRequestSchema>;
export const unreadCountSchema = z.object({
  chatId: z.string(),
  unreadCount: z.number(),
});
export type UnreadCount = z.infer<typeof unreadCountSchema>;
export const getUnreadCountsResponseSchema = z.array(unreadCountSchema);
export type GetUnreadCountsResponse = z.infer<typeof getUnreadCountsResponseSchema>;

// ============================================================================
// AI FRIENDS SCHEMAS
// ============================================================================

// AIFriend schema
export const aiFriendSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  name: z.string(),
  personality: z.string().nullable(),
  tone: z.string().nullable(),
  engagementMode: z.enum(["on-call", "percentage", "off"]).default("on-call"),
  engagementPercent: z.number().int().min(0).max(100).nullable(),
  color: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AIFriend = z.infer<typeof aiFriendSchema>;

// GET /api/ai-friends/:chatId - Get all AI friends for a chat
export const getAIFriendsRequestSchema = z.object({
  userId: z.string(),
});
export type GetAIFriendsRequest = z.infer<typeof getAIFriendsRequestSchema>;
export const getAIFriendsResponseSchema = z.array(aiFriendSchema);
export type GetAIFriendsResponse = z.infer<typeof getAIFriendsResponseSchema>;

// POST /api/ai-friends - Create new AI friend
export const createAIFriendRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(50).default("AI Friend"),
  personality: z.string().max(500).nullable().optional(),
  tone: z.string().nullable().optional(),
  engagementMode: z.enum(["on-call", "percentage", "off"]).default("on-call"),
  engagementPercent: z.number().int().min(0).max(100).nullable().optional(),
});
export type CreateAIFriendRequest = z.infer<typeof createAIFriendRequestSchema>;
export const createAIFriendResponseSchema = aiFriendSchema;
export type CreateAIFriendResponse = z.infer<typeof createAIFriendResponseSchema>;

// PATCH /api/ai-friends/:id - Update AI friend
export const updateAIFriendRequestSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(50).optional(),
  personality: z.string().max(500).nullable().optional(),
  tone: z.string().nullable().optional(),
  engagementMode: z.enum(["on-call", "percentage", "off"]).optional(),
  engagementPercent: z.number().int().min(0).max(100).nullable().optional(),
});
export type UpdateAIFriendRequest = z.infer<typeof updateAIFriendRequestSchema>;
export const updateAIFriendResponseSchema = aiFriendSchema;
export type UpdateAIFriendResponse = z.infer<typeof updateAIFriendResponseSchema>;

// DELETE /api/ai-friends/:id - Delete AI friend
export const deleteAIFriendRequestSchema = z.object({
  userId: z.string(),
});
export type DeleteAIFriendRequest = z.infer<typeof deleteAIFriendRequestSchema>;
export const deleteAIFriendResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteAIFriendResponse = z.infer<typeof deleteAIFriendResponseSchema>;

// PATCH /api/ai-friends/reorder - Reorder AI friends
export const reorderAIFriendsRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  items: z.array(z.object({
    aiFriendId: z.string(),
    sortOrder: z.number().int(),
  })),
});
export type ReorderAIFriendsRequest = z.infer<typeof reorderAIFriendsRequestSchema>;
export const reorderAIFriendsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ReorderAIFriendsResponse = z.infer<typeof reorderAIFriendsResponseSchema>;

// ============================================================================
// AI SUPER FEATURES SCHEMAS
// ============================================================================

// Smart Threads - MessageTag schemas
export const messageTagSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  tagType: z.enum(["topic", "entity", "person", "intent", "sentiment"]),
  tagValue: z.string(),
  confidence: z.number().min(0).max(1),
  createdAt: z.string(),
});
export type MessageTag = z.infer<typeof messageTagSchema>;

// Smart Threads - Thread schemas
export const threadFilterRulesSchema = z.object({
  topics: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  people: z.array(z.string()).optional(), // User IDs
  keywords: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
});
export type ThreadFilterRules = z.infer<typeof threadFilterRulesSchema>;

export const threadSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  creatorId: z.string(),
  isShared: z.boolean(),
  filterRules: threadFilterRulesSchema,
  memberIds: z.array(z.string()), // JSON array of user IDs
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Thread = z.infer<typeof threadSchema>;

export const threadMemberSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  userId: z.string(),
  joinedAt: z.string(),
  lastViewedAt: z.string().nullable(),
});
export type ThreadMember = z.infer<typeof threadMemberSchema>;

// Event Intelligence - Event schemas
export const eventOptionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  optionType: z.enum(["datetime", "location", "activity"]),
  optionValue: z.string(),
  votes: z.number().default(0),
  createdAt: z.string(),
});
export type EventOption = z.infer<typeof eventOptionSchema>;

export const eventResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  optionId: z.string().nullable(),
  responseType: z.enum(["yes", "no", "maybe"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventResponse = z.infer<typeof eventResponseSchema>;

export const eventSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  eventType: z.enum(["meeting", "hangout", "meal", "activity", "other"]),
  status: z.enum(["proposed", "voting", "confirmed", "cancelled"]),
  eventDate: z.string().nullable(), // The actual date/time when the event will happen
  finalizedDate: z.string().nullable(),
  creatorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  options: z.array(eventOptionSchema).optional(),
  responses: z.array(eventResponseSchema).optional(),
});
export type Event = z.infer<typeof eventSchema>;

// Content Reactor - MediaReaction schemas
export const mediaReactionMetadataSchema = z.object({
  originalMessageId: z.string(),
  reactionType: z.enum(["caption", "remix", "meme", "summary"]),
  prompt: z.string().optional(),
  model: z.string().optional(),
});
export type MediaReactionMetadata = z.infer<typeof mediaReactionMetadataSchema>;

export const mediaReactionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  reactionType: z.enum(["caption", "remix", "meme", "summary"]),
  resultUrl: z.string().nullable(),
  resultText: z.string().nullable(),
  metadata: mediaReactionMetadataSchema,
  createdAt: z.string(),
});
export type MediaReaction = z.infer<typeof mediaReactionSchema>;

// Smart Catch-Up - ConversationSummary schemas
export const conversationSummaryContentSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).optional(),
  highlights: z.array(z.object({
    messageId: z.string(),
    reason: z.string(),
  })).optional(),
  topics: z.array(z.string()).optional(),
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]).optional(),
});
export type ConversationSummaryContent = z.infer<typeof conversationSummaryContentSchema>;

export const conversationSummarySchema = z.object({
  id: z.string(),
  chatId: z.string(),
  userId: z.string(),
  summaryType: z.enum(["concise", "detailed"]),
  content: conversationSummaryContentSchema,
  startMessageId: z.string(),
  endMessageId: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

// ============================================================================
// AI SUPER FEATURES API ENDPOINTS
// ============================================================================

// Smart Threads APIs
// POST /api/threads - Create a new smart thread
export const createThreadRequestSchema = z.object({
  chatId: z.string(),
  creatorId: z.string(),
  name: z.string().min(1).max(100),
  icon: z.string().nullable().optional(),
  isShared: z.boolean().default(false),
  filterRules: threadFilterRulesSchema,
});
export type CreateThreadRequest = z.infer<typeof createThreadRequestSchema>;
export const createThreadResponseSchema = threadSchema;
export type CreateThreadResponse = z.infer<typeof createThreadResponseSchema>;

// GET /api/threads/:chatId - Get all threads for a chat
export const getThreadsRequestSchema = z.object({
  userId: z.string(),
});
export type GetThreadsRequest = z.infer<typeof getThreadsRequestSchema>;
export const getThreadsResponseSchema = z.array(threadSchema);
export type GetThreadsResponse = z.infer<typeof getThreadsResponseSchema>;

// GET /api/threads/:threadId/messages - Get messages matching thread filter
export const getThreadMessagesRequestSchema = z.object({
  userId: z.string(),
});
export type GetThreadMessagesRequest = z.infer<typeof getThreadMessagesRequestSchema>;
export const getThreadMessagesResponseSchema = z.array(messageSchema);
export type GetThreadMessagesResponse = z.infer<typeof getThreadMessagesResponseSchema>;

// PATCH /api/threads/:threadId - Update thread
export const updateThreadRequestSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(100).optional(),
  icon: z.string().nullable().optional(),
  isShared: z.boolean().optional(),
  filterRules: threadFilterRulesSchema.optional(),
  memberIds: z.array(z.string()).optional(),
});
export type UpdateThreadRequest = z.infer<typeof updateThreadRequestSchema>;
export const updateThreadResponseSchema = threadSchema;
export type UpdateThreadResponse = z.infer<typeof updateThreadResponseSchema>;

// DELETE /api/threads/:threadId - Delete thread
export const deleteThreadRequestSchema = z.object({
  userId: z.string(),
});
export type DeleteThreadRequest = z.infer<typeof deleteThreadRequestSchema>;
export const deleteThreadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteThreadResponse = z.infer<typeof deleteThreadResponseSchema>;

// PATCH /api/threads/reorder - Reorder threads for a user
export const reorderThreadsRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  items: z.array(z.object({
    threadId: z.string(),
    sortOrder: z.number().int(),
  })),
});
export type ReorderThreadsRequest = z.infer<typeof reorderThreadsRequestSchema>;
export const reorderThreadsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ReorderThreadsResponse = z.infer<typeof reorderThreadsResponseSchema>;

// Event Intelligence APIs
// POST /api/events - Create event
export const createEventRequestSchema = z.object({
  chatId: z.string(),
  creatorId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  eventType: z.enum(["meeting", "hangout", "meal", "activity", "other"]),
  eventDate: z.string().nullable().optional(), // ISO date string for when the event will happen
  options: z.array(z.object({
    optionType: z.enum(["datetime", "location", "activity"]),
    optionValue: z.string(),
  })).optional(), // Options are now fully optional - events can be created without voting
});
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;
export const createEventResponseSchema = eventSchema;
export type CreateEventResponse = z.infer<typeof createEventResponseSchema>;

// GET /api/events/:chatId - Get all events for a chat
export const getEventsRequestSchema = z.object({
  userId: z.string(),
});
export type GetEventsRequest = z.infer<typeof getEventsRequestSchema>;
export const getEventsResponseSchema = z.array(eventSchema);
export type GetEventsResponse = z.infer<typeof getEventsResponseSchema>;

// POST /api/events/:eventId/vote - Vote on event option
export const voteEventOptionRequestSchema = z.object({
  userId: z.string(),
  optionId: z.string(),
});
export type VoteEventOptionRequest = z.infer<typeof voteEventOptionRequestSchema>;
export const voteEventOptionResponseSchema = eventOptionSchema;
export type VoteEventOptionResponse = z.infer<typeof voteEventOptionResponseSchema>;

// POST /api/events/:eventId/rsvp - RSVP to event
export const rsvpEventRequestSchema = z.object({
  userId: z.string(),
  responseType: z.enum(["yes", "no", "maybe"]),
  optionId: z.string().nullable().optional(),
});
export type RsvpEventRequest = z.infer<typeof rsvpEventRequestSchema>;
export const rsvpEventResponseSchema = eventResponseSchema;
export type RsvpEventResponse = z.infer<typeof rsvpEventResponseSchema>;

// PATCH /api/events/:eventId - Update event
export const updateEventRequestSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  status: z.enum(["proposed", "voting", "confirmed", "cancelled"]).optional(),
  finalizedDate: z.string().nullable().optional(),
});
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;
export const updateEventResponseSchema = eventSchema;
export type UpdateEventResponse = z.infer<typeof updateEventResponseSchema>;

// GET /api/events/:eventId/export - Export event to calendar
export const exportEventRequestSchema = z.object({
  userId: z.string(),
  format: z.enum(["ics", "google", "outlook"]).default("ics"),
});
export type ExportEventRequest = z.infer<typeof exportEventRequestSchema>;
export const exportEventResponseSchema = z.object({
  success: z.boolean(),
  downloadUrl: z.string().optional(),
  icsContent: z.string().optional(),
});
export type ExportEventResponse = z.infer<typeof exportEventResponseSchema>;

// DELETE /api/events/:eventId - Delete event
export const deleteEventRequestSchema = z.object({
  userId: z.string(),
});
export type DeleteEventRequest = z.infer<typeof deleteEventRequestSchema>;
export const deleteEventResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteEventResponse = z.infer<typeof deleteEventResponseSchema>;

// Content Reactor APIs
// POST /api/reactor/caption - Generate AI caption for media
export const generateCaptionRequestSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
  chatId: z.string(),
});
export type GenerateCaptionRequest = z.infer<typeof generateCaptionRequestSchema>;
export const generateCaptionResponseSchema = mediaReactionSchema;
export type GenerateCaptionResponse = z.infer<typeof generateCaptionResponseSchema>;

// POST /api/reactor/remix - Remix media with AI
export const remixMediaRequestSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
  chatId: z.string(),
  remixPrompt: z.string(),
  preview: z.boolean().optional().default(false),
});
export type RemixMediaRequest = z.infer<typeof remixMediaRequestSchema>;
export const remixMediaResponseSchema = z.union([messageSchema, imagePreviewResponseSchema]);
export type RemixMediaResponse = z.infer<typeof remixMediaResponseSchema>;

// POST /api/reactor/meme-from-media - Create meme from media
export const createMemeFromMediaRequestSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
  chatId: z.string(),
  memePrompt: z.string().optional(), // User's guidance on what the meme should say/be about
  preview: z.boolean().optional().default(false),
});
export type CreateMemeFromMediaRequest = z.infer<typeof createMemeFromMediaRequestSchema>;
export const createMemeFromMediaResponseSchema = z.union([messageSchema, imagePreviewResponseSchema]);
export type CreateMemeFromMediaResponse = z.infer<typeof createMemeFromMediaResponseSchema>;

// Smart Catch-Up APIs
// POST /api/catchup/generate - Generate catch-up summary
export const generateCatchUpRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  summaryType: z.enum(["concise", "detailed"]).default("concise"),
  sinceMessageId: z.string().optional(), // If provided, summarize from this message onwards
});
export type GenerateCatchUpRequest = z.infer<typeof generateCatchUpRequestSchema>;
export const generateCatchUpResponseSchema = conversationSummarySchema;
export type GenerateCatchUpResponse = z.infer<typeof generateCatchUpResponseSchema>;

// GET /api/catchup/:chatId - Get cached catch-up summary
export const getCatchUpRequestSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});
export type GetCatchUpRequest = z.infer<typeof getCatchUpRequestSchema>;
export const getCatchUpResponseSchema = conversationSummarySchema.nullable();
export type GetCatchUpResponse = z.infer<typeof getCatchUpResponseSchema>;

// ============================================================================
// POLL FEATURE SCHEMAS
// ============================================================================

// Poll Option schema
export const pollOptionSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  optionText: z.string(),
  sortOrder: z.number().int(),
  voteCount: z.number().int().default(0),
  createdAt: z.string(),
});
export type PollOption = z.infer<typeof pollOptionSchema>;

// Poll Vote schema
export const pollVoteSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  optionId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
});
export type PollVote = z.infer<typeof pollVoteSchema>;

// Poll schema
export const pollSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  creatorId: z.string(),
  question: z.string(),
  status: z.enum(["open", "closed"]),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  options: z.array(pollOptionSchema).optional(),
  votes: z.array(pollVoteSchema).optional(),
  totalVotes: z.number().int().optional(),
  memberCount: z.number().int().optional(), // Total members in chat for calculating if all voted
});
export type Poll = z.infer<typeof pollSchema>;

// POST /api/polls - Create poll
export const createPollRequestSchema = z.object({
  chatId: z.string(),
  creatorId: z.string(),
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(4),
});
export type CreatePollRequest = z.infer<typeof createPollRequestSchema>;
export const createPollResponseSchema = pollSchema;
export type CreatePollResponse = z.infer<typeof createPollResponseSchema>;

// GET /api/polls/:chatId - Get all polls for a chat
export const getPollsRequestSchema = z.object({
  userId: z.string(),
});
export type GetPollsRequest = z.infer<typeof getPollsRequestSchema>;
export const getPollsResponseSchema = z.array(pollSchema);
export type GetPollsResponse = z.infer<typeof getPollsResponseSchema>;

// GET /api/polls/:chatId/:pollId - Get a specific poll
export const getPollRequestSchema = z.object({
  userId: z.string(),
});
export type GetPollRequest = z.infer<typeof getPollRequestSchema>;
export const getPollResponseSchema = pollSchema;
export type GetPollResponse = z.infer<typeof getPollResponseSchema>;

// POST /api/polls/:pollId/vote - Vote on a poll
export const votePollRequestSchema = z.object({
  userId: z.string(),
  optionId: z.string(),
});
export type VotePollRequest = z.infer<typeof votePollRequestSchema>;
export const votePollResponseSchema = z.object({
  success: z.boolean(),
  vote: pollVoteSchema,
  poll: pollSchema,
  allVoted: z.boolean(), // True if all chat members have voted
});
export type VotePollResponse = z.infer<typeof votePollResponseSchema>;

// DELETE /api/polls/:pollId - Delete poll (creator only)
export const deletePollRequestSchema = z.object({
  userId: z.string(),
});
export type DeletePollRequest = z.infer<typeof deletePollRequestSchema>;
export const deletePollResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeletePollResponse = z.infer<typeof deletePollResponseSchema>;

// PATCH /api/polls/:pollId/close - Close poll manually
export const closePollRequestSchema = z.object({
  userId: z.string(),
});
export type ClosePollRequest = z.infer<typeof closePollRequestSchema>;
export const closePollResponseSchema = pollSchema;
export type ClosePollResponse = z.infer<typeof closePollResponseSchema>;
