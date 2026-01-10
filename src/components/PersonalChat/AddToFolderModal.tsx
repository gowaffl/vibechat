/**
 * AddToFolderModal Component
 * 
 * Premium bottom sheet modal for organizing conversations into folders.
 * Matches VibeChat's brand design system with liquid glass aesthetic.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { X, FolderPlus, Check, Folder } from "lucide-react-native";
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/contexts/ThemeContext";
import { useFolders, useCreateFolder, useMoveConversationToFolder } from "@/hooks/usePersonalChats";
import type { PersonalChatFolder } from "@/shared/contracts";

interface AddToFolderModalProps {
  visible: boolean;
  conversationId: string;
  currentFolderId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Folder Option Item with liquid glass styling
 */
const FolderOption = React.memo(({
  folder,
  onSelect,
  colors,
  isDark,
}: {
  folder: PersonalChatFolder;
  onSelect: () => void;
  colors: any;
  isDark: boolean;
}) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };
  
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onSelect}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.folderOption,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            opacity: pressed ? 0.8 : 1,
          }
        ]}
      >
        <View style={styles.folderOptionContent}>
          <View style={[
            styles.folderIconContainer,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            }
          ]}>
            <Folder 
              size={20} 
              color={colors.textSecondary} 
              strokeWidth={2.5}
            />
          </View>
          <View style={styles.folderInfo}>
            <Text 
              style={[
                styles.folderOptionText, 
                { 
                  color: colors.text,
                  fontWeight: "500",
                }
              ]}
              numberOfLines={1}
            >
              {folder.name}
            </Text>
            <Text style={[styles.folderCount, { color: colors.textTertiary }]}>
              {folder.conversationCount || 0} {folder.conversationCount === 1 ? 'chat' : 'chats'}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/**
 * AddToFolderModal - Premium bottom sheet
 */
