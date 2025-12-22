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
  AppState,
  AppStateStatus,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { FadeIn, FadeInUp, FadeOut, Layout, useAnimatedStyle, useAnimatedKeyboard, useAnimatedReaction, runOnJS, useSharedValue, withTiming, withRepeat, withSequence } from "react-native-reanimated";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Send, User as UserIcon, ImagePlus, X, Download, Share2, Reply, Smile, Settings, Users, ChevronLeft, ChevronDown, Trash2, Edit, Edit3, CheckSquare, StopCircle, Mic, Plus, Images, Search, Bookmark, MoreVertical, Calendar, UserPlus, Sparkles, ArrowUp, Copy, Languages } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
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
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { useDraftStore } from "@/stores/draftStore";
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
import { SuggestionCard } from "@/components/SuggestionCard";
import { ReactorMenu } from "@/components/Reactor";
import { ThreadsPanel, CreateThreadModal, DraggableThreadList } from "@/components/Threads";
import { CreateCustomCommandModal } from "@/components/CustomCommands";
import { CreateAIFriendModal } from "@/components/AIFriends";
import { ReplyPreviewModal } from "@/components/ReplyPreviewModal";
import { ImageGeneratorSheet, ImageGenerationPill } from "@/components/ImageGeneratorSheet";
import MentionPicker from "@/components/MentionPicker";
import MessageText from "@/components/MessageText";
import { ProfileImage } from "@/components/ProfileImage";
import { SwipeableMessage, MessageBubbleMeasurer } from "@/components/SwipeableMessage";
import { TruncatedText } from "@/components/TruncatedText";
import { VibeSelector, VIBE_CONFIG, VibeSelectorStatic } from "@/components/VibeSelector";
import { VibeAnimatedBubble } from "@/components/VibeAnimatedBubble";
import TranslationToggle from "@/components/AINative/TranslationToggle";
import type { VibeType } from "@shared/contracts";
import { useCatchUp } from "@/hooks/useCatchUp";
import { useEvents } from "@/hooks/useEvents";
import { usePolls } from "@/hooks/usePolls";
import { useReactor } from "@/hooks/useReactor";
import { useThreads, useThreadMessages } from "@/hooks/useThreads";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";
import { ShimmeringText } from "@/components/ShimmeringText";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { VoiceRoomModal, VoiceRoomBanner } from "@/components/VoiceRoom";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import { useDebounce } from "@/hooks/useDebounce";
import { GlobalSearchResponse, SearchMessageResult } from "@/shared/contracts";
import { HighlightText } from "@/components/HighlightText";

const GlowMessageWrapper = ({ children, isHighlighted, color }: { children: React.ReactNode, isHighlighted: boolean, color: string }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (isHighlighted) {
      // Pulse animation
      opacity.value = withSequence(
        withTiming(0.6, { duration: 300 }),
        withRepeat(
          withSequence(
            withTiming(0.2, { duration: 800 }),
            withTiming(0.6, { duration: 800 })
          ),
          4, // Repeat 4 times
          true // Reverse
        ),
        withTiming(0, { duration: 500 }) // Fade out at the end
      );
      
      scale.value = withSequence(
        withTiming(1.05, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.in(Easing.ease) })
      );
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [isHighlighted]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View>
      <Reanimated.View
        style={[
          {
            position: 'absolute',
            top: -6,
            left: -6,
            right: -6,
            bottom: -6,
            backgroundColor: color,
            borderRadius: 24,
            zIndex: -1,
          },
          animatedStyle,
        ]}
      />
      {children}
    </View>
  );
};

const AnimatedFlashList = Reanimated.createAnimatedComponent(FlashList);

// Performance optimization: Limit cached messages to avoid MMKV/Memory bloat
const MAX_CACHED_MESSAGES = 500;

// Define PendingMessage type locally extending Message
type PendingMessage = Message & {
  isPending?: boolean;
  isUploading?: boolean;
  uploadProgress?: number; // 0-100
  localUri?: string;
  localVideoThumbnailUri?: string;
};

