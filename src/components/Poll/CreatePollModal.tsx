import React, { useState, useEffect, useRef } from "react";
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
  PanResponder,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { BarChart3, Plus, X } from "lucide-react-native";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";
import { useTheme } from "@/contexts/ThemeContext";

interface CreatePollModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
  isCreating?: boolean;
  initialPoll?: { question: string; options: string[] } | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CreatePollModal: React.FC<CreatePollModalProps> = ({
  visible,
  onClose,
  onCreate,
  isCreating = false,
  initialPoll,
}) => {
  const { colors, isDark } = useTheme();
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const dragY = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(visible);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Reset or pre-fill form
      if (initialPoll) {
        setQuestion(initialPoll.question);
        setOptions(initialPoll.options.length >= 2 ? initialPoll.options : [...initialPoll.options, "", ""].slice(0, 2));
      } else {
        setQuestion("");
        setOptions(["", ""]);
      }

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
    onClose();
  };

  // PanResponder for swipe-down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dy) > 5 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.selectionAsync();
          onClose();
          Animated.spring(dragY, {
            toValue: 0,
            stiffness: 800,
            damping: 50,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            stiffness: 800,
            damping: 50,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          stiffness: 800,
          damping: 50,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Reset drag position when modal closes
  useEffect(() => {
    if (!visible) {
      dragY.setValue(0);
    }
  }, [visible]);

  const handleCreate = () => {
    const validOptions = options.filter((opt) => opt.trim().length > 0);
    if (!question.trim() || validOptions.length < 2) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCreate(question.trim(), validOptions);
  };

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, ""]);
      Haptics.selectionAsync();
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
      Haptics.selectionAsync();
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validOptions = options.filter((opt) => opt.trim().length > 0);
  const canCreate =
    question.trim().length > 0 && validOptions.length >= 2 && !isCreating;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
        }}
      >
        <BlurView intensity={40} tint={colors.blurTint} style={{ flex: 1 }}>
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
              transform: [{ translateY: slideAnim }, { translateY: dragY }],
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <SafeAreaView>
                {/* Handle Bar for swipe down */}
                <View
                  {...panResponder.panHandlers}
                  style={{
                    alignItems: "center",
                    paddingTop: 14,
                    paddingBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 5,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)",
                      borderRadius: 2.5,
                    }}
                  />
                </View>

                <View
                  style={{
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    overflow: "hidden",
                  }}
                >
                  <BlurView intensity={80} tint={colors.blurTint}>
                    <LinearGradient
                      colors={isDark ? [
                        "rgba(48, 209, 88, 0.15)",
                        "rgba(48, 209, 88, 0.08)",
                        "rgba(0, 0, 0, 0.5)",
                      ] : [
                        "rgba(48, 209, 88, 0.12)",
                        "rgba(48, 209, 88, 0.06)",
                        "rgba(255, 255, 255, 0.95)",
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
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.15)",
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
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: "rgba(48, 209, 88, 0.2)",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <BarChart3 size={24} color="#30D158" strokeWidth={2.5} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 24,
                                fontWeight: "700",
                                color: colors.text,
                                marginBottom: 4,
                              }}
                            >
                              Create Poll
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: colors.textSecondary,
                              }}
                            >
                              Ask your group a question
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          onPress={handleClose}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: pressed
                              ? (isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)")
                              : (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"),
                            alignItems: "center",
                            justifyContent: "center",
                          })}
                        >
                          <Text style={{ fontSize: 20, color: colors.text }}>✕</Text>
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
                        {/* Poll Question */}
                        <LiquidGlassCard
                          variant="success"
                          title="Question"
                          style={{ marginBottom: 16 }}
                        >
                          <TextInput
                            value={question}
                            onChangeText={setQuestion}
                            placeholder="What would you like to ask?"
                            placeholderTextColor={colors.inputPlaceholder}
                            keyboardAppearance={isDark ? "dark" : "light"}
                            multiline
                            numberOfLines={2}
                            style={{
                              backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
                              borderRadius: 12,
                              padding: 14,
                              fontSize: 16,
                              color: colors.text,
                              fontWeight: "600",
                              minHeight: 60,
                              textAlignVertical: "top",
                            }}
                            maxLength={500}
                          />
                        </LiquidGlassCard>

                        {/* Poll Options */}
                        <LiquidGlassCard
                          variant="success"
                          title="Options"
                          subtitle="Add 2-4 choices for people to vote on"
                          style={{ marginBottom: 16 }}
                        >
                          <View style={{ gap: 10 }}>
                            {options.map((option, index) => (
                              <View
                                key={index}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: "rgba(48, 209, 88, 0.2)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      fontWeight: "700",
                                      color: "#30D158",
                                    }}
                                  >
                                    {index + 1}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <TextInput
                                    value={option}
                                    onChangeText={(value) =>
                                      updateOption(index, value)
                                    }
                                    placeholder={`Option ${index + 1}`}
                                    placeholderTextColor={colors.inputPlaceholder}
                                    keyboardAppearance={isDark ? "dark" : "light"}
                                    style={{
                                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
                                      borderRadius: 10,
                                      padding: 12,
                                      fontSize: 15,
                                      color: colors.text,
                                    }}
                                    maxLength={200}
                                  />
                                </View>
                                {options.length > 2 && (
                                  <Pressable
                                    onPress={() => removeOption(index)}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 16,
                                      backgroundColor: "rgba(255, 59, 48, 0.2)",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <X size={16} color="#FF3B30" strokeWidth={2.5} />
                                  </Pressable>
                                )}
                              </View>
                            ))}

                            {options.length < 4 && (
                              <Pressable
                                onPress={addOption}
                                style={{
                                  backgroundColor: "rgba(48, 209, 88, 0.15)",
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: "rgba(48, 209, 88, 0.3)",
                                  borderStyle: "dashed",
                                  padding: 12,
                                  alignItems: "center",
                                  marginTop: 4,
                                  flexDirection: "row",
                                  justifyContent: "center",
                                  gap: 8,
                                }}
                              >
                                <Plus size={18} color="#30D158" strokeWidth={2.5} />
                                <Text
                                  style={{
                                    fontSize: 14,
                                    color: "#30D158",
                                    fontWeight: "600",
                                  }}
                                >
                                  Add Option ({options.length}/4)
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </LiquidGlassCard>

                        {/* Info Note */}
                        <View
                          style={{
                            backgroundColor: "rgba(48, 209, 88, 0.1)",
                            borderRadius: 12,
                            padding: 14,
                            marginBottom: 16,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: colors.textSecondary,
                              lineHeight: 18,
                            }}
                          >
                            💡 Each person can vote once. Results will be shared automatically when everyone has voted.
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
                          borderTopColor: colors.glassBorder,
                        }}
                      >
                        <LiquidGlassButton
                          onPress={handleCreate}
                          variant="primary"
                          size="large"
                          disabled={!canCreate}
                          loading={isCreating}
                        >
                          Create Poll 📊
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

export default CreatePollModal;

