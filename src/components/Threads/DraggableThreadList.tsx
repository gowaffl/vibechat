
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedReaction,
} from "react-native-reanimated";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";
import type { Thread } from "@shared/contracts";

// --- Constants ---
const GAP = 8;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

// --- Interfaces ---

interface DraggableThreadListProps {
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  onReorder: (items: { threadId: string; sortOrder: number }[]) => void;
  onOpenPanel: () => void;
  onCreateThread: () => void;
}

// --- Main Component ---

const DraggableThreadList: React.FC<DraggableThreadListProps> = ({
  threads,
  currentThreadId,
  onSelectThread,
  onReorder,
  onOpenPanel,
  onCreateThread,
}) => {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  // Store widths as shared values so they're accessible on UI thread
  const widths = useSharedValue<Record<string, number>>({});
  
  // Current visual order (position index for each ID)
  const positions = useSharedValue<Record<string, number>>({});
  
  // Track which item is being dragged
  const draggingId = useSharedValue<string | null>(null);

  // Store the original order for offset calculations
  const originalOrder = useSharedValue<string[]>([]);

  // Initialize positions when threads change
  useEffect(() => {
    const initialPositions: Record<string, number> = {};
    const ids = threads.map(t => t.id);
    threads.forEach((thread, index) => {
      initialPositions[thread.id] = index;
    });
    positions.value = initialPositions;
    originalOrder.value = ids;
  }, [threads]);

  const handleWidthMeasure = (id: string, width: number) => {
    widths.value = { ...widths.value, [id]: width };
  };

  const handleDragStart = () => {
    setScrollEnabled(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleReorderChange = () => {
    Haptics.selectionAsync();
  };

  const handleDragEnd = () => {
    setScrollEnabled(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Convert positions back to order array
    const positionsObj = positions.value;
    const orderedIds = Object.entries(positionsObj)
      .sort(([, posA], [, posB]) => posA - posB)
      .map(([id]) => id);
    
    // Persist to backend
    const reorderedItems = orderedIds.map((id, index) => ({
      threadId: id,
      sortOrder: index
    }));
    
    onReorder(reorderedItems);
  };

  return (
    <View style={{ height: 50, justifyContent: "center" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={{
          paddingHorizontal: 16,
          alignItems: "center",
          minWidth: "100%",
          justifyContent: "center",
        }}
      >
        {/* Show Main Chat pill only if there are threads, or always show it in the top bar if no threads exist */}
        {threads.length > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectThread(null);
            }}
            style={{ marginRight: GAP, zIndex: 1 }}
          >
            <BlurView
              intensity={currentThreadId === null ? 70 : 40}
              tint="dark"
              style={[
                styles.pill,
                currentThreadId === null && styles.activePill,
              ]}
            >
              <Text
                style={[
                  styles.text,
                  currentThreadId === null && styles.activeText,
                ]}
              >
                Main Chat
              </Text>
            </BlurView>
          </Pressable>
        )}

        {threads.length === 0 && (
          /* Show Main Chat pill when no threads exist */
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectThread(null);
            }}
            style={{ marginRight: GAP, zIndex: 1 }}
          >
            <BlurView
              intensity={currentThreadId === null ? 70 : 40}
              tint="dark"
              style={[
                styles.pill,
                currentThreadId === null && styles.activePill,
              ]}
            >
              <Text
                style={[
                  styles.text,
                  currentThreadId === null && styles.activeText,
                ]}
              >
                Main Chat
              </Text>
            </BlurView>
          </Pressable>
        )}

        {/* Draggable Items Container */}
        {threads.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {threads.map((thread, index) => (
              <SortableItem
                key={thread.id}
                id={thread.id}
                thread={thread}
                index={index}
                isActive={currentThreadId === thread.id}
                onSelect={() => onSelectThread(thread.id)}
                widths={widths}
                positions={positions}
                draggingId={draggingId}
                originalOrder={originalOrder}
                onWidthMeasure={handleWidthMeasure}
                onDragStart={handleDragStart}
                onReorderChange={handleReorderChange}
                onDragEnd={handleDragEnd}
              />
            ))}
          </View>
        )}

        {/* Add/Menu Button - Opens Create Thread directly */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCreateThread();
          }}
          style={{ marginLeft: GAP }}
        >
          <BlurView
            intensity={30}
            tint="dark"
            style={[
              styles.pill,
              {
                aspectRatio: 1,
                paddingHorizontal: 0,
                width: 36,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: "300",
                lineHeight: 22,
                textAlign: "center",
              }}
            >
              +
            </Text>
          </BlurView>
        </Pressable>
      </ScrollView>
    </View>
  );
};

// --- Sortable Item Component ---

