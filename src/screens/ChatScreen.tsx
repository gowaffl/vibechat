import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Image as RNImage,
  Keyboard,
  Modal,
  Alert,
  Animated,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  Share,
  PanResponder,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { FadeIn, FadeInUp, FadeOut, Layout, useAnimatedStyle, useAnimatedKeyboard, useAnimatedReaction, runOnJS, useSharedValue, withTiming } from "react-native-reanimated";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Send, User as UserIcon, ImagePlus, X, Download, Share2, Reply, Smile, Settings, Users, ChevronLeft, ChevronDown, Trash2, Edit, Edit3, CheckSquare, StopCircle, Mic, Plus, Images, Search, Bookmark, MoreVertical, Calendar, UserPlus, Sparkles, ArrowUp, Copy } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as VideoThumbnails from "expo-video-thumbnails";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Markdown from "react-native-markdown-display";
import { api } from "@/lib/api";
import { extractFirstUrl } from "@/lib/url-utils";
import { setActiveChatId } from "@/lib/notifications";
import { BACKEND_URL } from "@/config";
import { authClient, supabaseClient } from "@/lib/authClient";
import { aiFriendsApi } from "@/api/ai-friends";
import { useUser } from "@/contexts/UserContext";
import { LinkPreviewCard } from "@/components/LinkPreviewCard";
import type { AIFriend } from "@shared/contracts";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { VoicePlayer } from "@/components/VoicePlayer";
import { ZoomableImageViewer } from "@/components/ZoomableImageViewer";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { MediaCarousel } from "@/components/MediaCarousel";
import { VideoPlayer } from "@/components/VideoPlayer";
import AttachmentsMenu from "@/components/AttachmentsMenu";
import type { RootStackScreenProps } from "@/navigation/types";
import type { Message, AiChatRequest, AiChatResponse, User, AddReactionRequest, GetGroupSettingsResponse, GetCustomCommandsResponse, ExecuteCustomCommandRequest, Reaction, Chat, DeleteMessageResponse, CustomSlashCommand, SmartRepliesResponse, GetBookmarksResponse, ToggleBookmarkRequest, ToggleBookmarkResponse, UnreadCount, GetChatResponse, Thread, ThreadFilterRules, MessageTag, Event, UploadImageResponse, Poll, ImagePreviewResponse, GenerateImageResponse, LinkPreview } from "@/shared/contracts";

// AI Super Features imports
import { CatchUpModal, CatchUpButton } from "@/components/CatchUp";
import { EventsList, CreateEventModal, EventNotificationCard } from "@/components/Events";
import { CreatePollModal, PollCard } from "@/components/Poll";
import { ReactorMenu } from "@/components/Reactor";
import { ThreadsPanel, CreateThreadModal, DraggableThreadList } from "@/components/Threads";
import { CreateCustomCommandModal } from "@/components/CustomCommands";
import { CreateAIFriendModal } from "@/components/AIFriends";
import { ReplyPreviewModal } from "@/components/ReplyPreviewModal";
import { ImagePreviewModal } from "@/components/ImagePreviewModal";
import MentionPicker from "@/components/MentionPicker";
import MessageText from "@/components/MessageText";
import { ProfileImage } from "@/components/ProfileImage";
import { SwipeableMessage } from "@/components/SwipeableMessage";
import { TruncatedText } from "@/components/TruncatedText";
import { VibeSelector, VIBE_CONFIG, VibeSelectorStatic } from "@/components/VibeSelector";
import { VibeAnimatedBubble } from "@/components/VibeAnimatedBubble";
import type { VibeType } from "@shared/contracts";
import { useCatchUp } from "@/hooks/useCatchUp";
import { useEvents } from "@/hooks/useEvents";
import { usePolls } from "@/hooks/usePolls";
import { useReactor } from "@/hooks/useReactor";
import { useThreads, useThreadMessages } from "@/hooks/useThreads";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";

const AnimatedFlashList = Reanimated.createAnimatedComponent(FlashList);

// Custom Chat Header Component
const ChatHeader = ({ 
  chatName, 
  chatImage, 
  onAvatarPress, 
  onSettingsPress,
  onSearchPress,
  onBookmarksPress,
  onThreadsPress,
  onEventsPress,
  onInvitePress,
}: { 
  chatName: string; 
  chatImage: string | null; 
  onAvatarPress: () => void; 
  onSettingsPress: () => void;
  onSearchPress: () => void;
  onBookmarksPress: () => void;
  onThreadsPress: () => void;
  onEventsPress: () => void;
  onInvitePress: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  const groupImageUrl = chatImage
    ? (chatImage.startsWith('http')
        ? chatImage
        : `${BACKEND_URL}${chatImage}`)
    : null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 70 + insets.top,
        zIndex: 100,
      }}
    >
      {/* Liquid Glass Background */}
      <BlurView
        intensity={80}
        tint="dark"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.85)',
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <LinearGradient
          colors={[
            'rgba(79, 195, 247, 0.15)',
            'rgba(0, 122, 255, 0.1)',
            'rgba(0, 0, 0, 0)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            shadowColor: 'rgba(79, 195, 247, 0.5)',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
          }}
        />
      </BlurView>

      {/* Header Content */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 2,
          paddingHorizontal: 14,
          paddingBottom: 2,
        }}
      >
        {/* Left Button - Back to Chat List */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            // Check if we can just pop back to MainTabs (ensures the "Rise Up" animation plays perfectly)
            const state = navigation.getState();
            const routes = state?.routes;
            const previousRoute = routes?.[routes.length - 2];
            
            if (previousRoute?.name === "MainTabs") {
              navigation.goBack();
            } else {
              // Fallback: Navigate explicitly (usually acts as a pop if in stack, but ensures we get there)
              (navigation as any).navigate("MainTabs", { screen: "Chats" });
            }
          }}
        >
          <View
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        </Pressable>

        {/* Center - Avatar and Name (tappable for Settings) */}
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            Haptics.selectionAsync();
            onSettingsPress();
          }}
          style={{ flex: 1, alignItems: 'center', paddingHorizontal: 16 }}
        >
          <View style={{ alignItems: 'center' }}>
            {/* Group Avatar */}
            {groupImageUrl ? (
              <Image
                source={{ uri: groupImageUrl }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  marginBottom: 2,
                }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 2,
                }}
              >
                <Users size={24} color="#FFFFFF" />
              </View>
            )}
            {/* Group Name */}
            <Text
              className="text-sm font-semibold"
              style={{ color: "#FFFFFF" }}
              numberOfLines={1}
            >
              {chatName || "Vibecode Chat"}
            </Text>
          </View>
        </Pressable>

        {/* Right Button - More Options */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowOptionsMenu(true);
          }}
        >
          <View
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <MoreVertical size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-start",
            alignItems: "flex-end",
            paddingTop: insets.top + 43,
            paddingRight: 16,
          }}
          onPress={() => setShowOptionsMenu(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                borderRadius: 16,
                overflow: "hidden",
                minWidth: 200,
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.15)",
                  "rgba(255, 255, 255, 0.10)",
                  "rgba(255, 255, 255, 0.05)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 8 }}
              >
                {/* Smart Threads Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onThreadsPress();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <RNImage
                      source={require("../../assets/smarth threads icon (1).png")}
                      style={{ width: 40, height: 40 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
                    Smart Threads
                  </Text>
                </Pressable>

                {/* Events Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onEventsPress();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Calendar size={18} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
                    Events
                  </Text>
                </Pressable>

                {/* Bookmarks Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onBookmarksPress();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Bookmark size={18} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
                    Bookmarks
                  </Text>
                </Pressable>

                {/* Search Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onSearchPress();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Search size={18} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
                    Search
                  </Text>
                </Pressable>

                <View style={{ height: 1, backgroundColor: "rgba(255, 255, 255, 0.1)", marginVertical: 8 }} />

                {/* Send Invite Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onInvitePress();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <UserPlus size={18} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
                    Send Invite
                  </Text>
                </Pressable>
              </LinearGradient>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};


// AI Typing Indicator Component
// Animated AI Typing Indicator with Sequential Dot Animation and Haptics
const AITypingIndicator = ({ aiName = "AI Friend", aiColor = "#14B8A6" }: { aiName?: string; aiColor?: string }) => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Duration for each dot's rise and fall
    const duration = 400;
    const delay = 150; // Delay between each dot

    const createDotAnimation = (animValue: Animated.Value, dotDelay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(dotDelay),
          Animated.timing(animValue, {
            toValue: -6,
            duration: duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with delays
    const anim1 = createDotAnimation(dot1Anim, 0);
    const anim2 = createDotAnimation(dot2Anim, delay);
    const anim3 = createDotAnimation(dot3Anim, delay * 2);

    anim1.start();
    anim2.start();
    anim3.start();

    // Haptic feedback synchronized with dot animations
    const hapticInterval = setInterval(() => {
      // Light haptic when each dot rises
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, delay);

      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, delay * 2);
    }, duration * 2 + delay * 2);

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      clearInterval(hapticInterval);
    };
  }, [dot1Anim, dot2Anim, dot3Anim]);

  // Convert hex color to rgba for background
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const backgroundColor = hexToRgba(aiColor, 0.15);
  const borderColor = aiColor;
  const dotColor = aiColor;

  return (
    <View
      className="mb-3 flex-row justify-start"
      style={{ paddingHorizontal: 4 }}
    >
      {/* AI Profile Photo - VibeChat Icon */}
      <View className="mr-2" style={{ width: 34, height: 34 }}>
        <Image
          source={require("../../assets/vibechat logo main.png")}
          style={{ width: 34, height: 34, borderRadius: 17 }}
          resizeMode="cover"
        />
      </View>

      {/* Typing Bubble */}
      <View style={{ maxWidth: "85%" }}>
        <Text
          className="text-xs font-medium mb-1 ml-2"
          style={{ color: aiColor }}
        >
          {aiName}
        </Text>
        <View
          style={{
            borderRadius: 20,
            backgroundColor: backgroundColor,
            borderWidth: 1,
            borderColor: borderColor,
            shadowColor: borderColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 2,
            paddingHorizontal: 20,
            paddingVertical: 14,
          }}
        >
          <View className="flex-row items-center gap-1" style={{ height: 16 }}>
            <Animated.View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: dotColor,
                opacity: 0.9,
                transform: [{ translateY: dot1Anim }],
              }}
            />
            <Animated.View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: dotColor,
                opacity: 0.9,
                transform: [{ translateY: dot2Anim }],
              }}
            />
            <Animated.View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: dotColor,
                opacity: 0.9,
                transform: [{ translateY: dot3Anim }],
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

