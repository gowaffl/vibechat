import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { db } from "../db";

// Create a new Expo SDK client
const expo = new Expo();

interface SendPushNotificationParams {
  userId: string;
  chatId: string;
  chatName: string;
  senderName: string;
  messagePreview: string;
}

/**
 * Send a push notification to a specific user about a new message
 */
export async function sendPushNotification(params: SendPushNotificationParams): Promise<void> {
  const { userId, chatId, chatName, senderName, messagePreview } = params;

  try {
    // Get the user's push token and notification preferences
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        pushToken: true,
        pushNotificationsEnabled: true,
      },
    });

    // Check if user has push notifications enabled and has a valid token
    if (!user || !user.pushNotificationsEnabled || !user.pushToken) {
      return;
    }

    // Check if the push token is valid
    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`[Push] Invalid Expo push token for user ${userId}: ${user.pushToken}`);
      return;
    }

    // Create the push notification message
    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: "default",
      title: chatName,
      body: `${senderName}: ${messagePreview}`,
      data: {
        chatId,
        type: "new_message",
      },
      // High priority for message notifications
      priority: "high",
      // Show badge on app icon
      badge: 1,
    };

    // Send the push notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("[Push] Error sending push notification chunk:", error);
      }
    }

    // Log success
    console.log(`[Push] Sent notification to user ${userId} for chat ${chatId}`);

    // Check for errors in tickets
    for (const ticket of tickets) {
      if (ticket.status === "error") {
        console.error(`[Push] Error in ticket: ${ticket.message}`);
        if (ticket.details?.error === "DeviceNotRegistered") {
          // Clear the invalid push token
          await db.user.update({
            where: { id: userId },
            data: { pushToken: null },
          });
          console.log(`[Push] Cleared invalid push token for user ${userId}`);
        }
      }
    }
  } catch (error) {
    console.error("[Push] Error sending push notification:", error);
  }
}

/**
 * Send push notifications to all members of a chat except the sender
 */
export async function sendChatPushNotifications(params: {
  chatId: string;
  chatName: string;
  senderId: string;
  senderName: string;
  messagePreview: string;
}): Promise<void> {
  try {
    // Get all members of the chat except the sender
    const members = await db.chatMember.findMany({
      where: {
        chatId: params.chatId,
        userId: { not: params.senderId },
      },
      select: { userId: true },
    });

    // Send notification to each member
    await Promise.all(
      members.map((member) =>
        sendPushNotification({
          userId: member.userId,
          chatId: params.chatId,
          chatName: params.chatName,
          senderName: params.senderName,
          messagePreview: params.messagePreview,
        })
      )
    );
  } catch (error) {
    console.error("[Push] Error sending chat push notifications:", error);
  }
}
