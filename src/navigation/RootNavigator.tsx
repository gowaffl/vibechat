import { View, Text, Pressable, Image, Modal, Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";

import type { RootStackParamList } from "@/navigation/types";
import TabNavigator from "@/navigation/TabNavigator";
import ChatScreen from "@/screens/ChatScreen";
import ChatListScreen from "@/screens/ChatListScreen";
import InviteMembersScreen from "@/screens/InviteMembersScreen";
import InviteScreen from "@/screens/InviteScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import GroupSettingsScreen from "@/screens/GroupSettingsScreen";
import OnboardingNameScreen from "@/screens/OnboardingNameScreen";
import OnboardingPhotoScreen from "@/screens/OnboardingPhotoScreen";
import PhoneAuthScreen from "@/screens/PhoneAuthScreen";
import WelcomeScreen from "@/screens/WelcomeScreen";
import BirthdateScreen from "@/screens/BirthdateScreen";
import { useUser } from "@/contexts/UserContext";

// Custom hook to add haptic feedback on navigation
const useNavigationHaptics = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('transitionStart' as any, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

    return unsubscribe;
  }, [navigation]);
};

// Default spring animation config for all screens
const springAnimationConfig = {
  animation: 'spring' as const,
  config: {
    stiffness: 300,
    damping: 25,
    mass: 0.8,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

/**
 * RootStackNavigator
 * The root navigator for the app with Phone Auth, Onboarding, Chat List, Chat and Profile screens
 */
const RootStack = createNativeStackNavigator<RootStackParamList>();
const RootNavigator = () => {
  const { user, loading, isAuthenticated } = useUser();

  if (loading) {
    return null; // Or a loading screen
  }

  // Determine initial route based on auth and onboarding status
  let initialRoute: keyof RootStackParamList;
  if (!isAuthenticated) {
    initialRoute = "Welcome";
  } else if (!user?.birthdate) {
    // Force birthdate collection for existing users who haven't set it
    // We need to pass params, but initialRoute doesn't support params directly in this variable assignment
    // So we'll handle params in the screen component or context, or use a wrapper.
    // However, for simplicity here, we'll default to Birthdate and let the screen handle missing params if needed (it uses params for user ID)
    // Actually, BirthdateScreen relies on route params for userId. 
    // We can grab userId from context inside the screen if params are missing.
    initialRoute = "Birthdate"; 
  } else if (user?.hasCompletedOnboarding) {
    initialRoute = "MainTabs";
  } else {
    initialRoute = "OnboardingName";
  }

  return (
    <RootStack.Navigator 
      initialRouteName={initialRoute}
      screenOptions={{
        animation: 'default',
        animationTypeForReplace: 'push',
      }}
    >
      <RootStack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 400,
        }}
      />
      <RootStack.Screen
        name="PhoneAuth"
        component={PhoneAuthScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
        }}
      />
      <RootStack.Screen
        name="Birthdate"
        component={BirthdateScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
        }}
        initialParams={user ? { userId: user.id, hasCompletedOnboarding: user.hasCompletedOnboarding } : undefined}
      />
      <RootStack.Screen
        name="OnboardingName"
        component={OnboardingNameScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
        }}
      />
      <RootStack.Screen
        name="OnboardingPhoto"
        component={OnboardingPhotoScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
        }}
      />
      <RootStack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 300,
        }}
      />
      <RootStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_left',
          animationDuration: 350,
        }}
      />
      <RootStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
      <RootStack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{
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
          headerShadowVisible: false,
          headerTintColor: "#FFFFFF",
          animation: 'slide_from_bottom',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      />
      <RootStack.Screen
        name="Invite"
        component={InviteScreen}
        options={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 400,
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
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
          headerShadowVisible: false,
          headerTintColor: "#FFFFFF",
          animation: 'slide_from_right',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      />
      <RootStack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{
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
          headerShadowVisible: false,
          headerTintColor: "#FFFFFF",
          animation: 'slide_from_right',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      />
    </RootStack.Navigator>
  );
};

export default RootNavigator;
