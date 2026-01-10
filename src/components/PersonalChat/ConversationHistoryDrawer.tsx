import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Plus,
  MoreHorizontal,
  FolderPlus,
  Folder,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import {
  usePersonalConversations,
  useDeletePersonalConversation,
  useBulkDeletePersonalConversations,
  useFolders,
  useCreateFolder,
  useDeleteFolder,
  useMoveConversationToFolder,
} from "@/hooks/usePersonalChats";
import type { PersonalConversation, PersonalChatFolder } from "@/shared/contracts";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 320);
const SWIPE_THRESHOLD = -60;

interface ConversationHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: string | null;
  onSelectConversation: (conversation: PersonalConversation) => void;
  onNewConversation?: () => void;
  onQuickStartAgent?: (agentId: string) => void;
}

interface ConversationItemProps {
  conversation: PersonalConversation;
  isSelected: boolean;
  isInBulkMode: boolean;
  isBulkSelected: boolean;
  onPress: () => void;
  onBulkToggle: () => void;
  onMorePress: () => void;
  isDark: boolean;
  colors: any;
}

// ============================================================================
// QUICK START AGENTS COMPONENT
// ============================================================================

interface QuickStartAgentsProps {
  conversations: PersonalConversation[];
  onQuickStart: (agentId: string) => void;
  isDark: boolean;
  colors: any;
}

