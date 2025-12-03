import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/lib/queryClient";
import RootStackNavigator from "@/navigation/RootNavigator";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QueryClientProvider } from "@tanstack/react-query";
import { UserProvider } from "@/contexts/UserContext";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";

const linking = {
  prefixes: [
    "vibechat://",
  ],
  config: {
    screens: {
      Invite: "invite/:token",
      ChatList: "chats",
      Chat: "chat/:chatId",
    },
  },
};

export default function App() {
  const navigationRef = useRef<any>(null);
  const pendingInviteToken = useRef<string | null>(null);

  useEffect(() => {
    // Handle initial URL when app is opened from a link
    const handleInitialURL = async () => {
      try {
        // Try multiple methods to get the initial URL
        const url = await Linking.getInitialURL();

        console.log("[DeepLink] Checking for initial URL...");
        console.log("[DeepLink] getInitialURL result:", url);

        // Also try parsing the URL using Expo's parseInitialURLAsync
        const parsedUrl = await Linking.parseInitialURLAsync();
        console.log("[DeepLink] parseInitialURLAsync result:", JSON.stringify(parsedUrl));

        let inviteToken = null;

        // Try to extract invite token from either method
        if (url) {
          try {
            const urlObj = new URL(url);
            inviteToken = urlObj.searchParams.get('invite');
            console.log("[DeepLink] Token from URL object:", inviteToken);
          } catch (e) {
            console.log("[DeepLink] Error parsing URL:", e);
          }
        }

        // Also check if the parsed URL has query params
        if (parsedUrl?.queryParams?.invite) {
          inviteToken = parsedUrl.queryParams.invite as string;
          console.log("[DeepLink] Token from parsed URL:", inviteToken);
        }

        // Also check path for invite token (in case it's passed differently)
        if (parsedUrl?.path && parsedUrl.path.includes('invite')) {
          console.log("[DeepLink] Found 'invite' in path:", parsedUrl.path);
          // Try to extract token from path like /invite/abc123
          const match = parsedUrl.path.match(/invite[\/=]([a-z0-9]+)/i);
          if (match && match[1]) {
            inviteToken = match[1];
            console.log("[DeepLink] Token extracted from path:", inviteToken);
          }
        }

        if (inviteToken) {
          console.log("[DeepLink] ✅ Found invite token:", inviteToken);
          pendingInviteToken.current = inviteToken;

          // Wait for navigation to be ready
          setTimeout(() => {
            if (navigationRef.current && pendingInviteToken.current) {
              console.log("[DeepLink] 🚀 Navigating to Invite screen with token:", pendingInviteToken.current);
              navigationRef.current.navigate('Invite', { token: pendingInviteToken.current });
              pendingInviteToken.current = null;
            } else {
              console.log("[DeepLink] ⚠️ Navigation not ready, will retry on onReady");
            }
          }, 1500);
        } else {
          console.log("[DeepLink] ❌ No invite token found in URL");
        }
      } catch (error) {
        console.error("[DeepLink] Error handling initial URL:", error);
      }
    };

    handleInitialURL();

    // Handle push notifications
    const handleNotification = (response: Notifications.NotificationResponse) => {
      try {
        const data = response.notification.request.content.data;
        const chatId = data?.chatId;
        
        if (chatId && navigationRef.current) {
          console.log("[Notifications] 🚀 Navigating to chat:", chatId);
          // Get chat name from notification title if available, or fallback to "Chat"
          const chatName = response.notification.request.content.title || "Chat";
          
          navigationRef.current.navigate("Chat", { 
            chatId,
            chatName 
          });
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

    // Handle URLs when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      try {
        console.log("[DeepLink] 📩 Received URL event:", url);

        const urlObj = new URL(url);
        const inviteToken = urlObj.searchParams.get('invite');

        if (inviteToken && navigationRef.current) {
          console.log("[DeepLink] 🚀 Navigating to Invite (from event):", inviteToken);
          navigationRef.current.navigate('Invite', { token: inviteToken });
        }
      } catch (error) {
        console.error("[DeepLink] Error handling URL event:", error);
      }
    });

    return () => {
      subscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <KeyboardProvider>
          <GestureHandlerRootView>
            <SafeAreaProvider>
              <NavigationContainer
                linking={linking}
                ref={navigationRef}
                onReady={() => {
                  console.log("[Navigation] ✅ Navigation container ready");
                  // If there's a pending invite token, navigate to it now
                  if (pendingInviteToken.current && navigationRef.current) {
                    console.log("[DeepLink] 🚀 Late navigation to Invite with token:", pendingInviteToken.current);
                    setTimeout(() => {
                      if (navigationRef.current && pendingInviteToken.current) {
                        navigationRef.current.navigate('Invite', { token: pendingInviteToken.current });
                        pendingInviteToken.current = null;
                      }
                    }, 100);
                  }
                }}
                onStateChange={() => {
                  // Haptics are now handled in the navigator listeners for more precise timing
                }}
              >
                <RootStackNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </KeyboardProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
