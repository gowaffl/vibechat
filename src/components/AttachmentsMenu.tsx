import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
  Keyboard,
  Platform,
  PanResponder,
  Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, Sparkles, Wand2, Plus, Zap } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { CustomSlashCommand } from "@/shared/contracts";

interface AttachmentsMenuProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => Promise<void>;
  onPickImage: () => Promise<void>;
  onSelectCommand: (command: string) => void;
  onCreateCommand: () => void;
  onOpenSettings: () => void;
  customCommands: CustomSlashCommand[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const AttachmentsMenu: React.FC<AttachmentsMenuProps> = ({
  visible,
  onClose,
  onTakePhoto,
  onPickImage,
  onSelectCommand,
  onCreateCommand,
  onOpenSettings,
  customCommands,
}) => {
  // Removed shouldRender optimization to allow keyboard tracking while hidden
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // PanResponder for swipe-down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging down (positive dy)
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 100px or with enough velocity, close
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onClose();
          // Reset drag position
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          // Spring back to original position
          Animated.spring(dragY, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset drag position if gesture is interrupted
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      setIsKeyboardVisible(true);
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    };

    const onHide = (e: any) => {
      setIsKeyboardVisible(false);
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    };

    const sub1 = Keyboard.addListener(showEvent, onShow);
    const sub2 = Keyboard.addListener(hideEvent, onHide);
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    } else {
      // Reset drag position when closing
      dragY.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handlePhotoAction = async (action: () => Promise<void>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Execute the action first, which will open the native picker
    await action();
    // Only close the menu after the user has finished with the picker
    onClose();
  };

  const handleCommandAction = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    action();
  };

  const builtInCommands = [
    {
      command: "/image",
      icon: Wand2,
      description: "Generate custom images using AI",
      color: "#FF6B6B",
    },
    {
      command: "/meme",
      icon: Sparkles,
      description: "Create funny meme images with text",
      color: "#FFD93D",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          opacity: opacityAnim,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: isKeyboardVisible ? SCREEN_HEIGHT * 0.5 : SCREEN_HEIGHT * 0.9,
          transform: [{ 
            translateY: Animated.add(
              Animated.subtract(slideAnim, keyboardHeightAnim),
              dragY
            )
          }],
        }}
      >
        <BlurView
          intensity={100}
          tint="dark"
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: "hidden",
            paddingBottom: 34,
          }}
        >
          <LinearGradient
            colors={[
              "rgba(28, 28, 30, 0.98)",
              "rgba(18, 18, 20, 0.98)",
            ]}
            style={{
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
          >
            {/* Handle Bar - with pan responder for swipe down */}
            <View
              {...panResponder.panHandlers}
              style={{
                alignItems: "center",
                paddingTop: 14,
                paddingBottom: 20,
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

            <ScrollView
              style={{
                maxHeight: isKeyboardVisible ? SCREEN_HEIGHT * 0.4 : SCREEN_HEIGHT * 0.8,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Photo Options */}
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {/* Camera */}
                  <Pressable
                    onPress={() => handlePhotoAction(onTakePhoto)}
                    style={({ pressed }) => ({
                      flex: 1,
                      overflow: "hidden",
                      borderRadius: 20,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <BlurView intensity={30} tint="dark" style={{ borderRadius: 20, overflow: "hidden" }}>
                      <LinearGradient
                        colors={[
                          "rgba(0, 122, 255, 0.15)",
                          "rgba(0, 122, 255, 0.08)",
                        ]}
                        style={{
                          padding: 16,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: "rgba(0, 122, 255, 0.25)",
                          borderRadius: 20,
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: "rgba(0, 122, 255, 0.2)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 10,
                            shadowColor: "#007AFF",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 6,
                          }}
                        >
                          <Camera size={24} color="#007AFF" strokeWidth={2.5} />
                        </View>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: "#FFFFFF",
                            letterSpacing: -0.2,
                          }}
                        >
                          Camera
                        </Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>

                  {/* Photo Library */}
                  <Pressable
                    onPress={() => handlePhotoAction(onPickImage)}
                    style={({ pressed }) => ({
                      flex: 1,
                      overflow: "hidden",
                      borderRadius: 20,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <BlurView intensity={30} tint="dark" style={{ borderRadius: 20, overflow: "hidden" }}>
                      <LinearGradient
                        colors={[
                          "rgba(138, 43, 226, 0.15)",
                          "rgba(138, 43, 226, 0.08)",
                        ]}
                        style={{
                          padding: 16,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: "rgba(138, 43, 226, 0.25)",
                          borderRadius: 20,
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: "rgba(138, 43, 226, 0.2)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 10,
                            shadowColor: "#8A2BE2",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 6,
                          }}
                        >
                          <ImageIcon size={24} color="#8A2BE2" strokeWidth={2.5} />
                        </View>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: "#FFFFFF",
                            letterSpacing: -0.2,
                          }}
                        >
                          Photos
                        </Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>
                </View>
              </View>

              {/* AI Tools Section */}
              <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "rgba(255, 255, 255, 0.4)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 12,
                    marginLeft: 4,
                  }}
                >
                  AI Tools
                </Text>
                <View style={{ gap: 8 }}>
                  {builtInCommands.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <Pressable
                        key={cmd.command}
                        onPress={() => handleCommandAction(() => onSelectCommand(cmd.command))}
                        style={({ pressed }) => ({
                          overflow: "hidden",
                          borderRadius: 18,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <BlurView intensity={25} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                          <LinearGradient
                            colors={[
                              `${cmd.color}15`,
                              `${cmd.color}08`,
                            ]}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              padding: 12,
                              borderWidth: 1,
                              borderColor: `${cmd.color}30`,
                              borderRadius: 18,
                            }}
                          >
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: `${cmd.color}25`,
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                                shadowColor: cmd.color,
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                              }}
                            >
                              <Icon size={20} color={cmd.color} strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "600",
                                  color: "#FFFFFF",
                                  marginBottom: 2,
                                  letterSpacing: -0.2,
                                }}
                              >
                                {cmd.command}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "rgba(255, 255, 255, 0.6)",
                                  lineHeight: 16,
                                }}
                              >
                                {cmd.description}
                              </Text>
                            </View>
                          </LinearGradient>
                        </BlurView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Custom Commands Section */}
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginLeft: 4 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "rgba(255, 255, 255, 0.4)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Custom Commands
                  </Text>
                  {customCommands.length > 0 && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "rgba(255, 255, 255, 0.3)",
                      }}
                    >
                      {customCommands.length}
                    </Text>
                  )}
                </View>

                {customCommands.length > 0 ? (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {customCommands.map((cmd) => (
                      <Pressable
                        key={cmd.id}
                        onPress={() => handleCommandAction(() => onSelectCommand(cmd.command))}
                        style={({ pressed }) => ({
                          overflow: "hidden",
                          borderRadius: 18,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <BlurView intensity={25} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                          <LinearGradient
                            colors={[
                              "rgba(255, 159, 10, 0.15)", // Orange #FF9F0A
                              "rgba(255, 159, 10, 0.08)",
                            ]}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              padding: 12,
                              borderWidth: 1,
                              borderColor: "rgba(255, 159, 10, 0.3)",
                              borderRadius: 18,
                            }}
                          >
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: "rgba(255, 159, 10, 0.25)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                                shadowColor: "#FF9F0A",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                              }}
                            >
                              <Zap size={20} color="#FF9F0A" strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "600",
                                  color: "#FFFFFF",
                                  marginBottom: 2,
                                  letterSpacing: -0.2,
                                }}
                              >
                                {cmd.command}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 13,
                                  color: "rgba(255, 255, 255, 0.6)",
                                  lineHeight: 16,
                                }}
                              >
                                {cmd.prompt}
                              </Text>
                            </View>
                          </LinearGradient>
                        </BlurView>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* Create New Command Button */}
                <Pressable
                  onPress={() => handleCommandAction(onCreateCommand)}
                  style={({ pressed }) => ({
                    overflow: "hidden",
                    borderRadius: 18,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <BlurView intensity={30} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                    <LinearGradient
                      colors={[
                        "rgba(255, 159, 10, 0.12)", // Orange
                        "rgba(255, 159, 10, 0.06)",
                      ]}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 14,
                        borderWidth: 1,
                        borderColor: "rgba(255, 159, 10, 0.3)",
                        borderRadius: 18,
                        borderStyle: "dashed",
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: "rgba(255, 159, 10, 0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}
                      >
                        <Plus size={18} color="#FF9F0A" strokeWidth={3} />
                      </View>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: "#FFFFFF",
                          letterSpacing: -0.2,
                        }}
                      >
                        Create Custom Command
                      </Text>
                    </LinearGradient>
                  </BlurView>
                </Pressable>
              </View>
            </ScrollView>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

export default AttachmentsMenu;

