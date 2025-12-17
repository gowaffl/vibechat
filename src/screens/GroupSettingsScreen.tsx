import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image as RNImage,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Share,
  PanResponder,
  Keyboard,
  useColorScheme,
  Dimensions,
  Switch,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Camera, Upload, Users, X, Trash2, Sparkles, Wand2, Plus, Edit2, Zap, UserPlus, Link2, Copy, Share2, Check, Images, ExternalLink, Bell, BellOff } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api, BACKEND_URL } from "@/lib/api";
import { supabaseClient } from "@/lib/authClient";
import { aiFriendsApi } from "@/api/ai-friends";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";
import { ZoomableImageViewer } from "@/components/ZoomableImageViewer";
import { FullscreenVideoModal } from "@/components/FullscreenVideoModal";
import type { RootStackScreenProps } from "@/navigation/types";
import type {
  Chat,
  UpdateChatRequest,
  ClearMessagesResponse,
  DeleteChatResponse,
  UploadImageResponse,
  GenerateGroupAvatarResponse,
  GetCustomCommandsResponse,
  CreateCustomCommandRequest,
  UpdateCustomCommandRequest,
  CustomSlashCommand,
  ChatWithMembers,
  User,
  GenerateInviteLinkResponse,
  CreateAIFriendRequest,
  UpdateAIFriendRequest,
  AIFriend
} from "@/shared/contracts";

