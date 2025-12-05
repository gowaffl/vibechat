import { onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { mmkvPersister } from "./storage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: Infinity, // Assume data is fresh until invalidated or updated via realtime
    },
  },
});

onlineManager.setEventListener((setOnline) => {
  const eventSubscription = Network.addNetworkStateListener((state) => {
    setOnline(!!state.isConnected);
  });
  return eventSubscription.remove;
});

export const persistOptions = {
  persister: mmkvPersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // Persist for 7 days
  buster: 'v1', // Increment to clear cache on schema changes
};

export { queryClient };
