import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Heart, Smile, AlertCircle, Cloud, Zap } from "lucide-react-native";
import type { VibeType } from "@shared/contracts";


// Vibe configuration with icons, colors, and labels
export const VIBE_CONFIG: Record<
  VibeType,
  {
    icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
    color: string;
    gradient: [string, string, string];
    label: string;
    description: string;
  }
> = {
  genuine: {
    icon: Heart,
    color: "#FF6B9D",
    gradient: ["rgba(255, 107, 157, 0.35)", "rgba(255, 107, 157, 0.20)", "rgba(255, 107, 157, 0.10)"],
    label: "Genuine",
    description: "Warm & sincere",
  },
  playful: {
    icon: Smile,
    color: "#FFB347",
    gradient: ["rgba(255, 179, 71, 0.35)", "rgba(255, 179, 71, 0.20)", "rgba(255, 179, 71, 0.10)"],
    label: "Playful",
    description: "Fun & teasing",
  },
  serious: {
    icon: AlertCircle,
    color: "#FF6B6B",
    gradient: ["rgba(255, 107, 107, 0.35)", "rgba(255, 107, 107, 0.20)", "rgba(255, 107, 107, 0.10)"],
    label: "Serious",
    description: "Important & direct",
  },
  soft: {
    icon: Cloud,
    color: "#A78BFA",
    gradient: ["rgba(167, 139, 250, 0.35)", "rgba(167, 139, 250, 0.20)", "rgba(167, 139, 250, 0.10)"],
    label: "Soft",
    description: "Gentle & kind",
  },
  hype: {
    icon: Zap,
    color: "#34D399",
    gradient: ["rgba(52, 211, 153, 0.35)", "rgba(52, 211, 153, 0.20)", "rgba(52, 211, 153, 0.10)"],
    label: "Hype",
    description: "Excited & energetic",
  },
};

const VIBES: VibeType[] = ["genuine", "playful", "serious", "soft", "hype"];

// Arc configuration - positioned to the LEFT of send button
// Arc goes: above → left → below (like a "C" opening to the right)
const ARC_RADIUS = 110; // Increased for more spacing between icons
const ICON_SIZE = 48;
const HIT_SLOP = 35; // Extra touch area for better precision

interface VibeSelectorProps {
  visible: boolean;
  onSelect: (vibe: VibeType | null) => void;
  onPreview: (vibe: VibeType | null) => void;
  onCancel: () => void;
  anchorPosition: { x: number; y: number };
}

