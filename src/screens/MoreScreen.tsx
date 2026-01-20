import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Info, CircleHelp, MessageSquarePlus, Share2, UserPlus, ChevronRight, Crown } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/contexts/ThemeContext";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MoreScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();

  const MenuItem = ({ 
    icon, 
    label, 
    onPress,
    accentColor = "#4FC3F7"
  }: { 
    icon: React.ReactNode, 
    label: string, 
    onPress?: () => void,
    accentColor?: string
  }) => {
    const scale = useSharedValue(1);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <AnimatedPressable
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={[{ marginBottom: 12 }, animatedStyle]}
      >
        <View
          style={{
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: isDark ? 'rgba(25, 25, 30, 0.95)' : '#FFFFFF',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)',
            shadowColor: isDark ? '#000' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.5 : 0.06,
            shadowRadius: isDark ? 12 : 8,
            elevation: 8,
          }}
        >
          {/* Subtle top highlight for premium feel */}
          <View 
            style={{
              position: 'absolute',
              top: 0,
              left: 16,
              right: 16,
              height: 1,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.8)',
            }}
          />
          
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              paddingVertical: 14,
            }}
          >
            {/* Icon container with gradient accent */}
            <View style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 12,
              marginRight: 14,
              overflow: 'hidden',
            }}>
              <LinearGradient
                colors={isDark 
                  ? [`${accentColor}20`, `${accentColor}08`]
                  : [`${accentColor}15`, `${accentColor}05`]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: isDark ? `${accentColor}30` : `${accentColor}20`,
                  borderRadius: 12,
                }}
              >
                {icon}
              </LinearGradient>
            </View>
            
            <Text style={{ 
              flex: 1,
              color: colors.text, 
              fontSize: 16, 
              fontWeight: "500",
              letterSpacing: 0.1,
            }}>
              {label}
            </Text>
            
            <ChevronRight 
              size={20} 
              color={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)'} 
              strokeWidth={2}
            />
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  // Accent colors for each menu item
  const accentColors = {
    subscription: "#F59E0B", // Amber/Gold for premium
    feedback: "#4FC3F7",    // Cyan
    help: "#A78BFA",        // Purple
    about: "#34D399",       // Emerald
    share: "#F472B6",       // Pink
    join: "#FBBF24",        // Amber
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0C' : '#F5F5F7' }}>
      {/* Background with subtle gradient */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={isDark 
            ? ['#0A0A0C', '#0D0D12', '#08080A'] 
            : ['#F5F5F7', '#F0F0F2', '#EAEAEC']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      <ScrollView 
        contentContainerStyle={{ 
          paddingTop: insets.top + 16, 
          paddingHorizontal: 20, 
          paddingBottom: 120 
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ 
          fontSize: 34, 
          fontWeight: "700", 
          color: colors.text, 
          marginBottom: 28,
          letterSpacing: -0.5,
        }}>
          More
        </Text>

        {/* Main Section */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: "600", 
            color: colors.textSecondary, 
            marginBottom: 12,
            marginLeft: 4,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            General
          </Text>
          
          <MenuItem 
            icon={<Crown size={22} color={accentColors.subscription} />} 
            label="Subscription & Plans"
            onPress={() => navigation.getParent()?.navigate("Subscription")}
            accentColor={accentColors.subscription}
          />
          <MenuItem 
            icon={<MessageSquarePlus size={22} color={accentColors.feedback} />} 
            label="Feedback & Requests"
            onPress={() => navigation.getParent()?.navigate("Feedback")}
            accentColor={accentColors.feedback}
          />
          <MenuItem 
            icon={<CircleHelp size={22} color={accentColors.help} />} 
            label="Help & Support"
            accentColor={accentColors.help}
          />
          <MenuItem 
            icon={<Info size={22} color={accentColors.about} />} 
            label="About VibeChat"
            accentColor={accentColors.about}
          />
          <MenuItem 
            icon={<Share2 size={22} color={accentColors.share} />} 
            label="Share VibeChat"
            accentColor={accentColors.share}
          />
        </View>

        {/* Developer Section */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: "600", 
            color: colors.textSecondary, 
            marginBottom: 12,
            marginLeft: 4,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            Developer
          </Text>
          
          <MenuItem 
            icon={<UserPlus size={22} color={accentColors.join} />} 
            label="Join Chat (Temporary)"
            onPress={() => navigation.navigate("JoinChat")}
            accentColor={accentColors.join}
          />
        </View>
        
        {/* Version */}
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <Text style={{ 
            color: isDark ? 'rgba(255, 255, 255, 0.25)' : colors.textTertiary, 
            fontSize: 13,
            fontWeight: '500',
          }}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default MoreScreen;
