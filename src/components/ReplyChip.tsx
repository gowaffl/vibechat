import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Message, AIFriend } from "@shared/contracts";
import { getFullImageUrl } from "@/utils/imageHelpers";

interface ReplyChipProps {
  replyToMessage: Message;
  replyMessage: Message; // The message that contains the reply
  isCurrentUser: boolean;
  onPress: (original: Message, reply: Message) => void;
  aiFriends: AIFriend[];
}

export const ReplyChip: React.FC<ReplyChipProps> = ({
  replyToMessage,
  replyMessage,
  isCurrentUser,
  onPress,
  aiFriends,
}) => {
  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd(() => {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          runOnJS(onPress)(replyToMessage, replyMessage);
        }),
    [replyToMessage, replyMessage, onPress]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={{
          marginLeft: isCurrentUser ? 0 : 4,
          marginRight: isCurrentUser ? 4 : 0,
          marginBottom: 4,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 12,
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          borderLeftWidth: 3,
          borderLeftColor: isCurrentUser ? "#007AFF" : "#8E8E93",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          maxWidth: "100%",
          alignSelf: isCurrentUser ? "flex-end" : "flex-start",
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: isCurrentUser ? "#60A5FA" : "#9CA3AF",
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {replyToMessage.aiFriendId
            ? replyToMessage.aiFriend?.name ||
              aiFriends.find((f) => f.id === replyToMessage.aiFriendId)?.name ||
              "AI Friend"
            : replyToMessage.user?.name || "Unknown User"}
        </Text>

        {replyToMessage.messageType === "image" ? (
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {replyToMessage.imageUrl && (
              <Image
                key={`replychip-${replyToMessage.id}-${replyToMessage.imageUrl}`}
                source={{ uri: getFullImageUrl(replyToMessage.imageUrl) }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  marginRight: 6,
                }}
                contentFit="cover"
              />
            )}
            <Text style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.8)" }}>
              Photo
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.8)",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {replyToMessage.content}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

