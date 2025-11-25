import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { X, Sparkles, Image as ImageIcon, Smile, Plus, Settings, Zap, Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { CustomSlashCommand } from "@/shared/contracts";

interface AIToolsMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectCommand: (command: string) => void;
  onCreateCommand: () => void;
  onOpenSettings: () => void;
  customCommands: CustomSlashCommand[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const AIToolsMenu: React.FC<AIToolsMenuProps> = ({
  visible,
  onClose,
  onSelectCommand,
  onCreateCommand,
  onOpenSettings,
  customCommands,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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

  const builtInCommands = [
    {
      command: "/image",
      icon: ImageIcon,
      description: "Generate custom images using AI",
      color: "#FF6B6B",
    },
    {
      command: "/meme",
      icon: Smile,
      description: "Create funny meme images with text",
      color: "#FFD93D",
    },
  ];

  const handleSelectCommand = (command: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectCommand(command);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
          transform: [{ translateY: slideAnim }],
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
                paddingBottom: 8,
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

            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(0, 122, 255, 0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={20} color="#007AFF" />
                </View>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  AI Tools
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView
              style={{
                maxHeight: SCREEN_HEIGHT * 0.65,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Built-in Commands Section */}
              <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
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
                  Built-in Commands
                </Text>
                {builtInCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Pressable
                      key={cmd.command}
                      onPress={() => handleSelectCommand(cmd.command)}
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
                      <Zap size={18} color="rgba(255, 255, 255, 0.4)" />
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Commands Section */}
              {customCommands.length > 0 && (
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
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
                      onPress={() => handleSelectCommand(cmd.command)}
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
                      <Zap size={18} color="rgba(255, 255, 255, 0.4)" />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
                {/* Create Command Button */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onCreateCommand();
                    onClose();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed
                      ? "rgba(0, 122, 255, 0.85)"
                      : "rgba(0, 122, 255, 1)",
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 12,
                  })}
                >
                  <Plus size={20} color="#FFFFFF" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginLeft: 8,
                    }}
                  >
                    Create Custom Command
                  </Text>
                </Pressable>

                {/* AI Settings Button */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenSettings();
                    onClose();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(255, 255, 255, 0.08)",
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                  })}
                >
                  <Settings size={20} color="#FFFFFF" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginLeft: 8,
                    }}
                  >
                    AI Settings
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

export default AIToolsMenu;

