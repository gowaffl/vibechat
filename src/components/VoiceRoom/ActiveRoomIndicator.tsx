import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Mic } from "lucide-react-native";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import clsx from "clsx";

interface ActiveRoomIndicatorProps {
  chatId: string;
  onJoinPress: () => void;
}

export const ActiveRoomIndicator: React.FC<ActiveRoomIndicatorProps> = ({
  chatId,
  onJoinPress,
}) => {
  const { activeRoom, participants } = useVoiceRoom(chatId);

  if (!activeRoom) {
    return null;
  }

  return (
    <View className="px-4 py-2">
      <TouchableOpacity
        onPress={onJoinPress}
        className="flex-row items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl p-3"
      >
        <View className="flex-row items-center gap-3">
          <View className="bg-green-500 rounded-full p-2">
            <Mic size={20} color="white" />
          </View>
          <View>
            <Text className="text-white font-bold text-base">
              Live Voice Chat
            </Text>
            <Text className="text-gray-300 text-xs">
              {participants} {participants === 1 ? "person" : "people"} active
            </Text>
          </View>
        </View>

        <View className="bg-green-500 px-4 py-2 rounded-full">
          <Text className="text-white font-bold text-sm">Join</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

