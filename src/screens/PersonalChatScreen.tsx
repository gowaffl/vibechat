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
  KeyboardAvoidingView,
  Dimensions,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
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
import { ImageGeneratorSheet } from "@/components/ImageGeneratorSheet";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { personalChatsKeys } from "@/hooks/usePersonalChats";
import type { RootStackScreenProps } from "@/navigation/types";
import type { AIFriend, PersonalConversation, PersonalMessage, PersonalMessageMetadata } from "@/shared/contracts";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type NavigationProp = RootStackScreenProps<"PersonalChat">["navigation"];
type RouteProp = RootStackScreenProps<"PersonalChat">["route"];

// Message item for the list - can be a regular message or a date divider
type MessageListItem = PersonalMessage | { id: string; isDateDivider: true; date: Date };

// Streaming message state
interface StreamingState {
  isStreaming: boolean;
  content: string;
  messageId: string | null;
}

// Typing indicator component
function TypingIndicator({ isDark }: { isDark: boolean }) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (value: Animated.SharedValue<number>, delay: number) => {
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
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.searchingContainer, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }]}
    >
      <Globe size={14} color="#6366f1" />
      <Text style={[styles.searchingText, { color: colors.text }]}>Searching the web...</Text>
    </Animated.View>
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
  });
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

  // Refs
  const flatListRef = useRef<FlashList<MessageListItem>>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch conversation details if we have an ID
  const { data: conversationData } = useQuery({
    queryKey: personalChatsKeys.conversation(conversationId || ""),
    queryFn: async () => {
      if (!conversationId) return null;
      const response = await api.get<{ success: boolean; conversation: PersonalConversation & { messages: PersonalMessage[] } }>(
        `/api/personal-chats/conversations/${conversationId}`
      );
      return response.conversation;
    },
    enabled: !!conversationId,
  });

  // Get messages from conversation data
  const messages = conversationData?.messages ?? [];

  // Load agent if specified or from conversation
  useEffect(() => {
    const loadAgent = async () => {
      const agentIdToLoad = initialAgentId || conversationData?.aiFriendId;
      if (agentIdToLoad && !selectedAgent) {
        try {
          const response = await api.get<{ success: boolean; aiFriend: AIFriend }>(
            `/api/ai-friends/${agentIdToLoad}`
          );
          if (response.success) {
            setSelectedAgent(response.aiFriend);
          }
        } catch (error) {
          console.error("Failed to load agent:", error);
        }
      }
    };
    loadAgent();
  }, [initialAgentId, conversationData?.aiFriendId]);

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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, images }: { content: string; images: string[] }) => {
      // If no conversation exists, create one first
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const createResponse = await api.post<{ success: boolean; conversation: PersonalConversation }>(
          "/api/personal-chats/conversations",
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
      }>(`/api/personal-chats/conversations/${activeConversationId}/messages`, {
        content,
        attachedImageUrls: images.length > 0 ? images : undefined,
        enableWebSearch: true,
        enableImageGeneration: true,
      });

      return response;
    },
    onMutate: async ({ content, images }) => {
      // Optimistic update: Add pending user message
      setStreaming({ isStreaming: true, content: "", messageId: null });
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversation(conversationId) });
      }
      queryClient.invalidateQueries({ queryKey: personalChatsKeys.conversations(user?.id || "") });
      setStreaming({ isStreaming: false, content: "", messageId: null });
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      setStreaming({ isStreaming: false, content: "", messageId: null });
      Alert.alert("Error", "Failed to send message. Please try again.");
    },
  });

  // Handle send message
  const handleSend = useCallback(() => {
    const trimmedText = inputText.trim();
    if (!trimmedText && attachedImages.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    sendMessageMutation.mutate({
      content: trimmedText,
      images: attachedImages,
    });

    setInputText("");
    setAttachedImages([]);
  }, [inputText, attachedImages, sendMessageMutation]);

  // Handle stop generation
  const handleStopGeneration = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement actual streaming cancellation via AbortController
    setStreaming({ isStreaming: false, content: "", messageId: null });
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
  const handleOpenAttachments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setShowAttachmentsMenu(true);
  }, []);

  // Handle web search action
  const handleWebSearch = useCallback(() => {
    // Toggle web search in the message - for now just show a hint
    if (inputText.trim()) {
      setInputText((prev) => prev.startsWith("/search ") ? prev : `/search ${prev}`);
    } else {
      setInputText("/search ");
    }
    inputRef.current?.focus();
  }, [inputText]);

  // Handle new conversation from drawer
  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setInputText("");
    setAttachedImages([]);
    inputRef.current?.focus();
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
          <Animated.View
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
          </Animated.View>
        );
      }

      // AI message - full width, no bubble
      return (
        <Animated.View
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
        </Animated.View>
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
              paddingBottom: 16,
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            ListFooterComponent={
              streaming.isStreaming ? (
                <View style={styles.streamingContainer}>
                  {isSearchingWeb && <SearchingIndicator isDark={isDark} colors={colors} />}
                  <TypingIndicator isDark={isDark} />
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
        style={styles.inputWrapper}
      >
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: insets.bottom + 8,
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
            <Animated.View entering={FadeIn.duration(200)} style={styles.attachedImagesContainer}>
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
            </Animated.View>
          )}

          <View style={styles.inputRow}>
            {/* Plus button to open attachments menu - styled like group chat */}
            <Pressable
              onPress={handleOpenAttachments}
              style={({ pressed }) => [
                styles.plusButton,
                {
                  backgroundColor: pressed 
                    ? isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"
                    : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Plus size={22} color={colors.text} strokeWidth={2} />
            </Pressable>

            {/* Text input - styled like group chat */}
            <View style={styles.inputFieldWrapper}>
              <BlurView
                intensity={isDark ? 40 : 30}
                tint={isDark ? "dark" : "light"}
                style={styles.inputFieldBlur}
              >
                <LinearGradient
                  colors={
                    isDark
                      ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.05)"]
                      : ["rgba(255,255,255,0.95)", "rgba(248,248,252,0.95)"]
                  }
                  style={[
                    styles.inputFieldGradient,
                    {
                      borderColor: inputText.trim()
                        ? isDark ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.3)"
                        : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                      shadowColor: inputText.trim() ? "#6366f1" : "transparent",
                      shadowOpacity: inputText.trim() ? 0.2 : 0,
                    },
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Message..."
                    placeholderTextColor={colors.textTertiary}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={4000}
                    returnKeyType="default"
                  />
                </LinearGradient>
              </BlurView>
            </View>

            {/* Send/Stop button */}
            {streaming.isStreaming ? (
              <Pressable onPress={handleStopGeneration} style={styles.sendButton}>
                <View style={[styles.sendButtonInner, { backgroundColor: "#ef4444" }]}>
                  <StopCircle size={18} color="#fff" />
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() && attachedImages.length === 0}
                style={styles.sendButton}
              >
                <View
                  style={[
                    styles.sendButtonInner,
                    { 
                      backgroundColor: inputText.trim() || attachedImages.length > 0 
                        ? "#6366f1" 
                        : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                    },
                  ]}
                >
                  <ArrowUp 
                    size={20} 
                    color={inputText.trim() || attachedImages.length > 0 ? "#fff" : colors.textSecondary} 
                    strokeWidth={2.5} 
                  />
                </View>
              </Pressable>
            )}
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
  inputWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
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

