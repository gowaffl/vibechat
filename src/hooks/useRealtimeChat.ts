/**
 * useRealtimeChat - Production-ready realtime chat subscription hook
 * 
 * Features:
 * - Server-side filters for efficient message delivery
 * - Robust reconnection with exponential backoff
 * - Message gap detection and recovery
 * - Connection state monitoring
 * - Automatic cleanup on unmount
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabaseClient } from '@/lib/authClient';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@shared/contracts';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeChatOptions {
  chatId: string;
  userId: string | undefined;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  setIsAITyping?: (typing: boolean) => void;
  setTypingAIFriend?: (friend: any) => void;
}

interface ConnectionState {
  isConnected: boolean;
  retryCount: number;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
}

const MAX_RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const CONNECTION_TIMEOUT = 10000;
const GAP_RECOVERY_THRESHOLD = 5000; // 5 seconds - if we were disconnected longer, fetch missed messages

export function useRealtimeChat({
  chatId,
  userId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
  onConnectionChange,
  setIsAITyping,
  setTypingAIFriend,
}: UseRealtimeChatOptions) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    retryCount: 0,
    lastConnectedAt: null,
    lastMessageAt: null,
  });

  // Calculate exponential backoff delay
  const getRetryDelay = useCallback((retryCount: number) => {
    const delay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
      MAX_RETRY_DELAY
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, []);

  // Recover missed messages after reconnection
  const recoverMissedMessages = useCallback(async (since: string) => {
    if (!chatId || !userId) return;
    
    console.log('[Realtime] Recovering messages since:', since);
    try {
      // Fetch messages created after we disconnected
      const response = await api.get<{ messages: Message[] }>(
        `/api/chats/${chatId}/messages?userId=${userId}&since=${encodeURIComponent(since)}`
      );
      
      if (response.messages && response.messages.length > 0) {
        console.log(`[Realtime] Recovered ${response.messages.length} missed messages`);
        // Process each missed message
        response.messages.forEach((msg) => {
          onNewMessage?.(msg);
        });
      }
    } catch (error) {
      console.error('[Realtime] Failed to recover missed messages:', error);
      // Fallback: invalidate the entire messages query to force a refetch
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    }
  }, [chatId, userId, onNewMessage, queryClient]);

  // Clean up existing channel
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (channelRef.current) {
      supabaseClient.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Subscribe to chat channel
  const subscribe = useCallback(() => {
    if (!chatId || !userId) return;
    
    // Clean up existing subscription
    cleanup();
    
    console.log(`[Realtime] Subscribing to chat:${chatId}`);
    
    const channel = supabaseClient.channel(`chat:${chatId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    // Listen for new messages with server-side filter
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message',
        filter: `chatId=eq.${chatId}`,
      },
      async (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        const newData = payload.new as any;
        try {
          const isAIMessage = 
            (newData.userId === null || newData.userId === undefined) && 
            (newData.aiFriendId !== null && newData.aiFriendId !== undefined);
          
          console.log('[Realtime] New message:', newData.id, { isAIMessage });
          
          // Update last message timestamp
          setConnectionState(prev => ({
            ...prev,
            lastMessageAt: newData.createdAt,
          }));
          
          // Clear AI typing if this is an AI message
          if (isAIMessage) {
            setIsAITyping?.(false);
            setTypingAIFriend?.(null);
          }
          
          // Fetch full message details
          const message = await api.get<Message>(`/api/messages/${newData.id}`);
          if (message) {
            onNewMessage?.(message);
          }
        } catch (error) {
          console.error('[Realtime] Error processing new message:', error);
          queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
        }
      }
    );

    // Listen for message updates with server-side filter
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'message',
        filter: `chatId=eq.${chatId}`,
      },
      async (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        const newData = payload.new as any;
        console.log('[Realtime] Message updated:', newData.id);
        try {
          const message = await api.get<Message>(`/api/messages/${newData.id}`);
          if (message) {
            onMessageUpdate?.(message);
          }
        } catch (error) {
          console.error('[Realtime] Error processing message update:', error);
        }
      }
    );

    // Listen for message deletions with server-side filter
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'message',
        filter: `chatId=eq.${chatId}`,
      },
      (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        const oldData = payload.old as any;
        console.log('[Realtime] Message deleted:', oldData.id);
        onMessageDelete?.(oldData.id);
      }
    );

    // Listen for reactions with server-side filter
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'reaction',
        filter: `chatId=eq.${chatId}`,
      },
      async (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        const newData = payload.new as any;
        try {
          const message = await api.get<Message>(`/api/messages/${newData.messageId}`);
          if (message) {
            onMessageUpdate?.(message);
          }
        } catch (error) {
          console.error('[Realtime] Error processing reaction:', error);
        }
      }
    );

    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'reaction',
        filter: `chatId=eq.${chatId}`,
      },
      async (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        const oldData = payload.old as any;
        try {
          const message = await api.get<Message>(`/api/messages/${oldData.messageId}`);
          if (message) {
            onMessageUpdate?.(message);
          }
        } catch (error) {
          console.error('[Realtime] Error processing reaction deletion:', error);
        }
      }
    );

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (!connectionState.isConnected) {
        console.warn('[Realtime] Connection timeout, retrying...');
        scheduleRetry();
      }
    }, CONNECTION_TIMEOUT);

    // Subscribe and handle status changes
    channel.subscribe((status, error) => {
      console.log(`[Realtime] Status for chat:${chatId}:`, status);
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      if (status === 'SUBSCRIBED') {
        const now = new Date().toISOString();
        const wasDisconnected = connectionState.lastConnectedAt !== null;
        const disconnectionDuration = wasDisconnected 
          ? Date.now() - new Date(connectionState.lastConnectedAt!).getTime()
          : 0;
        
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          retryCount: 0,
          lastConnectedAt: now,
        }));
        
        onConnectionChange?.(true);
        
        // Recover missed messages if we were disconnected for a while
        if (wasDisconnected && disconnectionDuration > GAP_RECOVERY_THRESHOLD) {
          const recoverySince = connectionState.lastMessageAt || connectionState.lastConnectedAt!;
          recoverMissedMessages(recoverySince);
        }
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Connection error:', error);
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
        }));
        onConnectionChange?.(false);
        scheduleRetry();
      } else if (status === 'CLOSED') {
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
        }));
        onConnectionChange?.(false);
      }
    });

    channelRef.current = channel;
  }, [chatId, userId, cleanup, connectionState, onNewMessage, onMessageUpdate, onMessageDelete, onConnectionChange, setIsAITyping, setTypingAIFriend, queryClient, recoverMissedMessages]);

  // Schedule retry with exponential backoff
  const scheduleRetry = useCallback(() => {
    setConnectionState(prev => {
      if (prev.retryCount >= MAX_RETRY_COUNT) {
        console.error('[Realtime] Max retries reached, giving up');
        return prev;
      }
      
      const newRetryCount = prev.retryCount + 1;
      const delay = getRetryDelay(newRetryCount);
      
      console.log(`[Realtime] Scheduling retry ${newRetryCount}/${MAX_RETRY_COUNT} in ${Math.round(delay)}ms`);
      
      retryTimeoutRef.current = setTimeout(() => {
        subscribe();
      }, delay);
      
      return {
        ...prev,
        retryCount: newRetryCount,
      };
    });
  }, [getRetryDelay, subscribe]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[Realtime] App returned to foreground, checking connection');
        // Force reconnect when coming back to foreground
        if (!connectionState.isConnected) {
          subscribe();
        } else if (connectionState.lastConnectedAt) {
          // Check if we might have missed messages while backgrounded
          const backgroundDuration = Date.now() - new Date(connectionState.lastConnectedAt).getTime();
          if (backgroundDuration > GAP_RECOVERY_THRESHOLD) {
            const recoverySince = connectionState.lastMessageAt || connectionState.lastConnectedAt;
            recoverMissedMessages(recoverySince);
          }
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [connectionState, subscribe, recoverMissedMessages]);

  // Initial subscription and cleanup
  useEffect(() => {
    subscribe();
    
    return () => {
      cleanup();
    };
  }, [chatId, userId]); // Re-subscribe when chatId or userId changes

  // Force reconnect function (can be called externally)
  const forceReconnect = useCallback(() => {
    setConnectionState(prev => ({
      ...prev,
      retryCount: 0,
    }));
    subscribe();
  }, [subscribe]);

  return {
    isConnected: connectionState.isConnected,
    retryCount: connectionState.retryCount,
    forceReconnect,
  };
}

