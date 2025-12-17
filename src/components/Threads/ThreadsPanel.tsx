import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageSquare, Users, Check, X, Sparkles, Lightbulb, Hash } from "lucide-react-native";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";
import { useTheme } from "@/contexts/ThemeContext";
import type { Thread } from "@shared/contracts";

interface ThreadsPanelProps {
  visible: boolean;
  onClose: () => void;
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string | null) => void; // null = main thread
  onCreateThread: () => void;
  onEditThread?: (thread: Thread) => void;
  onDeleteThread?: (threadId: string) => void;
  isLoading?: boolean;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const ThreadsPanel: React.FC<ThreadsPanelProps> = ({
  visible,
  onClose,
  threads,
  currentThreadId,
  onSelectThread,
  onCreateThread,
  onEditThread,
  onDeleteThread,
  isLoading = false,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(new Animated.Value(-SCREEN_WIDTH));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [buttonScale] = useState(new Animated.Value(1));
  const [buttonRotate] = useState(new Animated.Value(0));

  React.useEffect(() => {
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
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH,
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

  const handleSelectThread = (threadId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectThread(threadId);
    handleClose();
  };

  const handleCreateThread = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Premium button animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(buttonScale, {
          toValue: 0.85,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(buttonRotate, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(buttonScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }),
        Animated.timing(buttonRotate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    
    // Delay modal opening slightly for smooth animation
    setTimeout(() => {
      onCreateThread();
    }, 100);
  };

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
        <BlurView intensity={40} tint={colors.blurTint} style={{ flex: 1 }}>
          {/* Backdrop - dismisses on tap */}
          <Pressable
            style={{ flex: 1 }}
            onPress={handleClose}
          >
            <View style={{ flex: 1 }} />
          </Pressable>

          {/* Panel Content */}
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: SCREEN_WIDTH * 0.85,
              transform: [{ translateX: slideAnim }],
            }}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <View
                style={{
                  flex: 1,
                  borderTopRightRadius: 32,
                  borderBottomRightRadius: 32,
                  overflow: "hidden",
                }}
              >
                <BlurView intensity={80} tint={colors.blurTint} style={{ flex: 1 }}>
                  <LinearGradient
                    colors={isDark ? [
                      "rgba(20, 184, 166, 0.15)",
                      "rgba(13, 148, 136, 0.08)",
                      "rgba(0, 0, 0, 0.5)",
                    ] : [
                      "rgba(20, 184, 166, 0.08)",
                      "rgba(13, 148, 136, 0.04)",
                      "rgba(255, 255, 255, 0.5)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ flex: 1, paddingTop: 20 }}
                  >
                    {/* Header */}
                    <View
                      style={{
                        paddingHorizontal: 24,
                        marginBottom: 20,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Image
                            source={require("../../../assets/smarth threads icon (1).png")}
                            style={{ width: 48, height: 48, marginRight: 8, tintColor: colors.text }}
                            resizeMode="contain"
                          />
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: "700",
                              color: colors.text,
                            }}
                          >
                            Smart Threads
                          </Text>
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
                          <X size={20} color={colors.text} />
                        </Pressable>
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textSecondary,
                        }}
                      >
                        Filter messages by topics, people, or themes
                      </Text>
                    </View>

                    {/* Main Thread */}
                    <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                      <Pressable
                        onPress={() => handleSelectThread(null)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <View
                          style={{
                            borderRadius: 16,
                            overflow: "hidden",
                            borderWidth: 2,
                            borderColor:
                              currentThreadId === null
                                ? colors.primary
                                : isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          <BlurView intensity={50} tint={colors.blurTint}>
                            <LinearGradient
                              colors={
                                currentThreadId === null
                                  ? isDark 
                                    ? ["rgba(20, 184, 166, 0.3)", "rgba(13, 148, 136, 0.2)"]
                                    : ["rgba(20, 184, 166, 0.15)", "rgba(13, 148, 136, 0.1)"]
                                  : isDark
                                    ? ["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.04)"]
                                    : ["rgba(255, 255, 255, 0.6)", "rgba(255, 255, 255, 0.4)"]
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{ padding: 16 }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                <MessageSquare size={28} color={colors.text} />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      fontSize: 16,
                                      fontWeight: "700",
                                      color: colors.text,
                                      marginBottom: 2,
                                    }}
                                  >
                                    Main Chat
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.textSecondary,
                                    }}
                                  >
                                    All messages
                                  </Text>
                                </View>
                                {currentThreadId === null && (
                                  <Check size={20} color={colors.primary} />
                                )}
                              </View>
                            </LinearGradient>
                          </BlurView>
                        </View>
                      </Pressable>
                    </View>

                    {/* Custom Threads */}
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{
                        paddingHorizontal: 24,
                        paddingBottom: 24,
                      }}
                      showsVerticalScrollIndicator={false}
                    >
                      {threads.length > 0 ? (
                        <>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: colors.textSecondary,
                              marginBottom: 12,
                              textTransform: "uppercase",
                            }}
                          >
                            Custom Threads
                          </Text>
                          {threads.map((thread) => {
                            const isSelected = thread.id === currentThreadId;

                            return (
                              <Pressable
                                key={thread.id}
                                onPress={() => handleSelectThread(thread.id)}
                                onLongPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                  Alert.alert(
                                    thread.name,
                                    "What would you like to do?",
                                    [
                                      {
                                        text: "Edit Thread",
                                        onPress: () => {
                                          if (onEditThread) {
                                            onEditThread(thread);
                                          }
                                        },
                                      },
                                      {
                                        text: "Delete Thread",
                                        style: "destructive",
                                        onPress: () => {
                                          Alert.alert(
                                            "Delete Thread",
                                            `Are you sure you want to delete "${thread.name}"? This cannot be undone.`,
                                            [
                                              {
                                                text: "Cancel",
                                                style: "cancel",
                                              },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: () => {
                                                  if (onDeleteThread) {
                                                    onDeleteThread(thread.id);
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        },
                                      },
                                      {
                                        text: "Cancel",
                                        style: "cancel",
                                      },
                                    ]
                                  );
                                }}
                                style={({ pressed }) => ({
                                  marginBottom: 12,
                                  opacity: pressed ? 0.8 : 1,
                                })}
                              >
                                <LiquidGlassCard
                                  variant={isSelected ? "thread" : "default"}
                                  style={{
                                    borderWidth: isSelected ? 2 : 1,
                                    borderColor: isSelected
                                      ? colors.primary
                                      : isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.05)",
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 12,
                                    }}
                                  >
                                    {thread.icon ? (
                                      <Text style={{ fontSize: 24 }}>{thread.icon}</Text>
                                    ) : (
                                      <Hash size={24} color={colors.text} />
                                    )}
                                    <View style={{ flex: 1 }}>
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 15,
                                            fontWeight: "700",
                                            color: colors.text,
                                          }}
                                        >
                                          {thread.name}
                                        </Text>
                                        {thread.isShared && (
                                          <Users size={14} color={colors.textSecondary} />
                                        )}
                                      </View>
                                      {/* Filter summary */}
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          color: colors.textSecondary,
                                          marginTop: 2,
                                        }}
                                        numberOfLines={1}
                                      >
                                        {thread.filterRules.topics?.length
                                          ? `Topics: ${thread.filterRules.topics.join(", ")}`
                                          : thread.filterRules.keywords?.length
                                          ? `Keywords: ${thread.filterRules.keywords.join(", ")}`
                                          : "Custom filter"}
                                      </Text>
                                    </View>
                                    {isSelected && (
                                      <Check size={18} color={colors.primary} />
                                    )}
                                  </View>
                                </LiquidGlassCard>
                              </Pressable>
                            );
                          })}
                        </>
                      ) : (
                        <View style={{ alignItems: "center", paddingVertical: 32 }}>
                          <Image
                            source={require("../../../assets/smarth threads icon (1).png")}
                            style={{ width: 48, height: 48, marginBottom: 12, tintColor: colors.textSecondary }}
                            resizeMode="contain"
                          />
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "600",
                              color: colors.text,
                              marginBottom: 6,
                            }}
                          >
                            No Custom Threads Yet
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              color: colors.textSecondary,
                              textAlign: "center",
                            }}
                          >
                            Create a thread to filter messages by topics or themes
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </LinearGradient>
                </BlurView>
              </View>

              {/* Floating Plus Button - positioned outside overflow container */}
              <View
                style={{
                  position: "absolute",
                  bottom: insets.bottom + 60,
                  right: 0,
                  left: 0,
                  alignItems: "flex-end",
                  paddingRight: 40,
                  pointerEvents: "box-none",
                }}
              >
                <Animated.View
                  style={{
                    transform: [
                      { scale: buttonScale },
                      {
                        rotate: buttonRotate.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "90deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <Pressable
                    onPress={handleCreateThread}
                    style={({ pressed }) => ({
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      overflow: "hidden",
                      shadowColor: "#14B8A6",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: pressed ? 0.5 : 0.35,
                      shadowRadius: 20,
                      elevation: 12,
                      borderWidth: 2.5,
                      borderColor: "rgba(255, 255, 255, 0.9)",
                    })}
                  >
                    <BlurView intensity={80} tint={colors.blurTint} style={{ width: 80, height: 80, borderRadius: 40, overflow: "hidden" }}>
                      <LinearGradient
                        colors={[
                          "#0061FF",
                          "#00C6FF",
                          "#00E676",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ 
                          fontSize: 44, 
                          color: "#FFFFFF", 
                          fontWeight: "200", 
                          lineHeight: 44,
                          textAlign: "center",
                        }}>+</Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>
                </Animated.View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

export default ThreadsPanel;

