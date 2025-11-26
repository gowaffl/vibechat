import React from "react";
import { View, Platform, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MessageCircle, Plus, Users, User } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import type { TabParamList } from "@/navigation/types";
import ChatListScreen from "@/screens/ChatListScreen";
import CreateChatScreen from "@/screens/CreateChatScreen";
import JoinChatScreen from "@/screens/JoinChatScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { GradientIcon, BRAND_GRADIENT_COLORS } from "@/components/GradientIcon";
import { GradientText } from "@/components/GradientText";

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(0, 0, 0, 0.9)",
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "ios" ? 85 : 65,
          paddingBottom: Platform.OS === "ios" ? 30 : 10,
          paddingTop: 10,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              tint="dark"
              intensity={80}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : null,
        tabBarActiveTintColor: "#4FC3F7", // Light blue color
        tabBarInactiveTintColor: "rgba(79, 195, 247, 0.5)", // Light blue at 50% opacity
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarLabel: ({ focused, color, children }) => (
            focused ? (
                <GradientText style={{ fontSize: 11, fontWeight: "600" }}>{children}</GradientText>
            ) : (
                <Text style={{ fontSize: 11, fontWeight: "600", color }}>{children}</Text>
            )
        )
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          tabBarLabel: "Chats",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {focused && (
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
              {focused ? (
                <GradientIcon
                  icon={<MessageCircle size={size} color="#000" strokeWidth={2.5} />}
                  style={{ width: size, height: size }}
                />
              ) : (
                <MessageCircle size={size} color={color} strokeWidth={2} />
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="CreateChat"
        component={CreateChatScreen}
        options={{
          tabBarLabel: "Create",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {focused && (
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
               {focused ? (
                <GradientIcon
                  icon={<Plus size={size} color="#000" strokeWidth={3} />}
                  style={{ width: size, height: size }}
                />
              ) : (
                <Plus size={size} color={color} strokeWidth={2} />
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="JoinChat"
        component={JoinChatScreen}
        options={{
          tabBarLabel: "Join",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {focused && (
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
               {focused ? (
                <GradientIcon
                  icon={<Users size={size} color="#000" strokeWidth={2.5} />}
                  style={{ width: size, height: size }}
                />
              ) : (
                <Users size={size} color={color} strokeWidth={2} />
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {focused && (
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
               {focused ? (
                <GradientIcon
                  icon={<User size={size} color="#000" strokeWidth={2.5} />}
                  style={{ width: size, height: size }}
                />
              ) : (
                <User size={size} color={color} strokeWidth={2} />
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

