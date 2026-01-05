import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  PanResponder,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, Sparkles, Wand2, Globe, Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedKeyboard,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PersonalAttachmentsMenuProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => Promise<void>;
  onPickImage: () => Promise<void>;
  onGenerateImage: () => void;
  onWebSearch: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PersonalAttachmentsMenu: React.FC<PersonalAttachmentsMenuProps> = ({
  visible,
  onClose,
  onTakePhoto,
  onPickImage,
  onGenerateImage,
  onWebSearch,
}) => {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const isVisible = useSharedValue(0);
  const dragY = useSharedValue(0);
  const { colors, isDark } = useTheme();
  
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
      });
      
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

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: isVisible.value,
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const slideOffset = interpolate(isVisible.value, [0, 1], [SCREEN_HEIGHT, 0]);
    const maxMenuHeight = SCREEN_HEIGHT * 0.45;
    const availableHeight = SCREEN_HEIGHT - keyboard.height.value - insets.top - 20;
    
    return {
      transform: [
        { translateY: slideOffset - keyboard.height.value + dragY.value }
      ],
      maxHeight: Math.min(maxMenuHeight, availableHeight),
    };
  });

  if (!visible && !shouldRender) return null;

  const handlePhotoAction = async (action: () => Promise<void>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await action();
    onClose();
  };

  const handleAction = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    action();
  };

  const mediaOptions = [
    {
      icon: Camera,
      label: "Camera",
      onPress: () => handlePhotoAction(onTakePhoto),
      colors: ["rgba(0, 122, 255, 0.15)", "rgba(0, 122, 255, 0.08)"],
      lightColors: ["rgba(0, 122, 255, 0.1)", "rgba(0, 122, 255, 0.05)"],
      iconBg: isDark ? "rgba(0, 122, 255, 0.2)" : "rgba(0, 122, 255, 0.1)",
      iconColor: "#007AFF",
    },
    {
      icon: ImageIcon,
      label: "Photos",
      onPress: () => handlePhotoAction(onPickImage),
      colors: ["rgba(138, 43, 226, 0.15)", "rgba(138, 43, 226, 0.08)"],
      lightColors: ["rgba(138, 43, 226, 0.1)", "rgba(138, 43, 226, 0.05)"],
      iconBg: isDark ? "rgba(138, 43, 226, 0.2)" : "rgba(138, 43, 226, 0.1)",
      iconColor: "#8A2BE2",
    },
  ];

  const aiOptions = [
    {
      icon: Wand2,
      title: "Generate Image",
      description: "Create custom images using AI",
      onPress: () => handleAction(onGenerateImage),
      color: "#FF6B6B",
    },
    {
      icon: Globe,
      title: "Web Search",
      description: "Search the web for information",
      onPress: () => handleAction(onWebSearch),
      color: "#4FC3F7",
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
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.2)",
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
          },
          sheetStyle
        ]}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? (isDark ? 100 : 80) : 100}
          tint={isDark ? "dark" : "light"}
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: "hidden",
            paddingBottom: insets.bottom + 10,
          }}
        >
          <LinearGradient
            colors={isDark 
              ? ["rgba(28, 28, 30, 0.98)", "rgba(18, 18, 20, 0.98)"]
              : ["rgba(255, 255, 255, 0.98)", "rgba(242, 242, 247, 0.98)"]
            }
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
                paddingBottom: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 5,
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.15)",
                  borderRadius: 2.5,
                }}
              />
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Media Options Row */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {mediaOptions.map((option, index) => {
                    const Icon = option.icon;
                    return (
                      <Pressable
                        key={index}
                        onPress={option.onPress}
                        style={({ pressed }) => ({
                          flex: 1,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={{ borderRadius: 18, overflow: "hidden" }}>
                          <LinearGradient
                            colors={isDark ? option.colors : option.lightColors}
                            style={styles.mediaButtonGradient}
                          >
                            <View style={[styles.mediaIconContainer, { backgroundColor: option.iconBg, shadowColor: option.iconColor }]}>
                              <Icon size={24} color={option.iconColor} strokeWidth={2} />
                            </View>
                            <Text style={[styles.mediaButtonText, { color: colors.text }]}>{option.label}</Text>
                          </LinearGradient>
                        </BlurView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* AI Tools Section */}
              <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
                <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>AI Tools</Text>
                <View style={{ gap: 10 }}>
                  {aiOptions.map((option, index) => {
                    const Icon = option.icon;
                    return (
                      <Pressable
                        key={index}
                        onPress={option.onPress}
                        style={({ pressed }) => ({
                          borderRadius: 18,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={{ borderRadius: 18, overflow: "hidden" }}>
                          <LinearGradient
                            colors={[`${option.color}15`, `${option.color}08`]}
                            style={[styles.aiOptionGradient, { borderColor: `${option.color}30` }]}
                          >
                            <View style={[styles.aiIconContainer, { backgroundColor: `${option.color}25`, shadowColor: option.color }]}>
                              <Icon size={22} color={option.color} strokeWidth={2} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.aiOptionTitle, { color: colors.text }]}>{option.title}</Text>
                              <Text style={[styles.aiOptionDesc, { color: colors.textSecondary }]}>{option.description}</Text>
                            </View>
                          </LinearGradient>
                        </BlurView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  mediaButtonGradient: {
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 18,
  },
  mediaIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  aiOptionGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  aiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  aiOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  aiOptionDesc: {
    fontSize: 13,
    lineHeight: 16,
  },
});

export default PersonalAttachmentsMenu;

