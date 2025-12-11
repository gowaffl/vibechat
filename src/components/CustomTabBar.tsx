import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Platform, TextInput, Pressable, Keyboard, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { MessageCircle, User, MoreHorizontal, Search, Globe, ChevronLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  useDerivedValue,
  Extrapolation,
  useAnimatedKeyboard
} from "react-native-reanimated";
import { GradientIcon } from "@/components/GradientIcon";
import { GradientText } from "@/components/GradientText";
import * as Haptics from "expo-haptics";
import { useSearchStore } from "@/stores/searchStore";

interface CustomTabBarProps {
  activeRouteName: string;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ activeRouteName }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const { isSearchOpen, toggleSearch, searchQuery, setSearchQuery, setSearchOpen } = useSearchStore();
  
  // Animation values
  const searchAnim = useSharedValue(0); // 0 = closed, 1 = open
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    searchAnim.value = withSpring(isSearchOpen ? 1 : 0, {
      damping: 15,
      stiffness: 90,
    });
  }, [isSearchOpen]);

  const tabs = [
    { name: "Chats", label: "Chats", icon: MessageCircle, index: 0 },
    { name: "Profile", label: "Profile", icon: User, index: 1 },
    { name: "Community", label: "Community", icon: Globe, index: 2 },
    { name: "More", label: "More", icon: MoreHorizontal, index: 3 },
  ];

  // Helper to get current index
  const currentIndex = tabs.find(t => t.name === activeRouteName)?.index || 0;

  // Animated styles
  
  const isChats = activeRouteName === 'Chats';
  
  // Derived values for animations
  // centerTabsAnim: 0 -> 1 (0 = Chats, 1 = Other)
  const centerTabsAnim = useDerivedValue(() => {
    return withSpring(isChats ? 0 : 1, { damping: 15, stiffness: 90 });
  });

  const tabContainerStyle = useAnimatedStyle(() => {
    const searchOpenOffset = interpolate(searchAnim.value, [0, 0.5], [0, -20], Extrapolation.CLAMP);
    
    return {
      opacity: interpolate(searchAnim.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      right: interpolate(centerTabsAnim.value, [0, 1], [80, 16], Extrapolation.CLAMP), // Animate width expansion (80 gap for search, 16 full width)
      transform: [
        { translateX: searchOpenOffset }, // Slide left when search opens
      ],
      pointerEvents: isSearchOpen ? 'none' : 'auto',
    };
  });

  const SEARCH_BUTTON_WIDTH = 50;
  const EXPANDED_WIDTH = screenWidth - 32; // 16px padding on each side

  const searchContainerStyle = useAnimatedStyle(() => {
    // Hide search container when not on Chats
    const visibilityTranslateX = interpolate(centerTabsAnim.value, [0, 1], [0, 100], Extrapolation.CLAMP); // Move off screen right
    
    return {
      width: interpolate(searchAnim.value, [0, 1], [SEARCH_BUTTON_WIDTH, EXPANDED_WIDTH], Extrapolation.CLAMP),
      height: 50,
      transform: [
          { translateX: visibilityTranslateX }
      ],
      opacity: interpolate(centerTabsAnim.value, [0, 0.5], [1, 0], Extrapolation.CLAMP), // Fade out
    };
  });

  const searchIconStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(searchAnim.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(searchAnim.value, [0, 0.2], [1, 0], Extrapolation.CLAMP) }
      ],
      position: 'absolute',
    };
  });

  const searchInputContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(searchAnim.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(searchAnim.value, [0.4, 1], [20, 0], Extrapolation.CLAMP) }
      ],
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    // Only apply keyboard translation if search is active (searchAnim.value > 0)
    // We multiply by searchAnim.value to smoothly transition and ensure it's 0 when search is closed
    const keyboardTranslateY = -keyboard.height.value + (keyboard.height.value > 0 ? 25 : 0);
    
    return {
      transform: [
        { translateY: keyboardTranslateY * searchAnim.value }
      ]
    };
  });

  return (
    <Animated.View style={[
      {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: Platform.OS === "ios" ? 95 : 75,
      justifyContent: 'flex-end',
      paddingBottom: Platform.OS === "ios" ? 35 : 15,
      pointerEvents: 'box-none',
    },
    Platform.OS === 'ios' ? containerAnimatedStyle : null
    ]}>

      {/* TABS CONTAINER PILL - Merged Background and Content */}
      <Animated.View style={[
        {
          position: 'absolute',
          left: 16,
          // right is animated via style
          bottom: Platform.OS === "ios" ? 20 : 10, // Adjusted to be closer to bottom as requested
          height: 64, // Pill height
          borderRadius: 32, // Pill radius
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between', // Distribute items
          paddingHorizontal: 8, // Padding to keep items from touching edges
        },
        tabContainerStyle
      ]}>
        {Platform.OS === "ios" ? (
            <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />
        ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10, 10, 15, 0.9)" }]} />
        )}
        <LinearGradient
            colors={["rgba(40, 40, 50, 0.5)", "rgba(10, 10, 15, 0.8)"]}
            style={StyleSheet.absoluteFill}
        />
        
        {/* Render Tabs Inside */}
        {tabs.map((tab) => renderTab(tab))}
      </Animated.View>

      {/* Search Container - Anchored Right */}
      <Animated.View style={[
          {
              position: 'absolute',
              right: 16,
              bottom: Platform.OS === "ios" ? 20 + 7 : 10 + 7, // Align with new tabs bottom position
              borderRadius: 32,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)",
              zIndex: 100,
              alignItems: 'center',
              justifyContent: 'center',
          },
          searchContainerStyle
      ]}>
          <BlurView 
              intensity={Platform.OS === 'ios' ? 95 : 100} 
              tint="dark"
              style={StyleSheet.absoluteFill} 
          />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: searchAnim }]}>
              <LinearGradient
                  colors={["rgba(40, 40, 50, 0.8)", "rgba(20, 20, 30, 0.9)"]}
                  style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { 
                  borderColor: "rgba(255, 255, 255, 0.2)", 
                  borderWidth: 1,
                  borderRadius: 32
              }]} />
          </Animated.View>

          {/* Closed State: Search Icon */}
          <Pressable 
              onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleSearch();
              }}
              style={StyleSheet.absoluteFill}
              disabled={isSearchOpen}
          >
              <Animated.View style={[
                  StyleSheet.absoluteFill, 
                  { alignItems: 'center', justifyContent: 'center' },
                  searchIconStyle
              ]}>
                  <View style={{ 
                      width: 50, height: 50, borderRadius: 25, 
                      backgroundColor: "rgba(255,255,255,0.05)",
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
                  }}>
                      <Search size={22} color="rgba(255, 255, 255, 0.8)" />
                  </View>
              </Animated.View>
          </Pressable>

          {/* Open State: Back Button + Input */}
          <Animated.View style={searchInputContainerStyle}>
              <Pressable 
                  onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSearchQuery("");
                      setSearchOpen(false);
                      Keyboard.dismiss();
                  }}
                  style={{ 
                      paddingHorizontal: 16, 
                      height: '100%', 
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexDirection: 'row',
                  }}
              >
                  <ChevronLeft size={24} color="#4FC3F7" style={{ marginRight: 4 }} />
                  <MessageCircle size={24} color="#4FC3F7" fill={activeRouteName === 'Chats' ? "#4FC3F7" : "transparent"} fillOpacity={0.2} />
              </Pressable>

              <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search messages..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  style={{
                      flex: 1,
                      fontSize: 16,
                      color: "#FFFFFF",
                      height: '100%',
                      paddingRight: 16
                  }}
                  autoFocus={isSearchOpen}
              />
          </Animated.View>
      </Animated.View>

    </Animated.View>
  );

  function renderTab(tab: typeof tabs[0]) {
    const isFocused = activeRouteName === tab.name;
    const color = isFocused ? "#4FC3F7" : "rgba(255, 255, 255, 0.5)";

    return (
      <TouchableOpacity
        key={tab.name}
        onPress={() => {
          if (isFocused) return;
          Haptics.selectionAsync();
          
          // Determine direction
          const direction = tab.index > currentIndex ? 'forward' : 'back';

          // Navigate
          if (activeRouteName !== tab.name) {
              // @ts-ignore
              navigation.navigate("MainTabs", { screen: tab.name });
          }
        }}
        style={{ alignItems: 'center', justifyContent: 'center', height: 48, minWidth: isFocused ? 100 : 60, paddingHorizontal: isFocused ? 12 : 0 }}
        activeOpacity={0.7}
      >
        {isFocused && (
          <LinearGradient
            colors={["rgba(79, 195, 247, 0.15)", "rgba(0, 168, 232, 0.05)"]}
            style={{
              position: "absolute",
              left: 0, 
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: 24, // Pill shape
              borderWidth: 1,
              borderColor: "rgba(79, 195, 247, 0.2)",
            }}
          />
        )}
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
           {isFocused ? (
            <GradientIcon
              icon={<tab.icon size={20} color="#000" strokeWidth={2.5} />}
              style={{ width: 20, height: 20 }}
            />
          ) : (
            <tab.icon size={24} color={color} strokeWidth={2} />
          )}
          
          {isFocused && (
            <GradientText style={{ fontSize: 13, fontWeight: "600", marginLeft: 8 }}>
              {tab.label}
            </GradientText>
          )}
        </View>
        
        {!isFocused && (
           <View style={{ marginTop: 2 }}>
             <Text style={{ fontSize: 10, fontWeight: "600", color: color }}>
               {tab.label}
             </Text>
           </View>
        )}
      </TouchableOpacity>
    );
  }
};