function QuickStartAgents({ conversations, onQuickStart, isDark, colors }: QuickStartAgentsProps) {
  // Calculate top 3 most-used agents based on conversation count
  const topAgents = useMemo(() => {
    const agentCounts: Record<string, { count: number; name: string; avatarUrl?: string }> = {};
    
    conversations.forEach((conv) => {
      if (conv.agentId) {
        if (!agentCounts[conv.agentId]) {
          agentCounts[conv.agentId] = {
            count: 0,
            name: conv.agentName || "Agent",
            avatarUrl: conv.agentAvatarUrl,
          };
        }
        agentCounts[conv.agentId].count++;
      }
    });
    
    return Object.entries(agentCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 3)
      .map(([agentId, data]) => ({
        agentId,
        name: data.name,
        avatarUrl: data.avatarUrl,
        count: data.count,
      }));
  }, [conversations]);
  
  if (topAgents.length === 0) return null;
  
  const getInitials = (name: string) => {
    const words = name.split(" ").filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const getAvatarColor = (name: string) => {
    const colors = [
      "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", 
      "#f97316", "#eab308", "#22c55e", "#14b8a6",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  
  return (
    <View style={quickStartStyles.container}>
      <Text style={[quickStartStyles.sectionTitle, { color: colors.textSecondary }]}>
        Quick Start
      </Text>
      <View style={quickStartStyles.agentsRow}>
        {topAgents.map((agent) => (
          <Pressable
            key={agent.agentId}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onQuickStart(agent.agentId);
            }}
            style={({ pressed }) => [
              quickStartStyles.agentItem,
              pressed && quickStartStyles.agentItemPressed,
            ]}
          >
            {agent.avatarUrl ? (
              <Image
                source={{ uri: agent.avatarUrl }}
                style={quickStartStyles.agentAvatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  quickStartStyles.agentAvatar,
                  { backgroundColor: getAvatarColor(agent.name) },
                ]}
              >
                <Text style={quickStartStyles.agentInitials}>
                  {getInitials(agent.name)}
                </Text>
              </View>
            )}
            <Text
              style={[quickStartStyles.agentName, { color: colors.text }]}
              numberOfLines={1}
            >
              {agent.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const quickStartStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  agentsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 20,
  },
  agentItem: {
    alignItems: "center",
    width: 70,
  },
  agentItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  agentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  agentInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  agentName: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});

// ============================================================================
// CONVERSATION ITEM COMPONENT
// ============================================================================

function ConversationItem({
  conversation,
  isSelected,
  isInBulkMode,
  isBulkSelected,
  onPress,
  onBulkToggle,
  onMorePress,
  isDark,
  colors,
}: ConversationItemProps) {
  const translateX = useSharedValue(0);
  const moreOpacity = useSharedValue(0);
  
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (isInBulkMode) return;
      const newValue = Math.min(0, Math.max(event.translationX, -80));
      translateX.value = newValue;
      moreOpacity.value = Math.min(1, Math.abs(newValue) / Math.abs(SWIPE_THRESHOLD));
    })
    .onEnd(() => {
      if (isInBulkMode) return;
      if (translateX.value < SWIPE_THRESHOLD) {
        translateX.value = withTiming(-70, { duration: 200 });
        moreOpacity.value = 1;
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        moreOpacity.value = withTiming(0, { duration: 200 });
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  
  const moreButtonStyle = useAnimatedStyle(() => ({
    opacity: moreOpacity.value,
  }));
  
  const handleMorePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    moreOpacity.value = withTiming(0, { duration: 200 });
    onMorePress();
  }, [onMorePress]);
  
  return (
    <View style={styles.conversationItemContainer}>
      {/* More Button (revealed on swipe) */}
      <Animated.View style={[styles.moreButtonContainer, moreButtonStyle]}>
        <Pressable onPress={handleMorePress} style={styles.moreButton}>
          <MoreHorizontal size={20} color="#fff" />
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

// ============================================================================
// ADD TO FOLDER MODAL
// ============================================================================

interface AddToFolderModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string | null;
  folders: PersonalChatFolder[];
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  isDark: boolean;
  colors: any;
}

function AddToFolderModal({
  visible,
  onClose,
  conversationId,
  folders,
  onSelectFolder,
  onCreateFolder,
  isDark,
  colors,
}: AddToFolderModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreating(false);
    }
  };
  
  const handleClose = () => {
    setIsCreating(false);
    setNewFolderName("");
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={folderModalStyles.overlay} onPress={handleClose}>
        <Pressable
          style={[
            folderModalStyles.container,
            { backgroundColor: isDark ? "#1c1c1e" : "#fff" },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[folderModalStyles.title, { color: colors.text }]}>
            Add to Folder
          </Text>
          
          {/* Remove from folder option */}
          <Pressable
            style={[
              folderModalStyles.option,
              { borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
            ]}
            onPress={() => onSelectFolder(null)}
          >
            <Text style={[folderModalStyles.optionText, { color: colors.textSecondary }]}>
              No Folder (Remove)
            </Text>
          </Pressable>
          
          {/* Existing folders */}
          {folders.map((folder) => (
            <Pressable
              key={folder.id}
              style={[
                folderModalStyles.option,
                { borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
              ]}
              onPress={() => onSelectFolder(folder.id)}
            >
              <View style={folderModalStyles.optionRow}>
                <Folder size={18} color={colors.primary} />
                <Text style={[folderModalStyles.optionText, { color: colors.text }]}>
                  {folder.name}
                </Text>
              </View>
            </Pressable>
          ))}
          
          {/* Create new folder */}
          {isCreating ? (
            <View style={folderModalStyles.createContainer}>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Folder name..."
                placeholderTextColor={colors.textTertiary}
                style={[
                  folderModalStyles.input,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                    color: colors.text,
                  },
                ]}
                autoFocus
                onSubmitEditing={handleCreateFolder}
              />
              <View style={folderModalStyles.createButtons}>
                <Pressable
                  onPress={() => setIsCreating(false)}
                  style={folderModalStyles.cancelBtn}
                >
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreateFolder}
                  style={[folderModalStyles.createBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Create</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={folderModalStyles.option}
              onPress={() => setIsCreating(true)}
            >
              <View style={folderModalStyles.optionRow}>
                <FolderPlus size={18} color="#22c55e" />
                <Text style={[folderModalStyles.optionText, { color: "#22c55e" }]}>
                  Create New Folder
                </Text>
              </View>
            </Pressable>
          )}
          
          {/* Close button */}
          <Pressable
            style={[folderModalStyles.closeButton, { borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}
            onPress={handleClose}
          >
            <Text style={[folderModalStyles.closeText, { color: colors.primary }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const folderModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  container: {
    width: "100%",
    maxWidth: 300,
    borderRadius: 14,
    overflow: "hidden",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.3)",
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionText: {
    fontSize: 16,
  },
  createContainer: {
    padding: 16,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  createButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButton: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closeText: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
});

// ============================================================================
// MORE OPTIONS MODAL
// ============================================================================

interface MoreOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onAddToFolder: () => void;
  onDelete: () => void;
  isDark: boolean;
  colors: any;
}

function MoreOptionsModal({
  visible,
  onClose,
  onAddToFolder,
  onDelete,
  isDark,
  colors,
}: MoreOptionsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={moreModalStyles.overlay} onPress={onClose}>
        <View
          style={[
            moreModalStyles.container,
            { backgroundColor: isDark ? "#1c1c1e" : "#fff" },
          ]}
        >
          <Pressable
            style={[
              moreModalStyles.option,
              { borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
            ]}
            onPress={() => {
              onClose();
              onAddToFolder();
            }}
          >
            <View style={moreModalStyles.optionRow}>
              <FolderPlus size={20} color={colors.primary} />
              <Text style={[moreModalStyles.optionText, { color: colors.text }]}>
                Add to Folder
              </Text>
            </View>
          </Pressable>
          
          <Pressable
            style={moreModalStyles.option}
            onPress={() => {
              onClose();
              onDelete();
            }}
          >
            <View style={moreModalStyles.optionRow}>
              <Trash2 size={20} color="#ef4444" />
              <Text style={[moreModalStyles.optionText, { color: "#ef4444" }]}>
                Delete
              </Text>
            </View>
          </Pressable>
          
          <Pressable
            style={[
              moreModalStyles.closeButton,
              { borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
            ]}
            onPress={onClose}
          >
            <Text style={[moreModalStyles.closeText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const moreModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 10,
  },
  container: {
    borderRadius: 14,
    overflow: "hidden",
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: {
    fontSize: 17,
  },
  closeButton: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closeText: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
});

// ============================================================================
// FOLDER SECTION COMPONENT
// ============================================================================

interface FolderSectionProps {
  folder: PersonalChatFolder;
  conversations: PersonalConversation[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentConversationId: string | null;
  bulkMode: boolean;
  selectedIds: Set<string>;
  onSelectConversation: (conversation: PersonalConversation) => void;
  onBulkToggle: (id: string) => void;
  onMorePress: (conversationId: string) => void;
  onDeleteFolder: () => void;
  isDark: boolean;
  colors: any;
}

function FolderSection({
  folder,
  conversations,
  isCollapsed,
  onToggleCollapse,
  currentConversationId,
  bulkMode,
  selectedIds,
  onSelectConversation,
  onBulkToggle,
  onMorePress,
  onDeleteFolder,
  isDark,
  colors,
}: FolderSectionProps) {
  return (
    <View style={folderStyles.container}>
      <Pressable
        onPress={onToggleCollapse}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            "Delete Folder",
            `Delete "${folder.name}"? Conversations will be moved out of this folder.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: onDeleteFolder },
            ]
          );
        }}
        style={({ pressed }) => [
          folderStyles.header,
          {
            backgroundColor: pressed
              ? isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"
              : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          },
        ]}
      >
        <View style={folderStyles.headerLeft}>
          {isCollapsed ? (
            <ChevronRight size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
          <Folder size={18} color={colors.primary} />
          <Text style={[folderStyles.folderName, { color: colors.text }]}>
            {folder.name}
          </Text>
        </View>
        <Text style={[folderStyles.count, { color: colors.textTertiary }]}>
          {conversations.length}
        </Text>
      </Pressable>
      
      {!isCollapsed && (
        <View style={folderStyles.conversationsList}>
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === currentConversationId}
              isInBulkMode={bulkMode}
              isBulkSelected={selectedIds.has(conv.id)}
              onPress={() => onSelectConversation(conv)}
              onBulkToggle={() => onBulkToggle(conv.id)}
              onMorePress={() => onMorePress(conv.id)}
              isDark={isDark}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const folderStyles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  folderName: {
    fontSize: 15,
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
  },
  conversationsList: {
    marginLeft: 8,
  },
});

// ============================================================================
// MAIN DRAWER COMPONENT
// ============================================================================

export default function ConversationHistoryDrawer({
  isOpen,
  onClose,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onQuickStartAgent,
}: ConversationHistoryDrawerProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  // State
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [addToFolderVisible, setAddToFolderVisible] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  // Data hooks
  const { data: conversations = [], isLoading } = usePersonalConversations();
  const { data: folders = [] } = useFolders();
  const deleteConversation = useDeletePersonalConversation();
  const bulkDelete = useBulkDeletePersonalConversations();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const moveToFolder = useMoveConversationToFolder();
  
  // Group conversations by folder
  const { folderedConversations, unfolderedConversations } = useMemo(() => {
    const foldered: Record<string, PersonalConversation[]> = {};
    const unfoldered: PersonalConversation[] = [];
    
    folders.forEach((folder: PersonalChatFolder) => {
      foldered[folder.id] = [];
    });
    
    conversations.forEach((conv: PersonalConversation) => {
      if (conv.folderId && foldered[conv.folderId]) {
        foldered[conv.folderId].push(conv);
      } else {
        unfoldered.push(conv);
      }
    });
    
    return { folderedConversations: foldered, unfolderedConversations: unfoldered };
  }, [conversations, folders]);
  
  // Handlers
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
          onPress: () => deleteConversation.mutate(conversationId),
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
      setSelectedIds(new Set(conversations.map((c: PersonalConversation) => c.id)));
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
  
  const handleMorePress = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMoreOptionsVisible(true);
  }, []);
  
  const handleToggleFolderCollapse = useCallback((folderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  
  const handleCreateFolder = useCallback((name: string) => {
    createFolder.mutate(name, {
      onSuccess: (newFolder) => {
        if (selectedConversationId && newFolder?.id) {
          moveToFolder.mutate({
            conversationId: selectedConversationId,
            folderId: newFolder.id,
          });
        }
        setAddToFolderVisible(false);
        setSelectedConversationId(null);
      },
    });
  }, [createFolder, moveToFolder, selectedConversationId]);
  
  const handleSelectFolder = useCallback((folderId: string | null) => {
    if (selectedConversationId) {
      moveToFolder.mutate({
        conversationId: selectedConversationId,
        folderId,
      });
    }
    setAddToFolderVisible(false);
    setSelectedConversationId(null);
  }, [moveToFolder, selectedConversationId]);
  
  const handleDeleteFolder = useCallback((folderId: string) => {
    deleteFolder.mutate(folderId);
  }, [deleteFolder]);
  
  const handleQuickStart = useCallback((agentId: string) => {
    handleClose();
    onQuickStartAgent?.(agentId);
  }, [handleClose, onQuickStartAgent]);
  
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
            {/* Header */}
            <View style={styles.header}>
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
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>

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
            
            {/* Scrollable Content */}
            <GestureHandlerRootView style={styles.listContainer}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Quick Start Agents */}
                {conversations.length > 0 && (
                  <QuickStartAgents
                    conversations={conversations}
                    onQuickStart={handleQuickStart}
                    isDark={isDark}
                    colors={colors}
                  />
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
                </View>
                
                {/* Create Folder Button */}
                <Pressable
                  onPress={() => {
                    Alert.prompt(
                      "Create Folder",
                      "Enter a name for the new folder:",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Create",
                          onPress: (name) => {
                            if (name?.trim()) {
                              createFolder.mutate(name.trim());
                            }
                          },
                        },
                      ],
                      "plain-text"
                    );
                  }}
                  style={({ pressed }) => [
                    styles.createFolderButton,
                    {
                      backgroundColor: pressed
                        ? isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.05)"
                        : "transparent",
                    }
                  ]}
                >
                  <FolderPlus size={18} color="#22c55e" />
                  <Text style={styles.createFolderText}>Create Folder</Text>
                </Pressable>
                
                {/* Divider */}
                <View style={[
                  styles.divider,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }
                ]} />
                
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
                  <>
                    {/* Folders First */}
                    {folders.map((folder: PersonalChatFolder) => (
                      <FolderSection
                        key={folder.id}
                        folder={folder}
                        conversations={folderedConversations[folder.id] || []}
                        isCollapsed={collapsedFolders.has(folder.id)}
                        onToggleCollapse={() => handleToggleFolderCollapse(folder.id)}
                        currentConversationId={currentConversationId}
                        bulkMode={bulkMode}
                        selectedIds={selectedIds}
                        onSelectConversation={handleSelectConversation}
                        onBulkToggle={handleToggleBulkSelection}
                        onMorePress={handleMorePress}
                        onDeleteFolder={() => handleDeleteFolder(folder.id)}
                        isDark={isDark}
                        colors={colors}
                      />
                    ))}
                    
                    {/* Unfoldered Conversations */}
                    {unfolderedConversations.map((conv: PersonalConversation) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isSelected={conv.id === currentConversationId}
                        isInBulkMode={bulkMode}
                        isBulkSelected={selectedIds.has(conv.id)}
                        onPress={() => handleSelectConversation(conv)}
                        onBulkToggle={() => handleToggleBulkSelection(conv.id)}
                        onMorePress={() => handleMorePress(conv.id)}
                        isDark={isDark}
                        colors={colors}
                      />
                    ))}
                  </>
                )}
              </ScrollView>
            </GestureHandlerRootView>
          </LinearGradient>
        </BlurView>
      </Animated.View>
      
      {/* More Options Modal */}
      <MoreOptionsModal
        visible={moreOptionsVisible}
        onClose={() => setMoreOptionsVisible(false)}
        onAddToFolder={() => setAddToFolderVisible(true)}
        onDelete={() => {
          if (selectedConversationId) {
            handleDeleteSingle(selectedConversationId);
          }
          setSelectedConversationId(null);
        }}
        isDark={isDark}
        colors={colors}
      />
      
      {/* Add to Folder Modal */}
      <AddToFolderModal
        visible={addToFolderVisible}
        onClose={() => {
          setAddToFolderVisible(false);
          setSelectedConversationId(null);
        }}
        conversationId={selectedConversationId}
        folders={folders}
        onSelectFolder={handleSelectFolder}
        onCreateFolder={handleCreateFolder}
        isDark={isDark}
        colors={colors}
      />
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
  listContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  createChatButtonContainer: {
    paddingHorizontal: 0,
    paddingTop: 16,
  },
  createChatButton: {
    paddingVertical: 14,
    paddingRight: 16,
  },
  createChatButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 25,
  },
  createChatButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4FC3F7",
    marginLeft: 12,
  },
  createFolderButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 25,
    gap: 12,
  },
  createFolderText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#22c55e",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginTop: 12,
    marginBottom: 16,
  },
  conversationItemContainer: {
    position: "relative",
    marginBottom: 8,
  },
  moreButtonContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  conversationItemAnimated: {
    backgroundColor: "transparent",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingLeft: 24,
    paddingRight: 16,
    minHeight: 56,
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
    paddingTop: 60,
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
