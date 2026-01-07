import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  Dimensions,
  ScrollView,
  LayoutRectangle,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import {
  ChevronDown,
  Sparkles,
  Plus,
  Check,
  TrendingUp,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { useTopAgents, useAllUserAgents } from "@/hooks/usePersonalChats";
import type { AIFriend } from "@/shared/contracts";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DROPDOWN_WIDTH = Math.min(SCREEN_WIDTH - 40, 340);

interface AgentSelectorDropdownProps {
  selectedAgent: AIFriend | null;
  onAgentSelect: (agent: AIFriend | null) => void;
  onCreateNewAgent: () => void;
}

/**
 * AgentSelectorDropdown - iOS 26 Liquid Glass Style Selector
 * 
 * Features:
 * - Liquid glass morphing animation from trigger to dropdown
 * - Top 3 most-used agents (or 3 most recent if no usage data)
 * - "More Agents" expandable section
 * - "Create New Agent" button
 * - Spring-based animations for premium feel
 */
export default function AgentSelectorDropdown({
  selectedAgent,
  onAgentSelect,
  onCreateNewAgent,
}: AgentSelectorDropdownProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<LayoutRectangle | null>(null);
  const triggerRef = useRef<View>(null);
  
  const { data: topAgents = [], isLoading: isLoadingTop } = useTopAgents();
  const { data: allAgents = [], isLoading: isLoadingAll } = useAllUserAgents();
  
  // Animation values
  const morphProgress = useSharedValue(0);
  const chevronRotation = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  
  // Get default agents: top 3 used, or if no usage data, 3 most recent
  const displayedTopAgents = topAgents.length > 0 
    ? topAgents.slice(0, 3)
    : allAgents.slice(0, 3);
  
  // Filter out displayed agents from all agents
  const displayedIds = new Set(displayedTopAgents.map(a => a.id));
  const otherAgents = allAgents.filter(a => !displayedIds.has(a.id));
  
  useEffect(() => {
    if (isOpen) {
      morphProgress.value = withSpring(1, {
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      });
      chevronRotation.value = withSpring(180, {
        damping: 15,
        stiffness: 150,
      });
      contentOpacity.value = withTiming(1, { duration: 200 });
    } else {
      morphProgress.value = withSpring(0, {
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      });
      chevronRotation.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
      contentOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [isOpen]);
  
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));
  
  // Liquid glass morphing container style
  const dropdownAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      morphProgress.value,
      [0, 1],
      [0.85, 1],
      Extrapolation.CLAMP
    );
    
    const translateY = interpolate(
      morphProgress.value,
      [0, 1],
      [-20, 0],
      Extrapolation.CLAMP
    );
    
    const opacity = interpolate(
      morphProgress.value,
      [0, 0.3, 1],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ scale }, { translateY }],
      opacity,
    };
  });
  
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));
  
  const handleOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Measure trigger position
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setTriggerLayout({ x, y, width, height });
    });
    setIsOpen(true);
    setShowAllAgents(false);
  }, []);
  
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(false);
    setShowAllAgents(false);
  }, []);
  
  const handleSelectAgent = useCallback((agent: AIFriend | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAgentSelect(agent);
    setIsOpen(false);
  }, [onAgentSelect]);
  
  const handleShowMoreAgents = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAllAgents(true);
  }, []);
  
  const handleCreateNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(false);
    onCreateNewAgent();
  }, [onCreateNewAgent]);
  
  const renderAgentItem = (agent: AIFriend, isSelected: boolean, showUsageIndicator?: boolean) => (
    <Pressable
      key={agent.id}
      onPress={() => handleSelectAgent(agent)}
      style={({ pressed }) => [
        styles.agentItem,
        {
          backgroundColor: pressed
            ? isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
            : isSelected
            ? isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)"
            : "transparent",
        },
      ]}
    >
      <View style={styles.agentItemLeft}>
        <View style={styles.agentItemInfo}>
          <Text
            style={[
              styles.agentItemName,
              { color: colors.text },
              isSelected && { color: "#6366f1" },
            ]}
            numberOfLines={1}
          >
            {agent.name}
          </Text>
          {agent.personality && (
            <Text
              style={[styles.agentItemPersonality, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {agent.personality}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.agentItemRight}>
        {showUsageIndicator && topAgents.some(a => a.id === agent.id) && (
          <View style={[styles.usageIndicator, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <TrendingUp size={10} color="#6366f1" />
          </View>
        )}
        {isSelected && (
          <Check size={18} color="#6366f1" strokeWidth={3} />
        )}
      </View>
    </Pressable>
  );
  
  const displayName = selectedAgent?.name || "VibeChat AI";
  const displayEmoji = selectedAgent?.avatar || "✨";
  
  // Calculate dropdown position
  const dropdownTop = triggerLayout 
    ? triggerLayout.y + triggerLayout.height + 8
    : insets.top + 60;
  
  return (
    <>
      {/* Trigger Button */}
      <Pressable onPress={handleOpen}>
        <View 
          ref={triggerRef}
          style={[
            styles.trigger,
            { 
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            }
          ]}
        >
          <BlurView
            intensity={isDark ? 30 : 20}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.triggerContent}>
            <View style={[
              styles.triggerAvatar,
              { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)" }
            ]}>
              <Text style={styles.triggerAvatarEmoji}>{displayEmoji}</Text>
            </View>
            <Text
              style={[styles.triggerText, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Animated.View style={chevronStyle}>
              <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2.5} />
            </Animated.View>
          </View>
        </View>
      </Pressable>
      
      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          {/* Backdrop */}
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={styles.backdrop}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>
          
          {/* Dropdown Container - Liquid Glass Style */}
          <Animated.View
            style={[
              styles.dropdownContainer,
              {
                top: dropdownTop,
                left: (SCREEN_WIDTH - DROPDOWN_WIDTH) / 2,
                width: DROPDOWN_WIDTH,
                maxHeight: SCREEN_HEIGHT - dropdownTop - insets.bottom - 40,
              },
              dropdownAnimatedStyle,
            ]}
          >
            <BlurView
              intensity={Platform.OS === "ios" ? 90 : 100}
              tint={isDark ? "dark" : "light"}
              style={styles.dropdownBlur}
            >
              <LinearGradient
                colors={
                  isDark
                    ? ["rgba(35,35,40,0.95)", "rgba(25,25,30,0.98)"]
                    : ["rgba(255,255,255,0.98)", "rgba(248,248,252,0.99)"]
                }
                style={styles.dropdownGradient}
              >
                <Animated.View style={contentAnimatedStyle}>
                  {/* Header */}
                  <View style={styles.dropdownHeader}>
                    <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                      Select Agent
                    </Text>
                    <Pressable onPress={handleClose} style={styles.doneButton}>
                      <Text style={[styles.doneButtonText, { color: colors.primary }]}>
                        Done
                      </Text>
                    </Pressable>
                  </View>
                  
                  <ScrollView
                    style={styles.dropdownScroll}
                    contentContainerStyle={styles.dropdownScrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    {/* Default VibeChat AI Option */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Image
                          source={require("../../../assets/vibechat icon main.png")}
                          style={styles.sectionIcon}
                          contentFit="cover"
                        />
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                          DEFAULT
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleSelectAgent(null)}
                        style={({ pressed }) => [
                          styles.agentItem,
                          {
                            backgroundColor: pressed
                              ? isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
                              : !selectedAgent
                              ? isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)"
                              : "transparent",
                          },
                        ]}
                      >
                        <View style={styles.agentItemLeft}>
                          <View style={styles.agentItemInfo}>
                            <Text style={[styles.agentItemName, { color: colors.text }]}>
                              VibeChat AI
                            </Text>
                            <Text style={[styles.agentItemPersonality, { color: colors.textSecondary }]}>
                              Your personal AI assistant
                            </Text>
                          </View>
                        </View>
                        {!selectedAgent && (
                          <Check size={18} color="#6366f1" strokeWidth={3} />
                        )}
                      </Pressable>
                    </View>
                    
                    {/* Frequently Used / Recent Agents */}
                    {displayedTopAgents.length > 0 && (
                      <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                          <TrendingUp size={12} color={colors.textSecondary} />
                          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            {topAgents.length > 0 ? "MOST USED" : "RECENT"}
                          </Text>
                        </View>
                        {displayedTopAgents.map((agent) =>
                          renderAgentItem(agent, selectedAgent?.id === agent.id, true)
                        )}
                      </View>
                    )}
                    
                    {/* More Agents Button */}
                    {!showAllAgents && otherAgents.length > 0 && (
                      <Pressable
                        onPress={handleShowMoreAgents}
                        style={({ pressed }) => [
                          styles.moreAgentsButton,
                          {
                            backgroundColor: pressed
                              ? isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
                              : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                          },
                        ]}
                      >
                        <View style={styles.moreAgentsContent}>
                          <Users size={18} color={colors.textSecondary} />
                          <Text style={[styles.moreAgentsText, { color: colors.text }]}>
                            More Agents
                          </Text>
                          <View style={[styles.countBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
                            <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                              {otherAgents.length}
                            </Text>
                          </View>
                        </View>
                        <ChevronDown size={16} color={colors.textSecondary} />
                      </Pressable>
                    )}
                    
                    {/* Expanded All Agents List */}
                    {showAllAgents && otherAgents.length > 0 && (
                      <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                          <Users size={12} color={colors.textSecondary} />
                          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            ALL AGENTS
                          </Text>
                        </View>
                        {otherAgents.map((agent) =>
                          renderAgentItem(agent, selectedAgent?.id === agent.id)
                        )}
                      </View>
                    )}
                    
                    {/* Create New Agent Button */}
                    <View style={styles.createSection}>
                      <Pressable
                        onPress={handleCreateNew}
                        style={({ pressed }) => [
                          styles.createButton,
                          {
                            backgroundColor: pressed
                              ? isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.15)"
                              : isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
                          },
                        ]}
                      >
                        <View style={styles.createButtonIcon}>
                          <Plus size={18} color="#6366f1" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.createButtonText}>Create New Agent</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </Animated.View>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  triggerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  triggerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerAvatarEmoji: {
    fontSize: 14,
  },
  triggerText: {
    fontSize: 15,
    fontWeight: "600",
    maxWidth: 140,
  },
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dropdownContainer: {
    position: "absolute",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    overflow: "hidden",
  },
  dropdownBlur: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  dropdownGradient: {
    flex: 1,
    borderRadius: 24,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.15)",
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  doneButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dropdownScroll: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  dropdownScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  section: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  agentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  agentItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  agentItemInfo: {
    flex: 1,
  },
  agentItemName: {
    fontSize: 16,
    fontWeight: "600",
  },
  agentItemPersonality: {
    fontSize: 13,
    marginTop: 2,
  },
  agentItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  usageIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  moreAgentsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  moreAgentsContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  moreAgentsText: {
    fontSize: 15,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  createSection: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
    paddingTop: 14,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  createButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366f1",
  },
});