interface SortableItemProps {
  id: string;
  thread: Thread;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  widths: Animated.SharedValue<Record<string, number>>;
  positions: Animated.SharedValue<Record<string, number>>;
  draggingId: Animated.SharedValue<string | null>;
  originalOrder: Animated.SharedValue<string[]>;
  onWidthMeasure: (id: string, width: number) => void;
  onDragStart: () => void;
  onReorderChange: () => void;
  onDragEnd: () => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  id,
  thread,
  index,
  isActive,
  onSelect,
  widths,
  positions,
  draggingId,
  originalOrder,
  onWidthMeasure,
  onDragStart,
  onReorderChange,
  onDragEnd,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // React to position changes and animate
  useAnimatedReaction(
    () => {
      return {
        positions: positions.value,
        widths: widths.value,
        originalOrder: originalOrder.value,
        isDragging: draggingId.value === id
      };
    },
    (data) => {
      if (data.isDragging) return; // Don't auto-animate while dragging
      
      const myPosition = data.positions[id];
      if (myPosition === undefined) return;
      
      // Calculate where I should be based on visual position
      const sortedByPosition = Object.entries(data.positions)
        .sort(([, a], [, b]) => a - b);
      
      let targetX = 0;
      for (const [itemId, itemPos] of sortedByPosition) {
        if (itemPos < myPosition) {
          const itemWidth = data.widths[itemId] || 0;
          targetX += itemWidth + GAP;
        }
      }
      
      // Calculate where I naturally am (based on original index in DOM)
      let naturalX = 0;
      const myOriginalIndex = data.originalOrder.indexOf(id);
      for (let i = 0; i < myOriginalIndex; i++) {
        const itemId = data.originalOrder[i];
        const itemWidth = data.widths[itemId] || 0;
        naturalX += itemWidth + GAP;
      }
      
      // Translate by the difference
      const offset = targetX - naturalX;
      translateX.value = withSpring(offset, SPRING_CONFIG);
    }
  );

  const panGesture = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number; startY: number; startTranslateX: number }
  >({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
      ctx.startTranslateX = translateX.value;
    },
    onActive: (event, ctx) => {
      // Activate drag mode
      if (draggingId.value !== id) {
        draggingId.value = id;
        scale.value = withSpring(1.1, SPRING_CONFIG);
        runOnJS(onDragStart)();
      }

      // Update drag position
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;

      // Collision detection - Calculate absolute positions
      const myPosition = positions.value[id];
      if (myPosition === undefined) return;

      const myWidth = widths.value[id] || 0;
      const allWidths = widths.value;
      const allPositions = positions.value;
      const origOrder = originalOrder.value;
      
      // Calculate my natural X (where I am in DOM)
      let myNaturalX = 0;
      const myOriginalIndex = origOrder.indexOf(id);
      for (let i = 0; i < myOriginalIndex; i++) {
        const itemId = origOrder[i];
        myNaturalX += (allWidths[itemId] || 0) + GAP;
      }
      
      // My current absolute center
      const myAbsoluteX = myNaturalX + translateX.value;
      const myCenter = myAbsoluteX + myWidth / 2;

      // Check all items for collision
      const sortedByPosition = Object.entries(allPositions).sort(([, a], [, b]) => a - b);

      for (const [otherId, otherPosition] of sortedByPosition) {
        if (otherId === id) continue;

        const otherWidth = allWidths[otherId] || 0;
        
        // Calculate other item's current visual X
        let otherTargetX = 0;
        for (const [itemId, itemPos] of sortedByPosition) {
          if (itemPos < otherPosition) {
            otherTargetX += (allWidths[itemId] || 0) + GAP;
          }
        }
        
        // Other item's center (in its target position)
        const otherCenter = otherTargetX + otherWidth / 2;
        
        // Swap logic based on center crossover
        const swapThreshold = 10; // Small deadzone to prevent jitter

        // If I'm to the left of this item and my center crosses its center
        if (myPosition < otherPosition) {
          if (myCenter > otherCenter + swapThreshold) {
            // Swap positions
            const newPositions = { ...allPositions };
            newPositions[id] = otherPosition;
            newPositions[otherId] = myPosition;
            positions.value = newPositions;
            
            // Adjust translateX to maintain visual continuity
            const positionDiff = otherPosition - myPosition;
            ctx.startX = ctx.startX - (otherWidth + GAP) * positionDiff;
            
            runOnJS(onReorderChange)();
            break;
          }
        }
        // If I'm to the right of this item and my center crosses its center
        else if (myPosition > otherPosition) {
          if (myCenter < otherCenter - swapThreshold) {
            // Swap positions
            const newPositions = { ...allPositions };
            newPositions[id] = otherPosition;
            newPositions[otherId] = myPosition;
            positions.value = newPositions;
            
            // Adjust translateX to maintain visual continuity
            const positionDiff = myPosition - otherPosition;
            ctx.startX = ctx.startX + (otherWidth + GAP) * positionDiff;
            
            runOnJS(onReorderChange)();
            break;
          }
        }
      }
    },
    onEnd: () => {
      if (draggingId.value === id) {
        draggingId.value = null;
        scale.value = withSpring(1, SPRING_CONFIG);
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        runOnJS(onDragEnd)();
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const isDragging = draggingId.value === id;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: isDragging ? 100 : 1,
      opacity: isDragging ? 0.9 : 1,
    };
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    onWidthMeasure(id, width);
  };

  return (
    <PanGestureHandler
      onGestureEvent={panGesture}
      activateAfterLongPress={300}
    >
      <Animated.View
        style={[{ marginRight: GAP }, animatedStyle]}
        onLayout={handleLayout}
      >
        <Pressable
          onPress={() => {
            if (draggingId.value !== id) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect();
            }
          }}
        >
          <BlurView
            intensity={isActive ? 70 : 40}
            tint="dark"
            style={[styles.pill, isActive && styles.activePill]}
          >
            <Text style={[styles.text, isActive && styles.activeText]}>
              {thread.name}
            </Text>
          </BlurView>
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    height: 36,
  },
  activePill: {
    backgroundColor: "rgba(20, 184, 166, 0.3)",
    borderColor: "#14B8A6",
    borderWidth: 1.5,
  },
  text: {
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
    fontSize: 13,
  },
  activeText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default DraggableThreadList;
