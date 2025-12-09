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
 * Calculate total unread message count for a user across all chats
 */
async function getTotalUnreadCount(userId: string): Promise<number> {
  try {
    // Use the optimized RPC function that correctly handles joinedAt time
    const { data, error } = await db.rpc("get_unread_counts", { p_user_id: userId });

    if (error) {
      console.error("[Push] Error calling get_unread_counts RPC:", error);
      return 0;
    }

    if (!data) return 0;

    // Sum up unread counts from all chats
    const total = data.reduce((sum: number, row: any) => sum + Number(row.unread_count), 0);
    return total;
  } catch (error) {
    console.error("[Push] Error calculating total unread count:", error);
    return 0;
  }
}

/**
 * Send a push notification to a specific user about a new message
 */
export async function sendPushNotification(params: SendPushNotificationParams): Promise<void> {
  const { userId, chatId, chatName, senderName, messagePreview } = params;

  try {
    // Get the user's push token and notification preferences
    const { data: user } = await db
      .from('user')
      .select('pushToken, pushNotificationsEnabled')
      .eq('id', userId)
      .single();

    // Check if user has push notifications enabled and has a valid token
    if (!user || !user.pushNotificationsEnabled || !user.pushToken) {
      return;
    }

    // Check if the push token is valid
    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`[Push] Invalid Expo push token for user ${userId}: ${user.pushToken}`);
      return;
    }

    // Calculate actual total unread count for accurate badge
    const totalUnreadCount = await getTotalUnreadCount(userId);

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
      // Show actual unread count on app icon badge
      badge: totalUnreadCount,
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
          await db
            .from('user')
            .update({ pushToken: null })
            .eq('id', userId);
            
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
    const { data: members } = await db
      .from('chat_member')
      .select('userId, isMuted')
      .eq('chatId', params.chatId)
      .neq('userId', params.senderId);

    if (!members) return;

    // Send notification to each member who hasn't muted the chat
    await Promise.all(
      members.map((member: any) => {
        if (member.isMuted) return Promise.resolve(); // Skip if muted

        return sendPushNotification({
          userId: member.userId,
          chatId: params.chatId,
          chatName: params.chatName,
          senderName: params.senderName,
          messagePreview: params.messagePreview,
        });
      })
    );
  } catch (error) {
    console.error("[Push] Error sending chat push notifications:", error);
  }
}
