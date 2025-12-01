import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { MessageCircle, Plus, Users, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { GradientIcon } from "@/components/GradientIcon";
import { GradientText } from "@/components/GradientText";
import * as Haptics from "expo-haptics";

interface CustomTabBarProps {
  activeRouteName: string;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ activeRouteName }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const tabs = [
    { name: "Chats", label: "Chats", icon: MessageCircle, index: 0 },
    { name: "CreateChat", label: "Create", icon: Plus, index: 1 },
    { name: "JoinChat", label: "Join", icon: Users, index: 2 },
    { name: "Profile", label: "Profile", icon: User, index: 3 },
  ];

  // Helper to get current index
  const currentIndex = tabs.find(t => t.name === activeRouteName)?.index || 0;

  return (
    <View style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: Platform.OS === "ios" ? 85 : 65,
      paddingBottom: Platform.OS === "ios" ? 30 : 10,
      paddingTop: 10,
    }}>
      {/* Blur Background */}
      {Platform.OS === "ios" ? (
        <BlurView
          tint="dark"
          intensity={80}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
         <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.9)" }} />
      )}

      <View style={{
          flexDirection: 'row',
          height: '100%',
          alignItems: 'flex-start',
      }}>
        {tabs.map((tab) => {
            const isFocused = activeRouteName === tab.name;
            const color = isFocused ? "#4FC3F7" : "rgba(79, 195, 247, 0.5)";
            
            return (
                <TouchableOpacity
                    key={tab.name}
                    onPress={() => {
                        if (isFocused) return;
                        // Very light haptic feedback for tab switching
                        Haptics.selectionAsync();
                        
                        // Determine direction
                        const direction = tab.index > currentIndex ? 'forward' : 'back';

                        // Navigate to the tab (Stack Screen) with direction param
                        // @ts-ignore - automatic nested navigation
                        navigation.navigate("MainTabs", { 
                            screen: tab.name,
                            params: { animationDirection: direction }
                        });
                    }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    activeOpacity={0.7}
                >
                    {/* Icon Container with Gradient Background if focused */}
                    <View style={{ alignItems: "center", justifyContent: "center" }}>
                        {isFocused && (
                            <LinearGradient
                                colors={["rgba(79, 195, 247, 0.3)", "rgba(0, 168, 232, 0)"]}
                                style={{
                                    position: "absolute",
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                }}
                            />
                        )}
                        {isFocused ? (
                            <GradientIcon
                                icon={<tab.icon size={24} color="#000" strokeWidth={tab.name === 'CreateChat' ? 3 : 2.5} />}
                                style={{ width: 24, height: 24 }}
                            />
                        ) : (
                            <tab.icon size={24} color={color} strokeWidth={2} />
                        )}
                    </View>
                    
                    {/* Label */}
                    <View style={{ marginTop: 4 }}>
                        {isFocused ? (
                             <GradientText style={{ fontSize: 11, fontWeight: "600" }}>{tab.label}</GradientText>
                        ) : (
                             <Text style={{ fontSize: 11, fontWeight: "600", color }}>{tab.label}</Text>
                        )}
                    </View>
                </TouchableOpacity>
            )
        })}
      </View>
    </View>
  );
};
