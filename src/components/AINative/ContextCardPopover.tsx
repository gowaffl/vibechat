/**
 * Context Card Popover Component
 *
 * Shows AI-generated background information on topics.
 * Can be triggered by long-pressing on highlighted terms or via an action button.
 */

import React, { useState } from "react";
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
  Lightbulb,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ContextCard {
  id?: string;
  topic: string;
  title: string;
  summary: string;
  keyPoints: string[];
  relevance?: string;
}

interface ContextCardPopoverProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  topic: string;
  messageId?: string;
  existingCard?: ContextCard | null;
}

const ContextCardPopover: React.FC<ContextCardPopoverProps> = ({
  visible,
  onClose,
  chatId,
  topic,
  messageId,
  existingCard,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  const [card, setCard] = useState<ContextCard | null>(existingCard || null);
  const [loading, setLoading] = useState(!existingCard);
  const [error, setError] = useState<string | null>(null);

  // Fetch context card when modal opens
  React.useEffect(() => {
    if (visible && !existingCard) {
      fetchContextCard();
    }
  }, [visible]);

  // Reset when topic changes
  React.useEffect(() => {
    if (existingCard) {
      setCard(existingCard);
      setLoading(false);
    }
  }, [existingCard]);

  const fetchContextCard = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ContextCard>("/api/ai-native/context-card", {
        userId: user.id,
        chatId,
        messageId,
        topic,
      });

      setCard(response);
    } catch (err: any) {
      console.error("[ContextCard] Error:", err);
      setError("Failed to generate context. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    Haptics.selectionAsync();
    fetchContextCard();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView
        intensity={isDark ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.popover,
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
                  { backgroundColor: isDark ? "rgba(255, 214, 10, 0.2)" : "rgba(255, 214, 10, 0.1)" },
                ]}
              >
                <Lightbulb size={22} color="#FFD60A" />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Context Card</Text>
                <Text style={[styles.topicText, { color: colors.primary }]} numberOfLines={1}>
                  {topic}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleRefresh}
                disabled={loading}
                style={[
                  styles.refreshButton,
                  { opacity: loading ? 0.5 : 1 },
                ]}
              >
                <RefreshCw size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Generating context...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Info size={24} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  onPress={handleRefresh}
                  style={[styles.retryButton, { borderColor: colors.primary }]}
                >
                  <Text style={[styles.retryText, { color: colors.primary }]}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : card ? (
              <>
                {/* Title */}
                <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>

                {/* Summary */}
                <Text style={[styles.summary, { color: colors.textSecondary }]}>
                  {card.summary}
                </Text>

                {/* Key Points */}
                {card.keyPoints && card.keyPoints.length > 0 && (
                  <View style={styles.keyPointsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Points</Text>
                    {card.keyPoints.map((point, index) => (
                      <View key={index} style={styles.keyPointItem}>
                        <CheckCircle size={16} color="#34C759" />
                        <Text style={[styles.keyPointText, { color: colors.textSecondary }]}>
                          {point}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Relevance */}
                {card.relevance && (
                  <View
                    style={[
                      styles.relevanceBox,
                      {
                        backgroundColor: isDark ? "rgba(255, 214, 10, 0.1)" : "rgba(255, 214, 10, 0.05)",
                        borderColor: isDark ? "rgba(255, 214, 10, 0.3)" : "rgba(255, 214, 10, 0.2)",
                      },
                    ]}
                  >
                    <Info size={16} color="#FFD60A" />
                    <Text style={[styles.relevanceText, { color: colors.text }]}>
                      {card.relevance}
                    </Text>
                  </View>
                )}

                {/* AI Disclaimer */}
                <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                  ✨ Generated by AI • Information may not be 100% accurate
                </Text>
              </>
            ) : null}
          </ScrollView>
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
  popover: {
    width: SCREEN_WIDTH - 48,
    maxHeight: 450,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  topicText: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  refreshButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 16,
    maxHeight: 350,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  keyPointsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  keyPointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  keyPointText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  relevanceBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  relevanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  disclaimer: {
    fontSize: 11,
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default ContextCardPopover;

