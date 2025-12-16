import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import type {
  GetActiveVoiceRoomResponse,
  JoinVoiceRoomResponse,
  VoiceRoom,
} from "@/shared/contracts";
import { useFocusEffect } from "@react-navigation/native";

export const useVoiceRoom = (chatId: string) => {
  const { user } = useUser();
  const [activeRoom, setActiveRoom] = useState<VoiceRoom | null>(null);
  const [participants, setParticipants] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const fetchActiveRoom = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get<GetActiveVoiceRoomResponse>(
        `/api/voice-rooms/${chatId}/active?userId=${user.id}`
      );
      if (response) {
        setActiveRoom(response);
        setParticipants(response.participants.length);
      } else {
        setActiveRoom(null);
        setParticipants(0);
      }
    } catch (err) {
      console.error("[useVoiceRoom] Failed to fetch active room:", err);
      // Don't set global error for this as it might just be no room
    }
  }, [chatId, user]);

  // Poll for active room status every 30 seconds or on focus
  useFocusEffect(
    useCallback(() => {
      fetchActiveRoom();
      const interval = setInterval(fetchActiveRoom, 30000);
      return () => clearInterval(interval);
    }, [fetchActiveRoom])
  );

  const createRoom = async (name?: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Use the correct API endpoint path: /api/voice-rooms/join
      // The chatId is passed in the body, as defined in joinVoiceRoomRequestSchema
      const response = await api.post<JoinVoiceRoomResponse>(
        `/api/voice-rooms/join`,
        { chatId, userId: user.id, name }
      );
      
      setToken(response.token);
      if (response.serverUrl) setServerUrl(response.serverUrl);
      setActiveRoom(response.room);
      return response;
    } catch (err: any) {
      console.error("[useVoiceRoom] Failed to create/join room:", err);
      setError(err.message || "Failed to join voice room");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!user) return;
    setIsJoining(true);
    setError(null);
    try {
      // Use the correct API endpoint path: /api/voice-rooms/join
      const response = await api.post<JoinVoiceRoomResponse>(
        `/api/voice-rooms/join`,
        { chatId, userId: user.id }
      );
      setToken(response.token);
      if (response.serverUrl) setServerUrl(response.serverUrl);
      setActiveRoom(response.room);
      return response;
    } catch (err: any) {
      console.error("[useVoiceRoom] Failed to join room:", err);
      setError(err.message || "Failed to join voice room");
      throw err;
    } finally {
      setIsJoining(false);
    }
  };

  const leaveRoom = async () => {
    if (!user || !activeRoom) return;
    try {
      // Use the correct API endpoint path: /api/voice-rooms/leave
      await api.post(`/api/voice-rooms/leave`, {
        userId: user.id,
        voiceRoomId: activeRoom.id,
      });
      setToken(null);
      setServerUrl(null);
      // We don't necessarily clear activeRoom here as it might still be active for others,
      // but we should probably refresh status.
      fetchActiveRoom();
    } catch (err) {
      console.error("[useVoiceRoom] Failed to leave room:", err);
    }
  };

  return {
    activeRoom,
    participants,
    loading,
    error,
    token,
    serverUrl,
    isJoining,
    fetchActiveRoom,
    createRoom,
    joinRoom,
    leaveRoom,
  };
};
