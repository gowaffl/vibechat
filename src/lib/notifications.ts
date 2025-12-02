import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// HIGH-7: Track the currently active chatId to suppress notifications for it
let activeChatId: string | null = null;

/**
 * Set the currently active chat to suppress its notifications
 */
export function setActiveChatId(chatId: string | null) {
  activeChatId = chatId;
}

/**
 * Get the currently active chat ID
 */
export function getActiveChatId(): string | null {
  return activeChatId;
}

// Configure how notifications should be displayed when app is foregrounded
// HIGH-7: Suppress notifications for the currently active chat
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Get the chatId from the notification data
    const notificationChatId = notification.request.content.data?.chatId as string | undefined;
    
    // If this notification is for the currently active chat, suppress it
    if (notificationChatId && notificationChatId === activeChatId) {
      console.log("[Notifications] Suppressing notification for active chat:", notificationChatId);
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }
    
    // Show notification for other chats
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * Register for push notifications and upload token to backend
 */
export async function registerForPushNotificationsAsync(
  userId: string
): Promise<string | null> {
  let token: string | null = null;

  // Only physical devices can receive push notifications
  if (!Device.isDevice) {
    console.log("[Notifications] Push notifications only work on physical devices");
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Permission not granted
    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission not granted for push notifications");
      return null;
    }

    // Get the Expo Push Token
    // Note: projectId must be a valid UUID from an EAS project
    // Try multiple possible locations for the projectId
    let projectId = Constants.expoConfig?.extra?.eas?.projectId;

    // Fallback checks
    if (!projectId) {
      projectId = Constants.easConfig?.projectId;
    }
    if (!projectId) {
      // @ts-ignore - Check manifest2 for older Expo SDK versions
      projectId = Constants.manifest2?.extra?.eas?.projectId;
    }

    // If no valid projectId found, skip push notification registration
    // This is expected in development/sandbox environments
    if (!projectId) {
      console.log(
        "[Notifications] No EAS projectId found. Push notifications are disabled in development mode."
      );
      console.log("[Notifications] Unread badges and read receipts will still work!");
      return null;
    }

    console.log("[Notifications] Using projectId:", projectId);

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    token = tokenData.data;

    console.log("[Notifications] Got push token:", token);

    // Register token with backend
    try {
      await api.post(`/api/users/${userId}/push-token`, { pushToken: token });
      console.log("[Notifications] Token registered with backend");
    } catch (error) {
      console.error("[Notifications] Failed to register token with backend:", error);
    }

    // Set notification channel for Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4FC3F7",
      });
    }

    return token;
  } catch (error) {
    console.error("[Notifications] Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Update notification preferences on the backend
 */
export async function updateNotificationPreferences(
  userId: string,
  enabled: boolean
): Promise<boolean> {
  try {
    await api.patch(`/api/users/${userId}/notifications`, {
      pushNotificationsEnabled: enabled,
    });
    console.log(`[Notifications] Preferences updated: ${enabled}`);
    return true;
  } catch (error) {
    console.error("[Notifications] Failed to update preferences:", error);
    return false;
  }
}

/**
 * Set up notification response listener (for when user taps notification)
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Set up notification received listener (for when notification arrives while app is open)
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Clear all notifications badges
 */
export async function clearBadgeCount() {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Set the app icon badge to a specific count
 */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
