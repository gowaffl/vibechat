import React, { useEffect, useState, useCallback, useRef } from "react";
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
  withDelay,
  withSequence,
  Easing,
  useDerivedValue,
  useAnimatedKeyboard,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Heart, Smile, AlertCircle, Cloud, Zap, Quote, Coffee, HelpCircle, Megaphone } from "lucide-react-native";
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
  sarcastic: {
    icon: Quote,
    color: "#bef264",
    gradient: ["rgba(190, 242, 100, 0.35)", "rgba(190, 242, 100, 0.20)", "rgba(190, 242, 100, 0.10)"],
    label: "Sarcastic",
    description: "Don't take literally",
  },
  chill: {
    icon: Coffee,
    color: "#22D3EE",
    gradient: ["rgba(34, 211, 238, 0.35)", "rgba(34, 211, 238, 0.20)", "rgba(34, 211, 238, 0.10)"],
    label: "Chill",
    description: "Relaxed & easy",
  },
  confused: {
    icon: HelpCircle,
    color: "#FB923C",
    gradient: ["rgba(251, 146, 60, 0.35)", "rgba(251, 146, 60, 0.20)", "rgba(251, 146, 60, 0.10)"],
    label: "Confused",
    description: "Unsure or lost",
  },
  bold: {
    icon: Megaphone,
    color: "#8B5CF6",
    gradient: ["rgba(139, 92, 246, 0.35)", "rgba(139, 92, 246, 0.20)", "rgba(139, 92, 246, 0.10)"],
    label: "Bold",
    description: "Loud & confident",
  },
};

const VIBES: VibeType[] = [
  "genuine", 
  "playful", 
  "serious", 
  "soft", 
  "hype", 
  "sarcastic", 
  "chill", 
  "confused", 
  "bold"
];

