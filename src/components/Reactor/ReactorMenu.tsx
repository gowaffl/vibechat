import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";

interface ReactorMenuProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  hasImage: boolean;
  hasVideo: boolean;
  onCaption: () => void;
  onRemix: (prompt: string) => void;
  onMeme: (prompt: string) => void; // Changed to accept prompt
  isProcessing?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const ReactorMenu: React.FC<ReactorMenuProps> = ({
  visible,
  onClose,
  messageId,
  hasImage,
  hasVideo,
  onCaption,
  onRemix,
  onMeme,
  isProcessing = false,
}) => {
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showRemixInput, setShowRemixInput] = useState(false);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [showMemeInput, setShowMemeInput] = useState(false);
  const [memePrompt, setMemePrompt] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showModal, setShowModal] = useState(visible);

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
      setShowModal(true);
      // Reduced to very light feedback
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
      setShowRemixInput(false);
      setRemixPrompt("");
      setShowMemeInput(false);
      setMemePrompt("");
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
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    // Removed haptic on close for cleaner exit
    onClose();
  };

  const handleOptionPress = (action: () => void, shouldClose: boolean = true) => {
    Haptics.selectionAsync();
    action();
    if (shouldClose && !showRemixInput && !showMemeInput) {
      handleClose();
    }
  };

  const handleRemixSubmit = () => {
    console.log("[ReactorMenu] handleRemixSubmit called, prompt:", remixPrompt);
    if (remixPrompt.trim()) {
      console.log("[ReactorMenu] Calling onRemix with prompt:", remixPrompt.trim());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRemix(remixPrompt.trim());
      handleClose();
    } else {
      console.log("[ReactorMenu] Prompt is empty, not calling onRemix");
    }
  };

  const handleMemeSubmit = () => {
    console.log("[ReactorMenu] handleMemeSubmit called, prompt:", memePrompt);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Allow empty prompt - AI will decide on its own
    console.log("[ReactorMenu] Calling onMeme with prompt:", memePrompt.trim());
    onMeme(memePrompt.trim());
    handleClose();
  };

  const reactorOptions: Array<{
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    available: boolean;
    action: () => void;
    noClose?: boolean;
  }> = [
    {
      id: "caption",
      icon: "💬",
      title: "Generate Caption",
      subtitle: "AI-powered caption for your media",
      available: hasImage,
      action: onCaption,
    },
    {
      id: "remix",
      icon: "🎨",
      title: "Remix Media",
      subtitle: "Transform with AI creativity",
      available: hasImage,
      action: () => setShowRemixInput(true),
      noClose: true,
    },
    {
      id: "meme",
      icon: "😂",
      title: "Make it a Meme",
      subtitle: "Turn it into something hilarious",
      available: hasImage,
      action: () => setShowMemeInput(true),
      noClose: true,
    },
  ];

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
          }}
        >
          <BlurView intensity={40} tint="dark" style={{ flex: 1 }}>
            {/* Backdrop */}
            <Pressable
              style={{ flex: 1 }}
              onPress={handleClose}
            >
              <View style={{ flex: 1 }} />
            </Pressable>

            {/* Menu Content */}
            <Animated.View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: SCREEN_HEIGHT * 0.7,
                transform: [{ translateY: slideAnim }],
              }}
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
                        "rgba(168, 85, 247, 0.15)",
                        "rgba(147, 51, 234, 0.08)",
                        "rgba(0, 0, 0, 0.5)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ paddingTop: 20, paddingBottom: 32 }}
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
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <Text style={{ fontSize: 32, marginRight: 8 }}>🎨</Text>
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: "700",
                              color: "#FFFFFF",
                            }}
                          >
                            Content Reactor
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "rgba(255, 255, 255, 0.6)",
                          }}
                        >
                          Transform your media with AI
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

                    {/* Processing Indicator */}
                    {isProcessing && (
                      <View
                        style={{
                          paddingHorizontal: 24,
                          marginBottom: 16,
                        }}
                      >
                        <LiquidGlassCard variant="reactor">
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <LuxeLogoLoader size="small" />
                            <Text
                              style={{
                                fontSize: 14,
                                color: "rgba(255, 255, 255, 0.9)",
                                fontWeight: "600",
                              }}
                            >
                              AI is working its magic...
                            </Text>
                          </View>
                        </LiquidGlassCard>
                      </View>
                    )}

                    {/* Options, Remix Input, or Meme Input */}
                    <View style={{ paddingHorizontal: 24, flex: 1 }}>
                      {showRemixInput ? (
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 20 : 100 }}
                        >
                          <LiquidGlassCard
                            variant="reactor"
                            style={{ marginBottom: 16 }}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "600",
                                color: "#FFFFFF",
                                marginBottom: 12,
                              }}
                            >
                              Describe how you want to remix it:
                            </Text>
                            <TextInput
                              value={remixPrompt}
                              onChangeText={setRemixPrompt}
                              placeholder="e.g., Make it cyberpunk style..."
                              placeholderTextColor="rgba(255, 255, 255, 0.4)"
                              multiline
                              numberOfLines={4}
                              keyboardAppearance="dark"
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                borderRadius: 12,
                                padding: 12,
                                fontSize: 15,
                                color: "#FFFFFF",
                                minHeight: 100,
                                maxHeight: 200,
                                textAlignVertical: "top",
                              }}
                            />
                          </LiquidGlassCard>

                          <View
                            style={{
                              flexDirection: "row",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <LiquidGlassButton
                                onPress={() => setShowRemixInput(false)}
                                variant="secondary"
                                size="medium"
                              >
                                Back
                              </LiquidGlassButton>
                            </View>
                            <View style={{ flex: 1 }}>
                              <LiquidGlassButton
                                onPress={handleRemixSubmit}
                                variant="primary"
                                size="medium"
                                disabled={!remixPrompt.trim()}
                              >
                                Remix! ✨
                              </LiquidGlassButton>
                            </View>
                          </View>
                        </ScrollView>
                      ) : showMemeInput ? (
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 20 : 100 }}
                        >
                          <LiquidGlassCard
                            variant="reactor"
                            style={{ marginBottom: 16 }}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "600",
                                color: "#FFFFFF",
                                marginBottom: 12,
                              }}
                            >
                              What should the meme say or be about?
                            </Text>
                            <TextInput
                              value={memePrompt}
                              onChangeText={setMemePrompt}
                              placeholder="e.g., When you finally understand recursion... Optional - leave blank for AI to decide!"
                              placeholderTextColor="rgba(255, 255, 255, 0.4)"
                              multiline
                              numberOfLines={4}
                              keyboardAppearance="dark"
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                borderRadius: 12,
                                padding: 12,
                                fontSize: 15,
                                color: "#FFFFFF",
                                minHeight: 100,
                                maxHeight: 200,
                                textAlignVertical: "top",
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: "rgba(255, 255, 255, 0.5)",
                                marginTop: 8,
                              }}
                            >
                              💡 Tip: The image will be kept mostly intact with meme text overlays added!
                            </Text>
                          </LiquidGlassCard>

                          <View
                            style={{
                              flexDirection: "row",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <LiquidGlassButton
                                onPress={() => setShowMemeInput(false)}
                                variant="secondary"
                                size="medium"
                              >
                                Back
                              </LiquidGlassButton>
                            </View>
                            <View style={{ flex: 1 }}>
                              <LiquidGlassButton
                                onPress={handleMemeSubmit}
                                variant="primary"
                                size="medium"
                              >
                                Make Meme! 😂
                              </LiquidGlassButton>
                            </View>
                          </View>
                        </ScrollView>
                      ) : (
                        <View style={{ gap: 12 }}>
                          {reactorOptions.map((option) => (
                            <Pressable
                              key={option.id}
                              onPress={() => handleOptionPress(option.action, !option.noClose)}
                              disabled={!option.available || isProcessing}
                              style={({ pressed }) => ({
                                opacity: !option.available || isProcessing ? 0.4 : pressed ? 0.8 : 1,
                              })}
                            >
                              <LiquidGlassCard variant="reactor">
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 16,
                                  }}
                                >
                                  <Text style={{ fontSize: 32 }}>{option.icon}</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={{
                                        fontSize: 16,
                                        fontWeight: "700",
                                        color: "#FFFFFF",
                                        marginBottom: 2,
                                      }}
                                    >
                                      {option.title}
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        color: "rgba(255, 255, 255, 0.7)",
                                      }}
                                    >
                                      {option.subtitle}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      fontSize: 18,
                                      color: "rgba(255, 255, 255, 0.5)",
                                    }}
                                  >
                                    →
                                  </Text>
                                </View>
                              </LiquidGlassCard>
                            </Pressable>
                          ))}

                          {!hasImage && (
                            <Text
                              style={{
                                fontSize: 13,
                                color: "rgba(255, 255, 255, 0.5)",
                                textAlign: "center",
                                marginTop: 8,
                              }}
                            >
                              Select a message with an image to use Reactor
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </BlurView>
              </View>
            </SafeAreaView>
          </Animated.View>
        </BlurView>
      </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ReactorMenu;

