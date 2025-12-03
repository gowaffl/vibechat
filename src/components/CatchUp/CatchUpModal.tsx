import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import type { ConversationSummary } from "@shared/contracts";

interface CatchUpModalProps {
  visible: boolean;
  onClose: () => void;
  summary: ConversationSummary | null;
  onViewMessage?: (messageId: string) => void;
  isLoading?: boolean;
  onGenerateSummary?: (type: "quick" | "detailed" | "personalized") => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CatchUpModal: React.FC<CatchUpModalProps> = ({
  visible,
  onClose,
  summary,
  onViewMessage,
  isLoading = false,
  onGenerateSummary,
}) => {
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [rotateAnim] = useState(new Animated.Value(0));
  const dragY = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(visible);

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

  // Loading animation effects
  useEffect(() => {
    if (isLoading) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotation animation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isLoading, pulseAnim, rotateAnim]);

  const handleClose = () => {
    // Removed haptic on close
    onClose();
  };

  // PanResponder for swipe-down gesture
  // We use a ref to hold the latest onClose callback to avoid stale closures in PanResponder
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Light feedback on dismiss
          Haptics.selectionAsync();
          // Use the ref to ensure we call the latest callback
          if (onCloseRef.current) {
            onCloseRef.current();
          }
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

  const getSentimentEmoji = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "😊";
      case "negative":
        return "😔";
      case "mixed":
        return "🤔";
      default:
        return "💭";
    }
  };

  const getSummaryTypeLabel = (type: string) => {
    switch (type) {
      case "quick":
        return "Quick Catch-Up";
      case "detailed":
        return "Detailed Summary";
      case "personalized":
        return "Your Personalized Catch-Up";
      default:
        return "Catch-Up";
    }
  };

  const content = summary?.content as {
    summary: string;
    keyPoints?: string[];
    highlights?: Array<{ messageId: string; preview: string; reason: string; author: string }>;
    sentiment?: string;
  } | undefined;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

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
          {/* Backdrop - dismisses modal on tap */}
          <Pressable
            style={{ flex: 1 }}
            onPress={handleClose}
          >
            <View style={{ flex: 1 }} />
          </Pressable>

          {/* Modal Content */}
          <Animated.View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: SCREEN_HEIGHT * 0.9,
              transform: [
                { translateY: slideAnim },
                { translateY: dragY }
              ],
            }}
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
                    backgroundColor: "rgba(255, 255, 255, 0.25)",
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
                <BlurView intensity={80} tint="dark">
                  <LinearGradient
                    colors={[
                      "rgba(255, 144, 82, 0.15)",
                      "rgba(255, 107, 43, 0.08)",
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
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <Text style={{ fontSize: 32, marginRight: 8 }}>⚡</Text>
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: "700",
                              color: "#FFFFFF",
                            }}
                          >
                            {getSummaryTypeLabel(summary?.summaryType || "quick")}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "rgba(255, 255, 255, 0.6)",
                          }}
                        >
                          {getSentimentEmoji(content?.sentiment)} Here&apos;s what you
                          missed
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

                    {/* Scrollable Content */}
                    <ScrollView
                      style={{
                        maxHeight: SCREEN_HEIGHT * 0.65,
                      }}
                      contentContainerStyle={{
                        paddingHorizontal: 24,
                        paddingBottom: 32,
                      }}
                      showsVerticalScrollIndicator={false}
                    >
                      {isLoading ? (
                        // Loading State
                        <View style={{ alignItems: "center", paddingVertical: 60 }}>
                          <LuxeLogoLoader size={80} style={{ marginBottom: 24 }} />
                          
                          <Text
                            style={{
                              fontSize: 20,
                              fontWeight: "700",
                              color: "#FFFFFF",
                              marginBottom: 8,
                            }}
                          >
                            Generating Summary
                          </Text>
                          <Text
                            style={{
                              fontSize: 15,
                              color: "rgba(255, 255, 255, 0.7)",
                              textAlign: "center",
                              lineHeight: 22,
                            }}
                          >
                            AI is analyzing your messages...
                          </Text>
                          
                          <View style={{ marginTop: 32, width: "100%" }}>
                            <LiquidGlassCard variant="catchup" style={{ opacity: 0.5 }}>
                              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                                <View style={{ width: "60%", height: 12, backgroundColor: "rgba(255, 144, 82, 0.3)", borderRadius: 6 }} />
                                <View style={{ width: "30%", height: 12, backgroundColor: "rgba(255, 144, 82, 0.2)", borderRadius: 6 }} />
                              </View>
                              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                                <View style={{ width: "45%", height: 12, backgroundColor: "rgba(255, 144, 82, 0.3)", borderRadius: 6 }} />
                                <View style={{ width: "40%", height: 12, backgroundColor: "rgba(255, 144, 82, 0.2)", borderRadius: 6 }} />
                              </View>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <View style={{ width: "50%", height: 12, backgroundColor: "rgba(255, 144, 82, 0.3)", borderRadius: 6 }} />
                              </View>
                            </LiquidGlassCard>
                          </View>
                        </View>
                      ) : !content && onGenerateSummary ? (
                        // Selection Screen - Choose Summary Type
                        <View style={{ paddingVertical: 20 }}>
                          <Text
                            style={{
                              fontSize: 17,
                              fontWeight: "600",
                              color: "rgba(255, 255, 255, 0.9)",
                              textAlign: "center",
                              marginBottom: 24,
                              lineHeight: 24,
                            }}
                          >
                            Choose your summary style:
                          </Text>

                          {/* Quick Summary Option */}
                          <Pressable
                            onPress={() => {
                              Haptics.selectionAsync();
                              onGenerateSummary("quick");
                            }}
                            style={({ pressed }) => ({
                              marginBottom: 16,
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <LiquidGlassCard variant="catchup">
                              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                                <Text style={{ fontSize: 28, marginRight: 12 }}>⚡</Text>
                                <Text
                                  style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: "#FFFFFF",
                                  }}
                                >
                                  Quick Summary
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: "rgba(255, 255, 255, 0.75)",
                                  lineHeight: 20,
                                }}
                              >
                                15-20 second read • 2-3 bullet points{"\n"}
                                Main topics and critical actions only
                              </Text>
                            </LiquidGlassCard>
                          </Pressable>

                          {/* Personalized Summary Option */}
                          <Pressable
                            onPress={() => {
                              Haptics.selectionAsync();
                              onGenerateSummary("personalized");
                            }}
                            style={({ pressed }) => ({
                              marginBottom: 16,
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <LiquidGlassCard variant="catchup">
                              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                                <Text style={{ fontSize: 28, marginRight: 12 }}>👤</Text>
                                <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                  <Text
                                    style={{
                                      fontSize: 18,
                                      fontWeight: "700",
                                      color: "#FFFFFF",
                                    }}
                                  >
                                    Personalized
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: "#FFB380",
                                      paddingHorizontal: 8,
                                      paddingVertical: 3,
                                      borderRadius: 8,
                                      marginLeft: 10,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: "700",
                                        color: "#1C1C1E",
                                      }}
                                    >
                                      RECOMMENDED
                                    </Text>
                                  </View>
                                </View>
                              </View>
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: "rgba(255, 255, 255, 0.75)",
                                  lineHeight: 20,
                                }}
                              >
                                20-25 second read • 3-4 bullet points{"\n"}
                                Focused on mentions, questions, and actions for you
                              </Text>
                            </LiquidGlassCard>
                          </Pressable>

                          {/* Detailed Summary Option */}
                          <Pressable
                            onPress={() => {
                              Haptics.selectionAsync();
                              onGenerateSummary("detailed");
                            }}
                            style={({ pressed }) => ({
                              marginBottom: 16,
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <LiquidGlassCard variant="catchup">
                              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                                <Text style={{ fontSize: 28, marginRight: 12 }}>📋</Text>
                                <Text
                                  style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: "#FFFFFF",
                                  }}
                                >
                                  Detailed Summary
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: "rgba(255, 255, 255, 0.75)",
                                  lineHeight: 20,
                                }}
                              >
                                25-30 second read • 4-5 bullet points{"\n"}
                                Comprehensive overview with key decisions and actions
                              </Text>
                            </LiquidGlassCard>
                          </Pressable>
                        </View>
                      ) : content ? (
                        <>
                          {/* Main Summary */}
                          <LiquidGlassCard
                            variant="catchup"
                            style={{ marginBottom: 16 }}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                lineHeight: 22,
                                color: "rgba(255, 255, 255, 0.95)",
                                fontWeight: "500",
                              }}
                            >
                              {content.summary}
                            </Text>
                          </LiquidGlassCard>

                          {/* Key Points */}
                          {content.keyPoints && content.keyPoints.length > 0 && (
                            <LiquidGlassCard
                              title="Key Points"
                              icon={<Text style={{ fontSize: 20 }}>📌</Text>}
                              variant="catchup"
                              style={{ marginBottom: 16 }}
                            >
                              {content.keyPoints.map((point, index) => (
                                <View
                                  key={index}
                                  style={{
                                    flexDirection: "row",
                                    marginBottom: index === content.keyPoints!.length - 1 ? 0 : 10,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 15,
                                      color: "#FFB380",
                                      marginRight: 8,
                                      marginTop: 1,
                                    }}
                                  >
                                    •
                                  </Text>
                                  <Text
                                    style={{
                                      flex: 1,
                                      fontSize: 14,
                                      lineHeight: 20,
                                      color: "rgba(255, 255, 255, 0.9)",
                                    }}
                                  >
                                    {point}
                                  </Text>
                                </View>
                              ))}
                            </LiquidGlassCard>
                          )}

                          {/* Highlights */}
                          {content.highlights && content.highlights.length > 0 && (
                            <LiquidGlassCard
                              title="Popular Messages"
                              icon={<Text style={{ fontSize: 20 }}>⭐</Text>}
                              variant="catchup"
                            >
                              {content.highlights.map((highlight, index) => (
                                <Pressable
                                  key={index}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    onViewMessage?.(highlight.messageId);
                                    handleClose();
                                  }}
                                  style={({ pressed }) => ({
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    borderRadius: 10,
                                    backgroundColor: pressed
                                      ? "rgba(255, 144, 82, 0.15)"
                                      : "rgba(255, 144, 82, 0.08)",
                                    marginBottom:
                                      index === content.highlights!.length - 1 ? 0 : 8,
                                  })}
                                >
                                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: "rgba(255, 255, 255, 0.8)",
                                        flex: 1,
                                      }}
                                    >
                                      {highlight.author}
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        color: "#FFB380",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {highlight.reason}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      lineHeight: 19,
                                      color: "rgba(255, 255, 255, 0.9)",
                                      marginBottom: 6,
                                    }}
                                    numberOfLines={2}
                                  >
                                    {highlight.preview}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      color: "#FFB380",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Tap to view →
                                  </Text>
                                </Pressable>
                              ))}
                            </LiquidGlassCard>
                          )}

                          {/* Action Button */}
                          <View style={{ marginTop: 24 }}>
                            <LiquidGlassButton
                              onPress={handleClose}
                              variant="primary"
                              size="large"
                            >
                              Got it! 👍
                            </LiquidGlassButton>
                          </View>
                        </>
                      ) : null}
                    </ScrollView>
                  </LinearGradient>
                </BlurView>
              </View>
            </SafeAreaView>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

export default CatchUpModal;

