import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useColorScheme,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";
import type { ThreadFilterRules, Thread } from "@shared/contracts";

interface CreateThreadModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    icon: string | null,
    isShared: boolean,
    filterRules: ThreadFilterRules
  ) => void;
  isCreating?: boolean;
  editingThread?: Thread | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CreateThreadModal: React.FC<CreateThreadModalProps> = ({
  visible,
  onClose,
  onCreate,
  isCreating = false,
  editingThread = null,
}) => {
  const colorScheme = useColorScheme();
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showModal, setShowModal] = useState(visible);

  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Pre-populate form when editing
  React.useEffect(() => {
    if (editingThread) {
      setName(editingThread.name);
      setIsShared(editingThread.isShared);
      // Filter out the thread name from keywords when editing (it's auto-added)
      const threadKeywords = editingThread.filterRules.keywords?.filter(
        k => k.toLowerCase() !== editingThread.name.toLowerCase()
      ) || [];
      setKeywords(threadKeywords.join(", "));
    }
  }, [editingThread]);

  React.useEffect(() => {
    if (visible) {
      setShowModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 800,
          damping: 50,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset form
      setName("");
      setIsShared(true);
      setKeywords("");

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => setShowModal(false));
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    // Removed haptic on close
    onClose();
  };

  const handleCreate = () => {
    console.log("=== [CreateThreadModal] handleCreate called ===");
    if (!name.trim()) {
      console.log("[CreateThreadModal] Name is empty, returning");
      return;
    }

    const filterRules: ThreadFilterRules = {};

    if (keywords.trim()) {
      filterRules.keywords = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }

    // Note: Thread name is automatically added as a keyword on the backend

    console.log("[CreateThreadModal] Calling onCreate with:", { name: name.trim(), icon: null, isShared, filterRules });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCreate(name.trim(), null, isShared, filterRules);
    console.log("[CreateThreadModal] onCreate called successfully");
  };

  const canCreate = name.trim().length > 0 && !isCreating;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
        }}
      >
        <BlurView intensity={40} tint="dark" style={{ flex: 1 }}>
          {/* Backdrop */}
          <Pressable style={{ flex: 1 }} onPress={handleClose}>
            <View style={{ flex: 1 }} />
          </Pressable>

          {/* Modal Content */}
          <Animated.View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: SCREEN_HEIGHT * 0.85,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <SafeAreaView>
                <View
                  style={{
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    overflow: "hidden",
                  }}
                >
                <BlurView intensity={80} tint="dark">
                  <LinearGradient
                    colors={[
                      "rgba(20, 184, 166, 0.15)",
                      "rgba(13, 148, 136, 0.08)",
                      "rgba(0, 0, 0, 0.5)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: 20 }}
                  >
                    {/* Handle Bar */}
                    <View style={{ alignItems: "center", marginBottom: 16 }}>
                      <View
                        style={{
                          width: 40,
                          height: 5,
                          borderRadius: 2.5,
                          backgroundColor: "rgba(255, 255, 255, 0.3)",
                        }}
                      />
                    </View>

                    {/* Header */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 24,
                        marginBottom: 20,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: "#FFFFFF",
                            marginBottom: 4,
                          }}
                        >
                          {editingThread ? "✏️ Edit Thread" : "✨ Create Thread"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "rgba(255, 255, 255, 0.6)",
                          }}
                        >
                          AI filters messages automatically
                        </Text>
                      </View>

                      <Pressable
                        onPress={handleClose}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: pressed
                            ? "rgba(255, 255, 255, 0.15)"
                            : "rgba(255, 255, 255, 0.1)",
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text style={{ fontSize: 20, color: "#FFFFFF" }}>✕</Text>
                      </Pressable>
                    </View>

                    {/* Form Content */}
                    <ScrollView
                      style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
                      contentContainerStyle={{
                        paddingHorizontal: 24,
                        paddingBottom: isKeyboardVisible ? 20 : 24,
                      }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {/* AI Smart Filter Info */}
                      <View
                        style={{
                          backgroundColor: "rgba(20, 184, 166, 0.15)",
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 16,
                          borderWidth: 1,
                          borderColor: "rgba(20, 184, 166, 0.3)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: "rgba(255, 255, 255, 0.9)",
                            lineHeight: 18,
                          }}
                        >
                          ✨ <Text style={{ fontWeight: "600" }}>Smart AI Filtering:</Text> Messages are automatically filtered based on your keywords.{"\n\n"}
                          💡 <Text style={{ fontWeight: "600" }}>Guaranteed Match:</Text> Use{" "}
                          <Text style={{ fontWeight: "700", color: "#14B8A6" }}>
                            @{name.toLowerCase() || "threadname"}
                          </Text>{" "}
                          in any message to ensure it appears in this thread.
                        </Text>
                      </View>

                      {/* Thread Name */}
                      <LiquidGlassCard
                        variant="thread"
                        title="Thread Name"
                        subtitle="Auto-creates @tag for guaranteed matching"
                        style={{ marginBottom: 16 }}
                      >
                        <TextInput
                          value={name}
                          onChangeText={setName}
                          placeholder="e.g., places, gaming, work..."
                          placeholderTextColor="rgba(255, 255, 255, 0.4)"
                          keyboardAppearance="dark"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 16,
                            color: "#FFFFFF",
                            fontWeight: "600",
                          }}
                          maxLength={50}
                        />
                      </LiquidGlassCard>

                      {/* Keywords Filter */}
                      <LiquidGlassCard
                        variant="thread"
                        title="Keywords (Optional)"
                        subtitle="AI will find related messages"
                        style={{ marginBottom: 16 }}
                      >
                        <TextInput
                          value={keywords}
                          onChangeText={setKeywords}
                          placeholder="e.g., restaurant, vacation, coding"
                          placeholderTextColor="rgba(255, 255, 255, 0.4)"
                          keyboardAppearance="dark"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 15,
                            color: "#FFFFFF",
                          }}
                          multiline
                        />
                      </LiquidGlassCard>

                      {/* Shared Toggle */}
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setIsShared(!isShared);
                        }}
                      >
                        <LiquidGlassCard variant="thread">
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 12 }}>
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "600",
                                  color: "#FFFFFF",
                                  marginBottom: 4,
                                }}
                              >
                                👥 Shared Thread
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "rgba(255, 255, 255, 0.7)",
                                }}
                              >
                                Other members can view this thread
                              </Text>
                            </View>
                            <View
                              style={{
                                width: 52,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: isShared
                                  ? "#14B8A6"
                                  : "rgba(255, 255, 255, 0.2)",
                                padding: 2,
                                justifyContent: "center",
                                alignItems: isShared ? "flex-end" : "flex-start",
                              }}
                            >
                              <View
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  backgroundColor: "#FFFFFF",
                                }}
                              />
                            </View>
                          </View>
                        </LiquidGlassCard>
                      </Pressable>
                    </ScrollView>

                    {/* Actions */}
                    <View
                      style={{
                        paddingHorizontal: 24,
                        paddingTop: 16,
                        paddingBottom: 16,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <LiquidGlassButton
                        onPress={handleCreate}
                        variant="primary"
                        size="large"
                        disabled={!canCreate}
                        loading={isCreating}
                      >
                        {editingThread ? "Save Changes" : "Create Thread ✨"}
                      </LiquidGlassButton>
                    </View>
                  </LinearGradient>
                </BlurView>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

export default CreateThreadModal;