type DateDivider = {
  id: string;
  isDateDivider: true;
  date: Date;
};

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
  onJoinVoiceRoom,
  onTranslatePress,
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
  onJoinVoiceRoom: () => void;
  onTranslatePress: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RootStackScreenProps<"Chat">["route"]>();
  
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
        tint={isDark ? "dark" : "light"}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: Platform.OS === "ios" 
            ? (isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)")
            : (isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.85)"),
          borderBottomWidth: 0.5,
          borderBottomColor: colors.glassBorder,
        }}
      >
        <LinearGradient
          colors={isDark 
            ? [
                "rgba(79, 195, 247, 0.15)",
                "rgba(0, 122, 255, 0.1)",
                "rgba(0, 0, 0, 0)",
              ]
            : [
                "rgba(0, 122, 255, 0.05)",
                "rgba(79, 195, 247, 0.05)",
                "rgba(255, 255, 255, 0)",
              ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            opacity: 0.5,
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
              backgroundColor: colors.inputBackground,
              shadowColor: colors.glassShadow,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.5} />
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
                  backgroundColor: colors.inputBackground,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 2,
                }}
              >
                <Users size={24} color={colors.text} />
              </View>
            )}
            {/* Group Name */}
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.text }}
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
              backgroundColor: colors.inputBackground,
              shadowColor: colors.glassShadow,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <MoreVertical size={20} color={colors.text} />
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
            backgroundColor: colors.overlay,
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
              tint={colors.blurTint}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                minWidth: 200,
                backgroundColor: colors.glassBackgroundSecondary,
                borderWidth: 1,
                borderColor: colors.glassBorder,
              }}
            >
              <LinearGradient
                colors={isDark ? [
                  "rgba(255, 255, 255, 0.15)",
                  "rgba(255, 255, 255, 0.10)",
                  "rgba(255, 255, 255, 0.05)",
                ] : [
                  "rgba(255, 255, 255, 0.8)",
                  "rgba(255, 255, 255, 0.6)",
                  "rgba(255, 255, 255, 0.4)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 8 }}
              >
                {/* Voice Room Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onJoinVoiceRoom();
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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Mic size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
                    Vibe Call
                  </Text>
                </Pressable>

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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <RNImage
                      source={require("../../assets/smarth threads icon (1).png")}
                      style={{ width: 40, height: 40, tintColor: colors.text }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Calendar size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Bookmark size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Search size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
                    Search
                  </Text>
                </Pressable>

                {/* Translation Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowOptionsMenu(false);
                    onTranslatePress();
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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Languages size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
                    Translate
                  </Text>
                </Pressable>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

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
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <UserPlus size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
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
  const { colors, isDark } = useTheme();
  
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
            backgroundColor: isDark ? "rgba(45, 45, 45, 0.95)" : "rgba(255, 255, 255, 0.95)",
            borderRadius: 12,
            padding: 10,
            marginBottom: 12,
            maxWidth: 280,
            borderWidth: 1,
            borderColor: colors.glassBorder,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
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
            backgroundColor: isDark ? "rgba(20, 20, 20, 0.95)" : "rgba(255, 255, 255, 0.98)",
            borderRadius: 16,
            padding: 8,
            minWidth: 280,
            borderWidth: 1,
            borderColor: colors.glassBorder,
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
              borderBottomColor: colors.glassBorder,
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
                  backgroundColor: pressed 
                    ? (isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)") 
                    : (isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"),
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
            <Reply size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
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
              <Copy size={20} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
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
            <Bookmark size={20} color={isBookmarked ? colors.warning : colors.text} fill={isBookmarked ? colors.warning : "none"} />
            <Text style={{ color: isBookmarked ? colors.warning : colors.text, fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
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
            <Settings size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12, fontWeight: "500" }}>
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
  const { colors, isDark } = useTheme();
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
            backgroundColor: isDark ? "rgba(20, 20, 20, 0.95)" : "rgba(255, 255, 255, 0.98)",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
          }}
          onStartShouldSetResponder={() => true}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 16, textAlign: "center" }}>
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
                  backgroundColor: colors.inputBackground,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
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
  const { colors, isDark } = useTheme();
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
          backgroundColor: isDark ? "rgba(142, 142, 147, 0.15)" : "rgba(142, 142, 147, 0.12)",
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: isDark ? "rgba(142, 142, 147, 0.3)" : "rgba(142, 142, 147, 0.25)",
          maxWidth: "80%",
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontStyle: "italic" }}>
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: isDark ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.98)",
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
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
                      backgroundColor: colors.inputBackground,
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
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
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
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
  const { colors, isDark } = useTheme();
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
          tint={colors.blurTint}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <LinearGradient
            colors={isDark ? ["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.08)"] : ["rgba(0, 0, 0, 0.05)", "rgba(0, 0, 0, 0.02)"]}
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
              color: colors.text,
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
              backgroundColor: colors.inputBackground,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
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
  const { colors, isDark } = useTheme();
  
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
            backgroundColor: isDark ? "rgba(20, 20, 20, 0.95)" : "rgba(255, 255, 255, 0.98)",
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            width: "90%",
            maxWidth: 400,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 36, marginRight: 12 }}>{emoji}</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>
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
                    borderBottomColor: colors.glassBorder,
                  }}
                >
                  {user?.image ? (
                    <Image
                      key={`user-avatar-${user.id}-${user.image}`}
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
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>
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

// Search Header Component
const SearchHeader = ({
  searchQuery,
  onSearchQueryChange,
  onClose,
  insets,
  colors,
  isDark
}: {
  searchQuery: string;
  onSearchQueryChange: (text: string) => void;
  onClose: () => void;
  insets: any;
  colors: any;
  isDark: boolean;
}) => {
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
      <BlurView
        intensity={80}
        tint={isDark ? "dark" : "light"}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: Platform.OS === "ios" 
            ? (isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)")
            : (isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.85)"),
          borderBottomWidth: 0.5,
          borderBottomColor: colors.glassBorder,
        }}
      >
        <LinearGradient
          colors={isDark 
            ? ["rgba(79, 195, 247, 0.15)", "rgba(0, 122, 255, 0.1)", "rgba(0, 0, 0, 0)"]
            : ["rgba(0, 122, 255, 0.05)", "rgba(79, 195, 247, 0.05)", "rgba(255, 255, 255, 0)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, opacity: 0.5 }}
        />
      </BlurView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 10,
          paddingHorizontal: 14,
          paddingBottom: 10,
        }}
      >
        <Pressable onPress={onClose} style={{ padding: 8 }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.inputBackground,
            borderRadius: 20,
            paddingHorizontal: 12,
            height: 40,
            marginHorizontal: 8,
          }}
        >
          <Search size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            placeholder="Search in chat..."
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 16,
              padding: 0,
            }}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => onSearchQueryChange("")}>
              <View style={{ backgroundColor: colors.textTertiary, borderRadius: 10, padding: 2 }}>
                <X size={12} color={colors.background} />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const SearchResultItem = ({ item, onPress, searchQuery, colors, isDark }: { item: SearchMessageResult, onPress: (item: SearchMessageResult) => void, searchQuery: string, colors: any, isDark: boolean }) => {
    const isSemantic = item.matchedField === "content" && item.similarity;
    const matchLabel = item.matchedField === "transcription" ? "Voice Match" 
                     : item.matchedField === "description" ? "Image Match" 
                     : null;

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <Pressable
        onPress={() => onPress(item)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          marginHorizontal: 16,
          marginBottom: 12,
          shadowColor: isDark ? colors.glassShadow : "rgba(0, 0, 0, 0.15)",
          shadowOffset: { width: 0, height: isDark ? 4 : 2 },
          shadowOpacity: isDark ? 0.2 : 0.12,
          shadowRadius: isDark ? 8 : 10,
          elevation: isDark ? 4 : 3,
        })}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? (isDark ? 20 : 60) : 40}
          tint={isDark ? "dark" : "light"}
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: isDark ? 1 : 1.5,
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)",
            backgroundColor: isDark ? "transparent" : "rgba(255, 255, 255, 0.85)"
          }}
        >
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
                {item.message.user?.name || "Unknown"}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                {formatTime(item.message.createdAt)}
              </Text>
            </View>

            {(isSemantic || matchLabel) && (
              <View style={{ flexDirection: "row", marginBottom: 6 }}>
                <View style={{ 
                  backgroundColor: isSemantic ? colors.primary + '20' : colors.textTertiary + '20', 
                  paddingHorizontal: 8, 
                  paddingVertical: 2, 
                  borderRadius: 8 
                }}>
                  <Text style={{ 
                    fontSize: 10, 
                    fontWeight: "600", 
                    color: isSemantic ? colors.primary : colors.textSecondary 
                  }}>
                    {matchLabel || `AI Match ${(item.similarity! * 100).toFixed(0)}%`}
                  </Text>
                </View>
              </View>
            )}

            <HighlightText 
              text={item.message.content || (item.message.voiceTranscription ? `🎤 ${item.message.voiceTranscription}` : (item.message.imageDescription ? `🖼️ ${item.message.imageDescription}` : "Media message"))}
              term={searchQuery}
              style={{ color: colors.text, fontSize: 15, lineHeight: 20 }}
              numberOfLines={3}
            />
          </View>
        </BlurView>
      </Pressable>
    );
};

const ChatScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<RootStackScreenProps<"Chat">["navigation"]>();
  const route = useRoute<RootStackScreenProps<"Chat">["route"]>();
  const { user, updateUser } = useUser();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();

  const { 
    activeRoom, 
    participants, 
    token: voiceToken, 
    serverUrl: voiceServerUrl,
    joinRoom, 
    leaveRoom, 
    isJoining: isJoiningVoice 
  } = useVoiceRoom(route.params?.chatId || "default-chat");
  
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [chatInputHeight, setChatInputHeight] = useState(60); // Default estimate
  // Track if user intentionally closed the modal to prevent auto-reopen
  const hasUserClosedVoiceModalRef = useRef(false);

  // Debug: Log ALL voice room values on EVERY render (reduced frequency)
  // console.log('[ChatScreen] RENDER - Voice Room State:', {
  //   chatId: route.params?.chatId,
  //   hasActiveRoom: !!activeRoom,
  //   hasVoiceToken: !!voiceToken,
  //   hasVoiceServerUrl: !!voiceServerUrl,
  //   voiceModalVisible,
  //   isJoiningVoice,
  //   tokenPreview: voiceToken ? voiceToken.substring(0, 20) : 'none',
  //   serverUrl: voiceServerUrl || 'none'
  // });

  // Reset the "user closed" flag when credentials are cleared (call truly ended)
  useEffect(() => {
    if (!voiceToken && !voiceServerUrl) {
      hasUserClosedVoiceModalRef.current = false;
    }
  }, [voiceToken, voiceServerUrl]);

  // Auto-open modal when we have an active room AND credentials are ready
  // BUT only if user hasn't intentionally closed the modal
  useEffect(() => {
    // Skip if user has intentionally closed the modal
    if (hasUserClosedVoiceModalRef.current) {
      return;
    }
    
    if (activeRoom && voiceToken && voiceServerUrl && !voiceModalVisible) {
      console.log('[ChatScreen] Auto-opening voice modal - credentials ready');
      setVoiceModalVisible(true);
    }
  }, [activeRoom, voiceToken, voiceServerUrl, voiceModalVisible]);

  // Handle joining voice room
  const handleJoinRoom = async () => {
    try {
      // Reset the closed flag when joining
      hasUserClosedVoiceModalRef.current = false;
      console.log('[ChatScreen] handleJoinRoom - calling joinRoom()');
      await joinRoom();
      console.log('[ChatScreen] handleJoinRoom - joinRoom completed');
    } catch (error) {
      console.error('[ChatScreen] handleJoinRoom - error:', error);
      Alert.alert("Error", "Failed to join Vibe Call");
    }
  };

  // Handle leaving Vibe Call
  const handleLeaveRoom = async () => {
    try {
      // Mark that user intentionally closed before doing anything else
      hasUserClosedVoiceModalRef.current = true;
      setVoiceModalVisible(false);
      await leaveRoom();
    } catch (error) {
      console.error("Failed to leave Vibe Call", error);
      Alert.alert("Error", "Failed to leave Vibe Call");
    }
  };

  // Translation handlers
  const handleTranslationToggle = async (enabled: boolean) => {
    setTranslationEnabled(enabled);
    
    // Update user preference on backend
    try {
      await api.post("/ai-native/translation-preference", {
        userId: user?.id,
        enabled,
        language: translationLanguage,
      });
      
      // Update user context
      if (updateUser) {
        updateUser({
          ...user,
          translationPreference: enabled ? "enabled" : "disabled",
          preferredLanguage: translationLanguage,
        });
      }
      
      // If enabling, translate all visible messages
      if (enabled && messages && messages.length > 0) {
        await translateVisibleMessages(messages);
      } else {
        // If disabling, clear translations
        setTranslatedMessages(new Map());
      }
    } catch (error) {
      console.error("[Translation] Failed to update preference:", error);
      Alert.alert("Error", "Failed to update translation preference");
    }
  };

  const handleLanguageSelect = async (language: string) => {
    setTranslationLanguage(language);
    
    // Save chat-specific language override to AsyncStorage
    // This overrides the user's default preferred language for this specific chat
    try {
      await AsyncStorage.setItem(`chat_language_${chatId}`, language);
      
      // Clear existing translations and re-translate with new language
      setTranslatedMessages(new Map());
      if (translationEnabled && messages && messages.length > 0) {
        await translateVisibleMessages(messages);
      }
    } catch (error) {
      console.error("[Translation] Failed to save chat language override:", error);
      Alert.alert("Error", "Failed to update translation language");
    }
  };

  const translateVisibleMessages = async (messagesToTranslate: Message[]) => {
    if (!messagesToTranslate || messagesToTranslate.length === 0) return;
    
    // Filter only text messages that haven't been translated yet
    const textMessages = messagesToTranslate.filter(
      (m) => m.content && m.content.trim() !== "" && !translatedMessages.has(m.id)
    );
    
    if (textMessages.length === 0) return;
    
    try {
      // Call batch translation endpoint
      const response = await api.post<{ translations: Array<{ messageId: string; translatedText: string }> }>(
        "/ai-native/translate-batch",
        {
          messageIds: textMessages.map((m) => m.id),
          targetLanguage: translationLanguage,
        }
      );
      
      if (response.data.translations) {
        const newTranslations = new Map(translatedMessages);
        response.data.translations.forEach((t: { messageId: string; translatedText: string }) => {
          newTranslations.set(t.messageId, t.translatedText);
        });
        setTranslatedMessages(newTranslations);
      }
    } catch (error) {
      console.error("[Translation] Failed to translate messages:", error);
    }
  };

  const translateSingleMessage = async (messageToTranslate: Message) => {
    if (!messageToTranslate.content || translatedMessages.has(messageToTranslate.id)) return;
    
    try {
      const response = await api.post<{ translatedText: string }>(
        "/ai-native/translate",
        {
          messageId: messageToTranslate.id,
          targetLanguage: translationLanguage,
        }
      );
      
      if (response.data.translatedText) {
        const newTranslations = new Map(translatedMessages);
        newTranslations.set(messageToTranslate.id, response.data.translatedText);
        setTranslatedMessages(newTranslations);
      }
    } catch (error) {
      console.error("[Translation] Failed to translate message:", error);
    }
  };

  // Get chatId from navigation params, fallback to default-chat for backward compatibility
  const chatId = route.params?.chatId || "default-chat";
  const chatName = route.params?.chatName || "VibeChat";
  const messageId = route.params?.messageId;
  const forceRefresh = route.params?.forceRefresh;
  
  // #region agent log
  // Intercept invalidateQueries for logging
  const originalInvalidate = useRef(queryClient.invalidateQueries.bind(queryClient));
  useEffect(() => {
    queryClient.invalidateQueries = ((options: any) => {
      // Logic removed
      return originalInvalidate.current(options);
    }) as any;

    return () => {
      queryClient.invalidateQueries = originalInvalidate.current as any;
    };
  }, []);
  // #endregion

  const flatListRef = useRef<FlashList<any>>(null);
  const textInputRef = useRef<TextInput>(null);
  const isInputFocused = useRef(false);
  const wasKeyboardOpenForAttachments = useRef(false); // Tracks if keyboard was open when attachments menu opened
  const wasKeyboardOpenForImageGen = useRef(false); // Tracks if keyboard was open when image generator sheet opened
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
  const [pendingUploads, setPendingUploads] = useState<PendingMessage[]>([]);
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
  // Edit mode state
  const [editSelectedImages, setEditSelectedImages] = useState<string[]>([]);
  const [editSelectedVideo, setEditSelectedVideo] = useState<{ uri: string; duration?: number } | null>(null);
  const [editMentionedUserIds, setEditMentionedUserIds] = useState<string[]>([]);
  
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
  const chatChannelRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null); // For sending typing broadcasts
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
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  
  // AI Super Features state
  const [showCatchUpModal, setShowCatchUpModal] = useState(false);
  const [showEventsTab, setShowEventsTab] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [suggestionPollData, setSuggestionPollData] = useState<{question: string, options: string[]} | null>(null);
  const [suggestionEventData, setSuggestionEventData] = useState<any | null>(null);
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
  
  // Translation state
  const [translationEnabled, setTranslationEnabled] = useState(user?.translationPreference === "enabled");
  const [translationLanguage, setTranslationLanguage] = useState(user?.preferredLanguage || "en");
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, string>>(new Map());

  // Load chat-specific language override from AsyncStorage
  useEffect(() => {
    const loadChatLanguageOverride = async () => {
      try {
        const override = await AsyncStorage.getItem(`chat_language_${chatId}`);
        if (override) {
          setTranslationLanguage(override);
        } else {
          // No override, use user's preferred language
          setTranslationLanguage(user?.preferredLanguage || "en");
        }
      } catch (error) {
        console.error("[ChatScreen] Failed to load chat language override:", error);
      }
    };
    
    if (chatId) {
      loadChatLanguageOverride();
    }
  }, [chatId, user?.preferredLanguage]);

  // In-Chat Search Query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: isSearchingBackend } = useQuery<GlobalSearchResponse>({
    queryKey: ["chat-search", chatId, debouncedSearchQuery],
    queryFn: () => api.post("/api/search/global", {
      userId: user!.id,
      query: debouncedSearchQuery,
      chatId: chatId,
      limit: 50
    }),
    enabled: showSearchModal && debouncedSearchQuery.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });

  const handleSearchResultPress = useCallback((result: SearchMessageResult) => {
    setShowSearchModal(false);
    setSearchQuery("");
    // Jump to message
    loadMessageContext(result.message.id);
  }, [loadMessageContext]);

  // MOVED UP: Thread hooks and state for Realtime updates
  const { threads, createThread, updateThread, deleteThread, reorderThreads, isCreating: isCreatingThread } = useThreads(chatId || "", user?.id || "");
  const { data: threadData, isLoading: isLoadingThreadMessages, error: threadMessagesError } = useThreadMessages(currentThreadId, user?.id || "");

  // Thread pagination state
  const [allThreadMessages, setAllThreadMessages] = useState<Message[]>([]);
  const [threadHasMore, setThreadHasMore] = useState(false);
  const [threadNextCursor, setThreadNextCursor] = useState<string | null>(null);
  const [isLoadingMoreThread, setIsLoadingMoreThread] = useState(false);

  // Sync thread data when it loads
  useEffect(() => {
    if (threadData) {
      setAllThreadMessages(threadData.messages || []);
      setThreadHasMore(threadData.hasMore || false);
      setThreadNextCursor(threadData.nextCursor || null);
    } else if (!currentThreadId) {
      setAllThreadMessages([]);
      setThreadHasMore(false);
      setThreadNextCursor(null);
    }
  }, [threadData, currentThreadId]);

  // Load more thread messages
  const loadMoreThreadMessages = useCallback(async () => {
    if (!threadNextCursor || isLoadingMoreThread || !currentThreadId || !user?.id) return;
    
    setIsLoadingMoreThread(true);
    try {
      const response = await api.get<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
        `/api/threads/${currentThreadId}/messages?userId=${user.id}&cursor=${encodeURIComponent(threadNextCursor)}`
      );
      
      if (response.messages && response.messages.length > 0) {
        setAllThreadMessages(prev => [...prev, ...response.messages]);
        setThreadHasMore(response.hasMore || false);
        setThreadNextCursor(response.nextCursor || null);
      } else {
        setThreadHasMore(false);
        setThreadNextCursor(null);
      }
    } catch (error) {
      console.error("[ChatScreen] Error loading more thread messages:", error);
    } finally {
      setIsLoadingMoreThread(false);
    }
  }, [threadNextCursor, isLoadingMoreThread, currentThreadId, user?.id]);

  // Client-side message filtering for Smart Threads (moved up for realtime updates)
  const filterMessages = useCallback((msgs: Message[], thread: Thread) => {
    const rules = thread.filterRules;
    if (!rules) return msgs;

    try {
      const parsedRules = typeof rules === 'string' ? JSON.parse(rules) : rules;
      
      return msgs.filter(msg => {
        if (parsedRules.keywords && parsedRules.keywords.length > 0) {
          const contentLower = msg.content.toLowerCase();
          const matchesKeyword = parsedRules.keywords.some((k: string) => contentLower.includes(k.toLowerCase()));
          if (!matchesKeyword) return false;
        }
        if (parsedRules.people && parsedRules.people.length > 0) {
          if (!parsedRules.people.includes(msg.userId)) return false;
        }
        if (parsedRules.dateRange) {
          const msgDate = new Date(msg.createdAt).getTime();
          if (parsedRules.dateRange.start && msgDate < new Date(parsedRules.dateRange.start).getTime()) return false;
          if (parsedRules.dateRange.end && msgDate > new Date(parsedRules.dateRange.end).getTime()) return false;
        }
        const hasTopicRules = (parsedRules.topics?.length ?? 0) > 0;
        const hasEntityRules = (parsedRules.entities?.length ?? 0) > 0;
        const hasSentimentRules = !!parsedRules.sentiment;

        if (hasTopicRules || hasEntityRules || hasSentimentRules) {
          if (!msg.tags || msg.tags.length === 0) return false;
          if (hasTopicRules) {
              const hasTopic = msg.tags.some(t => t.tagType === 'topic' && parsedRules.topics!.includes(t.tagValue));
              if (!hasTopic) return false;
          }
          if (hasEntityRules) {
              const hasEntity = msg.tags.some(t => t.tagType === 'entity' && parsedRules.entities!.includes(t.tagValue));
              if (!hasEntity) return false;
          }
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
  
  // Mentions state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  // Image Preview State (Persisted)
  const setImageDraft = useDraftStore((state) => state.setImageDraft);
  const previewImage = useDraftStore((state) => state.imageDrafts[chatId] || null);
  const setPreviewImage = useCallback((draft: ImagePreviewResponse | null) => {
    setImageDraft(chatId, draft);
  }, [chatId, setImageDraft]);
  const [isGeneratorSheetOpen, setIsGeneratorSheetOpen] = useState(true);
  const [originalPreviewPrompt, setOriginalPreviewPrompt] = useState<string>("");
  const [previewType, setPreviewType] = useState<"image" | "meme" | "remix">("image");
  
  // Auto-open sheet when new preview image arrives
  useEffect(() => {
    if (previewImage) {
      setIsGeneratorSheetOpen(true);
    }
  }, [previewImage]);
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
      return [];
    }
    const members = chat.members.map((m) => m.user);
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
  const [prevCursor, setPrevCursor] = useState<string | null>(null); // For scrolling DOWN (newer)
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false); // For jumping to message context
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastMessageTimestampRef = useRef<string | null>(null);
  const initialScrollDoneRef = useRef(false); // Track if initial scroll to message is done

  // Track realtime subscription retries (helps surface errors + auto-retry)
  const [realtimeRetryCount, setRealtimeRetryCount] = useState(0);

  // Recover missed messages after reconnection or backgrounding
  const recoverMissedMessages = useCallback(async (since: string) => {
    if (!chatId || !user?.id) return;
    
    console.log('[ChatScreen] Recovering messages since:', since);
    try {
      // Fetch messages created after we disconnected
      // Use standard endpoint with 'since' parameter
      const response = await api.get<{ messages: Message[] }>(
        `/api/chats/${chatId}/messages?userId=${user.id}&since=${encodeURIComponent(since)}`
      );
      
      if (response.messages && response.messages.length > 0) {
        console.log(`[ChatScreen] Recovered ${response.messages.length} missed messages`);
        
        // Backend returns Oldest -> Newest for 'since' queries (see backend logic)
        // Our list is Newest -> Oldest, so we reverse the new messages
        const newMessages = [...response.messages].reverse();
        
        setAllMessages(prev => {
           // Filter out duplicates just in case
           const existingIds = new Set(prev.map(m => m.id));
           const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
           
           if (uniqueNewMessages.length === 0) return prev;
           
           const updated = [...uniqueNewMessages, ...prev];
           // Prune to prevent memory issues
           if (updated.length > MAX_CACHED_MESSAGES) {
             updated.length = MAX_CACHED_MESSAGES;
           }
           return updated;
        });
        
        // CRITICAL FIX: Update cache for persistence
        queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
           ["messages", chatId],
           (oldData) => {
             if (!oldData || !oldData.messages) return oldData;
             // Filter out duplicates just in case
             const existingIds = new Set(oldData.messages.map(m => m.id));
             const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
             
             if (uniqueNewMessages.length === 0) return oldData;
             
             const updatedMessages = [...uniqueNewMessages, ...oldData.messages];
             // Prune to prevent memory issues
             if (updatedMessages.length > MAX_CACHED_MESSAGES) {
               updatedMessages.length = MAX_CACHED_MESSAGES;
             }

             return {
               ...oldData,
               messages: updatedMessages
             };
           }
         );
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to recover missed messages:', error);
      // Fallback: invalidate the entire messages query to force a refetch
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    }
  }, [chatId, user?.id, queryClient]);

  // Helper to load context for a specific message
  const loadMessageContext = useCallback(async (targetMessageId: string) => {
    if (isLoadingContext) return false;
    setIsLoadingContext(true);
    console.log(`[ChatScreen] Loading context for message ${targetMessageId}`);
    
    try {
      // Use the new 'around' parameter to fetch context
      const response = await api.get<{
        messages: Message[],
        hasMore: boolean,
        nextCursor: string | null,
        prevCursor: string | null
      }>(`/api/chats/${chatId}/messages?userId=${user?.id}&around=${targetMessageId}&limit=50`);
      
      if (response && response.messages) {
        console.log(`[ChatScreen] Loaded ${response.messages.length} messages for context`);
        setAllMessages(response.messages);
        setNextCursor(response.nextCursor);
        setPrevCursor(response.prevCursor || null);
        return true;
      }
    } catch (error) {
      console.error("[ChatScreen] Failed to load message context:", error);
      Alert.alert("Error", "Failed to load message context");
    } finally {
      setIsLoadingContext(false);
    }
    return false;
  }, [isLoadingContext, chatId, user?.id]);

  // Handle messageId param (deep link or search navigation)
  const contextFetchAttemptedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!messageId) return;
    
    // Reset if messageId changes
    if (messageId !== contextFetchAttemptedRef.current && contextFetchAttemptedRef.current !== null) {
        initialScrollDoneRef.current = false;
    }

    if (initialScrollDoneRef.current) return;

    // Check if message is in the currently loaded list
    // Use allMessages to check existence, as activeMessages might filter it out (e.g. threads)
    // But we need it in activeMessages to scroll. 
    // If it's in allMessages but not activeMessages, it might be hidden? 
    // For now, check allMessages to decide whether to fetch.
    const messageExists = allMessages.some(m => m.id === messageId);
    
    if (messageExists) {
      console.log(`[ChatScreen] Target message ${messageId} found in memory, scrolling...`);
      // Use setTimeout to allow render cycle to complete if we just updated state
      setTimeout(() => {
        scrollToMessage(messageId);
        initialScrollDoneRef.current = true;
        // Clear param logic could go here if we had access to navigation.setParams
      }, 500);
    } else {
      if (!isLoadingContext && contextFetchAttemptedRef.current !== messageId) {
         console.log(`[ChatScreen] Target message ${messageId} not found locally, fetching context...`);
         contextFetchAttemptedRef.current = messageId;
         loadMessageContext(messageId);
      }
    }
  }, [messageId, allMessages, isLoadingContext, loadMessageContext, scrollToMessage]);

  // Keep lastMessageTimestampRef updated
  useEffect(() => {
    if (allMessages.length > 0) {
      // allMessages is sorted Newest -> Oldest, so index 0 is the newest
      const newestMessage = allMessages[0];
      if (newestMessage && newestMessage.createdAt) {
         // Only update if newer
         if (!lastMessageTimestampRef.current || new Date(newestMessage.createdAt) > new Date(lastMessageTimestampRef.current)) {
             lastMessageTimestampRef.current = newestMessage.createdAt;
         }
      }
    }
  }, [allMessages]);

  // Handle app state changes for foreground recovery
  useEffect(() => {
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          console.log('[ChatScreen] App returned to foreground, checking for missed messages');
          
          if (lastMessageTimestampRef.current) {
             recoverMissedMessages(lastMessageTimestampRef.current);
          } else {
             // If we don't have a timestamp, just refetch everything to be safe
             queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
          }
        }
        appStateRef.current = nextAppState;
      };
  
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        subscription.remove();
      };
    }, [recoverMissedMessages, queryClient, chatId]);


  // Fetch messages for this chat (with pagination support)
  const { data: messageData, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const response = await api.get<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
        `/api/chats/${chatId}/messages?userId=${user?.id}`
      );

      return response;
    },
    // Realtime subscription is used instead of polling
    enabled: !!user?.id && !!chatId,
    // CRITICAL: Show cached data immediately while fetching fresh data
    placeholderData: (previousData) => previousData,
  });

  // Force refresh when navigating from push notification
  // This ensures we fetch the latest messages including the one that triggered the notification
  useEffect(() => {
    if (forceRefresh && chatId) {
      console.log("[ChatScreen] Force refresh triggered, invalidating messages cache");
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      // Clear the forceRefresh param to prevent re-triggering on subsequent re-renders
      navigation.setParams({ forceRefresh: undefined });
    }
  }, [forceRefresh, chatId, queryClient, navigation]);

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
    
    // Track if we've successfully subscribed to prevent unnecessary retries
    let isSubscribed = false;
    let subscriptionTimeout: NodeJS.Timeout | null = null;
    let lastMessageTimestamp: string | null = null; // For gap detection on reconnect
    
    const channel = supabaseClient.channel(`chat:${chatId}`, {
      config: {
        // Optimize for reliable message delivery
        broadcast: { self: false },
        presence: { key: user?.id || '' },
      },
    })
      // Listen for new messages - SERVER-SIDE FILTER by chatId
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message',
          filter: `chatId=eq.${chatId}`, // Server-side filter - 95%+ traffic reduction
        },
        async (payload) => {
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
            
            // Update last message timestamp for gap detection
            lastMessageTimestamp = payload.new.createdAt as string;
            
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
               // Translate new message in real-time if translation is enabled
               if (translationEnabled && newMessage.content && newMessage.content.trim() !== "") {
                 try {
                   const translateResponse = await api.post<{ translatedText: string }>(
                     "/ai-native/translate",
                     {
                       messageId: newMessage.id,
                       targetLanguage: translationLanguage,
                     }
                   );
                   
                   if (translateResponse.data.translatedText) {
                     setTranslatedMessages(prev => {
                       const newMap = new Map(prev);
                       newMap.set(newMessage.id, translateResponse.data.translatedText);
                       return newMap;
                     });
                   }
                 } catch (translateError) {
                   console.error('[Translation] Failed to translate new message:', translateError);
                 }
               }
               
               setAllMessages(prev => {
                 
                 // Deduplicate
                 if (prev.some(m => m.id === newMessage.id)) {
                   return prev;
                 }
                 // Prepend to START (Descending order: Newest -> Oldest)
                 const updated = [newMessage, ...prev];
                 // Prune to prevent memory issues
                 if (updated.length > MAX_CACHED_MESSAGES) {
                   updated.length = MAX_CACHED_MESSAGES;
                 }
                 return updated;
               });
               
               // CRITICAL FIX: Also update React Query cache so it persists when navigating away/back
               queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
                 ["messages", chatId],
                 (oldData) => {
                   if (!oldData || !oldData.messages) return oldData;
                   // Deduplicate against cache
                   if (oldData.messages.some(m => m.id === newMessage.id)) return oldData;
                   
                   const updatedMessages = [newMessage, ...oldData.messages];
                   // Prune to prevent memory issues
                   if (updatedMessages.length > MAX_CACHED_MESSAGES) {
                     updatedMessages.length = MAX_CACHED_MESSAGES;
                   }

                   return {
                     ...oldData,
                     messages: updatedMessages
                   };
                 }
               );
            }
          } catch (error) {
            console.error('[Realtime] Error fetching new message:', error);
            // Fallback
            queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
          }
        }
      )
      // Listen for message updates (edits) - SERVER-SIDE FILTER by chatId
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message',
          filter: `chatId=eq.${chatId}`, // Server-side filter
        },
        async (payload) => {
          console.log('[Realtime] Message updated:', payload.new.id);
          try {
            // Fetch full message details (including tags for Smart Threads)
            // IMPORTANT: Always fetch from API to get decrypted content
            const updatedMsg = await api.get<Message>(`/api/messages/${payload.new.id}`);
            if (updatedMsg) {
              setAllMessages(prev => prev.map(m =>
                m.id === payload.new.id ? updatedMsg : m
              ));
              
              // CRITICAL FIX: Update cache for persistence
              queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
                 ["messages", chatId],
                 (oldData) => {
                   if (!oldData || !oldData.messages) return oldData;
                   return {
                     ...oldData,
                     messages: oldData.messages.map(m => m.id === payload.new.id ? updatedMsg : m)
                   };
                 }
               );
            }
          } catch (error) {
            console.error('[Realtime] Error fetching updated message:', error);
            // Note: We intentionally do NOT use payload.new as fallback because
            // it contains encrypted content. The message will be updated on next fetch.
          }
        }
      )
      // Listen for message deletions - SERVER-SIDE FILTER by chatId
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message',
          filter: `chatId=eq.${chatId}`, // Server-side filter
        },
        (payload) => {
          console.log('[Realtime] Message deleted:', payload.old.id);
          setAllMessages(prev => prev.filter(m => m.id !== payload.old.id));
          
          // CRITICAL FIX: Update cache for persistence
          queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
             ["messages", chatId],
             (oldData) => {
               if (!oldData || !oldData.messages) return oldData;
               return {
                 ...oldData,
                 messages: oldData.messages.filter(m => m.id !== payload.old.id)
               };
             }
           );
        }
      )
      // Listen for reactions - SERVER-SIDE FILTER by chatId
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reaction',
          filter: `chatId=eq.${chatId}`, // Server-side filter
        },
        async (payload) => {
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
          filter: `chatId=eq.${chatId}`, // Server-side filter
        },
        async (payload) => {
           const msgId = payload.old.messageId;
           try {
             const updatedMsg = await api.get<Message>(`/api/messages/${msgId}`);
             if (updatedMsg) {
                setAllMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
             }
           } catch (e) { console.error(e); }
        }
      )
      // Listen for AI Friend changes - SERVER-SIDE FILTER by chatId
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_friend',
          filter: `chatId=eq.${chatId}`,
        },
        (payload) => {
          console.log('[Realtime] AI Friend changed:', payload);
          queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
        }
      )
      // Listen for typing broadcasts (replaces polling)
      .on(
        'broadcast',
        { event: 'typing' },
        (payload) => {
          const { userId: typerId, userName, isTyping, isAI, aiFriendId, aiFriendName, aiFriendColor } = payload.payload || {};
          
          // Handle AI typing
          if (isAI && aiFriendId) {
            if (isTyping) {
              setIsAITyping(true);
              setTypingAIFriend({
                id: aiFriendId,
                name: aiFriendName || 'AI Friend',
                color: aiFriendColor || '#14B8A6',
              } as AIFriend);
            } else {
              setIsAITyping(false);
              setTypingAIFriend(null);
            }
            return;
          }
          
          // Handle user typing - skip our own typing events
          if (typerId === user?.id) return;
          
          setTypingUsers(prev => {
            if (isTyping) {
              // Add typer if not already present
              if (!prev.some(t => t.id === typerId)) {
                return [...prev, { id: typerId, name: userName || 'Someone' }];
              }
              return prev;
            } else {
              // Remove typer
              return prev.filter(t => t.id !== typerId);
            }
          });
        }
      );

    // Store channel ref for sending typing broadcasts
    chatChannelRef.current = channel;

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
        
        // CRITICAL: Gap recovery on subscription success
        // This ensures we catch any messages that arrived between initial load and subscription
        // Get the most recent message timestamp from current state
        const currentMessages = queryClient.getQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(["messages", chatId]);
        const lastMsg = currentMessages?.messages?.[0];
        if (lastMsg?.createdAt) {
          console.log('[Realtime] Subscription established, checking for missed messages since:', lastMsg.createdAt);
          // Small delay to allow subscription to stabilize
          setTimeout(() => {
            recoverMissedMessages(lastMsg.createdAt);
          }, 100);
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
      chatChannelRef.current = null;
      supabaseClient.removeChannel(channel);
    };
  }, [chatId, queryClient, realtimeRetryCount, user?.id, recoverMissedMessages]);

  // Update messages state when data changes
  // IMPORTANT: We merge rather than replace to preserve optimistic messages
  useEffect(() => {
    if (messageData) {
      setAllMessages(prev => {
        const newMessages = messageData.messages || [];

        // If we have no previous messages, just use the new ones
        if (prev.length === 0) {
          return newMessages;
        }

        // Preserve any optimistic messages (they have IDs starting with 'optimistic-')
        const optimisticMessages = prev.filter(m => m.id.startsWith('optimistic-'));

        // CRITICAL FIX: Never blindly replace! Realtime adds messages beyond API pagination limit.
        // Instead, merge intelligently: update existing messages from API, keep realtime-only messages
        
        // Create a map of new messages by ID for O(1) lookup
        const newMessagesMap = new Map(newMessages.map(m => [m.id, m]));
        
        // Update existing messages with API data, preserving realtime-added messages not in API response
        const merged: Message[] = [];
        const processedIds = new Set<string>();
        
        // First, add all optimistic messages
        optimisticMessages.forEach(msg => {
          merged.push(msg);
          processedIds.add(msg.id);
        });
        
        // Then, iterate through previous messages and update with API data where available
        prev.forEach(msg => {
          if (processedIds.has(msg.id)) return; // Skip optimistic (already added)
          
          const apiVersion = newMessagesMap.get(msg.id);
          if (apiVersion) {
            // API has this message - use the API version (it's authoritative)
            merged.push(apiVersion);
            processedIds.add(msg.id);
          } else if (!msg.id.startsWith('optimistic-')) {
            // Realtime-only message not in API response (likely beyond pagination limit)
            // KEEP IT - don't discard realtime updates!
            merged.push(msg);
            processedIds.add(msg.id);
          }
        });
        
        // Finally, add any NEW messages from API that we don't have yet
        newMessages.forEach(msg => {
          if (!processedIds.has(msg.id)) {
            merged.push(msg);
            processedIds.add(msg.id);
          }
        });
        
        // Sort to maintain newest-first order (descending by createdAt)
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return merged;
      });
      setHasMoreMessages(messageData.hasMore || false);
      setNextCursor(messageData.nextCursor || null);
    }
  }, [messageData]);

  // Translate visible messages when translation is enabled or language changes
  useEffect(() => {
    if (translationEnabled && allMessages && allMessages.length > 0) {
      translateVisibleMessages(allMessages);
    }
  }, [translationEnabled, translationLanguage, allMessages.length]);

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

  // Use allMessages for main chat, allThreadMessages for threads
  const messages = currentThreadId ? allThreadMessages : allMessages;

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
      
      // Track keyboard state and dismiss if needed
      // Check if input is focused OR if we already marked it as open (to avoid overwriting with false due to delays)
      if (isInputFocused.current) {
        wasKeyboardOpenForImageGen.current = true;
        Keyboard.dismiss();
      }
      
      setIsGeneratorSheetOpen(true); // Explicitly open sheet
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

  // Define active messages based on thread view or main chat
  const activeMessages = useMemo(() => {
    if (currentThreadId) {
      // Use state variable which accumulates pagination results
      if (allThreadMessages.length > 0) {
        return allThreadMessages;
      }
      // While loading initial data, we can optionally show client-side matches if any
      if (isLoadingThreadMessages) {
          const currentThread = threads?.find(t => t.id === currentThreadId);
          if (currentThread && messages.length > 0) {
             const filtered = filterMessages(messages, currentThread);
             if (filtered.length > 0) return filtered;
          }
      }
      return [];
    }
    return messages;
  }, [currentThreadId, allThreadMessages, messages, threads, filterMessages, isLoadingThreadMessages]);

  // Handle pending scroll after context load
  const pendingScrollRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (pendingScrollRef.current && !isLoadingContext) {
      const targetId = pendingScrollRef.current;
      const index = activeMessages.findIndex(m => m.id === targetId);
      
      if (index !== -1) {
        console.log(`[ChatScreen] Pending scroll target ${targetId} now found, scrolling...`);
        // Clear ref first to prevent loops
        pendingScrollRef.current = null;
        setTimeout(() => {
          scrollToMessage(targetId);
        }, 300);
      }
    }
  }, [activeMessages, isLoadingContext]);

  // Scroll to message handler
  const scrollToMessage = useCallback((messageId: string) => {
    if (!activeMessages) return;
    
    const originalIndex = activeMessages.findIndex(msg => msg.id === messageId);
    
    if (originalIndex === -1) {
      console.log(`[ScrollToMessage] Message ${messageId} not found in active messages`);
      
      // If not found and not already loading, try to fetch context
      if (!isLoadingContext) {
        console.log(`[ScrollToMessage] Triggering context fetch for ${messageId}`);
        pendingScrollRef.current = messageId;
        loadMessageContext(messageId);
      }
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
  }, [activeMessages, isAITyping, typingUsers, currentThreadId, isLoadingContext, loadMessageContext]);

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
      // Don't fetch if no messages with content for context
      if (lastMessagesForSmartReply.length === 0) {
        return { replies: [] };
      }
      
      // mostRecentMessageIsFromOther is checked in `enabled`, but double-check here
      if (!mostRecentMessageIsFromOther) {
        return { replies: [] };
      }

      return api.post<SmartRepliesResponse>("/api/ai/smart-replies", {
        chatId,
        userId: user?.id,
        lastMessages: lastMessagesForSmartReply,
      });
    },
    // Only enable if the most recent message is from someone else (another user or AI)
    enabled: lastMessagesForSmartReply.length > 0 && mostRecentMessageIsFromOther,
    staleTime: 0, // Don't cache - always fetch fresh
    gcTime: 0, // Don't keep in garbage collection
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on failure - we want to see the error
  });

  const smartReplies = smartRepliesData?.replies || [];

  // Typing indicators are now handled via Supabase Realtime broadcast (see channel subscription above)
  // This eliminates 1-second polling that was causing 5000 req/sec at scale
  // AI typing is also broadcast from the backend when AI friends start/stop typing

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

      // Generate unique optimistic ID with timestamp
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Optimistically update to the new value
      if (previousData?.messages && user) {
        const optimisticMessage: Message = {
          id: optimisticId,
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
          metadata: { ...newMessage.metadata, _isPending: true }, // Mark as pending for UI
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

      // Return context with the previous data and optimistic ID for rollback
      return { previousData, optimisticId };
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
    onSuccess: (newMessage, _variables, context) => {
      // Get current allMessages state (NOT queryClient cache - it might be stale)
      setAllMessages(prev => {
        // Remove optimistic message and any duplicate of the new message
        const withoutOptimistic = prev.filter(m =>
          m.id !== context?.optimisticId &&
          !m.id.startsWith('optimistic-') &&
          m.id !== newMessage.id
        );
        
        // Add the new message at the front, preserving ALL other messages (including realtime-added ones)
        const updated = [newMessage, ...withoutOptimistic];
        
        return updated;
      });
      
      // Also update queryClient cache to keep it in sync
      const currentData = queryClient.getQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(["messages", chatId]);
      if (currentData?.messages) {
        const withoutOptimisticOrExisting = currentData.messages.filter(m =>
          m.id !== context?.optimisticId &&
          !m.id.startsWith('optimistic-') &&
          m.id !== newMessage.id
        );
        
        const updatedMessages = [newMessage, ...withoutOptimisticOrExisting];
        
        queryClient.setQueryData<{ messages: Message[], hasMore: boolean, nextCursor: string | null }>(
          ["messages", chatId],
          {
            messages: updatedMessages,
            hasMore: currentData.hasMore,
            nextCursor: currentData.nextCursor,
          }
        );
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
    // Note: Removed onSettled invalidation - it caused encrypted messages to briefly show
    // by triggering an unnecessary refetch after the optimistic update was already applied.
    // The realtime subscription handles keeping the cache in sync with the server.
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
    mutationFn: ({ messageId, ...data }: { messageId: string; content: string; [key: string]: any }) =>
      api.patch<Message>(`/api/messages/${messageId}`, {
        ...data,
        userId: user?.id,
      }),
    onSuccess: (updatedMessage) => {
      // Optimistically update the message in the list to avoid flicker
      if (currentThreadId) {
        setAllThreadMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg));
      } else {
        setAllMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg));
      }
      
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
      }, 300000); // 5 minute timeout

      return result;
    },
    onMutate: (data) => {
      // Immediately open preview modal with loading state
      console.log("[ChatScreen] ===== IMAGE GENERATION MUTATION STARTED =====");
      console.log("[ChatScreen] Setting previewImage state with generating placeholder");
      
      // Track keyboard state and dismiss if needed
      if (isInputFocused.current) {
        wasKeyboardOpenForImageGen.current = true;
        Keyboard.dismiss();
      }
      
      setIsGeneratorSheetOpen(true); // Explicitly open sheet
      console.log("[ChatScreen] Prompt:", data.prompt);

      setPreviewImage({
        imageUrl: '', // Empty triggers loading/shimmer state
        previewId: 'generating',
        prompt: data.prompt,
      });
      setOriginalPreviewPrompt(data.prompt);
      setPreviewType("image");
      
      console.log("[ChatScreen] previewImage state should now be set, sheet should appear");
    },
    onSuccess: (data) => {
      // Preview mode - show the preview modal
      if ('previewId' in data) {
        console.log("[ChatScreen] Image preview received:", data.previewId);
        console.log("[ChatScreen] Image URL:", (data as any).imageUrl);
        const previewData = data as ImagePreviewResponse;
        
        // Update the preview with the generated image
        // IMPORTANT: We use setPreviewImage to update the *existing* generating state
        // The sheet is already visible due to onMutate, this just replaces the "generating" placeholder
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
      
      // Close the preview modal on error immediately
      setPreviewImage(null);
      setIsGeneratorSheetOpen(false);
      
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
      setIsGeneratorSheetOpen(true); // Explicitly open sheet
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
        
        // Update the preview with the generated meme
        // IMPORTANT: We use setPreviewImage to update the *existing* generating state
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
        
        if (activeInput === "edit") {
          setEditSelectedImages(prev => [...prev, manipulatedImage.uri]);
          // Open edit modal again if it was closed? No, it should be open.
          // Focus might be lost but we are in modal.
        } else {
          setSelectedImages([manipulatedImage.uri]);
        }
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

        if (activeInput === "edit") {
          setEditSelectedImages(processedImages);
        } else {
          setSelectedImages(processedImages);
        }
        console.log(`Selected ${processedImages.length} image(s)`);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadImageAndSend = async () => {
    if (selectedImages.length === 0 || !user) return;

    const currentImages = [...selectedImages];
    const currentText = messageText.trim();
    const currentReplyTo = replyToMessage;
    
    // Create pending message ID
    const pendingId = `pending-${Date.now()}`;
    
    // Create pending message object
    const pendingMessage: PendingMessage = {
      id: pendingId,
      content: currentText,
      messageType: "image",
      imageUrl: currentImages[0], // Use local URI for preview
      userId: user.id,
      chatId: chatId,
      createdAt: new Date().toISOString(),
      user: user,
      isPending: true,
      isUploading: true,
      localUri: currentImages[0],
      replyTo: currentReplyTo ? { ...currentReplyTo } as Message : undefined,
      replyToId: currentReplyTo?.id,
      metadata: currentImages.length > 1 ? { mediaUrls: currentImages } : undefined,
      reactions: [],
      mentions: [],
    };

    // Add to pending uploads
    setPendingUploads(prev => [...prev, pendingMessage]);

    // Clear UI state immediately
    setSelectedImages([]);
    setMessageText("");
    clearDraftMessage();
    setReplyToMessage(null);
    setInputHeight(MIN_INPUT_HEIGHT);

    try {
      // Get auth token
      const token = await authClient.getToken();
      
      // Upload all selected images
      const uploadedUrls: string[] = [];
      
      for (const imageUri of currentImages) {
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

      // Remove from pending uploads
      setPendingUploads(prev => prev.filter(m => m.id !== pendingId));

      // Send message with image URL(s)
      // For multiple images, store URLs in metadata.mediaUrls
      // For single image, use imageUrl for backward compatibility
      if (uploadedUrls.length === 1) {
        await sendMessageMutation.mutateAsync({
          content: currentText,
          messageType: "image",
          imageUrl: uploadedUrls[0],
          replyToId: currentReplyTo?.id,
        });
      } else {
        // Multiple images - store in metadata
        await sendMessageMutation.mutateAsync({
          content: currentText,
          messageType: "image",
          imageUrl: uploadedUrls[0], // First image for thumbnail/preview
          metadata: { mediaUrls: uploadedUrls },
          replyToId: currentReplyTo?.id,
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload image");
      // Remove pending message on error
      setPendingUploads(prev => prev.filter(m => m.id !== pendingId));
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
        
        const videoData = {
          uri: pickedVideo.uri,
          duration: pickedVideo.duration ? Math.round(pickedVideo.duration / 1000) : undefined,
        };

        if (activeInput === "edit") {
          setEditSelectedVideo(videoData);
        } else {
          setSelectedVideo(videoData);
        }
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to pick video");
    }
  };

  const uploadVideoAndSend = async () => {
    if (!selectedVideo || !user) return;

    const currentVideo = { ...selectedVideo };
    const currentText = messageText.trim();
    const currentReplyTo = replyToMessage;
    
    // Create pending message ID
    const pendingId = `pending-video-${Date.now()}`;
    
    // Create pending message object
    const pendingMessage: PendingMessage = {
      id: pendingId,
      content: currentText,
      messageType: "video",
      userId: user.id,
      chatId: chatId,
      createdAt: new Date().toISOString(),
      user: user,
      isPending: true,
      isUploading: true,
      localUri: currentVideo.uri,
      replyTo: currentReplyTo ? { ...currentReplyTo } as Message : undefined,
      replyToId: currentReplyTo?.id,
      metadata: { 
        videoDuration: currentVideo.duration,
        localUri: currentVideo.uri
      },
      reactions: [],
      mentions: [],
    };

    // Add to pending uploads
    setPendingUploads(prev => [...prev, pendingMessage]);

    // Clear UI state
    setSelectedVideo(null);
    setMessageText("");
    clearDraftMessage();
    setReplyToMessage(null);
    setInputHeight(MIN_INPUT_HEIGHT);

    try {
      // Get auth token
      const token = await authClient.getToken();

      console.log("[ChatScreen] Uploading video:", currentVideo.uri);

      // Upload video
      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/upload/video`,
        currentVideo.uri,
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
          currentVideo.uri,
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

      // Remove pending message
      setPendingUploads(prev => prev.filter(m => m.id !== pendingId));

      // Send video message
      await sendMessageMutation.mutateAsync({
        content: currentText,
        messageType: "video",
        metadata: {
          videoUrl: uploadData.url,
          videoThumbnailUrl: thumbnailUrl,
          videoDuration: currentVideo.duration,
          localUri: currentVideo.uri
        },
        replyToId: currentReplyTo?.id,
      });

    } catch (error) {
      console.error("Error uploading video:", error);
      Alert.alert("Error", "Failed to upload video");
      setPendingUploads(prev => prev.filter(m => m.id !== pendingId));
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

    // Check for TLDR command (/tldr)
    if (trimmedMessage.startsWith("/tldr")) {
      const parts = trimmedMessage.split(" ");
      let limit = 25; // Default limit
      if (parts.length > 1) {
        const parsedLimit = parseInt(parts[1], 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = Math.min(parsedLimit, 100); // Max 100
        }
      }

      setMessageText(""); // Clear input immediately
      clearDraftMessage(); // Clear draft immediately
      setIsAITyping(false); // Don't use generic typing, use custom bubble
      
      const tldrLoadingId = `tldr-loading-${Date.now()}`;
      
      // Create temporary loading message
      const loadingMessage: Message = {
          id: tldrLoadingId,
          chatId: chatId,
          userId: "system", 
          content: "",
          messageType: "system",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: {
            id: "system",
            name: "TL;DR",
            phone: "",
            hasCompletedOnboarding: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            bio: null,
            image: null
          },
          metadata: { isTldr: true, isLoading: true } as any, 
          reactions: [],
          isUnsent: false,
      };

      // Determine thread context
      const threadId = currentThreadId; // Already in scope

      // Inject loading message
      if (threadId) {
        setAllThreadMessages(prev => [loadingMessage, ...prev]);
      } else {
        setAllMessages(prev => [loadingMessage, ...prev]);
      }

      try {
        const response = await api.post("/api/ai/tldr", {
          chatId,
          userId: user.id,
          threadId: threadId || null,
          limit,
        });
        
        // Create final local ephemeral message
        const tldrMessage: Message = {
          id: `tldr-${Date.now()}`,
          chatId: chatId,
          userId: "system", 
          content: response.content,
          messageType: "system",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: {
            id: "system",
            name: "TL;DR",
            phone: "",
            hasCompletedOnboarding: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            bio: null,
            image: null
          },
          metadata: { isTldr: true } as any, // Cast to match type if strict
          reactions: [],
          isUnsent: false,
      };

        // Replace loading message with real message
        if (threadId) {
          setAllThreadMessages(prev => [tldrMessage, ...prev.filter(m => m.id !== tldrLoadingId)]);
        } else {
          setAllMessages(prev => [tldrMessage, ...prev.filter(m => m.id !== tldrLoadingId)]);
        }

      } catch (error) {
        console.error("Failed to generate TLDR:", error);
        Alert.alert("Error", "Failed to generate summary. Please try again.");
        // Remove loading message
        if (threadId) {
          setAllThreadMessages(prev => prev.filter(m => m.id !== tldrLoadingId));
        } else {
          setAllMessages(prev => prev.filter(m => m.id !== tldrLoadingId));
        }
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

            // Track keyboard state BEFORE starting mutation (due to useReactor timeout)
            if (isInputFocused.current) {
              wasKeyboardOpenForImageGen.current = true;
              Keyboard.dismiss();
            }

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
          
          // Track keyboard state BEFORE starting mutation (due to useReactor timeout)
          if (isInputFocused.current) {
            wasKeyboardOpenForImageGen.current = true;
            Keyboard.dismiss();
          }

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
    setActiveInput("edit");
    
    // Initialize edit state
    setEditSelectedImages(
      message.metadata?.mediaUrls || (message.imageUrl ? [message.imageUrl] : [])
    );
    
    const videoUrl = message.metadata?.videoUrl || (message.messageType === 'video' ? message.videoUrl : null);
    setEditSelectedVideo(
      videoUrl
      ? { 
          uri: videoUrl, 
          duration: message.metadata?.videoDuration
        } 
      : null
    );
    
    // Initialize mentions
    const mentionedIds = message.mentions?.map(m => m.mentionedUserId) || [];
    setEditMentionedUserIds(mentionedIds);
  };

  // Handle edit message submission with attachments support
  const handleEditMessageSubmit = async () => {
    if (!editingMessage || (!editText.trim() && editSelectedImages.length === 0 && !editSelectedVideo) || !user) return;
    
    // Check if we have any pending uploads (local files)
    const localImages = editSelectedImages.filter(uri => !uri.startsWith("http"));
    const remoteImages = editSelectedImages.filter(uri => uri.startsWith("http"));
    
    // Check if video is local
    const isLocalVideo = editSelectedVideo?.uri && !editSelectedVideo.uri.startsWith("http");
    
    let finalImages = [...remoteImages];
    let finalVideoUrl = editSelectedVideo?.uri.startsWith("http") ? editSelectedVideo.uri : null;
    let finalVideoDuration = editSelectedVideo?.duration;
    
    try {
      const token = await authClient.getToken();
      
      // Upload new images
      for (const imageUri of localImages) {
         const uploadResult = await FileSystem.uploadAsync(
          `${BACKEND_URL}/api/upload/image`,
          imageUri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: "image",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );
        
        if (uploadResult.status === 200) {
           const uploadData = JSON.parse(uploadResult.body);
           if (uploadData.success && uploadData.url) {
             finalImages.push(uploadData.url);
           }
        }
      }
      
      // Upload video if local
      if (isLocalVideo && editSelectedVideo) {
         const uploadResult = await FileSystem.uploadAsync(
          `${BACKEND_URL}/api/upload/video`,
          editSelectedVideo.uri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: "video",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );
        
        if (uploadResult.status === 200) {
           const uploadData = JSON.parse(uploadResult.body);
           if (uploadData.success && uploadData.url) {
             finalVideoUrl = uploadData.url;
             if (uploadData.duration) finalVideoDuration = uploadData.duration;
           }
        }
      }
      
      // Construct payload
      const payload: any = {
        messageId: editingMessage.id,
        content: editText.trim(),
        userId: user.id,
        mentionedUserIds: editMentionedUserIds,
      };
      
      // Determine message type
      if (finalVideoUrl) {
        payload.messageType = "video";
        payload.videoUrl = finalVideoUrl;
        payload.metadata = {
          videoUrl: finalVideoUrl,
          videoDuration: finalVideoDuration,
        };
      } else if (finalImages.length > 0) {
        payload.messageType = "image";
        payload.imageUrl = finalImages[0];
        payload.metadata = { mediaUrls: finalImages };
      } else {
        payload.messageType = "text";
        payload.imageUrl = null;
        payload.metadata = null;
      }
      
      editMessageMutation.mutate(payload);
      
    } catch (error) {
      console.error("Error updating message:", error);
      Alert.alert("Error", "Failed to update message");
    }
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
      // Clear edit state
      setEditSelectedImages([]);
      setEditSelectedVideo(null);
      setEditMentionedUserIds([]);
      if (activeInput === "edit") {
        setActiveInput("main");
      }
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
      // Send typing indicator via broadcast if throttled (replaces polling)
      if (now - lastTypingSentAt.current > THROTTLE_MS) {
        lastTypingSentAt.current = now;
        // Use Supabase broadcast instead of HTTP POST - eliminates server load
        chatChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, userName: user.name, isTyping: true },
        });
      }

      // Set timeout to stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        chatChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, userName: user.name, isTyping: false },
        });
        lastTypingSentAt.current = 0; // Reset so next typing immediately sends indicator
      }, 3000);
    } else {
      // Stop typing indicator if text is empty
      chatChannelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, userName: user.name, isTyping: false },
      });
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
      // Track mentioned user in edit mode
      if (!editMentionedUserIds.includes(selectedUser.id)) {
        setEditMentionedUserIds([...editMentionedUserIds, selectedUser.id]);
      }
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
      // Track mentioned AI in edit mode
      if (!editMentionedUserIds.includes(aiFriend.id)) {
        setEditMentionedUserIds([...editMentionedUserIds, aiFriend.id]);
      }
    }
    
    setShowMentionPicker(false);
    setMentionSearch("");
    setMentionStartIndex(-1);
    
    console.log('[ChatScreen] AI friend mention inserted:', `@${aiFriend.name}`, '(ID:', aiFriend.id, ')');
  };

  // Clear typing indicator on unmount (via broadcast)
  useEffect(() => {
    return () => {
      if (user?.id && chatChannelRef.current) {
        chatChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, userName: user.name, isTyping: false },
        });
      }
    };
  }, [user?.id, user?.name]);

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
  
  // Handle keyboard opening - only scroll to bottom if already there
  const handleKeyboardOpen = useCallback(() => {
    if (isAtBottomRef.current) {
      scrollToBottom(false);
    }
  }, [scrollToBottom]);

  // Scroll to bottom when keyboard opens to show most recent messages
  const lastKeyboardHeight = useRef(0);
  useAnimatedReaction(
    () => keyboard.height.value,
    (currentHeight, previousHeight) => {
      // Keyboard just opened (went from 0 to positive)
      if (previousHeight === 0 && currentHeight > 0) {
        runOnJS(handleKeyboardOpen)();
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

  // Determine if send button should be shown
  const showSend = useMemo(() => {
    return !!(messageText.trim() || selectedImages.length > 0 || selectedVideo);
  }, [messageText, selectedImages.length, selectedVideo]);

  // Animate button icon transition with rotation
  useEffect(() => {
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
  }, [showSend]);

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
    isAIMessage ? "#14B8A6" : colors.text,
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
  const getItemType = useCallback((item: Message | { id: string; isTyping: true } | { id: string; isUserTyping: true; typingUsers: { id: string; name: string }[] } | DateDivider) => {
    if ('isDateDivider' in item) return 'date-divider';
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
    const rawData: (Message | { id: string; isTyping: true } | { id: string; isUserTyping: true; typingUsers: { id: string; name: string }[] })[] = [...activeMessages];

    // Add pending uploads (reversed because they are Newest -> Oldest in the list, but stored Oldest -> Newest in state)
    // Pending messages are newer than active messages, so they go to the front (bottom of inverted list)
    if (pendingUploads.length > 0) {
      rawData.unshift(...[...pendingUploads].reverse());
    }

    // Add AI typing indicator if AI is typing (only in main chat, not in threads)
    if (isAITyping && !currentThreadId) {
      rawData.unshift({ id: 'typing-indicator-ai', isTyping: true as const });
    }

    // Add user typing indicator if users are typing (only in main chat, not in threads)
    if (typingUsers.length > 0 && !currentThreadId) {
      rawData.unshift({ id: 'typing-indicator-users', isUserTyping: true as const, typingUsers });
    }

    const dataWithDividers: (typeof rawData[0] | DateDivider)[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      dataWithDividers.push(item);

      // Skip processing for typing indicators
      if ('isTyping' in item || 'isUserTyping' in item) {
        continue;
      }

      const currentMessage = item as Message;
      const nextItem = rawData[i + 1];

      // If this is the last item (oldest message), always add a date divider
      if (!nextItem) {
        dataWithDividers.push({
          id: `date-divider-${currentMessage.id}`,
          isDateDivider: true,
          date: new Date(currentMessage.createdAt)
        });
        continue;
      }

      // If next item is a message, check if we need a divider
      if (!('isTyping' in nextItem) && !('isUserTyping' in nextItem)) {
        const nextMessage = nextItem as Message;
        const currentDate = new Date(currentMessage.createdAt);
        const nextDate = new Date(nextMessage.createdAt);

        if (!isSameDay(currentDate, nextDate)) {
          dataWithDividers.push({
            id: `date-divider-${currentMessage.id}`,
            isDateDivider: true,
            date: currentDate
          });
        }
      }
    }

    return dataWithDividers;
  }, [activeMessages, isAITyping, currentThreadId, typingUsers, pendingUploads]);

  const renderMessage = useCallback(({ item, index }: { item: Message | { id: string; isTyping: true } | { id: string; isUserTyping: true; typingUsers: { id: string; name: string }[] } | DateDivider; index: number }) => {
    // Check if this is a date divider
    if ('isDateDivider' in item) {
      let dateText = '';
      if (isToday(item.date)) {
        dateText = 'Today';
      } else if (isYesterday(item.date)) {
        dateText = 'Yesterday';
      } else {
        dateText = format(item.date, 'EEE, MMM d'); // Mon, Dec 10
      }
      
      return (
        <View style={{ alignItems: 'center', marginVertical: 16 }}>
           <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
             {dateText}
           </Text>
        </View>
      );
    }

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
    // Cast to PendingMessage to access local state
    const pendingMsg = message as PendingMessage;
    const isPending = pendingMsg.isPending;
    const isUploading = pendingMsg.isUploading;
    const localUri = pendingMsg.localUri;
    
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
      !('isDateDivider' in prevMessage) &&
      (prevMessage as Message).messageType !== 'system' &&
      (prevMessage as Message).userId !== 'system' &&
      (prevMessage as Message).userId === message.userId && 
      ((prevMessage as Message).userId !== null || (prevMessage as Message).aiFriendId === message.aiFriendId);

    // Check if next message is from same sender
    const isSameUserAsNewer = nextMessage && 
      !('isTyping' in nextMessage) && 
      !('isUserTyping' in nextMessage) && 
      !('isDateDivider' in nextMessage) &&
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

    // Debug voice messages - REMOVED


    // Render system messages (like "X joined the chat")
    if (isSystem) {
      // Check for TLDR message
      if ((message.metadata as any)?.isTldr) {
        // If it's a loading state (content is empty or specific loading marker)
        const isLoading = (message.metadata as any)?.isLoading;
        
        return (
          <View style={{ marginVertical: 8, paddingHorizontal: 16 }}>
            <View style={{
              backgroundColor: isDark ? "rgba(142, 142, 147, 0.15)" : "rgba(142, 142, 147, 0.08)",
              borderRadius: 16,
              padding: 12,
              borderWidth: 1,
              borderColor: isDark ? "rgba(142, 142, 147, 0.3)" : "rgba(142, 142, 147, 0.2)",
              alignSelf: "stretch",
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#9D4EDD', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={14} color="#FFF" />
                </View>
                <Text style={{
                  color: isDark ? "#8E8E93" : "#6D6D72",
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5
                }}>
                  TL;DR Summary
                </Text>
              </View>
              {isLoading ? (
                 <View style={{ paddingVertical: 12 }}>
                    <ShimmeringText 
                      text="Reading conversation..." 
                      style={{ 
                        color: isDark ? '#B0B0B0' : '#636366',
                        fontSize: 14, 
                        fontStyle: "italic",
                        fontWeight: "500"
                      }}
                      shimmerColor={isDark ? "#FFFFFF" : "#000000"} // Theme-aware shimmer
                      duration={1200} // Faster
                    />
                 </View>
              ) : (
                <MessageText 
                  content={message.content} 
                  style={{ color: isDark ? '#E0E0E0' : '#1C1C1E' }}
                  isOwnMessage={false}
                />
              )}
            </View>
          </View>
        );
      }

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
                    color: colors.textSecondary,
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
              backgroundColor: isDark ? "rgba(142, 142, 147, 0.15)" : "rgba(142, 142, 147, 0.08)",
              borderWidth: 1,
              borderColor: isDark ? "rgba(142, 142, 147, 0.3)" : "rgba(142, 142, 147, 0.2)",
            }}
          >
            <Text
              style={{
                color: isDark ? "#8E8E93" : "#6D6D72",
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
            <Text style={{ fontSize: 15, color: isDark ? "#8E8E93" : "#6D6D72", fontStyle: "italic" }}>
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
      // Using hex colors for consistency (allows appending opacity suffix)
      const bubbleStyle = vibeConfig
        ? {
            backgroundColor: `${vibeConfig.color}20`, // 12% opacity
            borderColor: vibeConfig.color,
            shadowColor: vibeConfig.color,
          }
        : isCurrentUser
        ? {
            backgroundColor: isDark ? "rgba(0, 122, 255, 0.15)" : "rgba(0, 122, 255, 0.12)",
            borderColor: colors.primary,
            shadowColor: colors.primary,
          }
        : isAI
        ? {
            backgroundColor: `${aiColor}26`, // 15% opacity in hex
            borderColor: aiColor, // Use exact AI color (teal) for border
            shadowColor: aiColor,
          }
        : {
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.06)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.15)",
            shadowColor: isDark ? "#000" : "rgba(0, 0, 0, 0.1)",
          };

      const bubbleContent = (
        <GlowMessageWrapper 
          isHighlighted={highlightedMessageId === message.id} 
          color={isCurrentUser ? colors.primary : (isAI ? aiColor : (vibeConfig?.color || colors.primary))}
        >
          <View
            style={{
              // Shadow container - subtle glow effect
              ...borderRadiusStyle,
              shadowColor: bubbleStyle.shadowColor,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 2,
              ...(isHighlighted && {
                shadowColor: "#FFD700",
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 4,
              }),
            }}
          >
            {/* Clip container - handles overflow clipping with border radius */}
            <View
              style={{
                ...borderRadiusStyle,
                overflow: "hidden",
                // Very subtle border - vibes get more prominent border
                borderWidth: isHighlighted ? 2 : vibeConfig ? 1 : 0.5,
                borderColor: isHighlighted 
                  ? "#FFD700" 
                  : vibeConfig
                    ? `${vibeConfig.color}60` // 38% opacity for vibes
                    : isCurrentUser 
                      ? colors.primary + "4D"
                      : isAI 
                        ? "rgba(20, 184, 166, 0.3)" 
                        : isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)",
              }}
            >
            {/* Liquid Glass Background */}
            <BlurView
              intensity={Platform.OS === "ios" ? 40 : 80}
              tint={colors.blurTint}
              style={{
                backgroundColor: isHighlighted ? "rgba(255, 215, 0, 0.1)" : undefined,
              }}
            >
              <LinearGradient
                colors={
                  vibeConfig
                    ? vibeConfig.gradient
                    : isCurrentUser
                    ? isDark 
                      ? ["rgba(0, 122, 255, 0.25)", "rgba(0, 122, 255, 0.15)", "rgba(0, 122, 255, 0.08)"]
                      : ["rgba(0, 122, 255, 0.18)", "rgba(0, 122, 255, 0.10)", "rgba(0, 122, 255, 0.05)"]
                    : isAI
                    ? [
                        "rgba(20, 184, 166, 0.25)",
                        "rgba(20, 184, 166, 0.15)",
                        "rgba(20, 184, 166, 0.08)",
                      ]
                    : isDark
                      ? ["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.10)", "rgba(255, 255, 255, 0.05)"]
                      : ["rgba(0, 0, 0, 0.06)", "rgba(0, 0, 0, 0.04)", "rgba(0, 0, 0, 0.02)"]
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
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      gap: 4,
                    }}>
                    <Text style={{
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      fontSize: 11,
                      color: colors.textSecondary,
                      fontWeight: '600',
                    }}>
                      {metadata.slashCommand.command}
                    </Text>
                    {metadata.slashCommand.prompt && (
                      <Text 
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
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
                transcription={message.voiceTranscription}
              />
            </View>
          ) : /* Video Message */ isVideo && (metadata?.videoUrl || localUri) ? (
            <View style={{ width: 270 }}>
              <View style={{ position: 'relative' }}>
                <VideoPlayer
                  videoUrl={localUri || getFullImageUrl(metadata?.videoUrl)}
                  thumbnailUrl={metadata?.videoThumbnailUrl ? getFullImageUrl(metadata.videoThumbnailUrl) : null}
                  duration={metadata?.videoDuration}
                  containerWidth={270}
                  borderRadius={0}
                />
                {/* Uploading Overlay for Video */}
                {isUploading && (
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    zIndex: 10,
                  }}>
                    <View style={{
                      padding: 12,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 24,
                    }}>
                      <ActivityIndicator size="small" color={colors.text} />
                    </View>
                  </View>
                )}
              </View>
              {/* Caption if exists - HIGH-14: Reduced padding for density */}
              {message.content && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                  <TruncatedText
                    maxLines={20}
                    lineHeight={20}
                    expandButtonColor={isCurrentUser ? colors.primary : colors.text}
                  >
                    <MessageText
                      content={translationEnabled && translatedMessages.has(message.id) 
                        ? translatedMessages.get(message.id)! 
                        : message.content}
                      mentions={message.mentions}
                      style={{ fontSize: 15, color: colors.text, lineHeight: 20 }}
                      isOwnMessage={isCurrentUser}
                    />
                  </TruncatedText>
                </View>
              )}
            </View>
          ) : /* Multi-Image Carousel */ hasMultipleImages ? (
            <View style={{ width: 270 }}>
              <View style={{ position: 'relative' }}>
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
                {isUploading && (
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}>
                    <ActivityIndicator size="large" color={colors.text} />
                  </View>
                )}
              </View>
              {/* Caption if exists - HIGH-14: Reduced padding for density */}
              {message.content && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                  <TruncatedText
                    maxLines={20}
                    lineHeight={20}
                    expandButtonColor={isCurrentUser ? colors.primary : colors.text}
                  >
                    <MessageText
                      content={translationEnabled && translatedMessages.has(message.id) 
                        ? translatedMessages.get(message.id)! 
                        : message.content}
                      mentions={message.mentions}
                      style={{ fontSize: 15, color: colors.text, lineHeight: 20 }}
                      isOwnMessage={isCurrentUser}
                    />
                  </TruncatedText>
                </View>
              )}
            </View>
          ) : /* Single Image Message */ isImage && (message.imageUrl || localUri) ? (
            <View style={{ width: 270 }}>
              <Pressable
                onPress={() => {
                  if (imageSelectionMode) {
                    toggleImageSelection(message.id);
                  } else {
                    setViewerImage({
                      url: localUri || message.imageUrl!,
                      senderName: message.user?.name || "Unknown",
                      timestamp: new Date(message.createdAt).toLocaleString(),
                      messageId: message.id,
                      caption: message.content,
                      isOwnMessage: isCurrentUser,
                    });
                  }
                }}
              >
                <View style={{ width: 270, height: 288, position: "relative", overflow: "hidden" }}>
                  {/* Placeholder - only show while loading remote image */}
                  {!localUri && loadingImageIds.has(message.id) && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: colors.inputBackground,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <LuxeLogoLoader size="large" />
                    </View>
                  )}
                  {/* Actual Image */}
                  <Image
                    key={`${message.id}-${localUri || message.imageUrl}`}
                    source={{ uri: localUri || (() => {
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
                      if (!localUri) {
                        console.log(`[ChatScreen] Image load started for message ${message.id}`);
                        setLoadingImageIds(prev => new Set(prev).add(message.id));
                      }
                    }}
                    onLoad={() => {
                      if (!localUri) {
                        console.log(`[ChatScreen] Image loaded successfully for message ${message.id}`);
                        setLoadingImageIds(prev => {
                          const next = new Set(prev);
                          next.delete(message.id);
                          return next;
                        });
                      }
                    }}
                    onError={(error) => {
                      if (!localUri) {
                        console.error(`[ChatScreen] Image load error for message ${message.id}:`);
                        setLoadingImageIds(prev => {
                          const next = new Set(prev);
                          next.delete(message.id);
                          return next;
                        });
                      }
                    }}
                  />

                  {/* Uploading Overlay */}
                  {isUploading && (
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      zIndex: 10
                    }}>
                      <ActivityIndicator size="large" color={colors.text} />
                    </View>
                  )}

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
                        borderColor: colors.text,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedImageMessageIds.has(message.id) && (
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "bold" }}>✓</Text>
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
                    expandButtonColor={isCurrentUser ? colors.primary : colors.text}
                  >
                    <MessageText
                      content={translationEnabled && translatedMessages.has(message.id) 
                        ? translatedMessages.get(message.id)! 
                        : message.content}
                      mentions={message.mentions}
                      style={{ fontSize: 15, color: colors.text, lineHeight: 20 }}
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
                          rules={{
                            list_item: (node: any, children: any, parent: any, styles: any) => {
                              const isOrdered = parent?.tag === 'ordered_list';
                              const index = parent?.children?.findIndex((n: any) => n === node) || 0;
                              
                              return (
                                <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                                  <Text style={[styles.text, { fontWeight: 'bold', marginRight: 8, minWidth: isOrdered ? 16 : 8 }]}>
                                    {isOrdered ? `${index + 1}.` : '•'}
                                  </Text>
                                  <View style={{ flexShrink: 1 }}>
                                    {children}
                                  </View>
                                </View>
                              );
                            }
                          }}
                          style={{
                            body: { color: colors.text, fontSize: 15.5, lineHeight: 20 },
                            heading1: { color: colors.text, fontSize: 22, fontWeight: "bold", marginBottom: 6 },
                            heading2: { color: colors.text, fontSize: 20, fontWeight: "bold", marginBottom: 5 },
                            heading3: { color: colors.text, fontSize: 18, fontWeight: "bold", marginBottom: 4 },
                            heading4: { color: colors.text, fontSize: 17, fontWeight: "bold", marginBottom: 3 },
                            heading5: { color: colors.text, fontSize: 16, fontWeight: "bold", marginBottom: 2 },
                            heading6: { color: colors.text, fontSize: 15.5, fontWeight: "bold", marginBottom: 2 },
                            strong: { fontWeight: "bold", color: colors.text },
                            em: { fontStyle: "italic", color: colors.text },
                            link: { color: "#14B8A6", textDecorationLine: "underline" },
                            blockquote: {
                              backgroundColor: colors.inputBackground,
                              borderLeftWidth: 3,
                              borderLeftColor: "#14B8A6",
                              paddingLeft: 10,
                              paddingVertical: 8,
                              marginVertical: 8
                            },
                            code_inline: {
                              backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.08)",
                              color: "#14B8A6",
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
                            },
                            code_block: {
                              backgroundColor: "rgba(0, 0, 0, 0.3)",
                              color: colors.text,
                              padding: 12,
                              borderRadius: 8,
                              marginVertical: 8,
                              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
                            },
                            fence: {
                              backgroundColor: "rgba(0, 0, 0, 0.3)",
                              color: colors.text,
                              padding: 12,
                              borderRadius: 8,
                              marginVertical: 8,
                              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
                            },
                            bullet_list: { marginVertical: 8, paddingLeft: 8 },
                            ordered_list: { marginVertical: 8, paddingLeft: 8 },
                            list_item: { 
                              marginVertical: 4,
                            },
                            paragraph: { color: colors.text, fontSize: 15.5, lineHeight: 20, marginVertical: 3 },
                            text: { color: colors.text, fontSize: 15.5 },
                            hr: { backgroundColor: "rgba(255, 255, 255, 0.2)", height: 1, marginVertical: 10 },
                          }}
                        >
                          {translationEnabled && translatedMessages.has(message.id) 
                            ? translatedMessages.get(message.id)! 
                            : message.content}
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
                          content={translationEnabled && translatedMessages.has(message.id) 
                            ? translatedMessages.get(message.id)! 
                            : message.content}
                          mentions={message.mentions}
                          style={{ fontSize: 15, color: colors.text, lineHeight: 20 }}
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
              
              {/* Proactive AI Suggestion Card */}
              {(message.metadata as any)?.suggestion && (
                <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                  <SuggestionCard
                    type={(message.metadata as any).suggestion.type}
                    data={(message.metadata as any).suggestion.data}
                    onAccept={() => {
                      if ((message.metadata as any).suggestion.type === "poll") {
                        setSuggestionPollData((message.metadata as any).suggestion.data);
                        setShowCreatePoll(true);
                      } else {
                        setSuggestionEventData((message.metadata as any).suggestion.data);
                        setShowCreateEvent(true);
                      }
                    }}
                    onReject={() => {
                      // Optional: Hide suggestion
                    }}
                  />
                </View>
              )}
            </>
          )}
            </LinearGradient>
          </BlurView>
          </View>
        </View>
        </GlowMessageWrapper>
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
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "bold" }}>✓</Text>
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
            // Placeholder to maintain alignment when avatar is hidden (34px matches ProfileImage default)
            <View style={{ width: 34, height: 34, marginRight: 8 }} />
          )
        )}

        {/* Message Content */}
        <View style={{ flex: 1, alignItems: isCurrentUser ? "flex-end" : "flex-start" }}>
          {/* Name - only show on first message of group */}
          {!isCurrentUser && showName && (
            <Text
              className="text-xs font-medium mb-1 ml-2"
              style={{ color: isAI ? aiColor : colors.textSecondary, fontSize: 13, fontWeight: isAI ? "600" : "500" }}
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
                  collapsable={false}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    marginLeft: isCurrentUser ? 0 : 4,
                    marginRight: isCurrentUser ? 4 : 0,
                    marginBottom: 4,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                    borderLeftWidth: 3,
                    borderLeftColor: isCurrentUser ? colors.primary : colors.textSecondary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    maxWidth: "100%",
                    alignSelf: isCurrentUser ? "flex-end" : "flex-start",
                    zIndex: 50, // Ensure it sits above message bubble for touch handling
                  }}
                >
                  <View pointerEvents="none" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: isCurrentUser ? colors.primary : colors.textSecondary, fontWeight: "600" }} numberOfLines={1}>
                      {replyToMessage?.aiFriendId
                        ? (replyToMessage?.aiFriend?.name || aiFriends.find(f => f.id === replyToMessage?.aiFriendId)?.name || "AI Friend")
                        : (replyToMessage?.user?.name || "Unknown User")}
                    </Text>
                    
                    {replyToMessage?.messageType === "image" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        {replyToMessage?.imageUrl && (
                          <Image
                            key={`reply-${replyToMessage.id}-${replyToMessage.imageUrl}`}
                            source={{ uri: getFullImageUrl(replyToMessage.imageUrl) }}
                            style={{ width: 36, height: 36, borderRadius: 6, marginRight: 6 }}
                            contentFit="cover"
                          />
                        )}
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>Photo</Text>
                      </View>
                    ) : (
                      <Text
                        style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}
                        numberOfLines={1}
                      >
                        {replyToMessage?.content}
                      </Text>
                    )}
                  </View>
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
              {(() => {
                const bubbleTap = Gesture.Tap()
                  .maxDuration(250)
                  .onEnd(() => {
                    if (selectionMode) {
                      runOnJS(toggleMessageSelection)(message.id);
                    }
                  });

                const bubbleLongPress = Gesture.LongPress()
                  .minDuration(400)
                  .maxDistance(20)
                  .onStart(() => {
                    if (!selectionMode) {
                      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
                      runOnJS(handleLongPress)(message);
                    }
                  });
                
                // Compose gestures: wait for long press to fail before tap, or trigger long press
                const bubbleGesture = Gesture.Exclusive(bubbleLongPress, bubbleTap);

                return (
                  <GestureDetector gesture={bubbleGesture}>
                    <MessageBubbleMeasurer collapsable={false} hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                      {renderMessageContent()}
                    </MessageBubbleMeasurer>
                  </GestureDetector>
                );
              })()}
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
                        backgroundColor: isDark ? "rgba(40, 40, 40, 1)" : "rgba(240, 240, 240, 1)",
                        borderWidth: 1,
                        borderColor: userReacted ? colors.primary : colors.border,
                          marginRight: 6,
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ fontSize: 15 }}>{emoji}</Text>
                        {count > 1 && (
                          <Text
                            style={{
                              fontSize: 13,
                              color: userReacted ? colors.primary : colors.text,
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
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <LuxeLogoLoader size="large" />
      </View>
    );
  }
  
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

  // Debug logging for previewImage state - REMOVED


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          colors={isDark ? [
            "#000000",
            "#0A0A0F",
            "#050508",
            "#000000",
          ] : [
            colors.background,
            colors.backgroundSecondary,
            colors.surfaceSecondary,
            colors.background,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        {/* Subtle animated overlay for depth */}
        <LinearGradient
          colors={isDark ? [
            "rgba(79, 195, 247, 0.03)",
            "rgba(0, 122, 255, 0.02)",
            "transparent",
            "rgba(52, 199, 89, 0.02)",
          ] : [
            "rgba(79, 195, 247, 0.02)",
            "rgba(0, 122, 255, 0.01)",
            "transparent",
            "rgba(52, 199, 89, 0.01)",
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
      
      {/* Custom Chat Header or Search Header */}
      {showSearchModal ? (
        <SearchHeader
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onClose={() => {
            setShowSearchModal(false);
            setSearchQuery("");
          }}
          insets={insets}
          colors={colors}
          isDark={isDark}
        />
      ) : (
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
          onJoinVoiceRoom={handleJoinRoom}
          onTranslatePress={() => setShowTranslationModal(true)}
        />
      )}

      {/* Search Results Overlay */}
      {showSearchModal && (
        <View style={{ position: 'absolute', top: 70 + insets.top, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 99 }}>
            {isSearchingBackend ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <LuxeLogoLoader size="large" />
                    <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 15, fontWeight: "500" }}>
                        Searching messages...
                    </Text>
                </View>
            ) : (!searchResults || searchResults.messages.length === 0) ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textSecondary, textAlign: "center" }}>
                        {debouncedSearchQuery ? "No results found" : "Search in conversation"}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={searchResults.messages}
                    keyExtractor={(item) => item.message.id}
                    renderItem={({ item }) => (
                        <SearchResultItem
                            item={item}
                            onPress={handleSearchResultPress}
                            searchQuery={debouncedSearchQuery}
                            colors={colors}
                            isDark={isDark}
                        />
                    )}
                    contentContainerStyle={{ paddingVertical: 16 }}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                />
            )}
        </View>
      )}

      {/* Smart Threads Tabs - Always show to display Main Chat pill and + button */}
      {threads && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 85,
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

      {/* Voice Room Banner - Shows when there's an active call */}
      {activeRoom && !voiceModalVisible && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 85 + (threads ? 56 : 0),
            left: 0,
            right: 0,
            zIndex: 98,
          }}
        >
          <VoiceRoomBanner
            participantCount={participants}
            onJoinPress={handleJoinRoom}
            isUserInCall={!!voiceToken}
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
            // Padding bottom creates space for header/threads/voice banner
            paddingBottom: insets.top + 68 + (threads ? 56 : 0) + (activeRoom && !voiceModalVisible ? 56 : 0) + 20, // Add 56px for banner when visible
            paddingHorizontal: 16,
            // Visual bottom - small padding to push recent messages up slightly
            paddingTop: 13, 
          }}
          // Spacer for Input Bar (Glassmorphism effect)
          // Dynamic height: 95px default, 120px when smart replies are showing
          ListHeaderComponent={<View style={{ height: previewImage ? 140 : (areSmartRepliesVisible ? 120 : 95) }} />}
          // HIGH-8: Load earlier messages button (appears at top in inverted list)
          ListFooterComponent={
            (currentThreadId ? threadHasMore : hasMoreMessages) ? (
              <TouchableOpacity
                onPress={currentThreadId ? loadMoreThreadMessages : loadMoreMessages}
                disabled={currentThreadId ? isLoadingMoreThread : isLoadingMore}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                {(currentThreadId ? isLoadingMoreThread : isLoadingMore) ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
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
              {(isLoading || (currentThreadId && isLoadingThreadMessages)) ? (
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
                              <Sparkles size={17} color={colors.text} strokeWidth={2.5} style={{ marginRight: 8 }} />
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
          tint={colors.blurTint}
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
        {showMentionPicker && activeInput === "main" && (
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
          style={{ width: "100%", backgroundColor: 'transparent', overflow: 'visible' }}
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
          onLayout={(e) => setChatInputHeight(e.nativeEvent.layout.height)}
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
                      tint={colors.blurTint}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: colors.primary + "4D",
                        borderRadius: 20,
                      }}
                    >
                      <LinearGradient
                        colors={isDark ? ["rgba(0, 122, 255, 0.15)", "rgba(0, 122, 255, 0.05)"] : [colors.primary + "26", colors.primary + "0D"]}
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
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
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
                      backgroundColor: colors.inputBackground,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.primary,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>
                    Replying to {replyToMessage.aiFriendId 
                      ? (replyToMessage.aiFriend?.name || aiFriends.find(f => f.id === replyToMessage.aiFriendId)?.name || "AI Friend")
                      : (replyToMessage.user?.name || "Unknown User")}
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: colors.text, marginTop: 2 }}
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
                    backgroundColor: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} color={colors.text} />
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
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
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
                      <X size={16} color={colors.text} />
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
                    key={`selected-${index}-${imageUri}`}
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
                        key={`preview-${index}-${imageUri}`}
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
                        <X size={16} color={colors.text} />
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
                  <View style={{ position: "relative", width: 120, height: 160, backgroundColor: isDark ? "#1C1C1E" : "#E5E5EA" }}>
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
                      <X size={16} color={colors.text} />
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
              <Reanimated.View className="flex-row items-end gap-3" style={[inputRowAnimatedStyle, { zIndex: 50, elevation: 5 }]}>
                {/* Image Generation Docked Pill - Floats above input */}
                <View style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, alignItems: 'center', zIndex: 100, paddingBottom: 24 }} pointerEvents="box-none">
                  <ImageGenerationPill
                    isVisible={!!previewImage && !isGeneratorSheetOpen}
                    isProcessing={isConfirmingImage || isEditingImage || generateImageMutation.isPending || generateMemeMutation.isPending || isReactorProcessing}
                    onPress={() => {
                      // Track keyboard state and dismiss if needed
                      wasKeyboardOpenForImageGen.current = isInputFocused.current;
                      if (isInputFocused.current) {
                        Keyboard.dismiss();
                      }
                      setIsGeneratorSheetOpen(true);
                    }}
                    style={{ position: 'relative', bottom: 0 }} // Override absolute positioning and bottom offset
                  />
                </View>

              {/* Attachments menu button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Track if keyboard was open and dismiss it if needed
                  wasKeyboardOpenForAttachments.current = isInputFocused.current;
                  if (isInputFocused.current) {
                    Keyboard.dismiss();
                  }
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
                    <Plus size={20} color={colors.text} />
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
                      backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7", // Theme-aware background
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
                    value={messageText}
                    onChangeText={handleTyping}
                    placeholder={selectedImages.length > 0 || selectedVideo ? "Add a caption (optional)" : "Message"}
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
                    // HIGH-11: Increased character limit with UI feedback
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
                          ? colors.error + "33"
                          : colors.inputBackground,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: messageText.length > 3800 
                            ? colors.error 
                            : colors.textTertiary,
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
                      tint={colors.blurTint}
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
                            <Mic size={20} color={colors.text} />
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
                            <ArrowUp size={20} color={colors.text} strokeWidth={2.5} />
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
            behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                  backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
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
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)",
                      borderRadius: 2.5,
                    }}
                  />
                </View>

                <View style={{ padding: 20, paddingTop: 8, paddingBottom: insets.bottom + 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>Edit Message</Text>
                    <Pressable onPress={() => setEditingMessage(null)}>
                      <X size={24} color={colors.text} />
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

                  {/* Attachment Previews */}
                  {(editSelectedImages.length > 0 || editSelectedVideo) && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {editSelectedImages.map((uri, index) => (
                        <View key={index} style={{ marginRight: 8, position: "relative" }}>
                          <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                          <TouchableOpacity 
                            style={{ position: "absolute", top: -6, right: -6, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 10, padding: 2 }}
                            onPress={() => setEditSelectedImages(prev => prev.filter((_, i) => i !== index))}
                          >
                            <X size={14} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {editSelectedVideo && (
                        <View style={{ marginRight: 8, position: "relative" }}>
                           <View style={{ width: 80, height: 80, borderRadius: 12, overflow: "hidden", backgroundColor: "black" }}>
                             <Video 
                               source={{ uri: editSelectedVideo.uri }} 
                               style={{ width: "100%", height: "100%" }} 
                               resizeMode={ResizeMode.COVER} 
                               shouldPlay={false}
                             />
                             <View style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 4, borderRadius: 4 }}>
                               <Text style={{ color: "white", fontSize: 10 }}>
                                 {editSelectedVideo.duration ? `${Math.floor(editSelectedVideo.duration / 60)}:${(editSelectedVideo.duration % 60).toString().padStart(2, '0')}` : "VIDEO"}
                               </Text>
                             </View>
                           </View>
                           <TouchableOpacity 
                            style={{ position: "absolute", top: -6, right: -6, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 10, padding: 2 }}
                            onPress={() => setEditSelectedVideo(null)}
                          >
                            <X size={14} color="white" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </ScrollView>
                  )}

                  {/* Input Row */}
                  <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 16 }}>
                    <TouchableOpacity 
                      onPress={() => setShowAttachmentsMenu(true)}
                      style={{ padding: 10, marginRight: 8, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", borderRadius: 12 }}
                    >
                      <Plus color={colors.text} size={24} />
                    </TouchableOpacity>

                    <TextInput
                      value={editText}
                      onChangeText={handleEditTyping}
                      multiline
                      autoFocus
                      keyboardAppearance={isDark ? "dark" : "light"}
                      style={{
                        flex: 1,
                        backgroundColor: colors.inputBackground,
                        borderRadius: 12,
                        padding: 12,
                        color: colors.text,
                        fontSize: 16,
                        minHeight: 40,
                        maxHeight: 150,
                      }}
                      placeholder="Edit your message..."
                      placeholderTextColor={colors.inputPlaceholder}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable
                      onPress={() => setEditingMessage(null)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.inputBackground,
                        borderRadius: 12,
                        padding: 16,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      onPress={handleEditMessageSubmit}
                      disabled={!editText.trim() && editSelectedImages.length === 0 && !editSelectedVideo || editMessageMutation.isPending}
                      style={{
                        flex: 1,
                        backgroundColor: (editText.trim() || editSelectedImages.length > 0 || editSelectedVideo) ? "#007AFF" : "rgba(0, 122, 255, 0.3)",
                        borderRadius: 12,
                        padding: 16,
                        alignItems: "center",
                      }}
                    >
                      {editMessageMutation.isPending ? (
                        <LuxeLogoLoader size={20} />
                      ) : (
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Save</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
              
              {/* Attachments Menu Inside Modal */}
              <AttachmentsMenu
                visible={showAttachmentsMenu}
                onClose={() => setShowAttachmentsMenu(false)}
                onTakePhoto={takePhoto}
                onPickImage={pickImage}
                onPickVideo={pickVideo}
                onSelectCommand={(cmd) => setEditText(prev => prev + cmd + " ")}
                onCreateCommand={() => {
                  setShowAttachmentsMenu(false);
                  setTimeout(() => setShowCreateCustomCommand(true), 300);
                }}
                onCreatePoll={() => {
                   setShowAttachmentsMenu(false);
                   setTimeout(() => setShowCreatePoll(true), 300);
                }}
                onOpenSettings={() => {
                  navigation.navigate("GroupSettings", { chatId });
                }}
                customCommands={customCommands}
              />
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
                <X size={24} color={colors.text} />
              </Pressable>

              {/* Full-screen avatar image */}
              <Image
                key={`fullscreen-avatar-${chat.id}-${chat.image}`}
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
        {!editingMessage && (
        <AttachmentsMenu
          visible={showAttachmentsMenu}
          onClose={() => {
            setShowAttachmentsMenu(false);
            // Restore keyboard if it was open when attachments menu was opened
            if (wasKeyboardOpenForAttachments.current) {
              setTimeout(() => {
                textInputRef.current?.focus();
                wasKeyboardOpenForAttachments.current = false;
              }, 250);
            }
          }}
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
        )}

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
                      <Bookmark size={24} color={colors.text} />
                      <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>Bookmarks</Text>
                    </View>
                    <Pressable onPress={() => setShowBookmarksModal(false)}>
                      <X size={20} color={colors.text} />
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
                  <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: "600", marginTop: 16 }}>No Bookmarks</Text>
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
                tint={colors.blurTint}
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
                    <ChevronDown size={16} color={colors.text} />
                  </>
                ) : (
                  <ChevronDown size={20} color={colors.text} />
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
                      <X size={20} color={colors.text} />
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
              setSuggestionEventData(null);
            }}
            initialEvent={editingEvent || suggestionEventData}
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
            onClose={() => {
              setShowCreatePoll(false);
              setSuggestionPollData(null);
            }}
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
            initialPoll={suggestionPollData}
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
          // Set preview image to show generating state
          setIsGeneratorSheetOpen(true);
          setPreviewImage({
            imageUrl: '',
            previewId: 'generating',
            prompt: 'Generating caption...',
          });
          setPreviewType('image'); // Treating caption generation as related to image flow for UI purposes
        }
      }}
      onRemix={(prompt) => {
            if (reactorMessageId && prompt.trim()) {
              console.log("[ChatScreen] Triggering remix for:", reactorMessageId, "prompt:", prompt);
              setIsAITyping(true); // Show AI typing animation
              remix({ messageId: reactorMessageId, remixPrompt: prompt, preview: true });
              setShowReactorMenu(false);
              setReactorMessageId(null);
              
              // Set preview image to show generating state immediately
              setIsGeneratorSheetOpen(true);
              setPreviewImage({
                imageUrl: '',
                previewId: 'generating',
                prompt: prompt,
              });
              setPreviewType('remix');
              
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

          // Set preview image to show generating state immediately
          setIsGeneratorSheetOpen(true);
          setPreviewImage({
            imageUrl: '',
            previewId: 'generating',
            prompt: prompt || 'Generating meme...',
          });
          setPreviewType('meme');
          
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

        {/* Image Generator Sheet (Replaces Modal) - Always mounted to maintain state */}
        <ImageGeneratorSheet
          isVisible={!!previewImage && isGeneratorSheetOpen}
          imageUrl={previewImage?.imageUrl || null}
          initialPrompt={previewImage?.prompt || ""}
          isProcessing={isConfirmingImage || isEditingImage || generateImageMutation.isPending || generateMemeMutation.isPending || isReactorProcessing}
          onMinimize={() => {
            setIsGeneratorSheetOpen(false); // Swipe down -> Minimize (show pill)
            // Restore keyboard if it was open
            if (wasKeyboardOpenForImageGen.current) {
              setTimeout(() => {
                textInputRef.current?.focus();
                wasKeyboardOpenForImageGen.current = false;
              }, 250);
            }
          }}
          onClose={() => {
            // Explicit close (X button or Cancel) -> Clear everything
            setPreviewImage(null);
            setIsGeneratorSheetOpen(false);
            // Restore keyboard if it was open
            if (wasKeyboardOpenForImageGen.current) {
              setTimeout(() => {
                textInputRef.current?.focus();
                wasKeyboardOpenForImageGen.current = false;
              }, 250);
            }
          }}
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
                      slashCommand: {
                        command: `/${previewType}`,
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
            />
            
        <VoiceRoomModal
          visible={voiceModalVisible}
          token={voiceToken || ""}
          serverUrl={voiceServerUrl || ""}
          roomName={activeRoom?.name || "Vibe Call"}
          onLeave={() => {
              // If user manually closes/leaves
              handleLeaveRoom();
              setVoiceModalVisible(false);
          }}
          isConnecting={isJoiningVoice}
          chatInputHeight={chatInputHeight}
        />

        {/* Translation Settings Modal */}
        <Modal
          visible={showTranslationModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTranslationModal(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={() => setShowTranslationModal(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <BlurView
                intensity={80}
                tint={colors.blurTint}
                style={{
                  borderRadius: 24,
                  overflow: "hidden",
                  minWidth: 320,
                  maxWidth: 400,
                  backgroundColor: colors.glassBackgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                }}
              >
                <LinearGradient
                  colors={isDark ? [
                    "rgba(255, 255, 255, 0.15)",
                    "rgba(255, 255, 255, 0.10)",
                    "rgba(255, 255, 255, 0.05)",
                  ] : [
                    "rgba(255, 255, 255, 0.8)",
                    "rgba(255, 255, 255, 0.6)",
                    "rgba(255, 255, 255, 0.4)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 24 }}
                >
                  {/* Header */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary + '20',
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}>
                      <Languages size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>
                        Translation Settings
                      </Text>
                    </View>
                    <Pressable onPress={() => setShowTranslationModal(false)}>
                      <X size={24} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  {/* Translation Toggle */}
                  <TranslationToggle
                    enabled={translationEnabled}
                    selectedLanguage={translationLanguage}
                    onToggle={handleTranslationToggle}
                    onLanguageSelect={handleLanguageSelect}
                  />
                </LinearGradient>
              </BlurView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
};

export default ChatScreen;
