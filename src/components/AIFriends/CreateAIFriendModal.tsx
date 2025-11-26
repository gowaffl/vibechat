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
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Sparkles, Zap, MessageCircle, User, Bell, BellOff } from "lucide-react-native";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";

interface CreateAIFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, personality: string, tone: string, engagementMode: "on-call" | "percentage" | "off", engagementPercent?: number) => void;
  isCreating?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CreateAIFriendModal: React.FC<CreateAIFriendModalProps> = ({
  visible,
  onClose,
  onCreate,
  isCreating = false,
}) => {
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));

  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("");
  const [tone, setTone] = useState("");
  const [engagementMode, setEngagementMode] = useState<"on-call" | "percentage" | "off">("on-call");
  const [engagementPercent, setEngagementPercent] = useState(50);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Available tone options
  const toneOptions = [
    "Professional", "Casual", "Friendly", "Humorous", "Sarcastic", "Formal", "Enthusiastic", "Calm"
  ];

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

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset form
      setName("");
      setPersonality("");
      setTone("");
      setEngagementMode("on-call");
      setEngagementPercent(50);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleCreate = () => {
    if (!name.trim()) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreate(
      name.trim(),
      personality.trim() || "",
      tone || "",
      engagementMode,
      engagementMode === "percentage" ? engagementPercent : undefined
    );
  };

  const canCreate = name.trim().length > 0 && !isCreating;

  return (
    <Modal
      visible={visible}
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
                        "rgba(52, 199, 89, 0.15)",
                        "rgba(52, 199, 89, 0.08)",
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
                            Create AI Friend
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: "rgba(255, 255, 255, 0.6)",
                            }}
                          >
                            Your personal AI companion
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
                        {/* Info Card */}
                        <View
                          style={{
                            backgroundColor: "rgba(52, 199, 89, 0.15)",
                            borderRadius: 12,
                            padding: 14,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: "rgba(52, 199, 89, 0.3)",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: "rgba(255, 255, 255, 0.9)",
                              lineHeight: 18,
                            }}
                          >
                            <Text style={{ fontWeight: "600" }}>AI Friends</Text> can participate in conversations, help with tasks, and keep chats lively!
                          </Text>
                        </View>

                        {/* AI Friend Name */}
                        <LiquidGlassCard
                          variant="default"
                          title="AI Friend Name"
                          subtitle="Give your AI a friendly name"
                          style={{ marginBottom: 16 }}
                        >
                          <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g., Alex, Helper, Buddy"
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
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

                        {/* Personality */}
                        <LiquidGlassCard
                          variant="default"
                          title="Personality (Optional)"
                          subtitle="Describe how your AI friend should behave"
                          style={{ marginBottom: 16 }}
                        >
                          <TextInput
                            value={personality}
                            onChangeText={setPersonality}
                            placeholder="e.g., Helpful and encouraging, always positive"
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            style={{
                              backgroundColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: 12,
                              padding: 14,
                              fontSize: 15,
                              color: "#FFFFFF",
                              minHeight: 80,
                            }}
                            multiline
                            textAlignVertical="top"
                          />
                        </LiquidGlassCard>

                        {/* Tone Options */}
                        <View style={{ marginBottom: 16 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: "rgba(255, 255, 255, 0.8)",
                              marginBottom: 8,
                            }}
                          >
                            Tone (Optional)
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            {toneOptions.map((toneOption) => {
                              const isSelected = tone === toneOption;
                              return (
                                <Pressable
                                  key={toneOption}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setTone(isSelected ? "" : toneOption);
                                  }}
                                >
                                  <View
                                    style={{
                                      paddingHorizontal: 16,
                                      paddingVertical: 8,
                                      borderRadius: 20,
                                      backgroundColor: isSelected
                                        ? "rgba(52, 199, 89, 0.25)"
                                        : "rgba(255, 255, 255, 0.1)",
                                      borderWidth: 1,
                                      borderColor: isSelected
                                        ? "#34C759"
                                        : "rgba(255, 255, 255, 0.2)",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 14,
                                        fontWeight: "600",
                                        color: isSelected ? "#34C759" : "#FFFFFF",
                                      }}
                                    >
                                      {toneOption}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        {/* Engagement Mode */}
                        <View style={{ marginBottom: 16 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: "rgba(255, 255, 255, 0.8)",
                              marginBottom: 4,
                            }}
                          >
                            Engagement Mode
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: "rgba(255, 255, 255, 0.6)",
                              marginBottom: 12,
                            }}
                          >
                            How often should AI participate?
                          </Text>
                          <View style={{ gap: 12 }}>
                            {[
                              { mode: "on-call" as const, label: "On-Call Only (@ai)", desc: "AI only responds when explicitly mentioned with @ai" },
                              { mode: "percentage" as const, label: "Automatic Engagement", desc: "AI joins conversations naturally based on percentage" },
                              { mode: "off" as const, label: "Off", desc: "AI friend is completely disabled" },
                            ].map((option) => {
                              const isSelected = engagementMode === option.mode;
                              return (
                                <Pressable
                                  key={option.mode}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setEngagementMode(option.mode);
                                  }}
                                >
                                  <View
                                    style={{
                                      paddingHorizontal: 16,
                                      paddingVertical: 12,
                                      borderRadius: 12,
                                      backgroundColor: isSelected
                                        ? "rgba(52, 199, 89, 0.25)"
                                        : "rgba(255, 255, 255, 0.05)",
                                      borderWidth: 2,
                                      borderColor: isSelected
                                        ? "#34C759"
                                        : "rgba(255, 255, 255, 0.1)",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 16,
                                        fontWeight: "600",
                                        color: isSelected ? "#34C759" : "#FFFFFF",
                                        marginBottom: 4,
                                      }}
                                    >
                                      {option.label}
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: "rgba(255, 255, 255, 0.6)",
                                        lineHeight: 16,
                                      }}
                                    >
                                      {option.desc}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
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
                          Create AI Friend
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

export default CreateAIFriendModal;

