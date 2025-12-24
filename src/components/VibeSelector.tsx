import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  useDerivedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Heart, Smile, AlertCircle, Cloud, Zap, Quote, HelpCircle } from "lucide-react-native";
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
    color: "#FBBF24", // Amber-400 (Yellow-ish)
    gradient: ["rgba(251, 191, 36, 0.35)", "rgba(251, 191, 36, 0.20)", "rgba(251, 191, 36, 0.10)"],
    label: "Playful",
    description: "Fun & teasing",
  },
  serious: {
    icon: AlertCircle,
    color: "#60A5FA", // Blue-400
    gradient: ["rgba(96, 165, 250, 0.35)", "rgba(96, 165, 250, 0.20)", "rgba(96, 165, 250, 0.10)"],
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
  sarcastic: {
    icon: Quote,
    color: "#bef264",
    gradient: ["rgba(190, 242, 100, 0.35)", "rgba(190, 242, 100, 0.20)", "rgba(190, 242, 100, 0.10)"],
    label: "Sarcastic",
    description: "Don't take literally",
  },
  confused: {
    icon: HelpCircle,
    color: "#FB923C",
    gradient: ["rgba(251, 146, 60, 0.35)", "rgba(251, 146, 60, 0.20)", "rgba(251, 146, 60, 0.10)"],
    label: "Confused",
    description: "Unsure or lost",
  },
};

const VIBES: VibeType[] = [
  "genuine", 
  "playful", 
  "serious", 
  "soft", 
  "hype", 
  "sarcastic", 
  "confused"
];

const ITEM_SIZE = 48;
const RADIUS = 150; // Distance from button
const ANGLE_START = -180; // Left
const ANGLE_END = -92; // Top-Left (adjusted for better spacing and position)

interface VibeSelectorProps {
  visible: boolean;
  onSelect: (vibe: VibeType | null) => void;
  onPreview: (vibe: VibeType | null) => void;
  onCancel: () => void;
  anchorPosition: { x: number; y: number };
}

// Separate component to handle hooks correctly
const VibeItem = React.memo(({ 
  vibe, 
  anchorPosition, 
  openProgress, 
  isSelected, 
  relX, 
  relY 
}: { 
  vibe: VibeType, 
  anchorPosition: { x: number, y: number }, 
  openProgress: Animated.SharedValue<number>, 
  isSelected: boolean,
  relX: number,
  relY: number
}) => {
  const config = VIBE_CONFIG[vibe];
  const Icon = config.icon;

  const animStyle = useAnimatedStyle(() => {
    const progress = openProgress.value;
    const x = interpolate(progress, [0, 1], [anchorPosition.x, anchorPosition.x + relX]);
    const y = interpolate(progress, [0, 1], [anchorPosition.y, anchorPosition.y + relY]);
    
    const scale = interpolate(progress, [0, 0.7, 1], [0, 1.1, 1]);
    
    return {
      transform: [
        { translateX: x - ITEM_SIZE/2 },
        { translateY: y - ITEM_SIZE/2 },
        { scale: isSelected ? withSpring(1.3) : scale }
      ],
      opacity: progress,
    };
  }, [anchorPosition, relX, relY, isSelected]);
  
  const labelStyle = useAnimatedStyle(() => {
    const progress = openProgress.value;
    const x = interpolate(progress, [0, 1], [anchorPosition.x, anchorPosition.x + relX]);
    const y = interpolate(progress, [0, 1], [anchorPosition.y, anchorPosition.y + relY]);

    return {
      position: 'absolute',
      top: 0, 
      left: 0,
      transform: [
        { translateX: x - 60 }, // Center label (width 120)
        { translateY: y - 60 }, // Position above dot
        { scale: withSpring(isSelected ? 1 : 0) }
      ],
      opacity: withTiming(isSelected ? 1 : 0, { duration: 200 }),
    };
  }, [anchorPosition, relX, relY, isSelected]);

  return (
    <>
      <Animated.View style={[styles.dot, { backgroundColor: config.color }, animStyle]}>
         <Icon size={28} color="white" strokeWidth={2.5} />
      </Animated.View>
      <Animated.View style={[styles.labelContainer, labelStyle]}>
        <Text style={[styles.labelText, { color: config.color }]}>{config.label}</Text>
      </Animated.View>
    </>
  );
});

export const VibeSelector: React.FC<VibeSelectorProps> = ({
  visible,
  onSelect,
  onPreview,
  onCancel,
  anchorPosition,
}) => {
  const openProgress = useSharedValue(0);
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);
  const lastHoveredVibe = useRef<VibeType | null>(null);

  // Pre-calculate positions
  const vibePositions = useMemo(() => VIBES.map((vibe, index) => {
    const totalAngle = ANGLE_END - ANGLE_START;
    const step = totalAngle / (VIBES.length - 1);
    const angleDeg = ANGLE_START + (index * step);
    const angleRad = (angleDeg * Math.PI) / 180;
    
    // Relative position
    const relX = Math.cos(angleRad) * RADIUS;
    const relY = Math.sin(angleRad) * RADIUS;
    
    return { vibe, relX, relY };
  }), []);

  useEffect(() => {
    if (visible) {
      openProgress.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      openProgress.value = withTiming(0, { duration: 200 });
      setSelectedVibe(null);
      lastHoveredVibe.current = null;
    }
  }, [visible]);

  const handleTouchMove = useCallback((pageX: number, pageY: number) => {
    if (!visible) return;

    let closestVibe: VibeType | null = null;
    let minDist = 60; // Hit slop radius

    vibePositions.forEach(({ vibe, relX, relY }) => {
      const dotX = anchorPosition.x + relX;
      const dotY = anchorPosition.y + relY;
      
      const dx = pageX - dotX;
      const dy = pageY - dotY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDist) {
        minDist = dist;
        closestVibe = vibe;
      }
    });

    if (closestVibe !== lastHoveredVibe.current) {
        lastHoveredVibe.current = closestVibe;
        setSelectedVibe(closestVibe);
        onPreview(closestVibe);
        if (closestVibe) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }
  }, [visible, anchorPosition, onPreview, vibePositions]);

  const handleTouchEnd = useCallback((pageX: number, pageY: number) => {
    if (!visible) return;
    
    if (selectedVibe) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelect(selectedVibe);
    } else {
      onCancel();
    }
  }, [visible, selectedVibe, onSelect, onCancel]);

  useEffect(() => {
    if (visible) {
      (VibeSelector as any)._handleTouchMove = handleTouchMove;
      (VibeSelector as any)._handleTouchEnd = handleTouchEnd;
    }
  }, [visible, handleTouchMove, handleTouchEnd]);

  if (!visible && openProgress.value === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {vibePositions.map((pos) => (
            <VibeItem 
                key={pos.vibe}
                vibe={pos.vibe}
                anchorPosition={anchorPosition}
                openProgress={openProgress}
                isSelected={selectedVibe === pos.vibe}
                relX={pos.relX}
                relY={pos.relY}
            />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  labelContainer: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    zIndex: 20,
  },
  labelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  }
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