export const VibeSelector: React.FC<VibeSelectorProps> = ({
  visible,
  onSelect,
  onPreview,
  onCancel,
  anchorPosition,
}) => {
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);
  const iconAnims = useRef(VIBES.map(() => new Animated.Value(0))).current;
  const iconScales = useRef(VIBES.map(() => new Animated.Value(1))).current;
  const lastHoveredVibe = useRef<VibeType | null>(null);

  // Calculate icon positions in a semi-circle arc to the LEFT of anchor
  // Arc goes from above, around to the left, ending above keyboard level
  // Shifted UP significantly to avoid keyboard overlap
  const getIconPosition = useCallback((index: number) => {
    const totalVibes = VIBES.length;
    // Arc needs to stay well above keyboard
    // Range: 120° to 0° - keeps all icons above input bar
    const startAngle = 95;
    const endAngle = 0;
    const angleRange = endAngle - startAngle;
    const angleStep = angleRange / (totalVibes - 1);
    const angle = startAngle + index * angleStep;
    // Rotate 180° to flip to the left side
    const adjustedAngle = angle + 180;
    const radians = (adjustedAngle * Math.PI) / 180;

    return {
      x: Math.cos(radians) * ARC_RADIUS,
      y: Math.sin(radians) * ARC_RADIUS,
    };
  }, []);

  // Get absolute position of each icon for hit testing
  const getIconAbsolutePosition = useCallback((index: number) => {
    const relPos = getIconPosition(index);
    return {
      x: anchorPosition.x + relPos.x,
      y: anchorPosition.y + relPos.y,
    };
  }, [anchorPosition, getIconPosition]);

  // Find which vibe is being hovered based on absolute touch position
  const findHoveredVibe = useCallback(
    (touchX: number, touchY: number): VibeType | null => {
      let closestVibe: VibeType | null = null;
      let closestDistance = Infinity;
      const maxDistance = ICON_SIZE / 2 + HIT_SLOP;

      VIBES.forEach((vibe, index) => {
        const iconPos = getIconAbsolutePosition(index);
        const distance = Math.sqrt(
          Math.pow(touchX - iconPos.x, 2) + Math.pow(touchY - iconPos.y, 2)
        );

        if (distance < maxDistance && distance < closestDistance) {
          closestDistance = distance;
          closestVibe = vibe;
        }
      });

      return closestVibe;
    },
    [getIconAbsolutePosition]
  );

  // Animate in/out
  useEffect(() => {
    if (visible) {
      // Reset state
      setSelectedVibe(null);
      lastHoveredVibe.current = null;

      // Quick staggered pop-in animation - very fast
      iconAnims.forEach((anim, index) => {
        anim.setValue(0);
        Animated.sequence([
          Animated.delay(index * 25), // 25ms stagger - super quick
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 500,
            friction: 8,
          }),
        ]).start();
      });

      // Haptic feedback on open
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Quick fade out
      iconAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [visible, iconAnims]);

  // Handle vibe hover changes
  const handleVibeHover = useCallback(
    (vibe: VibeType | null) => {
      if (vibe !== lastHoveredVibe.current) {
        lastHoveredVibe.current = vibe;
        setSelectedVibe(vibe);
        onPreview(vibe);

        // Animate icon scales - quick and snappy
        VIBES.forEach((v, index) => {
          Animated.spring(iconScales[index], {
            toValue: v === vibe ? 1.35 : 1,
            useNativeDriver: true,
            tension: 500,
            friction: 8,
          }).start();
        });

        // Haptic feedback on hover change
        if (vibe) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [onPreview, iconScales]
  );

  // Handle touch move - called from parent
  const handleTouchMove = useCallback(
    (touchX: number, touchY: number) => {
      const hoveredVibe = findHoveredVibe(touchX, touchY);
      handleVibeHover(hoveredVibe);
    },
    [findHoveredVibe, handleVibeHover]
  );

  // Handle touch end - called from parent
  const handleTouchEnd = useCallback(
    (touchX: number, touchY: number) => {
      const hoveredVibe = findHoveredVibe(touchX, touchY);
      
      if (hoveredVibe) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSelect(hoveredVibe);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCancel();
      }
    },
    [findHoveredVibe, onSelect, onCancel]
  );

  // Expose methods via ref-like pattern using effect
  useEffect(() => {
    if (visible) {
      // Store handlers globally so parent can call them
      (VibeSelector as any)._handleTouchMove = handleTouchMove;
      (VibeSelector as any)._handleTouchEnd = handleTouchEnd;
    }
  }, [visible, handleTouchMove, handleTouchEnd]);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          left: anchorPosition.x,
          top: anchorPosition.y,
        },
      ]}
      pointerEvents="none"
    >
      {/* Vibe icons in arc pattern - no background */}
      {VIBES.map((vibe, index) => {
        const pos = getIconPosition(index);
        const config = VIBE_CONFIG[vibe];
        const IconComponent = config.icon;
        const isSelected = selectedVibe === vibe;

        return (
          <Animated.View
            key={vibe}
            style={[
              styles.iconWrapper,
              {
                transform: [
                  { translateX: pos.x - ICON_SIZE / 2 },
                  { translateY: pos.y - ICON_SIZE / 2 },
                  { scale: Animated.multiply(iconAnims[index], iconScales[index]) },
                ],
                opacity: iconAnims[index],
              },
            ]}
          >
            <View
              style={[
                styles.iconBackground,
                {
                  backgroundColor: isSelected
                    ? `${config.color}50`
                    : "rgba(30, 30, 30, 0.95)",
                  borderColor: isSelected ? config.color : "rgba(255, 255, 255, 0.25)",
                  shadowColor: config.color,
                  shadowOpacity: isSelected ? 0.8 : 0.3,
                },
              ]}
            >
              <IconComponent
                size={24}
                color={isSelected ? "#FFFFFF" : config.color}
                strokeWidth={2}
              />
            </View>
            
            {/* Label appears ABOVE selected icon (so finger doesn't block it) */}
            {isSelected && (
              <View style={styles.labelBubble}>
                <Text style={[styles.labelText, { color: config.color }]}>
                  {config.label}
                </Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
    // Center point is at anchor position
  },
  iconWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  iconBackground: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  labelBubble: {
    position: "absolute",
    bottom: ICON_SIZE + 4,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 100,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    fontSize: 7,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.1,
    textAlign: "center",
  },
});

// Static methods for parent to call
export const VibeSelectorStatic = {
  handleTouchMove: (touchX: number, touchY: number) => {
    (VibeSelector as any)._handleTouchMove?.(touchX, touchY);
  },
  handleTouchEnd: (touchX: number, touchY: number) => {
    (VibeSelector as any)._handleTouchEnd?.(touchX, touchY);
  },
};

export default VibeSelector;
