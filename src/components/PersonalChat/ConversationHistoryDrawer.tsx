import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { FlashList } from "@shopify/flash-list";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  ChevronLeft,
  X,
  Trash2,
  Check,
  Plus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { usePersonalConversations, useDeletePersonalConversation, useBulkDeletePersonalConversations } from "@/hooks/usePersonalChats";
import type { PersonalConversation } from "@/shared/contracts";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 320);
const DELETE_THRESHOLD = -80;

interface ConversationHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: string | null;
  onSelectConversation: (conversation: PersonalConversation) => void;
  onNewConversation?: () => void;
}

interface ConversationItemProps {
  conversation: PersonalConversation;
  isSelected: boolean;
  isInBulkMode: boolean;
  isBulkSelected: boolean;
  onPress: () => void;
  onBulkToggle: () => void;
  onDelete: () => void;
  isDark: boolean;
  colors: any;
}

function ConversationItem({
  conversation,
  isSelected,
  isInBulkMode,
  isBulkSelected,
  onPress,
  onBulkToggle,
  onDelete,
  isDark,
  colors,
}: ConversationItemProps) {
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);
  
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (isInBulkMode) return;
      const newValue = Math.min(0, Math.max(event.translationX, -100));
      translateX.value = newValue;
      deleteOpacity.value = Math.min(1, Math.abs(newValue) / Math.abs(DELETE_THRESHOLD));
    })
    .onEnd((event) => {
      if (isInBulkMode) return;
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withTiming(-100, { duration: 200 });
        deleteOpacity.value = 1;
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        deleteOpacity.value = withTiming(0, { duration: 200 });
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  
  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
  }));
  
  const handleDeletePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    deleteOpacity.value = withTiming(0, { duration: 200 });
    onDelete();
  }, [onDelete]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };
  
  return (
    <View style={styles.conversationItemContainer}>
      {/* Delete Button (revealed on swipe) */}
      <Animated.View style={[styles.deleteButtonContainer, deleteButtonStyle]}>
        <Pressable onPress={handleDeletePress} style={styles.deleteButton}>
          <Trash2 size={20} color="#fff" />
        </Pressable>
      </Animated.View>
      
      {/* Main Item */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.conversationItemAnimated, animatedStyle]}>
          <Pressable
            onPress={isInBulkMode ? onBulkToggle : onPress}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onBulkToggle();
            }}
            style={({ pressed }) => [
              styles.conversationItem,
              {
                backgroundColor: pressed
                  ? isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"
                  : "transparent",
              },
              isSelected && {
                backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
              },
            ]}
          >
            {/* Bulk Selection Checkbox */}
            {isInBulkMode && (
              <View style={styles.checkboxContainer}>
                {isBulkSelected ? (
                  <View style={[styles.checkbox, styles.checkboxSelected]}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={[styles.checkbox, { borderColor: colors.textSecondary }]} />
                )}
              </View>
            )}
            
            {/* Content - Single line title only */}
            <View style={styles.conversationContent}>
              <Text
                style={[styles.conversationTitle, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {conversation.title}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * ConversationHistoryDrawer - Left slide-out drawer for conversation history
 * 
 * Features:
 * - Swipe from left edge to open
 * - Swipe left on items to reveal delete
 * - Long-press for bulk selection mode
 * - Liquid glass styling
 * - Back button to return to main screen
 */
export default function ConversationHistoryDrawer({
  isOpen,
  onClose,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationHistoryDrawerProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const { data: conversations = [], isLoading, refetch } = usePersonalConversations();
  const deleteConversation = useDeletePersonalConversation();
  const bulkDelete = useBulkDeletePersonalConversations();
  
  const handleClose = useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);
  
  const handleSelectConversation = useCallback((conversation: PersonalConversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectConversation(conversation);
    handleClose();
  }, [onSelectConversation, handleClose]);
  
  const handleToggleBulkSelection = useCallback((id: string) => {
    if (!bulkMode) {
      setBulkMode(true);
      setSelectedIds(new Set([id]));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (next.size === 0) {
            setBulkMode(false);
          }
        } else {
          next.add(id);
        }
        return next;
      });
    }
  }, [bulkMode]);
  
  const handleDeleteSingle = useCallback((conversationId: string) => {
    Alert.alert(
      "Delete Conversation",
      "Are you sure you want to delete this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteConversation.mutate(conversationId);
          },
        },
      ]
    );
  }, [deleteConversation]);
  
  const handleBulkDelete = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      "Delete Conversations",
      `Are you sure you want to delete ${count} conversation${count > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            bulkDelete.mutate(Array.from(selectedIds), {
              onSuccess: () => {
                setBulkMode(false);
                setSelectedIds(new Set());
              },
            });
          },
        },
      ]
    );
  }, [selectedIds, bulkDelete]);
  
  const handleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
      setBulkMode(false);
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
    }
  }, [selectedIds, conversations]);
  
  const handleCancelBulk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleNewConversation = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleClose();
    onNewConversation?.();
  }, [handleClose, onNewConversation]);
  
  if (!isOpen) return null;
  
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>
      
      {/* Drawer */}
      <Animated.View
        entering={SlideInLeft.springify().damping(20).stiffness(150)}
        exiting={SlideOutLeft.springify().damping(20).stiffness(150)}
        style={[styles.drawer, { width: DRAWER_WIDTH }]}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 90 : 100}
          tint={isDark ? "dark" : "light"}
          style={styles.drawerBlur}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(25,25,30,0.95)", "rgba(15,15,20,0.98)"]
                : ["rgba(255,255,255,0.95)", "rgba(248,248,250,0.98)"]
            }
            style={[styles.drawerGradient, { paddingTop: insets.top + 12 }]}
          >
            {/* Header with Back Button */}
            <View style={styles.header}>
              {/* Back Button - prominent on left side */}
              <Pressable 
                onPress={handleClose} 
                style={({ pressed }) => [
                  styles.backButton,
                  { 
                    backgroundColor: pressed 
                      ? isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.15)"
                      : isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.08)"
                  }
                ]}
              >
                <ChevronLeft size={22} color="#6366f1" strokeWidth={2.5} />
                <Text style={styles.backButtonText}>
                  Back
                </Text>
              </Pressable>

              {/* Title */}
              <View style={styles.headerCenter}>
                <Image
                  source={require("../../../assets/vibechat icon main.png")}
                  style={styles.headerIcon}
                  contentFit="cover"
                />
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  Chats
                </Text>
              </View>

              {/* New Chat Button */}
              <Pressable 
                onPress={handleNewConversation} 
                style={({ pressed }) => [
                  styles.newChatButton,
                  {
                    backgroundColor: pressed 
                      ? isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)"
                      : isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)"
                  }
                ]}
              >
                <Plus size={18} color="#6366f1" strokeWidth={2.5} />
              </Pressable>
            </View>
            
            {/* Bulk Actions Bar */}
            {bulkMode && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={[
                  styles.bulkActionsBar,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }
                ]}
              >
                <View style={styles.bulkActionsLeft}>
                  <Pressable onPress={handleSelectAll} style={styles.bulkActionButton}>
                    <Text style={[styles.bulkActionText, { color: colors.primary }]}>
                      {selectedIds.size === conversations.length ? "Deselect All" : "Select All"}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.bulkActionsRight}>
                  <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
                    {selectedIds.size} selected
                  </Text>
                  <Pressable
                    onPress={handleBulkDelete}
                    style={[styles.bulkDeleteButton, { opacity: selectedIds.size > 0 ? 1 : 0.5 }]}
                    disabled={selectedIds.size === 0}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </Pressable>
                  <Pressable onPress={handleCancelBulk} style={styles.cancelBulkButton}>
                    <Text style={[styles.cancelBulkText, { color: colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
            
            {/* Create New Chat Button */}
            <View style={styles.createChatButtonContainer}>
              <Pressable
                onPress={handleNewConversation}
                style={({ pressed }) => [
                  styles.createChatButton,
                  {
                    backgroundColor: pressed
                      ? isDark ? "rgba(79,195,247,0.1)" : "rgba(79,195,247,0.05)"
                      : "transparent",
                  }
                ]}
              >
                <View style={styles.createChatButtonInner}>
                  <Plus size={20} color="#4FC3F7" strokeWidth={2.5} />
                  <Text style={styles.createChatButtonText}>
                    Create New Chat
                  </Text>
                </View>
              </Pressable>
              {/* Divider */}
              <View style={[
                styles.divider,
                { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }
              ]} />
            </View>
            
            {/* Conversations List */}
            <GestureHandlerRootView style={styles.listContainer}>
              {conversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[
                    styles.emptyIconContainer,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }
                  ]}>
                    <Image
                      source={require("../../../assets/vibechat icon main.png")}
                      style={styles.emptyIcon}
                      contentFit="cover"
                    />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No conversations yet
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                    Start a new chat to begin
                  </Text>
                </View>
              ) : (
                <FlashList
                  data={conversations}
                  keyExtractor={(item) => item.id}
                  estimatedItemSize={64}
                  renderItem={({ item }) => (
                    <ConversationItem
                      conversation={item}
                      isSelected={item.id === currentConversationId}
                      isInBulkMode={bulkMode}
                      isBulkSelected={selectedIds.has(item.id)}
                      onPress={() => handleSelectConversation(item)}
                      onBulkToggle={() => handleToggleBulkSelection(item.id)}
                      onDelete={() => handleDeleteSingle(item.id)}
                      isDark={isDark}
                      colors={colors}
                    />
                  )}
                  contentContainerStyle={styles.listContent}
                />
              )}
            </GestureHandlerRootView>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerBlur: {
    flex: 1,
  },
  drawerGradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingLeft: 8,
    borderRadius: 20,
    minWidth: 80,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 2,
    color: "#6366f1",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  newChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkActionsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  bulkActionsLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  bulkActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bulkActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bulkActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectedCount: {
    fontSize: 13,
  },
  bulkDeleteButton: {
    padding: 8,
  },
  cancelBulkButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelBulkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  createChatButtonContainer: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 12,
  },
  createChatButton: {
    paddingVertical: 18,
    paddingRight: 16,
    minHeight: 64,
  },
  createChatButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 25, // ✅ Moving the inner content to align with the text below
  },
  createChatButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4FC3F7",
    marginLeft: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginTop: 14,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 20,
  },
  conversationItemContainer: {
    position: "relative",
    marginBottom: 12, // ✅ Increased margin between items
  },
  deleteButtonContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  conversationItemAnimated: {
    backgroundColor: "transparent",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15, // ✅ Increased padding even more to ensure change is visible
    paddingLeft: 24,
    paddingRight: 16,
    minHeight: 76, // ✅ Increased minHeight even more to ensure change is visible
  },
  checkboxContainer: {
    marginRight: 4,
    marginLeft: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  conversationContent: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 25,
  },
  conversationTitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
});
