/**
 * QuickStartAgents Component
 * 
 * Displays user's top 3 most-used agents as tappable liquid glass avatars
 * for quick conversation creation. iOS 26 liquid glass aesthetic.
 */

import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "lucide-react-native";
import Animated, { 
  FadeIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/contexts/ThemeContext";
import { useTopAgents, useAllUserAgents } from "@/hooks/usePersonalChats";
import type { AIFriend } from "@/shared/contracts";

interface QuickStartAgentsProps {
  onAgentPress: (agent: AIFriend) => void;
  onCreateAgent: () => void;
}

/**
 * Get initials from agent name (first letter of first two words, or first two letters)
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Get a subtle accent color from the agent's color
 */
function getAccentColors(baseColor: string | undefined): {
  glowColor: string;
  borderColor: string;
  textColor: string;
} {
  // Default to a subtle cyan/blue accent if no color
  const color = baseColor || "#6366f1";
  
  // Parse hex to RGB for manipulation
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return {
    glowColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
    textColor: `rgba(${r}, ${g}, ${b}, 0.9)`,
  };
}

/**
 * Liquid Glass Agent Avatar Component
 */
const AgentAvatar = React.memo(({
  agent,
  onPress,
  isDark,
  index,
}: {
  agent: AIFriend;
  onPress: () => void;
  isDark: boolean;
  index: number;
}) => {
  const initials = getInitials(agent.name);
  const { glowColor, borderColor, textColor } = getAccentColors(agent.color);
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };
  
  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(index * 80)}
      style={animatedStyle}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.agentContainer}>
          {/* Outer glow effect */}
          <View style={[styles.glowOuter, { shadowColor: agent.color || "#6366f1" }]}>
            {/* Glass container */}
            <View style={[styles.glassContainer, { borderColor }]}>
              {/* Blur background for glass effect */}
              <BlurView
                intensity={isDark ? 40 : 30}
                tint={isDark ? "dark" : "light"}
                style={styles.blurFill}
              />
              
              {/* Subtle gradient overlay for depth */}
              <LinearGradient
                colors={[
                  isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)",
                  isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.1)",
                  isDark ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.02)",
                ]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.gradientOverlay}
              />
              
              {/* Inner highlight for glass effect */}
              <View style={[
                styles.innerHighlight,
                { borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)" }
              ]} />
              
              {/* Accent color glow at bottom */}
              <View style={[styles.accentGlow, { backgroundColor: glowColor }]} />
              
              {/* Initials */}
              <Text style={[styles.initialsText, { color: textColor }]}>
                {initials}
              </Text>
            </View>
          </View>
          
          {/* Agent name */}
          <Text
            style={[
              styles.agentName,
              { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }
            ]}
            numberOfLines={1}
          >
            {agent.name}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/**
 * Create Agent Avatar Component - Shows "+" icon for creating new agents
 */
const CreateAgentAvatar = React.memo(({
  onPress,
  isDark,
  index,
}: {
  onPress: () => void;
  isDark: boolean;
  index: number;
}) => {
  const scale = useSharedValue(1);
  
  // Brand cyan color for create button
  const brandColor = "#00C6FF";
  const glowColor = "rgba(0, 198, 255, 0.25)";
  const borderColor = "rgba(0, 198, 255, 0.4)";
  const iconColor = "rgba(0, 198, 255, 0.9)";
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };
  
  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(index * 80)}
      style={animatedStyle}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.agentContainer}>
          {/* Outer glow effect */}
          <View style={[styles.glowOuter, { shadowColor: brandColor }]}>
            {/* Glass container */}
            <View style={[styles.glassContainer, { borderColor }]}>
              {/* Blur background for glass effect */}
              <BlurView
                intensity={isDark ? 40 : 30}
                tint={isDark ? "dark" : "light"}
                style={styles.blurFill}
              />
              
              {/* Subtle gradient overlay for depth */}
              <LinearGradient
                colors={[
                  isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)",
                  isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.1)",
                  isDark ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.02)",
                ]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.gradientOverlay}
              />
              
              {/* Inner highlight for glass effect */}
              <View style={[
                styles.innerHighlight,
                { borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)" }
              ]} />
              
              {/* Accent color glow at bottom */}
              <View style={[styles.accentGlow, { backgroundColor: glowColor }]} />
              
              {/* Plus Icon */}
              <Plus
                size={28}
                color={iconColor}
                strokeWidth={2.5}
                style={{ zIndex: 1 }}
              />
            </View>
          </View>
          
          {/* Label */}
          <Text
            style={[
              styles.agentName,
              { color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }
            ]}
            numberOfLines={2}
          >
            Create new agent
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/**
 * QuickStartAgents - Centered row of liquid glass agent avatars
 */
export default function QuickStartAgents({ onAgentPress, onCreateAgent }: QuickStartAgentsProps) {
  const { isDark, colors } = useTheme();
  
  // Get top 3 most-used agents
  const { data: topAgents, isLoading: topLoading } = useTopAgents(3);
  
  // Fallback: Get all agents (sorted by most recent) if top agents are empty
  const { data: allAgents } = useAllUserAgents();
  
  // Use top agents if available, otherwise fall back to 3 most recent agents
  const displayAgents = React.useMemo(() => {
    if (topAgents && topAgents.length > 0) {
      return topAgents.slice(0, 3);
    }
    // Fallback to most recent 3 agents
    if (allAgents && allAgents.length > 0) {
      return allAgents.slice(0, 3);
    }
    return [];
  }, [topAgents, allAgents]);
  
  // Calculate how many slots we need to fill with "Create new agent"
  const needsCreateButton = displayAgents.length < 3;
  
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.container}
    >
      <Text style={[styles.sectionTitle, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }]}>
        QUICK START
      </Text>
      <View style={styles.agentsRow}>
        {/* Display existing agents */}
        {displayAgents.map((agent, index) => (
          <AgentAvatar
            key={agent.id}
            agent={agent}
            onPress={() => onAgentPress(agent)}
            isDark={isDark}
            index={index}
          />
        ))}
        
        {/* Add "Create new agent" button if less than 3 agents */}
        {needsCreateButton && (
          <CreateAgentAvatar
            onPress={onCreateAgent}
            isDark={isDark}
            index={displayAgents.length}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: "center",
  },
  agentsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 32,
  },
  agentContainer: {
    alignItems: "center",
    width: 80,
  },
  glowOuter: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  glassContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  blurFill: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  innerHighlight: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 31,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
  },
  accentGlow: {
    position: "absolute",
    bottom: 0,
    left: "10%",
    right: "10%",
    height: 20,
    borderRadius: 20,
    opacity: 0.6,
  },
  initialsText: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    zIndex: 1,
  },
  agentName: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 10,
  },
});
