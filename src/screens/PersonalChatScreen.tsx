/**
 * PersonalChatScreen - Personal 1:1 AI Chat Interface
 * 
 * Features:
 * - Full-width AI responses with rich Markdown rendering (no bubble)
 * - User messages in right-aligned bubbles
 * - Agent selector dropdown in header (persists with conversation)
 * - Conversation history drawer (swipe from left)
 * - Image attachments and generation
 * - Web search capability
 * - Animated "thinking" indicator while AI processes
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolate,
} from "react-native-reanimated";
import {
  Send,
  Menu,
  ImagePlus,
  X,
  Camera,
  Sparkles,
  Globe,
  ArrowUp,
  Plus,
  StopCircle,
  ChevronLeft,
} from "lucide-react-native";
import { BlurView } from "expo-blur";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Markdown from "react-native-markdown-display";

import { api } from "@/lib/api";
import { BACKEND_URL } from "@/config";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { AgentSelectorDropdown, ConversationHistoryDrawer, PersonalAttachmentsMenu } from "@/components/PersonalChat";
import { CreateAIFriendModal } from "@/components/AIFriends";
import { ImageGeneratorSheet, ImageGenerationPill } from "@/components/ImageGeneratorSheet";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { ShimmeringText } from "@/components/ShimmeringText";
import { personalChatsKeys, useAllUserAgents } from "@/hooks/usePersonalChats";
import { usePersonalChatStreaming, type StreamingState as StreamingHookState } from "@/hooks/usePersonalChatStreaming";
import type { RootStackScreenProps } from "@/navigation/types";
import type { AIFriend, PersonalConversation, PersonalMessage, PersonalMessageMetadata } from "@/shared/contracts";
import { ZoomableImageViewer } from "@/components/ZoomableImageViewer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 120;

type NavigationProp = RootStackScreenProps<"PersonalChat">["navigation"];
type RouteProp = RootStackScreenProps<"PersonalChat">["route"];

// Message item for the list - can be a regular message or a date divider
type MessageListItem = PersonalMessage | { id: string; isDateDivider: true; date: Date };

// Enhanced streaming message state for ChatGPT-like experience
interface StreamingState {
  isStreaming: boolean;
  content: string;
  messageId: string | null;
  isThinking: boolean;
  thinkingContent: string;
  currentToolCall: {
    name: string;
    status: "starting" | "in_progress" | "completed";
    sources?: Array<{ title: string; url: string }>;
  } | null;
  reasoningEffort: "none" | "low" | "medium" | "high" | null;
  error: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  generatedImageUrl: string | null;
}

// Optimistic user message for immediate display while streaming
interface OptimisticUserMessage {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: Date;
}

// Typing indicator component
function TypingIndicator({ isDark }: { isDark: boolean }) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (value: Reanimated.SharedValue<number>, delay: number) => {
      value.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    };

    // Stagger the animations
    setTimeout(() => animateDot(dot1, 0), 0);
    setTimeout(() => animateDot(dot2, 0), 150);
    setTimeout(() => animateDot(dot3, 0), 300);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    opacity: 0.3 + dot1.value * 0.7,
    transform: [{ scale: 0.8 + dot1.value * 0.4 }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: 0.3 + dot2.value * 0.7,
    transform: [{ scale: 0.8 + dot2.value * 0.4 }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: 0.3 + dot3.value * 0.7,
    transform: [{ scale: 0.8 + dot3.value * 0.4 }],
  }));

  return (
    <View style={styles.typingContainer}>
      <Animated.View
        style={[
          styles.typingDot,
          { backgroundColor: isDark ? "#fff" : "#6366f1" },
          dot1Style,
        ]}
      />
      <Animated.View
        style={[
          styles.typingDot,
          { backgroundColor: isDark ? "#fff" : "#6366f1" },
          dot2Style,
        ]}
      />
      <Animated.View
        style={[
          styles.typingDot,
          { backgroundColor: isDark ? "#fff" : "#6366f1" },
          dot3Style,
        ]}
      />
    </View>
  );
}

// Web search indicator
function SearchingIndicator({ isDark, colors }: { isDark: boolean; colors: any }) {
  return (
    <Reanimated.View
      entering={FadeIn.duration(200)}
      style={[styles.searchingContainer, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }]}
    >
      <Globe size={14} color="#6366f1" />
      <Text style={[styles.searchingText, { color: colors.text }]}>Searching the web...</Text>
    </Reanimated.View>
  );
}

// Thinking indicator component - shows when AI is reasoning (ChatGPT-like expandable)
function ThinkingIndicator({ isDark, colors, content }: { isDark: boolean; colors: any; content: string }) {
  const pulseOpacity = useSharedValue(0.6);
  const isMounted = useRef(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    isMounted.current = true;
    
    // Start animation only if mounted
    if (isMounted.current) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.ease }),
          withTiming(0.6, { duration: 800, easing: Easing.ease })
        ),
        -1,
        false
      );
    }
    
    // Cleanup on unmount - cancel animation safely
    return () => {
      isMounted.current = false;
      cancelAnimation(pulseOpacity);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: pulseOpacity.value ?? 0.6,
    };
  });

  // Brand cyan color for thinking indicator
  const brandCyan = "#4FC3F7";
  const bgColor = isDark ? "rgba(79,195,247,0.15)" : "rgba(79,195,247,0.1)";

  return (
    <Reanimated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.thinkingContainer, { backgroundColor: bgColor }]}
    >
      <Pressable 
        onPress={() => content && setIsExpanded(!isExpanded)}
        style={styles.thinkingHeader}
      >
        <Reanimated.View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, animatedStyle]}>
          <Sparkles size={14} color={brandCyan} />
          <ShimmeringText
            text={content ? "Thinking" : "Thinking..."}
            style={[styles.thinkingLabel, { color: brandCyan }]}
            shimmerColor={isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(79, 195, 247, 0.8)"}
            duration={1500}
          />
          {content && (
            <Text style={{ color: brandCyan, fontSize: 12 }}>
              {isExpanded ? "▼" : "▶"}
            </Text>
          )}
        </Reanimated.View>
      </Pressable>
      {content && isExpanded ? (
        <Reanimated.View entering={FadeIn.duration(200)}>
          <Text 
            style={[styles.thinkingContent, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }]}
          >
            {content}
          </Text>
        </Reanimated.View>
      ) : content && !isExpanded ? (
        <Text 
          style={[styles.thinkingContent, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)", fontSize: 11 }]}
          numberOfLines={1}
        >
          {content.length > 60 ? content.substring(0, 60) + "..." : content}
        </Text>
      ) : null}
    </Reanimated.View>
  );
}

// Image Generation Loading Component with shimmer
function ImageGenerationShimmer({ isDark, colors }: { isDark: boolean; colors: any }) {
  const shimmerAnimation = useSharedValue(0);
  
  useEffect(() => {
    shimmerAnimation.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.ease }),
      -1,
      false
    );
    
    return () => {
      cancelAnimation(shimmerAnimation);
    };
  }, []);
  
  const shimmerStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: interpolate(shimmerAnimation.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    };
  });
  
  return (
    <Reanimated.View 
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.imageGenerationContainer, { 
        backgroundColor: isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.08)",
        borderColor: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.15)",
      }]}
    >
      <Reanimated.View style={[styles.imageGenerationPlaceholder, shimmerStyle]}>
        <LinearGradient
          colors={isDark 
            ? ['#1a1a2e', '#252540', '#1a1a2e']
            : ['#e8e8f5', '#f5f5fa', '#e8e8f5']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.imageGenerationContent}>
          <Sparkles size={24} color="#6366f1" strokeWidth={2} />
          <ShimmeringText
            text="Creating image..."
            style={[styles.imageGenerationText, { color: "#6366f1" }]}
            shimmerColor={isDark ? "#a5a6ff" : "#6366f1"}
            duration={1500}
          />
        </View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

// Tool call indicator component - shows which tool is being used (ChatGPT-like)
function ToolCallIndicator({ 
  toolName, 
  isDark, 
  colors, 
  status = "in_progress" 
}: { 
  toolName: string; 
  isDark: boolean; 
  colors: any;
  status?: "starting" | "in_progress" | "completed";
}) {
  const progressWidth = useSharedValue(0);
  
  useEffect(() => {
    // Animate progress bar
    if (status === "starting") {
      progressWidth.value = withTiming(0.3, { duration: 300 });
    } else if (status === "in_progress") {
      progressWidth.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 })
        ),
        -1,
        true
      );
    } else if (status === "completed") {
      cancelAnimation(progressWidth);
      progressWidth.value = withTiming(1, { duration: 300 });
    }
    
    return () => {
      cancelAnimation(progressWidth);
    };
  }, [status]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  const getToolInfo = () => {
    switch (toolName) {
      case "web_search":
        return { icon: Globe, label: status === "completed" ? "Web search complete" : "Searching the web...", color: "#6366F1" };
      case "image_generation":
        return { icon: ImagePlus, label: status === "completed" ? "Image generated" : "Generating image...", color: "#10B981" };
      default:
        return { icon: Sparkles, label: status === "completed" ? `${toolName} complete` : `Using ${toolName}...`, color: "#F59E0B" };
    }
  };

  const { icon: Icon, label, color } = getToolInfo();
  const bgColor = isDark ? `${color}20` : `${color}15`;

  return (
    <Reanimated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.toolCallContainer, { backgroundColor: bgColor }]}
    >
      <View style={styles.toolCallHeader}>
        {status !== "completed" ? (
          <ActivityIndicator size="small" color={color} style={styles.toolCallSpinner} />
        ) : (
          <View style={[styles.toolCallCheckmark, { backgroundColor: color }]}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>✓</Text>
          </View>
        )}
        <Icon size={14} color={color} />
        <Text style={[styles.toolCallText, { color }]}>{label}</Text>
      </View>
      {/* Progress bar */}
      {status !== "completed" && (
        <View style={[styles.toolCallProgressBar, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
          <Reanimated.View style={[styles.toolCallProgressFill, { backgroundColor: color }, progressStyle]} />
        </View>
      )}
    </Reanimated.View>
  );
}

