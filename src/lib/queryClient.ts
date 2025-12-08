import { onlineManager, QueryClient, QueryKey } from "@tanstack/react-query";
import * as Network from "expo-network";
import { mmkvPersister } from "./storage";

/**
 * Query Client Configuration for Production-Ready Messaging
 * 
 * Strategy:
 * - Messages: Aggressive caching with realtime updates (staleTime: Infinity)
 * - Chats list: Short staleTime to catch new chats
 * - User data: Medium caching with occasional refresh
 * - Unread counts: Short staleTime, relies on realtime primarily
 * 
 * gcTime (garbage collection): How long to keep inactive data in memory
 * staleTime: How long until data is considered stale and needs refresh
 */

// Query-specific stale times based on data type
const getStaleTimeForQuery = (queryKey: QueryKey): number => {
  const key = queryKey[0] as string;
  
  switch (key) {
    // Messages: Use realtime for updates, keep data fresh forever until invalidated
    case 'messages':
      return Infinity;
    
    // Chat list: Refresh every 5 minutes, realtime handles new messages
    case 'chats':
      return 5 * 60 * 1000; // 5 minutes
    
    // Unread counts: Short stale time, realtime is primary
    case 'unread-counts':
      return 30 * 1000; // 30 seconds
    
    // User profile data: Can be cached longer
    case 'user':
    case 'currentUser':
      return 10 * 60 * 1000; // 10 minutes
    
    // Chat members: Refresh every 2 minutes
    case 'chatMembers':
      return 2 * 60 * 1000; // 2 minutes
    
    // AI friends: Can be cached longer
    case 'aiFriends':
      return 5 * 60 * 1000; // 5 minutes
    
    // Custom commands: Cached longer, rarely change
    case 'customCommands':
      return 10 * 60 * 1000; // 10 minutes
    
    // Events: Medium caching
    case 'events':
      return 2 * 60 * 1000; // 2 minutes
    
    // Polls: Medium caching
    case 'polls':
      return 2 * 60 * 1000; // 2 minutes
    
    // Default: 5 minutes
    default:
      return 5 * 60 * 1000;
  }
};

// Query-specific garbage collection times
const getGcTimeForQuery = (queryKey: QueryKey): number => {
  const key = queryKey[0] as string;
  
  switch (key) {
    // Messages: Keep in memory for 1 hour (user might scroll back)
    case 'messages':
      return 60 * 60 * 1000; // 1 hour
    
    // Chat list: Keep for 30 minutes
    case 'chats':
      return 30 * 60 * 1000; // 30 minutes
    
    // Unread counts: Keep for 5 minutes only
    case 'unread-counts':
      return 5 * 60 * 1000; // 5 minutes
    
    // User data: Keep for 2 hours
    case 'user':
    case 'currentUser':
      return 2 * 60 * 60 * 1000; // 2 hours
    
    // Default: 24 hours (matches persist maxAge)
    default:
      return 24 * 60 * 60 * 1000; // 24 hours
  }
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // These are overridden per-query using queryFn options
      gcTime: 24 * 60 * 60 * 1000, // 24 hours default
      staleTime: 5 * 60 * 1000, // 5 minutes default
      // Retry configuration for resilience
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Network mode for better offline support
      networkMode: 'offlineFirst',
      // Prevent refetch storms
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// Set query defaults for specific query keys
queryClient.setQueryDefaults(['messages'], {
  staleTime: Infinity,
  gcTime: 60 * 60 * 1000, // 1 hour
});

queryClient.setQueryDefaults(['chats'], {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
});

queryClient.setQueryDefaults(['unread-counts'], {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 5 * 60 * 1000, // 5 minutes
});

queryClient.setQueryDefaults(['user'], {
  staleTime: 10 * 60 * 1000, // 10 minutes
  gcTime: 2 * 60 * 60 * 1000, // 2 hours
});

queryClient.setQueryDefaults(['chatMembers'], {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
});

queryClient.setQueryDefaults(['aiFriends'], {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 60 * 60 * 1000, // 1 hour
});

// Monitor network state changes
onlineManager.setEventListener((setOnline) => {
  const eventSubscription = Network.addNetworkStateListener((state) => {
    const isOnline = !!state.isConnected;
    setOnline(isOnline);
    
    // When coming back online, refetch stale queries
    if (isOnline) {
      console.log('[QueryClient] Network reconnected, refetching stale queries');
      queryClient.invalidateQueries({
        predicate: (query) => query.state.isInvalidated,
      });
    }
  });
  return eventSubscription.remove;
});

export const persistOptions = {
  persister: mmkvPersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // Persist for 7 days
  buster: 'v2', // Increment to clear cache on schema changes (bumped for optimization)
  // Don't persist certain queries that should always be fresh
  dehydrateOptions: {
    shouldDehydrateQuery: (query: any) => {
      const key = query.queryKey[0] as string;
      // Don't persist unread counts (should always be fresh)
      if (key === 'unread-counts') return false;
      // Don't persist typing indicators
      if (key === 'typing') return false;
      return true;
    },
  },
};

// Export utility functions for manual cache management
export const clearAllCache = () => {
  queryClient.clear();
};

export const invalidateMessagesCache = (chatId?: string) => {
  if (chatId) {
    queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  }
};

export const invalidateChatsCache = () => {
  queryClient.invalidateQueries({ queryKey: ['chats'] });
};

export const prefetchMessages = async (chatId: string, userId: string, limit = 50) => {
  const { api } = await import('./api');
  return queryClient.prefetchQuery({
    queryKey: ['messages', chatId],
    queryFn: () => api.get(`/api/chats/${chatId}/messages?userId=${userId}&limit=${limit}`),
    staleTime: Infinity,
  });
};

export { queryClient, getStaleTimeForQuery, getGcTimeForQuery };
