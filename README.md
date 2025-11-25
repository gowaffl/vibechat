# VibeChat

A beautiful real-time group chat application built with Expo and React Native where everyone who uses it automatically joins the same global chat room.

**Making group chats great again. Reinventing group chats. Your friend group chats with custom ChatGPT in them.**

## Recent Fixes

- **Fixed Thread Creation Icon Validation** (2025-11-19):
  - Fixed Prisma validation error when icon is null during thread creation
  - Backend now omits icon field when null, allowing Prisma to use default value (💬)
  - Threads now create successfully regardless of icon value

- **Fixed Thread Creation Error** (2025-11-19):
  - Fixed Prisma validation error when creating smart threads
  - Updated thread creation to use proper Prisma relation syntax with `connect`
  - Fixed TypeScript errors in EventCard and ChatScreen components
  - Threads now create successfully with proper chat relation

- **Enhanced Event Card Functionality** (2025-11-19):
  - Added Edit button for event creators (blue icon)
  - Added Finalize button for event creators (green lock icon)
  - Removed "LEADING" badges for cleaner, less cluttered design
  - Confirmed events now have special green glowing border
  - Enhanced "Add to Calendar" section with finalized event banner
  - New gradient green download button for calendar export
  - Edit and finalize buttons only show for non-confirmed events
  - Finalize confirmation dialog with clear messaging
  - Event creator controls: Edit, Finalize, and Delete

- **Fixed cache issue with event cards** (2025-11-19):
  - Cleared Metro bundler cache to resolve hot reload issues
  - Fixed reference to removed `getTypeEmoji()` function
  - Event cards now properly display icon-based design

- **Minimal & Clean Event Card Design** (2025-11-19):
  - Removed all emojis for clean, professional aesthetic
  - Replaced with lucide-react-native icons throughout
  - Status badges now use proper icons (Zap, Vote, CheckCircle2, XCircle)
  - Event type icons in circular containers (Briefcase, PartyPopper, UtensilsCrossed, Dumbbell)
  - RSVP buttons with icon-based design (Check, HelpCircle, X)
  - Minimal, elegant UI inspired by Apple's design language
  - Reduced visual clutter while maintaining premium feel

- **Premium Event Card Redesign** (2025-11-19):
  - Complete visual overhaul with Apple/OpenAI/Tesla-inspired design language
  - Liquid glass effects with blur and gradient layers
  - Smooth spring animations for expand/collapse with rotating chevron
  - Gradient status badges with glow effects
  - Enhanced voting options with blur effects and gradient overlays when selected
  - "LEADING" badges for winning options
  - Premium RSVP section with gradient buttons
  - Beautiful delete confirmation dialog with blur and gradient effects
  - Icon-labeled sections (Calendar, MapPin, Sparkles, Users)
  - Improved typography with letter spacing and SF Pro-like font weights
  - Enhanced shadows, borders, and touch feedback
  - Scale animations on press for tactile feel

- **Fixed event date display** (2025-11-19):
  - Event notification cards now show the plain text date/time entered by the user
  - Removed invalid date parsing that was showing "Invalid Date"
  - Displays exactly what the user typed (e.g., "Tomorrow 7pm", "Next Friday", etc.)

