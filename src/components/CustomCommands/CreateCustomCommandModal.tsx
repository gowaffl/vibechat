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
import { Sparkles, Wand2 } from "lucide-react-native";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";

interface CreateCustomCommandModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (command: string, prompt: string) => void;
  isCreating?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CreateCustomCommandModal: React.FC<CreateCustomCommandModalProps> = ({
  visible,
  onClose,
  onCreate,
  isCreating = false,
}) => {
  const colorScheme = useColorScheme();
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));

  const [command, setCommand] = useState("");
  const [prompt, setPrompt] = useState("");
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
      setCommand("");
      setPrompt("");

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
    if (!command.trim() || !prompt.trim()) {
      return;
    }

    // Ensure command starts with /
    const formattedCommand = command.trim().startsWith('/') 
      ? command.trim() 
      : `/${command.trim()}`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreate(formattedCommand, prompt.trim());
  };

  const canCreate = command.trim().length > 0 && prompt.trim().length > 0 && !isCreating;

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
                        "rgba(255, 159, 10, 0.15)",
                        "rgba(255, 159, 10, 0.08)",
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
                            ✨ Create Custom Command
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: "rgba(255, 255, 255, 0.6)",
                            }}
                          >
                            Make AI work your way
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
                            backgroundColor: "rgba(255, 159, 10, 0.15)",
                            borderRadius: 12,
                            padding: 14,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: "rgba(255, 159, 10, 0.3)",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: "rgba(255, 255, 255, 0.9)",
                              lineHeight: 18,
                            }}
                          >
                            💡 <Text style={{ fontWeight: "600" }}>How it works:</Text> Type your command (e.g., /summarize) in the chat, and AI will follow your custom instructions.
                          </Text>
                        </View>

                        {/* Command Name */}
                        <LiquidGlassCard
                          variant="default"
                          title="Command Name"
                          subtitle="Start with / or we'll add it for you"
                          style={{ marginBottom: 16 }}
                        >
                          <TextInput
                            value={command}
                            onChangeText={setCommand}
                            placeholder="e.g., /summarize, /translate, /joke"
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            keyboardAppearance={colorScheme === "dark" ? "dark" : "light"}
                            style={{
                              backgroundColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: 12,
                              padding: 14,
                              fontSize: 16,
                              color: "#FFFFFF",
                              fontWeight: "600",
                            }}
                            maxLength={30}
                            autoCapitalize="none"
                          />
                        </LiquidGlassCard>

                        {/* AI Prompt */}
                        <LiquidGlassCard
                          variant="default"
                          title="AI Instructions"
                          subtitle="What should AI do when this command is used?"
                          style={{ marginBottom: 16 }}
                        >
                          <TextInput
                            value={prompt}
                            onChangeText={setPrompt}
                            placeholder="e.g., Summarize the above conversation in 3 bullet points"
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            keyboardAppearance={colorScheme === "dark" ? "dark" : "light"}
                            style={{
                              backgroundColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: 12,
                              padding: 14,
                              fontSize: 15,
                              color: "#FFFFFF",
                              minHeight: 100,
                            }}
                            multiline
                            textAlignVertical="top"
                          />
                        </LiquidGlassCard>

                        {/* Examples */}
                        <View
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            borderRadius: 12,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.1)",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: "rgba(255, 255, 255, 0.8)",
                              marginBottom: 8,
                            }}
                          >
                            💡 Example Commands:
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: "rgba(255, 255, 255, 0.6)",
                              lineHeight: 18,
                            }}
                          >
                            • /eli5 - Explain like I'm 5{'\n'}
                            • /proofread - Check grammar and spelling{'\n'}
                            • /meetingnotes - Format as meeting notes
                          </Text>
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
                          color="#0061FF"
                        >
                          Create Command ✨
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

export default CreateCustomCommandModal;

