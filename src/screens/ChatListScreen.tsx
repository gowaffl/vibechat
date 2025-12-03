import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image as RNImage,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MessageCircle, Users, X, ChevronRight, Search, Pin, LogOut, Bell, BellOff } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { TapGestureHandler, State } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { api, BACKEND_URL } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import type { RootStackScreenProps } from "@/navigation/types";
import type { ChatWithMetadata, GetUserChatsResponse, UnreadCount } from "@/shared/contracts";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { GradientIcon, BRAND_GRADIENT_COLORS } from "@/components/GradientIcon";
import { GradientText } from "@/components/GradientText";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";

// Separated component for performance optimization with memoization
const ChatItem = React.memo(({ 
  item, 
  unreadCount, 
  onPress, 
  onLongPress 
}: { 
  item: ChatWithMetadata, 
  unreadCount: number, 
  onPress: (chat: ChatWithMetadata) => void, 
  onLongPress: (chat: ChatWithMetadata) => void 
}) => {
  
  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 20,
          overflow: "hidden",
          shadowColor: unreadCount > 0 ? "#4FC3F7" : "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: unreadCount > 0 ? 0.4 : 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 40 : 80}
          tint="dark"
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: unreadCount > 0
              ? "rgba(79, 195, 247, 0.4)"
              : "rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={
              unreadCount > 0
                ? [
                    "rgba(79, 195, 247, 0.25)",
                    "rgba(79, 195, 247, 0.15)",
                    "rgba(79, 195, 247, 0.08)",
                  ]
                : [
                    "rgba(255, 255, 255, 0.08)",
                    "rgba(255, 255, 255, 0.05)",
                    "rgba(255, 255, 255, 0.02)",
                  ]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
              }}
            >
        {/* Chat Avatar */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "rgba(79, 195, 247, 0.2)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            borderWidth: 2,
            borderColor: "rgba(79, 195, 247, 0.3)",
            position: "relative",
          }}
        >
          {item.image ? (
            <Image
              source={{ uri: getFullImageUrl(item.image) }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
              }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <GradientIcon
              icon={<MessageCircle size={28} color="#000" />}
              style={{ width: 28, height: 28 }}
            />
          )}

          {/* Unread badge */}
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                backgroundColor: "#EF4444",
                borderRadius: 12,
                minWidth: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
                borderWidth: 2,
                borderColor: "#000000",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* Chat Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: unreadCount > 0 ? "700" : "600",
                color: "#FFFFFF",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.lastMessageAt && (
              unreadCount > 0 ? (
                <GradientText
                  style={{
                    fontSize: 13,
                    marginLeft: 8,
                    fontWeight: "600",
                  }}
                >
                  {formatTime(item.lastMessageAt)}
                </GradientText>
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    color: "rgba(255, 255, 255, 0.5)",
                    marginLeft: 8,
                    fontWeight: "400",
                  }}
                >
                  {formatTime(item.lastMessageAt)}
                </Text>
              )
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Users size={14} color="rgba(255, 255, 255, 0.5)" />
            <Text
              style={{
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.5)",
                marginLeft: 4,
                marginRight: 12,
              }}
            >
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
            {item.isCreator && (
              <View
                style={{
                  backgroundColor: "rgba(79, 195, 247, 0.15)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(79, 195, 247, 0.3)",
                }}
              >
                <GradientText style={{ fontSize: 11, fontWeight: "600" }}>
                  Creator
                </GradientText>
              </View>
            )}
          </View>

          {item.lastMessage && (
            <Text
              style={{
                fontSize: 14,
                color: unreadCount > 0 ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.6)",
                marginTop: 4,
                fontWeight: unreadCount > 0 ? "500" : "400",
              }}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
          )}
        </View>

        {/* Arrow */}
        <ChevronRight size={20} color="rgba(255, 255, 255, 0.3)" style={{ marginLeft: 8 }} />
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </Pressable>
  );
});

const ChatListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<"ChatList">["navigation"]>();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenuChat, setContextMenuChat] = useState<ChatWithMetadata | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Fetch user's chats
  const { data: chats = [], isLoading, refetch, isFetching } = useQuery<GetUserChatsResponse>({
    queryKey: ["user-chats", user?.id],
    queryFn: () => api.get(`/api/chats?userId=${user?.id}`),
    enabled: !!user?.id,
  });

  // Fetch unread counts for all chats using shared hook
  const { data: unreadCounts = [], refetch: refetchUnread } = useUnreadCounts(user?.id);

  // Create a map of chatId -> unread count for quick lookup
  const unreadCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    unreadCounts.forEach((uc) => map.set(uc.chatId, uc.unreadCount));
    return map;
  }, [unreadCounts]);

  const handleChatPress = (chat: ChatWithMetadata) => {
    Haptics.selectionAsync();
    navigation.navigate("Chat", {
      chatId: chat.id,
      chatName: chat.name,
    });
  };

  const handleLongPress = (chat: ChatWithMetadata) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContextMenuChat(chat);
    setShowContextMenu(true);
  };

  // Pin/unpin chat mutation
  const pinChatMutation = useMutation({
    mutationFn: ({ chatId, isPinned }: { chatId: string; isPinned: boolean }) =>
      api.patch(`/api/chats/${chatId}/pin`, { userId: user!.id, isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update pin status");
    },
  });

  // Leave chat mutation
  const leaveChatMutation = useMutation({
    mutationFn: (chatId: string) =>
      api.delete(`/api/chats/${chatId}/members/${user!.id}`, { removerId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Left Chat", "You have left the chat successfully");
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error?.message || "Failed to leave chat";
      Alert.alert("Error", errorMessage);
    },
  });

  // Mute chat mutation
  const muteChatMutation = useMutation({
    mutationFn: ({ chatId, isMuted }: { chatId: string; isMuted: boolean }) =>
      api.patch(`/api/chats/${chatId}/mute`, { userId: user!.id, isMuted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage = error?.message || "Failed to update mute status";
      Alert.alert("Error", errorMessage);
    },
  });

  const handlePinChat = () => {
    if (!contextMenuChat) return;
    pinChatMutation.mutate({
      chatId: contextMenuChat.id,
      isPinned: !contextMenuChat.isPinned,
    });
    setShowContextMenu(false);
  };

  const handleMuteChat = () => {
    if (!contextMenuChat) return;
    muteChatMutation.mutate({
      chatId: contextMenuChat.id,
      isMuted: !contextMenuChat.isMuted,
    });
    setShowContextMenu(false);
  };

  const handleLeaveChat = () => {
    if (!contextMenuChat) return;
    setShowContextMenu(false);
    
    Alert.alert(
      "Leave Chat",
      `Are you sure you want to leave "${contextMenuChat.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => leaveChatMutation.mutate(contextMenuChat.id),
        },
      ]
    );
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Filter chats based on search query
  const filteredChats = React.useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(query) ||
        (chat.bio && chat.bio.toLowerCase().includes(query)) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(query))
    );
  }, [chats, searchQuery]);

  // Split chats into pinned and unpinned and sort them
  const pinnedChats = React.useMemo(() => {
    const pinned = filteredChats.filter((chat) => chat.isPinned);
    // Sort by lastMessageAt or createdAt, descending
    return pinned.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredChats]);

  const unpinnedChats = React.useMemo(() => {
    const unpinned = filteredChats.filter((chat) => !chat.isPinned);
    // Sort by lastMessageAt or createdAt, descending
    return unpinned.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredChats]);

  const renderChatItem = ({ item }: { item: ChatWithMetadata }) => {
    const unreadCount = unreadCountMap.get(item.id) || 0;

    return (
      <Pressable
        onPress={() => handleChatPress(item)}
        onLongPress={() => handleLongPress(item)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 20,
            overflow: "hidden",
            shadowColor: unreadCount > 0 ? "#4FC3F7" : "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: unreadCount > 0 ? 0.4 : 0.2,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <BlurView
            intensity={Platform.OS === "ios" ? 40 : 80}
            tint="dark"
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: unreadCount > 0
                ? "rgba(79, 195, 247, 0.4)"
                : "rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={
                unreadCount > 0
                  ? [
                      "rgba(79, 195, 247, 0.25)",
                      "rgba(79, 195, 247, 0.15)",
                      "rgba(79, 195, 247, 0.08)",
                    ]
                  : [
                      "rgba(255, 255, 255, 0.08)",
                      "rgba(255, 255, 255, 0.05)",
                      "rgba(255, 255, 255, 0.02)",
                    ]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                }}
              >
          {/* Chat Avatar */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "rgba(79, 195, 247, 0.2)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
              borderWidth: 2,
              borderColor: "rgba(79, 195, 247, 0.3)",
              position: "relative",
            }}
          >
            {item.image ? (
              <Image
                source={{ uri: getFullImageUrl(item.image) }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                }}
              />
            ) : (
              <GradientIcon
                icon={<MessageCircle size={28} color="#000" />}
                style={{ width: 28, height: 28 }}
              />
            )}

            {/* Unread badge */}
            {unreadCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  backgroundColor: "#EF4444",
                  borderRadius: 12,
                  minWidth: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                  borderWidth: 2,
                  borderColor: "#000000",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </View>

          {/* Chat Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: unreadCount > 0 ? "700" : "600",
                  color: "#FFFFFF",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.lastMessageAt && (
                unreadCount > 0 ? (
                  <GradientText
                    style={{
                      fontSize: 13,
                      marginLeft: 8,
                      fontWeight: "600",
                    }}
                  >
                    {formatTime(item.lastMessageAt)}
                  </GradientText>
                ) : (
                  <Text
                    style={{
                      fontSize: 13,
                      color: "rgba(255, 255, 255, 0.5)",
                      marginLeft: 8,
                      fontWeight: "400",
                    }}
                  >
                    {formatTime(item.lastMessageAt)}
                  </Text>
                )
              )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Users size={14} color="rgba(255, 255, 255, 0.5)" />
              <Text
                style={{
                  fontSize: 14,
                  color: "rgba(255, 255, 255, 0.5)",
                  marginLeft: 4,
                  marginRight: 12,
                }}
              >
                {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
              </Text>
              {item.isCreator && (
                <View
                  style={{
                    backgroundColor: "rgba(79, 195, 247, 0.15)",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(79, 195, 247, 0.3)",
                  }}
                >
                  <GradientText style={{ fontSize: 11, fontWeight: "600" }}>
                    Creator
                  </GradientText>
                </View>
              )}
            </View>

            {item.lastMessage && (
              <Text
                style={{
                  fontSize: 14,
                  color: unreadCount > 0 ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.6)",
                  marginTop: 4,
                  fontWeight: unreadCount > 0 ? "500" : "400",
                }}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            )}
          </View>

          {/* Arrow */}
          <ChevronRight size={20} color="rgba(255, 255, 255, 0.3)" style={{ marginLeft: 8 }} />
              </View>
            </LinearGradient>
          </BlurView>
        </View>
      </Pressable>
    );
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
        {/* Subtle animated overlay */}
        <LinearGradient
          colors={[
            "rgba(79, 195, 247, 0.05)",
            "rgba(0, 122, 255, 0.03)",
            "transparent",
            "rgba(52, 199, 89, 0.03)",
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

      {/* Liquid Glass Header */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <BlurView
          intensity={80}
          tint="dark"
          style={{
            paddingTop: insets.top + 16,
            paddingBottom: 16,
            paddingHorizontal: 20,
            backgroundColor: Platform.OS === "ios" ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.85)",
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <LinearGradient
            colors={[
              "rgba(79, 195, 247, 0.15)",
              "rgba(0, 122, 255, 0.1)",
              "rgba(0, 0, 0, 0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.5,
            }}
          />
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <TapGestureHandler
              numberOfTaps={3}
              onHandlerStateChange={({ nativeEvent }) => {
                if (nativeEvent.state === State.ACTIVE) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  navigation.navigate("OnboardingName");
                }
              }}
            >
              <View>
                <Text style={{ fontSize: 32, fontWeight: "bold", color: "#FFFFFF" }}>
                  Chats
                </Text>
              </View>
            </TapGestureHandler>
          </View>

          {/* Search Bar */}
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <BlurView
              intensity={Platform.OS === "ios" ? 40 : 80}
              tint="dark"
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.1)",
                  "rgba(255, 255, 255, 0.05)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 2 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderRadius: 14,
                  }}
                >
                  <Search size={20} color="rgba(255, 255, 255, 0.6)" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search chats..."
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    keyboardAppearance="dark"
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 16,
                      color: "#FFFFFF",
                    }}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <X size={20} color="rgba(255, 255, 255, 0.6)" />
                    </Pressable>
                  )}
                </View>
              </LinearGradient>
            </BlurView>
          </View>
        </View>
        </BlurView>
      </View>

      {/* Chat List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LuxeLogoLoader size="large" />
        </View>
      ) : chats.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <RNImage
            source={require("../../assets/vibechat mascot logo.png")}
            style={{ width: 280, height: 280, marginBottom: 24 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 16, fontWeight: "500", color: "rgba(255, 255, 255, 0.7)", marginBottom: 32, textAlign: "center", lineHeight: 22 }}>
            🦎 Meet Glitch the Gecko — He licked a{'\n'}glowing fiber optic cable and gained{'\n'}the power to connect any vibe, anywhere
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "600", color: "#FFFFFF", marginBottom: 24, textAlign: "center" }}>
            No chats yet
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate("CreateChat");
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                borderRadius: 16,
                overflow: "hidden",
                shadowColor: "#4FC3F7",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <LinearGradient
                colors={["#4FC3F7", "#007AFF", "#34C759"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 32,
                  paddingVertical: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#000000" }}>
                  Create a Chat
                </Text>
              </LinearGradient>
            </View>
          </Pressable>
        </View>
      ) : (
          <FlashList
            data={[
              ...pinnedChats.map((chat) => ({ ...chat, section: "pinned" as const })),
              ...unpinnedChats.map((chat) => ({ ...chat, section: "unpinned" as const })),
            ]}
            keyExtractor={(item) => item.id}
            estimatedItemSize={100}
            // HIGH-B: Performance optimization - drawDistance for smoother scrolling
            drawDistance={300}
            renderItem={({ item }) => (
              <ChatItem 
                item={item} 
                unreadCount={unreadCountMap.get(item.id) || 0} 
                onPress={handleChatPress} 
                onLongPress={handleLongPress} 
              />
            )}
            contentContainerStyle={{
              paddingTop: insets.top + 160,
              paddingBottom: insets.bottom + 100,
            }}
            ListHeaderComponent={
              pinnedChats.length > 0 && !searchQuery ? (
                <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <GradientIcon
                      icon={<Pin size={16} color="#000" />}
                      style={{ width: 16, height: 16 }}
                    />
                    <GradientText
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        marginLeft: 8,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Pinned
                    </GradientText>
                  </View>
                </View>
              ) : null
            }
            ItemSeparatorComponent={() => null} // Separators are handled within renderItem logic or we can adjust data structure. But let's keep logic simple.
            // FlashList doesn't support functional ItemSeparatorComponent with 'leadingItem' in the same way easily.
            // We should handle section headers/separators in the data array or renderItem. 
            // For now, to keep it simple and quick, I'll move the "All Chats" separator logic into the data source or a specialized cell.
            // But wait, I can just insert a "separator" item in the data.
            
            refreshControl={
              <RefreshControl
                refreshing={isFetching}
                onRefresh={refetch}
                tintColor={BRAND_GRADIENT_COLORS[0]}
              />
            }
          />
      )}

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
          onPress={() => setShowContextMenu(false)}
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%" }}
          >
            <View
              style={{
                marginHorizontal: 16,
                borderRadius: 24,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.6,
                shadowRadius: 32,
                elevation: 12,
              }}
            >
              <BlurView
                intensity={Platform.OS === "ios" ? 90 : 100}
                tint="dark"
                style={{
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                <LinearGradient
                  colors={[
                    "rgba(40, 40, 50, 0.98)",
                    "rgba(30, 30, 40, 0.98)",
                    "rgba(20, 20, 30, 0.98)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingBottom: 8 }}
                >
                  {/* Chat Name Header */}
                  <View 
                    style={{ 
                      paddingHorizontal: 24, 
                      paddingTop: 24,
                      paddingBottom: 20,
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "700",
                        color: "#FFFFFF",
                        textAlign: "center",
                        letterSpacing: 0.3,
                      }}
                      numberOfLines={2}
                    >
                      {contextMenuChat?.name}
                    </Text>
                  </View>

                  {/* Menu Options */}
                  <View style={{ paddingTop: 8, paddingBottom: 8 }}>
                    {/* Pin/Unpin Option */}
                    <Pressable
                      onPress={handlePinChat}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? "rgba(79, 195, 247, 0.15)" : "transparent",
                        marginHorizontal: 12,
                        borderRadius: 16,
                        marginVertical: 4,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 18,
                        }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: "rgba(79, 195, 247, 0.15)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 16,
                          }}
                        >
                          <GradientIcon
                            icon={<Pin size={22} color="#000" strokeWidth={2.5} />}
                            style={{ width: 22, height: 22 }}
                          />
                        </View>
                        <Text 
                          style={{ 
                            color: "#FFFFFF", 
                            fontSize: 18, 
                            fontWeight: "600",
                            flex: 1,
                          }}
                        >
                          {contextMenuChat?.isPinned ? "Unpin Chat" : "Pin Chat"}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Mute/Unmute Option */}
                    <Pressable
                      onPress={handleMuteChat}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? "rgba(79, 195, 247, 0.15)" : "transparent",
                        marginHorizontal: 12,
                        borderRadius: 16,
                        marginVertical: 4,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 18,
                        }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: "rgba(79, 195, 247, 0.15)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 16,
                          }}
                        >
                          <GradientIcon
                            icon={contextMenuChat?.isMuted ? <Bell size={22} color="#000" strokeWidth={2.5} /> : <BellOff size={22} color="#000" strokeWidth={2.5} />}
                            style={{ width: 22, height: 22 }}
                          />
                        </View>
                        <Text 
                          style={{ 
                            color: "#FFFFFF", 
                            fontSize: 18, 
                            fontWeight: "600",
                            flex: 1,
                          }}
                        >
                          {contextMenuChat?.isMuted ? "Unmute Chat" : "Mute Chat"}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Leave Chat Option */}
                    {!contextMenuChat?.isCreator && (
                      <Pressable
                        onPress={handleLeaveChat}
                        style={({ pressed }) => ({
                          backgroundColor: pressed ? "rgba(239, 68, 68, 0.15)" : "transparent",
                          marginHorizontal: 12,
                          borderRadius: 16,
                          marginVertical: 4,
                        })}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 20,
                            paddingVertical: 18,
                          }}
                        >
                          <View
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 21,
                              backgroundColor: "rgba(239, 68, 68, 0.25)",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 16,
                            }}
                          >
                            <LogOut size={22} color="#EF4444" strokeWidth={2.5} />
                          </View>
                          <Text 
                            style={{ 
                              color: "#EF4444", 
                              fontSize: 18, 
                              fontWeight: "600",
                              flex: 1,
                            }}
                          >
                            Leave Chat
                          </Text>
                        </View>
                      </Pressable>
                    )}
                  </View>

                  {/* Cancel Button */}
                  <View 
                    style={{ 
                      borderTopWidth: 1, 
                      borderTopColor: "rgba(255, 255, 255, 0.06)",
                      marginTop: 12,
                      paddingTop: 12,
                      paddingBottom: 4,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => setShowContextMenu(false)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? "rgba(79, 195, 247, 0.15)" : "transparent",
                        paddingVertical: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 16,
                      })}
                    >
                      <GradientText
                        style={{
                          fontSize: 18,
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        Cancel
                      </GradientText>
                    </Pressable>
                  </View>
                </LinearGradient>
              </BlurView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default ChatListScreen;
