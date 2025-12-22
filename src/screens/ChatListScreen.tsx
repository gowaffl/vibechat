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
  KeyboardAvoidingView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MessageCircle, Users, X, ChevronRight, Search, Pin, LogOut, Bell, BellOff } from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { TapGestureHandler, State } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { api, BACKEND_URL } from "@/lib/api";
import { supabaseClient } from "@/lib/authClient";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import type { RootStackScreenProps } from "@/navigation/types";
import type { ChatWithMetadata, GetUserChatsResponse, UnreadCount } from "@/shared/contracts";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { GradientIcon, BRAND_GRADIENT_COLORS } from "@/components/GradientIcon";
import { GradientText } from "@/components/GradientText";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { CustomRefreshControl } from "@/components/CustomRefreshControl";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchMessagesResponse, SearchMessageResult, GlobalSearchResponse } from "@/shared/contracts";
import { ColorPalette } from "@/constants/theme";

// Section Header Component
const SectionHeader = ({ title, count, onSeeAll }: { title: string, count: number, onSeeAll?: () => void }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      marginTop: 24, 
      marginBottom: 12 
    }}>
      <Text style={{ 
        fontSize: 15, 
        fontWeight: '700', 
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>
        {title}
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
            See All
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// Separated component for performance optimization with memoization
const ChatItem = React.memo(({ 
  item, 
  unreadCount, 
  onPress, 
  onLongPress,
  colors,
  isDark
}: { 
  item: ChatWithMetadata, 
  unreadCount: number, 
  onPress: (chat: ChatWithMetadata) => void, 
  onLongPress: (chat: ChatWithMetadata) => void,
  colors: ColorPalette,
  isDark: boolean
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
          shadowColor: unreadCount > 0 
            ? colors.primary 
            : (isDark ? colors.glassShadow : "rgba(0, 0, 0, 0.15)"),
          shadowOffset: { width: 0, height: isDark ? 4 : 2 },
          shadowOpacity: unreadCount > 0 ? 0.4 : (isDark ? 0.2 : 0.12),
          shadowRadius: isDark ? 8 : 10,
          elevation: isDark ? 4 : 3,
        }}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? (isDark ? 40 : 60) : 80}
          tint={isDark ? "dark" : "light"}
          style={{
            borderRadius: 20,
            borderWidth: isDark ? 1 : 1.5,
            borderColor: unreadCount > 0
              ? (isDark ? "rgba(79, 195, 247, 0.4)" : "rgba(0, 122, 255, 0.4)")
              : (isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)"),
            overflow: "hidden",
            backgroundColor: isDark ? "transparent" : "rgba(255, 255, 255, 0.85)"
          }}
        >
          <LinearGradient
            colors={
              unreadCount > 0
                ? (isDark 
                    ? [
                        "rgba(79, 195, 247, 0.25)",
                        "rgba(79, 195, 247, 0.15)",
                        "rgba(79, 195, 247, 0.08)",
                      ]
                    : [
                        "rgba(0, 122, 255, 0.12)",
                        "rgba(0, 122, 255, 0.08)",
                        "rgba(255, 255, 255, 0.95)",
                      ])
                : (isDark
                    ? [
                        "rgba(255, 255, 255, 0.08)",
                        "rgba(255, 255, 255, 0.05)",
                        "rgba(255, 255, 255, 0.02)",
                      ]
                    : [
                        "rgba(255, 255, 255, 0.98)",
                        "rgba(255, 255, 255, 0.95)",
                        "rgba(250, 250, 250, 0.92)",
                      ])
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
            backgroundColor: isDark ? "rgba(79, 195, 247, 0.2)" : "rgba(0, 122, 255, 0.1)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            borderWidth: 2,
            borderColor: isDark ? "rgba(79, 195, 247, 0.3)" : "rgba(0, 122, 255, 0.2)",
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
              icon={<MessageCircle size={28} color={colors.text} />}
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
                backgroundColor: colors.notification || "#EF4444",
                borderRadius: 12,
                minWidth: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
                borderWidth: 2,
                borderColor: colors.background,
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
                color: colors.text,
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
                    color: colors.textTertiary,
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
            <Users size={14} color={colors.textTertiary} />
            <Text
              style={{
                fontSize: 14,
                color: colors.textTertiary,
                marginLeft: 4,
                marginRight: 12,
              }}
            >
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
            {item.isCreator && (
              <View
                style={{
                  backgroundColor: isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(79, 195, 247, 0.3)" : "rgba(0, 122, 255, 0.2)",
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
                color: unreadCount > 0 ? colors.textSecondary : colors.textTertiary,
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
        <ChevronRight size={20} color={colors.textTertiary} style={{ marginLeft: 8 }} />
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </Pressable>
  );
});

import { useSearchStore } from "@/stores/searchStore";
import { CreateChatFAB } from "@/components/CreateChatFAB";
import { SearchFilters } from "@/components/Search/SearchFilters";
import { HighlightText } from "@/components/HighlightText";

const ChatListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<"ChatList">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const { searchQuery, searchMode, filters } = useSearchStore();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isDebouncing = searchQuery !== debouncedSearchQuery;
  const [contextMenuChat, setContextMenuChat] = useState<ChatWithMetadata | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = React.useMemo(() => {
    return Object.values(filters).some(v => {
      if (Array.isArray(v)) return v.length > 0;
      return !!v;
    });
  }, [filters]);

  const isSearchActive = searchQuery.trim().length > 0 || hasActiveFilters;

  // Fetch user's chats
  const { data: chats = [], isLoading, refetch } = useQuery<GetUserChatsResponse>({
    queryKey: ["user-chats", user?.id],
    queryFn: () => api.get(`/api/chats?userId=${user?.id}`),
    enabled: !!user?.id,
  });

  // Fetch unread counts for all chats using shared hook
  const { data: unreadCounts = [], refetch: refetchUnread } = useUnreadCounts(user?.id);

  // Global Search Query
  const { 
    data: searchData, 
    isLoading: isSearching, 
  } = useQuery<GlobalSearchResponse>({
    queryKey: ["global-search", debouncedSearchQuery, searchMode, filters],
    queryFn: () => api.post("/api/search/global", { 
      userId: user!.id, 
      query: debouncedSearchQuery,
      limit: 20
    }),
    enabled: !!user?.id && (debouncedSearchQuery.trim().length > 0),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
  });

  const searchResults = React.useMemo(() => {
    if (!searchData) return { chats: [], users: [], messages: [] };
    return searchData;
  }, [searchData]);

  // Ref to track current chat IDs for filtering realtime events
  const chatIdsRef = React.useRef<Set<string>>(new Set());

  // Update chat IDs ref when chats change
  React.useEffect(() => {
    if (chats) {
      chatIdsRef.current = new Set(chats.map((c) => c.id));
      
      // Prefetch messages for top 5 chats to ensure instant load
      if (chats.length > 0 && user?.id) {
        const sortedChats = [...chats].sort((a, b) => {
          const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
          const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA;
        });

        const topChats = sortedChats.slice(0, 5);
        
        topChats.forEach((chat) => {
          queryClient.prefetchQuery({
            queryKey: ["messages", chat.id],
            queryFn: async () => {
              return await api.get(
                `/api/chats/${chat.id}/messages?userId=${user.id}`
              );
            },
            staleTime: 1000 * 60,
          });
        });
      }
    }
  }, [chats, user?.id, queryClient]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchUnread()]);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  }, [refetch, refetchUnread]);

  // Auto-update on focus
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchUnread();
      setIsRefreshing(false);
    }, [refetch, refetchUnread])
  );

  // Real-time updates for new messages - OPTIMISTIC UPDATE for instant UI
  React.useEffect(() => {
    if (!user?.id) return;

    const channel = supabaseClient
      .channel(`chat-list-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message",
        },
        (payload: any) => {
          const incomingChatId = payload.new.chatId;
          if (chatIdsRef.current.has(incomingChatId)) {
            // OPTIMISTIC UPDATE: Immediately move chat to top and update lastMessageAt
            // This eliminates the 2-second delay waiting for refetch
            queryClient.setQueryData<GetUserChatsResponse>(
              ["user-chats", user.id],
              (oldChats) => {
                if (!oldChats) return oldChats;
                
                const chatIndex = oldChats.findIndex((c) => c.id === incomingChatId);
                if (chatIndex === -1) return oldChats;
                
                // Create updated chat with new lastMessageAt
                const updatedChat = {
                  ...oldChats[chatIndex],
                  lastMessageAt: payload.new.createdAt,
                };
                
                // Move updated chat to top of list
                const filteredChats = oldChats.filter((_, i) => i !== chatIndex);
                return [updatedChat, ...filteredChats];
              }
            );
            
            // Background refetch for complete details (lastMessage content, etc.)
            // This runs in background while UI is already updated
            refetch();
            refetchUnread();
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [user?.id, refetch, refetchUnread, queryClient]);

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

  const handleSearchResultPress = (result: SearchMessageResult) => {
    Haptics.selectionAsync();
    navigation.navigate("Chat", {
      chatId: result.chat.id,
      chatName: result.chat.name,
      messageId: result.message.id,
    });
  };

  const handleLongPress = (chat: ChatWithMetadata) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (user?.id) {
      queryClient.prefetchQuery({
        queryKey: ["messages", chat.id],
        queryFn: async () => {
          return await api.get(
            `/api/chats/${chat.id}/messages?userId=${user.id}`
          );
        },
      });
    }
    
    setContextMenuChat(chat);
    setShowContextMenu(true);
  };

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

  const pinnedChats = React.useMemo(() => {
    const pinned = filteredChats.filter((chat) => chat.isPinned);
    return pinned.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredChats]);

  const unpinnedChats = React.useMemo(() => {
    const unpinned = filteredChats.filter((chat) => !chat.isPinned);
    return unpinned.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredChats]);

  const renderSearchResult = ({ item }: { item: SearchMessageResult }) => {
    const isSemantic = item.matchedField === "content" && item.similarity;
    const matchLabel = item.matchedField === "transcription" ? "Voice Match" 
                     : item.matchedField === "description" ? "Image Match" 
                     : null;

    return (
      <Pressable
        onPress={() => handleSearchResultPress(item)}
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
            {/* Header: Sender Name + Chat Name + Time */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
                    {item.message.user?.name || "Unknown"}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginLeft: 6 }}>
                    in {item.chat.name}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
                {formatTime(item.message.createdAt)}
              </Text>
            </View>

            {/* Match Indicator */}
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

            {/* Message Content */}
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
  
  const backgroundGradientColors = isDark 
    ? ["#000000", "#0A0A0F", "#050508", "#000000"]
    : ["#F5F5F4", "#EDEDED", "#F0F0EF", "#F5F5F4"]; // Slightly warmer/darker for better card contrast

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CustomRefreshControl 
        refreshing={isRefreshing} 
        message="Refreshing chats" 
        topOffset={insets.top + 80}
      />
      
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
          colors={backgroundGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        {/* Subtle animated overlay */}
        <LinearGradient
          colors={[
            isDark ? "rgba(79, 195, 247, 0.05)" : "rgba(0, 122, 255, 0.03)",
            isDark ? "rgba(0, 122, 255, 0.03)" : "rgba(0, 122, 255, 0.02)",
            "transparent",
            isDark ? "rgba(52, 199, 89, 0.03)" : "rgba(52, 199, 89, 0.02)",
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
          tint={isDark ? "dark" : "light"}
          style={{
            paddingTop: insets.top + 4,
            paddingBottom: 4,
            paddingHorizontal: 20,
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
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.5,
            }}
          />
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
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
                <Image
                  source={require("../../assets/vibechat text only.png")}
                  style={{ width: 225, height: 55 }}
                  contentFit="contain"
                />
              </View>
            </TapGestureHandler>
          </View>
        </View>
        </BlurView>
      </View>

      {/* Chat List or Search Results */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      {isSearchActive ? (
        // Search Mode
        (isSearching && !searchData) || isDebouncing ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <LuxeLogoLoader size="large" />
            <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 15, fontWeight: "500" }}>
              {isDebouncing ? "Typing..." : "Searching messages..."}
            </Text>
          </View>
        ) : (searchResults.chats.length === 0 && searchResults.users.length === 0 && searchResults.messages.length === 0) ? (
          <View style={{ flex: 1, paddingHorizontal: 32 }}>
            <View style={{ marginBottom: 24, marginTop: insets.top + 80 }}>
                <SearchFilters />
            </View>
            <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textSecondary, textAlign: "center" }}>
                No results found {searchQuery ? `for "${searchQuery}"` : ""}
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 100,
              paddingBottom: insets.bottom + 100,
            }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ marginBottom: 12 }}>
              <SearchFilters />
              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16, marginTop: 8 }} />
            </View>

            {/* Chats Section */}
            {searchResults.chats.length > 0 && (
              <View>
                <SectionHeader title="Chats" count={searchResults.chats.length} />
                {searchResults.chats.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    item={chat}
                    unreadCount={0}
                    onPress={handleChatPress}
                    onLongPress={handleLongPress}
                    colors={colors}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}

            {/* People Section */}
            {searchResults.users.length > 0 && (
              <View>
                <SectionHeader title="People" count={searchResults.users.length} />
                {searchResults.users.map((u) => (
                  <Pressable
                    key={u.id}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      paddingHorizontal: 16,
                      marginBottom: 12
                    })}
                    onPress={() => {
                        // Navigate to chat with this user (create or open)
                    }}
                  >
                    <BlurView
                        intensity={Platform.OS === "ios" ? (isDark ? 20 : 60) : 40}
                        tint={isDark ? "dark" : "light"}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 16,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: colors.glassBorder
                        }}
                    >
                        {u.image ? (
                          <Image 
                              source={{ uri: getFullImageUrl(u.image) }}
                              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                          />
                        ) : (
                          <View style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={20} color={colors.textSecondary} />
                          </View>
                        )}
                        <View>
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{u.name}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{u.bio || "No bio"}</Text>
                        </View>
                    </BlurView>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Messages Section */}
            {searchResults.messages.length > 0 && (
              <View>
                <SectionHeader title="Messages" count={searchResults.messages.length} />
                {searchResults.messages.map((item) => (
                    <View key={item.message.id}>
                        {renderSearchResult({ item })}
                    </View>
                ))}
              </View>
            )}
          </ScrollView>
        )
      ) : (
        // Chat List Mode
        isLoading ? (
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
          <Text style={{ fontSize: 16, fontWeight: "500", color: colors.textSecondary, marginBottom: 32, textAlign: "center", lineHeight: 22 }}>
            🦎 Meet Glitch the Gecko — He licked a{'\n'}glowing fiber optic cable and gained{'\n'}the power to connect any vibe, anywhere
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text, marginBottom: 24, textAlign: "center" }}>
            No chats yet
          </Text>
        </View>
      ) : (
          <FlashList
            data={[
              ...pinnedChats.map((chat) => ({ ...chat, section: "pinned" as const })),
              ...unpinnedChats.map((chat) => ({ ...chat, section: "unpinned" as const })),
            ]}
            keyExtractor={(item) => item.id}
            estimatedItemSize={100}
            drawDistance={300}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <ChatItem 
                item={item} 
                unreadCount={unreadCountMap.get(item.id) || 0} 
                onPress={handleChatPress} 
                onLongPress={handleLongPress}
                colors={colors}
                isDark={isDark}
              />
            )}
            contentContainerStyle={{
              paddingTop: insets.top + 100,
              paddingBottom: insets.bottom + 100,
            }}
            ListHeaderComponent={
              pinnedChats.length > 0 ? (
                <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <GradientIcon
                      icon={<Pin size={16} color={colors.text} />}
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
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="transparent"
                colors={["transparent"]}
              />
            }
          />
      )
      )
      }
      </KeyboardAvoidingView>

      {/* FAB */}
      <CreateChatFAB />

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
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.4)",
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
                shadowColor: colors.glassShadow,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.6,
                shadowRadius: 32,
                elevation: 12,
              }}
            >
              <BlurView
                intensity={Platform.OS === "ios" ? 90 : 100}
                tint={isDark ? "dark" : "light"}
                style={{
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  backgroundColor: isDark ? "rgba(30,30,40,0.8)" : "rgba(255,255,255,0.8)",
                }}
              >
                <LinearGradient
                  colors={isDark 
                    ? [
                        "rgba(40, 40, 50, 0.98)",
                        "rgba(30, 30, 40, 0.98)",
                        "rgba(20, 20, 30, 0.98)",
                      ]
                    : [
                        "rgba(255, 255, 255, 0.98)",
                        "rgba(245, 245, 250, 0.98)",
                        "rgba(240, 240, 245, 0.98)",
                      ]
                  }
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
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "700",
                        color: colors.text,
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
                        backgroundColor: pressed ? (isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)") : "transparent",
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
                            backgroundColor: isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 16,
                          }}
                        >
                          <GradientIcon
                            icon={<Pin size={22} color={colors.text} strokeWidth={2.5} />}
                            style={{ width: 22, height: 22 }}
                          />
                        </View>
                        <Text 
                          style={{ 
                            color: colors.text, 
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
                        backgroundColor: pressed ? (isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)") : "transparent",
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
                            backgroundColor: isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 16,
                          }}
                        >
                          <GradientIcon
                            icon={contextMenuChat?.isMuted ? <Bell size={22} color={colors.text} strokeWidth={2.5} /> : <BellOff size={22} color={colors.text} strokeWidth={2.5} />}
                            style={{ width: 22, height: 22 }}
                          />
                        </View>
                        <Text 
                          style={{ 
                            color: colors.text, 
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
                      borderTopColor: colors.border,
                      marginTop: 12,
                      paddingTop: 12,
                      paddingBottom: 4,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => setShowContextMenu(false)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? (isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)") : "transparent",
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