const ITEM_HEIGHT = 52;
const ITEM_WIDTH = 180;
const CONTAINER_PADDING = 8;
const SEND_BUTTON_SIZE = 44; // Approximate size of send button for morph origin
const BORDER_RADIUS = 28;

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
  // Animation state 0 -> 1
  const openProgress = useSharedValue(0);
  // Scroll state
  const scrollY = useSharedValue(0);
  
  // Track selected vibe
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);
  const lastHoveredVibe = useRef<VibeType | null>(null);

  // Keyboard
  const keyboard = useAnimatedKeyboard();

  // Calculate list dimensions
  const listHeight = VIBES.length * ITEM_HEIGHT + (CONTAINER_PADDING * 2);
  
  // Position logic:
  // We want the list to be to the left of the anchor
  // We want the 2nd item (index 1) to align with the anchor Y
  // Anchor is center of send button
  // 2nd item center Y relative to list top = CONTAINER_PADDING + (1 * ITEM_HEIGHT) + (ITEM_HEIGHT / 2)
  // = 8 + 52 + 26 = 86
  const anchorOffsetInList = CONTAINER_PADDING + ITEM_HEIGHT + (ITEM_HEIGHT / 2);
  
  // Base calculations
  const screenHeight = Dimensions.get('window').height;
  const idealTop = anchorPosition.y - anchorOffsetInList - 50; 
  const targetLeft = anchorPosition.x - ITEM_WIDTH - 20;

  // Use derived values for responsive layout that reacts to keyboard
  const layout = useDerivedValue(() => {
    const keyboardHeight = keyboard.height.value;
    const safeBottom = screenHeight - keyboardHeight;
    const minTop = screenHeight * 0.4; // Max 60% up the screen (40% from top)
    
    // We want to anchor to bottom if keyboard is open to ensure it sits on top
    // Default bottom padding when keyboard is closed
    const defaultBottomPadding = 40;
    
    // Calculate the maximum Y value the menu bottom can reach
    // When keyboard open: sits right on top (minus small padding)
    // When keyboard closed: sits above tab bar/safe area
    const maxBottom = safeBottom - (keyboardHeight > 0 ? 10 : defaultBottomPadding);
    
    // Calculate actual top position
    // 1. Start with ideal position (centered on button)
    // 2. Clamp top to be at least minTop (don't go too high)
    // 3. Ensure bottom doesn't exceed maxBottom
    
    let top = idealTop;
    
    // If keyboard pushes it up, we might need to shift up
    if (top + listHeight > maxBottom) {
      top = maxBottom - listHeight;
    }
    
    // But don't go higher than minTop
    top = Math.max(top, minTop);
    
    // Now determine height based on the constrained top and maxBottom
    const availableHeight = maxBottom - top;
    const height = Math.min(listHeight, Math.max(200, availableHeight));
    
    // Recalculate top to anchor to bottom if we are constrained
    // If we are constrained by height, we want the bottom to stay at maxBottom
    if (height < listHeight) {
      top = maxBottom - height;
    }

    return {
      top,
      height,
      left: targetLeft
    };
  });

  // Morph animation styles
  const containerStyle = useAnimatedStyle(() => {
    const currentLayout = layout.value;
    
    // Morph from a small circle at anchor to a large rounded rectangle
    const width = interpolate(
      openProgress.value,
      [0, 1],
      [SEND_BUTTON_SIZE, ITEM_WIDTH],
      Extrapolation.CLAMP
    );
    
    const height = interpolate(
      openProgress.value,
      [0, 1],
      [SEND_BUTTON_SIZE, currentLayout.height],
      Extrapolation.CLAMP
    );
    
    const top = interpolate(
      openProgress.value,
      [0, 1],
      [anchorPosition.y - SEND_BUTTON_SIZE / 2, currentLayout.top],
      Extrapolation.CLAMP
    );
    
    const left = interpolate(
      openProgress.value,
      [0, 1],
      [anchorPosition.x - SEND_BUTTON_SIZE / 2, currentLayout.left],
      Extrapolation.CLAMP
    );

    const borderRadius = interpolate(
      openProgress.value,
      [0, 1],
      [SEND_BUTTON_SIZE / 2, BORDER_RADIUS],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      openProgress.value,
      [0, 0.2],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      position: 'absolute',
      width,
      height,
      top,
      left,
      borderRadius,
      backgroundColor: 'rgba(20, 20, 20, 0.95)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      opacity,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
      zIndex: 9999,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        openProgress.value,
        [0.5, 1],
        [0, 1],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            openProgress.value,
            [0.5, 1],
            [0.8, 1],
            Extrapolation.CLAMP
          ),
        },
        {
          translateY: -scrollY.value, // Apply scrolling
        }
      ]
    };
  });

  // Effect to drive animation
  useEffect(() => {
    if (visible) {
      openProgress.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
      scrollY.value = 0; // Reset scroll
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      openProgress.value = withTiming(0, { duration: 200 });
      setSelectedVibe(null);
      lastHoveredVibe.current = null;
    }
  }, [visible]);

  // Handle touch interactions
  const handleTouchMove = useCallback((pageX: number, pageY: number) => {
    // If we're closed, ignore
    if (!visible) return;

    // Check if we're back near the send button (cancel zone)
    // Send button radius approx 30px
    const dx = pageX - anchorPosition.x;
    const dy = pageY - anchorPosition.y;
    const distToAnchor = Math.sqrt(dx * dx + dy * dy);

    if (distToAnchor < 50) {
      // Near anchor -> Cancel selection
      if (lastHoveredVibe.current !== null) {
        lastHoveredVibe.current = null;
        setSelectedVibe(null);
        onPreview(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    }

    // Determine which item is hovered
    // Calculate Y relative to the list container top
    // Use the dynamic layout top to ensure touches map correctly when list shifts
    const currentTop = layout.value.top;
    const relativeY = pageY - currentTop - CONTAINER_PADDING;
    
    // Virtual Y including potential scroll needed to reach this finger position
    // This creates a "follow the finger" scroll effect for items outside the view
    const index = Math.floor((relativeY + scrollY.value) / ITEM_HEIGHT);
    
    // Check horizontal bounds
    const currentLeft = layout.value.left;
    if (pageX < currentLeft - 50 || pageX > currentLeft + ITEM_WIDTH + 50) {
       if (lastHoveredVibe.current !== null) {
        lastHoveredVibe.current = null;
        setSelectedVibe(null);
        onPreview(null);
      }
      return;
    }

    if (index >= 0 && index < VIBES.length) {
      const vibe = VIBES[index];
      if (vibe !== lastHoveredVibe.current) {
        lastHoveredVibe.current = vibe;
        setSelectedVibe(vibe);
        onPreview(vibe);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Scroll logic: Ensure the selected item is visible
      const itemTop = index * ITEM_HEIGHT;
      const itemBottom = itemTop + ITEM_HEIGHT;
      const currentScroll = scrollY.value;
      
      // Adjusted view height (taking padding into account)
      const viewportHeight = layout.value.height - (CONTAINER_PADDING * 2);

      if (itemBottom > currentScroll + viewportHeight) {
        // Scroll down to show item
        scrollY.value = withTiming(itemBottom - viewportHeight, { duration: 150 });
      } else if (itemTop < currentScroll) {
        // Scroll up to show item
        scrollY.value = withTiming(itemTop, { duration: 150 });
      }

    } else {
      // Outside vertical bounds (e.g. way above top or way below bottom)
       if (lastHoveredVibe.current !== null) {
        lastHoveredVibe.current = null;
        setSelectedVibe(null);
        onPreview(null);
      }
    }
  }, [visible, anchorPosition, layout, onPreview]); // Removed targetTop/Left/containerHeight deps, added layout

  const handleTouchEnd = useCallback((pageX: number, pageY: number) => {
    if (!visible) return;

    // Logic same as move, but finalize
    if (selectedVibe) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelect(selectedVibe);
    } else {
      onCancel();
    }
  }, [visible, selectedVibe, onSelect, onCancel]);

  // Expose methods to parent
  useEffect(() => {
    if (visible) {
      (VibeSelector as any)._handleTouchMove = handleTouchMove;
      (VibeSelector as any)._handleTouchEnd = handleTouchEnd;
    }
  }, [visible, handleTouchMove, handleTouchEnd]);

  if (!visible && openProgress.value === 0) return null;

  return (
    <Animated.View style={containerStyle} pointerEvents="none">
      <Animated.View style={[styles.contentContainer, contentStyle]}>
        {VIBES.map((vibe) => {
          const config = VIBE_CONFIG[vibe];
          const isSelected = selectedVibe === vibe;
          const Icon = config.icon;

          return (
            <View 
              key={vibe} 
              style={[
                styles.itemContainer,
                isSelected && styles.itemSelected
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: isSelected ? 'white' : config.color + '20' }]}>
                <Icon 
                  size={24} 
                  color={isSelected ? config.color : config.color} 
                  strokeWidth={2.5}
                />
              </View>
              <Text style={[styles.label, { color: isSelected ? 'white' : '#ccc' }]}>
                {config.label}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    // flex: 1, // Removed flex: 1 to allow scroll transform to work correctly on height
    padding: CONTAINER_PADDING,
    // justifyContent: 'space-between', // Removed to allow stacking
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 0,
  },
  itemSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
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
