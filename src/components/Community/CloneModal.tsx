/**
 * Clone Modal Component
 *
 * Modal for cloning community AI personas, commands, and workflows to user's chats.
 * Allows selecting target chat(s) and shows item details before cloning.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  X,
  Sparkles,
  Zap,
  Wand2,
  Download,
  Check,
  MessageCircle,
  Users,
  ChevronRight,
  User,
  Star,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Helper function to format creator name as "FirstName L."
const formatCreatorName = (fullName: string): string => {
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return parts[0]; // Just return the name if no last name
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
};

interface CommunityItem {
  id: string;
  name?: string;
  command?: string;
  description?: string;
  personality?: string;
  prompt?: string;
  tone?: string;
  triggerType?: string;
  actionType?: string;
  category?: string;
  tags?: string[];
  cloneCount?: number;
  creator?: {
    id: string;
    name: string;
    image: string;
  };
}

interface Chat {
  id: string;
  name: string;
  type: "dm" | "group";
  image?: string;
}

interface CloneModalProps {
  visible: boolean;
  onClose: () => void;
  item: CommunityItem | null;
  itemType: "ai_friend" | "command" | "workflow";
  onSuccess: () => void;
}

const CloneModal: React.FC<CloneModalProps> = ({
  visible,
  onClose,
  item,
  itemType,
  onSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [cloneToPersonal, setCloneToPersonal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's chats
  useEffect(() => {
    if (visible && user) {
      fetchChats();
    }
  }, [visible, user]);

  const fetchChats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.get<Chat[]>(`/api/chats?userId=${user.id}`);
      setChats(response || []);
    } catch (err) {
      console.error("[CloneModal] Error fetching chats:", err);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatToggle = (chatId: string) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  const handleClone = async () => {
    if (!user || !item || (!cloneToPersonal && selectedChats.size === 0)) return;

    setCloning(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; clonedItems: any[]; message: string }>(
        "/api/community/clone",
        {
          userId: user.id,
          itemType,
          communityItemId: item.id,
          targetChatIds: cloneToPersonal ? [] : Array.from(selectedChats),
          cloneToPersonal,
        }
      );

      if (response.success) {
        setSuccess(true);
        onSuccess();
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError("Failed to clone item. Please try again.");
      }
    } catch (err: any) {
      console.error("[CloneModal] Error cloning:", err);
      setError(err.message || "Failed to clone item. Please try again.");
    } finally {
      setCloning(false);
    }
  };

  const handleClose = () => {
    setSelectedChats(new Set());
    setCloneToPersonal(false);
    setSuccess(false);
    setError(null);
    onClose();
  };

  if (!item) return null;

  const isPersona = itemType === "ai_friend";
  const isCommand = itemType === "command";
  const isWorkflow = itemType === "workflow";
  
  const itemName = isPersona 
    ? item.name 
    : isCommand
    ? (item.command?.startsWith('/') ? item.command : `/${item.command}`)
    : item.name;
    
  const itemInstructions = isPersona 
    ? item.personality 
    : isCommand
    ? item.prompt
    : `${item.triggerType} → ${item.actionType}`;
    
  const hasDescription = item.description && item.description.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <BlurView
        intensity={isDark ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View
          style={[
            styles.modal,
            {
              backgroundColor: isDark ? colors.cardBackground : "#fff",
              borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isPersona
                      ? `${colors.primary}33`
                      : isCommand
                      ? isDark
                        ? "rgba(175, 82, 222, 0.2)"
                        : "rgba(175, 82, 222, 0.1)"
                      : isDark
                      ? "rgba(0, 122, 255, 0.2)"
                      : "rgba(0, 122, 255, 0.1)",
                  },
                ]}
              >
                {isPersona ? (
                  <Sparkles size={24} color={colors.primary} />
                ) : isCommand ? (
                  <Zap size={24} color="#AF52DE" />
                ) : (
                  <Wand2 size={24} color="#007AFF" />
                )}
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                  {itemName}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Clone to your chats
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Item Details - Scrollable */}
          <ScrollView
            style={styles.detailsScrollView}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)",
                },
              ]}
            >
              {/* Description (if provided) */}
              {hasDescription && (
                <View style={styles.descriptionSection}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Description</Text>
                  <Text style={[styles.detailsText, { color: colors.textSecondary }]}>
                    {item.description}
                  </Text>
                </View>
              )}

              {/* Instructions/Prompt */}
              {itemInstructions && (
                <View style={[styles.instructionsSection, hasDescription && { marginTop: 12 }]}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    {isPersona ? "Personality" : "Prompt"}
                  </Text>
                  <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
                    {itemInstructions}
                  </Text>
                </View>
              )}

              {/* Metadata Row */}
              <View style={[styles.metadataRow, (hasDescription || itemInstructions) && { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)" }]}>
                {item.category && (
                  <View style={styles.detailsRow}>
                    <Star size={14} color={colors.textTertiary} />
                    <Text style={[styles.detailsLabel, { color: colors.textTertiary }]}>
                      {item.category}
                    </Text>
                  </View>
                )}
                {item.creator && (
                  <View style={styles.detailsRow}>
                    <User size={14} color={colors.textTertiary} />
                    <Text style={[styles.detailsLabel, { color: colors.textTertiary }]}>
                      Created by {formatCreatorName(item.creator.name)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailsRow}>
                  <Download size={14} color={colors.textTertiary} />
                  <Text style={[styles.detailsLabel, { color: colors.textTertiary }]}>
                    {item.cloneCount || 0} Clones
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Selection Options */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select where to add:</Text>

          {/* Personal Agents Option (only for AI friends) */}
          {isPersona && (
            <TouchableOpacity
              onPress={() => {
                setCloneToPersonal(!cloneToPersonal);
                if (!cloneToPersonal) {
                  // Deselect all chats when selecting personal agents
                  setSelectedChats(new Set());
                }
              }}
              style={[
                styles.chatItem,
                {
                  backgroundColor: cloneToPersonal
                    ? `${colors.primary}26`
                    : "transparent",
                  borderColor: cloneToPersonal
                    ? colors.primary
                    : isDark
                    ? colors.glassBorder
                    : "rgba(0, 0, 0, 0.06)",
                  marginBottom: 12,
                },
              ]}
            >
              <View
                style={[
                  styles.chatIcon,
                  {
                    backgroundColor: cloneToPersonal
                      ? `${colors.primary}33`
                      : isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                <User size={18} color={cloneToPersonal ? colors.primary : colors.textSecondary} />
              </View>
              <Text
                style={[
                  styles.chatName,
                  {
                    color: cloneToPersonal ? colors.primary : colors.text,
                    fontWeight: cloneToPersonal ? "600" : "400",
                  },
                ]}
                numberOfLines={1}
              >
                Personal Agents
              </Text>
              {cloneToPersonal && (
                <View
                  style={[styles.checkmark, { backgroundColor: colors.primary }]}
                >
                  <Check size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Chat Selection */}
          {!cloneToPersonal && (
            <>
              {isPersona && (
                <Text style={[styles.orDivider, { color: colors.textTertiary }]}>or select chats:</Text>
              )}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : chats.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MessageCircle size={32} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No chats available
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
                  {chats.map((chat) => {
                    const isSelected = selectedChats.has(chat.id);
                    return (
                      <TouchableOpacity
                        key={chat.id}
                        onPress={() => {
                          handleChatToggle(chat.id);
                          // Deselect personal agents when selecting a chat
                          if (cloneToPersonal) {
                            setCloneToPersonal(false);
                          }
                        }}
                        style={[
                          styles.chatItem,
                          {
                            backgroundColor: isSelected
                              ? `${colors.primary}26`
                              : "transparent",
                            borderColor: isSelected
                              ? colors.primary
                              : isDark
                              ? colors.glassBorder
                              : "rgba(0, 0, 0, 0.06)",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.chatIcon,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.05)",
                            },
                          ]}
                        >
                          {chat.type === "group" ? (
                            <Users size={18} color={colors.textSecondary} />
                          ) : (
                            <MessageCircle size={18} color={colors.textSecondary} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.chatName,
                            {
                              color: isSelected ? colors.primary : colors.text,
                              fontWeight: isSelected ? "600" : "400",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {chat.name}
                        </Text>
                        {isSelected && (
                          <View
                            style={[styles.checkmark, { backgroundColor: colors.primary }]}
                          >
                            <Check size={14} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Success state */}
          {success && (
            <View style={styles.successContainer}>
              <Check size={24} color="#34C759" />
              <Text style={styles.successText}>Successfully cloned!</Text>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleClone}
            disabled={(selectedChats.size === 0 && !cloneToPersonal) || cloning || success}
            style={[
              styles.cloneButton,
              {
                backgroundColor:
                  (selectedChats.size === 0 && !cloneToPersonal) || cloning || success
                    ? isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)"
                    : colors.primary,
              },
            ]}
          >
            {cloning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Download size={20} color="#fff" />
                <Text style={styles.cloneButtonText}>
                  {cloneToPersonal
                    ? "Clone to Personal Agents"
                    : `Clone to ${selectedChats.size} Chat${selectedChats.size !== 1 ? "s" : ""}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modal: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  detailsScrollView: {
    maxHeight: 200,
    marginBottom: 16,
  },
  detailsCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  detailsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  detailsLabel: {
    fontSize: 13,
    textTransform: "capitalize",
  },
  descriptionSection: {
    marginBottom: 0,
  },
  instructionsSection: {
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metadataRow: {
    flexDirection: "column",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
  chatList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  chatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  successText: {
    color: "#34C759",
    fontSize: 16,
    fontWeight: "600",
  },
  cloneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  cloneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  orDivider: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default CloneModal;

