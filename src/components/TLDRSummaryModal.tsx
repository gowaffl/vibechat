/**
 * TLDR Summary Modal
 *
 * Modal for selecting how many messages to summarize.
 * Clean, minimal design with selectable message count options.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { X, FileText, MessageSquare, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface TLDRSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (messageCount: number | "all") => void;
}

const MESSAGE_OPTIONS = [
  { id: 10, label: "Last 10", description: "Quick recap" },
  { id: 25, label: "Last 25", description: "Short summary" },
  { id: 50, label: "Last 50", description: "Detailed summary" },
  { id: 100, label: "Last 100", description: "Full context" },
  { id: "all", label: "All messages", description: "Complete history" },
] as const;

const TLDRSummaryModal: React.FC<TLDRSummaryModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { colors, isDark } = useTheme();
  const [selectedOption, setSelectedOption] = useState<number | "all">(25);

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedOption(25);
    }
  }, [visible]);

  const handleOptionSelect = (option: number | "all") => {
    Haptics.selectionAsync();
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(selectedOption);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView
        intensity={isDark ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
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
                  { backgroundColor: isDark ? "rgba(52, 199, 89, 0.2)" : "rgba(52, 199, 89, 0.1)" },
                ]}
              >
                <FileText size={24} color="#34C759" />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Summarize Chat</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Get a quick TLDR of your conversation
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.content}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              How many messages?
            </Text>
            <View style={styles.optionsContainer}>
              {MESSAGE_OPTIONS.map((option) => {
                const isSelected = selectedOption === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleOptionSelect(option.id)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(52, 199, 89, 0.15)"
                            : "rgba(52, 199, 89, 0.1)"
                          : isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.03)",
                        borderColor: isSelected ? "#34C759" : "transparent",
                      },
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <View style={[styles.optionIcon, { backgroundColor: `${isSelected ? "#34C759" : colors.textSecondary}15` }]}>
                        <MessageSquare size={18} color={isSelected ? "#34C759" : colors.textSecondary} />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {option.label}
                        </Text>
                        <Text style={[styles.optionDesc, { color: colors.textTertiary }]}>
                          {option.description}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkmark, { backgroundColor: "#34C759" }]}>
                        <Check size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.cancelButton,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, { backgroundColor: "#34C759" }]}
            >
              <FileText size={18} color="#fff" />
              <Text style={styles.submitText}>Summarize</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TLDRSummaryModal;