- **Fixed event voting and RSVP functionality** (2025-11-19):
  - Fixed critical backend bug where vote counts weren't updating (`votes` → `voteCount`)
  - Voting now properly registers, counts, and displays vote tallies
  - RSVP buttons now work correctly (Going, Maybe, Can't Go)
  - All options already display as pill-shaped buttons with proper styling
  - Fixed status mapping issue ("planning" → "proposed")
  - Fixed linting error in EventNotificationCard

- **Fixed catch-up summary error handling** (2025-11-19):
  - Added user-friendly error alerts when summary generation fails
  - Improved backend error messages with more detailed information
  - Better handling of "no messages to summarize" case
  - Error details are now properly parsed and displayed to the user

- **Fixed null reference error in CatchUpModal** (2025-11-19):
  - Added null safety checks for `summary` and `content` properties
  - Prevents crash when modal is opened without a summary loaded
  - Component now properly handles loading and null states

- **Fixed TypeScript error in EventCard** (2025-11-19):
  - Removed invalid "finalized" status check (not in event status enum)
  - Export button now only shows for "confirmed" events

## Branding

- **App Name**: VibeChat
- **App Icon**: Custom gradient icon (image-1762790557.jpeg) featuring a vibrant blue-to-pink "V" inside a speech bubble
- **AI Friend Avatar**: Uses the same VibeChat icon (image-1762790557.jpeg) for consistent branding throughout the app
  - Displayed on all AI messages
  - Shown during AI typing indicator
  - Ensures instant visual recognition of AI responses
- **Color Scheme**: Purple-to-blue gradients with dark theme and glass morphism design

## Features

- **iMessage-Style Chat Header** 📱:
  - Custom header component with full control over height and styling
  - Liquid glass header background (95px + safe area) with perfect spacing
  - Group avatar/image displayed above group name (iOS iMessage style)
  - Avatar shown in circular thumbnail (40x40px) with proper spacing
  - Blur effect background with purple-to-blue gradient overlay
  - All header elements (avatar, name, and buttons) fully contained within glass background
  - Settings button (left) and Profile button (right) for navigation
  - Tap avatar to view full-screen group image
  - Perfect visual balance with no overflow issues
  - Fallback icon when no group image is set
  - Dynamically updates when group settings change
  - **Chat always scrolls to bottom on open**: When you open or enter a chat, it automatically scrolls to the very bottom showing the most recent messages
  - **AI-Generated Group Avatars**: Generate unique group avatars based on conversation content
    - Uses NANO-BANANA (Gemini 2.5 Flash Image) to create unique avatars
    - Analyzes the last 100 messages to determine main topic, theme, and sentiment
    - Creates a cohesive avatar representing the conversation's essence
    - If no messages exist, generates based on group name and bio
    - Manual generation via sparkle button on avatar in Group Settings
    - Limited to once per day (resets at midnight Eastern time)
    - Never generates automatically - user must click the button
- **Image Sharing** 📸:
  - Send images in chat with optional captions
  - Pick images from gallery (no editing screen)
  - **Automatic Image Optimization**: Images are resized and compressed before upload
    - Max dimension: 1920px (maintains quality on most screens)
    - Compression: 80% quality JPEG
    - Converts all formats to JPEG for smaller file sizes
    - Target: Keep images under 2MB for fast loading
  - Placeholder loading while images are being uploaded
  - Full-screen image viewer with tap to expand
  - **Save & Share**: Download images to your library or share them
    - Save button downloads image to device photo library
    - Share button opens native share sheet
    - Both accessible from full-screen image viewer
  - Native swipe-to-close gesture
  - Images maintain the same glassy design language
  - Sender info and timestamp displayed in viewer
  - **AI-Generated Descriptions**: Images are automatically analyzed by GPT-5 mini to generate detailed descriptions
    - Descriptions include objects, colors, text, people, setting, and mood
    - Generated asynchronously in background (non-blocking)
    - Uses base64 encoding for reliable transmission
    - Stored in database for AI friend to reference
    - AI can "understand" image content through descriptions
- **Message Reactions** 👍:
  - **iMessage-style emoji reactions**: React to any message with emojis
  - Long-press any message to open context menu
  - Choose from 6 quick reactions: ❤️ 👍 👎 😂 😮 ❓
  - Reactions displayed below messages with counts
  - Tap reaction to add/remove (toggle)
  - **Long-press reaction to see who reacted**: View all users who sent a specific reaction with their names and profile pictures in a modal
  - Multiple users can react with the same emoji
  - Your reactions highlighted in blue
  - Real-time reaction updates across all users
  - Reactions properly saved to database with full user information
  - **System messages**: Join messages automatically appear when a new user enters the chat (e.g., "[user name] has joined the chat")
- **Message Replies** 💬:
  - **Thread-style replies**: Reply to specific messages
  - Long-press any message and select "Reply"
  - Reply preview shows above input field
  - Original message quoted in reply with sender name
  - Visual thread indicator with colored line
  - Tap X to cancel reply
  - Works with both text and image messages
  - **Reply context for slash commands**: When replying to a message and using a slash command, the AI receives the replied-to message as direct context
  - Maintains conversation context
- **Message Bookmarks** 🔖:
  - **Save important messages**: Bookmark any message for quick access later
  - Long-press any message and select "Bookmark"
  - Toggle bookmarks on/off with a single tap
  - Bookmarks are stored per-user and per-chat
  - Access bookmarked messages from chat screen (feature in development)
  - Works with both text and image messages
  - Real-time bookmark syncing across devices
- **Link Previews** 🔗:
  - **iMessage-style rich link previews**: Share links and see beautiful preview cards
  - Automatic URL detection in messages
  - Fetches Open Graph and Twitter Card metadata
  - Displays preview image, title, description, site name, and favicon
  - Tap preview card to open link in browser
  - **Clean, minimal display**: When a message contains only a URL, the link preview card is shown without the text URL above it for a cleaner look
  - If a message has additional text with the URL, both the text and preview card are displayed
  - Seamless integration with chat bubble design
  - Works with any website that provides metadata
  - Link previews load asynchronously without blocking message sending
  - Same glassy design language as the rest of the app
- **AI Friend Integration** 🤖:
  - Mention @ai **anywhere** in your message to interact with OpenAI GPT-5
  - Works at the start, middle, or end of your message
  - AI has access to the last 100 messages from the database for context
  - **Markdown Formatting**: All AI responses are rendered with full markdown support
    - Bold, italic, headings, lists, code blocks, blockquotes, and links
    - Syntax highlighting for code with monospace font
    - Properly formatted structured responses
    - No raw markdown symbols (**, *, etc.) shown
  - **AI can see**: Who's in the chat, conversation history with timestamps, all sender names, group name, group bio, and **image descriptions**
  - **AI understands images**: Trained to interpret and discuss images through detailed AI-generated descriptions
    - AI processes image descriptions naturally without claiming it "can't see"
    - Can answer questions about image content, provide insights, and make observations
    - Engages with visual content as if viewing the images directly
  - **Multi-Tool AI System**: AI has access to both web search and image generation tools
    - **Web Search**: Can search the web for real-time information using web_search_preview
    - **Image Generation**: Can generate images when requested using OpenAI's image_generation tool
    - AI intelligently chooses which tool(s) to use based on your request
    - Both tools available in the same conversation
  - **Customizable Personality**: Adjust the AI friend's behavior via Group Settings
    - **Custom AI Name**: Give your AI friend a personalized name
      - Default name is "AI Friend" but can be changed to anything (e.g., "Jarvis", "Buddy", "Alex")
      - Name appears above all AI messages in the chat
      - Shown during typing indicator as well
      - **AI is aware of its name**: The custom name is included in the AI's system prompt, so it knows what it's called and can refer to itself by name if needed
      - Makes the AI feel more like another friend in the chat
      - Per-chat setting - different chats can have different AI names
    - **Custom Instructions**: Write detailed personality guidelines (up to 500 characters)
      - Define how the AI should behave, speak, and respond
      - Examples: "You are a helpful tech enthusiast", "Act like a wise mentor", etc.
    - **Quick Tone Selection**: Choose from 8 preset tones with one tap
      - Professional, Casual, Friendly, Humorous, Sarcastic, Formal, Enthusiastic, Calm
      - Selected tone is highlighted and instantly applied
      - Click again to deselect
    - **AI Friend Engagement Settings**: Control how often the AI automatically joins conversations
      - **Three Engagement Modes**:
        - **On-Call Only** (default): AI only responds when explicitly mentioned with @ai
        - **Automatic Engagement**: AI joins conversations naturally based on a percentage (0-100%)
          - **Draggable slider** with smooth gesture control for precise percentage selection (1-100%)
          - Quick-set buttons for common values (0%, 25%, 50%, 75%, 100%)
          - Visual feedback showing engagement frequency level
          - Haptic feedback while dragging and when releasing
          - Thumb size increases during drag for better visual feedback
          - @ai mentions still work regardless of percentage setting
        - **Off**: AI friend is completely disabled
      - **Smart Engagement Logic**:
        - Polls for new messages every 5 seconds in chats with engagement enabled
        - Uses probabilistic logic based on the configured percentage
        - **STRICT: @ai mentions are NOT counted towards auto-engagement** - prevents double responses
        - **STRICT: Never allows back-to-back AI messages** - last message check enforced on all endpoints
        - **30-second cooldown between AI responses** to prevent spam
        - Never responds to its own messages or system messages
        - Only processes messages from human users
        - **Auto-engagement skips @ai mentions entirely** - those are handled by the frontend's direct call
        - **Two-layer protection**: Both the auto-engagement service AND the /api/ai/chat endpoint validate no back-to-back messages
      - **Natural Conversation AI**:
        - **GPT-5 optimized prompting** following OpenAI best practices for natural engagement
        - **Context-aware responses**: Prioritizes last 2-3 messages while maintaining recall of earlier conversation
        - **Conversational style**: Uses casual language, natural connectors ("oh yeah," "hmm," "totally"), and matches group energy
        - **Smart participation**: AI evaluates whether to contribute based on conversation flow
        - **Time-aware context**: Messages shown with relative timing ("just now," "a few minutes ago")
        - **Personality integration**: Custom personality and tone settings naturally influence responses
        - **Concise by default**: 1-2 sentences typical (like texting a friend), longer only when detail is clearly needed
        - **Authentic reactions**: Shows personality, uses contractions, admits uncertainty when appropriate
        - **Consistency**: Remembers and builds on its previous messages in the conversation
      - **Background Service**: Automatic engagement runs continuously in the background
      - Creator-only setting - only the chat creator can adjust engagement settings
      - Per-chat configuration - each chat can have its own engagement level
    - **Per-Chat Personality Settings**: Each group chat can have its own unique AI personality
      - Settings are stored separately for each chat
      - Changes are saved automatically when you edit personality or tone
      - AI personality persists when you leave and return to the chat
      - Different chats can have completely different AI behaviors
    - **Custom Slash Commands**: Create unlimited custom AI commands
      - Access via "Custom Slash Commands" section in Group Settings
      - Add button (+) to create new commands
      - Each command requires:
        - Command name (e.g., /roast, /factcheck)
        - AI prompt (up to 1000 characters) that defines behavior
      - Edit or delete existing commands with inline controls
      - Commands powered by OpenAI GPT-4o-mini with full conversation context
      - **Multi-Tool Support**: Custom commands have access to both web search and image generation
        - **Web Search Tool**: AI can search the web when command instructions require research, fact-checking, or current information (via Google Custom Search API)
        - **Image Generation Tool (DALL-E 3)**: AI can generate images when command instructions require visual content, memes, diagrams, or artwork using OpenAI's DALL-E 3
        - AI pays close attention to command instructions to determine which tool(s) to use
        - Both tools can be used together in the same command if needed
      - **Reply context support**: When replying to a message and using a custom slash command, the AI receives the replied-to message as direct context highlighted in the prompt
      - **Markdown support**: All custom command responses are rendered with full markdown formatting
      - Examples of custom commands users can create:
        - `/roast` - Make the AI roast messages or users humorously
        - `/factcheck` - Verify claims with web search and sources
        - `/translate` - Translate to any language with cultural notes
        - `/eli5` - Explain complex topics in simple terms
        - `/summarize` - Summarize long conversations or messages
        - `/visualize` - Create a visual representation of concepts or ideas
        - `/motivate` - Generate an inspirational image with motivational message
    - Personality settings affect all AI responses in the group
  - **AI-Powered Image Generation**: Generate images and memes using slash commands
    - **/image [prompt]**: Generate custom images with NANO-BANANA (Gemini 2.5 Flash Image)
      - Example: "/image a sunset over mountains"
      - Generation takes ~30 seconds
      - Creates high-quality images based on your text prompt
      - Supports various aspect ratios (default 1:1)
      - Images display with the prompt as a caption below, matching the format of uploaded images
      - **Content filtering**: Some prompts may be declined by the model (finishReason: NO_IMAGE) - try simpler or different prompts
    - **/meme [prompt]**: Generate funny meme images with text overlays
      - Example: "/meme when the code works on the first try"
      - Automatically creates internet-style memes with impact font text
      - Perfect for adding humor to group chats
      - Images display with the prompt as a caption below, matching the format of uploaded images
      - **Content filtering**: Religious, political, or sensitive content may be rejected - try general humor instead
    - **Custom Slash Commands**: Create your own AI-powered commands
      - Define custom commands like /roast, /factcheck, /translate, etc.
      - Each command can have a custom prompt that guides GPT-4o-mini's behavior
      - Powered by GPT-4o-mini with full conversation context
      - **Tool Capabilities**: Commands can automatically use tools based on the prompt:
        - **Web Search**: AI can search the web for current information, news, and facts (via Google Custom Search API)
        - **Image Generation**: AI can generate images using OpenAI's DALL-E 3 when requested
        - Tools are invoked intelligently based on command instructions and user input
        - Example: A `/visualize` command can both describe concepts and generate images with DALL-E 3
      - Manage commands in Group Settings under "Custom Slash Commands"
      - Commands are shared across all group members
      - Examples:
        - `/roast [message]` - "Roast the user's message in a funny, playful way"
        - `/factcheck [claim]` - "Fact check the claim using web search and provide sources"
        - `/translate [text]` - "Translate to Spanish and explain the cultural context"
        - `/visualize [concept]` - "Explain the concept and generate an image to visualize it with DALL-E 3"
    - Generated images and responses appear as AI messages in the chat
    - Typing indicator shown during generation
  - AI responses appear with green gradient and robot emoji
  - Powered by Vibecode's OpenAI proxy (works out of the box, no API key needed)
  - **Performance optimized**: Uses low reasoning effort for faster responses
  - **Uses OpenAI Responses API**: Modern API with structured output and tool support
  - **Smart Input Formatting**: When your message contains @ai, the input box changes to:
    - Green border (matching AI message color)
    - Light green background
    - Bold green text
    - Send button changes to green gradient
  - **Rich Markdown Rendering**: AI messages display fully formatted text
    - Headings (H1-H6) with proper sizing and weight
    - Bold and italic text for emphasis
    - Code blocks with dark background and monospace font
    - Inline code with green highlighting
    - Bulleted and numbered lists
    - Blockquotes with left border accent
    - Links with green color and underline
    - Horizontal rules for section separation
  - **Non-blocking UX**:
    - Send button stays enabled while AI processes responses
    - Typing indicator shows AI is working (animated dots in green bubble)
    - Users can continue sending messages while AI responds
    - No locked interface during AI processing
- **Smart Notifications System** 🔔:
  - **Unread Message Badges**: Visual indicators showing unread message counts per chat
    - Red badge with count displayed on chat avatar in Chat List
    - Bold text and highlighted timestamp for chats with unread messages
    - Automatically updates in real-time as messages arrive
    - Badge shows "99+" for counts over 99
  - **Native Push Notifications**: Get notified even when app is closed
    - Automatic registration for push notifications after onboarding
    - Notifications show chat name, sender name, and message preview
    - Tap notification to open directly to the chat
    - Only works on physical devices (not simulators)
    - Uses Expo Push Notification service
  - **Smart Read Receipts**: Messages automatically marked as read when viewing chat
    - Tracks which messages each user has seen
    - Real-time updates to unread counts
    - No manual "mark as read" required
  - **Notification Preferences**: Full control over notification settings
    - Toggle push notifications on/off in Profile screen
    - Settings saved per user
    - Clean, minimal UI with toggle switch
  - **Intelligent Notification Logic**:
    - Only notifies users who aren't currently viewing the chat
    - No notifications for your own messages
    - No notifications for system messages
    - Respects user's notification preferences
- **Group Settings** ⚙️:
  - Customizable group name (tap to edit)
    - **Dynamic header update**: Chat screen header automatically updates when group name changes
    - Group name fetched reactively from the database
  - Optional group bio/description
  - Group profile photo (camera or gallery)
    - **Tap photo to view full-screen**: Click on the group avatar image in settings to see it in full-screen mode with group name displayed at the bottom
  - **AI-Generated Group Avatar**:
    - Generate unique avatars based on conversation themes using NANO-BANANA
    - Manual generation button in Group Settings
    - Automatically generates daily at midnight
    - Avatar reflects the mood and content of recent conversations
    - Falls back to group name/bio when no messages exist
  - **AI Friend Personality Settings**:
    - Customize how the AI behaves in your specific group chat
    - **Custom AI Name**: Give your AI friend a personalized name (e.g., "Jarvis", "Buddy", "Alex")
      - Default is "AI Friend"
      - Name appears above all AI messages and during typing indicator
      - AI is aware of its name and can refer to itself by name if needed
      - Makes the AI feel more personal and like another friend in the chat
    - Text input for detailed custom instructions (500 char limit)
    - 8 quick tone chips for instant personality changes
    - Settings automatically saved per-chat when edited
    - Settings persist when you leave and return to the chat
    - Beautiful green-themed UI to match AI friend branding
    - Collapsible section for clean, minimal interface
  - **Custom Slash Commands Management**:
    - Create, edit, and delete custom AI commands
    - Orange-themed UI section with lightning bolt icon
    - Inline forms for adding and editing commands
    - Command list with edit/delete controls
    - Real-time validation and error handling
    - Commands synced across all group members
  - **Invite System** 🔗:
    - **Manual Invite Codes**: Share simple 8-character codes to invite users
    - Generate unique invite codes in Group Settings
    - Large, prominent code display for easy sharing
    - One-tap copy code button
    - Native share sheet with formatted invite message
    - **Join Chat button** on Chat List screen for entering invite codes
    - Users can join any chat by entering the invite code
    - Works perfectly in Vibecode sandbox environment
    - No URL/link dependency - just share the code!
    - Perfect for viral growth and inviting friends
    - **Auto-Expiring Codes**: Invite codes automatically expire after 24 hours
      - Codes regenerate fresh when expired users try to share
      - Daily rotation prevents stale/old codes from being used
      - Ensures security and relevance of shared invites
  - **Members Management** 👥:
    - View all group members with their profile pictures, names, and bios
    - Profile images correctly display using backend URLs
    - Invite new members via shareable invite link with QR code
    - **Remove Members** (Creator Only):
      - Chat creators can remove any member except themselves
      - Red X button appears next to each removable member
      - Confirmation dialog before removal
      - Automatic member list refresh after removal
      - Only visible to the chat creator
  - **Clear conversation** - Delete all messages with confirmation
  - Settings accessible from header icon
- **Smart Threads** 🧵 (AI-Powered Message Filtering):
  - **Create Custom Threads**: Filter messages by topics, entities, people, keywords, dates, and sentiment
  - **AI Auto-Tagging**: Every message is automatically tagged with:
    - **Topics**: Main themes and semantically related concepts (e.g., "Theology" captures "Baptism", "Christianity", "Church", "Covenant")
    - **Entities**: Named people, places, organizations mentioned
    - **Sentiment**: Positive, negative, or neutral tone
  - **Intelligent Matching**: Partial, case-insensitive matching finds related content
    - Search for "tech" to find "Technology", "Technical Discussion", "Tech Industry"
    - Search for "theology" to find "Christian Theology", "Reformed Theology", "Theological Debate"
  - **Thread Management**:
    - Create unlimited threads per chat
    - Name and customize each thread with icons
    - Share threads with other chat members or keep private
    - Edit and delete your own threads
  - **Seamless Switching**: Toggle between main chat and threads instantly
  - **Visual Indicators**: Thread selector shows current view (main chat vs. specific thread)
  - **Auto-Tagging**:
    - All new messages automatically tagged in real-time
    - Both user and AI messages are tagged
    - Uses Claude Haiku for fast, accurate semantic analysis
    - Backfill script available to tag existing messages: `bun run src/scripts/backfill-tags.ts`
  - **Filter Options**:
    - **Topics**: Broad themes with semantic matching (e.g., "Christianity", "Technology", "Politics")
    - **Entities**: Specific people, places, or things mentioned
    - **Keywords**: Search message content directly
    - **People**: Filter by message sender
    - **Date Range**: Show messages from specific time periods
    - **Sentiment**: Filter by emotional tone
  - Accessible via threads icon in chat header
- **Two-Step Onboarding Flow**:
  - Step 1: Name (required) and bio (optional)
  - Step 2: Profile photo (optional) with camera and camera roll support
  - **Smart invite handling**: If user opens the app via invite link, they're automatically joined to the chat after completing onboarding
- **Unique Device Identity**: Each device gets a unique user ID automatically
- **Profile Management**: Edit your display name, bio, and profile photo
- **Global Chat Room**: Everyone joins the same conversation
- **Real-time Messaging**: Messages appear instantly for all users
- **Beautiful UI**: Modern design with purple-to-blue gradients and custom header
- **Intuitive Navigation**: Single chat screen with profile access from header

## Tech Stack

### Frontend
- Expo SDK 53 with React Native 0.76.7
- React Navigation (Stack Navigator) for navigation
- TanStack Query for data fetching
- Nativewind (Tailwind CSS) for styling
- Lucide React Native for icons
- Expo Image Picker for profile photos

### Backend (Vibecode Cloud)
- Bun + Hono server
- Prisma ORM with SQLite database
- RESTful API endpoints
- **OpenAI GPT-5 integration**: Powers @ai chat assistant (via Vibecode proxy)
- **OpenAI GPT-4o-mini integration**: Powers custom slash commands with multi-tool support (via Vibecode proxy)
  - Web search tool via Google Custom Search API
  - Image generation tool using DALL-E 3
- **OpenAI GPT-5 mini**: Automatic image description generation
- **Google Gemini 2.5 Flash Image (NANO-BANANA)**: Used for AI-generated group avatars and legacy /image /meme commands

## Project Structure

```
/home/user/workspace/
├── src/
│   ├── screens/
│   │   ├── OnboardingNameScreen.tsx  # First onboarding step (name & bio)
│   │   ├── OnboardingPhotoScreen.tsx # Second onboarding step (photo)
│   │   ├── ChatScreen.tsx           # Main chat interface
│   │   ├── ProfileScreen.tsx        # User profile editor
│   │   └── GroupSettingsScreen.tsx  # Group settings & members
│   ├── contexts/
│   │   └── UserContext.tsx          # User state management
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # App navigation (Stack Navigator)
│   │   └── types.ts                 # Navigation types
│   └── lib/
│       └── api.ts                   # API client
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── users.ts             # User API endpoints
│   │   │   ├── messages.ts          # Message API endpoints
│   │   │   ├── reactions.ts         # Reaction API endpoints
│   │   │   ├── ai.ts                # AI assistant endpoints
│   │   │   ├── upload.ts            # Image upload
│   │   │   ├── group-settings.ts    # Group settings endpoints
│   │   │   └── custom-commands.ts   # Custom slash commands CRUD
│   │   ├── services/
│   │   │   ├── image-description.ts # GPT-5 mini image description service
│   │   │   └── avatar-cron.ts       # Daily avatar generation cron job
│   │   └── index.ts                 # Server entry
│   └── prisma/
│       └── schema.prisma            # Database schema
└── shared/
    └── contracts.ts                 # Shared types between frontend/backend
```

## Recent Changes

- **Upgraded custom slash commands to GPT-5.1 with native web search (Nov 18, 2025)**: Custom commands now use GPT-5.1 with OpenAI's hosted web search tool
  - **Model Upgrade**: Switched from `gpt-4o-mini` to `gpt-5.1` for advanced reasoning capabilities
  - **Native Web Search**: Using OpenAI's hosted `web_search` tool (type: "web_search" with reasoning_effort: "none")
    - No need for external Google Custom Search API
    - Real-time web search results provided directly by OpenAI
    - Works seamlessly with the Responses API architecture
  - **DALL-E 3 Image Generation**: Custom commands use OpenAI's DALL-E 3 for image generation
    - Supports multiple image sizes: 1024x1024, 1792x1024, 1024x1792
    - High-quality image generation
    - Generated images are downloaded and saved locally to `/uploads/` directory
  - **Data Analysis Tool**: Added native data analysis capabilities
    - Parse and analyze CSV/JSON data
    - Perform statistical analysis, filtering, calculations
    - Generate insights from structured data
  - **Multi-Tool Agent Architecture**: GPT-5.1 intelligently coordinates multiple tools
    - Web search for real-time information
    - Image generation for visual content
    - Data analysis for structured data processing
    - All tools can be used together in the same command
  - **Optimized Tool Calling**: Using `reasoning_effort: "none"` for optimal tool performance
    - Fast tool execution without unnecessary reasoning overhead
    - Clean responses without exposing internal decision-making
  - Example slash commands that work with GPT-5.1:
    - `/factcheck [claim]` - Searches web with native tool and provides sources
    - `/visualize [concept]` - Generates image with DALL-E 3 and explains it
    - `/news [topic]` - Searches for recent news with native web search
    - `/analyze [data]` - Parses and analyzes CSV or JSON data
  - Files updated: `backend/src/routes/custom-commands.ts`, `backend/src/services/gpt-responses.ts`, `backend/src/services/data-analysis.ts`
- **Fixed custom slash commands web search and image generation (Nov 18, 2025)**: Custom commands now properly execute tools without showing internal reasoning
  - **Web Search Implementation**: Custom commands can now search the web using Google Custom Search API
    - Supports Google Custom Search API when GOOGLE_SEARCH_ENGINE_ID and GOOGLE_API_KEY are configured
    - Returns top 5 search results with titles, snippets, and source links
    - Graceful fallback to AI's training knowledge when search API is not configured
    - Clear error messages for failed searches
  - **Fixed AI "Thinking" Text Bug**: AI no longer displays internal reasoning to users
    - Problem: AI was outputting explanatory text like "I'll search the web for..." before executing tools
    - Solution: Added system prompt instructions to prevent reasoning output
    - Added code filter to explicitly ignore any reasoning text (message.content set to null)
    - Only the FINAL response after tool execution is shown to users
  - **Image Generation**: Verified working correctly with NANO-BANANA (Gemini 2.5 Flash Image)
  - **Both tools** (web search and image generation) can be used together in the same command
  - Custom commands now execute smoothly without exposing internal AI decision-making
  - Example slash commands that now work properly:
    - `/factcheck [claim]` - Searches web and provides sources without saying "I'll search..."
    - `/news [topic]` - Searches for recent news and summarizes findings
    - `/visualize [concept]` - Generates image and explains it without exposing tool calls
  - Files updated: `backend/src/routes/custom-commands.ts`
- **Fixed event creation Prisma schema mismatch (Nov 18, 2025)**: Events now save correctly to database
  - Fixed field name mismatch: Prisma uses `createdBy` but contract expects `creatorId`
  - Fixed field name mismatch: Prisma uses `finalizedAt` but contract expects `finalizedDate`
  - Fixed field name mismatch: EventOption Prisma uses `value` but contract expects `optionValue`
  - Fixed status value mismatch: Prisma uses "planning"/"finalized" but contract expects "proposed"/"confirmed"
  - Added helper functions to transform between Prisma and contract schemas
  - All event creation and fetching now works correctly
  - Files updated: `backend/src/routes/events.ts`
- **Added premium floating plus buttons to Threads and Events (Nov 18, 2025)**: Clean, modern floating action buttons for creating threads and events
  - Removed old create buttons from headers and bottom of panels
  - Added floating plus button to ThreadsPanel (teal #14B8A6 theme)
  - Added floating plus button to Events modal (blue #0A95FF theme)
  - Buttons float in bottom-right corner with smooth press animation
  - Scale animation on press (0.95x) with haptic feedback
  - Glowing shadow effect matching button color
  - Always visible and accessible regardless of scroll position
  - Files updated: `src/components/Threads/ThreadsPanel.tsx`, `src/screens/ChatScreen.tsx`
- **Fixed threads and events API integration (Nov 18, 2025)**: Threads and events now save and display correctly
  - Migrated useThreads and useEvents hooks to use centralized API client
  - Fixed API calls to use proper backend URL with reverse proxy
  - Ensures authentication cookies are included automatically
  - Threads and events now properly save to database and appear in lists
  - Files updated: `src/hooks/useThreads.ts`, `src/hooks/useEvents.ts`, `src/screens/ChatScreen.tsx`
- **Added create thread button to ThreadsPanel header (Nov 18, 2025)**: Users can now easily create new threads from the threads panel
  - Added a prominent "+" button in the header next to the close button
  - Button has green teal styling matching the threads theme
  - Makes thread creation more discoverable and accessible
  - No need to scroll to bottom to find create button
  - Both header button and bottom button work for creating threads
  - Files updated: `src/components/Threads/ThreadsPanel.tsx`
- **Fixed Reactor error handling and keyboard issues (Nov 18, 2025)**: Reactor remix and meme features now work smoothly
  - **Problem #1**: Error alert was shown even when remix succeeded and image was posted
  - **Problem #2**: Keyboard was covering the text input in ReactorMenu
  - **Root causes**:
    1. `onError` handler in useReactor was triggering despite successful API response
    2. KeyboardAvoidingView was positioned incorrectly inside the modal structure
  - **Solutions**:
    1. Enhanced error handling in useReactor hook:
       - Added validation to only show success alert when message data exists
       - Suppressed parsing errors that occurred after successful API calls
       - Better logging to track response data flow
    2. Fixed ReactorMenu keyboard avoidance:
       - Moved KeyboardAvoidingView to wrap the entire modal content
       - Added proper keyboardVerticalOffset configuration
       - Ensures text input is never hidden by keyboard
  - **Files updated**:
    - `src/hooks/useReactor.ts` - Enhanced error handling logic
    - `src/components/Reactor/ReactorMenu.tsx` - Fixed KeyboardAvoidingView structure
  - Users now get clear success feedback without false error alerts
  - Keyboard never covers the remix prompt input field
- **Fixed Prisma validation error in Reactor (Nov 18, 2025)**: Remix and meme features now save messages correctly
  - **Problem**: Remix and meme generation worked, but failed when saving to database with "Unknown field 'linkPreview' for include statement"
  - **Root cause**: `linkPreview` is a JSON field on Message model, not a relation - can't be used in include statements
  - **Solution**: Replaced `linkPreview: true` with `mentions: true` in both remix and meme message creation
  - **Files updated**: `backend/src/routes/reactor.ts` (lines 267 and 468)
  - Image generation and saving already worked perfectly - this was purely a database query fix
  - Remixed and meme images now successfully post to chat
- **Enhanced Google Gemini API error handling for rate limits (Nov 18, 2025)**: Better error messages for quota exhaustion
  - **Problem**: Google Gemini API (NANO-BANANA) rate limit errors (429) were showing generic error messages
  - **Solution**: Added comprehensive error handling for all image generation endpoints
  - **Improvements**:
    - Detects rate limiting (429) and "RESOURCE_EXHAUSTED" status
    - Extracts and displays retry delay from API response (e.g., "Please retry in 7s")
    - Provides clear user-friendly messages about quota exhaustion
    - Separates authentication errors (401/403) with specific guidance
    - Returns proper HTTP status codes (429 for rate limit, 403 for auth errors)
  - **Error messages now include**:
    - Specific error type (rate limit vs authentication vs other)
    - Quota exhaustion explanation
    - Retry timing when available
    - Link to check usage/billing (in API response details)
  - **Files updated**:
    - `backend/src/routes/ai.ts` - Enhanced error handling for /generate-image, /generate-meme, /generate-group-avatar
    - `backend/src/routes/reactor.ts` - Enhanced error handling for /remix and /meme-from-media
  - **Note**: If you see rate limit errors, you've exceeded the free tier quota for `gemini-2.5-flash-preview-image`
    - Check usage at: https://ai.dev/usage?tab=rate-limit
    - Free tier limits apply per minute and per day
- **FIXED: Catch-up AI summary now fully working with GPT-5-mini (Nov 18, 2025)**: Resolved all issues including token limits
  - **Root causes identified and fixed**:
    1. ❌ **GPT-5-mini does not support `temperature` parameter** - Removed it (reasoning models use fixed temperature of 1)
    2. ❌ **Hardcoded wrong proxy URL in env.ts** - Was using `https://api.vibecode.com/proxy/openai/v1` (inaccessible)
    3. ❌ **Insufficient token limits for reasoning model** - GPT-5-mini uses 512+ reasoning tokens internally, leaving no tokens for actual output
    4. ✅ **Now uses `OPENAI_BASE_URL` from .env** - `https://api.openai.com.proxy.vibecodeapp.com/v1` (working)
    5. ✅ **Increased token limits** - Quick: 800 tokens, Detailed/Personalized: 2048 tokens (accounting for internal reasoning)
  - **Solution**:
    - Changed model to `gpt-5-mini` as requested
    - Removed `temperature: 0.7` parameter (not supported by GPT-5 reasoning models)
    - Fixed `backend/src/env.ts` to read `process.env.OPENAI_BASE_URL` instead of hardcoded URL
    - **Increased `max_completion_tokens` from 150/500 to 800/2048** to account for GPT-5-mini's internal reasoning tokens
    - Added detailed response logging to debug empty responses
  - **Why token increase was needed**:
    - GPT-5-mini is a reasoning model that uses ~512 tokens internally for reasoning before generating output
    - Previous limit of 500 tokens meant ~488 tokens went to reasoning, leaving only ~12 tokens for actual summary
    - New limits (800/2048) allow sufficient reasoning tokens plus room for quality output
    - Smart replies already use 2048 tokens and work correctly
  - **Technical details**:
    - GPT-5-mini uses internal temperature optimization (no external temperature control)
    - Uses `max_completion_tokens` parameter (standard for GPT-5 models)
    - Comprehensive error handling for connection, authentication, and rate limit errors
    - Enhanced logging with full response object debugging
    - Fixed TypeScript errors for better type safety
  - **Files updated**:
    - `backend/src/env.ts` - Now uses `OPENAI_BASE_URL` environment variable (CRITICAL FIX #1)
    - `backend/src/routes/catchup.ts` - Uses gpt-5-mini without temperature, increased tokens, enhanced logging (CRITICAL FIX #2)
    - `src/hooks/useCatchUp.ts` - Better error logging in frontend
  - ✅ Catch-up feature now generates quick, detailed, and personalized summaries successfully with GPT-5-mini
- **FINAL FIX: Catch-up AI summary now works with GPT-5-mini (Nov 18, 2025)**: [SUPERSEDED BY ABOVE - token limit issue remained]
  - **Root cause**: Vibecode OpenAI proxy doesn't support `gpt-5-mini` model name
  - **Solution**: Reverted to `gpt-4o-mini` which works with the Vibecode proxy
  - **Changes**:
    - Model kept as "gpt-4o-mini" (standard OpenAI model)
    - Temperature set to 0.7 for balanced creativity
    - Uses `max_tokens` parameter (standard for OpenAI)
  - Catch-up feature now generates quick, detailed, and personalized summaries successfully
  - backend/src/routes/catchup.ts updated
  - Note: This feature uses gpt-4o-mini due to proxy limitations, while other features use gpt-5-mini
- **Migrated all non-image AI functionality to GPT-MINI (Nov 18, 2025)**: All text-based AI features now use gpt-5-mini for improved performance
  - **Files updated**:
    - `backend/src/services/ai-engagement.ts` - Auto-engagement service
    - `backend/src/routes/reactor.ts` - Caption and meme analysis endpoints
    - `backend/src/routes/custom-commands.ts` - Custom slash command execution
    - `backend/src/routes/ai.ts` - Main @ai chat endpoint
  - **Changes applied**:
    - Switched from `openai.responses.create()` (gpt-5) to `openai.chat.completions.create()` (gpt-5-mini)
    - Uses Chat Completions API instead of Responses API
    - Temperature set to 1 (required for gpt-5-mini)
    - max_completion_tokens set to 2048
    - Removed web_search_preview and image_generation tools (not supported by gpt-5-mini)
  - **Note**: Image generation still uses NANO-BANANA (Google Gemini) for /image, /meme, and Reactor features
  - **Smart replies endpoint already used gpt-5-mini** (no changes needed)
  - All text-based AI responses now use the more cost-effective and faster gpt-5-mini model
- **Updated Reactor to use NANO-BANANA for image generation (Nov 18, 2025)**: Reactor remix and meme features now use Google Gemini image generation
  - **Previous issue**: Backend was incorrectly using OpenAI DALL-E 3, then switched to wrong NANO-BANANA URL
  - **Solution**: Updated to use correct NANO-BANANA implementation (Google Gemini)
    - API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
    - Uses `GOOGLE_API_KEY` environment variable
    - Remix endpoint generates images with NANO-BANANA (gemini-2.5-flash-image)
    - Meme endpoint generates images with NANO-BANANA (gemini-2.5-flash-image)
    - Handles base64 image data directly (no URL download needed)
    - Proper safety filter handling (blocked content, NO_IMAGE responses)
    - Matches implementation in `/image` and `/meme` slash commands
  - backend/src/routes/reactor.ts updated with correct NANO-BANANA API calls
  - Both remix and meme features now use same image generation service as slash commands
- **Fixed Reactor backend image generation API failures (Nov 18, 2025)**: Reactor remix and meme features fixed API integration
  - **Root cause**: Backend was calling non-existent NANO-BANANA API at `https://www.nanobana.com/v1/images/generations`
  - **Issues fixed**:
    - 500 errors when trying to remix or create memes
    - HTML being returned instead of JSON from invalid API endpoint
    - Missing/invalid `NANO_BANANA_API_KEY` environment variable
    - `console.error()` causing unnecessary error logs
  - **Solution**: Migrated to OpenAI DALL-E 3 via Vibecode proxy
    - Remix endpoint now uses `openai.images.generate()` with DALL-E 3
    - Meme endpoint now uses `openai.images.generate()` with DALL-E 3
    - Proper error handling with 503 responses for service unavailability
    - Added detailed logging for debugging (using `console.log()`)
    - Changed all `console.error()` to `console.log()` following CLAUDE.md guidelines
  - backend/src/routes/reactor.ts fully updated
  - Both remix and meme features now functional with proper AI image generation
- **Fixed Reactor feature network request failures (Nov 18, 2025)**: Reactor remix/caption/meme features now work correctly
  - **Root cause**: useReactor hook was using raw fetch with wrong API URL instead of centralized API client
  - **Issues fixed**:
    - Network request failed errors when trying to remix, caption, or create memes
    - Wrong API URL: was using `EXPO_PUBLIC_API_URL` instead of `EXPO_PUBLIC_VIBECODE_BACKEND_URL`
    - Missing authentication cookies that API client automatically handles
    - `console.error()` causing red errors in logs for non-breaking failures
  - **Solution**: Refactored to use centralized `api` client from `@/lib/api`
    - Automatically uses correct backend URL with reverse proxy
    - Includes authentication cookies
    - Proper error handling with consistent API
    - Changed `console.error()` to `console.log()` following CLAUDE.md guidelines
  - All Reactor features (remix, caption, meme) now functional
  - src/hooks/useReactor.ts fully refactored
- **Fixed critical route ordering issue causing 404 errors (Nov 18, 2025)**: Fixed unread-counts endpoint returning 404 errors
  - **Root cause**: `/unread-counts` route was defined AFTER `/:id` route in chats router
  - **Effect**: Router was matching `/unread-counts` against `/:id`, treating "unread-counts" as a chat ID
  - **Solution**: Moved `/unread-counts` route to come BEFORE `/:id` route (line 131 in chats.ts)
  - Added comment warning about route ordering to prevent future issues
  - Eliminates hundreds of 404 errors that were flooding the logs every 3 seconds
  - Unread message badges and notifications now work correctly
- **Fixed catch-up error handling to prevent red error messages (Nov 18, 2025)**: Catch-up feature now handles errors gracefully without showing red error messages in logs
  - Changed `console.error()` to `console.log()` in useCatchUp hook error handler
  - Added user-friendly Alert dialog when catch-up generation fails
  - 503 errors (service unavailable) show specific message: "The AI service is temporarily unavailable. Please try again in a few moments."
  - Other errors show generic message: "Failed to generate catch-up summary. Please try again."
  - Errors no longer appear as breaking errors in the Vibecode app LOGS tab
  - Follows CLAUDE.md guidelines: only use `console.error()` for breaking app errors
- **Fixed ReactorMenu JSX closing tag error (Nov 18, 2025)**: Fixed ScrollView closing tag mismatch in ReactorMenu component
  - ScrollView on line 302 was incorrectly closed with `</View>` instead of `</ScrollView>`
  - Now properly closed with matching `</ScrollView>` tag
  - Eliminates JSX syntax error at ReactorMenu.tsx:367
- **Fixed catch-up and smart replies OpenAI proxy connection errors (Nov 17, 2025)**: Both features now gracefully handle proxy connection failures
  - **Root cause**: Vibecode OpenAI proxy experiencing intermittent connection issues ("ConnectionRefused", "FailedToOpenSocket")
  - **Solution for Smart Replies**: Added graceful degradation
    - Connection errors now return empty replies array (`{ replies: [] }`) instead of 500 error
    - Frontend no longer shows error messages when proxy is unavailable
    - Smart replies simply don't appear when the service is down (non-critical feature)
  - **Solution for Catch-Up**: Added better error handling
    - Connection errors now return 503 Service Unavailable with user-friendly message
    - Error message: "The AI service is temporarily unavailable. Please try again later."
    - Clearer feedback to users about why the feature isn't working
  - Both features will work automatically when proxy connection is restored
  - Applied to POST /api/ai/smart-replies and POST /api/catchup/generate endpoints
- **Fixed catch-up feature database and API errors (Nov 17, 2025)**: Catch-up summary generation and retrieval now work correctly
  - **Root cause #1**: Backend was using OpenAI Responses API endpoint (`/responses`) which is not available through the Vibecode proxy
  - **Root cause #2**: Prisma schema validation error - query attempted to filter by `expiresAt: null` when the field is required (non-nullable)
  - **Root cause #3**: Mismatch between Prisma schema (stores `messageRange` as JSON) and API contract (expects `startMessageId` and `endMessageId` as separate fields)
  - **Solution #1**: Switched to standard Chat Completions API (`chat.completions.create`) with gpt-4o-mini model
  - **Solution #2**: Fixed query to only check `expiresAt: { gt: new Date() }` instead of using OR clause with null
  - **Solution #3**: Updated response formatting to parse JSON fields and map to contract schema:
    - `content` parsed from JSON string
    - `messageRange` parsed and extracted into separate `startMessageId` and `endMessageId` fields
    - `createdAt` and `expiresAt` converted to ISO strings
  - Fixed 400 error on GET endpoint by correcting schema validation (chatId now correctly from route params, userId from query)
  - GET endpoint now properly returns 404 when no summary exists
  - Catch-up feature now generates and retrieves conversation summaries successfully
- **Fixed foreign key constraint violation when adding chat members**: Added explicit chat existence validation before attempting to add users as members
  - Previously only checked if user exists, not if chat exists
  - Now validates both chat and user exist before creating chatMember relationship
  - Prevents "Foreign key constraint violated" errors in database
  - Returns proper 404 error if chat doesn't exist
  - Applied to both GET /api/chats/:id and GET /api/chats/:id/messages endpoints
  - Fixes "Failed to mark messages as read" errors caused by invalid chat references
- **Fixed OpenAI Responses API content parsing**: Custom slash commands and AI assistant now properly handle all response types
  - **Fixed "No response from AI" error (Nov 16, 2025)**: Now handles both `text` and `output_text` content types from OpenAI Responses API
    - OpenAI Responses API returns content items with type `output_text` (not just `text`)
    - Updated parsing logic to check for both content types: `contentItem.type === "text" || contentItem.type === "output_text"`
    - Fixes 500 error that occurred when AI used web search or other tools
    - Applied to both `/api/custom-commands/execute` and `/api/ai/chat` endpoints
  - Updated response parsing to extract text from `message` items in the output array
  - Extract images from `image_generation_call` items in the output array
  - When AI generates only an image with no text, displays default message: "Here's the image I generated for you!"
  - Images are properly saved from base64 data to the uploads directory
  - Improves reliability of AI responses with web search and image generation
- **Fixed AI responding multiple times back-to-back**: AI engagement system now has strict safeguards to prevent double messages
  - **CRITICAL FIX (Nov 16, 2025)**: Resolved race condition that allowed 13 consecutive AI messages
  - **ROOT CAUSE**: Two separate in-memory lock Maps in different files didn't coordinate with each other
    - `/api/ai/chat` endpoint had its own lock Map
    - Auto-engagement service had a separate lock Map
    - Both could think they had exclusive access simultaneously
  - **SOLUTION**: Created shared lock module (`backend/src/services/ai-locks.ts`) used by ALL AI response paths
    - Centralized lock management ensures coordination across all entry points
    - All three AI response paths now use the same shared locks:
      1. `/api/ai/chat` endpoint (for @ai mentions)
      2. Auto-engagement polling service
      3. Custom slash commands
  - **STRICT RULE: @ai mentions are completely excluded from auto-engagement** - auto-engagement service now skips any message containing @ai
  - This prevents double responses where both the frontend @ai call and auto-engagement service respond simultaneously
  - **STRICT RULE: Back-to-back AI messages are NEVER allowed** - both the auto-engagement service and /api/ai/chat endpoint enforce this
  - Added explicit check in /api/ai/chat endpoint to block requests if last message is already from AI
  - Auto-engagement service already had this check, but now it's enforced on all AI response paths
  - Returns 400 error with clear message: "AI already sent the last message. Please wait for a user response first."
  - **FIXED RACE CONDITION**: Implemented shared lock mechanism to prevent concurrent AI responses from ANY source
  - When multiple AI triggers happen rapidly, only the first processes while others are blocked
  - Lock is automatically released after response completes or on error (via finally block)
  - Prevents double AI messages caused by near-simultaneous API calls or auto-engagement triggers checking the database before either saves
  - See `BUGFIX-MULTIPLE-AI-MESSAGES.md` for detailed technical analysis
  - **Lock implemented in THREE places**:
    1. `/api/ai/chat` endpoint for @ai mentions
    2. `generateAIResponse()` function to prevent concurrent response generation
    3. `processNewMessages()` function to prevent concurrent message processing from multiple polling cycles
  - **Four-layer protection system**:
    1. Chat processing locks prevent polling cycles from overlapping
    2. Response generation locks prevent concurrent AI responses
    3. Auto-engagement service checks before triggering
    4. API endpoint validates before saving
  - Combined with existing 30-second cooldown and self-response check for comprehensive protection
  - Ensures natural conversation flow where AI always waits for user input after responding
- **Updated AI response style to be more concise**: Default AI responses are now shorter and more natural
  - Default response length changed from 1-3 sentences to 1-2 sentences
  - System prompts streamlined to emphasize brief, conversational responses
  - AI now responds more like texting with a friend rather than a formal assistant
  - Personality and tone settings can still override this for more detailed responses
  - Applied to both @ai mentions and automatic engagement responses
- **Added custom AI name feature**: Chat creators can now give their AI assistant a personalized name
  - Added `aiName` field to Chat schema with default value "AI Assistant"
  - New input field in Group Settings under "AI Assistant Personality Settings"
  - Name appears above all AI messages in the chat
  - Also shown during AI typing indicator
  - **AI is aware of its name**: Custom name is included in AI's system prompt, allowing it to know and reference its own name
  - Makes the AI feel more like a personalized friend in the chat
  - Per-chat setting - different chats can have different AI names (e.g., "Jarvis", "Buddy", "Alex")
  - Updated PATCH /api/chats/:id endpoint to support aiName field
  - Frontend automatically displays custom AI name throughout the chat interface
- **Fixed invite code display and copy functionality**:
  - Invite code now properly displays in the invite modal
  - Added separate state management for `inviteToken` in GroupSettingsScreen
  - Fixed issue where code wasn't showing due to stale chat data
  - Query invalidation added to refresh chat data after invite generation
  - Copy and share buttons now use the `inviteToken` state for reliable access
  - Copy button copies just the 8-character invite code for easy sharing
  - All invite functionality now works correctly in Group Settings
- **Implemented invite code expiration system**: Invite codes now automatically expire after 24 hours for security:
  - Added `inviteTokenExpiresAt` field to Chat schema
  - Invite generation automatically creates fresh tokens when expired
  - Backend validates expiration when users try to join (returns 410 if expired)
  - Expired codes regenerate automatically when chat creator requests a new invite link
  - Users see helpful error message: "Invite link has expired. Please ask for a new invite link."
  - Prevents stale codes from being shared indefinitely
- **Implemented manual invite code system**: Since URL-based deep linking doesn't work in the Vibecode sandbox environment, implemented a simple manual invite code system:
  - Added "Join" button in the ChatList header (always visible)
  - Generate 8-character invite codes in Group Settings via "Generate Invite Code" button
  - Code displayed prominently in large 32px monospace font with letter spacing
  - "Copy Code" button copies just the 8-character code
  - "Share" button opens native share sheet with formatted message
  - Recipients tap "Join" button and enter the code to join instantly
  - Simple, reliable solution that works perfectly in sandbox environment

## Database Schema

### User
- `id`: Unique device identifier (String, Primary Key)
- `name`: Display name (String, default: "Anonymous")
- `bio`: User biography (String, optional)
- `image`: Profile photo URL (String, optional)
- `hasCompletedOnboarding`: Tracks if user completed onboarding (Boolean, default: false)
- `pushToken`: Expo push notification token (String, optional)
- `pushNotificationsEnabled`: Whether push notifications are enabled (Boolean, default: true)
- `createdAt`: Account creation timestamp
- `updatedAt`: Last update timestamp

### Message
- `id`: Unique message identifier (String, Primary Key, auto-generated)
- `content`: Message text (String, default: "")
- `messageType`: Type of message - "text", "image", or "system" (String, default: "text")
  - "text": Regular text message
  - "image": Image message with optional caption
  - "system": System-generated message (e.g., user join notifications)
- `imageUrl`: URL to uploaded image (String, optional)
- `imageDescription`: AI-generated description of image content (String, optional)
  - Generated by GPT-5 mini vision model
  - Includes detailed description of objects, colors, text, people, setting, and mood
  - Used by AI assistant to understand image content
- `userId`: Reference to User (uses "system" for system messages)
- `replyToId`: Reference to Message being replied to (String, optional)
- **Link Preview Fields**:
  - `linkPreviewUrl`: The URL being previewed (String, optional)
  - `linkPreviewTitle`: Page title from Open Graph/Twitter Card metadata (String, optional)
  - `linkPreviewDescription`: Page description from metadata (String, optional)
  - `linkPreviewImage`: Preview image URL from metadata (String, optional)
  - `linkPreviewSiteName`: Site name from metadata (String, optional)
  - `linkPreviewFavicon`: Favicon URL (String, optional)
- **Relations**:
  - `replyTo`: The message this message is replying to (nullable)
  - `replies`: Messages that reply to this message
  - `reactions`: Emoji reactions on this message
- `createdAt`: Message timestamp

### Reaction
- `id`: Unique reaction identifier (String, Primary Key, auto-generated)
- `emoji`: The emoji used for the reaction (String)
- `userId`: Reference to User who reacted (String, no relation)
- `messageId`: Reference to Message being reacted to
- `createdAt`: Reaction timestamp
- **Unique Constraint**: One user can only use each emoji once per message
- **Note**: No direct User relation defined - userId stored as string for lightweight queries

### GroupSettings
- `id`: Unique identifier (String, Primary Key, default: "global-chat")
- `name`: Group name (String, default: "VibeChat")
- `bio`: Group bio/description (String, optional)
- `image`: Group profile photo URL (String, optional)
- `aiPersonality`: Custom AI personality instructions (String, optional)
  - User-defined text that guides AI behavior and responses
  - Maximum 500 characters
  - Directly injected into AI system prompt
- `aiTone`: Selected tone for AI responses (String, optional)
  - One of: Professional, Casual, Friendly, Humorous, Sarcastic, Formal, Enthusiastic, Calm
  - Quick-select option for instant personality adjustment
- `lastAvatarGenDate`: Timestamp of last avatar generation (DateTime, optional)
  - Tracks when the group avatar was last auto-generated
  - Used to prevent duplicate generations on the same day
- `avatarPromptUsed`: The prompt used for last avatar generation (String, optional)
  - Stores the exact prompt sent to NANO-BANANA
  - Useful for debugging and understanding avatar generation context
- `messageHistory`: Deprecated field (will be removed in future migration)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

### CustomSlashCommand
- `id`: Unique identifier (String, Primary Key, auto-generated)
- `command`: Command name with / prefix (String)
  - Examples: /roast, /factcheck, /translate
  - Automatically prefixed with / if not provided
- `prompt`: AI behavior instructions (String, 1-1000 characters)
  - Defines how GPT-5 AI should respond to the command
  - Has access to conversation context
  - Can specify when to use web search or image generation tools
  - Example: "Search the web to fact-check the user's claim and provide sources"
  - Example: "Generate a funny meme image based on the user's message"
- `chatId`: Reference to Chat this command belongs to
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- **Unique Constraint**: One command name per chat (@@unique([chatId, command]))

### Chat
- `id`: Unique chat identifier (String, Primary Key, auto-generated)
- `name`: Chat name (String, default: "New Chat")
- `bio`: Chat bio/description (String, optional)
- `image`: Chat profile photo URL (String, optional)
- `aiPersonality`: Custom AI personality instructions (String, optional)
  - User-defined text that guides AI behavior and responses
  - Maximum 500 characters
  - Directly injected into AI system prompt
- `aiTone`: Selected tone for AI responses (String, optional)
  - One of: Professional, Casual, Friendly, Humorous, Sarcastic, Formal, Enthusiastic, Calm
  - Quick-select option for instant personality adjustment
- `aiName`: Custom name for the AI assistant (String, optional, default: "AI Assistant")
  - Personalized name shown above all AI messages
  - Examples: "Jarvis", "Buddy", "Alex", etc.
  - Makes the AI feel more like a friend in the chat
  - Per-chat setting for unique AI identities
- `lastAvatarGenDate`: Timestamp of last avatar generation (DateTime, optional)
- `avatarPromptUsed`: The prompt used for last avatar generation (String, optional)
- `inviteToken`: Unique shareable invite token (String, optional, unique)
  - 8-character alphanumeric code for inviting users
  - Generated when first invite is created in Group Settings
  - Displayed prominently in large monospace font for easy sharing
  - Users enter this code via "Join Chat" button on Chat List screen
  - Simple and works perfectly in Vibecode sandbox environment
  - Enables easy sharing of chat invites
  - **Auto-expires after 24 hours** for security
- `inviteTokenExpiresAt`: Expiration date for invite token (DateTime, optional)
  - Set to 24 hours from generation
  - Automatically checked when users try to join
  - Expired codes automatically regenerate when chat creator shares again
- `creatorId`: Reference to User who created the chat
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- **Relations**:
  - `creator`: User who created the chat
  - `members`: ChatMember entries for this chat
  - `messages`: Messages in this chat

### ChatMember
- `id`: Unique identifier (String, Primary Key, auto-generated)
- `chatId`: Reference to Chat
- `userId`: Reference to User
- `joinedAt`: Timestamp when user joined
- **Unique Constraint**: One user can only be a member once per chat
- **Relations**:
  - `chat`: The chat this membership belongs to
  - `user`: The user who is a member

### ReadReceipt
- `id`: Unique identifier (String, Primary Key, auto-generated)
- `userId`: Reference to User who read the message
- `chatId`: Reference to Chat
- `messageId`: Reference to Message that was read
- `readAt`: Timestamp when message was read (default: now)
- **Unique Constraint**: One user can only read a message once
- **Index**: Optimized queries on userId + chatId combination
- **Relations**:
  - `user`: The user who read the message
  - `chat`: The chat containing the message
  - `message`: The message that was read

## API Endpoints

### Users
- `POST /api/users` - Create or get user
- `PATCH /api/users/:id` - Update user profile
- `GET /api/users/:id` - Get user by ID
- `POST /api/users/:id/push-token` - Register push notification token
  - Accepts `pushToken` (Expo push token string)
  - Stores token for sending push notifications
- `PATCH /api/users/:id/notifications` - Update notification preferences
  - Accepts `pushNotificationsEnabled` (boolean)
  - Enables/disables push notifications for the user

### Notifications
- `POST /api/chats/:chatId/read-receipts` - Mark messages as read
  - Accepts `userId` and `messageIds` (array)
  - Creates read receipts for all provided message IDs
  - Automatically invalidates unread count cache
- `GET /api/chats/unread-counts` - Get unread message counts
  - Query parameter: `userId`
  - Returns array of `{ chatId, unreadCount }` objects
  - Excludes user's own messages and system messages
  - Polled every 3 seconds by the frontend

### Messages
- `GET /api/messages` - Fetch all messages (last 100)
  - Includes reactions (without user relations for performance)
  - Returns full reply-to message data with user info
  - Frontend builds user lookup from message.user data for reaction details
- `POST /api/messages` - Send a new message
  - Supports optional `replyToId` for threaded replies
  - Triggers async image description generation for image messages
  - Description generated in background (non-blocking)
- `PATCH /api/messages/:id/description` - Update message description (internal use)
- `DELETE /api/messages/clear` - Clear all messages

### Reactions
- `POST /api/reactions` - Add or toggle reaction on a message
  - Automatically toggles: removes reaction if already exists
  - Returns reaction data with full user information (name, image, bio)
  - Creates a system message in the chat showing "[user's name] sent [emoji]"
  - Returns removal confirmation if toggling off
- `DELETE /api/reactions/:id` - Remove a specific reaction

### AI Assistant
- `POST /api/ai/chat` - Send message to AI assistant with context
  - Backend automatically fetches last 100 messages from database
  - Messages are formatted with timestamps and sender names in chronological order
  - **Image descriptions included**: When messages contain images with descriptions, they're formatted as `[Image: description]`
  - AI receives conversation history with image context appended to user's message
  - AI can infer meaning from message timing, conversational flow, and image content
  - **Custom personality integration**: Injects `aiPersonality` and `aiTone` from Chat settings into system prompt
  - **System prompt instructs AI** to:
    - Follow custom personality instructions if provided
    - Adopt the selected tone in responses
    - Treat image descriptions as if viewing images directly
    - Engage naturally with visual content without disclaimers
    - Answer questions about images based on detailed descriptions
    - Never claim inability to see images
  - **Multi-Tool Support**: AI has access to both web search and image generation
    - **Web search enabled**: Uses web_search_preview tool for real-time information
    - **Image generation enabled**: Uses image_generation tool to create images with OpenAI's native image generation
    - AI automatically chooses which tool(s) to use based on the user's request
    - Both tools can be used together in the same conversation if needed
  - Returns AI response which is saved to database
  - System prompt instructs AI to interpret timestamps and maintain consistency with previous responses
  - **Powered by OpenAI Responses API**: Uses GPT-5 with low reasoning effort, web search, and image generation tools
- `POST /api/ai/generate-image` - Generate AI image with NANO-BANANA
  - Accepts `prompt`, `userId`, and optional `aspectRatio` (default "1:1")
  - Uses Google Gemini 2.5 Flash Image model
  - Takes ~30 seconds to generate
  - Saves generated image to uploads directory
  - Creates message with AI assistant as sender, with prompt as caption
  - Returns message object with image URL
- `POST /api/ai/generate-meme` - Generate meme image with NANO-BANANA
  - Accepts `prompt` and `userId`
  - Enhances prompt with meme-specific instructions (impact font, humor, etc.)
  - Uses Google Gemini 2.5 Flash Image model with 1:1 aspect ratio
  - Takes ~30 seconds to generate
  - Saves generated meme to uploads directory
  - Creates message with AI assistant as sender, with prompt as caption
  - Returns message object with image URL
- `POST /api/ai/generate-group-avatar` - Generate daily group avatar
  - No parameters required
  - Automatically analyzes last 100 messages for themes and content
  - Falls back to group name and bio if no messages exist
  - Creates artistic, abstract avatar representing conversation mood
  - Uses NANO-BANANA (Gemini 2.5 Flash Image) with 1:1 aspect ratio
  - Takes ~30 seconds to generate
  - Updates GroupSettings with new avatar image URL
  - Prevents duplicate generation on same day
  - Returns generation status, image URL, and prompt used

### Custom Commands
- `GET /api/custom-commands?chatId={id}` - Get all custom slash commands for a chat
  - Returns array of all commands for the specified chat sorted by creation date
- `POST /api/custom-commands` - Create new custom slash command
  - Accepts `command` (string, 1-50 chars), `prompt` (string, 1-1000 chars), and `chatId`
  - Automatically adds / prefix if not provided
  - Validates command uniqueness per chat
  - Returns created command object
- `PATCH /api/custom-commands/:id` - Update existing command
  - Accepts optional `command` and `prompt` fields
  - Validates command uniqueness if command is changed
  - Returns updated command object
- `DELETE /api/custom-commands/:id` - Delete custom command
  - Removes command from database
  - Returns success confirmation
- `POST /api/custom-commands/execute` - Execute custom command with GPT-4o-mini
  - Accepts `commandId`, `userId`, `userMessage`, `chatId`, and optional `replyToId`
  - Fetches command prompt and last 100 messages for context
  - If `replyToId` is provided, fetches the replied-to message and highlights it in the prompt as **IMPORTANT CONTEXT**
  - Calls OpenAI GPT-4o-mini with system prompt containing command instructions
  - **Multi-Tool Support**: AI has access to both web search and image generation
    - **Web Search Tool**: AI can search the web when command instructions require research, fact-checking, current events, or real-time information (via Google Custom Search API)
    - **Image Generation Tool (DALL-E 3)**: AI can generate images when command instructions require visual content, memes, diagrams, artwork, or visualizations using OpenAI's DALL-E 3
    - AI pays CLOSE ATTENTION to the command instructions to determine which tool(s) to use
    - Both tools can be used together in the same command execution if the instructions require it
    - Generated images saved to uploads directory and included in message
  - Saves AI response as message in database (with reply relationship and image if generated)
  - Returns message object with AI response and optional image URL

### Group Settings
- `GET /api/group-settings` - Get group settings
  - Returns group name, bio, image, aiPersonality, aiTone, and other settings
- `PATCH /api/group-settings` - Update group settings
  - Accepts: name, bio, image, aiPersonality, aiTone
  - All fields optional
  - Updates are immediately reflected in AI behavior

### Upload
- `POST /api/upload/image` - Upload profile photo or group photo

### Chats
- `GET /api/chats` - Get all chats for a user
  - Query parameter: `userId`
  - Returns array of chats with member count, last message, and creator status
- `POST /api/chats` - Create a new chat
  - Accepts `name`, optional `bio`, optional `image`, and `creatorId`
  - Automatically adds creator as first member
  - Returns created chat object
- `GET /api/chats/:id` - Get specific chat details
  - Query parameter: `userId`
  - Auto-adds user as member if not already joined
  - Creates system join message when user joins
  - Returns chat with full member list and user info
- `PATCH /api/chats/:id` - Update chat settings
  - Accepts: `userId` (required), `name`, `bio`, `image`, `aiPersonality`, `aiTone`, `aiName`
  - Creator-only endpoint (validates that userId matches creatorId)
  - All fields optional except userId
  - Updates are stored in the Chat table per-chat
  - Returns updated chat object
- `DELETE /api/chats/:id` - Delete a chat
  - Creator-only endpoint
  - Cascades to remove all members and messages
- `POST /api/chats/:id/invite-link` - Generate invite link for chat
  - Generates unique 8-character invite token
  - **Auto-generates new token if expired** (older than 24 hours)
  - Sets expiration to 24 hours from generation
  - Returns `inviteToken` and full `inviteLink`
  - Tokens are reused if still valid
  - Any chat member can generate invite links
- `GET /api/chats/:id/messages` - Get all messages in a chat
  - Query parameter: `userId` (validates membership)
  - Auto-adds user as member if not already joined
  - Creates system join message
  - Returns array of messages with reactions and reply data
- `POST /api/chats/:id/messages` - Send message to specific chat
  - Accepts `content`, `messageType`, optional `imageUrl`, `userId`, and optional `replyToId`
  - Validates user is a member
  - Returns created message object
- `DELETE /api/chats/:id/messages` - Clear all messages in chat
  - Creator-only endpoint
  - Returns deletion count

### Invite System
- `GET /api/invite/:token` - Get chat info from invite token
  - Public endpoint (no authentication required)
  - **Validates token is not expired** (checks against current time)
  - Returns 410 status code if invite has expired
  - Returns chat name, bio, image, and member count if valid
  - Used to display invite preview
- `POST /api/invite/:token/join` - Join chat via invite token
  - Accepts `userId`
  - **Validates token exists and is not expired**
  - Returns 410 with helpful error message if expired
  - Auto-adds user as member if not already joined
  - Creates system join message
  - Returns success status and `chatId`
  - Used after onboarding completion for pending invites

### Link Preview
- `POST /api/link-preview/fetch` - Fetch link preview metadata for a URL
  - Accepts: url (string)
  - Returns: LinkPreview object with title, description, image, siteName, and favicon
  - Parses Open Graph and Twitter Card metadata from HTML
  - Automatically converts relative URLs to absolute URLs
  - 10 second timeout for fetching
  - Only processes HTML pages (skips images, videos, etc.)

## How It Works

1. **First Launch & Onboarding**:
   - App generates a unique UUID for the device and creates a user account
   - **Step 1**: Name & Bio screen (name is required, bio is optional)
   - **Step 2**: Profile photo screen (completely skippable)
     - Take photo with camera
     - Choose from camera roll
   - Keyboard avoiding views ensure inputs are always visible
   - After completing onboarding, users are taken to the chat screen
2. **User Context**: Manages current user state across the app (name, bio, image, onboarding status)
3. **Chat Screen**:
   - **iMessage-style header** with group avatar above group name
   - Custom header with dynamic group name title and profile icon
   - Header title automatically updates when group name changes in settings
   - **Auto-scrolls to bottom on open**: Chat automatically scrolls to the very bottom showing the most recent messages when you first open it
   - Polls for new messages every 1 second
   - Displays messages with sender info
   - Shows current user's messages on the right with purple-blue gradient
   - Shows other users' messages on the left in gray
   - AI Assistant messages shown with green gradient and 🤖 emoji
   - **System messages**: Centered gray messages for system notifications (e.g., "[user name] has joined the chat")
   - **Long-press interactions**: Hold any message to open context menu
     - **Reply**: Opens reply mode with message preview above input
     - **React**: Opens emoji picker with 6 quick reactions
   - **Message reactions**: Emoji reactions displayed below messages
     - Shows count for each emoji
     - Your reactions highlighted in blue
     - Tap to toggle reaction on/off
     - **Long-press to see reaction details**: Opens a modal showing all users who reacted with that emoji, including their names and profile pictures
     - System message automatically created when someone reacts
   - **Threaded replies**: Messages can reply to specific messages
     - Reply preview shown above message bubble
     - Colored thread indicator on left side
     - Shows original sender name and content
   - **Image messages**: Tap any image to view full-screen
     - **Save button**: Downloads image to device photo library
     - **Share button**: Opens native share sheet
     - Pinch-to-zoom support
   - **Image picker button**: Tap the image icon to select photos from gallery
   - **Image preview**: Selected images show preview with remove option before sending
   - **Optional captions**: Add text caption to images before sending
   - **Link previews**: Paste or type URLs to see rich preview cards
     - Automatically detects URLs in messages
     - Fetches metadata from websites (Open Graph, Twitter Cards)
     - Displays title, description, image, and site name
     - Tap preview to open link in browser
     - Loads asynchronously without blocking message sending
   - **@ai mentions**: Include "@ai" anywhere in your message to get AI responses
     - Works at the start: "@ai what's the weather?"
     - Works in middle: "Hey @ai, can you help?"
     - Works at end: "What do you think? @ai"
     - Input box turns green with border when @ai is detected
     - AI automatically fetches last 100 messages from database for context
     - Context includes full timestamps for inferring conversational flow
     - **Context includes image descriptions**: AI can see and discuss images through detailed descriptions
     - **AI personality applied**: Uses custom instructions and tone from Group Settings
     - **Typing indicator**: Animated green bubble with dots appears while AI processes
     - AI maintains consistency with its previous responses
     - Can answer questions about who's in the chat, what was discussed, and what images were shared
     - Powered by OpenAI GPT-5
     - **Non-blocking**: Send button remains enabled, users can send messages while AI responds
   - **Slash commands**: Type special commands to generate AI images
     - **/image [prompt]**: Generate custom images (e.g., "/image a sunset over mountains")
     - **/meme [prompt]**: Generate meme images (e.g., "/meme when the code works")
     - **Custom commands**: Use user-created commands (e.g., /roast, /factcheck, /translate)
     - **Reply context support**: When replying to a message and using any slash command, the AI receives the replied-to message as direct context
     - All commands show typing indicator during generation
     - Generated content appears as AI messages
     - Powered by Google Gemini 2.5 Flash Image (for images) and Gemini 2.5 Pro with Google Search grounding (for custom commands)
   - Input field at bottom for typing messages
   - **Reply banner**: Shows when replying to a message with cancel button
5. **Profile Screen**:
   - Accessible via profile icon in chat header (top right)
   - Clean, minimalist design with floating input style (matching chat input)
   - Edit display name with immediate visual feedback
   - Edit bio (optional, max 200 characters) with multiline text input
   - Upload/change profile photo with camera button overlay
   - Proper safe area handling with top padding for transparent header
   - No unnecessary UI clutter - focused on essential profile editing
   - Navigate back to chat
6. **Group Settings Screen**:
   - Accessible via settings icon in chat header (top left)
   - Edit group name and bio
   - Upload/change group profile photo
   - **Tap photo to view full-screen**: Click on the group avatar image to see it in full-screen with the group name displayed at the bottom
   - **AI-Generated Group Avatar**:
     - Clean, minimal sparkle button at bottom-right of avatar
     - Analyzes last 100 messages to determine main theme and sentiment
     - Creates cohesive avatar based on conversation's primary topic
     - Manual generation only - click sparkle button to generate
     - Limited to once per day (resets at midnight Eastern time)
     - Shows loading state during ~30 second generation
     - Success/error feedback with haptics
   - **AI Assistant Personality Configuration**:
     - Green-themed section dedicated to AI customization
     - Custom instructions text area for detailed personality definition
     - 8 quick tone chips for instant personality adjustment
     - Changes apply immediately to all future AI responses
   - **Custom Slash Commands Management**:
     - Orange-themed section for creating custom AI commands
     - Add new commands with + button
     - Define command name (e.g., /roast) and AI prompt
     - Edit existing commands inline
     - Delete commands with confirmation
     - Commands available immediately in chat
     - Powered by Gemini 2.5 Pro with full context and Google Search grounding
   - View list of all group members with their profiles
   - Members shown with photos and bios
   - Member count displayed
   - **Danger Zone**: Clear all messages button
     - Confirmation alert before deletion
     - Permanently deletes all messages from database
     - Shows count of deleted messages
   - **Delete Chat** (Creator Only):
     - Delete entire chat permanently
     - Removes all messages, settings, and member data
     - Only visible to the chat creator
     - Confirmation alert before deletion
     - Navigates back to chat list after deletion

## Design

The app features a sleek, minimalist dark theme with a stunning glassy/translucent design language throughout:

- **Color Palette**:
  - Background: Pure black (#000000) for maximum contrast
  - User messages: Translucent blue with #007AFF border
  - AI messages: Translucent green with #34C759 border
  - Other users: Translucent white with subtle border
  - All elements use frosted glass effect (rgba with 0.15 opacity)
  - Header: Transparent with gradient fade overlay
- **Glassy/Translucent Design**:
  - Message bubbles have frosted glass appearance
  - Input field uses translucent white background
  - Send button matches with colored tint when active
  - Header buttons use same translucent effect
  - Colored borders provide distinction while maintaining cohesion
  - **Profile & Settings screens**: Dark theme with glass morphism cards matching chat aesthetic
  - All cards use translucent white backgrounds (rgba(255, 255, 255, 0.1))
  - Consistent border styling (rgba(255, 255, 255, 0.2))
  - Blue-tinted shadows on interactive elements
  - White text throughout for consistency
- **Message Bubbles**:
  - Frosted glass effect with colored borders
  - Profile photos displayed next to all messages from other users
  - Avatar placeholder shown while profile images load
  - Clean white typography (20px font size for text, 16px for captions)
  - Generous padding (20px horizontal, 14px vertical)
  - Enhanced shadows with colored glows
  - **Image messages**: 180x240px portrait thumbnail with rounded corners
  - **Image placeholders**: Loading spinner with translucent background
  - **Full-screen viewer**: Dark overlay with image centered, sender info at bottom
- **Input Design**:
  - Fully floating translucent input field with subtle shadow
  - Circular floating send button with glassy effect
  - Circular image picker button on the left
  - Completely transparent background - no bars or containers
  - Border highlights when mentioning @ai
  - Image preview shown above input when image selected
  - Remove button overlay on image preview
  - Upload progress overlay with spinner
  - Truly floating appearance over black background
- **Navigation**:
  - Transparent header with black gradient fade on all screens
  - Floating icon buttons with translucent white background
  - White text and icons for contrast
  - Messages visible through transparent header
  - Profile and Settings screens use same header styling as Chat
- **Typography**: San Francisco-style fonts with white text on dark background
- **Layout**: Minimal, spacious, with breathing room between elements
- **Shadows**: Colored glows on message bubbles, subtle shadows on UI elements
- **Interactive Elements**: Smooth hover states and haptic feedback
- **Keyboard Handling**:
  - KeyboardAvoidingView with dynamic positioning
  - Keyboard dismisses only on drag, not on input tap
  - Input field prevents keyboard dismissal when tapped while focused
  - Input fields always visible above keyboard
  - Reduced padding when keyboard is visible (12px)
  - keyboardShouldPersistTaps="handled" for better tap handling

## Commands

```bash
bun run typecheck    # Type checking
bun run lint         # Linting
bun run format       # Code formatting
```

## Logging & Debugging

- **Frontend logs**: Available in `expo.log` file and LOGS tab in Vibecode app
- **Backend logs**: Available in `backend/server.log` file (not visible to users)
- **Error logging**: API errors are logged with `[API Error]` prefix for easy identification
- **AI errors**: Backend AI errors are logged with `[AI]` prefix and include detailed error messages
- **Image generation debugging**: Full API responses logged for NANO-BANANA requests to diagnose content filtering or generation issues

## Notes

- Messages are stored in SQLite database
- Profile photos are stored in `backend/uploads/` directory
- User identity is tied to device (stored in secure storage)
- No authentication required - instant access for all users
- Backend and frontend servers run automatically in Vibecode environment
- AI Assistant powered by OpenAI Responses API via Vibecode proxy
  - Uses fake API key provided by Vibecode (works out of the box)
  - No API key configuration needed from users
  - Model: `gpt-5` with low reasoning effort for optimized performance
  - Web search tool enabled for real-time information access
  - AI fetches last 100 messages directly from database for context
  - Single source of truth: Messages stored only in database (no redundant storage)
- Image descriptions powered by OpenAI GPT-5 mini vision model
  - Automatically analyzes all uploaded images
  - Generates detailed descriptions stored in database
  - Model: `gpt-5-mini` with 64,000 max tokens per response
  - Non-blocking: runs in background after image message is created
  - Uses base64 encoding instead of URLs for reliable transmission
  - Reads images directly from disk to avoid network timeouts
  - Enables AI assistant to "see" and discuss image content
