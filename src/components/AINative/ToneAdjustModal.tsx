/**
 * Tone Adjustment Modal
 *
 * Modal for adjusting the tone of text before sending.
 * Shows preview of adjusted text with different tone options.
 */

import React, { useState, useEffect } from "react";
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
  Wand2,
  Briefcase,
  Coffee,
  Heart,
  Sparkles,
  AlertCircle,
  MessageCircle,
  FileText,
  Copy,
  Check,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ToneAdjustModalProps {
  visible: boolean;
  onClose: () => void;
  originalText: string;
  onApply: (adjustedText: string) => void;
}

const TONE_OPTIONS = [
  {
    id: "professional",
    label: "Professional",
    description: "Business-appropriate",
    icon: Briefcase,
    color: "#007AFF",
  },
  {
    id: "casual",
    label: "Casual",
    description: "Relaxed & friendly",
    icon: Coffee,
    color: "#FF9F0A",
  },
  {
    id: "friendly",
    label: "Friendly",
    description: "Warm & personable",
    icon: Heart,
    color: "#FF453A",
  },
  {
    id: "enthusiastic",
    label: "Enthusiastic",
    description: "Energetic & excited",
    icon: Sparkles,
    color: "#FFD60A",
  },
  {
    id: "empathetic",
    label: "Empathetic",
    description: "Understanding & caring",
    icon: MessageCircle,
    color: "#AF52DE",
  },
  {
    id: "concise",
    label: "Concise",
    description: "Brief & to-the-point",
    icon: FileText,
    color: "#34C759",
  },
];

const ToneAdjustModal: React.FC<ToneAdjustModalProps> = ({
  visible,
  onClose,
  originalText,
  onApply,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [adjustedText, setAdjustedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedTone(null);
      setAdjustedText("");
      setError(null);
      setCopied(false);
    }
  }, [visible]);

  const handleToneSelect = async (toneId: string) => {
    if (!user || loading) return;

    Haptics.selectionAsync();
    setSelectedTone(toneId);
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ adjustedText: string }>("/api/ai-native/adjust-tone", {
        userId: user.id,
        text: originalText,
        targetTone: toneId,
      });

      setAdjustedText(response.adjustedText);
    } catch (err: any) {
      console.error("[ToneAdjust] Error:", err);
      setError("Failed to adjust tone. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!adjustedText) return;

    await Clipboard.setStringAsync(adjustedText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (!adjustedText) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(adjustedText);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView
        intensity={isDark ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

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
                    { backgroundColor: isDark ? "rgba(175, 82, 222, 0.2)" : "rgba(175, 82, 222, 0.1)" },
                  ]}
                >
                  <Wand2 size={24} color="#AF52DE" />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Adjust Tone</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Rewrite your message with a different tone
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Original Text */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Original Message
                </Text>
                <View
                  style={[
                    styles.textBox,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                      borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)",
                    },
                  ]}
                >
                  <Text style={[styles.originalText, { color: colors.text }]}>{originalText}</Text>
                </View>
              </View>

              {/* Tone Options */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Choose a Tone
                </Text>
                <View style={styles.toneGrid}>
                  {TONE_OPTIONS.map((tone) => {
                    const Icon = tone.icon;
                    const isSelected = selectedTone === tone.id;
                    return (
                      <TouchableOpacity
                        key={tone.id}
                        onPress={() => handleToneSelect(tone.id)}
                        disabled={loading}
                        style={[
                          styles.toneOption,
                          {
                            backgroundColor: isSelected
                              ? `${tone.color}15`
                              : isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.03)",
                            borderColor: isSelected ? tone.color : "transparent",
                            opacity: loading && !isSelected ? 0.5 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.toneIcon, { backgroundColor: `${tone.color}20` }]}>
                          <Icon size={18} color={tone.color} />
                        </View>
                        <Text style={[styles.toneLabel, { color: colors.text }]}>{tone.label}</Text>
                        <Text style={[styles.toneDesc, { color: colors.textTertiary }]}>
                          {tone.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Loading State */}
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Adjusting tone...
                  </Text>
                </View>
              )}

              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Result */}
              {adjustedText && !loading && (
                <View style={styles.section}>
                  <View style={styles.resultHeader}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      Adjusted Message
                    </Text>
                    <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
                      {copied ? (
                        <Check size={16} color="#34C759" />
                      ) : (
                        <Copy size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                  <View
                    style={[
                      styles.resultBox,
                      {
                        backgroundColor: isDark ? "rgba(175, 82, 222, 0.1)" : "rgba(175, 82, 222, 0.05)",
                        borderColor: isDark ? "rgba(175, 82, 222, 0.3)" : "rgba(175, 82, 222, 0.2)",
                      },
                    ]}
                  >
                    <Text style={[styles.resultText, { color: colors.text }]}>{adjustedText}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Apply Button */}
            {adjustedText && !loading && (
              <TouchableOpacity
                onPress={handleApply}
                style={[styles.applyButton, { backgroundColor: "#AF52DE" }]}
              >
                <Wand2 size={18} color="#fff" />
                <Text style={styles.applyButtonText}>Use This Version</Text>
              </TouchableOpacity>
            )}
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
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  originalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  toneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toneOption: {
    width: (SCREEN_WIDTH - 80 - 16) / 3,
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  toneIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  toneLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  toneDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    flex: 1,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copyButton: {
    padding: 4,
  },
  resultBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 22,
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 16,
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ToneAdjustModal;

