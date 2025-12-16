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
  const [roomState, setRoomState] = useState<{
    token: string | null;
    serverUrl: string | null;
    activeRoom: VoiceRoom | null;
  }>({
    token: null,
    serverUrl: null,
    activeRoom: null,
  });
  
  const [participants, setParticipants] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const { token, serverUrl, activeRoom } = roomState;

  const fetchActiveRoom = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get<GetActiveVoiceRoomResponse>(
        `/api/voice-rooms/${chatId}/active?userId=${user.id}`
      );
      if (response) {
        setRoomState(prev => ({ ...prev, activeRoom: response }));
        setParticipants(response.participants.length);
      } else {
        setRoomState(prev => ({ ...prev, activeRoom: null }));
        setParticipants(0);
      }
    } catch (err) {
      console.error("[useVoiceRoom] Failed to fetch active room:", err);
    }
  }, [chatId, user]);

  // Poll for active room status every 30 seconds or on focus
  useFocusEffect(
    useCallback(() => {
      console.log('[useVoiceRoom] Focus effect triggering fetchActiveRoom');
      fetchActiveRoom();
      // Disable polling for now to debug state issues
      // const interval = setInterval(fetchActiveRoom, 30000);
      // return () => clearInterval(interval);
    }, [fetchActiveRoom])
  );

  const createRoom = async (name?: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Use the correct API endpoint path with 10 second timeout for faster feedback
      const response = await api.post<JoinVoiceRoomResponse>(
        `/api/voice-rooms/join`,
        { chatId, userId: user.id, name },
        10000 // 10 second timeout
      );
      
      setRoomState({
        token: response.token,
        serverUrl: response.serverUrl || null,
        activeRoom: response.room
      });
      return response;
    } catch (err: any) {
      console.error("[useVoiceRoom] Failed to create/join room:", err);
      
      // Provide user-friendly error messages
              if (err.message?.includes('timeout') || err.message?.includes('AbortError')) {
                setError('Connection timeout - please try again');
              } else {
                setError(err.message || "Failed to join Vibe Call");
              }
              throw err;
            } finally {
              setLoading(false);
            }
  };

  const joinRoom = async () => {
    if (!user) return;
    console.log('[useVoiceRoom] Starting joinRoom...');
    setIsJoining(true);
    setError(null);
    try {
      // Use the correct API endpoint path with 10 second timeout for faster feedback
      const response = await api.post<JoinVoiceRoomResponse>(
        `/api/voice-rooms/join`,
        { chatId, userId: user.id },
        10000 // 10 second timeout
      );
      console.log('[useVoiceRoom] API response received:', {
        hasToken: !!response.token,
        hasServerUrl: !!response.serverUrl,
        tokenLength: response.token?.length,
        serverUrl: response.serverUrl
      });
      
      setRoomState({
        token: response.token,
        serverUrl: response.serverUrl || null,
        activeRoom: response.room
      });
      
      console.log('[useVoiceRoom] State updated - Token:', !!response.token, 'ServerUrl:', !!response.serverUrl);
      return response;
    } catch (err: any) {
      console.error("[useVoiceRoom] Failed to join room:", err);
      
      // Provide user-friendly error messages
              if (err.message?.includes('timeout') || err.message?.includes('AbortError')) {
                setError('Connection timeout - please try again');
              } else {
                setError(err.message || "Failed to join Vibe Call");
              }
              throw err;
            } finally {
              setIsJoining(false);
      console.log('[useVoiceRoom] joinRoom completed, isJoining set to false');
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
      setRoomState(prev => ({ ...prev, token: null, serverUrl: null }));
      // We don't necessarily clear activeRoom here as it might still be active for others,
      // but we should probably refresh status.
      fetchActiveRoom();
    } catch (err) {
      console.error("[useVoiceRoom] Failed to leave room:", err);
    }
  };

  // Debug: Log when token/serverUrl change
  useEffect(() => {
    console.log('[useVoiceRoom] Hook state changed - Token:', !!token, 'ServerUrl:', !!serverUrl, 'isJoining:', isJoining);
  }, [token, serverUrl, isJoining]);

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
