import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";

interface Tab {
  key: string;
  label: string;
}

interface LiquidGlassTabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  style?: ViewStyle;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * LiquidGlassTabSwitcher - iOS 26 style liquid glass segmented control
 * 
 * Features:
 * - Animated sliding indicator with spring physics
 * - Liquid glass blur effect
 * - Premium gradient overlay
 * - Haptic feedback on selection
 */
const LiquidGlassTabSwitcher: React.FC<LiquidGlassTabSwitcherProps> = ({
  tabs,
  activeTab,
  onTabChange,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const [containerWidth, setContainerWidth] = React.useState(0);
  
  // Calculate tab width based on actual container width
  const tabWidth = containerWidth > 0 ? containerWidth / tabs.length : 0;
  
  // Find active tab index
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const slideAnim = useRef(new Animated.Value(activeIndex * tabWidth)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Animate indicator when active tab changes
  useEffect(() => {
    if (tabWidth === 0) return;
    
    const targetIndex = tabs.findIndex((tab) => tab.key === activeTab);
    
    // Scale down slightly, move, then scale back up for a "liquid" feel
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: targetIndex * tabWidth,
          useNativeDriver: true,
          tension: 300,
          friction: 20,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeTab, tabWidth]);

  const handleTabPress = (tabKey: string) => {
    if (tabKey !== activeTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(tabKey);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Outer glass container */}
      <View
        style={[
          styles.glassContainer,
          {
            backgroundColor: isDark 
              ? "rgba(30, 30, 35, 0.5)" 
              : "rgba(255, 255, 255, 0.85)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : colors.glassBorder,
          },
        ]}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          setContainerWidth(width);
        }}
      >
        <BlurView
          intensity={isDark ? 40 : 80}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />

        {/* Animated indicator */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth - 8,
                transform: [
                  { translateX: slideAnim },
                  { scaleY: scaleAnim },
                ],
              },
            ]}
          >
          <View
            style={[
              styles.indicatorInner,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(255, 255, 255, 0.95)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(0, 122, 255, 0.2)",
              },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 30}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            {/* Subtle gradient shine */}
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.02)"]
                  : ["rgba(0, 122, 255, 0.08)", "rgba(0, 122, 255, 0.02)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          </Animated.View>
        )}

        {/* Tab buttons */}
        <View style={styles.tabsRow}>
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive
                        ? colors.primary
                        : colors.textSecondary,
                      fontWeight: isActive ? "600" : "500",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  glassContainer: {
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  indicator: {
    position: "absolute",
    top: 3,
    left: 4,
    height: 36,
    zIndex: 0,
  },
  indicatorInner: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 0.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },
  tab: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
});

export default LiquidGlassTabSwitcher;

