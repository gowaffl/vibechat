import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MessageSquare, Plus, Trash2, ChevronRight, Bot } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/Swipeable";

import { useTheme } from "@/contexts/ThemeContext";
import { usePersonalConversations, useDeletePersonalConversation, useCreatePersonalConversation } from "@/hooks/usePersonalChats";
import { GradientIcon, BRAND_GRADIENT_COLORS } from "@/components/GradientIcon";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { CustomRefreshControl } from "@/components/CustomRefreshControl";
import type { PersonalConversation } from "@/shared/contracts";
import type { RootStackScreenProps } from "@/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Conversation item component
const ConversationItem = React.memo(({
  item,
  onPress,
  onDelete,
  colors,
  isDark,
}: {
  item: PersonalConversation;
  onPress: (conversation: PersonalConversation) => void;
  onDelete: (conversationId: string) => void;
  colors: any;
  isDark: boolean;
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
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderRightActions = (progress: any, dragX: any) => {
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            "Delete Conversation",
            "Are you sure you want to delete this conversation? This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              { 
                text: "Delete", 
                style: "destructive",
                onPress: () => onDelete(item.id)
              },
            ]
          );
        }}
        style={styles.deleteAction}
      >
        <LinearGradient
          colors={["#FF453A", "#FF6B6B"]}
          style={styles.deleteGradient}
        >
          <Trash2 size={20} color="#fff" />
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(item);
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={styles.itemContainer}>
          <BlurView
            intensity={Platform.OS === "ios" ? (isDark ? 40 : 60) : 80}
            tint={isDark ? "dark" : "light"}
            style={[
              styles.itemBlur,
              {
                borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)",
                backgroundColor: isDark ? "transparent" : "rgba(255, 255, 255, 0.85)",
              },
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(40, 40, 50, 0.5)", "rgba(30, 30, 40, 0.3)"]
                  : ["rgba(255, 255, 255, 0.9)", "rgba(250, 250, 255, 0.8)"]
              }
              style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.itemContent}>
              {/* Agent Avatar or VibeChat Icon */}
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: item.aiFriend?.color || "rgba(99, 102, 241, 0.15)",
                  },
                ]}
              >
                <Image
                  source={require("../../../assets/vibechat icon main.png")}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                  contentFit="cover"
                />
              </View>

              {/* Content */}
              <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                  <Text
                    style={[styles.title, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.time, { color: colors.textSecondary }]}>
                    {formatTime(item.lastMessageAt)}
                  </Text>
                </View>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.aiFriend?.name || "AI Assistant"}
                </Text>
              </View>

              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </BlurView>
        </View>
      </Pressable>
    </Swipeable>
  );
});

// Empty state component
const EmptyState = ({ colors, isDark }: { 
  colors: any; 
  isDark: boolean;
}) => (
  <Animated.View 
    entering={FadeIn.duration(300)} 
    style={styles.emptyContainer}
  >
    <View style={[
      styles.emptyIconContainer,
      { backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)" }
    ]}>
      <Image
        source={require("../../../assets/vibechat icon main.png")}
        style={{ width: 56, height: 56, borderRadius: 28 }}
        contentFit="cover"
      />
    </View>
    <Text style={[styles.emptyTitle, { color: colors.text }]}>
      No Personal Chats Yet
    </Text>
    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
      Start a private conversation with your AI agents using the + button in the bottom right
    </Text>
  </Animated.View>
);

// Main component
interface PersonalChatListViewProps {
  onSelectConversation?: (conversation: PersonalConversation) => void;
  onCreateNew?: () => void;
}

const PersonalChatListView: React.FC<PersonalChatListViewProps> = ({
  onSelectConversation,
  onCreateNew,
}) => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<RootStackScreenProps<"ChatList">["navigation"]>();
  const insets = useSafeAreaInsets();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: conversations, isLoading, refetch } = usePersonalConversations();
  const deleteConversation = useDeletePersonalConversation();
  const createConversation = useCreatePersonalConversation();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  }, [refetch]);

  const handleSelectConversation = useCallback((conversation: PersonalConversation) => {
    if (onSelectConversation) {
      onSelectConversation(conversation);
    } else {
      // Navigate to personal chat screen
      navigation.navigate("PersonalChat", { conversationId: conversation.id });
    }
  }, [onSelectConversation, navigation]);

  const handleDelete = useCallback((conversationId: string) => {
    deleteConversation.mutate(conversationId);
  }, [deleteConversation]);

  const handleCreateNew = useCallback(async () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      // Create new conversation and navigate
      try {
        const newConversation = await createConversation.mutateAsync({});
        navigation.navigate("PersonalChat", { conversationId: newConversation.id });
      } catch (error) {
        console.error("[PersonalChatListView] Error creating conversation:", error);
        Alert.alert("Error", "Failed to create new conversation");
      }
    }
  }, [onCreateNew, createConversation, navigation]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LuxeLogoLoader size={60} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomRefreshControl 
        refreshing={isRefreshing} 
        message="Refreshing conversations" 
        topOffset={insets.top + 80}
      />
      
      {/* Conversations List */}
      {conversations && conversations.length > 0 ? (
        <FlashList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem
              item={item}
              onPress={handleSelectConversation}
              onDelete={handleDelete}
              colors={colors}
              isDark={isDark}
            />
          )}
          estimatedItemSize={76}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="transparent"
              colors={["transparent"]}
            />
          }
        />
      ) : (
        <EmptyState
          colors={colors}
          isDark={isDark}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 100,
  },
  itemContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  itemBlur: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  time: {
    fontSize: 13,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    marginRight: 16,
    marginBottom: 10,
  },
  deleteGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
});

export default PersonalChatListView;

