import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { queryClient, persistOptions } from "@/lib/queryClient";
import RootStackNavigator from "@/navigation/RootNavigator";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { ToastProvider } from "@/components/Toast";
import { PostHogProvider } from "posthog-react-native";
import { POSTHOG_API_KEY, POSTHOG_HOST } from "@/config";

// React Navigation linking configuration for universal links and deep links
// This declaratively maps URL paths to screens - React Navigation handles parsing automatically
const linking = {
  prefixes: [
    "vibechat://",
    "https://vibechat-zdok.onrender.com",
  ],
  config: {
    screens: {
      // Invite screen (root level - critical for invite deep links)
      // URL: https://vibechat-zdok.onrender.com/invite/abc123 -> Invite screen with token="abc123"
      Invite: "invite/:token",
      
      // Chat screen (root level for direct deep link access)
      // URL: https://vibechat-zdok.onrender.com/chat/uuid -> Chat screen with chatId="uuid"
      Chat: "chat/:chatId",
      
      // Other deep link screens
      JoinChat: "join",
    },
  },
};

// Create a separate component for the app content to consume ThemeContext
const AppContent = () => {
  const { navTheme, isDark } = useTheme();
  const navigationRef = useRef<any>(null);
  const pendingNotification = useRef<{ chatId: string; chatName?: string; forceRefresh: boolean } | null>(null);

  useEffect(() => {
    // Note: Deep link / universal link handling is now done declaratively via the `linking` config above.
    // React Navigation automatically parses URLs and navigates to the correct screen.
    // We only need to handle push notifications manually.

    // Handle push notifications
    const handleNotification = (response: Notifications.NotificationResponse) => {
      try {
        const data = response.notification.request.content.data;
        const chatIdFromData = data?.chatId;
        // Get chat name from notification title if available, or fallback to "Chat"
        const chatName = response.notification.request.content.title || "Chat";
        
        if (chatIdFromData && typeof chatIdFromData === 'string') {
          const chatId = chatIdFromData;
          if (navigationRef.current) {
            console.log("[Notifications] 🚀 Navigating to chat:", chatId, "with forceRefresh: true");
            navigationRef.current.navigate("Chat", { 
              chatId,
              chatName,
              forceRefresh: true, // Force invalidate cache to show latest messages
            });
          } else {
            // Store for later navigation when ready
            console.log("[Notifications] ⚠️ Navigation not ready, storing pending notification for chat:", chatId);
            pendingNotification.current = { chatId, chatName, forceRefresh: true };
          }
        }
      } catch (error) {
        console.error("[Notifications] Error handling notification:", error);
      }
    };

    // Check if app was opened from a notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("[Notifications] App opened from notification (cold start)");
        // Wait a bit for navigation to be ready
        setTimeout(() => handleNotification(response), 1000);
      }
    }).catch((error) => {
      console.error("[Notifications] Error getting last notification response:", error);
    });

    // Listen for notification responses (background/foreground)
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(handleNotification);

    return () => {
      notificationSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SafeAreaProvider>
          <NavigationContainer
            linking={linking}
            theme={navTheme}
            ref={navigationRef}
            onReady={() => {
              console.log("[Navigation] ✅ Navigation container ready");
              // If there's a pending notification, navigate to it now
              if (pendingNotification.current && navigationRef.current) {
                console.log("[Notifications] 🚀 Late navigation to Chat:", pendingNotification.current.chatId);
                setTimeout(() => {
                  if (navigationRef.current && pendingNotification.current) {
                    navigationRef.current.navigate('Chat', pendingNotification.current);
                    pendingNotification.current = null;
                  }
                }, 100);
              }
            }}
            onStateChange={() => {
              // Haptics are now handled in the navigator listeners for more precise timing
            }}
          >
            <RootStackNavigator />
            <StatusBar style={isDark ? "light" : "dark"} />
          </NavigationContainer>
        </SafeAreaProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
};

export default function App() {
  // Only enable PostHog if API key is provided
  const isPostHogEnabled = POSTHOG_API_KEY && POSTHOG_API_KEY.length > 0;

  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY || "placeholder"}
      options={{
        host: POSTHOG_HOST,
        disabled: !isPostHogEnabled,
        // Disable autocapture to prevent navigation errors
        captureNativeAppLifecycleEvents: false,
      }}
      autocapture={{
        // Disable automatic screen tracking - we'll do it manually via useScreenTracking
        captureScreens: false,
        captureTouches: false,
        captureLifecycleEvents: false,
      }}
    >
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <UserProvider>
          <ThemeProvider>
            <SubscriptionProvider>
              <ToastProvider>
                <KeyboardProvider>
                  <AppContent />
                </KeyboardProvider>
              </ToastProvider>
            </SubscriptionProvider>
          </ThemeProvider>
        </UserProvider>
      </PersistQueryClientProvider>
    </PostHogProvider>
  );
}
