import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import { Plus, MessageCircle, Users, X, ChevronRight, Search, Pin, LogOut, User } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { TapGestureHandler, State } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { api, BACKEND_URL } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import type { RootStackScreenProps } from "@/navigation/types";
import type { ChatWithMetadata, CreateChatRequest, GetUserChatsResponse, CreateChatResponse, UnreadCount } from "@/shared/contracts";

const ChatListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<"ChatList">["navigation"]>();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatBio, setNewChatBio] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenuChat, setContextMenuChat] = useState<ChatWithMetadata | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Fetch user's chats
  const { data: chats = [], isLoading, refetch, isFetching } = useQuery<GetUserChatsResponse>({
    queryKey: ["user-chats", user?.id],
    queryFn: () => api.get(`/api/chats?userId=${user?.id}`),
    enabled: !!user?.id,
  });

  // Fetch unread counts for all chats
  const { data: unreadCounts = [] } = useQuery<UnreadCount[]>({
    queryKey: ["unread-counts", user?.id],
    queryFn: () => api.get(`/api/chats/unread-counts?userId=${user?.id}`),
    enabled: !!user?.id,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Create a map of chatId -> unread count for quick lookup
  const unreadCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    unreadCounts.forEach((uc) => map.set(uc.chatId, uc.unreadCount));
    return map;
  }, [unreadCounts]);

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: (data: CreateChatRequest) => api.post<CreateChatResponse>("/api/chats", data),
    onSuccess: (newChat: CreateChatResponse) => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      setShowCreateModal(false);
      setNewChatName("");
      setNewChatBio("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to the new chat
      navigation.navigate("Chat", {
        chatId: newChat.id,
        chatName: newChat.name,
      });
    },
    onError: (error: any) => {
      console.error("Error creating chat:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to create chat. Please try again.");
    },
  });

  const handleCreateChat = async () => {
    if (!newChatName.trim()) {
      Alert.alert("Name Required", "Please enter a chat name");
      return;
    }

    setIsCreating(true);
    try {
      await createChatMutation.mutateAsync({
        name: newChatName.trim(),
        bio: newChatBio.trim() || null,
        creatorId: user!.id,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinChat = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Code Required", "Please enter an invite code");
      return;
    }

    setIsJoining(true);
    try {
      // Navigate to the Invite screen with the token
      setShowJoinModal(false);
      setInviteCode("");
      navigation.navigate("Invite", { token: inviteCode.trim() });
    } catch (error) {
      console.error("Error joining chat:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to join chat. Please check the invite code and try again.");
    } finally {
      setIsJoining(false);
    }
  };

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

  const handlePinChat = () => {
    if (!contextMenuChat) return;
    pinChatMutation.mutate({
      chatId: contextMenuChat.id,
      isPinned: !contextMenuChat.isPinned,
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

  const getFullImageUrl = (imageUrl: string | null | undefined): string => {
    if (!imageUrl) return "";
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    return `${BACKEND_URL}${imageUrl}`;
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

  // Split chats into pinned and unpinned
  const pinnedChats = React.useMemo(() => {
    return filteredChats.filter((chat) => chat.isPinned);
  }, [filteredChats]);

  const unpinnedChats = React.useMemo(() => {
    return filteredChats.filter((chat) => !chat.isPinned);
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
            shadowColor: unreadCount > 0 ? "#8B5CF6" : "#000",
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
                ? "rgba(138, 43, 226, 0.4)"
                : "rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={
                unreadCount > 0
                  ? [
                      "rgba(138, 43, 226, 0.25)",
                      "rgba(138, 43, 226, 0.15)",
                      "rgba(138, 43, 226, 0.08)",
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
              backgroundColor: "rgba(138, 43, 226, 0.2)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
              borderWidth: 2,
              borderColor: "rgba(138, 43, 226, 0.3)",
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
              <MessageCircle size={28} color="#8B5CF6" />
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
                <Text
                  style={{
                    fontSize: 13,
                    color: unreadCount > 0 ? "#8B5CF6" : "rgba(255, 255, 255, 0.5)",
                    marginLeft: 8,
                    fontWeight: unreadCount > 0 ? "600" : "400",
                  }}
                >
                  {formatTime(item.lastMessageAt)}
                </Text>
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
                    backgroundColor: "rgba(138, 43, 226, 0.3)",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, color: "#C084FC", fontWeight: "600" }}>
                    Creator
                  </Text>
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
            "rgba(138, 43, 226, 0.05)",
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
              "rgba(138, 43, 226, 0.15)",
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
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowJoinModal(true);
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <MaskedView
                  maskElement={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}>
                      <Users size={18} color="black" strokeWidth={2.5} />
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "black" }}>
                        Join
                      </Text>
                    </View>
                  }
                  style={{ height: 20, width: 70 }}
                >
                  <LinearGradient
                    colors={["#3B82F6", "#8B5CF6", "#EC4899"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </MaskedView>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowCreateModal(true);
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                })}
              >
                <MaskedView
                  maskElement={
                    <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                      <Plus size={24} color="black" strokeWidth={2.5} />
                    </View>
                  }
                  style={{ width: 24, height: 24 }}
                >
                  <LinearGradient
                    colors={["#3B82F6", "#8B5CF6", "#EC4899"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </MaskedView>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("Profile");
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                })}
              >
                <MaskedView
                  maskElement={
                    <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                      <User size={24} color="black" strokeWidth={2.5} />
                    </View>
                  }
                  style={{ width: 24, height: 24 }}
                >
                  <LinearGradient
                    colors={["#3B82F6", "#8B5CF6", "#EC4899"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </MaskedView>
              </Pressable>
            </View>
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
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : chats.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <MessageCircle size={64} color="rgba(255, 255, 255, 0.2)" strokeWidth={1.5} />
          <Text style={{ fontSize: 20, fontWeight: "600", color: "#FFFFFF", marginTop: 16, textAlign: "center" }}>
            No Chats Yet
          </Text>
          <Text style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.6)", marginTop: 8, textAlign: "center" }}>
            Create a new chat or join with an invite code
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <LinearGradient
                colors={["#8B5CF6", "#6366F1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 28,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
                  Create Chat
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => setShowJoinModal(true)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  paddingHorizontal: 28,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
                  Join Chat
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={[
            ...pinnedChats.map((chat) => ({ ...chat, section: "pinned" as const })),
            ...unpinnedChats.map((chat) => ({ ...chat, section: "unpinned" as const })),
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderChatItem({ item })}
          contentContainerStyle={{
            paddingTop: insets.top + 180, // Account for fixed header with search bar
            paddingBottom: insets.bottom + 16,
          }}
          ListHeaderComponent={
            pinnedChats.length > 0 && !searchQuery ? (
              <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Pin size={16} color="#8B5CF6" />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#8B5CF6",
                      marginLeft: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Pinned
                  </Text>
                </View>
              </View>
            ) : null
          }
          ItemSeparatorComponent={({ leadingItem }) => {
            // Add separator between pinned and unpinned sections
            if (leadingItem && pinnedChats.length > 0 && leadingItem.id === pinnedChats[pinnedChats.length - 1].id && unpinnedChats.length > 0) {
              return (
                <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <MessageCircle size={16} color="rgba(255, 255, 255, 0.5)" />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "rgba(255, 255, 255, 0.5)",
                        marginLeft: 8,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      All Chats
                    </Text>
                  </View>
                </View>
              );
            }
            return null;
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor="#8B5CF6"
            />
          }
        />
      )}

      {/* Create Chat Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: "#1A1A1A",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 24,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: 20,
              }}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "#FFFFFF" }}>
                  Create New Chat
                </Text>
                <Pressable
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewChatName("");
                    setNewChatBio("");
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <X size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Form */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF", marginBottom: 8 }}>
                  Chat Name <Text style={{ color: "#EF4444" }}>*</Text>
                </Text>
                <TextInput
                  value={newChatName}
                  onChangeText={setNewChatName}
                  placeholder="Enter chat name..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  maxLength={100}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: "#FFFFFF",
                  }}
                />
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF", marginBottom: 8 }}>
                  Description (Optional)
                </Text>
                <TextInput
                  value={newChatBio}
                  onChangeText={setNewChatBio}
                  placeholder="What's this chat about?"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  maxLength={200}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    color: "#FFFFFF",
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              {/* Create Button */}
              <Pressable
                onPress={handleCreateChat}
                disabled={isCreating || !newChatName.trim()}
                style={({ pressed }) => ({
                  opacity: pressed || isCreating || !newChatName.trim() ? 0.7 : 1,
                })}
              >
                <LinearGradient
                  colors={["#8B5CF6", "#6366F1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 17, fontWeight: "600", color: "#FFFFFF" }}>
                      Create Chat
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Chat Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: "#1A1A1A",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 24,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: 20,
              }}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "#FFFFFF" }}>
                  Join Chat
                </Text>
                <Pressable
                  onPress={() => {
                    setShowJoinModal(false);
                    setInviteCode("");
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <X size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Form */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF", marginBottom: 8 }}>
                  Invite Code <Text style={{ color: "#EF4444" }}>*</Text>
                </Text>
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Enter 8-character code..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  maxLength={8}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 18,
                    color: "#FFFFFF",
                    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                    letterSpacing: 2,
                  }}
                />
                <Text style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.5)", marginTop: 8 }}>
                  Enter the invite code shared with you
                </Text>
              </View>

              {/* Join Button */}
              <Pressable
                onPress={handleJoinChat}
                disabled={isJoining || !inviteCode.trim()}
                style={({ pressed }) => ({
                  opacity: pressed || isJoining || !inviteCode.trim() ? 0.7 : 1,
                })}
              >
                <LinearGradient
                  colors={["#8B5CF6", "#6366F1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 17, fontWeight: "600", color: "#FFFFFF" }}>
                      Join Chat
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                        backgroundColor: pressed ? "rgba(138, 43, 226, 0.15)" : "transparent",
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
                            backgroundColor: "rgba(138, 43, 226, 0.25)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 16,
                          }}
                        >
                          <Pin size={22} color="#A78BFA" strokeWidth={2.5} />
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
                        backgroundColor: pressed ? "rgba(138, 43, 226, 0.15)" : "transparent",
                        paddingVertical: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 16,
                      })}
                    >
                      <Text 
                        style={{ 
                          color: "#A78BFA", 
                          fontSize: 18, 
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        Cancel
                      </Text>
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
