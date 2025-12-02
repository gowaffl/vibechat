import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  PanResponder, // Added explicit import
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, Sparkles, Wand2, Plus, Zap, Video, BarChart3 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedKeyboard,
  interpolate,
  runOnJS, // Added explicit import
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { CustomSlashCommand } from "@/shared/contracts";

import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AttachmentsMenuProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => Promise<void>;
  onPickImage: () => Promise<void>;
  onPickVideo: () => Promise<void>;
  onSelectCommand: (command: string) => void;
  onCreateCommand: () => void;
  onCreatePoll: () => void;
  onOpenSettings: () => void;
  customCommands: CustomSlashCommand[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const AttachmentsMenu: React.FC<AttachmentsMenuProps> = ({
  visible,
  onClose,
  onTakePhoto,
  onPickImage,
  onPickVideo,
  onSelectCommand,
  onCreateCommand,
  onCreatePoll,
  onOpenSettings,
  customCommands,
}) => {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const isVisible = useSharedValue(0);
  const dragY = useSharedValue(0);
  
  // Track if we should actually render the content (to handle exit animation)
  // We keep rendering until animation is done
  const [shouldRender, setShouldRender] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      isVisible.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.quad),
      });
    } else {
      isVisible.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.quad),
      }, (finished) => {
        if (finished) {
          // We can't safely set state from UI thread callback in all RN versions,
          // but we can try or use runOnJS. 
          // However, a simpler way is to just let the parent unmount us if it does?
          // But parent doesn't unmount, it just sets visible=false.
          // So we need to setShouldRender(false) to hide the view to pass touches through.
          // We will use a JS timeout to match animation for safety if runOnJS is complex.
        }
      });
      
      // Safety timeout to cleanup
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
           return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragY.value = gestureState.dy;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 100 || gestureState.vy > 0.5) {
             Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
             onClose();
             dragY.value = withTiming(0, { duration: 200 }); 
          } else {
             dragY.value = withTiming(0);
          }
        }
      })
    ).current;


  // Animated Styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: isVisible.value,
  }));

  const sheetStyle = useAnimatedStyle(() => {
    // Calculate dynamic max height based on keyboard
    // If keyboard is open (height > 0), we want to sit on top of it.
    // TranslateY:
    // Hidden: SCREEN_HEIGHT
    // Visible: 0 (but 0 means "at the bottom", so we need to shift up by keyboard height if we are absolute bottom:0)
    
    // Actually, useAnimatedKeyboard gives precise height.
    // We want `bottom: 0` and `transform: translateY(-keyboard.height)`.
    // Plus slideIn offset.
    
    // If isVisible is 0, offset is SCREEN_HEIGHT.
    // If isVisible is 1, offset is 0.
    
    const slideOffset = interpolate(isVisible.value, [0, 1], [SCREEN_HEIGHT, 0]);
    
    return {
      transform: [
        { translateY: slideOffset - keyboard.height.value + dragY.value }
      ],
      // We can also adjust maxHeight dynamically to prevent going offscreen
      maxHeight: SCREEN_HEIGHT - keyboard.height.value - insets.top - 20,
    };
  });

  if (!visible && !shouldRender) return null;

  const handlePhotoAction = async (action: () => Promise<void>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await action();
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
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
          backdropStyle
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            // We don't set fixed height, we let it grow up to maxHeight
          },
          sheetStyle
        ]}
      >
        <BlurView
          intensity={100}
          tint="dark"
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: "hidden",
            paddingBottom: 34,
            // Ensure BlurView fills the animated view
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
            {/* Handle Bar */}
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
                // We need to constrain this scrollview so it scrolls if content is too big
                // But we want it to fit within the dynamic maxHeight set in sheetStyle
                // Flex: 1 might work if parent has height?
                // Animated.View has maxHeight.
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Media Options - Single Row */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => handlePhotoAction(onTakePhoto)}
                    style={({ pressed }) => ({
                      flex: 1,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <BlurView intensity={30} tint="dark" style={{ borderRadius: 16, overflow: "hidden" }}>
                      <LinearGradient
                        colors={["rgba(0, 122, 255, 0.15)", "rgba(0, 122, 255, 0.08)"]}
                        style={styles.compactButtonGradient}
                      >
                        <View style={[styles.compactIconContainer, { backgroundColor: "rgba(0, 122, 255, 0.2)", shadowColor: "#007AFF" }]}>
                          <Camera size={20} color="#007AFF" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.compactButtonText}>Camera</Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>

                  <Pressable
                    onPress={() => handlePhotoAction(onPickImage)}
                    style={({ pressed }) => ({
                      flex: 1,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <BlurView intensity={30} tint="dark" style={{ borderRadius: 16, overflow: "hidden" }}>
                      <LinearGradient
                        colors={["rgba(138, 43, 226, 0.15)", "rgba(138, 43, 226, 0.08)"]}
                        style={styles.compactButtonGradient}
                      >
                        <View style={[styles.compactIconContainer, { backgroundColor: "rgba(138, 43, 226, 0.2)", shadowColor: "#8A2BE2" }]}>
                          <ImageIcon size={20} color="#8A2BE2" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.compactButtonText}>Photos</Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>

                  <Pressable
                    onPress={() => handlePhotoAction(onPickVideo)}
                    style={({ pressed }) => ({
                      flex: 1,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <BlurView intensity={30} tint="dark" style={{ borderRadius: 16, overflow: "hidden" }}>
                      <LinearGradient
                        colors={["rgba(255, 69, 58, 0.15)", "rgba(255, 69, 58, 0.08)"]}
                        style={styles.compactButtonGradient}
                      >
                        <View style={[styles.compactIconContainer, { backgroundColor: "rgba(255, 69, 58, 0.2)", shadowColor: "#FF453A" }]}>
                          <Video size={20} color="#FF453A" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.compactButtonText}>Videos</Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>

                  <Pressable
                    onPress={() => handleCommandAction(onCreatePoll)}
                    style={({ pressed }) => ({
                      flex: 1,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <BlurView intensity={30} tint="dark" style={{ borderRadius: 16, overflow: "hidden" }}>
                      <LinearGradient
                        colors={["rgba(48, 209, 88, 0.15)", "rgba(48, 209, 88, 0.08)"]}
                        style={styles.compactButtonGradient}
                      >
                        <View style={[styles.compactIconContainer, { backgroundColor: "rgba(48, 209, 88, 0.2)", shadowColor: "#30D158" }]}>
                          <BarChart3 size={20} color="#30D158" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.compactButtonText}>Poll</Text>
                      </LinearGradient>
                    </BlurView>
                  </Pressable>
                </View>
              </View>

              {/* AI Tools */}
              <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
                <Text style={styles.sectionHeader}>AI Tools</Text>
                <View style={{ gap: 8 }}>
                  {builtInCommands.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <Pressable
                        key={cmd.command}
                        onPress={() => handleCommandAction(() => onSelectCommand(cmd.command))}
                        style={({ pressed }) => ({
                          borderRadius: 18,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <BlurView intensity={25} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                          <LinearGradient
                            colors={[`${cmd.color}15`, `${cmd.color}08`]}
                            style={[styles.commandGradient, { borderColor: `${cmd.color}30` }]}
                          >
                            <View style={[styles.commandIcon, { backgroundColor: `${cmd.color}25`, shadowColor: cmd.color }]}>
                              <Icon size={20} color={cmd.color} strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.commandTitle}>{cmd.command}</Text>
                              <Text style={styles.commandDesc}>{cmd.description}</Text>
                            </View>
                          </LinearGradient>
                        </BlurView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Custom Commands */}
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginLeft: 4 }}>
                  <Text style={styles.sectionHeader}>Custom Commands</Text>
                  {customCommands.length > 0 && (
                    <Text style={styles.counter}>{customCommands.length}</Text>
                  )}
                </View>

                {customCommands.length > 0 && (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {customCommands.map((cmd) => (
                      <Pressable
                        key={cmd.id}
                        onPress={() => handleCommandAction(() => onSelectCommand(cmd.command))}
                        style={({ pressed }) => ({
                          borderRadius: 18,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <BlurView intensity={25} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                          <LinearGradient
                            colors={["rgba(255, 159, 10, 0.15)", "rgba(255, 159, 10, 0.08)"]}
                            style={[styles.commandGradient, { borderColor: "rgba(255, 159, 10, 0.3)" }]}
                          >
                            <View style={[styles.commandIcon, { backgroundColor: "rgba(255, 159, 10, 0.25)", shadowColor: "#FF9F0A" }]}>
                              <Zap size={20} color="#FF9F0A" strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.commandTitle}>{cmd.command}</Text>
                              <Text style={styles.commandDesc} numberOfLines={1}>{cmd.prompt}</Text>
                            </View>
                          </LinearGradient>
                        </BlurView>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Pressable
                  onPress={() => handleCommandAction(onCreateCommand)}
                  style={({ pressed }) => ({
                    borderRadius: 18,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <BlurView intensity={30} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                    <LinearGradient
                      colors={["rgba(255, 159, 10, 0.12)", "rgba(255, 159, 10, 0.06)"]}
                      style={[styles.commandGradient, { borderColor: "rgba(255, 159, 10, 0.3)", borderStyle: "dashed" }]}
                    >
                      <View style={[styles.commandIcon, { backgroundColor: "rgba(255, 159, 10, 0.2)", width: 32, height: 32, borderRadius: 16, marginRight: 10 }]}>
                        <Plus size={18} color="#FF9F0A" strokeWidth={3} />
                      </View>
                      <Text style={styles.buttonText}>Create Custom Command</Text>
                    </LinearGradient>
                  </BlurView>
                </Pressable>
              </View>
            </ScrollView>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonGradient: {
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)", // Overridden inline
    borderRadius: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  counter: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.3)",
  },
  commandGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 18,
  },
  commandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  commandTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  commandDesc: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    lineHeight: 16,
  },
  compactButtonGradient: {
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 16,
  },
  compactIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  compactButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
});

export default AttachmentsMenu;