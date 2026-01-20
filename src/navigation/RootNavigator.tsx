import { View, Text, Pressable, Image, Modal, Platform } from "react-native";
import { createStackNavigator, TransitionPresets } from "@react-navigation/stack";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";

import type { RootStackParamList } from "@/navigation/types";
import { forFadeTransition, transitionSpec } from "@/navigation/TransitionConfig";
import TabNavigator from "@/navigation/TabNavigator";
import ChatScreen from "@/screens/ChatScreen";
import ChatListScreen from "@/screens/ChatListScreen";
import InviteMembersScreen from "@/screens/InviteMembersScreen";
import InviteScreen from "@/screens/InviteScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import GroupSettingsScreen from "@/screens/GroupSettingsScreen";
import GroupSettingsAiFriendsScreen from "@/screens/GroupSettingsAiFriendsScreen";
import GroupSettingsWorkflowsScreen from "@/screens/GroupSettingsWorkflowsScreen";
import GroupSettingsCommandsScreen from "@/screens/GroupSettingsCommandsScreen";
import GroupSettingsMembersScreen from "@/screens/GroupSettingsMembersScreen";
import GroupSettingsMediaScreen from "@/screens/GroupSettingsMediaScreen";
import GroupSettingsLinksScreen from "@/screens/GroupSettingsLinksScreen";
import OnboardingNameScreen from "@/screens/OnboardingNameScreen";
import OnboardingPhotoScreen from "@/screens/OnboardingPhotoScreen";
import PhoneAuthScreen from "@/screens/PhoneAuthScreen";
import WelcomeScreen from "@/screens/WelcomeScreen";
import BirthdateScreen from "@/screens/BirthdateScreen";
import JoinChatScreen from "@/screens/JoinChatScreen";
import FeedbackScreen from "@/screens/FeedbackScreen";
import PersonalChatScreen from "@/screens/PersonalChatScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useTimezoneSync } from "@/hooks/useTimezoneSync";

/**
 * RootStackNavigator
 * The root navigator for the app with Phone Auth, Onboarding, Chat List, Chat and Profile screens
 */
const RootStack = createStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { user, loading, isAuthenticated } = useUser();
  const { colors } = useTheme();
  
  // Automatically sync user's timezone with their device
  useTimezoneSync();

  if (loading) {
    return null; // Or a loading screen
  }

  // Determine initial route based on auth and onboarding status
  let initialRoute: keyof RootStackParamList;
  if (!isAuthenticated) {
    initialRoute = "Welcome";
  } else if (!user?.birthdate) {
    initialRoute = "Birthdate"; 
  } else if (user?.hasCompletedOnboarding) {
    initialRoute = "MainTabs";
  } else {
    initialRoute = "OnboardingName";
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RootStack.Navigator 
        initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        // Use custom transition spec for bounce effect
        transitionSpec: transitionSpec,
        // Use custom card style interpolator for "Fade" effect
        cardStyleInterpolator: forFadeTransition,
        // Ensure background is visible for the "tray" depth effect
        cardOverlayEnabled: true,
        headerMode: 'screen',
      }}
      screenListeners={{
        transitionStart: () => {
          // Removed haptic feedback for smoother, less intrusive navigation
        },
        transitionEnd: () => {
          // Removed haptic feedback for smoother, less intrusive navigation
        },
      }}
    >
      <RootStack.Screen
        name="Welcome"
        component={WelcomeScreen}
      />
      <RootStack.Screen
        name="PhoneAuth"
        component={PhoneAuthScreen}
      />
      <RootStack.Screen
        name="Birthdate"
        component={BirthdateScreen}
        initialParams={user ? { userId: user.id, hasCompletedOnboarding: user.hasCompletedOnboarding } : undefined}
      />
      <RootStack.Screen
        name="OnboardingName"
        component={OnboardingNameScreen}
      />
      <RootStack.Screen
        name="OnboardingPhoto"
        component={OnboardingPhotoScreen}
      />
      <RootStack.Screen
        name="MainTabs"
        component={TabNavigator}
      />
      <RootStack.Screen
        name="ChatList"
        component={ChatListScreen}
      />
      <RootStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          cardStyle: { backgroundColor: colors.background },
        }}
      />
      <RootStack.Screen
        name="PersonalChat"
        component={PersonalChatScreen}
        options={{
          cardStyle: { backgroundColor: colors.background },
        }}
      />
      <RootStack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{
          headerShown: true,
          headerTitle: "Invite Members",
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
      <RootStack.Screen
        name="Invite"
        component={InviteScreen}
        options={{
          // Modal usually overrides transitions, but we want to keep the custom one unless specific behavior is needed.
          // If we want standard modal slide up, we'd use TransitionPresets.ModalSlideFromBottomIOS
          // But user requested the specific animation "Anytime a user goes from one page to the other".
          // However, for Invite, it is conceptually a modal.
          // I'll leave it with the default custom transition for consistency with the request.
          presentation: 'transparentModal', 
          cardStyle: { backgroundColor: 'transparent' },
          // We need to override the interpolator if we want a fade or different effect for this specific screen
          // For now, let's stick to the requested animation or maybe just a simple fade for Invite if it overlays?
          // "Invite" seems to be an overlay modal in the original code (presentation: 'modal').
          // Let's use a fade for the Invite screen specifically if it's a popup.
          cardStyleInterpolator: ({ current: { progress } }) => ({
            cardStyle: {
              opacity: progress,
            },
            overlayStyle: {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          }),
        }}
      />
      <RootStack.Screen
        name="JoinChat"
        component={JoinChatScreen}
        options={{
          headerShown: true,
          headerTitle: "Join Chat",
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
      <RootStack.Screen
        name="Feedback"
        component={FeedbackScreen}
      />
      <RootStack.Screen
        name="Subscription"
        component={SubscriptionScreen}
      />
      <RootStack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{
          headerShown: true,
          headerTitle: "Group Settings",
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
      <RootStack.Screen
        name="GroupSettingsAiFriends"
        component={GroupSettingsAiFriendsScreen}
        options={{
          headerShown: true,
          headerTitle: "AI Friends",
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
      <RootStack.Screen
        name="GroupSettingsWorkflows"
        component={GroupSettingsWorkflowsScreen}
        options={{
          headerShown: true,
          headerTitle: "Workflows",
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
      <RootStack.Screen
        name="GroupSettingsCommands"
        component={GroupSettingsCommandsScreen}
        options={{
          headerShown: true,
          headerTitle: "Custom Commands",
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
      <RootStack.Screen
        name="GroupSettingsMembers"
        component={GroupSettingsMembersScreen}
        options={{
          headerShown: true,
          headerTitle: "Members",
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
      <RootStack.Screen
        name="GroupSettingsMedia"
        component={GroupSettingsMediaScreen}
        options={{
          headerShown: true,
          headerTitle: "Media",
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
      <RootStack.Screen
        name="GroupSettingsLinks"
        component={GroupSettingsLinksScreen}
        options={{
          headerShown: true,
          headerTitle: "Links",
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
    </RootStack.Navigator>
    </View>
  );
};

export default RootNavigator;
