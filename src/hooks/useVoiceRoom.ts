import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { supabaseClient } from "@/lib/authClient";
import type {
  GetActiveVoiceRoomResponse,
  JoinVoiceRoomResponse,
  VoiceRoom,
} from "@/shared/contracts";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFocusEffect } from "@react-navigation/native";

export const useVoiceRoom = (chatId: string) => {
  const { user } = useUser();
  const channelRef = useRef<RealtimeChannel | null>(null);
  
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

  // Fetch on focus (initial load and when returning to screen)
  useFocusEffect(
    useCallback(() => {
      console.log('[useVoiceRoom] Focus effect triggering fetchActiveRoom');
      fetchActiveRoom();
    }, [fetchActiveRoom])
  );

  // Subscribe to realtime updates for voice rooms
  useEffect(() => {
    if (!chatId || !user) return;

    console.log(`[useVoiceRoom] Setting up realtime subscription for chat: ${chatId}`);

    // Clean up existing channel
    if (channelRef.current) {
      supabaseClient.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabaseClient.channel(`voice-room:${chatId}`);

    // Listen for voice room INSERT (new call started)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'voice_room',
        filter: `chatId=eq.${chatId}`,
      },
      (payload: any) => {
        console.log('[useVoiceRoom] New voice room created:', payload.new.id);
        fetchActiveRoom();
      }
    );

    // Listen for voice room UPDATE (room status changed)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'voice_room',
        filter: `chatId=eq.${chatId}`,
      },
      (payload: any) => {
        console.log('[useVoiceRoom] Voice room updated:', payload.new.id, 'isActive:', payload.new.isActive);
        // If room became inactive, clear local state
        if (payload.new.isActive === false && activeRoom?.id === payload.new.id) {
          setRoomState(prev => ({ ...prev, activeRoom: null }));
          setParticipants(0);
        } else {
          fetchActiveRoom();
        }
      }
    );

    // Listen for voice participant changes (join/leave)
    channel.on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'voice_participant',
      },
      (payload: any) => {
        console.log('[useVoiceRoom] Participant change:', payload.eventType);
        // Only refresh if we have an active room
        if (activeRoom) {
          fetchActiveRoom();
        }
      }
    );

    channel.subscribe((status) => {
      console.log(`[useVoiceRoom] Subscription status for chat ${chatId}:`, status);
      if (status === 'SUBSCRIBED') {
        // Fetch initial state after successful subscription
        fetchActiveRoom();
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount or chatId change
    return () => {
      console.log(`[useVoiceRoom] Cleaning up realtime subscription for chat: ${chatId}`);
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId, user, fetchActiveRoom, activeRoom]);

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
    if (!user) return;
    
    const roomId = activeRoom?.id;
    
    // Immediately clear local state so UI updates right away
    setRoomState(prev => ({ ...prev, token: null, serverUrl: null }));
    
    if (!roomId) {
      console.log('[useVoiceRoom] No active room to leave');
      return;
    }
    
    try {
      console.log('[useVoiceRoom] Calling leave API for room:', roomId);
      // Use the correct API endpoint path: /api/voice-rooms/leave
      await api.post(`/api/voice-rooms/leave`, {
        userId: user.id,
        voiceRoomId: roomId,
      });
      console.log('[useVoiceRoom] Successfully left room:', roomId);
      
      // Refresh room status after leaving
      fetchActiveRoom();
    } catch (err) {
      console.error("[useVoiceRoom] Failed to leave room:", err);
      // Still refresh to get current state even if leave failed
      fetchActiveRoom();
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