// Message Context Menu Modal with Inline Emoji Picker
const MessageContextMenu = ({
  visible,
  message,
  onClose,
  onReply,
  onEdit,
  onUnsend,
  onDelete,
  onSelect,
  onSelectEmoji,
  onBookmark,
  isBookmarked,
  canEdit,
  canUnsend,
  canDelete,
  onReactor,
  onCopy,
}: {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onUnsend: (message: Message) => void;
  onDelete: (message: Message) => void;
  onSelect: (message: Message) => void;
  onSelectEmoji: (emoji: string, message: Message) => void;
  onBookmark: (message: Message) => void;
  isBookmarked: boolean;
  canEdit: boolean;
  canUnsend: boolean;
  canDelete: boolean;
  onReactor?: (message: Message) => void;
  onCopy: (message: Message) => void;
}) => {
  if (!message) return null;

  const quickEmojis = ["❤️", "👍", "👎", "😂", "😮", "🔥", "🎉", "👏", "❓"];

  // MED-B: Get preview text for the message being acted upon
  const getPreviewText = () => {
    if (!message) return "";
    // Check for media content first
    if (message.imageUrl) return "📷 Image";
    if (message.pollId) return "📊 Poll";
    if (message.eventId) return "📅 Event";
    if (message.content) {
      return message.content.length > 80 
        ? message.content.substring(0, 80) + "..." 
        : message.content;
    }
    return "Message";
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* MED-B: Message preview bubble above context menu */}
        <View
          style={{
            backgroundColor: "rgba(45, 45, 45, 0.95)",
            borderRadius: 12,
            padding: 10,
            marginBottom: 12,
            maxWidth: 280,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text
            style={{
              color: "#AAAAAA",
              fontSize: 13,
              lineHeight: 18,
            }}
            numberOfLines={3}
          >
            {getPreviewText()}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "rgba(20, 20, 20, 0.95)",
            borderRadius: 16,
            padding: 8,
            minWidth: 280,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
          onStartShouldSetResponder={() => true}
        >
          {/* Quick Emoji Reactions at Top */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              paddingVertical: 12,
              paddingHorizontal: 8,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.1)",
              marginBottom: 8,
            }}
          >
            {quickEmojis.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelectEmoji(emoji, message);
                  onClose();
                }}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 22,
                  backgroundColor: pressed ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  transform: [{ scale: pressed ? 1.2 : 1 }],
                })}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          {/* Context Menu Options */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReply(message);
              onClose();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Reply size={20} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
              Reply
            </Text>
          </Pressable>

          {message.messageType === "text" && message.content && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCopy(message);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Copy size={20} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
                Copy
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBookmark(message);
              onClose();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Bookmark size={20} color={isBookmarked ? "#FF9500" : "#FFFFFF"} fill={isBookmarked ? "#FF9500" : "none"} />
            <Text style={{ color: isBookmarked ? "#FF9500" : "#FFFFFF", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
              {isBookmarked ? "Remove Bookmark" : "Bookmark"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(message);
              onClose();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Settings size={20} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
              Select
            </Text>
          </Pressable>

          {/* Reactor Option - Only for image messages */}
          {message.messageType === "image" && message.imageUrl && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onReactor?.(message);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
                backgroundColor: "rgba(168, 85, 247, 0.1)",
              }}
            >
              <Text style={{ fontSize: 20, marginRight: 12 }}>🎨</Text>
              <Text style={{ color: "#A855F7", fontSize: 16, marginLeft: 0, fontWeight: "600" }}>
                AI Reactor
              </Text>
            </Pressable>
          )}

          {canEdit && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onEdit(message);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Edit size={20} color="#007AFF" />
              <Text style={{ color: "#007AFF", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
                Edit
              </Text>
            </Pressable>
          )}

          {canUnsend && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onUnsend(message);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <StopCircle size={20} color="#FF9500" />
              <Text style={{ color: "#FF9500", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
                Unsend
              </Text>
            </Pressable>
          )}

          {canDelete && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDelete(message);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Trash2 size={20} color="#FF3B30" />
              <Text style={{ color: "#FF3B30", fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
                Delete
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
};

// Reaction Picker Modal
const ReactionPickerModal = ({
  visible,
  message,
  onClose,
  onSelectEmoji,
}: {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string, message: Message) => void;
}) => {
  const emojis = ["❤️", "👍", "👎", "😂", "😮", "❓"];

  if (!message) return null;

  // MED-A: Use "none" animation for instant reaction picker feedback
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(20, 20, 20, 0.95)",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
          onStartShouldSetResponder={() => true}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", marginBottom: 16, textAlign: "center" }}>
            React with an emoji
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {emojis.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelectEmoji(emoji, message);
                  onClose();
                }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <Text style={{ fontSize: 32 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

// Typing Indicator Component
const TypingIndicator = ({ typingUsers }: { typingUsers: { id: string; name: string }[] }) => {
  const [dots, setDots] = useState(".");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  if (typingUsers.length === 0) return null;
  
  const displayText = typingUsers.length === 1
    ? `${typingUsers[0].name} is typing${dots}`
    : typingUsers.length === 2
    ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing${dots}`
    : `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing${dots}`;
  
  return (
    <View
      style={{
        marginVertical: 8,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(142, 142, 147, 0.15)",
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: "rgba(142, 142, 147, 0.3)",
          maxWidth: "80%",
        }}
      >
        <Text style={{ color: "#8E8E93", fontSize: 14, fontStyle: "italic" }}>
          {displayText}
        </Text>
      </View>
    </View>
  );
};

// Message Selection Toolbar Component
const MessageSelectionToolbar = ({
  selectedCount,
  onDelete,
  onCancel,
}: {
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
}) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(28, 28, 30, 0.95)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.1)",
        paddingBottom: insets.bottom,
        paddingTop: 8,
        paddingHorizontal: 12,
        flexDirection: "row",
        gap: 8,
      }}
    >
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          Cancel
        </Text>
      </Pressable>

      <Pressable
        onPress={onDelete}
        disabled={selectedCount === 0}
        style={{
          flex: 1,
          backgroundColor: selectedCount > 0 ? "#FF3B30" : "rgba(255, 59, 48, 0.3)",
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          Delete ({selectedCount})
        </Text>
      </Pressable>
    </View>
  );
};

// Image Selection Toolbar Component
const ImageSelectionToolbar = ({
  selectedCount,
  onSave,
  onShare,
  onAIReactor,
  onDelete,
  onCancel,
}: {
  selectedCount: number;
  onSave: () => void;
  onShare: () => void;
  onAIReactor: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom,
        paddingTop: 16,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={{
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.08)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          
          {/* Selected count */}
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            {selectedCount} {selectedCount === 1 ? "image" : "images"} selected
          </Text>
          
          {/* Action buttons row */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Pressable
              onPress={onSave}
              disabled={selectedCount === 0}
              style={{
                flex: 1,
                backgroundColor: selectedCount > 0 ? "rgba(52, 199, 89, 0.2)" : "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 8,
                alignItems: "center",
                borderWidth: 1,
                borderColor: selectedCount > 0 ? "rgba(52, 199, 89, 0.4)" : "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Download size={18} color={selectedCount > 0 ? "#34C759" : "#8E8E93"} />
              <Text style={{ color: selectedCount > 0 ? "#34C759" : "#8E8E93", fontSize: 10, marginTop: 4, fontWeight: "600" }}>
                Save
              </Text>
            </Pressable>

            <Pressable
              onPress={onShare}
              disabled={selectedCount === 0}
              style={{
                flex: 1,
                backgroundColor: selectedCount > 0 ? "rgba(0, 122, 255, 0.2)" : "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 8,
                alignItems: "center",
                borderWidth: 1,
                borderColor: selectedCount > 0 ? "rgba(0, 122, 255, 0.4)" : "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Share2 size={18} color={selectedCount > 0 ? "#007AFF" : "#8E8E93"} />
              <Text style={{ color: selectedCount > 0 ? "#007AFF" : "#8E8E93", fontSize: 10, marginTop: 4, fontWeight: "600" }}>
                Share
              </Text>
            </Pressable>

            <Pressable
              onPress={onAIReactor}
              disabled={selectedCount !== 1}
              style={{
                flex: 1,
                backgroundColor: selectedCount === 1 ? "rgba(175, 82, 222, 0.2)" : "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 8,
                alignItems: "center",
                borderWidth: 1,
                borderColor: selectedCount === 1 ? "rgba(175, 82, 222, 0.4)" : "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Sparkles size={18} color={selectedCount === 1 ? "#AF52DE" : "#8E8E93"} />
              <Text style={{ color: selectedCount === 1 ? "#AF52DE" : "#8E8E93", fontSize: 10, marginTop: 4, fontWeight: "600" }}>
                Reactor
              </Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              disabled={selectedCount === 0}
              style={{
                flex: 1,
                backgroundColor: selectedCount > 0 ? "rgba(255, 59, 48, 0.2)" : "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 8,
                alignItems: "center",
                borderWidth: 1,
                borderColor: selectedCount > 0 ? "rgba(255, 59, 48, 0.4)" : "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Trash2 size={18} color={selectedCount > 0 ? "#FF3B30" : "#8E8E93"} />
              <Text style={{ color: selectedCount > 0 ? "#FF3B30" : "#8E8E93", fontSize: 10, marginTop: 4, fontWeight: "600" }}>
                Delete
              </Text>
            </Pressable>
          </View>

          {/* Cancel button */}
          <Pressable
            onPress={onCancel}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>
              Cancel
            </Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
  );
};

// Reaction Details Modal Component
const ReactionDetailsModal = ({
  visible,
  emoji,
  reactions,
  onClose,
}: {
  visible: boolean;
  emoji: string;
  reactions: Reaction[];
  onClose: () => void;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(20, 20, 20, 0.95)",
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            width: "90%",
            maxWidth: 400,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 36, marginRight: 12 }}>{emoji}</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "600" }}>
              {reactions.length} {reactions.length === 1 ? "reaction" : "reactions"}
            </Text>
          </View>

          <View style={{ maxHeight: 300 }}>
            {reactions.map((reaction) => {
              const user = reaction.user;
              const initials = getInitials(user?.name);
              const backgroundColor = getColorFromName(user?.name);
              
              return (
                <View
                  key={reaction.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {user?.image ? (
                    <Image
                      source={{ uri: getFullImageUrl(user.image) }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        marginRight: 12,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: backgroundColor,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 16,
                          fontWeight: "600",
                          textAlign: "center",
                        }}
                      >
                        {initials}
                      </Text>
                    </View>
                  )}
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
                    {user?.name || "Unknown User"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const MIN_INPUT_HEIGHT = 38;
const MAX_INPUT_HEIGHT = 110;

const ChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<"Chat">["navigation"]>();
  const route = useRoute<RootStackScreenProps<"Chat">["route"]>();
  const { user, updateUser } = useUser();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();

  // Get chatId from navigation params, fallback to default-chat for backward compatibility
  const chatId = route.params?.chatId || "default-chat";
  const chatName = route.params?.chatName || "VibeChat";

  const flatListRef = useRef<FlashList<any>>(null);
  const textInputRef = useRef<TextInput>(null);
  const isInputFocused = useRef(false);
  const isManualScrolling = useRef(false); // Prevents auto-scroll when viewing searched/bookmarked message (re-enables on new message sent)
  const isAtBottomRef = useRef(true); // Tracks if user is at bottom of list
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false); // Tracks if there are new messages while scrolled up
  const [lastKnownLength, setLastKnownLength] = useState(0);
  const [messageText, setMessageText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<{ uri: string; duration?: number } | null>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [viewerImage, setViewerImage] = useState<{
    url: string;
    imageUrls?: string[];
    initialIndex?: number;
    senderName: string;
    timestamp: string;
    messageId?: string;
    caption?: string;
    isOwnMessage?: boolean;
  } | null>(null);
  const [isAITyping, setIsAITyping] = useState(false);
  const [typingAIFriend, setTypingAIFriend] = useState<AIFriend | null>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [reactionPickerMessage, setReactionPickerMessage] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [replyPreviewModal, setReplyPreviewModal] = useState<{ original: Message; reply: Message } | null>(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [reactionDetailsModal, setReactionDetailsModal] = useState<{
    emoji: string;
    reactions: Reaction[];
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [activeInput, setActiveInput] = useState<"main" | "edit">("main");
  const [catchUpCount, setCatchUpCount] = useState(0);
  const [catchUpSinceMessageId, setCatchUpSinceMessageId] = useState<string | undefined>(undefined);
  const editModalDragY = useRef(new Animated.Value(0)).current;
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [imageSelectionMode, setImageSelectionMode] = useState(false);
  const [selectedImageMessageIds, setSelectedImageMessageIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentAt = useRef<number>(0);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // VibeWrapper state
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);
  const [previewVibe, setPreviewVibe] = useState<VibeType | null>(null);
  const [showVibeSelector, setShowVibeSelector] = useState(false);
  const [sendButtonPosition, setSendButtonPosition] = useState({ x: 0, y: 0 });
  const sendButtonRef = useRef<View>(null);
  const vibeLongPressTimer = useRef<NodeJS.Timeout | null>(null);
  const searchModalDragY = useRef(new Animated.Value(0)).current;
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const bookmarksModalDragY = useRef(new Animated.Value(0)).current;
  const eventsModalDragY = useRef(new Animated.Value(0)).current;
  
  // AI Super Features state
  const [showCatchUpModal, setShowCatchUpModal] = useState(false);
  const [showEventsTab, setShowEventsTab] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showReactorMenu, setShowReactorMenu] = useState(false);
  const [reactorMessageId, setReactorMessageId] = useState<string | null>(null);
  const [showThreadsPanel, setShowThreadsPanel] = useState(false);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [loadingImageIds, setLoadingImageIds] = useState<Set<string>>(new Set());
  const [editingThread, setEditingThread] = useState<Thread | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [catchUpDismissed, setCatchUpDismissed] = useState(false);
  const [showCreateCustomCommand, setShowCreateCustomCommand] = useState(false);
  const [showCreateAIFriend, setShowCreateAIFriend] = useState(false);
  
  // Mentions state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<ImagePreviewResponse | null>(null);
  const [originalPreviewPrompt, setOriginalPreviewPrompt] = useState<string>("");
  const [previewType, setPreviewType] = useState<"image" | "meme" | "remix">("image");
  const [isConfirmingImage, setIsConfirmingImage] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);

  // Event button animation state
  const [eventButtonScale] = useState(new Animated.Value(1));
  const [eventButtonRotate] = useState(new Animated.Value(0));

  // Input Link Preview state
  const [inputLinkPreview, setInputLinkPreview] = useState<LinkPreview | null>(null);
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const linkPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard animation hooks - must be called early and consistently
  const keyboard = useAnimatedKeyboard();
  
  // Animated style for the entire input container wrapper - moves with keyboard
  const inputWrapperAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const bottomPadding = Math.max(insets.bottom, 20);
    return {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      transform: [
        {
          translateY: keyboard.height.value > 0 ? -keyboard.height.value : 0,
        },
      ],
      // When keyboard is open, sit flush (no gap). When closed, back at bottom
      marginBottom: 0, 
    };
  });
  
  // Animated style for the ScrollView content
  const inputContainerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    // When keyboard is closed, add extra padding to lift the input field higher
    // When keyboard is open, use minimal padding
    return {
      paddingBottom: keyboard.height.value > 0 ? 0 : Math.max(insets.bottom, 20),
    };
  });
  
  // Animated style for FlatList container to shrink viewport when keyboard opens
  // Note: This animates the bottom margin of the list container
  const chatListContainerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    // Only push up by keyboard height. Input bar spacing is handled by padding.
    return {
      marginBottom: keyboard.height.value,
    };
  });

  // LOW-A: Drag handle removed - style definition also removed

  // Animated style for input row - adjust bottom padding based on keyboard state
  const inputRowAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      paddingBottom: keyboard.height.value > 0 ? 12 : 30,
    };
  });

  // Thread Switch Animation
  // Using key-based re-mounting with entering animation for smoothest transition without flash

  // Fetch chat details (includes members)
  const { data: chat } = useQuery<GetChatResponse>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get<GetChatResponse>(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  // Fetch AI friends for this chat
  const { data: aiFriends = [] } = useQuery<AIFriend[]>({
    queryKey: ["aiFriends", chatId],
    queryFn: () => aiFriendsApi.getAIFriends(chatId, user?.id || ""),
    enabled: !!user?.id && !!chatId,
  });

  // Extract chat members from the chat data (members are included in the chat response)
  const chatMembers = useMemo(() => {
    if (!chat?.members) {
      console.log('[ChatMembers] No members in chat data yet');
      return [];
    }
    const members = chat.members.map((m) => m.user);
    console.log('[ChatMembers] Extracted members:', members.length, members.map((m) => m.name));
    return members;
  }, [chat?.members]);

  // Fetch custom commands for this chat
  const { data: customCommands = [] } = useQuery({
    queryKey: ["customCommands", chatId],
    queryFn: () => api.get<GetCustomCommandsResponse>(`/api/custom-commands?chatId=${chatId}`),
    enabled: !!chatId,
  });

  // HIGH-8: Pagination state for message history
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);

  // Track realtime subscription retries (helps surface errors + auto-retry)
  const [realtimeRetryCount, setRealtimeRetryCount] = useState(0);

  // Fetch messages for this chat (with pagination support)
  const { data: messageData, isLoading } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const response = await api.get<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
        `/api/chats/${chatId}/messages?userId=${user?.id}`
      );
      return response;
    },
    // Realtime subscription is used instead of polling
    enabled: !!user?.id && !!chatId,
  });

  // Ensure Realtime has the current auth token (important when sessions refresh)
  useEffect(() => {
    const syncRealtimeAuth = async () => {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      console.log("[Realtime] Syncing auth token for realtime. Has token:", !!token);
      if (token) {
        supabaseClient.realtime.setAuth(token);
      }
    };

    syncRealtimeAuth();
  }, [user?.id]);

  // Realtime subscription for messages and reactions
  // NOTE: We don't use filters because Supabase Realtime doesn't support camelCase column names
  // in filter strings. Instead, we filter client-side in the callback (like ChatListScreen does).
  useEffect(() => {
    if (!chatId) return;

    console.log(`[Realtime] Subscribing to chat:${chatId} (attempt ${realtimeRetryCount + 1})`);
    const channel = supabaseClient.channel(`chat:${chatId}`)
      // Listen for new messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message',
        },
        async (payload) => {
          // Client-side filter: only process messages for this chat
          if (payload.new.chatId !== chatId) return;
          
          try {
            const newMessageId = payload.new.id;
            // Check for AI message - userId should be null/undefined and aiFriendId should be set
            const isAIMessage = (payload.new.userId === null || payload.new.userId === undefined) && 
                                (payload.new.aiFriendId !== null && payload.new.aiFriendId !== undefined);
            console.log('[Realtime] New message received:', newMessageId, {
              isAIMessage,
              userId: payload.new.userId,
              aiFriendId: payload.new.aiFriendId
            });
            
            // If this is an AI message, clear the AI typing indicator immediately
            // This ensures seamless transition: typing indicator -> message appears
            if (isAIMessage) {
              console.log('[Realtime] Clearing AI typing indicator for AI message');
              setIsAITyping(false);
              setTypingAIFriend(null);
            }
            
            // Fetch single message from our new endpoint
            const newMessage = await api.get<Message>(`/api/messages/${newMessageId}`);

            if (newMessage) {
               setAllMessages(prev => {
                 // Deduplicate
                 if (prev.some(m => m.id === newMessage.id)) return prev;
                 // Prepend to START (Descending order: Newest -> Oldest)
                 return [newMessage, ...prev];
               });
            }
          } catch (error) {
            console.error('[Realtime] Error fetching new message:', error);
            // Fallback
            queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
          }
        }
      )
      // Listen for message updates (edits)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message',
        },
        async (payload) => {
          // Client-side filter: only process messages for this chat
          if (payload.new.chatId !== chatId) return;
          
          console.log('[Realtime] Message updated:', payload.new.id);
          try {
            // Fetch full message details (including tags for Smart Threads)
            const updatedMsg = await api.get<Message>(`/api/messages/${payload.new.id}`);
            if (updatedMsg) {
              setAllMessages(prev => prev.map(m => 
                m.id === payload.new.id ? updatedMsg : m
              ));
            }
          } catch (error) {
            console.error('[Realtime] Error fetching updated message:', error);
            // Fallback to payload merge if fetch fails
            setAllMessages(prev => prev.map(m => 
              m.id === payload.new.id ? { ...m, ...payload.new } : m
            ));
          }
        }
      )
      // Listen for message deletions
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message',
        },
        (payload) => {
          // Client-side filter: only process messages for this chat
          if (payload.old.chatId !== chatId) return;
          
          console.log('[Realtime] Message deleted:', payload.old.id);
          setAllMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      // Listen for reactions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reaction',
        },
        async (payload) => {
           // Client-side filter: only process reactions for this chat
           if (payload.new.chatId !== chatId) return;
           
           const msgId = payload.new.messageId;
           try {
             const updatedMsg = await api.get<Message>(`/api/messages/${msgId}`);
             if (updatedMsg) {
                setAllMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
             }
           } catch (e) { console.error(e); }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'reaction',
        },
        async (payload) => {
           // Client-side filter: only process reactions for this chat
           if (payload.old.chatId !== chatId) return;
           
           const msgId = payload.old.messageId;
           try {
             const updatedMsg = await api.get<Message>(`/api/messages/${msgId}`);
             if (updatedMsg) {
                setAllMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
             }
           } catch (e) { console.error(e); }
        }
      )
    // Track if we've successfully subscribed to prevent unnecessary retries
    let isSubscribed = false;
    let subscriptionTimeout: NodeJS.Timeout | null = null;

    // Safety net: if we don't get SUBSCRIBED within 5s, force a refetch and retry
    subscriptionTimeout = setTimeout(() => {
      if (!isSubscribed) {
        console.warn(`[Realtime] Subscription timeout for chat:${chatId}, forcing refetch + retry`);
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
        setRealtimeRetryCount((prev) => prev + 1);
      }
    }, 5000);

    channel.subscribe((status, err) => {
      console.log(`[Realtime] Subscription status for chat:${chatId}:`, status);
      
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        // Clear the timeout since we're now subscribed
        if (subscriptionTimeout) {
          clearTimeout(subscriptionTimeout);
          subscriptionTimeout = null;
        }
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        // Only retry on actual errors, not on CLOSED (which happens during cleanup)
        if (err) {
          console.error('[Realtime] Subscription error:', err);
        }
        setTimeout(() => {
          setRealtimeRetryCount((prev) => prev + 1);
        }, 2000); // Longer delay to prevent rapid cycling
      }
      // Don't retry on CLOSED - it fires during normal cleanup
    });

    return () => {
      if (subscriptionTimeout) {
        clearTimeout(subscriptionTimeout);
      }
      supabaseClient.removeChannel(channel);
    };
  }, [chatId, queryClient, realtimeRetryCount]);

  // Update messages state when data changes
  useEffect(() => {
    if (messageData) {
      setAllMessages(messageData.messages || []);
      setHasMoreMessages(messageData.hasMore || false);
      setNextCursor(messageData.nextCursor || null);
    }
  }, [messageData]);

  // HIGH-8: Load more (older) messages
  const loadMoreMessages = useCallback(async () => {
    if (!nextCursor || isLoadingMore || !chatId || !user?.id) return;
    
    setIsLoadingMore(true);
    try {
      const response = await api.get<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
        `/api/chats/${chatId}/messages?userId=${user.id}&cursor=${encodeURIComponent(nextCursor)}`
      );
      
      if (response.messages && response.messages.length > 0) {
        // Append older messages to the END of the array (Descending order: Newest -> Oldest)
        setAllMessages(prev => [...prev, ...response.messages]);
        setHasMoreMessages(response.hasMore || false);
        setNextCursor(response.nextCursor || null);
      } else {
        setHasMoreMessages(false);
        setNextCursor(null);
      }
    } catch (error) {
      console.error("[ChatScreen] Error loading more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, chatId, user?.id]);

  // Use allMessages instead of direct data
  const messages = allMessages;

  // Fetch unread counts for this chat using shared hook
  const { data: unreadCounts = [] } = useUnreadCounts(user?.id);

  // Get unread count for the current chat
  const currentChatUnreadCount = useMemo(() => {
    const chatUnread = unreadCounts.find((uc) => uc.chatId === chatId);
    return chatUnread?.unreadCount || 0;
  }, [unreadCounts, chatId]);

  // HIGH-7: Track active chat to suppress notifications while viewing
  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
      console.log("[ChatScreen] Set active chat for notifications:", chatId);
    }
    return () => {
      setActiveChatId(null);
      console.log("[ChatScreen] Cleared active chat for notifications");
    };
  }, [chatId]);

  // Persist catch-up button if unread count was high (threshold: 10+ messages)
  // Also capture the sinceMessageId at this moment to avoid race conditions with read receipts
  useEffect(() => {
    if (currentChatUnreadCount >= 10 && !catchUpDismissed) {
      setCatchUpCount(prev => Math.max(prev, currentChatUnreadCount));
      
      // Capture sinceMessageId NOW (before read receipts could update)
      // Only set if we don't already have one stored (to preserve the original)
      if (!catchUpSinceMessageId && messages && messages.length > 0) {
        // Messages are sorted newest-first, so the message at index [unreadCount] 
        // is the last read message (the one BEFORE the unread messages)
        const lastReadIndex = Math.min(currentChatUnreadCount, messages.length - 1);
        const lastReadMessage = messages[lastReadIndex];
        if (lastReadMessage) {
          console.log("[ChatScreen] Capturing sinceMessageId on enter:", lastReadMessage.id, "unreadCount:", currentChatUnreadCount);
          setCatchUpSinceMessageId(lastReadMessage.id);
        }
      }
    }
  }, [currentChatUnreadCount, catchUpDismissed, messages, catchUpSinceMessageId]);

  // Fetch bookmarks for this chat
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks", chatId, user?.id],
    queryFn: () => api.get<GetBookmarksResponse>(`/api/bookmarks?userId=${user?.id}&chatId=${chatId}`),
    enabled: !!user?.id && !!chatId,
  });

  // AI Super Features hooks
  const { cachedSummary, generateCatchUp, clearCachedSummary, isGenerating: isGeneratingCatchUp, error: catchUpError } = useCatchUp(chatId || "", user?.id || "");
  
  // Handle Catch Up Dismissal (when badge is swiped away or summary is viewed)
  const handleCatchUpDismiss = useCallback(async () => {
    setCatchUpDismissed(true);
    setCatchUpCount(0); // Clear the stored count
    setCatchUpSinceMessageId(undefined); // Clear the stored message ID
    try {
      if (chatId) {
        await AsyncStorage.setItem(`catchup_dismissed_${chatId}`, "true");
        await AsyncStorage.setItem(`catchup_last_count_${chatId}`, currentChatUnreadCount.toString());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("[ChatScreen] Failed to save catch-up dismiss state:", error);
    }
  }, [chatId, currentChatUnreadCount]);

  // Handle Catch Up Errors
  useEffect(() => {
    if (catchUpError) {
      Alert.alert(
        "Catch Up Failed",
        "We couldn't generate your summary at this time. Please try again later.",
        [{ text: "OK" }]
      );
    }
  }, [catchUpError]);

  const { events, createEvent, vote, rsvp, exportEvent, deleteEvent, updateEvent, isLoading: isLoadingEvents, isCreating: isCreatingEvent } = useEvents(chatId || "", user?.id || "");
  const { polls, createPoll, vote: votePoll, isCreating: isCreatingPoll, isVoting: isVotingPoll } = usePolls(chatId || "", user?.id || "");
  const { 
    generateCaption, 
    remix, 
    createMeme, 
    isProcessing: isReactorProcessing,
    isGeneratingCaption,
    isCreatingMeme,
    isRemixing,
  } = useReactor(chatId || "", user?.id || "", {
    onPreview: (data, type) => {
      console.log("[ChatScreen] Reactor preview received:", type);
      setPreviewImage(data);
      setOriginalPreviewPrompt(data.prompt);
      setPreviewType(type);
    },
    onStart: (type, prompt) => {
      // Immediately open preview modal with loading state
      console.log("[ChatScreen] onStart callback received - type:", type, "prompt:", prompt);
      console.log("[ChatScreen] Setting previewImage to show shimmer loading...");
      setPreviewImage({
        imageUrl: '', // Empty triggers loading/shimmer state
        previewId: 'generating',
        prompt,
      });
      setOriginalPreviewPrompt(prompt);
      setPreviewType(type);
      console.log("[ChatScreen] Preview modal should now be visible with shimmer");
    },
    onGenerationError: () => {
      // Close the preview modal on error
      setPreviewImage(null);
    },
  });
  const { threads, createThread, updateThread, deleteThread, reorderThreads, isCreating: isCreatingThread } = useThreads(chatId || "", user?.id || "");
  const { data: threadMessages, isLoading: isLoadingThreadMessages, error: threadMessagesError } = useThreadMessages(currentThreadId, user?.id || "");

  // Client-side message filtering for Smart Threads
  const filterMessages = useCallback((msgs: Message[], thread: Thread) => {
    const rules = thread.filterRules;
    if (!rules) return msgs;

    try {
      // Parse rules if they are a string (from DB)
      const parsedRules = typeof rules === 'string' ? JSON.parse(rules) : rules;
      
      return msgs.filter(msg => {
        // 1. Keywords (Content search)
        if (parsedRules.keywords && parsedRules.keywords.length > 0) {
          const contentLower = msg.content.toLowerCase();
          const matchesKeyword = parsedRules.keywords.some((k: string) => contentLower.includes(k.toLowerCase()));
          if (!matchesKeyword) return false;
        }

        // 2. People (Sender)
        if (parsedRules.people && parsedRules.people.length > 0) {
          if (!parsedRules.people.includes(msg.userId)) return false;
        }

        // 3. Date Range
        if (parsedRules.dateRange) {
          const msgDate = new Date(msg.createdAt).getTime();
          if (parsedRules.dateRange.start && msgDate < new Date(parsedRules.dateRange.start).getTime()) return false;
          if (parsedRules.dateRange.end && msgDate > new Date(parsedRules.dateRange.end).getTime()) return false;
        }

        // 4. AI Tags (Topics, Entities, Sentiment)
        const hasTopicRules = (parsedRules.topics?.length ?? 0) > 0;
        const hasEntityRules = (parsedRules.entities?.length ?? 0) > 0;
        const hasSentimentRules = !!parsedRules.sentiment;

        if (hasTopicRules || hasEntityRules || hasSentimentRules) {
          // If message has no tags but rules require them, exclude it
          if (!msg.tags || msg.tags.length === 0) return false;

          // Check Topics
          if (hasTopicRules) {
              const hasTopic = msg.tags.some(t => t.tagType === 'topic' && parsedRules.topics!.includes(t.tagValue));
              if (!hasTopic) return false;
          }

          // Check Entities
          if (hasEntityRules) {
              const hasEntity = msg.tags.some(t => t.tagType === 'entity' && parsedRules.entities!.includes(t.tagValue));
              if (!hasEntity) return false;
          }

          // Check Sentiment
          if (hasSentimentRules) {
               const hasSentiment = msg.tags.some(t => t.tagType === 'sentiment' && t.tagValue === parsedRules.sentiment);
               if (!hasSentiment) return false;
          }
        }

        return true;
      });
    } catch (e) {
      console.error("Error filtering messages:", e);
      return msgs;
    }
  }, []);

  // Define active messages based on thread view or main chat
  const activeMessages = useMemo(() => {
    if (currentThreadId) {
      // Optimization: Try filtering client-side first for instant switch
      const currentThread = threads?.find(t => t.id === currentThreadId);
      
      if (currentThread && messages.length > 0) {
         const filtered = filterMessages(messages, currentThread);
         console.log(`[ChatScreen] Client-side filtered ${filtered.length} messages for thread ${currentThread.name}`);
         return filtered;
      }
      return threadMessages || [];
    }
    return messages;
  }, [currentThreadId, threadMessages, messages, threads, filterMessages]);

  // Sync reactor processing state with AI typing indicator
  const wasRemixingRef = React.useRef(false);
  const wasCreatingMemeRef = React.useRef(false);
  
  React.useEffect(() => {
    // Track when operations start
    if (isRemixing) {
      wasRemixingRef.current = true;
    }
    if (isCreatingMeme) {
      wasCreatingMemeRef.current = true;
    }
    
    // Detect when operations complete (was processing, now not)
    if (wasRemixingRef.current && !isRemixing) {
      console.log("[ChatScreen] Remix completed, stopping AI typing animation");
      wasRemixingRef.current = false;
      setIsAITyping(false);
      // Auto-scroll removed per user request
      /*
      // Scroll to show the new remixed message
      requestAnimationFrame(() => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 300);
      });
      */
    }
    
    if (wasCreatingMemeRef.current && !isCreatingMeme) {
      console.log("[ChatScreen] Meme creation completed, stopping AI typing animation");
      wasCreatingMemeRef.current = false;
      setIsAITyping(false);
      // Scroll to show the new meme message
      requestAnimationFrame(() => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 300);
      });
    }
  }, [isRemixing, isCreatingMeme]);

  // Debug thread messages query
  React.useEffect(() => {
    console.log('[useThreadMessages] Query state:', {
      currentThreadId,
      hasThreadMessages: !!threadMessages,
      threadMessagesCount: threadMessages?.length,
      isLoading: isLoadingThreadMessages,
      error: threadMessagesError,
    });
  }, [currentThreadId, threadMessages, isLoadingThreadMessages, threadMessagesError]);

  // Handle catch-up errors
  React.useEffect(() => {
    if (catchUpError) {
      console.error('[ChatScreen] Catch-up error:', catchUpError);

      // Parse error message to extract details
      let errorMessage = "Failed to generate catch-up summary. Please try again.";

      if (catchUpError instanceof Error) {
        const errorStr = catchUpError.message;
        // Try to parse the error JSON from the API client
        try {
          const match = errorStr.match(/\{.*\}/);
          if (match) {
            const errorData = JSON.parse(match[0]);
            errorMessage = errorData.details || errorData.error || errorMessage;
          }
        } catch {
          // If parsing fails, use the original error message
          errorMessage = errorStr;
        }
      }

      Alert.alert(
        "Unable to Generate Summary",
        errorMessage,
        [{ text: "OK" }]
      );
    }
  }, [catchUpError]);

  // Filter messages to get media (images and videos) for gallery (memoized for performance)
  const mediaMessages = useMemo(
    () => messages.filter(
      (msg) => {
        if (msg.isUnsent) return false;
        // Include image messages with imageUrl
        if (msg.messageType === "image" && msg.imageUrl) return true;
        // Include video messages with videoUrl in metadata
        if (msg.messageType === "video") {
          const meta = msg.metadata as { videoUrl?: string } | null;
          return !!meta?.videoUrl;
        }
        return false;
      }
    ),
    [messages]
  );

  // Search filtered messages (memoized for performance)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return messages.filter(msg => 
      msg.content?.toLowerCase().includes(query) ||
      msg.user?.name?.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  // Bookmark handlers
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return api.post<ToggleBookmarkResponse>("/api/bookmarks/toggle", {
        userId: user?.id,
        chatId,
        messageId,
      });
    },
    onSuccess: () => {
      // Invalidate bookmarks query to refetch
      queryClient.invalidateQueries({ queryKey: ["bookmarks", chatId, user?.id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (error) => {
      console.error("Error toggling bookmark:", error);
      Alert.alert("Error", "Failed to toggle bookmark");
    },
  });

  const toggleBookmark = useCallback((messageId: string) => {
    toggleBookmarkMutation.mutate(messageId);
  }, [toggleBookmarkMutation]);

  // Helper function to scroll to the very bottom (index 0 in inverted list)
  const scrollToBottom = useCallback((animated: boolean = true) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: animated,
      });
      // HIGH-4: Update scroll state when scrolling to bottom
      isAtBottomRef.current = true;
      setShowScrollToBottom(false);
      setHasNewMessages(false); // Clear new messages flag
    }
  }, []);

  // HIGH-4: Track scroll position to disable auto-scroll when user is reading history
  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    // For inverted list: offsetY 0 means at bottom (newest messages)
    // Consider "at bottom" if within 50 pixels of bottom
    const isNowAtBottom = offsetY < 50;
    
    if (isNowAtBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = isNowAtBottom;
      
      // Show/hide scroll to bottom button
      if (!isNowAtBottom) {
        setShowScrollToBottom(true);
        // Don't set hasNewMessages here - only when messages actually arrive
      } else {
        setShowScrollToBottom(false);
        setHasNewMessages(false); // Clear new messages flag when reaching bottom
      }
    }
  }, []);

  // Scroll to message handler
  const scrollToMessage = useCallback((messageId: string) => {
    if (!activeMessages) return;
    
    const originalIndex = activeMessages.findIndex(msg => msg.id === messageId);
    
    if (originalIndex === -1) {
      console.log(`[ScrollToMessage] Message ${messageId} not found in active messages`);
      return;
    }

    // Calculate display index for displayData
    // activeMessages is New -> Old (descending order)
    // displayData is Typing indicators -> New -> Old (same order, just with typing at front)
    // So index is typingOffset + originalIndex
    let typingOffset = 0;
    if (isAITyping && !currentThreadId) typingOffset++;
    if (typingUsers.length > 0 && !currentThreadId) typingOffset++;

    const displayIndex = typingOffset + originalIndex;

    console.log(`[ScrollToMessage] Found message ${messageId} at original index ${originalIndex}, display index ${displayIndex}`);
    
    if (!flatListRef.current) {
      console.log(`[ScrollToMessage] FlatList ref not available`);
      return;
    }
    
    // Set flag to prevent auto-scroll from interfering
    isManualScrolling.current = true;
    console.log(`[ScrollToMessage] Disabled auto-scroll (will re-enable when new message sent)`);
    
    // Close modals
    setShowSearchModal(false);
    setShowBookmarksModal(false);
    setSearchQuery("");
    
    // Highlight immediately for visual feedback
    setHighlightedMessageId(messageId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Delay to allow modal to close
    setTimeout(() => {
      console.log(`[ScrollToMessage] Attempting scrollToIndex to ${displayIndex}`);
      
      try {
        // Try to scroll to the index
        flatListRef.current?.scrollToIndex({
          index: displayIndex,
          animated: true,
          viewPosition: 0.5, // Center the message
        });
      } catch (error) {
        console.log(`[ScrollToMessage] scrollToIndex failed:`, error);
        // Fallback: scroll to approximate position
        const estimatedOffset = displayIndex * 100; 
        flatListRef.current?.scrollToOffset({
          offset: estimatedOffset,
          animated: true,
        });
      }
      
      // Remove highlight after 2 seconds (but keep auto-scroll disabled)
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }, 300);
  }, [activeMessages, isAITyping, typingUsers, currentThreadId]);

  // Create a Set of bookmarked message IDs for quick lookup
  const bookmarkedMessageIds = useMemo(
    () => new Set(bookmarks.map(b => b.messageId)),
    [bookmarks]
  );

  // Get full message objects for bookmarked messages
  const bookmarkedMessages = useMemo(() => {
    return bookmarks
      .map(bookmark => messages.find(msg => msg.id === bookmark.messageId))
      .filter((msg): msg is Message => msg !== undefined);
  }, [bookmarks, messages]);

  // Check if the most recent message is from another user or AI (for smart reply eligibility)
  const mostRecentMessageIsFromOther = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    
    // Get the actual most recent message (index 0 since descending order)
    const mostRecent = messages[0];
    if (!mostRecent) return false;
    
    // AI messages have userId: null, so they're not from current user
    // Other users have a different userId
    const isFromCurrentUser = mostRecent.userId === user?.id;
    return !isFromCurrentUser;
  }, [messages, user?.id]);

  // Prepare last 3 messages for smart reply context (for the AI to generate suggestions)
  // Messages are in descending order (newest first), so we take first 3
  const lastMessagesForSmartReply = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    
    // Get most recent 3 messages with content (excluding system messages and empty messages)
    // Messages are [Newest, ..., Oldest], so slice(0, 3) gets the 3 newest with content
    const relevantMessages = messages
      .filter(msg => 
        msg.messageType !== "system" && 
        msg.content && 
        msg.content.trim().length > 0
      )
      .slice(0, 3);
    
    return relevantMessages.map(msg => ({
      content: msg.content || "",
      userId: msg.userId,
      userName: msg.user?.name || "Unknown User",
      isCurrentUser: msg.userId === user?.id,
    }));
  }, [messages, user?.id]);

  // Fetch AI-generated smart reply suggestions
  const { data: smartRepliesData, isLoading: isLoadingSmartReplies, error: smartRepliesError } = useQuery({
    queryKey: ["smartReplies", chatId, JSON.stringify(lastMessagesForSmartReply)],
    queryFn: async () => {
      console.log("=== [Smart Replies Frontend] Starting fetch ===");
      console.log("[Smart Replies Frontend] ChatId:", chatId);
      console.log("[Smart Replies Frontend] UserId:", user?.id);
      console.log("[Smart Replies Frontend] Last messages count:", lastMessagesForSmartReply.length);
      console.log("[Smart Replies Frontend] Last messages for context:", JSON.stringify(lastMessagesForSmartReply, null, 2));
      
      // Don't fetch if no messages with content for context
      if (lastMessagesForSmartReply.length === 0) {
        console.log("[Smart Replies Frontend] ❌ Skipping - no messages with content for context");
        return { replies: [] };
      }
      
      // mostRecentMessageIsFromOther is checked in `enabled`, but double-check here
      if (!mostRecentMessageIsFromOther) {
        console.log("[Smart Replies Frontend] ❌ Skipping - most recent message is from current user");
        return { replies: [] };
      }

      console.log("[Smart Replies Frontend] ✅ Making API call to /api/ai/smart-replies...");
      const response = await api.post<SmartRepliesResponse>("/api/ai/smart-replies", {
        chatId,
        userId: user?.id,
        lastMessages: lastMessagesForSmartReply,
      });
      console.log("[Smart Replies Frontend] ✅ Response received:", JSON.stringify(response, null, 2));
      return response;
    },
    // Only enable if the most recent message is from someone else (another user or AI)
    enabled: lastMessagesForSmartReply.length > 0 && mostRecentMessageIsFromOther,
    staleTime: 0, // Don't cache - always fetch fresh
    gcTime: 0, // Don't keep in garbage collection
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on failure - we want to see the error
  });

  const smartReplies = smartRepliesData?.replies || [];
  
  console.log("[Smart Replies Frontend] Query enabled:", lastMessagesForSmartReply.length > 0 && mostRecentMessageIsFromOther);
  console.log("[Smart Replies Frontend] Most recent is from other:", mostRecentMessageIsFromOther);
  console.log("[Smart Replies Frontend] Is loading:", isLoadingSmartReplies);
  console.log("[Smart Replies Frontend] Has error:", !!smartRepliesError);
  if (smartRepliesError) {
    console.error("[Smart Replies Frontend] Error object:", smartRepliesError);
  }
  console.log("[Smart Replies Frontend] Data received:", smartRepliesData);
  console.log("[Smart Replies Frontend] Current smart replies:", smartReplies);


  // Fetch typing users for this chat (includes both users and AI friends)
  useQuery({
    queryKey: ["typing", chatId],
    queryFn: async () => {
      const response = await api.get<{ typingUsers: { id: string; name: string; isAI?: boolean; color?: string }[] }>(
        `/api/chats/${chatId}/typing?userId=${user?.id}`
      );
      const typers = response.typingUsers || [];
      
      // Separate AI typers from human typers
      const humanTypers = typers.filter(t => !t.isAI);
      const aiTypers = typers.filter(t => t.isAI);
      
      // Update human typing users
      setTypingUsers(humanTypers);
      
      // Update AI typing status
      if (aiTypers.length > 0) {
        const aiTyper = aiTypers[0]; // Show first AI friend typing
        setIsAITyping(true);
        setTypingAIFriend({
          id: aiTyper.id,
          name: aiTyper.name,
          color: aiTyper.color || "#14B8A6",
        } as AIFriend);
      } else {
        // Clear typing indicator when backend reports no AI typers
        // This provides a fallback in case realtime doesn't fire
        setIsAITyping(false);
        setTypingAIFriend(null);
      }
      
      return response;
    },
    refetchInterval: 1000, // Poll every 1 second
    enabled: !!user?.id && !!chatId,
  });

  // HIGH-10: Mark messages as read when viewing the chat
  // Use a ref to track what we've already marked to avoid re-marking on every poll
  const markedMessageIdsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!user?.id || !chatId || messages.length === 0) return;

    // Get message IDs from other users that haven't been marked yet
    const newMessageIdsToMark = messages
      .filter((msg) => 
        msg.userId !== user.id && 
        msg.messageType !== "system" &&
        !markedMessageIdsRef.current.has(msg.id)
      )
      .map((msg) => msg.id);

    if (newMessageIdsToMark.length === 0) return;

    // Add to marked set immediately to prevent duplicate requests
    newMessageIdsToMark.forEach(id => markedMessageIdsRef.current.add(id));

    // Mark messages as read (non-blocking)
    api.post(`/api/chats/${chatId}/read-receipts`, {
      userId: user.id,
      messageIds: newMessageIdsToMark,
    })
      .then(() => {
        // Invalidate unread counts to refresh the badge in chat list
        queryClient.invalidateQueries({ queryKey: ["unread-counts", user.id] });
      })
      .catch((error) => {
        console.error("[ChatScreen] Failed to mark messages as read:", error);
        // Remove from marked set on error so we can retry
        newMessageIdsToMark.forEach(id => markedMessageIdsRef.current.delete(id));
      });
  }, [messages, user?.id, chatId, queryClient]);

  // HIGH-10: Clear marked messages ref when leaving chat
  useEffect(() => {
    return () => {
      markedMessageIdsRef.current.clear();
    };
  }, [chatId]);

  // Cleanup link preview timeout on unmount
  useEffect(() => {
    return () => {
      if (linkPreviewTimeoutRef.current) {
        clearTimeout(linkPreviewTimeoutRef.current);
      }
    };
  }, []);

  // Load catch-up dismiss state from AsyncStorage
  useEffect(() => {
    const loadDismissState = async () => {
      try {
        const dismissKey = `catchup_dismissed_${chatId}`;
        const dismissed = await AsyncStorage.getItem(dismissKey);
        if (dismissed === "true") {
          setCatchUpDismissed(true);
        }
      } catch (error) {
        console.error("[ChatScreen] Failed to load catch-up dismiss state:", error);
      }
    };
    loadDismissState();
  }, [chatId]);

  // Load draft message from AsyncStorage when entering chat
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draftKey = `draft_message_${chatId}`;
        const draft = await AsyncStorage.getItem(draftKey);
        if (draft) {
          setMessageText(draft);
          console.log("[ChatScreen] Loaded draft message for chat:", chatId);
        }
      } catch (error) {
        console.error("[ChatScreen] Failed to load draft message:", error);
      }
    };
    loadDraft();
  }, [chatId]);

  // Save draft message to AsyncStorage when message text changes (debounced)
  useEffect(() => {
    const saveDraft = async () => {
      try {
        const draftKey = `draft_message_${chatId}`;
        if (messageText.trim()) {
          await AsyncStorage.setItem(draftKey, messageText);
        } else {
          // Clear draft if message is empty
          await AsyncStorage.removeItem(draftKey);
        }
      } catch (error) {
        console.error("[ChatScreen] Failed to save draft message:", error);
      }
    };
    
    // Debounce the save operation to avoid too many writes
    const timeoutId = setTimeout(saveDraft, 500);
    return () => clearTimeout(timeoutId);
  }, [messageText, chatId]);

  // Reset catch-up dismiss state when there are new unread messages
  useEffect(() => {
    if (currentChatUnreadCount > 0 && catchUpDismissed) {
      // If we have unread messages but button was dismissed, check if count increased
      const checkAndReset = async () => {
        try {
          const lastCountKey = `catchup_last_count_${chatId}`;
          const lastCount = await AsyncStorage.getItem(lastCountKey);
          const lastCountNum = lastCount ? parseInt(lastCount, 10) : 0;
          
          // If unread count increased, reset dismiss state
          if (currentChatUnreadCount > lastCountNum) {
            setCatchUpDismissed(false);
            await AsyncStorage.removeItem(`catchup_dismissed_${chatId}`);
          }
        } catch (error) {
          console.error("[ChatScreen] Failed to check unread count:", error);
        }
      };
      checkAndReset();
    }
  }, [currentChatUnreadCount, chatId, catchUpDismissed]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { 
      content?: string; 
      messageType: "text" | "image" | "voice" | "video"; 
      imageUrl?: string; 
      voiceUrl?: string;
      voiceDuration?: number;
      replyToId?: string;
      mentionedUserIds?: string[];
      vibeType?: VibeType | null;
      metadata?: Record<string, unknown>;
    }) =>
      api.post<Message>(`/api/chats/${chatId}/messages`, {
        content: data.content || "",
        messageType: data.messageType,
        imageUrl: data.imageUrl,
        voiceUrl: data.voiceUrl,
        voiceDuration: data.voiceDuration,
        userId: user?.id,
        replyToId: data.replyToId,
        mentionedUserIds: data.mentionedUserIds,
        vibeType: data.vibeType,
        metadata: data.metadata,
      }),
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["messages", chatId] });

      // Snapshot the previous data (now in paginated format)
      const previousData = queryClient.getQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(["messages", chatId]);

      // Optimistically update to the new value
      if (previousData?.messages && user) {
        const optimisticMessage: Message = {
          id: `optimistic-${Date.now()}`, // Temporary ID
          content: newMessage.content || "",
          messageType: newMessage.messageType,
          imageUrl: newMessage.imageUrl,
          voiceUrl: newMessage.voiceUrl,
          voiceDuration: newMessage.voiceDuration,
          vibeType: newMessage.vibeType,
          userId: user.id,
          chatId: chatId,
          createdAt: new Date().toISOString(),
          isUnsent: false,
          user: user,
          reactions: [],
          replyTo: newMessage.replyToId ? previousData.messages.find(m => m.id === newMessage.replyToId) : undefined,
          mentions: [], // Mentions will be populated by the server response
        };

        // Update with paginated format (prepend for descending order: Newest -> Oldest)
        queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
          ["messages", chatId],
          {
            messages: [optimisticMessage, ...previousData.messages],
            hasMore: previousData.hasMore,
            nextCursor: previousData.nextCursor,
          }
        );
        
        // Also update allMessages state for immediate UI update
        setAllMessages(prev => [optimisticMessage, ...prev]);
      }

      // Return context with the previous data for rollback
      return { previousData };
    },
    onError: (err, newMessage, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(["messages", chatId], context.previousData);
        setAllMessages(context.previousData.messages || []);
      }
      console.error("Error sending message:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    },
    onSuccess: (newMessage) => {
      // Smoothly replace optimistic message with real one from server
      const currentData = queryClient.getQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(["messages", chatId]);
      if (currentData?.messages) {
        // Remove optimistic message and prepend real one (descending order: Newest -> Oldest)
        const withoutOptimistic = currentData.messages.filter(m => !m.id.startsWith('optimistic-'));
        const updatedMessages = [newMessage, ...withoutOptimistic];
        queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
          ["messages", chatId],
          {
            messages: updatedMessages,
            hasMore: currentData.hasMore,
            nextCursor: currentData.nextCursor,
          }
        );
        setAllMessages(updatedMessages);
      }
      
      // Clear state (these may have already been cleared for text messages, but need to be cleared for image/voice)
      setMessageText("");
      clearDraftMessage(); // Clear draft immediately
      setSelectedImages([]);
      setReplyToMessage(null);
      setInputHeight(MIN_INPUT_HEIGHT);
      setMentionedUserIds([]);
      setInputLinkPreview(null);
      setInputPreviewUrl(null);
      
      // Re-enable auto-scroll to ensure the new message is visible
      isManualScrolling.current = false;
      
      // Scroll to bottom disabled per user request ("remove auto-scroll from happening anywhere")
      /*
      // Scroll to bottom to show the newly sent message with full visibility
      // Multiple scroll attempts to ensure it works even with keyboard open
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
      });
      
      // Second scroll after a longer delay to ensure content is rendered
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom(true);
        }, 400);
      });
      */
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is correct
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
  });

  // Reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: (data: AddReactionRequest) => {
      console.log("[ChatScreen] Adding reaction:", data);
      return api.post("/api/reactions", data);
    },
    onSuccess: (response) => {
      console.log("[ChatScreen] Reaction added successfully:", response);
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[ChatScreen] Error adding reaction:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to add reaction");
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete<DeleteMessageResponse>(`/api/messages/${messageId}?userId=${user?.id}&chatId=${chatId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("Error deleting message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to delete message");
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch<Message>(`/api/messages/${messageId}`, {
        content,
        userId: user?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingMessage(null);
      setEditText("");
    },
    onError: (error: any) => {
      console.error("Error editing message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to edit message");
    },
  });

  // Unsend message mutation
  const unsendMessageMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.post<Message>(`/api/messages/${messageId}/unsend`, {
        userId: user?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("Error unsending message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to unsend message");
    },
  });

  // Create custom command mutation
  const createCustomCommandMutation = useMutation({
    mutationFn: ({ command, prompt }: { command: string; prompt: string }) =>
      api.post("/api/custom-commands", {
        chatId,
        userId: user?.id,
        command,
        prompt,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateCustomCommand(false);
    },
    onError: (error: any) => {
      console.error("Error creating custom command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to create custom command");
    },
  });

  // Create AI friend mutation
  const createAIFriendMutation = useMutation({
    mutationFn: ({ name, personality, tone, engagementMode, engagementPercent }: { 
      name: string; 
      personality: string; 
      tone: string; 
      engagementMode: "on-call" | "percentage" | "off";
      engagementPercent?: number;
    }) =>
      aiFriendsApi.createAIFriend({
        chatId,
        userId: user?.id || "",
        name,
        personality: personality || null,
        tone: tone || null,
        engagementMode,
        engagementPercent: engagementMode === "percentage" ? engagementPercent : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateAIFriend(false);
    },
    onError: (error: any) => {
      console.error("Error creating AI friend:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to create AI friend");
    },
  });

  // AI chat mutation
  const aiChatMutation = useMutation({
    mutationFn: (data: AiChatRequest) =>
      api.post<AiChatResponse>("/api/ai/chat", data),
    onMutate: (data) => {
      // Show typing indicator immediately for responsive UI
      // Backend will also set typing status, and realtime handler will clear it when message arrives
      setIsAITyping(true);
      // Set which AI friend is typing
      const typingFriend = aiFriends.find(f => f.id === data.aiFriendId) || aiFriends[0];
      setTypingAIFriend(typingFriend || null);
    },
    onSuccess: () => {
      // Don't clear typing indicator here - realtime handler will clear it when message arrives
      // This ensures seamless transition from typing indicator to message
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
    onError: () => {
      // Only clear on error since message won't arrive via realtime
      setIsAITyping(false);
      setTypingAIFriend(null);
    },
  });

  // Image generation mutation
  const generateImageMutation = useMutation({
    mutationFn: async (data: { prompt: string; userId: string; aspectRatio?: string; referenceImageUrls?: string[] }) => {
      // Call backend to generate image
      console.log("[ChatScreen] Generating image via backend with prompt:", data.prompt);
      if (data.referenceImageUrls && data.referenceImageUrls.length > 0) {
        console.log("[ChatScreen] Using reference images:", data.referenceImageUrls);
      }

      const result = await api.post<GenerateImageResponse>("/api/ai/generate-image", {
        prompt: data.prompt,
        userId: data.userId,
        chatId: chatId,
        aspectRatio: data.aspectRatio || "1:1",
        referenceImageUrls: data.referenceImageUrls,
        preview: true, // Enable preview mode
      });

      return result;
    },
    onMutate: (data) => {
      // Immediately open preview modal with loading state
      console.log("[ChatScreen] Image generation started, opening preview modal");
      setPreviewImage({
        imageUrl: '', // Empty triggers loading/shimmer state
        previewId: 'generating',
        prompt: data.prompt,
      });
      setOriginalPreviewPrompt(data.prompt);
      setPreviewType("image");
    },
    onSuccess: (data) => {
      // Preview mode - show the preview modal
      if ('previewId' in data) {
        console.log("[ChatScreen] Image preview received:", data.previewId);
        const previewData = data as ImagePreviewResponse;
        setPreviewImage(previewData);
        setOriginalPreviewPrompt(previewData.prompt);
        setPreviewType("image");
      } else {
        // Direct message (fallback)
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      }
    },
    onError: (error: any) => {
      console.error("[ChatScreen] Image generation error:", error);
      
      // Close the preview modal on error
      setPreviewImage(null);
      
      // Check if this is a timeout error where the image might still be generating
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('canceled')) {
        Alert.alert(
          "Image Generating",
          "Your image is taking longer than expected but may still complete. The image will appear when ready.",
          [
            {
              text: "OK",
              onPress: () => {
                queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to generate image. Please try again.");
      }
    },
  });

  // Confirm Image Mutation
  const confirmImageMutation = useMutation({
    mutationFn: async (data: { 
      imageUrl: string; 
      prompt: string; 
      userId: string; 
      chatId: string; 
      type: "image" | "meme" | "remix";
      metadata?: any;
    }) => {
      return await api.post<Message>("/api/ai/confirm-image", data);
    },
    onMutate: () => {
      setIsConfirmingImage(true);
    },
    onSuccess: () => {
      setIsConfirmingImage(false);
      setPreviewImage(null); // Close modal
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
    onError: (error) => {
      setIsConfirmingImage(false);
      console.error("[ChatScreen] Failed to confirm image:", error);
      Alert.alert("Error", "Failed to send image. Please try again.");
    }
  });

  // Edit Image Mutation (Refinement)
  const editImageMutation = useMutation({
    mutationFn: async (data: { 
      previousImageUrl: string; 
      editPrompt: string; 
      userId: string; 
      chatId: string; 
      type: "image" | "meme" | "remix";
    }) => {
      return await api.post<ImagePreviewResponse>("/api/ai/edit-image", {
        originalImageUrl: data.previousImageUrl,
        editPrompt: data.editPrompt,
        userId: data.userId,
        chatId: data.chatId,
        preview: true
      });
    },
    onMutate: () => {
      setIsEditingImage(true);
    },
    onSuccess: (data) => {
      setIsEditingImage(false);
      // Update the preview with the new image
      if (data && data.imageUrl) {
        setPreviewImage(data);
      }
    },
    onError: (error) => {
      setIsEditingImage(false);
      console.error("[ChatScreen] Failed to edit image:", error);
      Alert.alert("Error", "Failed to update image. Please try again.");
    }
  });

  // Meme generation mutation
  const generateMemeMutation = useMutation({
    mutationFn: async (data: { prompt: string; userId: string; chatId: string; referenceImageUrl?: string }) => {
      // Call backend to generate meme
      console.log("[ChatScreen] Generating meme via backend with prompt:", data.prompt);
      if (data.referenceImageUrl) {
        console.log("[ChatScreen] Using reference image:", data.referenceImageUrl);
      }

      const result = await api.post<GenerateImageResponse>("/api/ai/generate-meme", {
        prompt: data.prompt,
        userId: data.userId,
        chatId: data.chatId,
        referenceImageUrl: data.referenceImageUrl,
        preview: true, // Enable preview mode
      });

      return result;
    },
    onMutate: (data) => {
      // Immediately open preview modal with loading state
      console.log("[ChatScreen] Meme generation started, opening preview modal");
      setPreviewImage({
        imageUrl: '', // Empty triggers loading/shimmer state
        previewId: 'generating',
        prompt: data.prompt,
      });
      setOriginalPreviewPrompt(data.prompt);
      setPreviewType("meme");
    },
    onSuccess: (data) => {
      // Preview mode - show the preview modal
      if ('previewId' in data) {
        console.log("[ChatScreen] Meme preview received:", data.previewId);
        const previewData = data as ImagePreviewResponse;
        setPreviewImage(previewData);
        setOriginalPreviewPrompt(previewData.prompt);
        setPreviewType("meme");
      } else {
        // Direct message (fallback)
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      }
    },
    onError: (error: any) => {
      console.error("[ChatScreen] Meme generation error:", error);
      
      // Close the preview modal on error
      setPreviewImage(null);
      
      // Check if this is a timeout error where the meme might still be generating
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('canceled')) {
        Alert.alert(
          "Meme Generating",
          "Your meme is taking longer than expected but may still complete. The meme will appear when ready.",
          [
            {
              text: "OK",
              onPress: () => {
                queryClient.invalidateQueries({ queryKey: ["messages"] });
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to generate meme. Please try again.");
      }
    },
  });

  // Execute custom command mutation
  const executeCustomCommandMutation = useMutation({
    mutationFn: (data: ExecuteCustomCommandRequest) =>
      api.post<Message>("/api/custom-commands/execute", data),
    onMutate: () => {
      // Show typing indicator immediately for responsive UI
      setIsAITyping(true);
    },
    onSuccess: () => {
      // Don't clear typing indicator here - realtime handler will clear it when message arrives
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error: any) => {
      // Only clear on error since message won't arrive via realtime
      setIsAITyping(false);
      console.error("[ChatScreen] Custom command execution error:", error);
      
      // Check if this is a timeout error where the command might still be processing
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('canceled')) {
        // For timeout errors, show a more informative message and invalidate queries
        // in case the command completes on the backend
        Alert.alert(
          "Command Processing",
          "Your command is taking longer than expected but may still complete. The response will appear when ready.",
          [
            {
              text: "OK",
              onPress: () => {
                // Invalidate queries to check if the command completed
                queryClient.invalidateQueries({ queryKey: ["messages"] });
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to execute custom command. Please try again.");
      }
    },
  });

  // Image picker functions
  const takePhoto = async () => {
    try {
      // Check current permission status
      const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();
      
      let finalStatus = currentStatus;
      
      // If not granted, request permission
      if (currentStatus !== "granted") {
        const { status: newStatus } = await ImagePicker.requestCameraPermissionsAsync();
        finalStatus = newStatus;
      }
      
      // If still not granted, show alert with instructions
      if (finalStatus !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to take photos.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: () => {
                // On iOS, this will prompt the user to go to settings
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                }
              }
            }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const pickedImage = result.assets[0];

        // Compress and resize the image to keep it under 2MB
        console.log(`Original image size: ${pickedImage.fileSize ? (pickedImage.fileSize / 1024 / 1024).toFixed(2) : 'unknown'} MB`);

        // Calculate target dimensions (max 1920px on longest side)
        const maxDimension = 1920;
        let width = pickedImage.width;
        let height = pickedImage.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }

        // Manipulate (resize and compress) the image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          pickedImage.uri,
          [{ resize: { width, height } }],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        console.log(`Compressed image dimensions: ${width}x${height}`);
        setSelectedImages([manipulatedImage.uri]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        allowsMultipleSelection: true, // Allow multiple selection
        quality: 0.8,
        selectionLimit: 10, // Max 10 images
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const processedImages: string[] = [];

        // Process each selected image
        for (const pickedImage of result.assets) {
          // Compress and resize the image to keep it under 2MB
          console.log(`Original image size: ${pickedImage.fileSize ? (pickedImage.fileSize / 1024 / 1024).toFixed(2) : 'unknown'} MB`);

          // Calculate target dimensions (max 1920px on longest side)
          const maxDimension = 1920;
          let width = pickedImage.width;
          let height = pickedImage.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height / width) * maxDimension);
              width = maxDimension;
            } else {
              width = Math.round((width / height) * maxDimension);
              height = maxDimension;
            }
          }

          // Manipulate (resize and compress) the image
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            pickedImage.uri,
            [{ resize: { width, height } }],
            {
              compress: 0.8,
              format: ImageManipulator.SaveFormat.JPEG, // Convert all to JPEG for smaller size
            }
          );

          console.log(`Compressed image dimensions: ${width}x${height}`);
          processedImages.push(manipulatedImage.uri);
        }

        setSelectedImages(processedImages);
        console.log(`Selected ${processedImages.length} image(s)`);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadImageAndSend = async () => {
    if (selectedImages.length === 0 || !user) return;

    setIsUploadingImage(true);
    try {
      // Get auth token
      const token = await authClient.getToken();
      
      // Upload all selected images
      const uploadedUrls: string[] = [];
      
      for (const imageUri of selectedImages) {
        console.log("[ChatScreen] Uploading image:", imageUri);

        // Use FileSystem.uploadAsync for proper file upload in React Native
        const uploadResult = await FileSystem.uploadAsync(
          `${BACKEND_URL}/api/upload/image`,
          imageUri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: "image",
            headers: token ? {
              Authorization: `Bearer ${token}`,
            } : undefined,
          }
        );

        console.log("[ChatScreen] Image upload result status:", uploadResult.status);

        if (uploadResult.status !== 200) {
          console.error("Image upload failed:", uploadResult.status, uploadResult.body);
          throw new Error(`Upload failed: ${uploadResult.status}`);
        }

        const uploadData: UploadImageResponse = JSON.parse(uploadResult.body);
        
        if (!uploadData.success || !uploadData.url) {
          console.error("Invalid upload response:", uploadData);
          throw new Error("Invalid upload response");
        }

        console.log("[ChatScreen] Image uploaded successfully:", uploadData.url);
        uploadedUrls.push(uploadData.url);
      }

      // Send message with image URL(s)
      // For multiple images, store URLs in metadata.mediaUrls
      // For single image, use imageUrl for backward compatibility
      if (uploadedUrls.length === 1) {
        await sendMessageMutation.mutateAsync({
          content: messageText.trim(),
          messageType: "image",
          imageUrl: uploadedUrls[0],
          replyToId: replyToMessage?.id,
        });
      } else {
        // Multiple images - store in metadata
        await sendMessageMutation.mutateAsync({
          content: messageText.trim(),
          messageType: "image",
          imageUrl: uploadedUrls[0], // First image for thumbnail/preview
          metadata: { mediaUrls: uploadedUrls },
          replyToId: replyToMessage?.id,
        });
      }

      // Clear selected images after successful send
      setSelectedImages([]);
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "videos",
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // Max 60 seconds
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedVideo = result.assets[0];
        console.log(`[ChatScreen] Selected video: ${pickedVideo.uri}`);
        console.log(`[ChatScreen] Video duration: ${pickedVideo.duration}ms`);
        
        setSelectedVideo({
          uri: pickedVideo.uri,
          duration: pickedVideo.duration ? Math.round(pickedVideo.duration / 1000) : undefined,
        });
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to pick video");
    }
  };

  const uploadVideoAndSend = async () => {
    if (!selectedVideo || !user) return;

    setIsUploadingVideo(true);
    try {
      // Get auth token
      const token = await authClient.getToken();

      console.log("[ChatScreen] Uploading video:", selectedVideo.uri);

      // Upload video
      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/upload/video`,
        selectedVideo.uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "video",
          headers: token ? {
            Authorization: `Bearer ${token}`,
          } : undefined,
        }
      );

      console.log("[ChatScreen] Video upload result status:", uploadResult.status);

      if (uploadResult.status !== 200) {
        console.error("Video upload failed:", uploadResult.status, uploadResult.body);
        throw new Error(`Upload failed: ${uploadResult.status}`);
      }

      const uploadData = JSON.parse(uploadResult.body);
      
      if (!uploadData.success || !uploadData.url) {
        console.error("Invalid upload response:", uploadData);
        throw new Error("Invalid upload response");
      }

      console.log("[ChatScreen] Video uploaded successfully:", uploadData.url);

      // Generate thumbnail
      let thumbnailUrl: string | null = null;
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
          selectedVideo.uri,
          { time: 1000 } // Get thumbnail at 1 second
        );
        
        // Upload thumbnail
        const thumbnailUploadResult = await FileSystem.uploadAsync(
          `${BACKEND_URL}/api/upload/image`,
          thumbnailUri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: "image",
            headers: token ? {
              Authorization: `Bearer ${token}`,
            } : undefined,
          }
        );

        if (thumbnailUploadResult.status === 200) {
          const thumbnailData = JSON.parse(thumbnailUploadResult.body);
          if (thumbnailData.success && thumbnailData.url) {
            thumbnailUrl = thumbnailData.url;
            console.log("[ChatScreen] Thumbnail uploaded successfully:", thumbnailUrl);
          }
        }
      } catch (thumbnailError) {
        console.warn("[ChatScreen] Failed to generate/upload thumbnail:", thumbnailError);
        // Continue without thumbnail
      }

      // Send video message
      await sendMessageMutation.mutateAsync({
        content: messageText.trim(),
        messageType: "video",
        metadata: {
          videoUrl: uploadData.url,
          videoThumbnailUrl: thumbnailUrl,
          videoDuration: selectedVideo.duration,
        },
        replyToId: replyToMessage?.id,
      });

      // Clear selected video after successful send
      setSelectedVideo(null);
    } catch (error) {
      console.error("Error uploading video:", error);
      Alert.alert("Error", "Failed to upload video");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleVoiceSend = async (voiceUri: string, duration: number) => {
    if (!user) return;

    setIsUploadingVoice(true);
    try {
      console.log("[ChatScreen] Uploading voice message from:", voiceUri);

      // Get auth token
      const token = await authClient.getToken();

      // Upload voice file using FileSystem.uploadAsync for better React Native compatibility
      // Don't specify mimeType - let FileSystem detect it from the file
      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/upload/image`,
        voiceUri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "image",
          headers: token ? {
            Authorization: `Bearer ${token}`,
          } : undefined,
        }
      );

      console.log("[ChatScreen] Voice upload result status:", uploadResult.status);
      console.log("[ChatScreen] Voice upload result body:", uploadResult.body);

      if (uploadResult.status !== 200) {
        console.error("Voice upload failed:", uploadResult.status, uploadResult.body);
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      const uploadData = JSON.parse(uploadResult.body);
      
      if (!uploadData.success || !uploadData.url) {
        console.error("Invalid upload response:", uploadData);
        throw new Error("Invalid upload response");
      }

      console.log("[ChatScreen] Voice uploaded successfully:", uploadData.url);

      // Send voice message
      await sendMessageMutation.mutateAsync({
        content: "",
        messageType: "voice",
        voiceUrl: uploadData.url,
        voiceDuration: duration,
        replyToId: replyToMessage?.id,
      });

      setIsRecordingVoice(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("[ChatScreen] Error uploading voice message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to upload voice message. Please try again.");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const handleSend = async (overrideVibe?: VibeType | null) => {
    if (!user) return;

    // Re-enable auto-scroll when user sends a message
    if (isManualScrolling.current) {
      console.log(`[HandleSend] Re-enabling auto-scroll (user sent a message)`);
    }
    isManualScrolling.current = false;
    setHasNewMessages(false); // Clear new messages flag when user sends a message

    const trimmedMessage = messageText.trim();

    // Check for /image command FIRST (before checking selectedImages alone)
    if (trimmedMessage.startsWith("/image ")) {
      console.log("[ChatScreen /image] ===== /IMAGE COMMAND DETECTED =====");
      const prompt = trimmedMessage.substring(7).trim();
      console.log("[ChatScreen /image] Extracted prompt:", prompt);
      console.log("[ChatScreen /image] Selected images count:", selectedImages.length);
      console.log("[ChatScreen /image] Selected images:", selectedImages);
      
      if (prompt) {
        setMessageText(""); // Clear input immediately
        clearDraftMessage(); // Clear draft immediately
        setReplyToMessage(null);
        setInputLinkPreview(null);
        setInputPreviewUrl(null);

        // If user has images selected, upload them first and use as references
        if (selectedImages.length > 0) {
          console.log("[ChatScreen /image] ✅ Images detected! Starting upload process...");
          setIsUploadingImage(true);
          try {
            const uploadedUrls: string[] = [];
            
            // Get auth token
            const token = await authClient.getToken();

            // Upload all selected images
            for (const imageUri of selectedImages) {
              console.log("[ChatScreen /image] Uploading image:", imageUri);
              
              const uploadResult = await FileSystem.uploadAsync(
                `${BACKEND_URL}/api/upload/image`,
                imageUri,
                {
                  httpMethod: "POST",
                  uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                  fieldName: "image",
                  headers: token ? {
                    Authorization: `Bearer ${token}`,
                  } : undefined,
                }
              );

              console.log("[ChatScreen /image] Upload response status:", uploadResult.status);

              if (uploadResult.status !== 200) {
                throw new Error(`Upload failed: ${uploadResult.status}`);
              }

              const uploadData: UploadImageResponse = JSON.parse(uploadResult.body);
              console.log("[ChatScreen /image] Upload successful! URL:", uploadData.url);
              uploadedUrls.push(uploadData.url);
            }

            console.log("[ChatScreen /image] All images uploaded. URLs:", uploadedUrls);
            console.log("[ChatScreen /image] Calling generateImageMutation with reference images...");

            // Generate image with references
            generateImageMutation.mutate({
              prompt,
              userId: user.id,
              aspectRatio: "1:1",
              referenceImageUrls: uploadedUrls,
            });

            console.log("[ChatScreen /image] Mutation called!");

            // Clear selected images
            setSelectedImages([]);
          } catch (error) {
            console.error("[ChatScreen /image] ❌ Error uploading reference images:", error);
            Alert.alert("Error", "Failed to upload reference images");
          } finally {
            setIsUploadingImage(false);
          }
        } else {
          console.log("[ChatScreen /image] ℹ️ No images selected, generating from text prompt only");
          // No reference images, just generate from prompt
          generateImageMutation.mutate({
            prompt,
            userId: user.id,
            aspectRatio: "1:1",
          });
        }
      } else {
        console.log("[ChatScreen /image] ⚠️ No prompt provided after /image command");
      }
      return;
    }

    if (trimmedMessage.startsWith("/meme ")) {
      const prompt = trimmedMessage.substring(6).trim();
      if (prompt) {
        setMessageText(""); // Clear input immediately
        clearDraftMessage(); // Clear draft immediately
        setReplyToMessage(null);
        setInputLinkPreview(null);
        setInputPreviewUrl(null);

        // If user has images selected, upload the first one and use as reference
        if (selectedImages.length > 0) {
          setIsUploadingImage(true);
          try {
            // Use only the first image for memes
            const imageUri = selectedImages[0];
            
            // Get auth token
            const token = await authClient.getToken();

            // Upload image using FileSystem.uploadAsync
            const uploadResult = await FileSystem.uploadAsync(
              `${BACKEND_URL}/api/upload/image`,
              imageUri,
              {
                httpMethod: "POST",
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: "image",
                headers: token ? {
                  Authorization: `Bearer ${token}`,
                } : undefined,
              }
            );

            if (uploadResult.status !== 200) {
              throw new Error(`Upload failed: ${uploadResult.status}`);
            }

            const uploadData = JSON.parse(uploadResult.body);

            // Generate meme with reference
            generateMemeMutation.mutate({
              prompt,
              userId: user.id,
              chatId: chatId,
              referenceImageUrl: uploadData.url,
            });

            // Clear selected images
            setSelectedImages([]);
          } catch (error) {
            console.error("Error uploading reference image:", error);
            Alert.alert("Error", "Failed to upload reference image");
          } finally {
            setIsUploadingImage(false);
          }
        } else {
          // No reference image, just generate from prompt
          generateMemeMutation.mutate({
            prompt,
            userId: user.id,
            chatId: chatId,
          });
        }
      }
      return;
    }


    // If video is selected, upload and send video message
    if (selectedVideo) {
      await uploadVideoAndSend();
      return;
    }

    // If images are selected (but not /image or /meme command), upload and send image message
    if (selectedImages.length > 0) {
      await uploadImageAndSend();
      return;
    }

    // Check for custom slash commands
    if (trimmedMessage.startsWith("/")) {
      const commandEnd = trimmedMessage.indexOf(" ");
      const commandName = commandEnd > 0 ? trimmedMessage.substring(0, commandEnd) : trimmedMessage;
      const matchedCommand = customCommands.find(cmd => cmd.command === commandName);

      if (matchedCommand) {
        const commandInput = commandEnd > 0 ? trimmedMessage.substring(commandEnd + 1).trim() : "";
        const replyToId = replyToMessage?.id; // Capture reply context
        setMessageText(""); // Clear input immediately
        clearDraftMessage(); // Clear draft immediately
        setReplyToMessage(null);
        setInputLinkPreview(null);
        setInputPreviewUrl(null);
        executeCustomCommandMutation.mutate({
          commandId: matchedCommand.id,
          userId: user.id,
          userMessage: commandInput || trimmedMessage,
          chatId: chatId,
          replyToId: replyToId,
        });
        return;
      }
    }

    // Check if message contains any AI friend mention
    console.log('[ChatScreen] === AI MENTION CHECK START ===');
    console.log('[ChatScreen] aiFriends.length:', aiFriends?.length || 0);
    console.log('[ChatScreen] Available AI friends:', JSON.stringify(aiFriends));
    console.log('[ChatScreen] Trimmed message:', trimmedMessage);
    console.log('[ChatScreen] mentionedUserIds:', mentionedUserIds);
    
    let mentionedAIFriend: AIFriend | undefined;
    
    // Check if any of the mentionedUserIds are AI friend IDs
    if (mentionedUserIds.length > 0) {
      console.log('[ChatScreen] Checking mentionedUserIds against AI friends...');
      for (const mentionedId of mentionedUserIds) {
        console.log('[ChatScreen] Checking mentionedId:', mentionedId);
        console.log('[ChatScreen] AI friend IDs:', aiFriends.map(f => f.id));
        const matchedFriend = aiFriends.find(f => {
          console.log(`[ChatScreen] Comparing "${f.id}" === "${mentionedId}":`, f.id === mentionedId);
          return f.id === mentionedId;
        });
        if (matchedFriend) {
          mentionedAIFriend = matchedFriend;
          console.log('[ChatScreen] ✅ Found AI friend via mentionedUserIds:', matchedFriend);
          break;
        } else {
          console.log('[ChatScreen] ❌ No match found for mentionedId:', mentionedId);
        }
      }
    }
    
    // If not found via IDs, check message text
    if (!mentionedAIFriend) {
      for (const friend of aiFriends) {
        const searchText = `@${friend.name.toLowerCase()}`;
        console.log('[ChatScreen] Checking if message includes:', searchText);
        if (trimmedMessage.toLowerCase().includes(searchText)) {
          mentionedAIFriend = friend;
          console.log('[ChatScreen] Found mentioned AI friend via text:', friend);
          break;
        }
      }
    }
    
    // Also check for generic @ai mention (use first AI friend)
    if (!mentionedAIFriend && trimmedMessage.toLowerCase().includes("@ai") && aiFriends.length > 0) {
      mentionedAIFriend = aiFriends[0];
      console.log('[ChatScreen] Using generic @ai, selecting first AI friend:', mentionedAIFriend);
    }
    
    console.log('[ChatScreen] Final mentionedAIFriend:', mentionedAIFriend);
    console.log('[ChatScreen] === AI MENTION CHECK END ===');
    
    if (mentionedAIFriend) {
      console.log('[ChatScreen] ✅ AI friend mention detected, triggering AI chat mutation');
      console.log('[ChatScreen] Mentioned AI Friend:', mentionedAIFriend);

      try {
        // NOTE: We allow AI friend callouts even if the last message is from AI.
        // This is a user-initiated command, and the backend lock system will
        // prevent any interference with ongoing AI responses.

        // Clear input immediately for instant feedback
        const currentReplyTo = replyToMessage;
        const currentMentions = mentionedUserIds.length > 0 ? mentionedUserIds : undefined;
        const currentVibe = overrideVibe !== undefined ? overrideVibe : selectedVibe;
        setMessageText("");
        clearDraftMessage(); // Clear draft immediately
        setReplyToMessage(null);
        setMentionedUserIds([]);
        setInputHeight(MIN_INPUT_HEIGHT);
        setSelectedVibe(null);
        setInputLinkPreview(null);
        setInputPreviewUrl(null);

        // Send the user's message (optimistic update will show it immediately)
        console.log('[ChatScreen] Sending user message with vibeType:', currentVibe);
        sendMessageMutation.mutate({
          content: trimmedMessage,
          messageType: "text",
          replyToId: currentReplyTo?.id,
          mentionedUserIds: currentMentions,
          vibeType: currentVibe,
        });
        console.log('[ChatScreen] User message mutation called');

        // Call AI with the specific AI friend (don't wait for user message to complete)
        console.log('[ChatScreen] Calling AI chat mutation with aiFriendId:', mentionedAIFriend.id);
        aiChatMutation.mutate({
          userId: user.id,
          userMessage: trimmedMessage,
          chatId: chatId,
          aiFriendId: mentionedAIFriend.id,
        });
        console.log('[ChatScreen] AI chat mutation called');
      } catch (error) {
        console.error('[ChatScreen] ERROR during AI message flow:', error);
        Alert.alert('Error', `Failed to send AI message: ${error}`);
      }
      return; // Don't continue to regular message sending

    } else {
      // Regular message
      console.log('[ChatScreen] ❌ No AI friend mention detected, sending regular message');
      console.log('[ChatScreen] This was NOT detected as an AI mention');
      
      // Clear input immediately for instant feedback
      const currentReplyTo = replyToMessage;
      const currentMentions = mentionedUserIds.length > 0 ? mentionedUserIds : undefined;
      const currentVibe = overrideVibe !== undefined ? overrideVibe : selectedVibe;
      setMessageText("");
      clearDraftMessage(); // Clear draft immediately
      setReplyToMessage(null);
      setMentionedUserIds([]);
      setInputHeight(MIN_INPUT_HEIGHT);
      setSelectedVibe(null);
      setInputLinkPreview(null);
      setInputPreviewUrl(null);
      
      console.log('[ChatScreen] Sending regular message with vibeType:', currentVibe);
      sendMessageMutation.mutate({
        content: trimmedMessage,
        messageType: "text",
        replyToId: currentReplyTo?.id,
        mentionedUserIds: currentMentions,
        vibeType: currentVibe,
      });
    }
  };

  // Handler for long press on message
  const handleLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContextMenuMessage(message);
  };

  // VibeSelector handlers
  const vibeTouchStartTime = useRef<number>(0);
  const vibeTouchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const handleSendButtonPressIn = useCallback((event: any) => {
    // Only show vibe selector if there's content to send
    if (!messageText.trim() && selectedImages.length === 0 && !selectedVideo) return;
    
    // Record touch start time and position
    vibeTouchStartTime.current = Date.now();
    const { pageX, pageY } = event.nativeEvent;
    vibeTouchStartPos.current = { x: pageX, y: pageY };
    
    // Start long press timer
    vibeLongPressTimer.current = setTimeout(() => {
      // Get send button position for vibe selector placement
      if (sendButtonRef.current) {
        sendButtonRef.current.measureInWindow((x, y, width, height) => {
          setSendButtonPosition({ x: x + width / 2, y: y });
          setShowVibeSelector(true);
        });
      }
    }, 300); // 300ms long press threshold
  }, [messageText, selectedImages]);

  const handleSendButtonPressOut = useCallback(() => {
    // Clear long press timer if released before threshold
    if (vibeLongPressTimer.current) {
      clearTimeout(vibeLongPressTimer.current);
      vibeLongPressTimer.current = null;
    }
  }, []);
  
  const handleSendButtonTouchMove = useCallback((event: any) => {
    if (!showVibeSelector) return;
    const { pageX, pageY } = event.nativeEvent;
    VibeSelectorStatic.handleTouchMove(pageX, pageY);
  }, [showVibeSelector]);
  
  const handleSendButtonTouchEnd = useCallback((event: any) => {
    if (!showVibeSelector) return;
    const { pageX, pageY } = event.nativeEvent;
    VibeSelectorStatic.handleTouchEnd(pageX, pageY);
  }, [showVibeSelector]);

  const handleVibeSelect = useCallback((vibe: VibeType | null) => {
    setSelectedVibe(vibe);
    setPreviewVibe(null);
    setShowVibeSelector(false);
    // Immediately send with the selected vibe - pass vibe directly to avoid state timing issues
    if (vibe) {
      handleSend(vibe);
    }
  }, [handleSend]);

  const handleVibePreview = useCallback((vibe: VibeType | null) => {
    setPreviewVibe(vibe);
  }, []);

  const handleVibeCancel = useCallback(() => {
    setPreviewVibe(null);
    setShowVibeSelector(false);
  }, []);

  // Handler for replying to message
  const handleReply = (message: Message) => {
    setReplyToMessage(message);
  };

  // Handler for copying message
  const handleCopy = async (message: Message) => {
    if (message.content) {
      await Clipboard.setStringAsync(message.content);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Message copied to clipboard");
    }
  };

  // Handler for reacting to message
  const handleReact = (message: Message) => {
    setReactionPickerMessage(message);
  };

  // Handler for deleting message
  const handleDelete = (message: Message) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMessageMutation.mutate(message.id);
          },
        },
      ]
    );
  };

  // Handler for editing message
  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setEditText(message.content);
  };

  // PanResponder for Edit Message modal swipe-down gesture
  const editModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging down (positive dy)
        if (gestureState.dy > 0) {
          editModalDragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 100px or with enough velocity, close
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditingMessage(null);
          // Reset drag position
          Animated.spring(editModalDragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          // Spring back to original position
          Animated.spring(editModalDragY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset drag position if gesture is interrupted
        Animated.spring(editModalDragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Reset drag position when edit modal closes
  useEffect(() => {
    if (!editingMessage) {
      editModalDragY.setValue(0);
    }
  }, [editingMessage]);

  // PanResponder for Search modal swipe-down gesture
  const searchModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          searchModalDragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowSearchModal(false);
          setSearchQuery("");
          Animated.spring(searchModalDragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(searchModalDragY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(searchModalDragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // PanResponder for Bookmarks modal swipe-down gesture
  const bookmarksModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          bookmarksModalDragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowBookmarksModal(false);
          Animated.spring(bookmarksModalDragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(bookmarksModalDragY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(bookmarksModalDragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // PanResponder for Events modal swipe-down gesture
  const eventsModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          eventsModalDragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowEventsTab(false);
          Animated.spring(eventsModalDragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(eventsModalDragY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(eventsModalDragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Reset drag positions when modals close
  useEffect(() => {
    if (!showSearchModal) {
      searchModalDragY.setValue(0);
    }
  }, [showSearchModal]);

  useEffect(() => {
    if (!showBookmarksModal) {
      bookmarksModalDragY.setValue(0);
    }
  }, [showBookmarksModal]);

  useEffect(() => {
    if (!showEventsTab) {
      eventsModalDragY.setValue(0);
    }
  }, [showEventsTab]);

  // Handler for unsending message
  const handleUnsend = (message: Message) => {
    Alert.alert(
      "Unsend Message",
      "This will remove the message for everyone. Recipients may still see the message on devices where the software hasn't been updated.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unsend",
          style: "destructive",
          onPress: () => {
            unsendMessageMutation.mutate(message.id);
          },
        },
      ]
    );
  };

  // Check if user can delete a message
  const canDeleteMessage = (message: Message): boolean => {
    if (!user || !chat) {
      console.log("[ChatScreen] canDeleteMessage: user or chat not available", { user: !!user, chat: !!chat });
      return false;
    }

    // Check if this is an AI message (has aiFriendId and userId is null)
    const isAIMessage = message.aiFriendId && message.userId === null;

    console.log("[ChatScreen] canDeleteMessage check:", {
      messageId: message.id,
      messageUserId: message.userId,
      currentUserId: user.id,
      chatCreatorId: chat.creatorId,
      isOwnMessage: message.userId === user.id,
      isAIMessage,
      aiFriendId: message.aiFriendId,
      isCreator: chat.creatorId === user.id,
    });

    // User can delete their own messages
    if (message.userId === user.id) {
      console.log("[ChatScreen] User can delete own message");
      return true;
    }

    // Chat creator can delete AI messages (messages with aiFriendId and null userId)
    if (isAIMessage && chat.creatorId === user.id) {
      console.log("[ChatScreen] Creator can delete AI message");
      return true;
    }

    console.log("[ChatScreen] User cannot delete this message");
    return false;
  };

  // Check if user can edit a message (only own messages, within 15 minutes)
  const canEditMessage = (message: Message): boolean => {
    if (!user) return false;
    
    // Only own messages can be edited
    if (message.userId !== user.id) return false;

    // System messages and AI messages cannot be edited
    const isAIMessage = message.aiFriendId && message.userId === null;
    if (message.messageType === "system" || isAIMessage) return false;

    // Check if message is within 15 minute window
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    
    return messageAge <= fifteenMinutes;
  };

  // Check if user can unsend a message (only own messages, within 2 minutes)
  const canUnsendMessage = (message: Message): boolean => {
    if (!user) return false;
    
    // Only own messages can be unsent
    if (message.userId !== user.id) return false;

    // System messages and AI messages cannot be unsent
    const isAIMessage = message.aiFriendId && message.userId === null;
    if (message.messageType === "system" || isAIMessage) return false;

    // Already unsent messages cannot be unsent again
    if (message.isUnsent) return false;

    // Check if message is within 2 minute window
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const twoMinutes = 2 * 60 * 1000;
    
    return messageAge <= twoMinutes;
  };

  // Handler for selecting emoji
  const handleSelectEmoji = (emoji: string, message: Message) => {
    if (!user) return;
    addReactionMutation.mutate({
      emoji,
      userId: user.id,
      messageId: message.id,
    });
  };

  // Handler for enabling selection mode
  const enableSelectionMode = (messageId: string) => {
    setSelectionMode(true);
    setSelectedMessageIds(new Set([messageId]));
  };

  // Handler for toggling message selection
  const toggleMessageSelection = (messageId: string) => {
    const newSelection = new Set(selectedMessageIds);
    if (newSelection.has(messageId)) {
      newSelection.delete(messageId);
    } else {
      newSelection.add(messageId);
    }
    setSelectedMessageIds(newSelection);
    
    // Exit selection mode if no messages selected
    if (newSelection.size === 0) {
      setSelectionMode(false);
    }
  };

  // Handler for canceling selection mode
  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  // Handler for batch deleting selected messages
  const handleBatchDelete = () => {
    if (selectedMessageIds.size === 0) return;
    
    Alert.alert(
      "Delete Messages",
      `Are you sure you want to delete ${selectedMessageIds.size} message(s)?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Delete all selected messages
            for (const messageId of Array.from(selectedMessageIds)) {
              await deleteMessageMutation.mutateAsync(messageId);
            }
            cancelSelectionMode();
          },
        },
      ]
    );
  };

  // ===== IMAGE SELECTION MODE HANDLERS =====
  
  // Handler for enabling image selection mode
  const enableImageSelectionMode = (messageId?: string) => {
    setImageSelectionMode(true);
    if (messageId) {
      setSelectedImageMessageIds(new Set([messageId]));
    }
    // Close image viewer if open
    setViewerImage(null);
  };

  // Handler for toggling image selection
  const toggleImageSelection = (messageId: string) => {
    const newSelection = new Set(selectedImageMessageIds);
    if (newSelection.has(messageId)) {
      newSelection.delete(messageId);
    } else {
      newSelection.add(messageId);
    }
    setSelectedImageMessageIds(newSelection);
    
    // Exit selection mode if no images selected
    if (newSelection.size === 0) {
      setImageSelectionMode(false);
    }
  };

  // Handler for canceling image selection mode
  const cancelImageSelectionMode = () => {
    setImageSelectionMode(false);
    setSelectedImageMessageIds(new Set());
  };

  // Handler for saving selected images
  const handleSaveSelectedImages = async () => {
    if (selectedImageMessageIds.size === 0) return;
    
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant permission to save images to your library.");
        return;
      }

      const imageMessages = messages?.filter(
        (msg) => selectedImageMessageIds.has(msg.id) && msg.messageType === "image" && msg.imageUrl
      ) || [];

      if (imageMessages.length === 0) return;

      // Save all selected images
      for (const msg of imageMessages) {
        const fullImageUrl = getFullImageUrl(msg.imageUrl!); // Assert non-null as filtered above
        const extension = fullImageUrl.split(".").pop()?.split("?")[0] || "jpg";
        const fileUri = `${FileSystem.cacheDirectory}vibechat_${msg.id}.${extension}`;
        
        const downloadResult = await FileSystem.downloadAsync(fullImageUrl, fileUri);
        await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
      }

      Alert.alert("Success", `${imageMessages.length} image(s) saved to your library!`);
      cancelImageSelectionMode();
    } catch (error) {
      console.error("Error saving images:", error);
      Alert.alert("Error", "Failed to save images");
    }
  };

  // Handler for sharing selected images
  const handleShareSelectedImages = async () => {
    if (selectedImageMessageIds.size === 0) return;
    
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device");
        return;
      }

      const imageMessages = messages?.filter(
        (msg) => selectedImageMessageIds.has(msg.id) && msg.messageType === "image" && msg.imageUrl
      ) || [];

      if (imageMessages.length === 0) return;

      // Download all images
      const fileUris: string[] = [];
      for (const msg of imageMessages) {
        const fullImageUrl = getFullImageUrl(msg.imageUrl);
        const fileUri = `${FileSystem.cacheDirectory}share-image-${msg.id}.jpg`;
        const downloadResult = await FileSystem.downloadAsync(fullImageUrl, fileUri);
        fileUris.push(downloadResult.uri);
      }

      // Share all images (Note: some platforms may only share the first image)
      if (fileUris.length === 1) {
        await Sharing.shareAsync(fileUris[0]);
      } else {
        // For multiple images, share the first one with a note
        await Sharing.shareAsync(fileUris[0]);
        Alert.alert("Note", "Multiple images selected. Some platforms may only share the first image.");
      }

      cancelImageSelectionMode();
    } catch (error) {
      console.error("Error sharing images:", error);
      Alert.alert("Error", "Failed to share images");
    }
  };

  // Handler for deleting selected images
  const handleDeleteSelectedImages = () => {
    if (selectedImageMessageIds.size === 0) return;
    
    Alert.alert(
      "Delete Images",
      `Are you sure you want to delete ${selectedImageMessageIds.size} image(s)?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Delete all selected image messages
            for (const messageId of Array.from(selectedImageMessageIds)) {
              await deleteMessageMutation.mutateAsync(messageId);
            }
            cancelImageSelectionMode();
          },
        },
      ]
    );
  };

  // Helper to clear draft message immediately (bypass debounce)
  const clearDraftMessage = async () => {
    try {
      const draftKey = `draft_message_${chatId}`;
      await AsyncStorage.removeItem(draftKey);
    } catch (error) {
      console.error("[ChatScreen] Failed to clear draft message:", error);
    }
  };

  // Handler for typing indicator
  const handleTyping = (text: string) => {
    setActiveInput("main");
    setMessageText(text);
    
    // Detect @ mention
    const cursorPosition = text.length; // Assume cursor at end for now
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's a space after @, if so, close picker
      if (textAfterAt.includes(" ")) {
        setShowMentionPicker(false);
        setMentionSearch("");
        setMentionStartIndex(-1);
      } else {
        // Show mention picker with search
        setShowMentionPicker(true);
        setMentionSearch(textAfterAt);
        setMentionStartIndex(lastAtIndex);
      }
    } else {
      setShowMentionPicker(false);
      setMentionSearch("");
      setMentionStartIndex(-1);
    }
    
    if (!user?.id) return;

    // Clear existing timeout for stopping typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const now = Date.now();
    const THROTTLE_MS = 2000; // Only send "is typing" every 2 seconds

    if (text.trim().length > 0) {
      // Send typing indicator if throttled
      if (now - lastTypingSentAt.current > THROTTLE_MS) {
        lastTypingSentAt.current = now;
        api.post(`/api/chats/${chatId}/typing`, {
          userId: user.id,
          isTyping: true,
        }).catch((err) => console.error("Error sending typing indicator:", err));
      }

      // Set timeout to stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        api.post(`/api/chats/${chatId}/typing`, {
          userId: user.id,
          isTyping: false,
        }).catch((err) => console.error("Error clearing typing indicator:", err));
        lastTypingSentAt.current = 0; // Reset so next typing immediately sends indicator
      }, 3000);
    } else {
      // Stop typing indicator if text is empty
      api.post(`/api/chats/${chatId}/typing`, {
        userId: user.id,
        isTyping: false,
      }).catch((err) => console.error("Error clearing typing indicator:", err));
      lastTypingSentAt.current = 0;
    }

    // Detect URLs and fetch link preview with debounce
    const detectedUrl = extractFirstUrl(text);
    
    // Clear any pending link preview fetch
    if (linkPreviewTimeoutRef.current) {
      clearTimeout(linkPreviewTimeoutRef.current);
      linkPreviewTimeoutRef.current = null;
    }
    
    if (detectedUrl) {
      // Only fetch if URL has changed
      if (detectedUrl !== inputPreviewUrl) {
        // Debounce: wait 500ms after typing stops to fetch preview
        linkPreviewTimeoutRef.current = setTimeout(async () => {
          setIsFetchingLinkPreview(true);
          setInputPreviewUrl(detectedUrl);
          
          try {
            const preview = await api.post<LinkPreview>("/api/link-preview/fetch", { url: detectedUrl });
            // Only set if the URL still matches (user might have changed input)
            if (extractFirstUrl(messageText) === detectedUrl || detectedUrl === extractFirstUrl(text)) {
              setInputLinkPreview(preview);
            }
          } catch (error) {
            console.error("[ChatScreen] Failed to fetch link preview:", error);
            // Clear preview on error
            setInputLinkPreview(null);
          } finally {
            setIsFetchingLinkPreview(false);
          }
        }, 500);
      }
    } else {
      // No URL in text, clear preview
      setInputLinkPreview(null);
      setInputPreviewUrl(null);
    }
  };

  // Handler for editing text typing
  const handleEditTyping = (text: string) => {
    setActiveInput("edit");
    setEditText(text);
    
    // Detect @ mention
    const cursorPosition = text.length; 
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      if (textAfterAt.includes(" ")) {
        setShowMentionPicker(false);
        setMentionSearch("");
        setMentionStartIndex(-1);
      } else {
        setShowMentionPicker(true);
        setMentionSearch(textAfterAt);
        setMentionStartIndex(lastAtIndex);
      }
    } else {
      setShowMentionPicker(false);
      setMentionSearch("");
      setMentionStartIndex(-1);
    }
  };
  
  // Handle mention selection
  const handleSelectMention = (selectedUser: User) => {
    if (mentionStartIndex === -1) return;
    
    const currentText = activeInput === "main" ? messageText : editText;
    const before = currentText.substring(0, mentionStartIndex);
    const after = currentText.substring(mentionStartIndex + 1 + mentionSearch.length);
    const newText = `${before}@${selectedUser.name} ${after}`;
    
    if (activeInput === "main") {
      setMessageText(newText);
      // Track mentioned user
      if (!mentionedUserIds.includes(selectedUser.id)) {
        setMentionedUserIds([...mentionedUserIds, selectedUser.id]);
      }
      // Focus back on input
      textInputRef.current?.focus();
    } else {
      setEditText(newText);
      // No focus management needed for edit modal usually as it stays open
    }
    
    setShowMentionPicker(false);
    setMentionSearch("");
    setMentionStartIndex(-1);
  };

  // Handle thread tag selection
  const handleSelectThread = (selectedThread: Thread) => {
    if (mentionStartIndex === -1) return;
    
    const currentText = activeInput === "main" ? messageText : editText;
    const before = currentText.substring(0, mentionStartIndex);
    const after = currentText.substring(mentionStartIndex + 1 + mentionSearch.length);
    const newText = `${before}@${selectedThread.name.toLowerCase()} ${after}`;
    
    if (activeInput === "main") {
      setMessageText(newText);
      textInputRef.current?.focus();
    } else {
      setEditText(newText);
    }
    
    setShowMentionPicker(false);
    setMentionSearch("");
    setMentionStartIndex(-1);
    
    console.log('[ChatScreen] Thread tag inserted:', `@${selectedThread.name.toLowerCase()}`);
  };

  // Handle AI friend mention
  const handleSelectAI = (aiFriend: AIFriend) => {
    if (mentionStartIndex === -1) return;
    
    const currentText = activeInput === "main" ? messageText : editText;
    const before = currentText.substring(0, mentionStartIndex);
    const after = currentText.substring(mentionStartIndex + 1 + mentionSearch.length);
    const newText = `${before}@${aiFriend.name} ${after}`;
    
    if (activeInput === "main") {
      setMessageText(newText);
      // Track the AI friend ID as a mentioned user (for UI purposes)
      if (!mentionedUserIds.includes(aiFriend.id)) {
        setMentionedUserIds([...mentionedUserIds, aiFriend.id]);
      }
      textInputRef.current?.focus();
    } else {
      setEditText(newText);
    }
    
    setShowMentionPicker(false);
    setMentionSearch("");
    setMentionStartIndex(-1);
    
    console.log('[ChatScreen] AI friend mention inserted:', `@${aiFriend.name}`, '(ID:', aiFriend.id, ')');
  };

  // Clear typing indicator on unmount
  useEffect(() => {
    return () => {
      if (user?.id && chatId) {
        api.post(`/api/chats/${chatId}/typing`, {
          userId: user.id,
          isTyping: false,
        }).catch((err) => console.error("Error clearing typing indicator on unmount:", err));
      }
    };
  }, [user?.id, chatId]);

  // Auto-scroll logic and New Message detection
  useEffect(() => {
    if (activeMessages && activeMessages.length > 0) {
      const isNewMessage = activeMessages.length > lastKnownLength;
      
      if (isNewMessage) {
        if (isAtBottomRef.current) {
          // User is at bottom.
          // Inverted list automatically shows new items at the bottom (index 0).
          // We DO NOT force a scroll here to avoid "jumpy" behavior.
        } else {
          // If not at bottom, show scroll button and mark that there are new messages
          setShowScrollToBottom(true);
          setHasNewMessages(true); // Mark that there are NEW unread messages
        }
      } else if (lastKnownLength === 0) {
         // Initial load
         // Ensure we start at the bottom
         requestAnimationFrame(() => {
            scrollToBottom(false);
         });
      }
      
      setLastKnownLength(activeMessages.length);
    }
  }, [activeMessages, lastKnownLength, scrollToBottom]);

  // Auto-scroll when AI starts typing - DISABLED per user request
  // The inverted list should handle the layout naturally.
  /*
  useEffect(() => {
    if (isAITyping && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
    }
  }, [isAITyping, scrollToBottom]);
  */

  // Handle catch-up generation errors
  useEffect(() => {
    if (catchUpError) {
      const errorMessage = catchUpError instanceof Error ? catchUpError.message : String(catchUpError);
      // Check if it's a service unavailability error (503)
      if (errorMessage.includes("503") || errorMessage.includes("temporarily unavailable")) {
        Alert.alert(
          "Service Temporarily Unavailable",
          "The AI service is currently unavailable. Please try again in a few moments.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to generate catch-up summary. Please try again.",
          [{ text: "OK" }]
        );
      }
    }
  }, [catchUpError]);

  // Removed keyboard listeners - now using react-native-keyboard-controller for native-synchronized animations
  
  // Scroll to bottom when keyboard opens to show most recent messages
  const lastKeyboardHeight = useRef(0);
  useAnimatedReaction(
    () => keyboard.height.value,
    (currentHeight, previousHeight) => {
      // Keyboard just opened (went from 0 to positive)
      if (previousHeight === 0 && currentHeight > 0) {
        runOnJS(scrollToBottom)(false);
      }
      lastKeyboardHeight.current = currentHeight;
    },
    []
  );

  const handleInputContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const { height } = event.nativeEvent.contentSize;
      const clampedHeight = Math.min(
        MAX_INPUT_HEIGHT,
        Math.max(MIN_INPUT_HEIGHT, height)
      );
      setInputHeight(clampedHeight);
    },
    []
  );

  // Memoize input styling based on message content to prevent unnecessary re-renders
  const isAIMessage = useMemo(() => 
    messageText.toLowerCase().includes("@ai") || 
    messageText.toLowerCase().includes(`@${(chat?.aiName || "AI Assistant").toLowerCase()}`),
    [messageText, chat?.aiName]
  );

  const hasContent = useMemo(() => messageText.trim().length > 0, [messageText]);

  // Animated values for smooth color transitions
  const colorAnimValue = useRef(new Animated.Value(0)).current;
  const buttonIconRotation = useRef(new Animated.Value(0)).current;
  const buttonIconScale = useRef(new Animated.Value(1)).current;
  
  // Separate opacity values for each gradient state (default, hasContent, isAI)
  const gradientDefaultOpacity = useRef(new Animated.Value(1)).current;
  const gradientContentOpacity = useRef(new Animated.Value(0)).current;
  const gradientAIOpacity = useRef(new Animated.Value(0)).current;

  // Animate color transitions with spring physics for premium feel
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
    if (isAIMessage) {
      // AI message state
      Animated.parallel([
        Animated.spring(gradientDefaultOpacity, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.spring(gradientContentOpacity, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.spring(gradientAIOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
      ]).start();
    } else if (hasContent) {
      // Has content state
      Animated.parallel([
        Animated.spring(gradientDefaultOpacity, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.spring(gradientContentOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.spring(gradientAIOpacity, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
      ]).start();
    } else {
      // Default state
      Animated.parallel([
        Animated.spring(gradientDefaultOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.spring(gradientContentOpacity, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.spring(gradientAIOpacity, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
      ]).start();
    }
  }, [isAIMessage, hasContent]);

  // Animate button icon transition with rotation
  useEffect(() => {
    const showSend = messageText.trim() || selectedImages.length > 0 || selectedVideo;
    
    // Add subtle haptic feedback on transition
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Rotation animation: mic rotates and transforms into arrow
    // Arrow starts pointing left (-90°) and ends pointing up (0°)
    Animated.parallel([
      Animated.spring(buttonIconRotation, {
        toValue: showSend ? 1 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
        velocity: 2,
      }),
      Animated.sequence([
        // Scale down slightly
        Animated.spring(buttonIconScale, {
          toValue: 0.7,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }),
        // Scale back up with subtle haptic
        Animated.spring(buttonIconScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }),
      ]),
    ]).start(() => {
      // Subtle haptic on animation complete
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }, [messageText.trim().length > 0, selectedImages.length > 0, selectedVideo]);

  // Interpolated animated colors for input border
  const animatedBorderColor = colorAnimValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      "rgba(255, 255, 255, 0.2)",
      "rgba(0, 122, 255, 0.4)",
      "rgba(52, 199, 89, 0.5)",
    ],
  });

  const animatedShadowOpacity = colorAnimValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.1, 0.3, 0.3],
  });

  // Button rotation transforms
  // Arrow rotation: starts pointing left (-90°), ends pointing up (0°)
  const arrowRotateInterpolate = buttonIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["-90deg", "0deg"],
  });
  
  // Mic stays at natural orientation
  const micRotateInterpolate = buttonIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "0deg"],
  });

  const inputTextColor = useMemo(() => 
    isAIMessage ? "#14B8A6" : "#FFFFFF",
    [isAIMessage]
  );

  const inputFontWeight = useMemo(() => 
    isAIMessage ? "500" as const : "400" as const,
    [isAIMessage]
  );

  const inputContainerShadowColor = useMemo(() => 
    isAIMessage ? "#14B8A6" : "#007AFF",
    [isAIMessage]
  );

  const inputContainerShadowOpacity = useMemo(() => 
    hasContent ? 0.3 : 0.1,
    [hasContent]
  );

  const inputContainerBorderColor = useMemo(() => 
    isAIMessage 
      ? "rgba(52, 199, 89, 0.5)"
      : hasContent
      ? "rgba(0, 122, 255, 0.4)"
      : "rgba(255, 255, 255, 0.2)",
    [isAIMessage, hasContent]
  );

  const inputGradientColors = useMemo(() => 
    isAIMessage
      ? [
          "rgba(52, 199, 89, 0.25)",
          "rgba(52, 199, 89, 0.15)",
          "rgba(52, 199, 89, 0.08)",
        ] as const
      : hasContent
      ? [
          "rgba(0, 122, 255, 0.20)",
          "rgba(0, 122, 255, 0.12)",
          "rgba(0, 122, 255, 0.05)",
        ] as const
      : [
          "rgba(255, 255, 255, 0.12)",
          "rgba(255, 255, 255, 0.08)",
          "rgba(255, 255, 255, 0.04)",
        ] as const,
    [isAIMessage, hasContent]
  );

  // HIGH-B: Performance optimization - getItemType for FlashList recycling
  const getItemType = useCallback((item: Message | { id: string; isTyping: true } | { id: string; isUserTyping: true; typingUsers: { id: string; name: string }[] }) => {
    if ('isTyping' in item && item.isTyping) return 'ai-typing';
    if ('isUserTyping' in item && item.isUserTyping) return 'user-typing';
    
    const message = item as Message;
    if (message.messageType === "system" || message.userId === "system") {
      if (message.eventId) return 'event';
      if (message.pollId) return 'poll';
      return 'system';
    }
    if (message.isUnsent) return 'unsent';
    if (message.messageType === "voice") return 'voice';
    if (message.messageType === "video") return 'video';
    if (message.messageType === "image") {
      const metadata = message.metadata as { mediaUrls?: string[] } | null;
      if (metadata?.mediaUrls && metadata.mediaUrls.length > 1) return 'multi-image';
      return 'image';
    }
    // Regular text messages - differentiate by alignment for better recycling
    if (message.aiFriendId && message.userId === null) return 'ai-message';
    if (message.userId === user?.id) return 'own-message';
    return 'other-message';
  }, [user?.id]);

  // LOW-21: Helper to detect crisis/safety messages that should never be truncated
  const isCrisisMessage = useCallback((content: string): boolean => {
    if (!content) return false;
    // Check for crisis response patterns from content-safety service
    const crisisPatterns = [
      "I'm really concerned about what you've shared",
      "Your life matters",
      "Please reach out to one of these resources",
      "National Suicide Prevention",
      "Crisis Text Line",
      "988",
      "741741",
      "Samaritans",
      "crisis helpline",
    ];
    const lowerContent = content.toLowerCase();
    return crisisPatterns.some(pattern => 
      lowerContent.includes(pattern.toLowerCase())
    );
  }, []);

  // Memoized displayData for message grouping (accessible in renderMessage)
  const displayDataMemo = useMemo(() => {
    // Backend returns Newest-First (Descending): [Newest, ..., Oldest]
    // Inverted FlashList renders index 0 at bottom
    // So newest (index 0) appears at bottom - no reverse needed!
    const data: (Message | { id: string; isTyping: true } | { id: string; isUserTyping: true; typingUsers: { id: string; name: string }[] })[] = [...activeMessages];

    // Add AI typing indicator if AI is typing (only in main chat, not in threads)
    if (isAITyping && !currentThreadId) {
      data.unshift({ id: 'typing-indicator-ai', isTyping: true as const });
    }

    // Add user typing indicator if users are typing (only in main chat, not in threads)
    if (typingUsers.length > 0 && !currentThreadId) {
      data.unshift({ id: 'typing-indicator-users', isUserTyping: true as const, typingUsers });
    }

    return data;
  }, [activeMessages, isAITyping, currentThreadId, typingUsers]);

  const renderMessage = useCallback(({ item, index }: { item: Message | { id: string; isTyping: true } | { id: string; isUserTyping: true; typingUsers: { id: string; name: string }[] }; index: number }) => {
    // Check if this is the AI typing indicator
    if ('isTyping' in item && item.isTyping) {
      return <AITypingIndicator 
        aiName={typingAIFriend?.name || "AI Assistant"} 
        aiColor="#14B8A6"
      />;
    }
    
    // Check if this is the user typing indicator
    if ('isUserTyping' in item && item.isUserTyping) {
      return <TypingIndicator typingUsers={item.typingUsers} />;
    }

    const message = item as Message;
    const isCurrentUser = message.userId === user?.id;
    // AI messages have userId: null and aiFriendId set
    const isAI = !!(message.aiFriendId && message.userId === null);
    const isSystem = message.messageType === "system" || message.userId === "system";

    // Message grouping logic for consecutive messages from same sender
    const prevMessage = displayDataMemo[index + 1]; // Older message (visually above in inverted list)
    const nextMessage = displayDataMemo[index - 1]; // Newer message (visually below in inverted list)

    // Check if previous message is from same sender (handles both users and AI friends)
    const isSameUserAsOlder = prevMessage && 
      !('isTyping' in prevMessage) && 
      !('isUserTyping' in prevMessage) && 
      (prevMessage as Message).messageType !== 'system' &&
      (prevMessage as Message).userId !== 'system' &&
      (prevMessage as Message).userId === message.userId && 
      ((prevMessage as Message).userId !== null || (prevMessage as Message).aiFriendId === message.aiFriendId);

    // Check if next message is from same sender
    const isSameUserAsNewer = nextMessage && 
      !('isTyping' in nextMessage) && 
      !('isUserTyping' in nextMessage) && 
      (nextMessage as Message).messageType !== 'system' &&
      (nextMessage as Message).userId !== 'system' &&
      (nextMessage as Message).userId === message.userId && 
      ((nextMessage as Message).userId !== null || (nextMessage as Message).aiFriendId === message.aiFriendId);

    // Show name only if it's the first message in the group (visually top / older)
    const showName = !isSameUserAsOlder;
    // Show avatar only if it's the last message in the group (visually bottom / newer)
    const showAvatar = !isSameUserAsNewer;
    // Determine margin class based on grouping
    const marginBottomClass = isSameUserAsNewer ? 'mb-0.5' : 'mb-3';
    
    // Get AI friend information if this is an AI message
    // Use the aiFriendId to look up from the aiFriends list
    const aiFriend = message.aiFriendId 
      ? aiFriends.find(f => f.id === message.aiFriendId)
      : null;
    // Force brand teal color for AI messages regardless of friend color setting
    const aiColor = "#14B8A6"; 
    const aiName = aiFriend?.name || "AI Friend";
    const isImage = message.messageType === "image";
    const isVoice = message.messageType === "voice";
    const isVideo = message.messageType === "video";
    
    // Check for multi-image message (mediaUrls in metadata)
    const metadata = message.metadata as { 
      mediaUrls?: string[]; 
      videoUrl?: string; 
      videoThumbnailUrl?: string | null; 
      videoDuration?: number;
      slashCommand?: { command: string; prompt?: string };
    } | null;
    const mediaUrls = metadata?.mediaUrls || [];
    const hasMultipleImages = isImage && mediaUrls.length > 1;
    const messageTime = new Date(message.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Debug voice messages
    if (isVoice) {
      console.log("[ChatScreen] Rendering voice message:", {
        id: message.id,
        voiceUrl: message.voiceUrl,
        voiceDuration: message.voiceDuration,
        messageType: message.messageType,
      });
    }

    // Render system messages (like "X joined the chat")
    if (isSystem) {
      // Check if this is an event notification message
      if (message.eventId) {
        const event = events.find((e) => e.id === message.eventId);
        if (event) {
          // HIGH-14: Reduced margin for message density
          return (
            <View
              style={{
                marginVertical: 6,
                paddingHorizontal: 16,
              }}
            >
              <EventNotificationCard
                event={event}
                onPress={() => {
                  // Open events panel
                  setShowEventsTab(true);
                }}
              />
            </View>
          );
        }
      }

      // Check if this is a poll notification message
      if (message.pollId) {
        const poll = polls.find((p) => p.id === message.pollId);
        // Always render PollCard for poll messages - show loading state if poll not yet loaded
        // HIGH-14: Reduced margin for message density
        return (
          <View
            style={{
              marginVertical: 6,
              paddingHorizontal: 16,
            }}
          >
            {poll ? (
              <PollCard
                poll={poll}
                currentUserId={user?.id || ""}
                onVote={(optionId) => {
                  votePoll({ pollId: poll.id, optionId });
                }}
                isVoting={isVotingPoll}
              />
            ) : (
              <View
                style={{
                  backgroundColor: "rgba(48, 209, 88, 0.1)",
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "rgba(48, 209, 88, 0.2)",
                }}
              >
                <ActivityIndicator size="small" color="#30D158" />
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.6)",
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  Loading poll...
                </Text>
              </View>
            )}
          </View>
        );
      }

      // Regular system message - HIGH-14: Reduced margin for message density
      return (
        <View
          style={{
            marginVertical: 6,
            alignItems: "center",
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: "rgba(142, 142, 147, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(142, 142, 147, 0.3)",
            }}
          >
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {message.content}
            </Text>
          </View>
        </View>
      );
    }

    // Render unsent messages - HIGH-14: Reduced margin for message density
    if (message.isUnsent) {
      return (
        <View
          style={{
            marginVertical: 6,
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: isCurrentUser ? "flex-end" : "flex-start",
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(142, 142, 147, 0.15)",
              borderRadius: 16,
              padding: 12,
              maxWidth: "75%",
              borderWidth: 1,
              borderColor: "rgba(142, 142, 147, 0.3)",
            }}
          >
            <Text style={{ fontSize: 15, color: "#8E8E93", fontStyle: "italic" }}>
              You unsent a message
            </Text>
          </View>
        </View>
      );
    }

    // Function to render message bubble content
    const renderMessageContent = () => {
      const isHighlighted = highlightedMessageId === message.id;
      const messageVibe = message.vibeType;
      const vibeConfig = messageVibe ? VIBE_CONFIG[messageVibe] : null;
      
      // Dynamic border radius for grouped messages
      // Inner corners (4px) where messages connect, outer corners (20px) at boundaries
      const borderRadiusStyle = isCurrentUser ? {
        borderTopLeftRadius: 20,
        borderTopRightRadius: isSameUserAsOlder ? 4 : 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: isSameUserAsNewer ? 4 : 20,
      } : {
        borderTopLeftRadius: isSameUserAsOlder ? 4 : 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: isSameUserAsNewer ? 4 : 20,
        borderBottomRightRadius: 20,
      };
      
      // Determine bubble style - vibe takes precedence for styling
      const bubbleStyle = vibeConfig
        ? {
            backgroundColor: `${vibeConfig.color}20`, // 12% opacity
            borderColor: vibeConfig.color,
            shadowColor: vibeConfig.color,
          }
        : isCurrentUser
        ? {
            backgroundColor: "rgba(0, 122, 255, 0.15)",
            borderColor: "#007AFF",
            shadowColor: "#007AFF",
          }
        : isAI
        ? {
            backgroundColor: `${aiColor}26`, // 15% opacity in hex
            borderColor: aiColor, // Use exact AI color (teal) for border
            shadowColor: aiColor,
          }
        : {
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            borderColor: "rgba(255, 255, 255, 0.2)",
            shadowColor: "#000",
          };

      const bubbleContent = (
        <View
          style={{
            ...borderRadiusStyle,
            overflow: "hidden",
            shadowColor: bubbleStyle.shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 4,
            ...(isHighlighted && {
              shadowColor: "#FFD700",
              shadowOpacity: 0.8,
              shadowRadius: 16,
              elevation: 8,
            }),
          }}
        >
          {/* Liquid Glass Background */}
          <BlurView
            intensity={Platform.OS === "ios" ? 40 : 80}
            tint="dark"
            style={{
              ...borderRadiusStyle,
              overflow: "hidden",
              borderWidth: isHighlighted ? 2 : 1,
              borderColor: isHighlighted ? "#FFD700" : bubbleStyle.borderColor,
              backgroundColor: isHighlighted ? "rgba(255, 215, 0, 0.1)" : undefined,
            }}
          >
            <LinearGradient
              colors={
                vibeConfig
                  ? vibeConfig.gradient
                  : isCurrentUser
                  ? [
                      "rgba(0, 122, 255, 0.25)",
                      "rgba(0, 122, 255, 0.15)",
                      "rgba(0, 122, 255, 0.08)",
                    ]
                  : isAI
                  ? [
                      "rgba(20, 184, 166, 0.25)",
                      "rgba(20, 184, 166, 0.15)",
                      "rgba(20, 184, 166, 0.08)",
                    ]
                  : [
                      "rgba(255, 255, 255, 0.15)",
                      "rgba(255, 255, 255, 0.10)",
                      "rgba(255, 255, 255, 0.05)",
                    ]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            >
          {/* Slash Command Badge */}
          {metadata?.slashCommand && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingTop: 8,
              paddingBottom: 4,
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                gap: 4,
              }}>
                <Text style={{
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: '600',
                }}>
                  {metadata.slashCommand.command}
                </Text>
                {metadata.slashCommand.prompt && (
                  <Text 
                    style={{
                      fontSize: 11,
                      color: 'rgba(255, 255, 255, 0.5)',
                      maxWidth: 150,
                    }} 
                    numberOfLines={1} 
                    ellipsizeMode="tail"
                  >
                    {metadata.slashCommand.prompt}
                  </Text>
                )}
              </View>
            </View>
          )}
          {/* Voice Message */}
          {isVoice && message.voiceUrl ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              <VoicePlayer
                voiceUrl={getFullImageUrl(message.voiceUrl)}
                duration={message.voiceDuration || 0}
                isCurrentUser={isCurrentUser}
              />
            </View>
          ) : /* Video Message */ isVideo && metadata?.videoUrl ? (
            <View style={{ width: 270 }}>
              <VideoPlayer
                videoUrl={getFullImageUrl(metadata.videoUrl)}
                thumbnailUrl={metadata.videoThumbnailUrl ? getFullImageUrl(metadata.videoThumbnailUrl) : null}
                duration={metadata.videoDuration}
                containerWidth={270}
                borderRadius={0}
              />
              {/* Caption if exists - HIGH-14: Reduced padding for density */}
              {message.content && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                  <TruncatedText
                    maxLines={20}
                    lineHeight={20}
                    expandButtonColor={isCurrentUser ? "#007AFF" : "#FFFFFF"}
                  >
                    <MessageText
                      content={message.content}
                      mentions={message.mentions}
                      style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 20 }}
                      isOwnMessage={isCurrentUser}
                    />
                  </TruncatedText>
                </View>
              )}
            </View>
          ) : /* Multi-Image Carousel */ hasMultipleImages ? (
            <View style={{ width: 270 }}>
              <MediaCarousel
                imageUrls={mediaUrls.map(url => getFullImageUrl(url))}
                onImagePress={(index, imageUrl) => {
                  setViewerImage({
                    url: imageUrl,
                    imageUrls: mediaUrls.map(url => getFullImageUrl(url)),
                    initialIndex: index,
                    senderName: message.user?.name || "Unknown",
                    timestamp: new Date(message.createdAt).toLocaleString(),
                    messageId: message.id,
                    caption: message.content,
                    isOwnMessage: isCurrentUser,
                  });
                }}
                containerWidth={270}
                borderRadius={0}
              />
              {/* Caption if exists - HIGH-14: Reduced padding for density */}
              {message.content && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                  <TruncatedText
                    maxLines={20}
                    lineHeight={20}
                    expandButtonColor={isCurrentUser ? "#007AFF" : "#FFFFFF"}
                  >
                    <MessageText
                      content={message.content}
                      mentions={message.mentions}
                      style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 20 }}
                      isOwnMessage={isCurrentUser}
                    />
                  </TruncatedText>
                </View>
              )}
            </View>
          ) : /* Single Image Message */ isImage && message.imageUrl ? (
            <View style={{ width: 270 }}>
              <Pressable
                onPress={() => {
                  if (imageSelectionMode) {
                    toggleImageSelection(message.id);
                  } else {
                    setViewerImage({
                      url: message.imageUrl!,
                      senderName: message.user?.name || "Unknown",
                      timestamp: new Date(message.createdAt).toLocaleString(),
                      messageId: message.id,
                      caption: message.content,
                      isOwnMessage: isCurrentUser,
                    });
                  }
                }}
                onLongPress={() => {
                  if (!imageSelectionMode) {
                    enableImageSelectionMode(message.id);
                  }
                }}
              >
                <View style={{ width: 270, height: 288, position: "relative", overflow: "hidden" }}>
                  {/* Placeholder - only show while loading */}
                  {loadingImageIds.has(message.id) && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LuxeLogoLoader size="large" />
                    </View>
                  )}
                  {/* Actual Image */}
                  <Image
                    source={{ uri: (() => {
                      const fullUrl = getFullImageUrl(message.imageUrl);
                      console.log(`[ChatScreen] Loading image for message ${message.id}:`, {
                        relativeUrl: message.imageUrl,
                        fullUrl: fullUrl,
                        backendUrl: BACKEND_URL
                      });
                      return fullUrl;
                    })() }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%"
                    }}
                    resizeMode="cover"
                    onLoadStart={() => {
                      console.log(`[ChatScreen] Image load started for message ${message.id}`);
                      setLoadingImageIds(prev => new Set(prev).add(message.id));
                    }}
                    onLoad={() => {
                      console.log(`[ChatScreen] Image loaded successfully for message ${message.id}`);
                      setLoadingImageIds(prev => {
                        const next = new Set(prev);
                        next.delete(message.id);
                        return next;
                      });
                    }}
                    onError={(error) => {
                      console.error(`[ChatScreen] Image load error for message ${message.id}:`);
                      setLoadingImageIds(prev => {
                        const next = new Set(prev);
                        next.delete(message.id);
                        return next;
                      });
                    }}
                  />

                  {/* Selection checkbox overlay */}
                  {imageSelectionMode && (
                    <View
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: selectedImageMessageIds.has(message.id)
                          ? "#007AFF"
                          : "rgba(0, 0, 0, 0.5)",
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedImageMessageIds.has(message.id) && (
                        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "bold" }}>✓</Text>
                      )}
                    </View>
                  )}

                  {/* Selection overlay tint */}
                  {imageSelectionMode && selectedImageMessageIds.has(message.id) && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 122, 255, 0.3)",
                      }}
                    />
                  )}
                </View>
              </Pressable>
              {/* Caption if exists - HIGH-14: Reduced padding for density */}
              {message.content && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                  <TruncatedText
                    maxLines={20}
                    lineHeight={20}
                    expandButtonColor={isCurrentUser ? "#007AFF" : "#FFFFFF"}
                  >
                    <MessageText
                      content={message.content}
                      mentions={message.mentions}
                      style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 20 }}
                      isOwnMessage={isCurrentUser}
                    />
                  </TruncatedText>
                </View>
              )}
            </View>
          ) : (
            /* Text Message */
            <>
              {/* Only show text content if there's no link preview, or if the text is more than just the URL */}
              {/* HIGH-14: Reduced padding for message density */}
              {(!message.linkPreview || (message.content.trim() !== message.linkPreview.url.trim() && message.content.trim().replace(/https?:\/\//i, '') !== message.linkPreview.url.replace(/https?:\/\//i, ''))) && message.content && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                  {isAI ? (
                    <>
                      {/* Truncate AI messages at 20 lines with show more/less button */}
                      {/* LOW-21: Bypass truncation for crisis/safety messages */}
                      <TruncatedText
                        maxLines={20}
                        lineHeight={20}
                        expandButtonColor="#14B8A6"
                        bypassTruncation={isCrisisMessage(message.content)}
                      >
                        {/* HIGH-14: Adjusted font sizes for density */}
                        <Markdown
                          style={{
                            body: { color: "#FFFFFF", fontSize: 15.5, lineHeight: 20 },
                            heading1: { color: "#FFFFFF", fontSize: 22, fontWeight: "bold", marginBottom: 6 },
                            heading2: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold", marginBottom: 5 },
                            heading3: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
                            heading4: { color: "#FFFFFF", fontSize: 17, fontWeight: "bold", marginBottom: 3 },
                            heading5: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold", marginBottom: 2 },
                            heading6: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "bold", marginBottom: 2 },
                            strong: { fontWeight: "bold", color: "#FFFFFF" },
                            em: { fontStyle: "italic", color: "#FFFFFF" },
                            link: { color: "#14B8A6", textDecorationLine: "underline" },
                            blockquote: {
                              backgroundColor: "rgba(255, 255, 255, 0.1)",
                              borderLeftWidth: 3,
                              borderLeftColor: "#14B8A6",
                              paddingLeft: 10,
                              paddingVertical: 8,
                              marginVertical: 8
                            },
                            code_inline: {
                              backgroundColor: "rgba(255, 255, 255, 0.2)",
                              color: "#14B8A6",
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
                            },
                            code_block: {
                              backgroundColor: "rgba(0, 0, 0, 0.3)",
                              color: "#FFFFFF",
                              padding: 12,
                              borderRadius: 8,
                              marginVertical: 8,
                              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
                            },
                            fence: {
                              backgroundColor: "rgba(0, 0, 0, 0.3)",
                              color: "#FFFFFF",
                              padding: 12,
                              borderRadius: 8,
                              marginVertical: 8,
                              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
                            },
                            bullet_list: { marginVertical: 4 },
                            ordered_list: { marginVertical: 4 },
                            list_item: { color: "#FFFFFF", fontSize: 15.5, marginVertical: 2 },
                            paragraph: { color: "#FFFFFF", fontSize: 15.5, lineHeight: 20, marginVertical: 3 },
                            text: { color: "#FFFFFF", fontSize: 15.5 },
                            hr: { backgroundColor: "rgba(255, 255, 255, 0.2)", height: 1, marginVertical: 10 },
                          }}
                        >
                          {message.content}
                        </Markdown>
                      </TruncatedText>
                      {message.editedAt && (
                        <Text style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", fontStyle: "italic", marginTop: 4 }}>
                          Edited
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Truncate user messages at 20 lines with show more/less button */}
                      <TruncatedText
                        maxLines={20}
                        lineHeight={20}
                        expandButtonColor="#007AFF"
                      >
                        {/* HIGH-14: Reduced font size for message density */}
                        <MessageText
                          content={message.content}
                          mentions={message.mentions}
                          style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 20 }}
                          isOwnMessage={isCurrentUser}
                        />
                      </TruncatedText>
                      {message.editedAt && (
                        <Text style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", fontStyle: "italic", marginTop: 4 }}>
                          Edited
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}
              {/* Link Preview Card */}
              {message.linkPreview && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: message.linkPreview && (!message.content || message.content.trim() === message.linkPreview.url.trim() || message.content.trim().replace(/https?:\/\//i, '') === message.linkPreview.url.replace(/https?:\/\//i, '')) ? 8 : 0 }}>
                  <LinkPreviewCard
                    linkPreview={message.linkPreview}
                    isCurrentUser={isCurrentUser}
                    isAI={isAI}
                  />
                </View>
              )}
            </>
          )}
            </LinearGradient>
          </BlurView>
        </View>
      );

      // Wrap with animated bubble if message has a vibe
      if (messageVibe) {
        return (
          <VibeAnimatedBubble vibeType={messageVibe}>
            {bubbleContent}
          </VibeAnimatedBubble>
        );
      }

      return bubbleContent;
    };

    return (
      <Reanimated.View
        entering={FadeInUp.duration(300)}
        className={`${marginBottomClass} flex-row ${isCurrentUser ? "justify-end" : "justify-start"}`}
        style={{
          paddingHorizontal: 4,
          alignItems: "flex-start",
        }}
      >
        {/* Selection Checkbox */}
        {selectionMode && (
          <Pressable
            onPress={() => toggleMessageSelection(message.id)}
            style={{
              marginRight: 8,
              marginTop: 8,
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: selectedMessageIds.has(message.id) ? "#007AFF" : "#8E8E93",
              backgroundColor: selectedMessageIds.has(message.id) ? "#007AFF" : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selectedMessageIds.has(message.id) && (
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "bold" }}>✓</Text>
            )}
          </Pressable>
        )}

        {/* Profile Photo for others - only show on last message of group */}
        {!isCurrentUser && (
          showAvatar ? (
            <ProfileImage 
              imageUri={isAI ? null : message.user?.image} 
              isAI={isAI} 
              userName={isAI ? aiName : (message.user?.name || "Unknown")} 
            />
          ) : (
            // Placeholder to maintain alignment when avatar is hidden
            <View style={{ width: 32, height: 32, marginRight: 8 }} />
          )
        )}

        {/* Message Content */}
        <View style={{ flex: 1, alignItems: isCurrentUser ? "flex-end" : "flex-start" }}>
          {/* Name - only show on first message of group */}
          {!isCurrentUser && showName && (
            <Text
              className="text-xs font-medium mb-1 ml-2"
              style={{ color: isAI ? aiColor : "#6B7280", fontSize: 13, fontWeight: isAI ? "600" : "500" }}
            >
              {isAI ? aiName : message.user?.name || "Unknown"}
            </Text>
          )}
          {/* Reply Preview - Full Width */}
          {message.replyTo && (() => {
            const replyToMessage = message.replyTo;
            const replyTapGesture = Gesture.Tap()
              .onEnd(() => {
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
                runOnJS(setReplyPreviewModal)({ original: replyToMessage, reply: message });
              });

            return (
              <GestureDetector gesture={replyTapGesture}>
                <Reanimated.View
                  style={{
                    marginLeft: isCurrentUser ? 0 : 4,
                    marginRight: isCurrentUser ? 4 : 0,
                    marginBottom: 4,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderLeftWidth: 3,
                    borderLeftColor: isCurrentUser ? "#007AFF" : "#8E8E93",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    maxWidth: "100%",
                    alignSelf: isCurrentUser ? "flex-end" : "flex-start",
                  }}
                >
                  <Text style={{ fontSize: 12, color: isCurrentUser ? "#60A5FA" : "#9CA3AF", fontWeight: "600" }} numberOfLines={1}>
                    {replyToMessage?.aiFriendId
                      ? (replyToMessage?.aiFriend?.name || aiFriends.find(f => f.id === replyToMessage?.aiFriendId)?.name || "AI Friend")
                      : (replyToMessage?.user?.name || "Unknown User")}
                  </Text>
                  
                  {replyToMessage?.messageType === "image" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      {replyToMessage?.imageUrl && (
                        <Image
                          source={{ uri: getFullImageUrl(replyToMessage.imageUrl) }}
                          style={{ width: 36, height: 36, borderRadius: 6, marginRight: 6 }}
                          contentFit="cover"
                        />
                      )}
                      <Text style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)" }}>Photo</Text>
                    </View>
                  ) : (
                    <Text
                      style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)", flex: 1 }}
                      numberOfLines={1}
                    >
                      {replyToMessage?.content}
                    </Text>
                  )}
                </Reanimated.View>
              </GestureDetector>
            );
          })()}
          {/* Message Bubble with Long Press or Selection */}
          <View style={{ maxWidth: "85%", alignSelf: isCurrentUser ? "flex-end" : "flex-start" }}>
          <SwipeableMessage
            timestamp={messageTime}
            isCurrentUser={isCurrentUser}
          >
            <View>
              <Pressable
                onLongPress={() => !selectionMode && handleLongPress(message)}
                onPress={() => selectionMode && toggleMessageSelection(message.id)}
              >
                {renderMessageContent()}
              </Pressable>
              {/* Reactions */}
              {message.reactions && message.reactions.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    marginTop: -10, // Slight overlap with message bubble
                    gap: 4,
                    marginLeft: isCurrentUser ? 0 : 12, // Indent slightly from left for others
                    marginRight: isCurrentUser ? 12 : 0, // Indent slightly from right for me
                    justifyContent: isCurrentUser ? "flex-end" : "flex-start",
                    zIndex: 10, // Ensure it sits on top of the bubble
                  }}
                >
                  {Object.entries(
                    message.reactions.reduce((acc, reaction) => {
                      if (!acc[reaction.emoji]) {
                        acc[reaction.emoji] = {
                          count: 0,
                          userReacted: false,
                        };
                      }
                      acc[reaction.emoji].count++;
                      if (reaction.userId === user?.id) {
                        acc[reaction.emoji].userReacted = true;
                      }
                      return acc;
                    }, {} as Record<string, { count: number; userReacted: boolean }>)
                  ).map(([emoji, { count, userReacted }]) => {
                    const reactionsForEmoji = message.reactions!.filter(r => r.emoji === emoji);
                    return (
                      <Pressable
                        key={emoji}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleSelectEmoji(emoji, message);
                        }}
                        onLongPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setReactionDetailsModal({ emoji, reactions: reactionsForEmoji });
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: "rgba(40, 40, 40, 1)",
                          borderWidth: 1,
                          borderColor: userReacted ? "#007AFF" : "rgba(255, 255, 255, 0.2)",
                          marginRight: 6,
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ fontSize: 15 }}>{emoji}</Text>
                        {count > 1 && (
                          <Text
                            style={{
                              fontSize: 13,
                              color: userReacted ? "#007AFF" : "#FFFFFF",
                              fontWeight: "600",
                              marginLeft: 6,
                            }}
                          >
                            {count}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </SwipeableMessage>
        </View>
      </View>
      </Reanimated.View>
    );
  }, [
    // Core dependencies for message rendering
    user?.id, typingAIFriend, aiFriends, chat, events, polls, threads,
    // UI state dependencies
    highlightedMessageId, contextMenuMessage, reactionPickerMessage,
    selectionMode, selectedMessageIds, imageSelectionMode, selectedImageMessageIds,
    loadingImageIds, viewerImage,
    // Handlers
    handleLongPress, handleReply, handleCopy, handleReact, enableSelectionMode,
    toggleMessageSelection, cancelSelectionMode, enableImageSelectionMode, toggleImageSelection,
    votePoll, isVotingPoll, bookmarkedMessageIds, canDeleteMessage,
    setShowEventsTab, setContextMenuMessage, setReactionPickerMessage, setViewerImage,
    toggleBookmark,
    // LOW-21: Crisis message detection
    isCrisisMessage,
    // Message grouping data
    displayDataMemo,
  ]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", justifyContent: "center", alignItems: "center" }}>
        <LuxeLogoLoader size="large" />
      </View>
    );
  }

  // Debug logging
  console.log('[ChatScreen] Thread filtering:', {
    currentThreadId,
    hasThreadId: !!currentThreadId,
    threadMessagesIsDefined: threadMessages !== undefined,
    threadMessages: threadMessages,
    threadMessagesCount: threadMessages?.length || 0,
    allMessagesCount: messages?.length || 0,
    activeMessagesCount: activeMessages?.length || 0,
    isUsingFilteredMessages: currentThreadId && threadMessages !== undefined,
    willShowEmptyIfNoMatches: currentThreadId && threadMessages !== undefined && threadMessages.length === 0
  });
  
  // Check if smart replies are visible (for dynamic bottom padding)
  const areSmartRepliesVisible = smartReplies.length > 0 && !messageText && selectedImages.length === 0 && !replyToMessage;
  
  // Get current thread info for display
  const currentThread = threads?.find(t => t.id === currentThreadId);

  const handleShareInvite = async () => {
    if (!chat?.inviteToken) {
      Alert.alert("Error", "Invite link not available");
      return;
    }

    try {
      await Share.share({
        message: `Join our chat "${chat.name}" on VibeChat!\n\nInvite Code: ${chat.inviteToken}`,
      });
    } catch (error) {
      console.error("Error sharing invite:", error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Animated Gradient Background */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <LinearGradient
          colors={[
            "#000000",
            "#0A0A0F",
            "#050508",
            "#000000",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        {/* Subtle animated overlay for depth */}
        <LinearGradient
          colors={[
            "rgba(79, 195, 247, 0.03)",
            "rgba(0, 122, 255, 0.02)",
            "transparent",
            "rgba(52, 199, 89, 0.02)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </View>
      
      {/* Custom Chat Header */}
      <ChatHeader
        chatName={chat?.name || chatName}
        chatImage={chat?.image || null}
        onAvatarPress={() => setShowAvatarViewer(true)}
        onSettingsPress={() => navigation.navigate("GroupSettings", { chatId })}
        onSearchPress={() => setShowSearchModal(true)}
        onBookmarksPress={() => setShowBookmarksModal(true)}
        onThreadsPress={() => setShowThreadsPanel(true)}
        onEventsPress={() => setShowEventsTab(true)}
        onInvitePress={handleShareInvite}
      />

      {/* Smart Threads Tabs - Always show to display Main Chat pill and + button */}
      {threads && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 85, // Reduced from 95
            left: 0,
            right: 0,
            zIndex: 99,
          }}
        >
          <DraggableThreadList
            threads={threads}
            currentThreadId={currentThreadId}
            onSelectThread={setCurrentThreadId}
            onReorder={reorderThreads}
            onOpenPanel={() => setShowThreadsPanel(true)}
            onCreateThread={() => setShowCreateThread(true)}
          />
        </View>
      )}

      {/* Messages FlatList - Wrapped in Reanimated View for keyboard animation */}
      <Reanimated.View 
        key={currentThreadId || 'main'}
        entering={FadeIn.duration(200)}
        style={[{ flex: 1 }, chatListContainerAnimatedStyle]}
      >
        <AnimatedFlashList
          ref={flatListRef}
          data={displayDataMemo}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          renderItem={renderMessage as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          keyExtractor={((item: { id: string }) => item.id) as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getItemType={getItemType as any}
          estimatedItemSize={120}
          // HIGH-B: Performance optimization - drawDistance for smoother scrolling
          drawDistance={500}
          inverted={true}
          // HIGH-4: Track scroll position to disable auto-scroll when reading history
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            // Inverted: Padding Bottom is visually at Top, Padding Top is visually at Bottom
            // Padding bottom creates space for header/threads
            paddingBottom: insets.top + 68 + (threads ? 56 : 0) + 20, // Reduced base to 63 (header height is 68)
            paddingHorizontal: 16,
            // Visual bottom - small padding to push recent messages up slightly
            paddingTop: 13, 
          }}
          // Spacer for Input Bar (Glassmorphism effect)
          // Dynamic height: 95px default, 120px when smart replies are showing
          ListHeaderComponent={<View style={{ height: areSmartRepliesVisible ? 120 : 95 }} />}
          // HIGH-8: Load earlier messages button (appears at top in inverted list)
          ListFooterComponent={
            hasMoreMessages ? (
              <TouchableOpacity
                onPress={loadMoreMessages}
                disabled={isLoadingMore}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.6)" />
                ) : (
                  <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 14 }}>
                    Load earlier messages
                  </Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="interactive"
          {...{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onScrollToIndexFailed: (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
              console.log('[ScrollToIndex] Failed at index', info.index, 'average item length:', info.averageItemLength);
              // Wait for list to settle and render more items, then retry
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                } catch (error) {
                  console.log('[ScrollToIndex] Retry failed, using offset fallback');
                  // Use the average item length from the failure info for better estimate
                  const offset = info.index * (info.averageItemLength || 100);
                  flatListRef.current?.scrollToOffset({
                    offset: offset,
                    animated: true,
                  });
                }
              }, 100);
            }
          } as any}
          ListEmptyComponent={
            <View 
              className="flex-1 items-center justify-center px-8" 
              style={{ 
                paddingVertical: 60,
                transform: [{ scaleY: -1 }] // Flip to counteract inverted list
              }}
            >
              {isLoading ? (
                /* Show loading animation while fetching messages */
                <LuxeLogoLoader size="large" />
              ) : (
                /* Show empty state only after loading is complete */
                <>
                  {/* Premium Empty State Card */}
                  <View style={{ 
                    width: '100%', 
                    maxWidth: 300,
                    borderRadius: 20,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                  }}>
                    <BlurView intensity={35} tint="dark" style={{ overflow: 'hidden', borderRadius: 20 }}>
                      <LinearGradient
                        colors={[
                          'rgba(255, 255, 255, 0.04)',
                          'rgba(255, 255, 255, 0.02)',
                          'rgba(0, 0, 0, 0.02)',
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          padding: 28,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: 20,
                        }}
                      >
                        {/* Logo Icon Container */}
                        <View style={{
                          alignSelf: 'center',
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          marginBottom: 20,
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          shadowColor: '#4FC3F7',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.2,
                          shadowRadius: 10,
                          elevation: 3,
                        }}>
                          <RNImage
                            source={require("../../assets/vibechat icon main.png")}
                            style={{ width: 80, height: 80 }}
                            resizeMode="cover"
                          />
                        </View>

                        {/* Heading */}
                        <Text style={{
                          fontSize: 20,
                          fontWeight: '700',
                          color: '#FFFFFF',
                          textAlign: 'center',
                          marginBottom: 6,
                          letterSpacing: -0.4,
                        }}>
                          No messages yet
                        </Text>

                        {/* Subheading */}
                        <Text style={{
                          fontSize: 14,
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.65)',
                          textAlign: 'center',
                          lineHeight: 20,
                          marginBottom: 22,
                        }}>
                          Be the first to say hi, or create{'\n'}an AI friend to start chatting
                        </Text>

                        {/* CTA Button */}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setShowCreateAIFriend(true);
                          }}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.88 : 1,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                          })}
                        >
                          <View style={{
                            borderRadius: 14,
                            overflow: 'hidden',
                            shadowColor: '#34C759',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                            elevation: 4,
                          }}>
                            <LinearGradient
                              colors={[
                                '#0061FF', // Deep Blue
                                '#00C6FF', // Bright Cyan
                                '#00E676', // Neon Green
                              ]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                paddingVertical: 13,
                                paddingHorizontal: 20,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Sparkles size={17} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                              <Text style={{
                                fontSize: 15,
                                fontWeight: '700',
                                color: '#FFFFFF',
                                letterSpacing: 0.2,
                              }}>
                                Create AI Friend
                              </Text>
                            </LinearGradient>
                          </View>
                        </Pressable>

                        {/* Helper Text */}
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.45)',
                          textAlign: 'center',
                          marginTop: 16,
                          lineHeight: 17,
                        }}>
                          Always ready to chat and help
                        </Text>
                      </LinearGradient>
                    </BlurView>
                  </View>
                </>
              )}
            </View>
          }
        />
      </Reanimated.View>

      {/* Reply Preview Modal - Rendered before Input to sit underneath it */}
      
      {/* Input Bar Area - Fixed at Bottom */}
      <Reanimated.View style={[{ width: "100%", backgroundColor: 'transparent' }, inputWrapperAnimatedStyle]}>
        {/* Glassmorphism Background */}
        <BlurView
          intensity={Platform.OS === "ios" ? 70 : 100}
          tint="dark"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderTopWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
        />
        
        {/* LOW-A: Drag handle removed per design request */}
        
        {/* Mention Picker - positioned above input */}
        {(() => {
          console.log('[ChatScreen] Rendering MentionPicker check:', {
            showMentionPicker,
            chatMembersCount: chatMembers.length,
            mentionSearch,
            activeInput: activeInput, // Check state value
            editingMessage: !!editingMessage,
          });
          return showMentionPicker && activeInput === "main";
        })() && (
          <View
            style={{
              width: "100%",
              maxHeight: 250,
              marginBottom: 8,
              pointerEvents: "auto",
              zIndex: 1000,
            }}
          >
            <MentionPicker
              visible={showMentionPicker}
              users={chatMembers.filter((member) => member.id !== user?.id)}
              threads={threads || []}
              aiFriends={aiFriends}
              onSelectUser={handleSelectMention}
              onSelectThread={handleSelectThread}
              onSelectAI={handleSelectAI}
              searchQuery={mentionSearch}
            />
          </View>
        )}

        <Reanimated.ScrollView
          style={{ width: "100%", backgroundColor: 'transparent' }}
          contentContainerStyle={[
            {
              paddingTop: 6,
              paddingHorizontal: 16,
            },
            inputContainerAnimatedStyle,
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          scrollEnabled={false}
        >
            
            {/* Smart Replies */}
            {smartReplies.length > 0 && !messageText && selectedImages.length === 0 && !replyToMessage && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
                keyboardShouldPersistTaps="always"
              >
                {smartReplies.map((reply, index) => (
                  <Pressable
                    key={index}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMessageText(reply);
                      textInputRef.current?.focus();
                    }}
                    style={{
                      borderRadius: 20,
                      overflow: "hidden",
                      marginHorizontal: 4,
                    }}
                  >
                    <BlurView
                      intensity={30}
                      tint="dark"
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: "rgba(0, 122, 255, 0.3)",
                        borderRadius: 20,
                      }}
                    >
                      <LinearGradient
                        colors={["rgba(0, 122, 255, 0.15)", "rgba(0, 122, 255, 0.05)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                        }}
                      />
                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>
                        {reply}
                      </Text>
                    </BlurView>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {/* Reply Banner */}
            {replyToMessage && (
              <View
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderLeftWidth: 3,
                  borderLeftColor: "#007AFF",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#007AFF", fontWeight: "600" }}>
                    Replying to {replyToMessage.aiFriendId 
                      ? (replyToMessage.aiFriend?.name || aiFriends.find(f => f.id === replyToMessage.aiFriendId)?.name || "AI Friend")
                      : (replyToMessage.user?.name || "Unknown User")}
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: "#FFFFFF", marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {replyToMessage.messageType === "image"
                      ? "📷 Image"
                      : replyToMessage.content}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setReplyToMessage(null);
                    textInputRef.current?.focus();
                  }}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
            {/* Input Link Preview */}
            {(inputLinkPreview || isFetchingLinkPreview) && (
              <View
                style={{
                  marginBottom: 12,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(0, 122, 255, 0.3)",
                }}
              >
                {isFetchingLinkPreview && !inputLinkPreview ? (
                  <View
                    style={{
                      padding: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={{ color: "#8E8E93", fontSize: 14 }}>
                      Fetching link preview...
                    </Text>
                  </View>
                ) : inputLinkPreview ? (
                  <View style={{ position: "relative" }}>
                    <LinkPreviewCard
                      linkPreview={inputLinkPreview}
                      isCurrentUser={true}
                      isAI={false}
                    />
                    {/* Dismiss button */}
                    <Pressable
                      onPress={() => {
                        setInputLinkPreview(null);
                        setInputPreviewUrl(null);
                        textInputRef.current?.focus();
                      }}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
            {/* Image Preview */}
            {selectedImages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
                contentContainerStyle={{ gap: 8 }}
                keyboardShouldPersistTaps="always"
              >
                {selectedImages.map((imageUri, index) => (
                  <View
                    key={index}
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      width: 90,
                    }}
                  >
                    <View style={{ position: "relative" }}>
                      <Image
                        source={{ uri: imageUri }}
                        style={{ width: 90, height: 120 }}
                        resizeMode="cover"
                      />
                      {/* Image number badge (only show if multiple images) */}
                      {selectedImages.length > 1 && (
                        <View
                          style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: "rgba(0, 122, 255, 0.9)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                            {index + 1}
                          </Text>
                        </View>
                      )}
                      {/* Remove button */}
                      <Pressable
                        onPress={() => {
                          const newImages = [...selectedImages];
                          newImages.splice(index, 1);
                          setSelectedImages(newImages);
                          textInputRef.current?.focus();
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "rgba(0, 0, 0, 0.7)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={16} color="#FFFFFF" />
                      </Pressable>
                      {/* Uploading overlay */}
                      {isUploadingImage && (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.7)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <LuxeLogoLoader size="small" />
                          <Text style={{ color: "#FFFFFF", marginTop: 4, fontSize: 10 }}>
                            Uploading...
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            {/* Video Preview */}
            {selectedVideo && (
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 69, 58, 0.4)",
                    width: 120,
                  }}
                >
                  <View style={{ position: "relative", width: 120, height: 160, backgroundColor: "#1C1C1E" }}>
                    {/* Video icon overlay */}
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "rgba(255, 69, 58, 0.9)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 18 }}>▶</Text>
                      </View>
                    </View>
                    {/* Duration badge */}
                    {selectedVideo.duration && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: 4,
                          right: 4,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: "rgba(0, 0, 0, 0.7)",
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "600" }}>
                          {Math.floor(selectedVideo.duration / 60)}:{(selectedVideo.duration % 60).toString().padStart(2, "0")}
                        </Text>
                      </View>
                    )}
                    {/* Remove button */}
                    <Pressable
                      onPress={() => {
                        setSelectedVideo(null);
                        textInputRef.current?.focus();
                      }}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={16} color="#FFFFFF" />
                    </Pressable>
                    {/* Uploading overlay */}
                    {isUploadingVideo && (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.7)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <LuxeLogoLoader size="small" />
                        <Text style={{ color: "#FFFFFF", marginTop: 4, fontSize: 10 }}>
                          Uploading...
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
            {/* Voice Recorder Mode */}
            {isRecordingVoice ? (
              <VoiceRecorder
                onSend={handleVoiceSend}
                onCancel={() => setIsRecordingVoice(false)}
              />
            ) : (
              <Reanimated.View className="flex-row items-end gap-3" style={inputRowAnimatedStyle}>
              {/* Attachments menu button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAttachmentsMenu(true);
                }}
                disabled={isUploadingImage}
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
                    tint="dark"
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1.5,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      borderRadius: 19,
                      overflow: "hidden",
                    }}
                  >
                    <LinearGradient
                      colors={[
                        "rgba(255, 255, 255, 0.12)",
                        "rgba(255, 255, 255, 0.08)",
                        "rgba(255, 255, 255, 0.04)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 19,
                      }}
                      pointerEvents="none"
                    />
                    <Plus size={20} color="#FFFFFF" />
                  </BlurView>
                </View>
              </Pressable>
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
                      backgroundColor: "#1C1C1E", // Solid dark background
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
                      {/* Default state gradient (white) */}
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
                          colors={[
                            "rgba(255, 255, 255, 0.12)",
                            "rgba(255, 255, 255, 0.08)",
                            "rgba(255, 255, 255, 0.04)",
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
                    value={messageText}
                    onChangeText={handleTyping}
                    placeholder={selectedImages.length > 0 || selectedVideo ? "Add a caption (optional)" : "Message"}
                    placeholderTextColor="#666666"
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
                    // HIGH-11: Increased character limit with UI feedback
                    maxLength={4000}
                    onSubmitEditing={() => handleSend()}
                    blurOnSubmit={false}
                    keyboardType="default"
                    keyboardAppearance="dark"
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
                  {/* HIGH-11: Character count indicator - shows when approaching limit */}
                  {messageText.length > 3000 && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 8,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 8,
                        backgroundColor: messageText.length > 3800 
                          ? "rgba(255, 59, 48, 0.2)" 
                          : "rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: messageText.length > 3800 
                            ? "#FF3B30" 
                            : "rgba(255, 255, 255, 0.5)",
                          fontWeight: "500",
                        }}
                      >
                        {messageText.length}/4000
                      </Text>
                    </View>
                  )}
                    </Animated.View>
                  </View>
                  </Animated.View>
                {/* Animated Mic/Send button with Vibe long-press */}
                <View 
                  ref={sendButtonRef} 
                  collapsable={false}
                  onTouchMove={handleSendButtonTouchMove}
                  onTouchEnd={handleSendButtonTouchEnd}
                >
                <Pressable
                  onPress={(!messageText.trim() && selectedImages.length === 0 && !selectedVideo) 
                    ? () => setIsRecordingVoice(true)
                    : (showVibeSelector ? undefined : () => handleSend())
                  }
                  onPressIn={handleSendButtonPressIn}
                  onPressOut={handleSendButtonPressOut}
                  disabled={
                    (!messageText.trim() && selectedImages.length === 0 && !selectedVideo) 
                      ? isUploadingVoice 
                      : ((!messageText.trim() && selectedImages.length === 0 && !selectedVideo) || sendMessageMutation.isPending || isUploadingImage || isUploadingVideo)
                  }
                  delayLongPress={300}
                >
                  <Animated.View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      overflow: "hidden",
                      shadowColor: (selectedVibe || previewVibe)
                        ? VIBE_CONFIG[selectedVibe || previewVibe!].color
                        : messageText.toLowerCase().includes("@ai")
                        ? "#14B8A6"
                        : messageText.trim() || selectedImages.length > 0 || selectedVideo
                        ? "#007AFF"
                        : "#007AFF",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: animatedShadowOpacity,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                    pointerEvents="box-only"
                  >
                    <BlurView
                      intensity={Platform.OS === "ios" ? 50 : 80}
                      tint="dark"
                      style={{
                        flex: 1,
                        borderRadius: 19,
                      }}
                    >
                      <Animated.View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1.5,
                          borderColor: animatedBorderColor,
                          borderRadius: 19,
                        }}
                      >
                        {/* Layered animated gradient backgrounds for send button */}
                        {/* Default state gradient (white/gray) */}
                        <Animated.View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: gradientDefaultOpacity,
                          }}
                          pointerEvents="none"
                        >
                          <LinearGradient
                            colors={[
                              "rgba(255, 255, 255, 0.08)",
                              "rgba(255, 255, 255, 0.05)",
                              "rgba(255, 255, 255, 0.02)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1 }}
                          />
                        </Animated.View>
                        
                        {/* Has content state gradient (blue) */}
                        <Animated.View
                          style={{
                            position: "absolute",
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
                              "rgba(0, 122, 255, 0.30)",
                              "rgba(0, 122, 255, 0.20)",
                              "rgba(0, 122, 255, 0.10)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1 }}
                          />
                        </Animated.View>
                        
                        {/* AI message state gradient (green) */}
                        <Animated.View
                          style={{
                            position: "absolute",
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
                              "rgba(20, 184, 166, 0.30)",
                              "rgba(20, 184, 166, 0.20)",
                              "rgba(20, 184, 166, 0.10)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1 }}
                          />
                        </Animated.View>
                        
                        {/* Always show animated icons, no loading spinner */}
                        {(!messageText.trim() && selectedImages.length === 0 && !selectedVideo) ? (
                          <Animated.View
                            style={{
                              transform: [
                                { rotate: micRotateInterpolate },
                                { scale: buttonIconScale },
                              ],
                            }}
                          >
                            <Mic size={20} color="#FFFFFF" />
                          </Animated.View>
                        ) : (
                          <Animated.View
                            style={{
                              transform: [
                                { rotate: arrowRotateInterpolate },
                                { scale: buttonIconScale },
                              ],
                            }}
                          >
                            <ArrowUp size={20} color="#FFFFFF" strokeWidth={2.5} />
                          </Animated.View>
                        )}
                        
                        {/* Vibe indicator dot when vibe is selected */}
                        {(selectedVibe || previewVibe) && (
                          <View
                            style={{
                              position: "absolute",
                              top: 1,
                              right: 1,
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: VIBE_CONFIG[selectedVibe || previewVibe!].color,
                              borderWidth: 1,
                              borderColor: "rgba(0, 0, 0, 0.3)",
                            }}
                          />
                        )}
                      </Animated.View>
                    </BlurView>
                  </Animated.View>
                </Pressable>
                </View>
              </Reanimated.View>
            )}
          </Reanimated.ScrollView>
      </Reanimated.View>

      {/* Image Viewer Modal */}
        {viewerImage && (
          <ZoomableImageViewer
            visible={!!viewerImage}
            imageUrl={getFullImageUrl(viewerImage.url)}
            imageUrls={viewerImage.imageUrls}
            initialIndex={viewerImage.initialIndex}
            senderName={viewerImage.senderName}
            timestamp={viewerImage.timestamp}
            messageId={viewerImage.messageId}
            caption={viewerImage.caption}
            isOwnMessage={viewerImage.isOwnMessage}
            onSelectImage={enableImageSelectionMode}
            onEditCaption={handleEdit}
            onClose={() => setViewerImage(null)}
          />
        )}

        {/* Context Menu Modal */}
        <MessageContextMenu
          visible={!!contextMenuMessage}
          message={contextMenuMessage}
          onClose={() => setContextMenuMessage(null)}
          onReply={handleReply}
          onCopy={handleCopy}
          onEdit={handleEdit}
          onUnsend={handleUnsend}
          onDelete={handleDelete}
          onSelect={(msg) => enableSelectionMode(msg.id)}
          onSelectEmoji={handleSelectEmoji}
          onBookmark={(msg) => toggleBookmark(msg.id)}
          onReactor={(msg) => {
            setReactorMessageId(msg.id);
            setShowReactorMenu(true);
          }}
          isBookmarked={contextMenuMessage ? bookmarkedMessageIds.has(contextMenuMessage.id) : false}
          canEdit={contextMenuMessage ? canEditMessage(contextMenuMessage) : false}
          canUnsend={contextMenuMessage ? canUnsendMessage(contextMenuMessage) : false}
          canDelete={contextMenuMessage ? canDeleteMessage(contextMenuMessage) : false}
        />

        {/* Reaction Picker Modal */}
        <ReactionPickerModal
          visible={!!reactionPickerMessage}
          message={reactionPickerMessage}
          onClose={() => setReactionPickerMessage(null)}
          onSelectEmoji={handleSelectEmoji}
        />

        {/* Reaction Details Modal */}
        {reactionDetailsModal && (
          <ReactionDetailsModal
            visible={!!reactionDetailsModal}
            emoji={reactionDetailsModal.emoji}
            reactions={reactionDetailsModal.reactions}
            onClose={() => setReactionDetailsModal(null)}
          />
        )}

        {/* Edit Message Modal */}
        <Modal visible={!!editingMessage} transparent animationType="slide" onRequestClose={() => setEditingMessage(null)}>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1 }}
          >
            <Pressable
              onPress={() => setEditingMessage(null)}
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                justifyContent: "flex-end",
              }}
            >
              <Animated.View
                style={{
                  backgroundColor: "#1C1C1E",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  maxHeight: "90%",
                  transform: [{ translateY: editModalDragY }],
                }}
                onStartShouldSetResponder={() => true}
              >
                {/* Handle Bar for swipe down */}
                <View
                  {...editModalPanResponder.panHandlers}
                  style={{
                    alignItems: "center",
                    paddingTop: 14,
                    paddingBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 5,
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                      borderRadius: 2.5,
                    }}
                  />
                </View>

                <View style={{ padding: 20, paddingTop: 8, paddingBottom: insets.bottom + 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>Edit Message</Text>
                    <Pressable onPress={() => setEditingMessage(null)}>
                      <X size={24} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  {/* Mention Picker for Edit Mode */}
                  {showMentionPicker && activeInput === "edit" && (
                    <View
                      style={{
                        marginBottom: 12,
                        maxHeight: 250,
                        zIndex: 10000,
                      }}
                    >
                      <MentionPicker
                        visible={showMentionPicker}
                        users={chatMembers.filter((member) => member.id !== user?.id)}
                        threads={threads || []}
                        aiFriends={aiFriends}
                        onSelectUser={handleSelectMention}
                        onSelectThread={handleSelectThread}
                        onSelectAI={handleSelectAI}
                        searchQuery={mentionSearch}
                      />
                    </View>
                  )}

                <TextInput
                  value={editText}
                  onChangeText={handleEditTyping}
                  multiline
                  autoFocus
                  keyboardAppearance="dark"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: 16,
                    color: "#FFFFFF",
                    fontSize: 16,
                    minHeight: 100,
                    maxHeight: 200,
                    marginBottom: 16,
                  }}
                  placeholder="Edit your message..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    onPress={() => setEditingMessage(null)}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (editingMessage && editText.trim()) {
                        editMessageMutation.mutate({
                          messageId: editingMessage.id,
                          content: editText.trim(),
                        });
                      }
                    }}
                    disabled={!editText.trim() || editMessageMutation.isPending}
                    style={{
                      flex: 1,
                      backgroundColor: editText.trim() ? "#007AFF" : "rgba(0, 122, 255, 0.3)",
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "center",
                    }}
                  >
                    {editMessageMutation.isPending ? (
                      <LuxeLogoLoader size={20} />
                    ) : (
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Save</Text>
                    )}
                  </Pressable>
                </View>
                </View>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Avatar Viewer Modal */}
        {chat?.image && (
          <Modal
            visible={showAvatarViewer}
            transparent
            animationType="fade"
            onRequestClose={() => setShowAvatarViewer(false)}
          >
            <Pressable
              onPress={() => setShowAvatarViewer(false)}
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.95)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* Close button */}
              <Pressable
                onPress={() => setShowAvatarViewer(false)}
                style={{
                  position: "absolute",
                  top: 50,
                  right: 20,
                  zIndex: 10,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>

              {/* Full-screen avatar image */}
              <Image
                source={{ uri: getFullImageUrl(chat.image) }}
                style={{
                  width: "90%",
                  height: "90%",
                  maxWidth: 500,
                  maxHeight: 500,
                }}
                resizeMode="contain"
              />

              {/* Group name at bottom */}
              <View
                style={{
                  position: "absolute",
                  bottom: 60,
                  alignItems: "center",
                  padding: 16,
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  {chat?.name || "Vibecode Chat"}
                </Text>
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Selection Mode Toolbar */}
        {selectionMode && (
          <MessageSelectionToolbar
            selectedCount={selectedMessageIds.size}
            onDelete={handleBatchDelete}
            onCancel={cancelSelectionMode}
          />
        )}

        {/* Image Selection Mode Toolbar */}
        {imageSelectionMode && (
          <ImageSelectionToolbar
            selectedCount={selectedImageMessageIds.size}
            onSave={handleSaveSelectedImages}
            onShare={handleShareSelectedImages}
            onAIReactor={() => {
              if (selectedImageMessageIds.size === 1) {
                const messageId = selectedImageMessageIds.values().next().value;
                setReactorMessageId(messageId ?? null);
                setShowReactorMenu(true);
                cancelImageSelectionMode();
              }
            }}
            onDelete={handleDeleteSelectedImages}
            onCancel={cancelImageSelectionMode}
          />
        )}

        {/* Attachments Menu */}
        <AttachmentsMenu
          visible={showAttachmentsMenu}
          onClose={() => setShowAttachmentsMenu(false)}
          onTakePhoto={takePhoto}
          onPickImage={pickImage}
          onPickVideo={pickVideo}
          onSelectCommand={(command) => {
            // Insert the command into the message input
            setMessageText(command + " ");
          }}
          onCreateCommand={() => {
            setShowAttachmentsMenu(false);
            setTimeout(() => setShowCreateCustomCommand(true), 300);
          }}
          onOpenSettings={() => {
            navigation.navigate("GroupSettings", { chatId });
          }}
          onCreatePoll={() => {
            setShowAttachmentsMenu(false);
            setTimeout(() => setShowCreatePoll(true), 300);
          }}
          customCommands={customCommands}
        />

        {/* Search Modal */}
        <Modal
          visible={showSearchModal}
          transparent={false}
          animationType="slide"
          onRequestClose={() => {
            setShowSearchModal(false);
            setSearchQuery("");
          }}
        >
          <Animated.View
            style={{
              flex: 1,
              transform: [{ translateY: searchModalDragY }],
            }}
            {...searchModalPanResponder.panHandlers}
          >
            <LinearGradient
              colors={["#0A0A0A", "#1A1A2E", "#16213E"]}
              style={{ flex: 1 }}
            >
              <View style={{ paddingTop: insets.top + 10, paddingBottom: 16, paddingHorizontal: 20 }}>
                <View style={{ borderRadius: 16, overflow: "hidden" }}>
                  <BlurView intensity={30} tint="dark" style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                    <LinearGradient
                      colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Search size={24} color="#FFFFFF" />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search messages..."
                        placeholderTextColor="#666"
                        style={{ flex: 1, color: "#FFFFFF", fontSize: 17 }}
                        autoFocus
                        keyboardAppearance="dark"
                      />
                      <Pressable onPress={() => { setShowSearchModal(false); setSearchQuery(""); }}>
                        <X size={20} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </BlurView>
                </View>
              </View>

            <FlashList
              data={searchResults}
              keyExtractor={(item) => item.id}
              estimatedItemSize={100}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
                  <Search size={64} color="#666" />
                  <Text style={{ color: "#8E8E93", fontSize: 17, fontWeight: "600", marginTop: 16 }}>
                    {searchQuery ? "No results found" : "Start typing to search"}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    scrollToMessage(item.id);
                  }}
                  style={{ marginBottom: 12 }}
                >
                  <View
                    style={{
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      padding: 16,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <Text style={{ color: "#007AFF", fontSize: 14, fontWeight: "600" }}>
                        {item.user.name}
                      </Text>
                      <Text style={{ color: "#666", fontSize: 12, marginLeft: 12 }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 20 }}>
                      {item.content}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
            </LinearGradient>
          </Animated.View>
        </Modal>

        {/* Bookmarks Modal */}
        <Modal
          visible={showBookmarksModal}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowBookmarksModal(false)}
        >
          <Animated.View
            style={{
              flex: 1,
              transform: [{ translateY: bookmarksModalDragY }],
            }}
            {...bookmarksModalPanResponder.panHandlers}
          >
            <LinearGradient colors={["#0A0A0A", "#1A1A2E", "#16213E"]} style={{ flex: 1 }}>
              <View style={{ paddingTop: insets.top + 10, paddingBottom: 16, paddingHorizontal: 20 }}>
                <View style={{ borderRadius: 16, overflow: "hidden" }}>
                  <BlurView intensity={30} tint="dark" style={{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <LinearGradient
                      colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Bookmark size={24} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>Bookmarks</Text>
                    </View>
                    <Pressable onPress={() => setShowBookmarksModal(false)}>
                      <X size={20} color="#FFFFFF" />
                    </Pressable>
                  </BlurView>
                </View>
              </View>
            <FlashList
              data={bookmarkedMessages}
              keyExtractor={(item) => item.id}
              estimatedItemSize={100}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
                  <Bookmark size={64} color="#666" />
                  <Text style={{ color: "#8E8E93", fontSize: 17, fontWeight: "600", marginTop: 16 }}>No Bookmarks</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    scrollToMessage(item.id);
                  }}
                  style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255, 255, 255, 0.05)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)", padding: 16 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ color: "#007AFF", fontSize: 14, fontWeight: "600" }}>{item.user.name}</Text>
                    <Text style={{ color: "#666", fontSize: 12, marginLeft: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 20 }} numberOfLines={3}>{item.content}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <Text style={{ color: "#666", fontSize: 12 }}>Tap to view in chat</Text>
                  </View>
                </Pressable>
              )}
            />
            </LinearGradient>
          </Animated.View>
        </Modal>

        {/* AI Super Features Modals */}
        
        {/* Smart Catch-Up Modal */}
        <CatchUpModal
          visible={showCatchUpModal}
          onClose={() => {
            setShowCatchUpModal(false);
            setCatchUpSinceMessageId(undefined); // Clear the since message ID
            // If we have a summary, dismiss the badge since user has viewed/generated one
            if (cachedSummary) {
              handleCatchUpDismiss();
            }
            // Clear the cached summary so user sees selection screen next time
            clearCachedSummary();
          }}
          summary={cachedSummary ?? null}
          isLoading={isGeneratingCatchUp}
          onGenerateSummary={(type: "concise" | "detailed", sinceMessageId?: string) => {
            generateCatchUp(type, sinceMessageId);
          }}
          onViewMessage={(messageId) => {
            setShowCatchUpModal(false);
            setCatchUpSinceMessageId(undefined);
            clearCachedSummary(); // Clear so user sees selection screen next time
            scrollToMessage(messageId);
          }}
          user={user}
          sinceMessageId={catchUpSinceMessageId}
          onSavePreference={async (preference: "concise" | "detailed") => {
            try {
              await api.patch(`/api/users/${user?.id}`, { summaryPreference: preference });
              // Update local user state
              if (updateUser) {
                await updateUser({ summaryPreference: preference } as any);
              }
            } catch (error) {
              console.error("[ChatScreen] Failed to save summary preference:", error);
            }
          }}
          onMarkPreferencePromptSeen={async () => {
            try {
              await api.patch(`/api/users/${user?.id}`, { hasSeenSummaryPreferencePrompt: true });
              // Update local user state
              if (updateUser) {
                await updateUser({ hasSeenSummaryPreferencePrompt: true } as any);
              }
            } catch (error) {
              console.error("[ChatScreen] Failed to mark preference prompt as seen:", error);
            }
          }}
        />

        {/* Scroll to Bottom Button - Shows "New Messages" only when there are actual new messages */}
        {showScrollToBottom && (
          <View
            style={{
              position: "absolute",
              bottom: 100 + insets.bottom, // Positioned above input
              right: 16, // Position on the right side
              zIndex: 100,
            }}
          >
            <Pressable
              onPress={() => {
                scrollToBottom(true);
                setShowScrollToBottom(false);
                setHasNewMessages(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <BlurView
                intensity={80}
                tint="dark"
                style={{
                  paddingHorizontal: hasNewMessages ? 16 : 12,
                  paddingVertical: hasNewMessages ? 8 : 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: hasNewMessages ? "rgba(52, 199, 89, 0.5)" : "rgba(255, 255, 255, 0.3)",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden",
                }}
              >
                {hasNewMessages ? (
                  <>
                    <LinearGradient
                      colors={["rgba(52, 199, 89, 0.2)", "rgba(52, 199, 89, 0.05)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>
                      New Messages
                    </Text>
                    <ChevronDown size={16} color="#FFFFFF" />
                  </>
                ) : (
                  <ChevronDown size={20} color="#FFFFFF" />
                )}
              </BlurView>
            </Pressable>
          </View>
        )}

        {/* Smart Catch-Up Floating Button */}
        <CatchUpButton
          unreadCount={catchUpCount > 0 ? catchUpCount : currentChatUnreadCount}
          isVisible={(currentChatUnreadCount >= 10 || catchUpCount >= 10) && !showCatchUpModal && !catchUpDismissed}
          onPress={() => {
            // sinceMessageId was already captured when we detected >= 10 unread (in useEffect)
            // This ensures we have the right message ID even if read receipts have since updated
            console.log("[ChatScreen] Opening catch-up modal with sinceMessageId:", catchUpSinceMessageId);
            setShowCatchUpModal(true);
          }}
          onDismiss={handleCatchUpDismiss}
        />

        {/* Events Modal */}
        <Modal
          visible={showEventsTab}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowEventsTab(false)}
        >
          <Animated.View
            style={{
              flex: 1,
              transform: [{ translateY: eventsModalDragY }],
            }}
            {...eventsModalPanResponder.panHandlers}
          >
            <LinearGradient colors={["#0A0A0A", "#1A1A2E", "#16213E"]} style={{ flex: 1 }}>
              <View style={{ paddingTop: insets.top + 10, paddingBottom: 16, paddingHorizontal: 20 }}>
                <View style={{ borderRadius: 16, overflow: "hidden" }}>
                  <BlurView intensity={30} tint="dark" style={{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <LinearGradient
                      colors={["rgba(10, 149, 255, 0.2)", "rgba(0, 122, 255, 0.1)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 24 }}>📅</Text>
                      <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>Events</Text>
                    </View>
                    <Pressable onPress={() => setShowEventsTab(false)}>
                      <X size={20} color="#FFFFFF" />
                    </Pressable>
                  </BlurView>
                </View>
              </View>
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <EventsList
                events={events}
                currentUserId={user?.id || ""}
                onVote={(eventId, optionId) => vote({ eventId, optionId })}
                onRSVP={(eventId, responseType) => rsvp({ eventId, responseType })}
                onExport={async (eventId) => {
                  try {
                    console.log("[ChatScreen] Exporting event:", eventId);
                    const result = await exportEvent(eventId, "ics");
                    console.log("[ChatScreen] Export result:", result);

                    if (result?.icsData) {
                      // Save ICS file to device
                      const fileName = `event_${eventId}.ics`;
                      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

                      console.log("[ChatScreen] Writing file to:", fileUri);
                      await FileSystem.writeAsStringAsync(fileUri, result.icsData, {
                        encoding: FileSystem.EncodingType.UTF8,
                      });

                      // Check if sharing is available
                      const isSharingAvailable = await Sharing.isAvailableAsync();
                      console.log("[ChatScreen] Sharing available:", isSharingAvailable);
                      
                      if (isSharingAvailable) {
                        console.log("[ChatScreen] Opening share dialog");
                        await Sharing.shareAsync(fileUri, {
                          mimeType: 'text/calendar',
                          dialogTitle: 'Add Event to Calendar',
                          UTI: 'public.calendar-event',
                        });
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      } else {
                        Alert.alert(
                          "Success",
                          "Calendar file saved! You can find it in your files.",
                          [{ text: "OK", style: "default" }]
                        );
                      }
                    } else {
                      console.error("[ChatScreen] No icsData in result:", result);
                      throw new Error("No calendar content received");
                    }
                  } catch (error) {
                    console.error("[ChatScreen] Error exporting event:", error);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert(
                      "Error",
                      "Failed to export event to calendar. Please try again.",
                      [{ text: "OK", style: "default" }]
                    );
                  }
                }}
                onDelete={(eventId) => {
                  deleteEvent(eventId);
                }}
                onEdit={(event) => {
                  setEditingEvent(event);
                  setShowEventsTab(false); // Close the events list modal first
                  // Small delay to ensure modal closes before opening edit modal
                  setTimeout(() => {
                    setShowCreateEvent(true);
                  }, 100);
                }}
                onFinalize={(eventId) => {
                  updateEvent(
                    { eventId, status: "confirmed" },
                    {
                      onSuccess: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      },
                      onError: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        Alert.alert("Error", "Failed to finalize event.");
                      },
                    }
                  );
                }}
                isLoading={isLoadingEvents}
              />
            </View>

            {/* Floating Plus Button for Events */}
            <View
              style={{
                position: "absolute",
                bottom: insets.bottom + 60,
                right: 0,
                left: 0,
                alignItems: "flex-end",
                paddingRight: 40,
                pointerEvents: "box-none",
              }}
            >
              <Animated.View
                style={{
                  transform: [
                    { scale: eventButtonScale },
                    {
                      rotate: eventButtonRotate.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "90deg"],
                      }),
                    },
                  ],
                }}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    
                    // Premium button animation
                    Animated.sequence([
                      Animated.parallel([
                        Animated.spring(eventButtonScale, {
                          toValue: 0.85,
                          useNativeDriver: true,
                          tension: 300,
                          friction: 10,
                        }),
                        Animated.timing(eventButtonRotate, {
                          toValue: 1,
                          duration: 200,
                          useNativeDriver: true,
                        }),
                      ]),
                      Animated.parallel([
                        Animated.spring(eventButtonScale, {
                          toValue: 1,
                          useNativeDriver: true,
                          tension: 200,
                          friction: 8,
                        }),
                        Animated.timing(eventButtonRotate, {
                          toValue: 0,
                          duration: 200,
                          useNativeDriver: true,
                        }),
                      ]),
                    ]).start();
                    
                    // Close Events modal and open Create Event modal
                    setTimeout(() => {
                      setShowEventsTab(false);
                      setTimeout(() => {
                        setShowCreateEvent(true);
                      }, 250);
                    }, 100);
                  }}
                  style={({ pressed }) => ({
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    overflow: "hidden",
                    shadowColor: "#0A95FF",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: pressed ? 0.5 : 0.35,
                    shadowRadius: 20,
                    elevation: 12,
                    borderWidth: 2.5,
                    borderColor: "rgba(255, 255, 255, 0.9)",
                  })}
                >
                  <BlurView intensity={80} tint="dark" style={{ width: 80, height: 80, borderRadius: 40, overflow: "hidden" }}>
                    <LinearGradient
                      colors={[
                        "rgba(10, 149, 255, 0.5)",
                        "rgba(0, 122, 255, 0.4)",
                        "rgba(0, 102, 255, 0.3)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ 
                        fontSize: 44, 
                        color: "#FFFFFF", 
                        fontWeight: "200", 
                        lineHeight: 44,
                        textAlign: "center",
                      }}>+</Text>
                    </LinearGradient>
                  </BlurView>
                </Pressable>
              </Animated.View>
            </View>
            </LinearGradient>
          </Animated.View>
        </Modal>

        {/* Create Event Modal - conditionally rendered so it stacks above Events modal */}
        {showCreateEvent && (
          <CreateEventModal
            visible={showCreateEvent}
            onClose={() => {
              setShowCreateEvent(false);
              setEditingEvent(null);
            }}
            initialEvent={editingEvent}
            onCreate={(title, description, type, eventDate, timezone, options) => {
              if (editingEvent) {
                // Update existing event
                // Note: We currently don't update options or event type to preserve votes and avoid complexity with option IDs
                updateEvent(
                  {
                    eventId: editingEvent.id,
                    title,
                    description: description || undefined,
                    eventDate: eventDate ? eventDate.toISOString() : null,
                    timezone: timezone || null,
                  },
                  {
                    onSuccess: () => {
                      setShowCreateEvent(false);
                      setEditingEvent(null);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                    onError: (error) => {
                      console.error("Failed to update event:", error);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      Alert.alert("Error", "Failed to update event. Please try again.");
                    },
                  }
                );
              } else {
                // Create new event
                createEvent(
                  {
                    title,
                    description: description || undefined,
                    eventType: type,
                    eventDate: eventDate ? eventDate.toISOString() : null,
                    timezone,
                    options,
                  },
                  {
                    onSuccess: () => {
                      setShowCreateEvent(false);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                    onError: (error) => {
                      console.error("Failed to create event:", error);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      Alert.alert("Error", "Failed to create event. Please try again.");
                    },
                  }
                );
              }
            }}
            isCreating={isCreatingEvent}
          />
        )}

        {/* Create Poll Modal */}
        {showCreatePoll && (
          <CreatePollModal
            visible={showCreatePoll}
            onClose={() => setShowCreatePoll(false)}
            onCreate={(question, options) => {
              createPoll(
                {
                  question,
                  options,
                },
                {
                  onSuccess: () => {
                    setShowCreatePoll(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  },
                  onError: (error) => {
                    console.error("Failed to create poll:", error);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert("Error", "Failed to create poll. Please try again.");
                  },
                }
              );
            }}
            isCreating={isCreatingPoll}
          />
        )}

        {/* Content Reactor Menu */}
        <ReactorMenu
          visible={showReactorMenu}
          onClose={() => {
            setShowReactorMenu(false);
            setReactorMessageId(null);
          }}
          messageId={reactorMessageId || ""}
          hasImage={!!reactorMessageId && !!messages.find(m => m.id === reactorMessageId)?.imageUrl}
          hasVideo={false}
          onCaption={() => {
            if (reactorMessageId) {
              console.log("[ChatScreen] Triggering caption generation for:", reactorMessageId);
              generateCaption(reactorMessageId);
              setShowReactorMenu(false);
              setReactorMessageId(null);
            }
          }}
          onRemix={(prompt) => {
            if (reactorMessageId && prompt.trim()) {
              console.log("[ChatScreen] Triggering remix for:", reactorMessageId, "prompt:", prompt);
              setIsAITyping(true); // Show AI typing animation
              remix({ messageId: reactorMessageId, remixPrompt: prompt, preview: true });
              setShowReactorMenu(false);
              setReactorMessageId(null);
              // Auto-scroll removed per user request
              /*
              // Scroll to show AI typing indicator
              requestAnimationFrame(() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 200);
              });
              */
            }
          }}
          onMeme={(prompt) => {
            if (reactorMessageId) {
              console.log("[ChatScreen] Triggering meme generation for:", reactorMessageId, "prompt:", prompt || "(AI will decide)");
              setIsAITyping(true); // Show AI typing animation
              createMeme({ messageId: reactorMessageId, memePrompt: prompt || undefined, preview: true });
              setShowReactorMenu(false);
              setReactorMessageId(null);
              // Scroll to show AI typing indicator
              requestAnimationFrame(() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 200);
              });
            }
          }}
          isProcessing={isReactorProcessing}
        />

        {/* Smart Threads Panel */}
        <ThreadsPanel
          visible={showThreadsPanel}
          onClose={() => setShowThreadsPanel(false)}
          threads={threads}
          currentThreadId={currentThreadId}
          onSelectThread={(threadId) => {
            setCurrentThreadId(threadId);
            setShowThreadsPanel(false);
          }}
          onCreateThread={() => {
            setShowThreadsPanel(false);
            setShowCreateThread(true);
          }}
          onEditThread={(thread) => {
            setEditingThread(thread);
            setShowThreadsPanel(false);
            setShowCreateThread(true);
          }}
          onDeleteThread={(threadId) => {
            deleteThread(threadId);
            // If the deleted thread was active, switch to main chat
            if (currentThreadId === threadId) {
              setCurrentThreadId(null);
            }
          }}
        />

        {/* Create Thread Modal */}
        <CreateThreadModal
          visible={showCreateThread}
          onClose={() => {
            setShowCreateThread(false);
            setEditingThread(null);
          }}
          editingThread={editingThread}
          onCreate={(name, icon, isShared, filterRules) => {
            if (editingThread) {
              // Update existing thread
              updateThread(
                { threadId: editingThread.id, name, icon, isShared, filterRules },
                {
                  onSuccess: () => {
                    setShowCreateThread(false);
                    setEditingThread(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  },
                  onError: (error) => {
                    console.error("Failed to update thread:", error);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert("Error", "Failed to update thread. Please try again.");
                  },
                }
              );
            } else {
              // Create new thread
              createThread(
                { name, icon, isShared, filterRules },
                {
                  onSuccess: () => {
                    setShowCreateThread(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  },
                  onError: (error) => {
                    console.error("Failed to create thread:", error);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert("Error", "Failed to create thread. Please try again.");
                  },
                }
              );
            }
          }}
          isCreating={isCreatingThread}
        />

        {/* Create Custom Command Modal */}
        <CreateCustomCommandModal
          visible={showCreateCustomCommand}
          onClose={() => setShowCreateCustomCommand(false)}
          onCreate={(command, prompt) => {
            createCustomCommandMutation.mutate({ command, prompt });
          }}
          isCreating={createCustomCommandMutation.isPending}
        />

        {/* Create AI Friend Modal */}
        <CreateAIFriendModal
          visible={showCreateAIFriend}
          onClose={() => setShowCreateAIFriend(false)}
          onCreate={(name, personality, tone, engagementMode, engagementPercent) => {
            createAIFriendMutation.mutate({ 
              name, 
              personality, 
              tone, 
              engagementMode, 
              engagementPercent 
            });
          }}
          isCreating={createAIFriendMutation.isPending}
        />

        {/* VibeSelector for emotional message context */}
        <VibeSelector
          visible={showVibeSelector}
          onSelect={handleVibeSelect}
          onPreview={handleVibePreview}
          onCancel={handleVibeCancel}
          anchorPosition={sendButtonPosition}
        />
        <ReplyPreviewModal
          key={replyPreviewModal?.reply?.id || "closed"}
          visible={!!replyPreviewModal}
          message={replyPreviewModal}
          onClose={() => setReplyPreviewModal(null)}
          aiFriends={aiFriends}
        />

        {/* Image Preview Modal for AI generations */}
        <ImagePreviewModal
          visible={!!previewImage}
          imageUrl={previewImage?.imageUrl || null}
          initialPrompt={previewImage?.prompt || ""}
          previewType={previewType}
          defaultCaption={(() => {
            if (!previewImage) return "";
            if (originalPreviewPrompt && originalPreviewPrompt !== previewImage.prompt) {
              return `Original: ${originalPreviewPrompt}\nEdit: ${previewImage.prompt}`;
            }
            return previewImage.prompt;
          })()}
          isProcessing={isConfirmingImage || isEditingImage}
          onAccept={(caption) => {
            if (previewImage) {
              confirmImageMutation.mutate({
                imageUrl: previewImage.imageUrl,
                prompt: caption,
                userId: user?.id || "",
                chatId,
                type: previewType,
                metadata: {
                  ...previewImage.metadata,
                  // Add slash command badge for AI-generated images/memes
                  slashCommand: {
                    command: `/${previewType}`, // "/image", "/meme", or "/remix"
                  },
                },
              });
            }
          }}
          onEdit={(newPrompt) => {
            if (previewImage) {
              editImageMutation.mutate({
                previousImageUrl: previewImage.imageUrl,
                editPrompt: newPrompt,
                userId: user?.id || "",
                chatId,
                type: previewType,
              });
            }
          }}
          onCancel={() => setPreviewImage(null)}
        />
      </View>
    );
};

export default ChatScreen;
