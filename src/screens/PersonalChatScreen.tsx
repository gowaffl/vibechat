/**
 * PersonalChatScreen - Personal 1:1 AI Chat Interface
 * 
 * Features:
 * - Full-width AI responses with rich Markdown rendering (no bubble)
 * - User messages in right-aligned bubbles
 * - Agent selector dropdown in header
 * - Conversation history drawer (swipe from left)
 * - Image attachments and generation
 * - Web search capability
 * - Streaming AI responses
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
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { personalChatsKeys } from "@/hooks/usePersonalChats";
import type { RootStackScreenProps } from "@/navigation/types";
import type { AIFriend, PersonalConversation, PersonalMessage, PersonalMessageMetadata } from "@/shared/contracts";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 120;

type NavigationProp = RootStackScreenProps<"PersonalChat">["navigation"];
type RouteProp = RootStackScreenProps<"PersonalChat">["route"];

// Message item for the list - can be a regular message or a date divider
type MessageListItem = PersonalMessage | { id: string; isDateDivider: true; date: Date };

// Streaming message state
interface StreamingState {
  isStreaming: boolean;
  content: string;
  messageId: string | null;
  isThinking: boolean;
  thinkingContent: string;
  currentToolCall: {
    name: string;
    status: "starting" | "in_progress" | "completed";
  } | null;
  reasoningEffort: "none" | "low" | "medium" | "high" | null;
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

// Thinking indicator component - shows when AI is reasoning
function ThinkingIndicator({ isDark, colors, content }: { isDark: boolean; colors: any; content: string }) {
  const pulseOpacity = useSharedValue(0.6);
  const isMounted = useRef(true);
  
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

  return (
    <Reanimated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.thinkingContainer, { backgroundColor: isDark ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.1)" }]}
    >
      <Reanimated.View style={[styles.thinkingHeader, animatedStyle]}>
        <Sparkles size={14} color="#A855F7" />
        <Text style={[styles.thinkingLabel, { color: "#A855F7" }]}>Thinking...</Text>
      </Reanimated.View>
      {content ? (
        <Text 
          style={[styles.thinkingContent, { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }]}
          numberOfLines={3}
        >
          {content}
        </Text>
      ) : null}
    </Reanimated.View>
  );
}

// Tool call indicator component - shows which tool is being used
function ToolCallIndicator({ toolName, isDark, colors }: { toolName: string; isDark: boolean; colors: any }) {
  const getToolInfo = () => {
    switch (toolName) {
      case "web_search":
        return { icon: Globe, label: "Searching the web", color: "#6366F1" };
      case "image_generation":
        return { icon: ImagePlus, label: "Generating image", color: "#10B981" };
      default:
        return { icon: Sparkles, label: `Using ${toolName}`, color: "#F59E0B" };
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
      <ActivityIndicator size="small" color={color} style={styles.toolCallSpinner} />
      <Icon size={14} color={color} />
      <Text style={[styles.toolCallText, { color }]}>{label}</Text>
    </Reanimated.View>
  );
}

// Streaming content preview component
function StreamingContentPreview({ content, isDark, colors }: { content: string; isDark: boolean; colors: any }) {
  if (!content) return null;
  
  return (
    <Reanimated.View
      entering={FadeIn.duration(200)}
      style={[styles.streamingPreviewContainer, { backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.9)" }]}
    >
      <Text 
        style={[styles.streamingPreviewText, { color: colors.text }]}
        numberOfLines={10}
      >
        {content}
      </Text>
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
  const [inputText, setInputText] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState>({
    isStreaming: false,
    content: "",
    messageId: null,
    isThinking: false,
    thinkingContent: "",
    currentToolCall: null,
    reasoningEffort: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

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

  // Refs
  const flatListRef = useRef<FlashList<MessageListItem>>(null);
  const isAtBottomRef = useRef(true); // Track if user is at bottom of list
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

  // Load agent from conversation data (ai_friend is already included in the response)
  useEffect(() => {
    // The conversation data includes the ai_friend object, so use that directly
    const aiFriendFromConversation = (conversationData as any)?.ai_friend;
    if (aiFriendFromConversation && !selectedAgent) {
      setSelectedAgent(aiFriendFromConversation);
    }
  }, [conversationData, selectedAgent]);

  // Create messages list with date dividers
  const messagesWithDividers = useMemo(() => {
    if (messages.length === 0) return [];

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

    return result;
  }, [messages]);

  // Send message with SSE streaming
  const sendStreamingMessage = useCallback(async (content: string, images: string[]) => {
    // Initialize streaming state
    setStreaming({
      isStreaming: true,
      content: "",
      messageId: null,
      isThinking: false,
      thinkingContent: "",
      currentToolCall: null,
      reasoningEffort: null,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    
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

      // Use fetch with streaming for SSE
      const response = await fetch(
        `${BACKEND_URL}/api/personal-chats/${activeConversationId}/messages/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            userId: user?.id,
            content,
            imageUrl: images.length > 0 ? images[0] : undefined,
            aiFriendId: selectedAgent?.id, // Send the selected agent for persona
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE events - SSE format is:
        // event: eventType\n
        // data: {"json": "data"}\n\n
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let currentEventType = "";
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith("event: ")) {
            // Store the event type for the next data line
            currentEventType = trimmedLine.slice(7);
            continue;
          }
          
          if (trimmedLine.startsWith("data: ")) {
            const eventData = trimmedLine.slice(6);
            
            try {
              const data = JSON.parse(eventData);
              // Add the event type to the data for handling
              data._eventType = currentEventType;
              handleStreamEvent(data, currentEventType);
            } catch (e) {
              console.log("[PersonalChat] Parse error:", e, eventData);
            }
            // Reset event type after processing
            currentEventType = "";
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[PersonalChat] Stream aborted by user");
      } else {
        console.error("[PersonalChat] Streaming error:", error);
        Alert.alert("Error", "Failed to send message. Please try again.");
      }
      // Only clear streaming state on error (not in finally)
      setStreaming(prev => ({
        ...prev,
        isStreaming: false,
        isThinking: false,
        currentToolCall: null,
      }));
    }
    
    // Cleanup after stream completes (success or error)
    abortControllerRef.current = null;
    
    // Use the active conversation ID we tracked during the request
    const finalConversationId = activeConversationId;
    
    // Invalidate and await refetch before clearing streaming content
    // This ensures the new message appears before the streaming preview disappears
    try {
      if (finalConversationId) {
        await queryClient.invalidateQueries({ 
          queryKey: personalChatsKeys.conversation(finalConversationId) 
        });
        // Refetch to ensure we have the latest data
        await queryClient.refetchQueries({ 
          queryKey: personalChatsKeys.conversation(finalConversationId) 
        });
      }
      await queryClient.invalidateQueries({ 
        queryKey: personalChatsKeys.conversations(user?.id || "") 
      });
    } catch (refetchError) {
      console.error("[PersonalChat] Error refetching:", refetchError);
    }
    
    // Now clear streaming state after data is loaded
    setStreaming({
      isStreaming: false,
      content: "",
      messageId: null,
      isThinking: false,
      thinkingContent: "",
      currentToolCall: null,
      reasoningEffort: null,
    });
  }, [conversationId, user?.id, selectedAgent?.id, queryClient]);

  // Handle individual SSE events
  const handleStreamEvent = useCallback((data: any, eventType: string) => {
    // Use the event type from the SSE "event:" line
    switch (eventType) {
      case "user_message":
        // User message was saved, can ignore or log
        console.log("[PersonalChat] User message saved:", data.id);
        break;
      case "reasoning_effort":
        setStreaming(prev => ({ ...prev, reasoningEffort: data.effort }));
        break;
      case "thinking_start":
        setStreaming(prev => ({ ...prev, isThinking: true, thinkingContent: "" }));
        break;
      case "thinking_delta":
        setStreaming(prev => ({ ...prev, thinkingContent: prev.thinkingContent + (data.content || "") }));
        break;
      case "thinking_end":
        setStreaming(prev => ({ ...prev, isThinking: false }));
        break;
      case "tool_call_start":
        setStreaming(prev => ({ 
          ...prev, 
          currentToolCall: { name: data.toolName, status: "starting" } 
        }));
        if (data.toolName === "web_search") {
          setIsSearchingWeb(true);
        }
        break;
      case "tool_call_end":
        setStreaming(prev => ({ ...prev, currentToolCall: null }));
        if (data.toolName === "web_search") {
          setIsSearchingWeb(false);
        }
        break;
      case "content_delta":
        setStreaming(prev => ({ ...prev, content: prev.content + (data.content || "") }));
        break;
      case "image_generated":
        console.log("[PersonalChat] Image generated:", data.imageId);
        break;
      case "done":
        console.log("[PersonalChat] Stream complete");
        break;
      case "error":
        console.error("[PersonalChat] Server error:", data.error);
        Alert.alert("Error", data.error || "An error occurred");
        break;
      default:
        // Log unknown event types for debugging
        if (eventType) {
          console.log("[PersonalChat] Unknown event type:", eventType, data);
        }
    }
  }, []);

  // Legacy mutation for fallback (non-streaming)
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, images }: { content: string; images: string[] }) => {
      // If no conversation exists, create one first
      let activeConversationId = conversationId;

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

      // Send the message
      const response = await api.post<{
        success: boolean;
        userMessage: PersonalMessage;
        aiMessage: PersonalMessage;
      }>(`/api/personal-chats/${activeConversationId}/messages`, {
        userId: user?.id,
        content,
        imageUrl: images.length > 0 ? images[0] : undefined, // Backend expects single image
      });

      return response;
    },
    onMutate: async ({ content, images }) => {
      // Optimistic update: Add pending user message
      setStreaming({ 
        isStreaming: true, 
        content: "", 
        messageId: null,
        isThinking: false,
        thinkingContent: "",
        currentToolCall: null,
        reasoningEffort: null,
      });
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversation(conversationId) });
      }
      queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversations(user?.id || "") });
      setStreaming({ 
        isStreaming: false, 
        content: "", 
        messageId: null,
        isThinking: false,
        thinkingContent: "",
        currentToolCall: null,
        reasoningEffort: null,
      });
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      setStreaming({ 
        isStreaming: false, 
        content: "", 
        messageId: null,
        isThinking: false,
        thinkingContent: "",
        currentToolCall: null,
        reasoningEffort: null,
      });
      Alert.alert("Error", "Failed to send message. Please try again.");
    },
  });

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

    // Use streaming by default for better UX
    sendStreamingMessage(trimmedText, attachedImages);

    setInputText("");
    setAttachedImages([]);
  }, [inputText, attachedImages, sendStreamingMessage]);

  // Handle stop generation
  const handleStopGeneration = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Cancel streaming via AbortController
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming({ 
      isStreaming: false, 
      content: "", 
      messageId: null,
      isThinking: false,
      thinkingContent: "",
      currentToolCall: null,
      reasoningEffort: null,
    });
    setIsSearchingWeb(false);
  }, []);

  // Handle agent selection
  const handleAgentSelect = useCallback((agent: AIFriend | null) => {
    setSelectedAgent(agent);
    // If we have an existing conversation, we might want to switch agents
    // For now, just update the selected agent for new messages
  }, []);

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

  // Handle image generation
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
      // Create agent in a temporary chat context or globally
      // For personal chats, we might want to create agents without a specific chat
      // This is a simplified version - you may need to adjust based on your requirements
      const response = await api.post<{ success: boolean; aiFriend: AIFriend }>("/api/ai-friends", {
        name,
        personality,
        tone,
        engagementMode,
        engagementPercent,
        chatId: "personal", // Special chat ID for personal agents
      });
      
      if (response.success) {
        setSelectedAgent(response.aiFriend);
        setShowCreateAgentModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
      Alert.alert("Error", "Failed to create agent");
    }
  }, []);

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
          {metadata?.generatedImagePrompt && (
            <View style={styles.generatedImageContainer}>
              <Image
                source={{ uri: message.content }}
                style={styles.generatedImage}
                contentFit="cover"
              />
              <Text style={[styles.generatedImageCaption, { color: colors.textSecondary }]}>
                "{metadata.generatedImagePrompt}"
              </Text>
            </View>
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
              if (isAtBottomRef.current) {
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
              // Track if user is at bottom (inverted list, so offsetY near 0 = bottom)
              const offsetY = event.nativeEvent.contentOffset.y;
              const isNowAtBottom = offsetY < 50;
              isAtBottomRef.current = isNowAtBottom;
            }}
            ListFooterComponent={
              streaming.isStreaming ? (
                <View style={styles.streamingContainer}>
                  {/* Show thinking indicator when AI is reasoning */}
                  {streaming.isThinking && (
                    <ThinkingIndicator 
                      isDark={isDark} 
                      colors={colors} 
                      content={streaming.thinkingContent} 
                    />
                  )}
                  
                  {/* Show tool call indicator */}
                  {streaming.currentToolCall && (
                    <ToolCallIndicator 
                      toolName={streaming.currentToolCall.name} 
                      isDark={isDark} 
                      colors={colors} 
                    />
                  )}
                  
                  {/* Show streaming content preview */}
                  {streaming.content && (
                    <StreamingContentPreview 
                      content={streaming.content} 
                      isDark={isDark} 
                      colors={colors} 
                    />
                  )}
                  
                  {/* Show typing indicator when waiting for response */}
                  {!streaming.content && !streaming.isThinking && !streaming.currentToolCall && (
                    <TypingIndicator isDark={isDark} />
                  )}
                </View>
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
            <Animated.View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
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
                <Animated.View
                    style={{
                    flex: 1,
                    borderRadius: 20,
                    overflow: "hidden",
                    shadowColor: inputContainerShadowColor,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: animatedShadowOpacity,
                    shadowRadius: 8,
                    elevation: 3,
                    }}
                >
                    <View
                    style={{
                        flex: 1,
                        borderRadius: 20,
                        overflow: "hidden",
                        backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7",
                    }}
                    >
                    <Animated.View
                        style={{
                            flex: 1,
                            borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: animatedBorderColor,
                            overflow: "hidden",
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
                                style={{ flex: 1 }}
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
                                style={{ flex: 1 }}
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
                                style={{ flex: 1 }}
                            />
                        </Animated.View>

                        <TextInput
                            ref={textInputRef}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={attachedImages.length > 0 ? "Add a caption (optional)" : "Message"}
                            placeholderTextColor={colors.inputPlaceholder}
                            style={{
                                flex: 1,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                fontSize: 16,
                                lineHeight: 20,
                                color: inputTextColor,
                                fontWeight: inputFontWeight,
                                textAlignVertical: "top",
                                maxHeight: MAX_INPUT_HEIGHT,
                            }}
                            multiline={true}
                            scrollEnabled={true}
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
                            showSoftInputOnFocus={true}
                            caretHidden={false}
                        />
                    </Animated.View>
                    </View>
                </Animated.View>

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
            </Animated.View>
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
        onGenerateImage={() => {
          setShowAttachmentsMenu(false);
          setTimeout(() => setShowImageGenerator(true), 200);
        }}
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
        }}
        onMinimize={() => setShowImageGenerator(false)}
        imageUrl={generatedImageUrl}
        isProcessing={isGeneratingImage}
        onAccept={handleAcceptGeneratedImage}
        onEdit={handleGenerateImage}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  toolCallSpinner: {
    marginRight: -4,
  },
  toolCallText: {
    fontSize: 13,
    fontWeight: "500",
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

