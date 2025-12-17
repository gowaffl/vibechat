import React, { useState } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import type { TabParamList } from "@/navigation/types";
import ChatListScreen from "@/screens/ChatListScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import MoreScreen from "@/screens/MoreScreen";
import CommunityScreen from "@/screens/CommunityScreen";
import { CustomTabBar } from "@/components/CustomTabBar";
import { forFadeTransition, transitionSpec } from "@/navigation/TransitionConfig";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";

const TabStack = createStackNavigator<TabParamList>();

export default function TabNavigator() {
  const [activeRouteName, setActiveRouteName] = useState("Chats");
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabStack.Navigator
        initialRouteName="Chats"
        screenOptions={({ route }) => ({
          headerShown: false,
          transitionSpec: transitionSpec,
          cardStyleInterpolator: (props) => {
            // Extract direction from route params
            const direction = (route.params as any)?.animationDirection;
            // The direction parameter is unused in the new fade transition but kept for compatibility
            return forFadeTransition({ ...props });
          },
          cardOverlayEnabled: true,
        })}
        screenListeners={({ route }) => ({
            focus: () => {
                setActiveRouteName(route.name);
            }
        })}
      >
        <TabStack.Screen name="Chats" component={ChatListScreen} />
        <TabStack.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{
            headerShown: true,
            headerTitle: "Profile",
            headerTransparent: true,
            headerBackground: () => (
              <BlurView
                intensity={80}
                tint={isDark ? "dark" : "light"}
                style={{
                  flex: 1,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.glassBorder,
                }}
              >
                 <View style={{ 
                    ...StyleSheet.absoluteFillObject, 
                    backgroundColor: Platform.OS === "ios" 
                      ? (isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)")
                      : (isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 255, 255, 0.85)")
                 }} />
                 <LinearGradient
                    colors={isDark 
                      ? ["rgba(79, 195, 247, 0.15)", "rgba(0, 122, 255, 0.1)", "rgba(0, 0, 0, 0)"]
                      : ["rgba(0, 122, 255, 0.05)", "rgba(79, 195, 247, 0.05)", "rgba(255, 255, 255, 0)"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, opacity: 0.5 }}
                 />
              </BlurView>
            ),
            headerTintColor: colors.text,
          }}
        />
        <TabStack.Screen name="Community" component={CommunityScreen} />
        <TabStack.Screen name="More" component={MoreScreen} />
      </TabStack.Navigator>
      
      <CustomTabBar activeRouteName={activeRouteName} />
    </View>
  );
}