// Draggable Slider Component
const DraggableSlider: React.FC<{
  value: number;
  onValueChange: (value: number) => void;
}> = ({ value, onValueChange }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const sliderRef = React.useRef<View>(null);
  // Cache layout measurements during drag
  const layoutRef = React.useRef<{ width: number; pageX: number } | null>(null);
  // Keep latest props accessible to PanResponder which is created once
  const propsRef = React.useRef({ value, onValueChange });
  
  // Update ref on render
  propsRef.current = { value, onValueChange };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setIsDragging(true);
        Haptics.selectionAsync(); // Super light haptic for start
        
        const touchX = event.nativeEvent.pageX;

        // Measure ONCE at the start of the interaction
        if (sliderRef.current) {
          sliderRef.current.measure((x, y, width, height, pageX, pageY) => {
            layoutRef.current = { width, pageX };
            
            // Calculate initial value immediately after measurement
            const relativeX = touchX - pageX;
            const percentage = Math.max(0, Math.min(100, Math.round((relativeX / width) * 100)));
            
            if (percentage !== propsRef.current.value) {
              Haptics.selectionAsync();
              propsRef.current.onValueChange(percentage);
            }
          });
        }
      },
      onPanResponderMove: (event) => {
        // Use cached layout for smooth 60fps+ updates without async measure calls
        if (layoutRef.current) {
          const { width, pageX } = layoutRef.current;
          const relativeX = event.nativeEvent.pageX - pageX;
          const percentage = Math.max(0, Math.min(100, Math.round((relativeX / width) * 100)));
          
          if (percentage !== propsRef.current.value) {
            Haptics.selectionAsync(); // Super light haptic only on value change
            propsRef.current.onValueChange(percentage);
          }
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        // No haptic on release for smoother feel, or selectionAsync if desired
      },
    })
  ).current;

  return (
    <View style={{ height: 40, justifyContent: "center" }}>
      <View
        ref={sliderRef}
        style={{
          height: 6,
          backgroundColor: colors.success + "33",
          borderRadius: 3,
          position: "relative",
        }}
        {...panResponder.panHandlers}
      >
        {/* Filled portion */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${value}%`,
            backgroundColor: colors.success,
            borderRadius: 3,
          }}
        />
        {/* Thumb */}
        <View
          style={{
            position: "absolute",
            left: `${value}%`,
            top: -7,
            width: isDragging ? 24 : 20,
            height: isDragging ? 24 : 20,
            borderRadius: isDragging ? 12 : 10,
            backgroundColor: colors.success,
            marginLeft: isDragging ? -12 : -10,
            shadowColor: colors.success,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: isDragging ? 6 : 4,
            elevation: isDragging ? 6 : 4,
          }}
        />
      </View>
    </View>
  );
};

const GroupSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const route = useRoute<RootStackScreenProps<"GroupSettings">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"GroupSettings">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();
  const colorScheme = useColorScheme();

  const { chatId } = route.params;

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isAddingCommand, setIsAddingCommand] = useState(false);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [newCommand, setNewCommand] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showLinksCollection, setShowLinksCollection] = useState(false);
  const [galleryViewerImage, setGalleryViewerImage] = useState<{
    url: string;
    senderName: string;
    timestamp: string;
    messageId?: string;
    isVideo?: boolean;
    videoUrl?: string | null;
  } | null>(null);

  // AI Friends state
  const [selectedAiFriendId, setSelectedAiFriendId] = useState<string | null>(null);
  const [isCreatingAiFriend, setIsCreatingAiFriend] = useState(false);
  const [aiPersonality, setAiPersonality] = useState("");
  const [aiTone, setAiTone] = useState("");
  const [aiName, setAiName] = useState("");
  const [aiEngagementMode, setAiEngagementMode] = useState<"on-call" | "percentage" | "off">("on-call");
  const [aiEngagementPercent, setAiEngagementPercent] = useState<number>(50);

  // Available tone chips
  const toneOptions = [
    "Professional", "Casual", "Friendly", "Humorous", "Sarcastic", "Formal", "Enthusiastic", "Calm"
  ];

  // Fetch chat details
  const { data: chat, isLoading } = useQuery<ChatWithMembers>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get<ChatWithMembers>(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  // Fetch AI friends for this chat
  const { data: aiFriends = [], isLoading: isLoadingAiFriends } = useQuery<AIFriend[]>({
    queryKey: ["aiFriends", chatId],
    queryFn: () => aiFriendsApi.getAIFriends(chatId, user?.id || ""),
    enabled: !!user?.id && !!chatId,
  });

  // Subscribe to AI friend changes
  React.useEffect(() => {
    if (!chatId) return;

    console.log(`[GroupSettings] Subscribing to AI friends changes for chat ${chatId}`);
    const channel = supabaseClient.channel(`ai_friends:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_friend',
          filter: `chatId=eq.${chatId}`,
        },
        (payload) => {
          console.log('[GroupSettings] AI Friend change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
        }
      )
      .subscribe();

    return () => {
      console.log(`[GroupSettings] Unsubscribing from AI friends changes`);
      supabaseClient.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  // Fetch messages to extract photos and links
  const { data: messagesData } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => api.get<{ messages: any[], hasMore: boolean, nextCursor: string | null }>(`/api/chats/${chatId}/messages?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });
  
  // Extract messages array from paginated response
  const messages = messagesData?.messages || [];

  // Fetch all media messages from the dedicated endpoint
  const { data: mediaMessages = [] } = useQuery({
    queryKey: ["chatMedia", chatId],
    queryFn: () => api.get<any[]>(`/api/chats/${chatId}/media?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  // Extract all links from messages
  const linkMessages = messages.filter((msg: any) => 
    msg.linkPreview && msg.linkPreview.url && !msg.isUnsent
  );

  // Check if current user is the creator
  const isCreator = chat?.creatorId === user?.id;
  const isRestricted = chat?.isRestricted || false;
  // Permissions: In restricted mode, only creator can edit. In unrestricted mode, any member can edit.
  const canEdit = !isRestricted || isCreator;

  // Check if notifications are muted
  const currentMember = chat?.members?.find(m => m.userId === user?.id);
  const isMuted = currentMember?.isMuted || false;

  // Mute chat mutation
  const muteChatMutation = useMutation({
    mutationFn: ({ chatId, isMuted }: { chatId: string; isMuted: boolean }) =>
      api.patch(`/api/chats/${chatId}/mute`, { userId: user!.id, isMuted }),
    onMutate: async ({ isMuted }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["chat", chatId] });

      // Snapshot the previous value
      const previousChat = queryClient.getQueryData(["chat", chatId]);

      // Optimistically update to the new value
      queryClient.setQueryData(["chat", chatId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members?.map((m: any) =>
            m.userId === user?.id ? { ...m, isMuted } : m
          ) || [],
        };
      });

      // Return a context object with the snapshotted value
      return { previousChat };
    },
    onSuccess: () => {
      // We don't need to invalidate immediately because we updated optimally
      // But we should invalidate eventually to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any, _, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousChat) {
        queryClient.setQueryData(["chat", chatId], context.previousChat);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error?.message || "Failed to update mute status";
      Alert.alert("Error", errorMessage);
    },
  });

  // Update local state when data changes
  React.useEffect(() => {
    if (chat) {
      setName(chat.name);
      setBio(chat.bio || "");

      // Set invite token and link from chat data
      if (chat.inviteToken) {
        setInviteToken(chat.inviteToken);
        // Use custom scheme for invite link
        setInviteLink(`vibechat://invite?token=${chat.inviteToken}`);
      }

      // Convert relative image URL to full URL using shared helper
      const fullImageUrl = getFullImageUrl(chat.image);
      setImageUri(fullImageUrl || null);
    }
  }, [chat]);

  // Update navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View className="flex-row items-center">
          <View className="items-center">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-white">{chat?.name || "Group Settings"}</Text>
              {canEdit && (
                <Pressable
                  onPress={() => setShowEditProfileModal(true)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Edit2 size={16} color={colors.text} />
                </Pressable>
              )}
            </View>
            {chat?.bio ? (
              <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                {chat.bio}
              </Text>
            ) : null}
          </View>
        </View>
      ),
    });
  }, [navigation, chat?.name, chat?.bio]);

  // Auto-select first AI friend when data loads
  React.useEffect(() => {
    if (aiFriends.length > 0 && !selectedAiFriendId) {
      setSelectedAiFriendId(aiFriends[0].id);
    }
  }, [aiFriends, selectedAiFriendId]);

  // Load selected AI friend data into form fields
  React.useEffect(() => {
    const selectedFriend = aiFriends.find(f => f.id === selectedAiFriendId);
    if (selectedFriend) {
      setAiName(selectedFriend.name);
      setAiPersonality(selectedFriend.personality || "");
      setAiTone(selectedFriend.tone || "");
      setAiEngagementMode(selectedFriend.engagementMode);
      setAiEngagementPercent(selectedFriend.engagementPercent || 50);
    }
  }, [selectedAiFriendId, aiFriends]);

  // Handle route params for auto-expanding AI Friends section and creating new friend
  React.useEffect(() => {
    if (route.params?.expandAIFriends) {
      setIsAiFriendSectionExpanded(true);
    }
    if (route.params?.createAIFriend) {
      setIsAiFriendSectionExpanded(true);
      // Delay setting create mode to ensure the section is expanded first
      setTimeout(() => {
        setIsCreatingAiFriend(true);
      }, 100);
    }
  }, [route.params, isCreator]);

  // Update chat settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (updates: Omit<UpdateChatRequest, 'userId'>) =>
      api.patch<Chat>(`/api/chats/${chatId}`, { ...updates, userId: user?.id }),
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["chat", chatId] });

      // Snapshot the previous value
      const previousChat = queryClient.getQueryData(["chat", chatId]);

      // Optimistically update to the new value
      if (updates.isRestricted !== undefined) {
        queryClient.setQueryData(["chat", chatId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            isRestricted: updates.isRestricted,
          };
        });
      }

      // Return a context object with the snapshotted value
      return { previousChat };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousChat) {
        queryClient.setQueryData(["chat", chatId], context.previousChat);
      }
      
      console.error("[GroupSettings] Failed to update settings:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update settings");
    },
  });

  // AI Friends mutations
  const createAIFriendMutation = useMutation({
    mutationFn: (data: Omit<CreateAIFriendRequest, 'userId'>) => {
      console.log("[GroupSettings] Creating AI friend with data:", data);
      return aiFriendsApi.createAIFriend({ ...data, userId: user?.id || "" });
    },
    onSuccess: (newFriend) => {
      console.log("[GroupSettings] AI friend created successfully:", newFriend);
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      setSelectedAiFriendId(newFriend.id);
      setIsCreatingAiFriend(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[GroupSettings] Error creating AI friend:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to create AI friend");
    },
  });

  const updateAIFriendMutation = useMutation({
    mutationFn: ({ aiFriendId, data }: { aiFriendId: string; data: Omit<UpdateAIFriendRequest, 'userId'> }) => {
      console.log("[GroupSettings] Updating AI friend:", aiFriendId, data);
      return aiFriendsApi.updateAIFriend(aiFriendId, { ...data, userId: user?.id || "" });
    },
    onSuccess: () => {
      console.log("[GroupSettings] AI friend updated successfully");
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[GroupSettings] Error updating AI friend:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to update AI friend");
    },
  });

  const deleteAIFriendMutation = useMutation({
    mutationFn: (aiFriendId: string) => {
      console.log("[GroupSettings] Deleting AI friend:", aiFriendId);
      return aiFriendsApi.deleteAIFriend(aiFriendId, user?.id || "");
    },
    onSuccess: (_, deletedId) => {
      console.log("[GroupSettings] AI friend deleted successfully:", deletedId);
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      if (selectedAiFriendId === deletedId && aiFriends.length > 1) {
        setSelectedAiFriendId(aiFriends[0].id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[GroupSettings] Error deleting AI friend:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to delete AI friend");
    },
  });

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (uri: string) => {
      console.log("[GroupSettings] Starting image upload...", uri);
      const filename = uri.split("/").pop() || "group-image.jpg";
      console.log("[GroupSettings] Filename:", filename);
      console.log("[GroupSettings] Upload URL:", `${BACKEND_URL}/api/upload/image`);

      // Use FileSystem.uploadAsync for proper file upload in React Native
      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/upload/image`,
        uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "image",
          // Don't set Content-Type header - let FileSystem set it automatically with boundary
        }
      );

      console.log("[GroupSettings] Upload result status:", uploadResult.status);
      console.log("[GroupSettings] Upload result body:", uploadResult.body);

      if (uploadResult.status === 200) {
        const response: UploadImageResponse = JSON.parse(uploadResult.body);
        console.log("[GroupSettings] Parsed response:", response);
        if (response.success) {
          return response;
        } else {
          throw new Error("Upload failed");
        }
      } else {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }
    },
    onSuccess: (data) => {
      console.log("[GroupSettings] Image uploaded, URL:", data.url);
      // Save the URL to the database (it's already a full Supabase storage URL)
      updateSettingsMutation.mutate({ image: data.url });
      // For display, use the URL as-is
      setImageUri(data.url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[GroupSettings] Failed to upload group image:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
    },
  });

  // Clear messages mutation
  const clearMessagesMutation = useMutation({
    mutationFn: () => api.delete<ClearMessagesResponse>(`/api/chats/${chatId}/messages`, { userId: user?.id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Messages cleared successfully");
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to clear messages. Please try again.");
    },
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: () => api.delete(`/api/chats/${chatId}`, { userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate back to chat list
      navigation.navigate("MainTabs", { screen: "Chats" });
    },
    onError: (error: any) => {
      console.error("[GroupSettings] Failed to delete chat:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to delete chat. Please try again.");
    },
  });

  // Generate avatar mutation
  const generateAvatarMutation = useMutation({
    mutationFn: () => api.post<GenerateGroupAvatarResponse>("/api/ai/generate-group-avatar", { chatId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (data.alreadyGenerated) {
        Alert.alert("Already Generated", "Avatar has already been generated today. You can generate a new one tomorrow after midnight Eastern time.");
      } else {
        Alert.alert("Success", "New group avatar has been generated! 🎨");
      }
    },
    onError: (error: any) => {
      console.error("[GroupSettings] Failed to generate avatar:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to generate avatar. Please try again.");
    },
  });

  // Fetch custom commands
  const { data: customCommands = [] } = useQuery({
    queryKey: ["customCommands", chatId],
    queryFn: () => api.get<GetCustomCommandsResponse>(`/api/custom-commands?chatId=${chatId}`),
  });

  // Create custom command mutation
  const createCommandMutation = useMutation({
    mutationFn: (data: CreateCustomCommandRequest) =>
      api.post<CustomSlashCommand>("/api/custom-commands", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewCommand("");
      setNewPrompt("");
      setIsAddingCommand(false);
      Alert.alert("Success", "Custom slash command created!");
    },
    onError: (error: any) => {
      console.error("[CustomCommands] Failed to create command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to create custom command");
    },
  });

  // Update custom command mutation
  const updateCommandMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomCommandRequest }) =>
      api.patch<CustomSlashCommand>(`/api/custom-commands/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingCommandId(null);
      setNewCommand("");
      setNewPrompt("");
      Alert.alert("Success", "Custom slash command updated!");
    },
    onError: (error: any) => {
      console.error("[CustomCommands] Failed to update command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update custom command");
    },
  });

  // Delete custom command mutation
  const deleteCommandMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/custom-commands/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[CustomCommands] Failed to delete command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete custom command");
    },
  });

  // Generate invite link mutation
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [inviteToken, setInviteToken] = React.useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);
  const [linkCopied, setLinkCopied] = React.useState(false);

  const generateInviteLinkMutation = useMutation({
    mutationFn: () =>
      api.post<GenerateInviteLinkResponse>(`/api/chats/${chatId}/invite-link`, { userId: user?.id }),
    onSuccess: (data) => {
      setInviteLink(data.inviteLink);
      setInviteToken(data.inviteToken);
      // Invalidate chat query to refresh with new token
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[Invite] Failed to generate invite link:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to generate invite link");
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userIdToRemove: string) =>
      api.delete(`/api/chats/${chatId}/members/${userIdToRemove}`, { removerId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      console.error("[Members] Failed to remove member:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to remove member");
    },
  });

  const handleGenerateInviteLink = () => {
    if (inviteToken && inviteLink) {
      // Link already exists, just show the modal
      setShowInviteModal(true);
    } else {
      // Generate new link
      generateInviteLinkMutation.mutate();
      setShowInviteModal(true);
    }
  };

  const handleRemoveMember = (userIdToRemove: string, memberName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${memberName} from this chat?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMemberMutation.mutate(userIdToRemove),
        },
      ]
    );
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setLinkCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join our chat "${chat?.name}" on VibeChat!\n\n${inviteLink}`,
        title: "Invite to VibeChat",
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error sharing link:", error);
    }
  };

  const handleClearConversation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Clear Conversation",
      "Are you sure you want to delete all messages? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => clearMessagesMutation.mutate(),
        },
      ]
    );
  };

  const handleDeleteChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Chat",
      "Are you sure you want to delete this entire chat? This will permanently delete all messages, settings, and member data. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Chat",
          style: "destructive",
          onPress: () => deleteChatMutation.mutate(),
        },
      ]
    );
  };

  const handleUpdateAvatar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Update Group Photo",
      "Choose how you want to update the group photo",
      [
        {
          text: "Take Photo",
          onPress: takePhoto,
        },
        {
          text: "Choose from Gallery",
          onPress: pickImageFromGallery,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const pickImageFromGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImageMutation.mutate(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImageMutation.mutate(result.assets[0].uri);
    }
  };

  const handleSaveProfile = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Group name cannot be empty");
      return;
    }

    updateSettingsMutation.mutate(
      { name, bio },
      {
        onSuccess: () => {
          setShowEditProfileModal(false);
        },
      }
    );
  };

  const handleSaveName = () => {
    if (name.trim() && name !== chat?.name) {
      updateSettingsMutation.mutate({ name: name.trim() });
    }
    setIsEditingName(false);
  };

  const handleSaveBio = () => {
    if (bio !== chat?.bio) {
      updateSettingsMutation.mutate({ bio: bio.trim() || null });
    }
    setIsEditingBio(false);
  };

  const handleSaveAiSettings = () => {
    if (selectedAiFriendId) {
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: {
          name: aiName.trim() || "AI Friend",
          personality: aiPersonality.trim() || null,
        },
      });
    }
  };

  const handleSelectTone = (tone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newTone = aiTone === tone ? "" : tone;
    setAiTone(newTone);
    if (selectedAiFriendId) {
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: { tone: newTone || null },
      });
    }
  };

  const handleSelectEngagementMode = (mode: "on-call" | "percentage" | "off") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiEngagementMode(mode);

    if (!selectedAiFriendId) return;

    // If switching to percentage mode, ensure we have a valid percentage
    if (mode === "percentage") {
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: {
          engagementMode: mode,
          engagementPercent: aiEngagementPercent || 50
        },
      });
    } else {
      // For on-call or off modes, clear the percentage
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: {
          engagementMode: mode,
          engagementPercent: null
        },
      });
    }
  };

  const handleUpdateEngagementPercent = (value: number) => {
    setAiEngagementPercent(value);
    // Only update if we're in percentage mode and have a selected AI friend
    if (aiEngagementMode === "percentage" && selectedAiFriendId) {
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: {
          engagementMode: "percentage",
          engagementPercent: value
        },
      });
    }
  };

  const handleCreateAIFriend = () => {
    console.log("[GroupSettings] handleCreateAIFriend called, chatId:", chatId, "user:", user?.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!user?.id) {
      Alert.alert("Error", "User not found. Please try logging in again.");
      return;
    }
    
    if (!chatId) {
      Alert.alert("Error", "Chat ID not found.");
      return;
    }
    
    createAIFriendMutation.mutate({
      chatId,
      name: "AI Friend",
      personality: null,
      tone: null,
      engagementMode: "on-call",
      engagementPercent: null,
    });
  };

  const handleDeleteAIFriend = (aiFriendId: string) => {
    if (aiFriends.length <= 1) {
      Alert.alert(
        "Cannot Delete",
        "Each chat must have at least one AI friend."
      );
      return;
    }
    Alert.alert(
      "Delete AI Friend",
      "Are you sure you want to delete this AI friend? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteAIFriendMutation.mutate(aiFriendId);
          },
        },
      ]
    );
  };

  const handleCreateCommand = () => {
    if (!newCommand.trim() || !newPrompt.trim()) {
      Alert.alert("Missing Fields", "Please enter both command and prompt");
      return;
    }
    createCommandMutation.mutate({
      command: newCommand.trim(),
      prompt: newPrompt.trim(),
      chatId: chatId,
    });
  };

  const handleEditCommand = (command: CustomSlashCommand) => {
    setEditingCommandId(command.id);
    setNewCommand(command.command);
    setNewPrompt(command.prompt);
    setIsAddingCommand(false);
  };

  const handleUpdateCommand = () => {
    if (!editingCommandId || !newCommand.trim() || !newPrompt.trim()) {
      Alert.alert("Missing Fields", "Please enter both command and prompt");
      return;
    }
    updateCommandMutation.mutate({
      id: editingCommandId,
      data: {
        command: newCommand.trim(),
        prompt: newPrompt.trim(),
      },
    });
  };

  const handleDeleteCommand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Command",
      "Are you sure you want to delete this custom slash command?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteCommandMutation.mutate(id),
        },
      ]
    );
  };

  const handleCancelEditing = () => {
    setIsAddingCommand(false);
    setEditingCommandId(null);
    setNewCommand("");
    setNewPrompt("");
  };

  // Fetch all users for member list
  const { data: allMessages } = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.get<any[]>("/api/messages"),
  });

  // Extract unique users from messages
  const uniqueUsers = React.useMemo(() => {
    if (!allMessages) return [];
    const userMap = new Map();
    allMessages.forEach((msg) => {
      // Filter out AI messages (userId is null for AI messages)
      if (msg.user && msg.userId !== null) {
        userMap.set(msg.userId, msg.user);
      }
    });
    return Array.from(userMap.values());
  }, [allMessages]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <LuxeLogoLoader size="large" />
      </View>
    );
  }

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
            colors.background
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        <LinearGradient
          colors={isDark ? [
            "rgba(79, 195, 247, 0.03)",
            "rgba(0, 122, 255, 0.02)",
            "transparent",
            "rgba(52, 199, 89, 0.02)",
          ] : [
            "rgba(0, 122, 255, 0.05)",
            "rgba(79, 195, 247, 0.05)",
            "transparent",
            "rgba(52, 199, 89, 0.05)",
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
      
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: 100,
              paddingHorizontal: 20,
              paddingBottom: isKeyboardVisible ? 20 : insets.bottom + 20
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Group Photo */}
            <View className="items-center py-8">
              <Pressable
                onPress={() => {
                  if (imageUri) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAvatarViewer(true);
                  }
                }}
                disabled={!imageUri}
              >
                <View className="relative">
                  {imageUri ? (
                    <View
                      style={{
                        shadowColor: "#007AFF",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.5,
                        shadowRadius: 12,
                        elevation: 8,
                        borderRadius: 64,
                        overflow: 'hidden', // Ensure cutoff is clean
                      }}
                    >
                      <Image
                        source={{ uri: imageUri }}
                        style={{ width: 128, height: 128, borderRadius: 64 }}
                        contentFit="cover" // Changed from resizeMode="cover" for Expo Image
                        transition={200}
                      />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 128,
                        height: 128,
                        borderRadius: 64,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.primary + "26",
                        borderWidth: 1,
                        borderColor: colors.primary + "4D",
                        shadowColor: "#007AFF",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.5,
                        shadowRadius: 12,
                        elevation: 8,
                      }}
                    >
                      <Users size={48} color={colors.primary} />
                    </View>
                  )}
                  {uploadImageMutation.isPending && (
                    <View className="absolute inset-0 rounded-full items-center justify-center" style={{ backgroundColor: colors.overlay }}>
                      <LuxeLogoLoader size={20} />
                    </View>
                  )}
                  
                  {/* AI Avatar Generation Button */}
                  {canEdit && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      overflow: 'hidden',
                      borderWidth: 1.5,
                      borderColor: 'rgba(79, 195, 247, 0.4)',
                      shadowColor: '#8A2BE2',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <BlurView intensity={80} tint="dark" style={{ width: 36, height: 36 }}>
                      <LinearGradient
                        colors={[
                          'rgba(79, 195, 247, 0.6)',
                          'rgba(79, 195, 247, 0.8)',
                          'rgba(79, 195, 247, 0.9)',
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 36,
                          height: 36,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            generateAvatarMutation.mutate();
                          }}
                          disabled={generateAvatarMutation.isPending}
                          style={{
                            width: 36,
                            height: 36,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {generateAvatarMutation.isPending ? (
                            <LuxeLogoLoader size="small" />
                          ) : (
                            <Sparkles size={16} color={colors.text} strokeWidth={2.5} />
                          )}
                        </Pressable>
                      </LinearGradient>
                    </BlurView>
                  </View>
                  )}

                  {/* Camera Button (Moved to bottom left) */}
                  {canEdit && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                    }}
                  >
                    <Pressable onPress={handleUpdateAvatar}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.inputBackground,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Camera size={16} color={colors.text} />
                      </View>
                    </Pressable>
                  </View>
                  )}
                </View>
              </Pressable>
            </View>

            {/* Media Section */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPhotoGallery(true);
              }}
            >
              <View
                className="rounded-2xl p-5 mb-4"
                style={{
                  backgroundColor: colors.glassBackground,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  shadowColor: colors.glassShadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Images size={20} color={colors.primary} />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold" style={{ color: colors.text }}>
                        Media
                      </Text>
                      <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        {mediaMessages.length} {mediaMessages.length === 1 ? "item" : "items"}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-2xl" style={{ color: colors.textSecondary }}>›</Text>
                </View>
                
                {/* Preview Grid */}
                {mediaMessages.length > 0 && (
                  <View className="flex-row gap-2 mt-4">
                    {mediaMessages.slice(0, mediaMessages.length > 5 ? 4 : 5).map((item: any, index: number) => {
                      const isVideo = item.messageType === "video";
                      const thumbnailUrl = getFullImageUrl(item.thumbnailUrl);
                      
                      return (
                        <View 
                          key={item.id} 
                          style={{ 
                            position: "relative",
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            backgroundColor: colors.inputBackground,
                            overflow: "hidden"
                          }}
                        >
                          {thumbnailUrl ? (
                            <Image
                              source={{ uri: thumbnailUrl }}
                              style={{
                                width: "100%",
                                height: "100%",
                              }}
                              contentFit="cover"
                              transition={200}
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <View className="flex-1 items-center justify-center">
                              <Images size={20} color="rgba(255, 255, 255, 0.3)" />
                            </View>
                          )}
                          
                          {isVideo && (
                            <View style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: "rgba(0,0,0,0.3)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}>
                              <Ionicons name="play" size={16} color="#fff" />
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {mediaMessages.length > 5 && (
                      <View
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 8,
                          backgroundColor: colors.inputBackground,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                          +{mediaMessages.length - 4}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Pressable>

            {/* Links Section */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLinksCollection(true);
              }}
            >
              <View
                className="rounded-2xl p-5 mb-4"
                style={{
                  backgroundColor: colors.glassBackground,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  shadowColor: colors.glassShadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Link2 size={20} color={colors.primary} />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold" style={{ color: colors.text }}>
                        Links
                      </Text>
                      <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        {linkMessages.length} {linkMessages.length === 1 ? "link" : "links"} shared
                      </Text>
                    </View>
                  </View>
                  <Text className="text-2xl" style={{ color: colors.textSecondary }}>›</Text>
                </View>
                
                {/* Preview Links */}
                {linkMessages.length > 0 && (
                  <View className="mt-4 gap-2">
                    {linkMessages.slice(0, 3).map((msg: any) => (
                      <View
                        key={msg.id}
                        className="flex-row items-center gap-3 p-2 rounded-lg"
                        style={{
                          backgroundColor: colors.inputBackground,
                        }}
                      >
                        {msg.linkPreview?.linkPreviewImage && (
                          <Image
                            source={{ uri: msg.linkPreview.linkPreviewImage }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 6,
                            }}
                            resizeMode="cover"
                          />
                        )}
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}
                          >
                            {msg.linkPreview?.linkPreviewTitle || msg.linkPreview?.url}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}
                          >
                            {msg.linkPreview?.linkPreviewSiteName || new URL(msg.linkPreview?.url).hostname}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Pressable>

            {/* AI Friend Settings */}
            <View
              className="rounded-2xl p-5 mb-4"
              style={{
                backgroundColor: colors.success + "1A",
                borderWidth: 1,
                borderColor: colors.success + "4D",
                shadowColor: colors.success,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {/* Header with + button */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Sparkles size={18} color={colors.success} />
                  <Text className="text-sm font-semibold ml-2" style={{ color: colors.success }}>
                    AI FRIENDS
                  </Text>
                </View>
                {canEdit && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleCreateAIFriend();
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: "rgba(52, 199, 89, 0.15)",
                        padding: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.success + "4D",
                      }}
                    >
                      <Plus size={16} color={colors.success} />
                    </View>
                  </Pressable>
                )}
              </View>

              {/* AI Friend Selector Dropdown - Only show if 2+ friends */}
              {aiFriends.length > 1 && (
                <View className="mb-4">
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                    Select AI Friend
                  </Text>
                  <View
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: colors.inputBackground,
                      borderWidth: 1,
                      borderColor: colors.success + "4D",
                    }}
                  >
                    {aiFriends.map((friend, index) => (
                      <Pressable
                        key={friend.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedAiFriendId(friend.id);
                        }}
                        style={{
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: selectedAiFriendId === friend.id
                            ? "rgba(52, 199, 89, 0.15)"
                            : "transparent",
                          borderTopWidth: index > 0 ? 1 : 0,
                          borderTopColor: colors.glassBorder,
                        }}
                      >
                        <View className="flex-row items-center flex-1">
                          {/* Color indicator */}
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: friend.color,
                              marginRight: 10,
                            }}
                          />
                          <Text
                            style={{
                              color: selectedAiFriendId === friend.id ? colors.success : colors.text,
                              fontSize: 15,
                              fontWeight: selectedAiFriendId === friend.id ? "600" : "500",
                            }}
                          >
                            {friend.name}
                          </Text>
                        </View>
                        {selectedAiFriendId === friend.id && (
                          <Check size={18} color={colors.success} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {selectedAiFriendId && (
                <>
                  {/* AI Friend Name */}
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                    AI Friend Name
                  </Text>
                  <TextInput
                    value={aiName}
                    onChangeText={setAiName}
                    className="rounded-lg px-4 py-3 text-base mb-4"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.success + "4D",
                    }}
                    placeholder="e.g., 'Jarvis', 'Buddy', 'Alex'..."
                    placeholderTextColor={colors.inputPlaceholder}
                    maxLength={50}
                  />

                  {/* Custom Instructions */}
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                    Custom Instructions
                  </Text>
                  <TextInput
                    value={aiPersonality}
                    onChangeText={setAiPersonality}
                    className="rounded-lg px-4 py-3 text-base mb-4"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.success + "4D",
                    }}
                    placeholder="e.g., 'You are a helpful friend who loves tech...'"
                    placeholderTextColor={colors.inputPlaceholder}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                  />

                  {/* Unified Save Button */}
                  <Pressable
                    onPress={handleSaveAiSettings}
                    disabled={updateAIFriendMutation.isPending}
                    className="mb-6"
                  >
                    <View
                      style={{
                        borderRadius: 10,
                        padding: 12,
                        alignItems: "center",
                        backgroundColor: colors.success + "26",
                        borderWidth: 1,
                        borderColor: colors.success,
                      }}
                    >
                      {updateAIFriendMutation.isPending ? (
                        <LuxeLogoLoader size="small" />
                      ) : (
                        <Text className="font-semibold" style={{ color: colors.success }}>Save Settings</Text>
                      )}
                    </View>
                  </Pressable>

                  {/* Tone Chips */}
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                    Quick Tone Selection
                  </Text>
              <View className="flex-row flex-wrap gap-2">
                {toneOptions.map((tone) => {
                  const isSelected = aiTone === tone;
                  return (
                    <Pressable
                      key={tone}
                      onPress={() => handleSelectTone(tone)}
                      disabled={updateAIFriendMutation.isPending}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isSelected ? colors.success + "40" : colors.inputBackground,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.success : colors.border,
                      }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: isSelected ? colors.success : colors.text }}
                      >
                        {tone}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* AI Engagement Settings */}
              <Text className="text-xs font-semibold mb-2 mt-6" style={{ color: colors.textSecondary }}>
                AI Friend Engagement
              </Text>
              <Text className="text-xs mb-3" style={{ color: colors.textTertiary }}>
                Control how often the AI automatically joins the conversation
              </Text>

              {/* Mode Selector */}
              <View className="flex-col gap-2 mb-4">
                {/* On-Call Only */}
                <Pressable
                  onPress={() => handleSelectEngagementMode("on-call")}
                  disabled={updateAIFriendMutation.isPending}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: aiEngagementMode === "on-call" ? colors.success + "40" : colors.inputBackground,
                    borderWidth: 2,
                    borderColor: aiEngagementMode === "on-call" ? colors.success : colors.border,
                  }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: aiEngagementMode === "on-call" ? colors.success : colors.text }}
                  >
                    On-Call Only (@ai)
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                    AI only responds when explicitly mentioned with @ai
                  </Text>
                </Pressable>

                {/* Percentage Mode */}
                <Pressable
                  onPress={() => handleSelectEngagementMode("percentage")}
                  disabled={updateAIFriendMutation.isPending}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: aiEngagementMode === "percentage" ? colors.success + "40" : colors.inputBackground,
                    borderWidth: 2,
                    borderColor: aiEngagementMode === "percentage" ? colors.success : colors.border,
                  }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: aiEngagementMode === "percentage" ? colors.success : colors.text }}
                  >
                    Automatic Engagement
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                    AI joins conversations naturally based on percentage
                  </Text>
                </Pressable>

                {/* Off */}
                <Pressable
                  onPress={() => handleSelectEngagementMode("off")}
                  disabled={updateAIFriendMutation.isPending}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: aiEngagementMode === "off" ? colors.error + "40" : colors.inputBackground,
                    borderWidth: 2,
                    borderColor: aiEngagementMode === "off" ? colors.error : colors.border,
                  }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: aiEngagementMode === "off" ? colors.error : colors.text }}
                  >
                    Off
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                    AI friend is completely disabled
                  </Text>
                </Pressable>
              </View>

              {/* Percentage Slider - Only shown when percentage mode is selected */}
              {aiEngagementMode === "percentage" && (
                <View
                  className="rounded-xl p-4 mt-2"
                  style={{
                    backgroundColor: colors.success + "1A",
                    borderWidth: 1,
                    borderColor: colors.success + "4D",
                  }}
                >
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm font-semibold" style={{ color: colors.success }}>
                      Engagement Frequency
                    </Text>
                    <Text className="text-2xl font-bold" style={{ color: colors.success }}>
                      {aiEngagementPercent}%
                    </Text>
                  </View>

                  {/* Draggable Slider */}
                  <View className="flex-col gap-2">
                    <DraggableSlider
                      value={aiEngagementPercent}
                      onValueChange={handleUpdateEngagementPercent}
                    />

                    {/* Percentage buttons */}
                    <View className="flex-row justify-between mt-2">
                      {[0, 25, 50, 75, 100].map((value) => (
                        <Pressable
                          key={value}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleUpdateEngagementPercent(value);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: aiEngagementPercent === value
                              ? "rgba(52, 199, 89, 0.3)"
                              : "rgba(255, 255, 255, 0.05)",
                            borderWidth: 1,
                            borderColor: aiEngagementPercent === value
                              ? "#34C759"
                              : "rgba(255, 255, 255, 0.1)",
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color: aiEngagementPercent === value ? "#34C759" : "#8E8E93",
                            }}
                          >
                            {value}%
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>
                    {aiEngagementPercent === 0 && "AI will never join automatically (same as On-Call mode)"}
                    {aiEngagementPercent > 0 && aiEngagementPercent < 25 && "AI rarely joins the conversation"}
                    {aiEngagementPercent >= 25 && aiEngagementPercent < 50 && "AI occasionally joins the conversation"}
                    {aiEngagementPercent >= 50 && aiEngagementPercent < 75 && "AI frequently joins the conversation"}
                    {aiEngagementPercent >= 75 && aiEngagementPercent < 100 && "AI very often joins the conversation"}
                    {aiEngagementPercent === 100 && "AI will attempt to join every message"}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: colors.textTertiary }}>
                    Note: @ai mentions will always work regardless of this setting
                  </Text>
                </View>
              )}

              {/* Delete AI Friend Button - Only show if 2+ friends */}
              {aiFriends.length > 1 && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleDeleteAIFriend(selectedAiFriendId);
                  }}
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: "rgba(255, 69, 58, 0.1)",
                    borderWidth: 1,
                    borderColor: "#FF453A",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={16} color="#FF453A" />
                  <Text
                    style={{
                      color: "#FF453A",
                      fontSize: 15,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    Delete This AI Friend
                  </Text>
                </Pressable>
              )}
                </>
              )}
            </View>

            {/* Custom Slash Commands */}
            <View
              className="rounded-2xl p-5 mb-4"
              style={{
                backgroundColor: colors.warning + "1A",
                borderWidth: 1,
                borderColor: colors.warning + "4D",
                shadowColor: "#FF9F0A",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Zap size={18} color={colors.warning} />
                  <Text className="text-sm font-semibold ml-2" style={{ color: colors.warning }}>
                    CUSTOM SLASH COMMANDS
                  </Text>
                </View>
                {canEdit && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleCancelEditing();
                      setIsAddingCommand(true);
                    }}
                    disabled={isAddingCommand || editingCommandId !== null}
                  >
                    <View
                      style={{
                        backgroundColor: "rgba(255, 159, 10, 0.15)",
                        padding: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.warning + "4D",
                      }}
                    >
                      <Plus size={16} color={colors.warning} />
                    </View>
                  </Pressable>
                )}
              </View>

              <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                Create custom commands powered by Gemini AI. Use them like /image or /meme
              </Text>

              {/* Add New Command Form */}
              {isAddingCommand && (
                <View className="mb-4 p-4 rounded-xl" style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}>
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.warning }}>
                    New Command
                  </Text>
                  <TextInput
                    value={newCommand}
                    onChangeText={setNewCommand}
                    className="rounded-lg px-4 py-3 text-base mb-2"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="/roast, /factcheck, etc."
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="none"
                    maxLength={50}
                  />
                  <Text className="text-xs font-semibold mb-2 mt-2" style={{ color: colors.warning }}>
                    Prompt for AI
                  </Text>
                  <TextInput
                    value={newPrompt}
                    onChangeText={setNewPrompt}
                    className="rounded-lg px-4 py-3 text-base mb-3"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="e.g., 'Roast the user's message in a funny way'"
                    placeholderTextColor={colors.inputPlaceholder}
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleCreateCommand}
                      className="flex-1"
                      disabled={createCommandMutation.isPending}
                    >
                      <View
                        style={{
                          borderRadius: 10,
                          padding: 12,
                          alignItems: "center",
                          backgroundColor: "rgba(255, 159, 10, 0.15)",
                          borderWidth: 1,
                          borderColor: "#FF9F0A",
                        }}
                      >
                        {createCommandMutation.isPending ? (
                          <LuxeLogoLoader size="small" />
                        ) : (
                          <Text className="font-semibold" style={{ color: colors.warning }}>Create</Text>
                        )}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={handleCancelEditing}
                      className="px-6 py-3 rounded-lg"
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="font-semibold" style={{ color: colors.text }}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Edit Command Form */}
              {editingCommandId && (
                <View className="mb-4 p-4 rounded-xl" style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}>
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.warning }}>
                    Edit Command
                  </Text>
                  <TextInput
                    value={newCommand}
                    onChangeText={setNewCommand}
                    className="rounded-lg px-4 py-3 text-base mb-2"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="/roast, /factcheck, etc."
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="none"
                    maxLength={50}
                  />
                  <Text className="text-xs font-semibold mb-2 mt-2" style={{ color: colors.warning }}>
                    Prompt for AI
                  </Text>
                  <TextInput
                    value={newPrompt}
                    onChangeText={setNewPrompt}
                    className="rounded-lg px-4 py-3 text-base mb-3"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="e.g., 'Roast the user's message in a funny way'"
                    placeholderTextColor={colors.inputPlaceholder}
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleUpdateCommand}
                      className="flex-1"
                      disabled={updateCommandMutation.isPending}
                    >
                      <View
                        style={{
                          borderRadius: 10,
                          padding: 12,
                          alignItems: "center",
                          backgroundColor: "rgba(255, 159, 10, 0.15)",
                          borderWidth: 1,
                          borderColor: "#FF9F0A",
                        }}
                      >
                        {updateCommandMutation.isPending ? (
                          <LuxeLogoLoader size="small" />
                        ) : (
                          <Text className="font-semibold" style={{ color: colors.warning }}>Update</Text>
                        )}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={handleCancelEditing}
                      className="px-6 py-3 rounded-lg"
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="font-semibold" style={{ color: colors.text }}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {customCommands.length > 0 ? (
                <View>
                  {customCommands.map((cmd) => (
                    <View
                      key={cmd.id}
                      className="p-3 rounded-lg mb-2"
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: "rgba(255, 159, 10, 0.2)",
                      }}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-base font-semibold" style={{ color: colors.warning }}>
                          {cmd.command}
                        </Text>
                        <View className="flex-row gap-2">
                          {canEdit && (
                            <>
                              <Pressable
                                onPress={() => handleEditCommand(cmd)}
                                disabled={isAddingCommand || editingCommandId !== null}
                              >
                                <Edit2 size={16} color={colors.text} />
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeleteCommand(cmd.id)}
                                disabled={deleteCommandMutation.isPending}
                              >
                                <Trash2 size={16} color={colors.error} />
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                      <Text className="text-sm" style={{ color: colors.textSecondary }} numberOfLines={2}>
                        {cmd.prompt}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : !isAddingCommand && (
                <Text className="text-sm text-center py-4" style={{ color: colors.textSecondary }}>
                  No custom commands yet. Tap + to create one!
                </Text>
              )}
            </View>

            {/* Notifications Section */}
            <View
              className="rounded-2xl p-5 mb-4"
              style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary + "26",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isMuted ? (
                      <BellOff size={20} color={colors.primary} />
                    ) : (
                      <Bell size={20} color={colors.primary} />
                    )}
                  </View>
                  <View>
                    <Text className="text-base font-semibold" style={{ color: colors.text }}>
                      Mute Notifications
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      Disable push notifications for this chat
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isMuted}
                  onValueChange={(value) => {
                    Haptics.selectionAsync();
                    muteChatMutation.mutate({ chatId, isMuted: value });
                  }}
                  trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                  thumbColor={colors.switchThumb}
                />
              </View>
            </View>

            {/* Admin Settings - Restricted Mode (Creator Only) */}
            {isCreator && (
              <View
                className="rounded-2xl p-5 mb-4"
                style={{
                  backgroundColor: colors.glassBackground,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  shadowColor: colors.glassShadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1 pr-4">
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.error + "26",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View style={{ position: 'relative' }}>
                        <Users size={20} color={colors.error} />
                        <View 
                          style={{ 
                            position: 'absolute', 
                            bottom: -2, 
                            right: -2, 
                            backgroundColor: colors.surface, 
                            borderRadius: 6 
                          }}
                        >
                          <View style={{ backgroundColor: '#FF3B30', borderRadius: 5, width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="lock-closed" size={6} color={colors.text} />
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-base font-semibold" style={{ color: colors.text }}>
                        Restricted Mode
                      </Text>
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>
                        Only the creator can invite members and change group settings
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isRestricted}
                    onValueChange={(value) => {
                      Haptics.selectionAsync();
                      updateSettingsMutation.mutate({ isRestricted: value });
                    }}
                    trackColor={{ false: colors.switchTrackOff, true: colors.error }}
                    thumbColor={colors.switchThumb}
                  />
                </View>
              </View>
            )}

            {/* Members List */}
            <View
              className="rounded-2xl p-5 mb-4"
              style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
                  MEMBERS ({chat?.members?.length || 0})
                </Text>
                {/* Invite Button - Hide in Restricted Mode if not Creator */}
                {(!isRestricted || isCreator) && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleGenerateInviteLink();
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View
                      className="flex-row items-center px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: colors.primary + "26",
                        borderWidth: 1,
                        borderColor: colors.primary + "4D",
                      }}
                    >
                      <UserPlus size={16} color={colors.primary} />
                      <Text className="ml-2 font-semibold text-sm" style={{ color: colors.primary }}>
                        Invite
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>
              {chat?.members?.map((member) => (
                <View
                  key={member.id}
                  className="flex-row items-center py-3"
                  style={{ borderBottomWidth: 0.5, borderBottomColor: colors.glassBorder }}
                >
                  {member.user?.image && getFullImageUrl(member.user.image) ? (
                    <Image
                      source={{ uri: getFullImageUrl(member.user.image) }}
                      className="w-12 h-12 rounded-full"
                      resizeMode="cover"
                      onError={(error) => {
                        console.error("[GroupSettings] Member image load error:", member.user?.name, error.nativeEvent.error);
                        console.error("[GroupSettings] Failed URL:", getFullImageUrl(member.user.image));
                      }}
                      onLoad={() => {
                        console.log("[GroupSettings] Member image loaded:", member.user?.name);
                      }}
                    />
                  ) : (
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: getColorFromName(member.user?.name),
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 18,
                          fontWeight: "600",
                        }}
                      >
                        {getInitials(member.user?.name)}
                      </Text>
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold" style={{ color: colors.text }}>
                      {member.user?.name || "Unknown"}
                    </Text>
                    {member.user?.bio && (
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {member.user.bio}
                      </Text>
                    )}
                  </View>
                  {/* Remove member button - only show for creator and not for themselves */}
                  {isCreator && member.userId !== user?.id && (
                    <Pressable
                      onPress={() => handleRemoveMember(member.userId, member.user?.name || "this member")}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.5 : 1,
                      })}
                    >
                      <View
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: colors.error + "26",
                          borderWidth: 1,
                          borderColor: colors.error + "4D",
                        }}
                      >
                        <X size={18} color={colors.error} />
                      </View>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {/* Clear Conversation Button */}
            <View
              className="rounded-2xl p-5"
              style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text className="text-sm font-semibold mb-3" style={{ color: colors.textSecondary }}>
                DANGER ZONE
              </Text>
              <Pressable
                onPress={handleClearConversation}
                disabled={clearMessagesMutation.isPending}
                className="flex-row items-center justify-center rounded-lg p-4"
                style={{
                  backgroundColor: colors.error + "26",
                  borderWidth: 1,
                  borderColor: "rgba(255, 59, 48, 0.5)",
                }}
              >
                {clearMessagesMutation.isPending ? (
                  <LuxeLogoLoader size="small" />
                ) : (
                  <>
                    <Trash2 size={20} color={colors.error} />
                    <Text className="font-semibold ml-2" style={{ color: colors.error }}>
                      Clear All Messages
                    </Text>
                  </>
                )}
              </Pressable>
              <Text className="text-xs mt-2 text-center" style={{ color: colors.textTertiary }}>
                This will permanently delete all messages from the conversation
              </Text>

              {/* Delete Chat Button - Creator Only */}
              {isCreator && (
                <>
                  <Pressable
                    onPress={handleDeleteChat}
                    disabled={deleteChatMutation.isPending}
                    className="flex-row items-center justify-center rounded-lg p-4 mt-3"
                    style={{
                      backgroundColor: "rgba(255, 59, 48, 0.2)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 59, 48, 0.7)",
                    }}
                  >
                    {deleteChatMutation.isPending ? (
                      <LuxeLogoLoader size="small" />
                    ) : (
                      <>
                        <Trash2 size={20} color={colors.error} />
                        <Text className="font-semibold ml-2" style={{ color: colors.error }}>
                          Delete Chat
                        </Text>
                      </>
                    )}
                  </Pressable>
                  <Text className="text-xs mt-2 text-center" style={{ color: colors.textTertiary }}>
                    This will permanently delete the entire chat, including all messages, settings, and member data
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Avatar Viewer Modal */}
        {imageUri && (
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
                backgroundColor: colors.background,
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
                  backgroundColor: colors.inputBackground,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={24} color={colors.text} />
              </Pressable>

              {/* Full-screen avatar image */}
              <Image
                source={{ uri: imageUri }}
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
                    color: colors.text,
                  }}
                >
                  {chat?.name || "Vibecode Chat"}
                </Text>
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Edit Profile Modal */}
        <Modal
          visible={showEditProfileModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEditProfileModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <Pressable 
              style={{ flex: 1, backgroundColor: colors.overlay }} 
              onPress={() => setShowEditProfileModal(false)}
            />
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 24,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: 20,
                maxHeight: "80%",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
                  Edit Group Info
                </Text>
                <Pressable
                  onPress={() => setShowEditProfileModal(false)}
                  style={{ padding: 4 }}
                >
                  <X size={24} color={colors.text} />
                </Pressable>
              </View>

              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                  GROUP NAME
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  className="rounded-lg px-4 py-3 text-base"
                  keyboardAppearance={isDark ? "dark" : "light"}
                  style={{
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  placeholder="Enter group name"
                  placeholderTextColor={colors.inputPlaceholder}
                  maxLength={50}
                />
              </View>

              <View className="mb-8">
                <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                  GROUP BIO
                </Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  className="rounded-lg px-4 py-3 text-base"
                  keyboardAppearance={isDark ? "dark" : "light"}
                  style={{
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.border,
                    minHeight: 100,
                    textAlignVertical: "top",
                  }}
                  placeholder="Enter group bio (optional)"
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                />
              </View>

              <Pressable
                onPress={handleSaveProfile}
                disabled={updateSettingsMutation.isPending}
                style={({ pressed }) => ({
                  opacity: pressed || updateSettingsMutation.isPending ? 0.7 : 1,
                })}
              >
                <LinearGradient
                  colors={["#4FC3F7", "#00A8E8"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: "center",
                  }}
                >
                  {updateSettingsMutation.isPending ? (
                    <LuxeLogoLoader size={20} />
                  ) : (
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "bold" }}>
                      Save Changes
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Invite Link Modal */}
        <Modal
          visible={showInviteModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowInviteModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: colors.overlay,
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingTop: 24,
                  paddingBottom: insets.bottom + 24,
                  paddingHorizontal: 20,
                }}
              >
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
                    Invite to Chat
                  </Text>
                  <Pressable
                    onPress={() => setShowInviteModal(false)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <X size={20} color={colors.text} />
                  </Pressable>
                </View>

                <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 20 }}>
                  Share this link with anyone to invite them to join this chat
                </Text>

                {/* Code & Link Display */}
                {generateInviteLinkMutation.isPending ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <LuxeLogoLoader size="small" />
                    <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }}>
                      Generating invite code...
                    </Text>
                  </View>
                ) : inviteLink ? (
                  <>
                    {/* Invite Code - Prominent Display */}
                    <View
                      style={{
                        backgroundColor: colors.primary + "26",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        borderWidth: 2,
                        borderColor: "rgba(79, 195, 247, 0.4)",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary, marginBottom: 12 }}>
                        INVITE CODE
                      </Text>
                      <Text
                        style={{
                          fontSize: 32,
                          fontWeight: "bold",
                          color: colors.text,
                          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                          letterSpacing: 4,
                        }}
                        selectable
                      >
                        {inviteToken || ""}
                      </Text>
                      <Text style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.5)", marginTop: 8, textAlign: "center" }}>
                        Share this code for others to join
                      </Text>
                    </View>

                    {/* Full Link (Collapsed) */}
                    <View
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255, 255, 255, 0.5)", marginBottom: 6 }}>
                        FULL LINK (OPTIONAL)
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: "rgba(255, 255, 255, 0.7)",
                          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                        }}
                        selectable
                        numberOfLines={2}
                        ellipsizeMode="middle"
                      >
                        {inviteLink}
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Pressable
                        onPress={async () => {
                          if (inviteToken) {
                            await Clipboard.setStringAsync(inviteToken);
                            setLinkCopied(true);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }
                        }}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          flex: 1,
                        })}
                      >
                        <View
                          style={{
                            backgroundColor: colors.primary + "26",
                            borderWidth: 1,
                            borderColor: "rgba(79, 195, 247, 0.3)",
                            borderRadius: 12,
                            paddingVertical: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {linkCopied ? (
                            <>
                              <Check size={20} color={colors.primary} />
                              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary, marginLeft: 8 }}>
                                Copied!
                              </Text>
                            </>
                          ) : (
                            <>
                              <Copy size={20} color={colors.primary} />
                              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary, marginLeft: 8 }}>
                                Copy Code
                              </Text>
                            </>
                          )}
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={async () => {
                          if (!inviteToken) return;
                          try {
                            await Share.share({
                              message: `Join our chat "${chat?.name}" on VibeChat!\n\nInvite Code: ${inviteToken}`,
                            });
                          } catch (error) {
                            console.error("Error sharing:", error);
                          }
                        }}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          flex: 1,
                        })}
                      >
                        <LinearGradient
                          colors={["#4FC3F7", "#00A8E8"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            borderRadius: 12,
                            paddingVertical: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Share2 size={20} color={colors.text} />
                          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginLeft: 8 }}>
                            Share
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={handleGenerateInviteLink}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <LinearGradient
                      colors={["#4FC3F7", "#00A8E8"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingVertical: 16,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>
                        Generate Invite Code
                      </Text>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Photo Gallery Modal */}
        <Modal
          visible={showPhotoGallery}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowPhotoGallery(false)}
        >
          <LinearGradient
            colors={colors.chatBackgroundGradient}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View
              style={{
                paddingTop: insets.top + 10,
                paddingBottom: 16,
                paddingHorizontal: 20,
                borderBottomWidth: 1,
                borderBottomColor: colors.glassBorder,
              }}
            >
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Images size={24} color={colors.text} />
                    <View>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                        Photo Gallery
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        {mediaMessages.length} {mediaMessages.length === 1 ? "item" : "items"}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setShowPhotoGallery(false)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={20} color={colors.text} />
                  </Pressable>
                </BlurView>
              </View>
            </View>

            {/* Media Grid */}
            {mediaMessages.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 40,
                }}
              >
                <Images size={64} color="#666" />
                <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: "600", marginTop: 16, textAlign: "center" }}>
                  No Media Yet
                </Text>
                <Text style={{ color: "#666", fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
                  Photos and videos shared in this chat will appear here
                </Text>
              </View>
            ) : (
              <FlashList
                data={mediaMessages}
                numColumns={3}
                keyExtractor={(item: any) => item.id}
                estimatedItemSize={Dimensions.get("window").width / 3}
                contentContainerStyle={{
                  padding: 0,
                  paddingBottom: insets.bottom + 20,
                }}
                renderItem={({ item }: { item: any }) => {
                  const isVideo = item.messageType === "video";
                  const thumbnailUrl = item.thumbnailUrl?.startsWith('http') 
                    ? item.thumbnailUrl 
                    : `${BACKEND_URL}${item.thumbnailUrl}`;
                  
                  const videoUrl = isVideo && item.url
                    ? (item.url.startsWith('http') ? item.url : `${BACKEND_URL}${item.url}`)
                    : null;
                  
                  return (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const sender = item.user;
                      // Hide gallery modal first to allow viewer to show on top
                      setShowPhotoGallery(false);
                      // Use setTimeout to ensure gallery closes before opening viewer
                      setTimeout(() => {
                        setGalleryViewerImage({
                          url: isVideo ? thumbnailUrl : (item.url?.startsWith('http') ? item.url : `${BACKEND_URL}${item.url}`),
                          senderName: sender?.name || "Unknown",
                          timestamp: new Date(item.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }),
                          messageId: item.messageId,
                          isVideo: isVideo,
                          videoUrl: videoUrl,
                        });
                      }, 100);
                    }}
                    style={{
                      width: Dimensions.get("window").width / 3,
                      height: Dimensions.get("window").width / 3,
                      padding: 0.5,
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: colors.background }}>
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                      {/* Video indicator overlay */}
                      {isVideo && (
                        <View style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0,0,0,0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.overlay,
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
                          </View>
                        </View>
                      )}
                      {/* Gradient overlay at bottom for date */}
                      <LinearGradient
                        colors={["transparent", "rgba(0, 0, 0, 0.7)"]}
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 40,
                          justifyContent: "flex-end",
                          paddingHorizontal: 8,
                          paddingBottom: 6,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 10, fontWeight: "600" }}>
                          {new Date(item.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </LinearGradient>
                    </View>
                  </Pressable>
                  );
                }}
              />
            )}
          </LinearGradient>
        </Modal>

        {/* Links Collection Modal */}
        <Modal
          visible={showLinksCollection}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowLinksCollection(false)}
        >
          <LinearGradient
            colors={colors.chatBackgroundGradient}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View
              style={{
                paddingTop: insets.top + 10,
                paddingBottom: 16,
                paddingHorizontal: 20,
                borderBottomWidth: 1,
                borderBottomColor: colors.glassBorder,
              }}
            >
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Link2 size={24} color={colors.text} />
                    <View>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                        Links Collection
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        {linkMessages.length} {linkMessages.length === 1 ? "link" : "links"}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setShowLinksCollection(false)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.inputBackground,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={20} color={colors.text} />
                  </Pressable>
                </BlurView>
              </View>
            </View>

            {/* Links List */}
            {linkMessages.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 40,
                }}
              >
                <Link2 size={64} color="#666" />
                <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: "600", marginTop: 16, textAlign: "center" }}>
                  No Links Yet
                </Text>
                <Text style={{ color: "#666", fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
                  Links shared in this chat will appear here
                </Text>
              </View>
            ) : (
              <FlashList
                data={linkMessages}
                keyExtractor={(item: any) => item.id}
                estimatedItemSize={200}
                contentContainerStyle={{
                  padding: 16,
                  paddingBottom: insets.bottom + 20,
                }}
                renderItem={({ item }: { item: any }) => (
                  <Pressable
                    onPress={() => {
                      if (item.linkPreview?.url) {
                        // Open link in browser
                        const url = item.linkPreview.url.startsWith('http') 
                          ? item.linkPreview.url 
                          : `https://${item.linkPreview.url}`;
                        require('react-native').Linking.openURL(url);
                      }
                    }}
                    style={{ marginBottom: 12 }}
                  >
                    <View
                      style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      {item.linkPreview?.linkPreviewImage && (
                        <Image
                          source={{ uri: item.linkPreview.linkPreviewImage }}
                          style={{
                            width: "100%",
                            height: 180,
                          }}
                          contentFit="cover"
                        />
                      )}
                      <View style={{ padding: 16 }}>
                        <Text
                          style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 6 }}
                          numberOfLines={2}
                        >
                          {item.linkPreview?.linkPreviewTitle || item.linkPreview?.url}
                        </Text>
                        {item.linkPreview?.linkPreviewDescription && (
                          <Text
                            style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8, lineHeight: 18 }}
                            numberOfLines={2}
                          >
                            {item.linkPreview.linkPreviewDescription}
                          </Text>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            {item.linkPreview?.linkPreviewFavicon && (
                              <Image
                                source={{ uri: item.linkPreview.linkPreviewFavicon }}
                                style={{ width: 16, height: 16, marginRight: 8, borderRadius: 4 }}
                                contentFit="contain"
                              />
                            )}
                            <Text style={{ color: "#666", fontSize: 12, flex: 1 }} numberOfLines={1}>
                              {item.linkPreview?.linkPreviewSiteName || 
                                (item.linkPreview?.url ? new URL(item.linkPreview.url).hostname : '')}
                            </Text>
                          </View>
                          <ExternalLink size={16} color={colors.primary} style={{ marginLeft: 8 }} />
                        </View>
                        <Text style={{ color: "#444", fontSize: 11, marginTop: 8 }}>
                          {new Date(item.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </LinearGradient>
        </Modal>

        {/* Gallery Media Viewer Modal - Rendered last to appear on top */}
        {galleryViewerImage && !galleryViewerImage.isVideo && (
          <ZoomableImageViewer
            visible={!!galleryViewerImage && !galleryViewerImage.isVideo}
            imageUrl={galleryViewerImage.url}
            senderName={galleryViewerImage.senderName}
            timestamp={galleryViewerImage.timestamp}
            messageId={galleryViewerImage.messageId}
            onClose={() => {
              setGalleryViewerImage(null);
              // Reopen the gallery after a brief delay
              setTimeout(() => {
                setShowPhotoGallery(true);
              }, 100);
            }}
            showToolbar={true}
          />
        )}

        {/* Gallery Video Viewer Modal */}
        {galleryViewerImage?.isVideo && galleryViewerImage?.videoUrl && (
          <FullscreenVideoModal
            visible={!!galleryViewerImage?.isVideo}
            videoUrl={galleryViewerImage.videoUrl}
            onClose={() => {
              setGalleryViewerImage(null);
              // Reopen the gallery after a brief delay
              setTimeout(() => {
                setShowPhotoGallery(true);
              }, 100);
            }}
          />
        )}
    </View>
  );
};

export default GroupSettingsScreen;
