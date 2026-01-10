/**
 * EditFolderModal Component
 * 
 * Allows users to:
 * - Rename the folder
 * - View conversations in the folder
 * - Remove conversations from the folder
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { X, Check, Edit2, MessageSquare } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import type { PersonalChatFolder, PersonalConversation } from "@shared/contracts";

interface EditFolderModalProps {
  visible: boolean;
  folder: PersonalChatFolder | null;
  conversations: PersonalConversation[];
  onClose: () => void;
  onUpdateName: (folderId: string, newName: string) => void;
  onRemoveConversation: (conversationId: string) => void;
}

export const EditFolderModal: React.FC<EditFolderModalProps> = ({
  visible,
  folder,
  conversations,
  onClose,
  onUpdateName,
  onRemoveConversation,
}) => {
  const { colors, isDark } = useTheme();
  const [folderName, setFolderName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  // Update folder name when folder changes
  React.useEffect(() => {
    if (folder) {
      setFolderName(folder.name);
      setIsEditingName(false);
    }
  }, [folder]);

  const handleSaveName = useCallback(() => {
    if (!folder || !folderName.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdateName(folder.id, folderName.trim());
    setIsEditingName(false);
  }, [folder, folderName, onUpdateName]);

  const handleRemoveConversation = useCallback((conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemoveConversation(conversationId);
  }, [onRemoveConversation]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditingName(false);
    onClose();
  }, [onClose]);

  if (!folder || !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView
              intensity={20}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          </Pressable>
        </Animated.View>
        
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Animated.View
            entering={SlideInDown.springify().damping(25).stiffness(200)}
            exiting={SlideOutDown.springify().damping(25).stiffness(200)}
            style={styles.modalContainer}
          >
            <BlurView
              intensity={Platform.OS === "ios" ? 95 : 100}
              tint={isDark ? "dark" : "light"}
              style={styles.blurContainer}
            >
              <LinearGradient
                colors={
                  isDark
                    ? ["rgba(18,18,22,0.96)", "rgba(12,12,16,0.98)"]
                    : ["rgba(255,255,255,0.98)", "rgba(250,250,252,0.98)"]
                }
                style={styles.gradientContainer}
              >
                {/* Handle Bar */}
                <View style={styles.handleContainer}>
                  <View style={[
                    styles.handleBar,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }
                  ]} />
                </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[
              styles.iconContainer,
              { backgroundColor: isDark ? "rgba(0, 198, 255, 0.15)" : "rgba(0, 198, 255, 0.1)" }
            ]}>
              <Edit2 size={20} color="#00C6FF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Edit Folder
            </Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Folder Name Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              FOLDER NAME
            </Text>
            <View style={styles.nameInputContainer}>
              <TextInput
                value={folderName}
                onChangeText={setFolderName}
                onFocus={() => setIsEditingName(true)}
                placeholder="Enter folder name"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.nameInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    borderColor: isEditingName ? "#00C6FF" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                  }
                ]}
              />
              {isEditingName && folderName.trim() && folderName !== folder.name && (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                  <Pressable
                    onPress={handleSaveName}
                    style={({ pressed }) => [
                      styles.saveButton,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                  >
                    <LinearGradient
                      colors={["#00C6FF", "#0075FF"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.saveButtonGradient}
                    >
                      <Check size={18} color="#FFFFFF" strokeWidth={3} />
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          </View>

          {/* Conversations Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              CONVERSATIONS ({conversations.length})
            </Text>
            {conversations.length === 0 ? (
              <View style={[
                styles.emptyState,
                { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }
              ]}>
                <MessageSquare size={32} color={colors.textSecondary} strokeWidth={1.5} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No conversations in this folder
                </Text>
              </View>
            ) : (
              <View style={styles.conversationsList}>
                {conversations.map((conversation) => (
                  <View
                    key={conversation.id}
                    style={[
                      styles.conversationItem,
                      {
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                      }
                    ]}
                  >
                    <View style={styles.conversationInfo}>
                      <Text
                        style={[styles.conversationTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {conversation.title}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveConversation(conversation.id)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        {
                          backgroundColor: isDark
                            ? pressed ? "rgba(255,59,48,0.2)" : "rgba(255,59,48,0.1)"
                            : pressed ? "rgba(255,59,48,0.15)" : "rgba(255,59,48,0.08)",
                        }
                      ]}
                    >
                      <X size={16} color="#FF3B30" strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  blurContainer: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  gradientContainer: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.15)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  nameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  conversationsList: {
    gap: 10,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 12,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
});
