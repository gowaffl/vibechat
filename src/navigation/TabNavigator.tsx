import React, { useState } from "react";
import { View, Platform } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import type { TabParamList } from "@/navigation/types";
import ChatListScreen from "@/screens/ChatListScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import MoreScreen from "@/screens/MoreScreen";
import { CustomTabBar } from "@/components/CustomTabBar";
import { forFadeTransition, transitionSpec } from "@/navigation/TransitionConfig";
import { LinearGradient } from "expo-linear-gradient";

const TabStack = createStackNavigator<TabParamList>();

export default function TabNavigator() {
  const [activeRouteName, setActiveRouteName] = useState("Chats");

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
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
              <LinearGradient
                colors={["rgba(0, 0, 0, 0.95)", "rgba(0, 0, 0, 0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ flex: 1 }}
              />
            ),
            headerTintColor: "#FFFFFF",
          }}
        />
        <TabStack.Screen name="More" component={MoreScreen} />
      </TabStack.Navigator>
      
      <CustomTabBar activeRouteName={activeRouteName} />
    </View>
  );
}