// Streaming content preview component - ChatGPT-like live Markdown rendering with cursor
function StreamingContentPreview({ content, isDark, colors }: { content: string; isDark: boolean; colors: any }) {
  const cursorOpacity = useSharedValue(1);
  
  useEffect(() => {
    // Blinking cursor animation
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 400 })
      ),
      -1,
      false
    );
    
    return () => {
      cancelAnimation(cursorOpacity);
    };
  }, []);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));
  
  if (!content) return null;
  
  return (
    <Reanimated.View
      entering={FadeIn.duration(200)}
      layout={Layout.springify()}
      style={styles.streamingContentContainer}
    >
      {/* Render streaming content with Markdown */}
      <Markdown
        style={{
          body: { color: colors.text, fontSize: 16, lineHeight: 24 },
          heading1: { color: colors.text, fontSize: 24, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
          heading2: { color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
          heading3: { color: colors.text, fontSize: 18, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
          strong: { fontWeight: "bold", color: colors.text },
          em: { fontStyle: "italic", color: colors.text },
          link: { color: "#6366f1", textDecorationLine: "underline" },
          blockquote: {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderLeftWidth: 3,
            borderLeftColor: "#6366f1",
            paddingLeft: 12,
            paddingVertical: 8,
            marginVertical: 8,
          },
          code_inline: {
            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
            color: "#6366f1",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          },
          code_block: {
            backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
            color: colors.text,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          },
          fence: {
            backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
            color: colors.text,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          },
          bullet_list: { marginVertical: 8 },
          ordered_list: { marginVertical: 8 },
          list_item: { marginVertical: 4 },
          paragraph: { color: colors.text, fontSize: 16, lineHeight: 24, marginVertical: 4 },
          text: { color: colors.text, fontSize: 16 },
        }}
      >
        {content}
      </Markdown>
      {/* Blinking cursor */}
      <Reanimated.View style={[styles.streamingCursor, cursorStyle, { backgroundColor: colors.text }]} />
    </Reanimated.View>
  );
}

export default function PersonalChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Route params
  const { conversationId: initialConversationId, agentId: initialAgentId } = route.params || {};

  // State
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [selectedAgent, setSelectedAgent] = useState<AIFriend | null>(null);

  // Fetch all agents to resolve initialAgentId if provided
  const { data: allAgents = [] } = useAllUserAgents();
  const [inputText, setInputText] = useState("");
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  
  // New modal-based AI tools state (matching ChatScreen)
  const [imageGenSheetMode, setImageGenSheetMode] = useState<"prompt" | "generate">("generate");
  const [imageGenType, setImageGenType] = useState<"image" | "meme">("image");
  const [streaming, setStreaming] = useState<StreamingState>({
    isStreaming: false,
    content: "",
    messageId: null,
    isThinking: false,
    thinkingContent: "",
    currentToolCall: null,
    reasoningEffort: null,
    error: null,
    userMessageId: null,
    assistantMessageId: null,
    generatedImageUrl: null,
  });
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<OptimisticUserMessage | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Refs
  const isInputFocused = useRef(false);
  const textInputRef = useRef<TextInput>(null);
  const wasKeyboardOpenForAttachments = useRef(false);
  const wasKeyboardOpenForImageGen = useRef(false);
  
  // Animated values for smooth color transitions (matching ChatScreen)
  const hasContent = useMemo(() => inputText.trim().length > 0 || attachedImages.length > 0, [inputText, attachedImages]);
  const isAIMessage = useMemo(() => inputText.toLowerCase().includes("@ai"), [inputText]);
  
  const colorAnimValue = useRef(new Animated.Value(0)).current;
  const gradientDefaultOpacity = useRef(new Animated.Value(1)).current;
  const gradientContentOpacity = useRef(new Animated.Value(0)).current;
  const gradientAIOpacity = useRef(new Animated.Value(0)).current;

  // Animate input colors based on state
  useEffect(() => {
    const targetValue = isAIMessage ? 2 : hasContent ? 1 : 0;
    
    Animated.spring(colorAnimValue, {
      toValue: targetValue,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
      velocity: 2,
    }).start();

    // Animate gradient layer opacities for smooth transitions
    Animated.parallel([
      Animated.timing(gradientDefaultOpacity, {
        toValue: targetValue === 0 ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(gradientContentOpacity, {
        toValue: targetValue === 1 ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(gradientAIOpacity, {
        toValue: targetValue === 2 ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [hasContent, isAIMessage, colorAnimValue, gradientDefaultOpacity, gradientContentOpacity, gradientAIOpacity]);

  // Interpolated values for smooth animations
  const animatedBorderColor = colorAnimValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      "transparent",
      "rgba(0, 122, 255, 0.5)",
      "rgba(20, 184, 166, 0.5)",
    ],
  });

  const animatedShadowOpacity = colorAnimValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.1, 0.3, 0.3],
  });

  const inputContainerShadowColor = useMemo(() => {
    if (isAIMessage) return "#14B8A6";
    if (hasContent) return "#007AFF";
    return "#000";
  }, [isAIMessage, hasContent]);
  
  const inputTextColor = useMemo(() => 
    isAIMessage ? "#14B8A6" : colors.text,
    [isAIMessage, colors.text]
  );
  
  const inputFontWeight = useMemo(() => 
    isAIMessage ? "600" as const : "400" as const,
    [isAIMessage]
  );

  // Handle input content size change - allows input to grow up to 5 lines
  const handleInputContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const { height } = event.nativeEvent.contentSize;
      const clampedHeight = Math.min(
        MAX_INPUT_HEIGHT,
        Math.max(MIN_INPUT_HEIGHT, height)
      );
      console.log('[PersonalChat] Content size changed:', height, '-> clamped:', clampedHeight);
      setInputHeight(clampedHeight);
    },
    []
  );

  // Refs
  const flatListRef = useRef<FlashList<MessageListItem>>(null);
  const isAtBottomRef = useRef(true); // Track if user is at bottom of list
  const hasScrolledToBottomRef = useRef(false); // Track if we've done initial scroll
  // inputRef replaced by textInputRef above

  // Fetch conversation details if we have an ID
  const { data: conversationData } = useQuery({
    queryKey: personalChatsKeys.conversation(conversationId || ""),
    queryFn: async () => {
      if (!conversationId || !user?.id) return null;
      const response = await api.get<PersonalConversation & { messages: PersonalMessage[] }>(
        `/api/personal-chats/${conversationId}?userId=${user.id}`
      );
      return response;
    },
    enabled: !!conversationId && !!user?.id,
  });

  // Get messages from conversation data
  const messages = conversationData?.messages ?? [];

  // Handle initial agent ID from route params (for new chats started with a specific agent)
  useEffect(() => {
    if (initialAgentId && allAgents.length > 0 && !conversationId) {
      const agent = allAgents.find(a => a.id === initialAgentId);
      if (agent) {
        setSelectedAgent(agent);
      }
    }
  }, [initialAgentId, allAgents, conversationId]);

  // Load agent from conversation data (aiFriend is included in the response)
  // Always sync the selected agent with the conversation's agent when conversation loads
  useEffect(() => {
    // The conversation data includes the aiFriend object (camelCase from backend)
    const aiFriendFromConversation = conversationData?.aiFriend;
    if (aiFriendFromConversation) {
      console.log("[PersonalChat] Setting agent from conversation:", aiFriendFromConversation.name);
      setSelectedAgent(aiFriendFromConversation);
    }
  }, [conversationData]);

  // Create messages list with date dividers and optimistic user message
  const messagesWithDividers = useMemo(() => {
    const result: MessageListItem[] = [];
    let lastDate: string | null = null;

    // Messages are typically sorted newest first from API, so we reverse for display
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedMessages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== lastDate) {
        result.push({
          id: `divider-${msgDate}`,
          isDateDivider: true,
          date: new Date(msg.createdAt),
        });
        lastDate = msgDate;
      }
      result.push(msg);
    });

    // Add optimistic user message if present (for immediate display while streaming)
    // Only add if it doesn't already exist in the real messages (prevent duplicates)
    if (optimisticUserMessage) {
      const alreadyExists = messages.some(
        (msg) => msg.role === "user" && msg.content === optimisticUserMessage.content
      );
      
      if (!alreadyExists) {
        const optimisticDate = optimisticUserMessage.createdAt.toDateString();
        if (optimisticDate !== lastDate) {
          result.push({
            id: `divider-${optimisticDate}`,
            isDateDivider: true,
            date: optimisticUserMessage.createdAt,
          });
        }
        // Create a PersonalMessage-like object for the optimistic message
        result.push({
          id: optimisticUserMessage.id,
          conversationId: conversationId || "",
          content: optimisticUserMessage.content,
          role: "user",
          imageUrl: optimisticUserMessage.imageUrl || null,
          generatedImageUrl: null,
          metadata: optimisticUserMessage.imageUrl ? { attachedImageUrls: [optimisticUserMessage.imageUrl] } : {},
          createdAt: optimisticUserMessage.createdAt.toISOString(),
        } as PersonalMessage);
      }
    }

    return result;
  }, [messages, optimisticUserMessage, conversationId]);

  // Scroll to bottom immediately when messages first load (without animation)
  useEffect(() => {
    if (messagesWithDividers.length > 0 && !hasScrolledToBottomRef.current) {
      // Use a small timeout to ensure FlashList has fully rendered
      const timeout = setTimeout(() => {
        try {
          if (flatListRef.current && messagesWithDividers.length > 0) {
            // Scroll to the very end (bottom of last message)
            flatListRef.current.scrollToEnd({ animated: false });
            hasScrolledToBottomRef.current = true;
            isAtBottomRef.current = true;
            console.log("[PersonalChat] Initial scroll to bottom (no animation)");
          }
        } catch (error) {
          console.log("[PersonalChat] Initial scroll error:", error);
        }
      }, 75);
      
      return () => clearTimeout(timeout);
    }
  }, [messagesWithDividers.length]);

  // Reset scroll flag when conversation changes
  useEffect(() => {
    hasScrolledToBottomRef.current = false;
  }, [conversationId]);

  // Streaming hook for real-time AI responses
  const { startStreaming, stopStreaming: stopStreamingHook } = usePersonalChatStreaming({
    onUserMessage: (message) => {
      console.log("[PersonalChat] User message confirmed:", message.id);
      // Don't clear optimistic message yet - keep it visible until streaming completes
      // This prevents the message from disappearing during streaming
      setStreaming((prev) => ({ ...prev, userMessageId: message.id }));
      
      // Update query cache directly with the saved user message (no refetch needed)
      if (conversationId) {
        queryClient.setQueryData(
          personalChatsKeys.conversation(conversationId),
          (old: any) => {
            if (!old) return old;
            // Add the confirmed user message to the messages array
            const messageExists = old.messages?.some((m: any) => m.id === message.id);
            if (!messageExists) {
              return {
                ...old,
                messages: [...(old.messages || []), message],
              };
            }
            return old;
          }
        );
      }
    },
    onThinkingStart: () => {
      console.log("[PersonalChat] Thinking started");
      setStreaming((prev) => ({ 
        ...prev, 
        isThinking: true, 
        thinkingContent: "" 
      }));
    },
    onThinkingDelta: (content) => {
      setStreaming((prev) => ({ 
        ...prev, 
        thinkingContent: prev.thinkingContent + content 
      }));
    },
    onThinkingEnd: (content) => {
      console.log("[PersonalChat] Thinking ended");
      setStreaming((prev) => ({ 
        ...prev, 
        isThinking: false, 
        thinkingContent: content 
      }));
    },
    onToolCallStart: (toolName, toolInput) => {
      console.log("[PersonalChat] Tool call started:", toolName);
      setStreaming((prev) => ({ 
        ...prev, 
        currentToolCall: { name: toolName, status: "starting" } 
      }));
      if (toolName === "web_search") {
        setIsSearchingWeb(true);
      }
    },
    onToolCallProgress: (data) => {
      setStreaming((prev) => ({
        ...prev,
        currentToolCall: prev.currentToolCall 
          ? { ...prev.currentToolCall, status: "in_progress" }
          : null,
      }));
    },
    onToolCallEnd: (toolName, sources) => {
      console.log("[PersonalChat] Tool call ended:", toolName, sources?.length, "sources");
      setStreaming((prev) => ({
        ...prev,
        currentToolCall: prev.currentToolCall 
          ? { ...prev.currentToolCall, status: "completed", sources }
          : null,
      }));
      if (toolName === "web_search") {
        setIsSearchingWeb(false);
      }
      // Clear tool call after brief delay to show completion
      setTimeout(() => {
        setStreaming((prev) => ({ ...prev, currentToolCall: null }));
      }, 500);
    },
    onContentDelta: (delta, accumulated) => {
      setStreaming((prev) => ({ ...prev, content: accumulated }));
      // Auto-scroll to bottom when content is streaming
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => {
          try {
            flatListRef.current?.scrollToEnd({ animated: false });
          } catch (e) {
            // Ignore scroll errors
          }
        });
      }
    },
    onContentEnd: (content) => {
      console.log("[PersonalChat] Content ended, length:", content.length);
      setStreaming((prev) => ({ ...prev, content }));
    },
    onImageGenerated: (imageId, imageUrl) => {
      console.log("[PersonalChat] Image generated:", imageId, "URL:", imageUrl);
      if (imageUrl) {
        // Update streaming state immediately with the generated image URL
        setStreaming((prev) => ({
          ...prev,
          generatedImageUrl: imageUrl,
          currentToolCall: null, // Clear the shimmer animation
        }));
      }
    },
    onAssistantMessage: (message) => {
      console.log("[PersonalChat] Assistant message saved:", message.id);
      console.log("[PersonalChat] Assistant message has generatedImageUrl:", message.generatedImageUrl);
      
      // Clear tool call if this message contains a generated image
      // This ensures the shimmer stops and the image displays immediately
      const shouldClearToolCall = message.generatedImageUrl && streaming.currentToolCall?.name === "image_generation";
      
      setStreaming((prev) => ({ 
        ...prev, 
        assistantMessageId: message.id, 
        messageId: message.id,
        generatedImageUrl: message.generatedImageUrl || null,
        currentToolCall: shouldClearToolCall ? null : prev.currentToolCall,
      }));
      
      // Update query cache directly with the saved assistant message (no refetch needed)
      if (conversationId) {
        queryClient.setQueryData(
          personalChatsKeys.conversation(conversationId),
          (old: any) => {
            if (!old) return old;
            // Add the confirmed assistant message to the messages array
            const messageExists = old.messages?.some((m: any) => m.id === message.id);
            if (!messageExists) {
              console.log("[PersonalChat] Adding assistant message to cache with image:", message.generatedImageUrl);
              return {
                ...old,
                messages: [...(old.messages || []), message],
              };
            }
            return old;
          }
        );
      }
    },
    onDone: async (updatedTitle) => {
      console.log("[PersonalChat] Stream completed, title:", updatedTitle);
      
      // Update conversation title in cache if provided
      if (conversationId && updatedTitle) {
        queryClient.setQueryData(
          personalChatsKeys.conversation(conversationId),
          (old: any) => {
            if (!old) return old;
            return { ...old, title: updatedTitle };
          }
        );
      }
      
      // Silently invalidate in background to ensure fresh data (no refetch = no flash)
      // This will be picked up on next render
      if (conversationId) {
        queryClient.invalidateQueries({ 
          queryKey: personalChatsKeys.conversation(conversationId),
          refetchType: 'none', // Don't trigger immediate refetch
        });
      }
      queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || ""),
        refetchType: 'none', // Don't trigger immediate refetch
      });
      
      // Small delay to ensure cache updates have propagated and component has re-rendered
      // with the final message before clearing streaming state
      // This creates a smooth transition from streaming to final message
      setTimeout(() => {
        // Clear optimistic message now that streaming is done
        // The real messages should already be in the cache from onUserMessage/onAssistantMessage
        setOptimisticUserMessage(null);
        
        // Clear streaming state smoothly - triggers FadeOut animation
        setStreaming({
          isStreaming: false,
          content: "",
          messageId: null,
          isThinking: false,
          thinkingContent: "",
          currentToolCall: null,
          reasoningEffort: null,
          error: null,
          userMessageId: null,
          assistantMessageId: null,
        });
        
        // Scroll to bottom smoothly after transition
        requestAnimationFrame(() => {
          try {
            flatListRef.current?.scrollToEnd({ animated: true });
          } catch (e) {
            // Ignore scroll errors
          }
        });
      }, 100); // Small delay for smooth transition
    },
    onError: (error) => {
      console.error("[PersonalChat] Streaming error:", error);
      setStreaming((prev) => ({ 
        ...prev, 
        isStreaming: false, 
        isThinking: false, 
        currentToolCall: null,
        error 
      }));
      // Don't clear optimistic message immediately - let onStreamingComplete handle it
      // This prevents the message from flickering if it was already saved
      
      // Don't show error alert for HTTP errors - the message may have been saved
      // Just log and let onStreamingComplete handle cleanup
      if (!error.includes("HTTP")) {
        Alert.alert("Error", error || "Failed to get AI response. Please try again.");
      }
    },
    // Always called when streaming finishes (success or error)
    // This ensures we have the latest data without causing a flash
    onStreamingComplete: async () => {
      console.log("[PersonalChat] Streaming complete");
      
      // Clear optimistic message if not already cleared
      setOptimisticUserMessage(null);
      
      // Refetch conversations list to get updated title immediately
      // This updates both the chat list page and conversation history drawer
      // Small delay ensures backend has finished writing the title
      setTimeout(() => {
        if (conversationId) {
          queryClient.invalidateQueries({ 
            queryKey: personalChatsKeys.conversation(conversationId),
            refetchType: 'none', // Mark as stale but don't refetch immediately
          });
        }
        queryClient.invalidateQueries({ 
          queryKey: personalChatsKeys.conversations(user?.id || ""),
          refetchType: 'active', // Refetch active queries to show updated title
        });
      }, 300);
      
      // Scroll to bottom smoothly
      requestAnimationFrame(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch (e) {
          // Ignore scroll errors
        }
      });
    },
  });

  // Send message using SSE streaming for real-time ChatGPT-like experience
  const sendMessage = useCallback(async (content: string, images: string[]) => {
    // Track the active conversation ID (may be created during request)
    let activeConversationId = conversationId;

    try {
      // If no conversation exists, create one first
      if (!activeConversationId) {
        const createResponse = await api.post<{ success: boolean; conversation: PersonalConversation }>(
          "/api/personal-chats",
          {
            userId: user?.id,
            aiFriendId: selectedAgent?.id,
          }
        );
        if (createResponse.success) {
          activeConversationId = createResponse.conversation.id;
          setConversationId(activeConversationId);
        } else {
          throw new Error("Failed to create conversation");
        }
      }

      console.log("[PersonalChat] Starting streaming message to:", activeConversationId);

      // Create optimistic user message for immediate display
      const optimisticId = `optimistic-${Date.now()}`;
      setOptimisticUserMessage({
        id: optimisticId,
        content,
        imageUrl: images.length > 0 ? images[0] : null,
        createdAt: new Date(),
      });

      // Initialize streaming state
      setStreaming({
        isStreaming: true,
        content: "",
        messageId: null,
        isThinking: true,
        thinkingContent: "",
        currentToolCall: null,
        reasoningEffort: null,
        error: null,
        userMessageId: null,
        assistantMessageId: null,
      });

      // Scroll to bottom when sending
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch (e) {
          // Ignore scroll errors
        }
      });

      // Start SSE streaming
      await startStreaming(
        activeConversationId,
        user?.id || "",
        content,
        {
          imageUrl: images.length > 0 ? images[0] : undefined,
          aiFriendId: selectedAgent?.id,
        }
      );

    } catch (error: any) {
      console.error("[PersonalChat] Message error:", error);
      setStreaming({
        isStreaming: false,
        content: "",
        messageId: null,
        isThinking: false,
        thinkingContent: "",
        currentToolCall: null,
        reasoningEffort: null,
        error: error?.message || "Failed to send message",
        userMessageId: null,
        assistantMessageId: null,
      });
      setOptimisticUserMessage(null);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  }, [conversationId, user?.id, selectedAgent?.id, queryClient, startStreaming]);

  // Scroll to bottom helper - wrapped in try/catch to prevent crashes
  const scrollToBottom = useCallback((animated = true) => {
    try {
      if (flatListRef.current && messagesWithDividers.length > 0) {
        flatListRef.current.scrollToEnd({ animated });
      }
      isAtBottomRef.current = true;
    } catch (error) {
      console.log("[PersonalChat] Scroll error (non-critical):", error);
    }
  }, [messagesWithDividers.length]);

  // Handle send message
  const handleSend = useCallback(() => {
    const trimmedText = inputText.trim();
    if (!trimmedText && attachedImages.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    // Scroll to bottom when sending to see the response
    isAtBottomRef.current = true;

    // Send message with streaming
    sendMessage(trimmedText, attachedImages);

    setInputText("");
    setAttachedImages([]);
    setInputHeight(MIN_INPUT_HEIGHT);
  }, [inputText, attachedImages, sendMessage]);

  // Handle stop generation - aborts the SSE stream and clears UI state
  const handleStopGeneration = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Stop the SSE stream
    stopStreamingHook();
    // Clear the streaming UI state
    setStreaming({ 
      isStreaming: false, 
      content: "", 
      messageId: null,
      isThinking: false,
      thinkingContent: "",
      currentToolCall: null,
      reasoningEffort: null,
      error: null,
      userMessageId: null,
      assistantMessageId: null,
    });
    setOptimisticUserMessage(null);
    setIsSearchingWeb(false);
  }, [stopStreamingHook]);

  // Handle agent selection
  const handleAgentSelect = useCallback(async (agent: AIFriend | null) => {
    setSelectedAgent(agent);
    
    // If we have an existing conversation, update it to use the new agent
    if (conversationId && agent && user?.id) {
      try {
        await api.patch(`/api/personal-chats/${conversationId}`, {
          userId: user.id,
          aiFriendId: agent.id,
        });
        // Invalidate the conversation query to refresh data
        queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversation(conversationId) });
      } catch (error) {
        console.error("Failed to update conversation agent:", error);
        // Don't show an error to user - this is non-critical
      }
    }
  }, [conversationId, queryClient, user?.id]);

  // Handle selecting a conversation from drawer
  const handleSelectConversation = useCallback((conversation: PersonalConversation) => {
    setConversationId(conversation.id);
    navigation.setParams({ conversationId: conversation.id });
  }, [navigation]);

  // Handle image attachment
  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newImages = result.assets.map((asset) => asset.uri);
        setAttachedImages((prev) => [...prev, ...newImages].slice(0, 4)); // Max 4 images
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  }, []);

  // Handle camera
  const handleTakePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAttachedImages((prev) => [...prev, result.assets[0].uri].slice(0, 4));
      }
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  }, []);

  // Remove attached image
  const handleRemoveImage = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handler for picking a single reference image (for image generation)
  const pickReferenceImage = async (): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedImage = result.assets[0];
        
        // Compress and resize
        const manipResult = await ImageManipulator.manipulateAsync(
          pickedImage.uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        return manipResult.uri;
      }
      return null;
    } catch (error) {
      console.error("[PersonalChat] Error picking reference image:", error);
      Alert.alert("Error", "Failed to pick reference image");
      return null;
    }
  };

  // Handler to open Image Generator in prompt mode
  const handleOpenImageGenerator = (type: "image" | "meme") => {
    console.log("[PersonalChat] Opening image generator in prompt mode for:", type);
    setShowAttachmentsMenu(false);
    setImageGenType(type);
    setImageGenSheetMode("prompt");
    // Set a placeholder to trigger the sheet visibility
    setGeneratedImageUrl("");
    setShowImageGenerator(true);
  };

  // Handler for image generation from prompt modal (with reference images)
  const handleImageGenerateFromPrompt = async (prompt: string, referenceImages: string[]) => {
    console.log("[PersonalChat] Image generate from prompt:", prompt, "refs:", referenceImages.length);
    
    // Transition to generating phase
    setImageGenSheetMode("generate");
    
    // Track keyboard state
    if (isInputFocused.current) {
      wasKeyboardOpenForImageGen.current = true;
      Keyboard.dismiss();
    }
    
    try {
      setIsGeneratingImage(true);
      
      // Handle reference images upload if any
      if (referenceImages.length > 0) {
        // Call generation API with reference images
        // For now, just generate without references (matching existing behavior)
        console.log("[PersonalChat] Generating with reference images:", referenceImages.length);
      }
      
      // Call the existing image generation
      const response = await api.post<{ success: boolean; imageUrl: string }>("/api/images/generate", {
        prompt,
      });
      
      if (response.success) {
        setGeneratedImageUrl(response.imageUrl);
      }
    } catch (error) {
      console.error("[PersonalChat] Image generation failed:", error);
      Alert.alert("Error", "Failed to generate image");
      // Reset sheet mode if failed
      setImageGenSheetMode("prompt");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Handle image generation (existing - used for edit from preview)
  const handleGenerateImage = useCallback(async (prompt: string) => {
    try {
      setIsGeneratingImage(true);
      // TODO: Call your image generation API
      const response = await api.post<{ success: boolean; imageUrl: string }>("/api/images/generate", {
        prompt,
      });
      if (response.success) {
        setGeneratedImageUrl(response.imageUrl);
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      Alert.alert("Error", "Failed to generate image");
    } finally {
      setIsGeneratingImage(false);
    }
  }, []);

  // Handle image generation accept
  const handleAcceptGeneratedImage = useCallback((caption: string) => {
    if (generatedImageUrl) {
      setAttachedImages((prev) => [...prev, generatedImageUrl].slice(0, 4));
      setGeneratedImageUrl(null);
      setShowImageGenerator(false);
    }
  }, [generatedImageUrl]);

  // Handle agent creation
  const handleCreateAgent = useCallback(async (
    name: string,
    personality: string,
    tone: string,
    engagementMode: "on-call" | "percentage" | "off",
    engagementPercent?: number
  ) => {
    try {
      if (!user?.id) {
        Alert.alert("Error", "User not logged in");
        return;
      }

      // Get user's chats - we need a chatId to create an AI friend
      // Personal AI friends are still tied to a chat, but can be used across all personal conversations
      const chatsResponse = await api.get<Array<{ id: string; name: string }>>(
        `/api/chats?userId=${user.id}`
      );

      // If user has no chats, we need to create one first or show an error
      if (!chatsResponse || chatsResponse.length === 0) {
        Alert.alert(
          "No Chats Available",
          "You need to be a member of at least one group chat to create an AI friend. AI friends can be used in both group chats and personal chats."
        );
        return;
      }

      // Use the first available chat (the AI friend can still be used in personal chats)
      const chatId = chatsResponse[0].id;

      const response = await api.post<{ success: boolean; aiFriend: AIFriend }>("/api/ai-friends", {
        chatId,
        userId: user.id,
        name,
        personality,
        tone,
        engagementMode,
        engagementPercent,
      });
      
      if (response.success) {
        const newAgent = response.aiFriend;
        
        // Set the newly created agent as the active agent
        setSelectedAgent(newAgent);
        
        // If we have an existing conversation, update it to use the new agent
        if (conversationId) {
          try {
            await api.patch(`/api/personal-chats/${conversationId}`, {
              userId: user.id,
              aiFriendId: newAgent.id,
            });
            // Invalidate the conversation query to refresh data
            queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversation(conversationId) });
          } catch (error) {
            console.error("Failed to update conversation agent:", error);
            // Don't show an error to user - this is non-critical
          }
        }
        
        // Close the modal
        setShowCreateAgentModal(false);
        
        // Haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Invalidate agents query to refresh the list
        queryClient.invalidateQueries({ queryKey: personalChatsKeys.allAgents(user.id) });
      }
    } catch (error: any) {
      console.error("Failed to create agent:", error);
      const errorMessage = error?.message || "Failed to create agent. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  }, [user?.id, conversationId, queryClient]);

  // Handle opening attachments menu

  // Handle web search action
  const handleWebSearch = useCallback(() => {
    // Toggle web search in the message - for now just show a hint
    if (inputText.trim()) {
      setInputText((prev) => prev.startsWith("/search ") ? prev : `/search ${prev}`);
    } else {
      setInputText("/search ");
    }
    textInputRef.current?.focus();
  }, [inputText]);

  // Handle new conversation from drawer
  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setInputText("");
    setAttachedImages([]);
    textInputRef.current?.focus();
  }, []);

  // Format date for dividers
  const formatDateDivider = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
  };

  // Render message item
  const renderMessage = useCallback(
    ({ item, index }: { item: MessageListItem; index: number }) => {
      // Date divider
      if ("isDateDivider" in item && item.isDateDivider) {
        return (
          <View style={styles.dateDividerContainer}>
            <View style={[styles.dateDividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateDividerText, { color: colors.textSecondary }]}>
              {formatDateDivider(item.date)}
            </Text>
            <View style={[styles.dateDividerLine, { backgroundColor: colors.border }]} />
          </View>
        );
      }

      const message = item as PersonalMessage;
      const isUser = message.role === "user";
      const metadata = message.metadata as PersonalMessageMetadata | undefined;

      // User message - right-aligned bubble
      if (isUser) {
        return (
          <Reanimated.View
            entering={FadeInUp.duration(200).springify()}
            style={styles.userMessageContainer}
          >
            {/* Attached images preview */}
            {metadata?.attachedImageUrls && metadata.attachedImageUrls.length > 0 && (
              <View style={styles.messageImagesContainer}>
                {metadata.attachedImageUrls.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={styles.messageImage}
                    contentFit="cover"
                  />
                ))}
              </View>
            )}
            <View
              style={[
                styles.userBubble,
                { backgroundColor: "#6366f1" },
              ]}
            >
              <Text style={styles.userMessageText}>{message.content}</Text>
            </View>
            <Text style={[styles.messageTime, { color: colors.textTertiary, textAlign: "right" }]}>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </Reanimated.View>
        );
      }

      // AI message - full width, no bubble
      return (
        <Reanimated.View
          entering={FadeInUp.duration(200).springify()}
          style={styles.aiMessageContainer}
        >
          {/* Web search citations */}
          {metadata?.webSearchResults && metadata.webSearchResults.length > 0 && (
            <View style={styles.citationsContainer}>
              <View style={styles.citationsHeader}>
                <Globe size={12} color={colors.textSecondary} />
                <Text style={[styles.citationsTitle, { color: colors.textSecondary }]}>
                  Sources
                </Text>
              </View>
              {metadata.webSearchResults.slice(0, 3).map((result, idx) => (
                <Pressable
                  key={idx}
                  style={[styles.citationItem, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}
                  onPress={() => {
                    // Open URL
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[styles.citationTitle, { color: colors.text }]} numberOfLines={1}>
                    {result.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* AI Response with Markdown */}
          <Markdown
            style={{
              body: { color: colors.text, fontSize: 16, lineHeight: 24 },
              heading1: {
                color: colors.text,
                fontSize: 24,
                fontWeight: "bold",
                marginTop: 16,
                marginBottom: 8,
              },
              heading2: {
                color: colors.text,
                fontSize: 20,
                fontWeight: "bold",
                marginTop: 14,
                marginBottom: 6,
              },
              heading3: {
                color: colors.text,
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 12,
                marginBottom: 4,
              },
              strong: { fontWeight: "bold", color: colors.text },
              em: { fontStyle: "italic", color: colors.text },
              link: { color: "#6366f1", textDecorationLine: "underline" },
              blockquote: {
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderLeftWidth: 3,
                borderLeftColor: "#6366f1",
                paddingLeft: 12,
                paddingVertical: 8,
                marginVertical: 8,
              },
              code_inline: {
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                color: "#6366f1",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              },
              code_block: {
                backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
                color: colors.text,
                padding: 12,
                borderRadius: 8,
                marginVertical: 8,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              },
              fence: {
                backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
                color: colors.text,
                padding: 12,
                borderRadius: 8,
                marginVertical: 8,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              },
              bullet_list: { marginVertical: 8 },
              ordered_list: { marginVertical: 8 },
              list_item: { marginVertical: 4 },
              paragraph: { color: colors.text, fontSize: 16, lineHeight: 24, marginVertical: 4 },
              text: { color: colors.text, fontSize: 16 },
              hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
            }}
          >
            {message.content}
          </Markdown>

          {/* Generated image preview */}
          {message.generatedImageUrl && (
            <Pressable 
              style={styles.generatedImageContainer}
              onPress={() => {
                setSelectedImageUrl(message.generatedImageUrl);
                setImageViewerVisible(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Image
                source={{ uri: message.generatedImageUrl }}
                style={styles.generatedImage}
                contentFit="cover"
              />
              {metadata?.generatedImagePrompt && (
                <Text style={[styles.generatedImageCaption, { color: colors.textSecondary }]}>
                  "{metadata.generatedImagePrompt}"
                </Text>
              )}
            </Pressable>
          )}

          <Text style={[styles.messageTime, { color: colors.textTertiary }]}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Reanimated.View>
      );
    },
    [colors, isDark]
  );

  // Empty state component - positioned towards top for keyboard visibility
  const EmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateContent}>
        <View style={[styles.emptyStateIcon, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }]}>
          <Image
            source={require("../../assets/vibechat icon main.png")}
            style={{ width: 56, height: 56, borderRadius: 28 }}
            contentFit="cover"
          />
        </View>
        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
          {selectedAgent ? `Chat with ${selectedAgent.name}` : "Start a Conversation"}
        </Text>
        <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
          {selectedAgent
            ? selectedAgent.personality || "Your AI companion is ready to chat"
            : "Select an agent or start typing to begin"}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: Platform.OS === "ios" ? "transparent" : colors.background,
          },
        ]}
      >
        {Platform.OS === "ios" && (
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={
            isDark
              ? ["rgba(20,20,25,0.9)", "rgba(20,20,25,0.7)"]
              : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.7)"]
          }
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.headerContent}>
          {/* Back button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            style={styles.headerButton}
          >
            <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
          </Pressable>

          {/* Agent selector */}
          <AgentSelectorDropdown
            selectedAgent={selectedAgent}
            onAgentSelect={handleAgentSelect}
            onCreateNewAgent={() => setShowCreateAgentModal(true)}
          />

          {/* Menu button for conversation history */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsDrawerOpen(true);
            }}
            style={styles.headerButton}
          >
            <Menu size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Messages List */}
      <View style={styles.messagesContainer}>
        {messagesWithDividers.length === 0 && !streaming.isStreaming ? (
          <EmptyState />
        ) : (
          <FlashList
            ref={flatListRef}
            data={messagesWithDividers}
            renderItem={renderMessage}
            estimatedItemSize={100}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 20, // Extra padding to ensure messages are visible above input
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              // Only auto-scroll if user is already at the bottom
              if (isAtBottomRef.current && hasScrolledToBottomRef.current) {
                requestAnimationFrame(() => {
                  try {
                    if (flatListRef.current && messagesWithDividers.length > 0) {
                      flatListRef.current.scrollToEnd({ animated: true });
                    }
                  } catch (error) {
                    // Ignore scroll errors - they're non-critical
                    console.log("[PersonalChat] onContentSizeChange scroll error:", error);
                  }
                });
              }
            }}
            onScroll={(event) => {
              // Track if user is at bottom
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const paddingToBottom = 50;
              const isNowAtBottom = 
                layoutMeasurement.height + contentOffset.y >= 
                contentSize.height - paddingToBottom;
              isAtBottomRef.current = isNowAtBottom;
            }}
            ListFooterComponent={
              streaming.isStreaming ? (
                <Reanimated.View 
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                  style={styles.streamingContainer}
                >
                  {/* Show thinking indicator when AI is reasoning */}
                  {streaming.isThinking && (
                    <ThinkingIndicator 
                      isDark={isDark} 
                      colors={colors} 
                      content={streaming.thinkingContent} 
                    />
                  )}
                  
                  {/* Show tool call indicator */}
                  {streaming.currentToolCall && streaming.currentToolCall.name !== "image_generation" && (
                    <ToolCallIndicator 
                      toolName={streaming.currentToolCall.name} 
                      isDark={isDark} 
                      colors={colors}
                      status={streaming.currentToolCall.status}
                    />
                  )}
                  
                  {/* Show image generation shimmer */}
                  {streaming.currentToolCall && streaming.currentToolCall.name === "image_generation" && !streaming.generatedImageUrl && (
                    <ImageGenerationShimmer isDark={isDark} colors={colors} />
                  )}
                  
                  {/* Show generated image */}
                  {streaming.generatedImageUrl && (
                    <Reanimated.View
                      entering={FadeInUp.duration(300).springify()}
                      style={styles.generatedImageContainer}
                    >
                      <Pressable
                        onPress={() => {
                          setSelectedImageUrl(streaming.generatedImageUrl);
                          setImageViewerVisible(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Image
                          source={{ uri: streaming.generatedImageUrl }}
                          style={styles.generatedImage}
                          contentFit="cover"
                        />
                      </Pressable>
                    </Reanimated.View>
                  )}
                  
                  {/* Show streaming content with live Markdown rendering */}
                  {streaming.content && (
                    <StreamingContentPreview 
                      content={streaming.content} 
                      isDark={isDark} 
                      colors={colors} 
                    />
                  )}
                  
                  {/* Show typing indicator only when waiting for first content */}
                  {!streaming.content && !streaming.isThinking && !streaming.currentToolCall && (
                    <View style={styles.typingIndicatorContainer}>
                      <TypingIndicator isDark={isDark} />
                      <Text style={[styles.typingIndicatorText, { color: colors.textSecondary }]}>
                        Preparing response...
                      </Text>
                    </View>
                  )}
                </Reanimated.View>
              ) : null
            }
          />
        )}
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: Platform.OS === "ios" ? insets.bottom : 8,
              backgroundColor: Platform.OS === "ios" ? "transparent" : colors.background,
            },
          ]}
        >
          {Platform.OS === "ios" && (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={
              isDark
                ? ["rgba(20,20,25,0.95)", "rgba(20,20,25,0.98)"]
                : ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.98)"]
            }
            style={StyleSheet.absoluteFill}
          />

          {/* Attached images preview */}
          {attachedImages.length > 0 && (
            <Reanimated.View entering={FadeIn.duration(200)} style={styles.attachedImagesContainer}>
              {attachedImages.map((uri, index) => (
                <View key={index} style={styles.attachedImageWrapper}>
                  <Image source={{ uri }} style={styles.attachedImage} contentFit="cover" />
                  <Pressable
                    onPress={() => handleRemoveImage(index)}
                    style={styles.removeImageButton}
                  >
                    <X size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </Reanimated.View>
          )}

          <View style={{ width: "100%", paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                {/* Image Generation Docked Pill */}
                <View style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, alignItems: 'center', zIndex: 100, paddingBottom: 24 }} pointerEvents="box-none">
                    <ImageGenerationPill
                    isVisible={!!generatedImageUrl && !showImageGenerator}
                    isProcessing={isGeneratingImage}
                    onPress={() => {
                        wasKeyboardOpenForImageGen.current = isInputFocused.current;
                        if (isInputFocused.current) {
                        Keyboard.dismiss();
                        }
                        setShowImageGenerator(true);
                    }}
                    style={{ position: 'relative', bottom: 0 }}
                    />
                </View>

                {/* Attachments Menu Button */}
                <Pressable
                    onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    wasKeyboardOpenForAttachments.current = isInputFocused.current;
                    if (isInputFocused.current) {
                        Keyboard.dismiss();
                    }
                    setShowAttachmentsMenu(true);
                    }}
                    disabled={isGeneratingImage}
                >
                    <View
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        overflow: "hidden",
                        shadowColor: "#007AFF",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.1,
                        shadowRadius: 6,
                        elevation: 3,
                    }}
                    pointerEvents="box-only"
                    >
                    <BlurView
                        intensity={Platform.OS === "ios" ? 50 : 80}
                        tint={colors.blurTint}
                        style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                        borderRadius: 19,
                        overflow: "hidden",
                        }}
                    >
                        <LinearGradient
                        colors={isDark ? [
                            "rgba(255, 255, 255, 0.12)",
                            "rgba(255, 255, 255, 0.08)",
                            "rgba(255, 255, 255, 0.04)",
                        ] : [
                            "rgba(0, 0, 0, 0.04)",
                            "rgba(0, 0, 0, 0.02)",
                            "rgba(0, 0, 0, 0.01)",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                        />
                        <Plus size={20} color={colors.text} />
                    </BlurView>
                    </View>
                </Pressable>

                {/* Input Field */}
                <View
                    style={{
                    flex: 1,
                    }}
                >
                    <Animated.View
                    style={{
                        borderRadius: 20,
                        backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7",
                        shadowColor: inputContainerShadowColor,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: animatedShadowOpacity,
                        shadowRadius: 8,
                        elevation: 3,
                        borderWidth: 1.5,
                        borderColor: animatedBorderColor,
                        overflow: 'hidden',
                    }}
                    >
                        {/* Layered animated gradient backgrounds for smooth color transitions */}
                        {/* Default state gradient */}
                        <Animated.View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: gradientDefaultOpacity,
                        }}
                        pointerEvents="none"
                        >
                            <LinearGradient
                                colors={isDark ? [
                                    "rgba(255, 255, 255, 0.12)",
                                    "rgba(255, 255, 255, 0.08)",
                                    "rgba(255, 255, 255, 0.04)",
                                ] : [
                                    "rgba(0, 0, 0, 0.06)",
                                    "rgba(0, 0, 0, 0.04)",
                                    "rgba(0, 0, 0, 0.02)",
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                        
                        {/* Has content state gradient (blue) */}
                        <Animated.View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: gradientContentOpacity,
                        }}
                        pointerEvents="none"
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(0, 122, 255, 0.20)",
                                    "rgba(0, 122, 255, 0.12)",
                                    "rgba(0, 122, 255, 0.05)",
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                        
                        {/* AI message state gradient (green) */}
                        <Animated.View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: gradientAIOpacity,
                        }}
                        pointerEvents="none"
                        >
                            <LinearGradient
                                colors={[
                                    "rgba(20, 184, 166, 0.25)",
                                    "rgba(20, 184, 166, 0.15)",
                                    "rgba(20, 184, 166, 0.08)",
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>

                        <TextInput
                            ref={textInputRef}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={attachedImages.length > 0 ? "Add a caption (optional)" : "Message"}
                            placeholderTextColor={colors.inputPlaceholder}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                fontSize: 16,
                                lineHeight: 20,
                                color: inputTextColor,
                                fontWeight: inputFontWeight,
                                minHeight: MIN_INPUT_HEIGHT,
                                maxHeight: MAX_INPUT_HEIGHT,
                            }}
                            multiline={true}
                            scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
                            maxLength={4000}
                            onSubmitEditing={() => handleSend()}
                            blurOnSubmit={false}
                            keyboardType="default"
                            keyboardAppearance={isDark ? "dark" : "light"}
                            returnKeyType="default"
                            enablesReturnKeyAutomatically={false}
                            onFocus={() => {
                                isInputFocused.current = true;
                            }}
                            onBlur={() => {
                                isInputFocused.current = false;
                            }}
                            onContentSizeChange={handleInputContentSizeChange}
                            showSoftInputOnFocus={true}
                            caretHidden={false}
                        />
                    </Animated.View>
                </View>

                {/* Send Button */}
                <Pressable
                    onPress={streaming.isStreaming ? handleStopGeneration : handleSend}
                    disabled={!streaming.isStreaming && !inputText.trim() && attachedImages.length === 0}
                >
                    <Animated.View
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        overflow: "hidden",
                        shadowColor: isAIMessage
                            ? "#14B8A6"
                            : hasContent
                            ? "#007AFF"
                            : "#007AFF",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: animatedShadowOpacity,
                        shadowRadius: 6,
                        elevation: 3,
                    }}
                    >
                    <BlurView
                        intensity={Platform.OS === "ios" ? 50 : 80}
                        tint={colors.blurTint}
                        style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                        backgroundColor: streaming.isStreaming 
                            ? "#ef4444" 
                            : isAIMessage
                            ? "#14B8A6"
                            : hasContent
                            ? "#007AFF"
                            : "transparent",
                        }}
                    >
                        {streaming.isStreaming ? (
                            <StopCircle size={20} color="#fff" fill="#fff" />
                        ) : (
                            <ArrowUp 
                                size={20} 
                                color={hasContent ? "#fff" : colors.text} 
                                strokeWidth={2.5} 
                            />
                        )}
                    </BlurView>
                    </Animated.View>
                </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Conversation History Drawer */}
      <ConversationHistoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />

      {/* Personal Attachments Menu */}
      <PersonalAttachmentsMenu
        visible={showAttachmentsMenu}
        onClose={() => setShowAttachmentsMenu(false)}
        onTakePhoto={handleTakePhoto}
        onPickImage={handlePickImage}
        onGenerateImage={() => handleOpenImageGenerator("image")}
        onWebSearch={handleWebSearch}
      />

      {/* Create AI Friend Modal */}
      <CreateAIFriendModal
        visible={showCreateAgentModal}
        onClose={() => setShowCreateAgentModal(false)}
        onCreate={handleCreateAgent}
        hideEngagementMode={true}
      />

      {/* Image Generator Sheet */}
      <ImageGeneratorSheet
        isVisible={showImageGenerator}
        onClose={() => {
          setShowImageGenerator(false);
          setGeneratedImageUrl(null);
          setImageGenSheetMode("generate"); // Reset mode
        }}
        onMinimize={() => {
          setShowImageGenerator(false);
          // Reset mode when minimizing from prompt phase
          if (imageGenSheetMode === "prompt") {
            setGeneratedImageUrl(null);
          }
        }}
        imageUrl={generatedImageUrl}
        isProcessing={isGeneratingImage}
        onAccept={handleAcceptGeneratedImage}
        onEdit={handleGenerateImage}
        // New props for prompt mode
        mode={imageGenSheetMode}
        generationType={imageGenType}
        onGenerate={handleImageGenerateFromPrompt}
        onPickImage={pickReferenceImage}
      />
      
      {/* Image Viewer Modal */}
      <ZoomableImageViewer
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl || ""}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImageUrl(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  streamingContainer: {
    paddingVertical: 16,
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  searchingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  searchingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  // Thinking indicator styles
  thinkingContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  thinkingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  thinkingLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  thinkingContent: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  // Tool call indicator styles
  toolCallContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
    minWidth: 200,
  },
  toolCallHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolCallSpinner: {
    marginRight: -4,
  },
  toolCallCheckmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: -4,
  },
  toolCallText: {
    fontSize: 13,
    fontWeight: "500",
  },
  toolCallProgressBar: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  toolCallProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  // Streaming content preview styles
  streamingPreviewContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  streamingPreviewText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Enhanced streaming content container (ChatGPT-like)
  streamingContentContainer: {
    marginVertical: 8,
    paddingRight: 40,
  },
  streamingCursor: {
    width: 2,
    height: 18,
    marginLeft: 2,
    borderRadius: 1,
  },
  // Typing indicator container
  typingIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  typingIndicatorText: {
    fontSize: 13,
    fontWeight: "500",
  },
  dateDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  dateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: "600",
    marginHorizontal: 12,
  },
  userMessageContainer: {
    alignItems: "flex-end",
    marginVertical: 4,
  },
  userBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  userMessageText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
  messageImagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
    justifyContent: "flex-end",
  },
  messageImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  aiMessageContainer: {
    marginVertical: 8,
    paddingRight: 40,
  },
  citationsContainer: {
    marginBottom: 12,
  },
  citationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  citationsTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  citationItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  citationTitle: {
    fontSize: 13,
  },
  generatedImageContainer: {
    marginTop: 12,
  },
  generatedImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  generatedImageCaption: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  imageGenerationContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageGenerationPlaceholder: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  imageGenerationContent: {
    alignItems: "center",
    gap: 12,
  },
  imageGenerationText: {
    fontSize: 16,
    fontWeight: "600",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  emptyStateContainer: {
    flex: 1,
    paddingHorizontal: 40,
  },
  emptyStateContent: {
    alignItems: "center",
    paddingTop: 60, // Positioned towards top, visible even with keyboard
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  attachedImagesContainer: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 8,
  },
  attachedImageWrapper: {
    position: "relative",
  },
  attachedImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  inputFieldWrapper: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 22,
    overflow: "hidden",
  },
  inputFieldBlur: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  inputFieldGradient: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendButton: {
    marginBottom: 4,
  },
  sendButtonInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

