/**
 * PersonalChatListView Component
 * 
 * Main view for personal chat conversations with:
 * - Quick Start agents section (top 3 most-used agents)
 * - Folders (collapsible, shown first if any exist)
 * - Regular conversations (no folder)
 * - Swipe to show "More" options (Add to Folder, Delete)
 * - Long-press for bulk selection mode
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  SectionList,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { 
  ChevronRight, 
  ChevronDown,
  MoreHorizontal, 
  Trash2, 
  FolderPlus,
  Folder,
  Check,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/Swipeable";

import { useTheme } from "@/contexts/ThemeContext";
import { 
  usePersonalConversations, 
  useDeletePersonalConversation, 
  useCreatePersonalConversation,
  useFolders,
  useCreateFolder,
  useDeleteFolder,
  useBulkDeletePersonalConversations,
} from "@/hooks/usePersonalChats";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { CustomRefreshControl } from "@/components/CustomRefreshControl";
import QuickStartAgents from "./QuickStartAgents";
import AddToFolderModal from "./AddToFolderModal";
import type { PersonalConversation, PersonalChatFolder, AIFriend } from "@/shared/contracts";
import type { RootStackScreenProps } from "@/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Section types for SectionList
type ConversationSection = {
  title: string;
  folderId: string | null;
  isFolder: boolean;
  isCollapsed?: boolean;
  conversationCount: number;
  data: PersonalConversation[];
};

// Conversation item component with swipe-to-more
const ConversationItem = React.memo(({
  item,
  onPress,
  onDelete,
  onAddToFolder,
  isInBulkMode,
  isBulkSelected,
  onBulkToggle,
  colors,
  isDark,
}: {
  item: PersonalConversation;
  onPress: (conversation: PersonalConversation) => void;
  onDelete: (conversationId: string) => void;
  onAddToFolder: (conversationId: string, currentFolderId: string | null) => void;
  isInBulkMode: boolean;
  isBulkSelected: boolean;
  onBulkToggle: (conversationId: string) => void;
  colors: any;
  isDark: boolean;
}) => {
  const swipeableRef = React.useRef<Swipeable>(null);
  
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

  const handleMorePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Add to Folder", "Delete"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            onAddToFolder(item.id, item.folderId || null);
          } else if (buttonIndex === 2) {
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
          }
        }
      );
    } else {
      // Android: Use Alert for now (could use a custom bottom sheet)
      Alert.alert(
        "Options",
        "What would you like to do?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Add to Folder", 
            onPress: () => onAddToFolder(item.id, item.folderId || null)
          },
          { 
            text: "Delete", 
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "Delete Conversation",
                "Are you sure? This cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) },
                ]
              );
            }
          },
        ]
      );
    }
  }, [item.id, item.folderId, onAddToFolder, onDelete]);

  const renderRightActions = () => {
    if (isInBulkMode) return null;
    
    return (
      <Pressable
        onPress={handleMorePress}
        style={styles.moreAction}
      >
        <LinearGradient
          colors={isDark ? ["#3b3b4f", "#2d2d3d"] : ["#e5e7eb", "#d1d5db"]}
          style={styles.moreGradient}
        >
          <MoreHorizontal size={22} color={isDark ? "#fff" : "#374151"} />
        </LinearGradient>
      </Pressable>
    );
  };

  const handlePress = useCallback(() => {
    if (isInBulkMode) {
      onBulkToggle(item.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(item);
    }
  }, [isInBulkMode, item, onPress, onBulkToggle]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBulkToggle(item.id);
  }, [item.id, onBulkToggle]);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      enabled={!isInBulkMode}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
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
              </View>

              {!isInBulkMode && <ChevronRight size={18} color={colors.textSecondary} />}
            </View>
          </BlurView>
        </View>
      </Pressable>
    </Swipeable>
  );
});

// Folder Header Component
const FolderHeader = React.memo(({
  folder,
  isCollapsed,
  onToggle,
  onLongPress,
  colors,
  isDark,
}: {
  folder: PersonalChatFolder;
  isCollapsed: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  colors: any;
  isDark: boolean;
}) => (
  <Pressable
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle();
    }}
    onLongPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress();
    }}
    style={({ pressed }) => [
      styles.folderHeader,
      {
        backgroundColor: pressed
          ? isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
          : "transparent",
      }
    ]}
  >
    <View style={styles.folderHeaderContent}>
      {isCollapsed ? (
        <ChevronRight size={18} color={colors.textSecondary} />
      ) : (
        <ChevronDown size={18} color={colors.textSecondary} />
      )}
      <Folder size={18} color="#6366f1" />
      <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
        {folder.name}
      </Text>
      <Text style={[styles.folderCount, { color: colors.textSecondary }]}>
        {folder.conversationCount || 0}
      </Text>
    </View>
  </Pressable>
));

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

// Bulk Actions Bar Component
const BulkActionsBar = React.memo(({
  selectedCount,
  totalCount,
  onSelectAll,
  onDelete,
  onCancel,
  colors,
  isDark,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
  colors: any;
  isDark: boolean;
}) => (
  <Animated.View
    entering={FadeIn.duration(150)}
    exiting={FadeOut.duration(150)}
    style={[
      styles.bulkActionsBar,
      { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }
    ]}
  >
    <View style={styles.bulkActionsLeft}>
      <Pressable onPress={onSelectAll} style={styles.bulkActionButton}>
        <Text style={[styles.bulkActionText, { color: colors.primary }]}>
          {selectedCount === totalCount ? "Deselect All" : "Select All"}
        </Text>
      </Pressable>
    </View>
    <View style={styles.bulkActionsRight}>
      <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
        {selectedCount} selected
      </Text>
      <Pressable
        onPress={onDelete}
        style={[styles.bulkDeleteButton, { opacity: selectedCount > 0 ? 1 : 0.5 }]}
        disabled={selectedCount === 0}
      >
        <Trash2 size={16} color="#ef4444" />
      </Pressable>
      <Pressable onPress={onCancel} style={styles.cancelBulkButton}>
        <Text style={[styles.cancelBulkText, { color: colors.textSecondary }]}>
          Cancel
        </Text>
      </Pressable>
    </View>
  </Animated.View>
));

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
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addToFolderModal, setAddToFolderModal] = useState<{
    visible: boolean;
    conversationId: string;
    currentFolderId: string | null;
  }>({ visible: false, conversationId: "", currentFolderId: null });
  
  const { data: conversations, isLoading, refetch } = usePersonalConversations();
  const { data: folders = [] } = useFolders();
  const deleteConversation = useDeletePersonalConversation();
  const bulkDelete = useBulkDeletePersonalConversations();
  const createConversation = useCreatePersonalConversation();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();

  // Build sections: folders first, then regular conversations
  const sections = useMemo<ConversationSection[]>(() => {
    if (!conversations) return [];
    
    const result: ConversationSection[] = [];
    
    // Add folder sections
    folders.forEach((folder: PersonalChatFolder) => {
      const folderConversations = conversations.filter(
        (c) => c.folderId === folder.id
      );
      if (folderConversations.length > 0 || true) { // Always show folders
        const isCollapsed = collapsedFolders.has(folder.id);
        result.push({
          title: folder.name,
          folderId: folder.id,
          isFolder: true,
          isCollapsed,
          conversationCount: folderConversations.length,
          data: isCollapsed ? [] : folderConversations,
        });
      }
    });
    
    // Add regular conversations (no folder)
    const regularConversations = conversations.filter((c) => !c.folderId);
    if (regularConversations.length > 0) {
      result.push({
        title: "",
        folderId: null,
        isFolder: false,
        conversationCount: regularConversations.length,
        data: regularConversations,
      });
    }
    
    return result;
  }, [conversations, folders, collapsedFolders]);

  // All conversations flat list for counting
  const allConversations = conversations || [];

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
      navigation.navigate("PersonalChat", { conversationId: conversation.id });
    }
  }, [onSelectConversation, navigation]);

  const handleDelete = useCallback((conversationId: string) => {
    deleteConversation.mutate(conversationId);
  }, [deleteConversation]);

  const handleAddToFolder = useCallback((conversationId: string, currentFolderId: string | null) => {
    setAddToFolderModal({
      visible: true,
      conversationId,
      currentFolderId,
    });
  }, []);

  const handleCloseAddToFolder = useCallback(() => {
    setAddToFolderModal({ visible: false, conversationId: "", currentFolderId: null });
  }, []);

  const handleToggleFolder = useCallback((folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleFolderLongPress = useCallback((folder: PersonalChatFolder) => {
    Alert.alert(
      folder.name,
      "What would you like to do with this folder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Folder",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Delete Folder",
              "Conversations in this folder will be moved to the main list. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => deleteFolder.mutate(folder.id),
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteFolder]);

  // Bulk selection handlers
  const handleBulkToggle = useCallback((conversationId: string) => {
    if (!bulkMode) {
      setBulkMode(true);
      setSelectedIds(new Set([conversationId]));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(conversationId)) {
          next.delete(conversationId);
          if (next.size === 0) {
            setBulkMode(false);
          }
        } else {
          next.add(conversationId);
        }
        return next;
      });
    }
  }, [bulkMode]);

  const handleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIds.size === allConversations.length) {
      setSelectedIds(new Set());
      setBulkMode(false);
    } else {
      setSelectedIds(new Set(allConversations.map((c) => c.id)));
    }
  }, [selectedIds, allConversations]);

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

  const handleCancelBulk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleAgentQuickStart = useCallback(async (agent: AIFriend) => {
    try {
      const result = await createConversation.mutateAsync({ aiFriendId: agent.id });
      navigation.navigate("PersonalChat", { conversationId: result.conversation.id });
    } catch (error) {
      console.error("[PersonalChatListView] Error creating conversation:", error);
      Alert.alert("Error", "Failed to create new conversation");
    }
  }, [createConversation, navigation]);

  const handleCreateFolder = useCallback(() => {
    Alert.prompt(
      "Create Folder",
      "Enter a name for the new folder",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: (name) => {
            if (name && name.trim()) {
              createFolder.mutate(name.trim());
            }
          },
        },
      ],
      "plain-text"
    );
  }, [createFolder]);

  const renderSectionHeader = useCallback(({ section }: { section: ConversationSection }) => {
    if (!section.isFolder) return null;
    
    const folder = folders.find((f: PersonalChatFolder) => f.id === section.folderId);
    if (!folder) return null;
    
    return (
      <FolderHeader
        folder={folder}
        isCollapsed={section.isCollapsed || false}
        onToggle={() => handleToggleFolder(folder.id)}
        onLongPress={() => handleFolderLongPress(folder)}
        colors={colors}
        isDark={isDark}
      />
    );
  }, [folders, handleToggleFolder, handleFolderLongPress, colors, isDark]);

  const renderItem = useCallback(({ item }: { item: PersonalConversation }) => (
    <ConversationItem
      item={item}
      onPress={handleSelectConversation}
      onDelete={handleDelete}
      onAddToFolder={handleAddToFolder}
      isInBulkMode={bulkMode}
      isBulkSelected={selectedIds.has(item.id)}
      onBulkToggle={handleBulkToggle}
      colors={colors}
      isDark={isDark}
    />
  ), [handleSelectConversation, handleDelete, handleAddToFolder, bulkMode, selectedIds, handleBulkToggle, colors, isDark]);

  const ListHeaderComponent = useMemo(() => (
    <View>
      {/* Quick Start Agents */}
      <QuickStartAgents onAgentPress={handleAgentQuickStart} />
      
      {/* Folders Header with Create Button */}
      {folders.length > 0 && (
        <View style={[
          styles.foldersHeaderRow,
          { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }
        ]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Folders
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleCreateFolder();
            }}
            style={({ pressed }) => [
              styles.createFolderButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <FolderPlus size={18} color="#6366f1" />
          </Pressable>
        </View>
      )}
      
      {/* Bulk Actions Bar */}
      {bulkMode && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          totalCount={allConversations.length}
          onSelectAll={handleSelectAll}
          onDelete={handleBulkDelete}
          onCancel={handleCancelBulk}
          colors={colors}
          isDark={isDark}
        />
      )}
    </View>
  ), [folders.length, handleAgentQuickStart, handleCreateFolder, bulkMode, selectedIds.size, allConversations.length, handleSelectAll, handleBulkDelete, handleCancelBulk, colors, isDark]);

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
      
      {allConversations.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={ListHeaderComponent}
          stickySectionHeadersEnabled={false}
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
        <View style={{ flex: 1 }}>
          {/* Show Quick Start even when empty */}
          <QuickStartAgents onAgentPress={handleAgentQuickStart} />
          
          {/* Create folder button when no folders exist */}
          {folders.length === 0 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleCreateFolder();
              }}
              style={({ pressed }) => [
                styles.createFirstFolder,
                {
                  backgroundColor: pressed
                    ? isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)"
                    : "transparent",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                }
              ]}
            >
              <FolderPlus size={18} color="#6366f1" />
              <Text style={styles.createFirstFolderText}>Create a Folder</Text>
            </Pressable>
          )}
          
          <EmptyState colors={colors} isDark={isDark} />
        </View>
      )}
      
      {/* Add to Folder Modal */}
      <AddToFolderModal
        visible={addToFolderModal.visible}
        conversationId={addToFolderModal.conversationId}
        currentFolderId={addToFolderModal.currentFolderId}
        onClose={handleCloseAddToFolder}
      />
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
    padding: 12,
    gap: 12,
  },
  checkboxContainer: {
    marginRight: 4,
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
  textContainer: {
    flex: 1,
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
  moreAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    marginRight: 16,
    marginBottom: 10,
  },
  moreGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  // Folder styles
  foldersHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  createFolderButton: {
    padding: 4,
  },
  folderHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  folderHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  folderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  folderCount: {
    fontSize: 13,
  },
  createFirstFolder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  createFirstFolderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366f1",
  },
  // Bulk actions
  bulkActionsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
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
  // Empty state
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
