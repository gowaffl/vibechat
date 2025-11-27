import React, { useState } from "react";
import { View, Platform } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import type { TabParamList } from "@/navigation/types";
import ChatListScreen from "@/screens/ChatListScreen";
import CreateChatScreen from "@/screens/CreateChatScreen";
import JoinChatScreen from "@/screens/JoinChatScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { CustomTabBar } from "@/components/CustomTabBar";
import { forTrayTransition, transitionSpec } from "@/navigation/TransitionConfig";

const TabStack = createStackNavigator<TabParamList>();

export default function TabNavigator() {
  const [activeRouteName, setActiveRouteName] = useState("Chats");

  return (
    <View style={{ flex: 1 }}>
      <TabStack.Navigator
        initialRouteName="Chats"
        screenOptions={({ route }) => ({
          headerShown: false,
          transitionSpec: transitionSpec,
          cardStyleInterpolator: (props) => {
            // Extract direction from route params
            const direction = (route.params as any)?.animationDirection;
            return forTrayTransition({ ...props, direction });
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
        <TabStack.Screen name="CreateChat" component={CreateChatScreen} />
        <TabStack.Screen name="JoinChat" component={JoinChatScreen} />
        <TabStack.Screen name="Profile" component={ProfileScreen} />
      </TabStack.Navigator>
      
      <CustomTabBar activeRouteName={activeRouteName} />
    </View>
  );
}