export default function AddToFolderModal({
  visible,
  conversationId,
  currentFolderId,
  onClose,
  onSuccess,
}: AddToFolderModalProps) {
  const { isDark, colors } = useTheme();
  
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();
  const moveToFolder = useMoveConversationToFolder();
  
  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setShowCreateNew(false);
      setNewFolderName("");
      setIsSubmitting(false);
    }
  }, [visible]);
  
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);
  
  const handleSelectFolder = useCallback(async (folderId: string | null) => {
    if (folderId === currentFolderId) {
      // No change needed, just close
      onClose();
      return;
    }
    
    // Auto-apply the folder selection
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await moveToFolder.mutateAsync({
        conversationId,
        folderId: folderId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("[AddToFolderModal] Error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [currentFolderId, moveToFolder, conversationId, onSuccess, onClose]);
  
  const handleToggleCreateNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreateNew((prev) => !prev);
  }, []);
  
  const handleConfirm = useCallback(async () => {
    if (isSubmitting || !newFolderName.trim()) return;
    
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      // Create new folder and move conversation to it
      const newFolder = await createFolder.mutateAsync(newFolderName.trim());
      await moveToFolder.mutateAsync({
        conversationId,
        folderId: newFolder.id,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("[AddToFolderModal] Error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, newFolderName, createFolder, moveToFolder, conversationId, onSuccess, onClose]);
  
  const canConfirm = newFolderName.trim().length > 0;
  
  if (!visible) return null;
  
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
                  <View>
                    <Text style={[styles.title, { color: colors.text }]}>
                      Organize
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                      Add to folder or create new
                    </Text>
                  </View>
                  <Pressable 
                    onPress={handleClose} 
                    style={({ pressed }) => [
                      styles.closeButton,
                      {
                        backgroundColor: isDark 
                          ? pressed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"
                          : pressed ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)",
                      }
                    ]}
                  >
                    <X size={22} color={colors.textSecondary} strokeWidth={2.5} />
                  </Pressable>
                </View>
                
                {/* Folder List */}
                <ScrollView 
                  style={styles.folderList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.folderListContent}
                >
                  {/* Remove from folder option */}
                  {currentFolderId && (
                    <Pressable
                      onPress={() => handleSelectFolder(null)}
                      style={({ pressed }) => [
                        styles.removeOption,
                        {
                          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                          borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.25)",
                          opacity: pressed ? 0.8 : 1,
                        }
                      ]}
                    >
                      <View style={styles.removeIconContainer}>
                        <X size={20} color="#ef4444" strokeWidth={2.5} />
                      </View>
                      <Text style={styles.removeText}>
                        Remove from folder
                      </Text>
                    </Pressable>
                  )}
                  
                  {/* Existing folders */}
                  {folders.length > 0 ? (
                    folders.map((folder) => (
                      <FolderOption
                        key={folder.id}
                        folder={folder}
                        onSelect={() => handleSelectFolder(folder.id)}
                        colors={colors}
                        isDark={isDark}
                      />
                    ))
                  ) : !showCreateNew && (
                    <View style={styles.emptyState}>
                      <LinearGradient
                        colors={
                          isDark
                            ? ["rgba(0, 198, 255, 0.15)", "rgba(0, 198, 255, 0.05)"]
                            : ["rgba(0, 198, 255, 0.1)", "rgba(0, 198, 255, 0.02)"]
                        }
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.emptyIconContainer}
                      >
                        <Folder size={48} color="#00C6FF" strokeWidth={1.5} />
                      </LinearGradient>
                      <Text style={[styles.emptyText, { color: colors.text }]}>
                        No folders yet
                      </Text>
                      <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                        Organize your chats by creating folders
                      </Text>
                    </View>
                  )}
                </ScrollView>
                
                {/* Create New Folder Section */}
                {!showCreateNew ? (
                  <View style={[
                    styles.createNewSection,
                    { borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }
                  ]}>
                    <Pressable
                      onPress={handleToggleCreateNew}
                      style={({ pressed }) => [
                        styles.createNewButton,
                        {
                          backgroundColor: isDark ? "rgba(0, 198, 255, 0.1)" : "rgba(0, 198, 255, 0.08)",
                          borderColor: "rgba(0, 198, 255, 0.4)",
                          opacity: pressed ? 0.8 : 1,
                        }
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <FolderPlus 
                          size={22} 
                          color="#00C6FF" 
                          strokeWidth={2.5} 
                        />
                        <Text style={[
                          styles.createNewText,
                          { color: "#00C6FF" }
                        ]}>
                          Create New Folder
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : (
                  <Animated.View 
                    entering={FadeIn.duration(250)}
                    style={[
                      styles.createFormSection,
                      { borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }
                    ]}
                  >
                    <View style={styles.createFormHeader}>
                      <FolderPlus size={20} color="#00C6FF" strokeWidth={2.5} />
                      <Text style={[styles.createFormTitle, { color: "#00C6FF" }]}>
                        New Folder
                      </Text>
                    </View>
                    
                    <View style={styles.inputWithSubmit}>
                      <TextInput
                        value={newFolderName}
                        onChangeText={setNewFolderName}
                        placeholder="Folder name..."
                        placeholderTextColor={colors.textTertiary}
                        style={[
                          styles.textInput,
                          { 
                            color: colors.text,
                            backgroundColor: isDark 
                              ? "rgba(255,255,255,0.06)" 
                              : "rgba(0,0,0,0.03)",
                            borderColor: isDark 
                              ? "rgba(0, 198, 255, 0.3)" 
                              : "rgba(0, 198, 255, 0.25)",
                          }
                        ]}
                        autoFocus
                        maxLength={50}
                        returnKeyType="done"
                        onSubmitEditing={canConfirm ? handleConfirm : undefined}
                      />
                      <Pressable
                        onPress={handleConfirm}
                        disabled={!canConfirm || isSubmitting}
                        style={[
                          styles.submitButton,
                          {
                            opacity: canConfirm && !isSubmitting ? 1 : 0.4,
                          }
                        ]}
                      >
                        <LinearGradient
                          colors={canConfirm && !isSubmitting 
                            ? ["#0061FF", "#00C6FF", "#00E676"]
                            : ["rgba(0, 97, 255, 0.4)", "rgba(0, 198, 255, 0.4)", "rgba(0, 230, 118, 0.4)"]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.submitGradient}
                        >
                          <Check size={20} color="#fff" strokeWidth={3} />
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </Animated.View>
                )}
                
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

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
    maxHeight: "80%",
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
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  gradientContainer: {
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  folderList: {
    maxHeight: 320,
    paddingHorizontal: 20,
  },
  folderListContent: {
    paddingBottom: 4,
    flexGrow: 1,
  },
  folderOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  folderOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  folderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  folderInfo: {
    flex: 1,
    gap: 2,
  },
  folderOptionText: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  folderCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  removeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1.5,
  },
  removeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#ef4444",
    letterSpacing: -0.3,
  },
  emptyState: {
    paddingVertical: 56,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 4,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  createNewSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    borderTopWidth: 1,
    marginTop: 8,
  },
  createNewButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  createNewText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  createFormSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    marginTop: 16,
    gap: 16,
  },
  createFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  createFormTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  inputWithSubmit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  submitButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0061FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
});
