import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Image,
} from "react-native";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  TrackReferenceOrPlaceholder,
  useRoomContext,
  useParticipantContext,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { Mic, MicOff, PhoneOff, Users, Volume2 } from "lucide-react-native";
import { useUser } from "@/contexts/UserContext";

interface VoiceRoomModalProps {
  visible: boolean;
  token: string;
  serverUrl: string;
  roomName: string;
  onLeave: () => void;
}

export const VoiceRoomModal: React.FC<VoiceRoomModalProps> = ({
  visible,
  token,
  serverUrl,
  roomName,
  onLeave,
}) => {
  const { user } = useUser();

  if (!token || !serverUrl) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLeave}
    >
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        options={{
          publishDefaults: {
            audio: true,
            video: false,
          },
          adaptiveStream: true,
        }}
        onDisconnected={onLeave}
        style={{ flex: 1, backgroundColor: "#111827" }} // bg-gray-900
      >
        <RoomContent roomName={roomName} onLeave={onLeave} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </Modal>
  );
};

const RoomContent = ({
  roomName,
  onLeave,
}: {
  roomName: string;
  onLeave: () => void;
}) => {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  
  // Get all audio tracks
  const tracks = useTracks([Track.Source.Microphone]);

  const toggleMic = async () => {
    if (localParticipant.isMicrophoneEnabled) {
      await localParticipant.setMicrophoneEnabled(false);
    } else {
      await localParticipant.setMicrophoneEnabled(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View>
          <Text className="text-white text-xl font-bold">{roomName}</Text>
          <View className="flex-row items-center mt-1">
            <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
            <Text className="text-gray-400 text-sm">
              {remoteParticipants.length + 1} listening
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLeave}>
           {/* Minify button or something, for now just close/leave */}
        </TouchableOpacity>
      </View>

      {/* Participants Grid */}
      <View className="flex-1 px-4 pt-8">
        <View className="flex-row flex-wrap justify-center gap-4">
          {/* Local Participant */}
          <ParticipantView participant={localParticipant} isLocal={true} />

          {/* Remote Participants */}
          {remoteParticipants.map((p) => (
            <ParticipantView key={p.identity} participant={p} isLocal={false} />
          ))}
        </View>
      </View>

      {/* Controls */}
      <View className="bg-gray-800/80 rounded-t-3xl px-8 py-8 flex-row items-center justify-between pb-12">
        <TouchableOpacity
          onPress={toggleMic}
          className={`p-4 rounded-full ${
            localParticipant.isMicrophoneEnabled
              ? "bg-gray-700"
              : "bg-white"
          }`}
        >
          {localParticipant.isMicrophoneEnabled ? (
            <Mic size={28} color="white" />
          ) : (
            <MicOff size={28} color="black" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => room.disconnect()}
          className="bg-red-500 px-8 py-4 rounded-full flex-row items-center"
        >
          <PhoneOff size={28} color="white" className="mr-2" />
          <Text className="text-white font-bold text-lg ml-2">Leave</Text>
        </TouchableOpacity>

        <TouchableOpacity className="p-4 rounded-full bg-gray-700">
          <Volume2 size={28} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const ParticipantView = ({
  participant,
  isLocal,
}: {
  participant: any; // Type is Participant but hard to import cleanly without checking exports
  isLocal: boolean;
}) => {
  const isSpeaking = participant.isSpeaking;
  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <View className="items-center mb-6 mx-2">
      <View
        className={`w-24 h-24 rounded-full items-center justify-center bg-gray-700 mb-2 overflow-hidden border-4 ${
          isSpeaking ? "border-green-500" : "border-transparent"
        }`}
      >
        {/* Placeholder Avatar - should use user image if available via metadata/name */}
         {/* LiveKit participant.name usually has user ID or name */}
         <View className="w-full h-full items-center justify-center bg-indigo-500">
            <Text className="text-white text-3xl font-bold">
                {participant.name ? participant.name.substring(0, 1).toUpperCase() : "?"}
            </Text>
         </View>
         
         {isMuted && (
             <View className="absolute bottom-1 right-1 bg-gray-900 rounded-full p-1">
                 <MicOff size={14} color="white" />
             </View>
         )}
      </View>
      <Text className="text-white font-medium text-center">
        {isLocal ? "You" : participant.name || "Unknown"}
      </Text>
    </View>
  );
};

