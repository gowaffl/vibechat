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
} from "react-native";
import { BlurView } from "expo-blur";
import { Camera, Image as ImageIcon, Sparkles, Wand2, Search, Globe } from "lucide-react-native";
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

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    };

    const onHide = (e: any) => {
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
    <View 
      style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} 
      pointerEvents={visible ? "auto" : "none"}
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
          maxHeight: SCREEN_HEIGHT * 0.85,
          transform: [{ 
            translateY: Animated.subtract(slideAnim, keyboardHeightAnim)
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
          <View
            style={{
              backgroundColor: "rgba(28, 28, 30, 0.95)",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
          >
            {/* Handle Bar */}
            <View
              style={{
                alignItems: "center",
                paddingTop: 12,
                paddingBottom: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 5,
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  borderRadius: 2.5,
                }}
              />
            </View>

            <ScrollView
              style={{
                maxHeight: SCREEN_HEIGHT * 0.75,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Photo Options */}
              <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
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
                      backgroundColor: pressed
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(255, 255, 255, 0.08)",
                      borderRadius: 20,
                      padding: 20,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.15)",
                    })}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "rgba(0, 122, 255, 0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Camera size={28} color="#007AFF" />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#FFFFFF",
                      }}
                    >
                      Camera
                    </Text>
                  </Pressable>

                  {/* Photo Library */}
                  <Pressable
                    onPress={() => handlePhotoAction(onPickImage)}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: pressed
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(255, 255, 255, 0.08)",
                      borderRadius: 20,
                      padding: 20,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.15)",
                    })}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "rgba(138, 43, 226, 0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <ImageIcon size={28} color="#8A2BE2" />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#FFFFFF",
                      }}
                    >
                      Photos
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* AI Tools Section */}
              <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "rgba(255, 255, 255, 0.6)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 12,
                  }}
                >
                  AI Tools
                </Text>
                {builtInCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Pressable
                      key={cmd.command}
                      onPress={() => handleCommandAction(() => onSelectCommand(cmd.command))}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: pressed
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(255, 255, 255, 0.05)",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      })}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: `${cmd.color}20`,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Icon size={22} color={cmd.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: "600",
                            color: "#FFFFFF",
                            marginBottom: 2,
                          }}
                        >
                          {cmd.command}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: "rgba(255, 255, 255, 0.7)",
                          }}
                        >
                          {cmd.description}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Commands Section */}
              {customCommands.length > 0 && (
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: "rgba(255, 255, 255, 0.6)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 12,
                    }}
                  >
                    Custom Commands
                  </Text>
                  {customCommands.map((cmd) => (
                    <Pressable
                      key={cmd.id}
                      onPress={() => handleCommandAction(() => onSelectCommand(cmd.command))}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: pressed
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(255, 255, 255, 0.05)",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      })}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: "rgba(52, 199, 89, 0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Sparkles size={22} color="#34C759" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: "600",
                            color: "#FFFFFF",
                            marginBottom: 2,
                          }}
                        >
                          {cmd.command}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={{
                            fontSize: 14,
                            color: "rgba(255, 255, 255, 0.7)",
                          }}
                        >
                          {cmd.prompt.length > 60
                            ? `${cmd.prompt.substring(0, 60)}...`
                            : cmd.prompt}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
};

export default AttachmentsMenu;

