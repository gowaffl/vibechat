/**
 * Share to Community Modal
 *
 * Allows users to share their AI Friends and Custom Commands to the community marketplace.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  X,
  Bot,
  Terminal,
  Globe,
  Tag,
  FileText,
  Check,
  Share2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ShareableItem {
  id: string;
  name?: string;
  command?: string;
  personality?: string;
  prompt?: string;
  tone?: string;
  engagementMode?: string;
  engagementPercent?: number;
}

interface ShareToCommunityModalProps {
  visible: boolean;
  onClose: () => void;
  item: ShareableItem | null;
  itemType: "ai_friend" | "command";
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: "productivity", label: "Productivity" },
  { id: "entertainment", label: "Entertainment" },
  { id: "support", label: "Support" },
  { id: "creative", label: "Creative" },
  { id: "utility", label: "Utility" },
  { id: "other", label: "Other" },
];

const ShareToCommunityModal: React.FC<ShareToCommunityModalProps> = ({
  visible,
  onClose,
  item,
  itemType,
  onSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("other");
  const [isPublic, setIsPublic] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    if (!user || !item) return;

    setSharing(true);
    setError(null);

    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const endpoint =
        itemType === "ai_friend"
          ? "/api/community/ai-friends/share"
          : "/api/community/commands/share";

      const payload =
        itemType === "ai_friend"
          ? {
              userId: user.id,
              aiFriendId: item.id,
              description,
              category: selectedCategory,
              tags,
              isPublic,
            }
          : {
              userId: user.id,
              commandId: item.id,
              description,
              category: selectedCategory,
              tags,
              isPublic,
            };

      const response = await api.post<{ success: boolean; id: string }>(endpoint, payload);

      if (response.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccess(true);
        onSuccess?.();
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error("Failed to share to community");
      }
    } catch (err: any) {
      console.error("[ShareToCommunity] Error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || "Failed to share. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const handleClose = () => {
    setDescription("");
    setTagsInput("");
    setSelectedCategory("other");
    setIsPublic(true);
    setSuccess(false);
    setError(null);
    onClose();
  };

  if (!item) return null;

  const isPersona = itemType === "ai_friend";
  const itemName = isPersona 
    ? item.name 
    : (item.command.startsWith('/') ? item.command : `/${item.command}`);
  const itemDetails = isPersona
    ? item.personality || "Custom AI Personality"
    : item.prompt || "Custom AI Command";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <BlurView
        intensity={isDark ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
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
                      backgroundColor: `${colors.primary}33`,
                    },
                  ]}
                >
                  <Share2 size={24} color={colors.primary} />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Share to Community
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Help others discover your creation
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Item Preview */}
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)",
                  },
                ]}
              >
                <View style={styles.previewHeader}>
                  <View
                    style={[
                      styles.previewIcon,
                      {
                        backgroundColor: isPersona
                          ? isDark
                            ? "rgba(52, 199, 89, 0.2)"
                            : "rgba(52, 199, 89, 0.1)"
                          : isDark
                          ? "rgba(175, 82, 222, 0.2)"
                          : "rgba(175, 82, 222, 0.1)",
                      },
                    ]}
                  >
                    {isPersona ? (
                      <Bot size={20} color="#34C759" />
                    ) : (
                      <Terminal size={20} color="#AF52DE" />
                    )}
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={[styles.previewName, { color: colors.text }]}>{itemName}</Text>
                    <Text style={[styles.previewType, { color: colors.textSecondary }]}>
                      {isPersona ? "AI Persona" : "Slash Command"}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.previewDetails, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {itemDetails}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <FileText size={16} color={colors.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    Description (optional)
                  </Text>
                </View>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe what makes this special..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                      borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                      color: colors.text,
                    },
                  ]}
                />
              </View>

              {/* Category */}
              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <Globe size={16} color={colors.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedCategory(cat.id);
                        }}
                        style={[
                          styles.categoryChip,
                        {
                          backgroundColor: isSelected
                            ? `${colors.primary}33`
                            : isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                          borderColor: isSelected
                            ? colors.primary
                            : isDark
                            ? colors.glassBorder
                            : "rgba(0, 0, 0, 0.08)",
                        },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            {
                              color: isSelected
                                ? isDark
                                  ? colors.primary
                                  : "#fff"
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Tags */}
              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <Tag size={16} color={colors.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    Tags (comma separated)
                  </Text>
                </View>
                <TextInput
                  value={tagsInput}
                  onChangeText={setTagsInput}
                  placeholder="e.g., fun, productivity, helper"
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                      borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                      color: colors.text,
                    },
                  ]}
                />
              </View>

              {/* Visibility Toggle */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsPublic(!isPublic);
                }}
                style={[
                  styles.visibilityToggle,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  },
                ]}
              >
                <Globe size={20} color={isPublic ? colors.primary : colors.textSecondary} />
                <View style={styles.visibilityInfo}>
                  <Text style={[styles.visibilityTitle, { color: colors.text }]}>
                    {isPublic ? "Public" : "Private"}
                  </Text>
                  <Text style={[styles.visibilityDesc, { color: colors.textSecondary }]}>
                    {isPublic
                      ? "Anyone can discover and clone this"
                      : "Only you can see this in the community"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isPublic ? colors.primary : "transparent",
                      borderColor: isPublic ? colors.primary : colors.textSecondary,
                    },
                  ]}
                >
                  {isPublic && <Check size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            </ScrollView>

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
                <Text style={styles.successText}>Shared to Community!</Text>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              onPress={handleShare}
              disabled={sharing || success}
              style={[
                styles.shareButton,
                {
                  backgroundColor: sharing || success
                    ? isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)"
                    : colors.primary,
                },
              ]}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Share2 size={20} color="#fff" />
                  <Text style={styles.shareButtonText}>Share to Community</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    width: "100%",
    alignItems: "center",
  },
  modal: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.8,
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
  content: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  previewCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
  },
  previewType: {
    fontSize: 12,
    marginTop: 2,
  },
  previewDetails: {
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  categoryScroll: {
    marginHorizontal: -4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  visibilityToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  visibilityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  visibilityTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  visibilityDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
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
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ShareToCommunityModal;

