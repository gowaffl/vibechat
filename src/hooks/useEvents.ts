import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Event,
  CreateEventRequest,
  VoteEventOptionRequest,
  RsvpEventRequest,
  UpdateEventRequest,
  DeleteEventResponse,
} from "@shared/contracts";

export function useEvents(chatId: string, userId: string) {
  const queryClient = useQueryClient();

  // Get all events for a chat
  const {
    data: events,
    isLoading,
    refetch,
  } = useQuery<Event[]>({
    queryKey: ["events", chatId],
    queryFn: async () => {
      return api.get<Event[]>(`/api/events/${chatId}?userId=${userId}`);
    },
  });

  // Create event
  const createEventMutation = useMutation({
    mutationFn: async (request: Omit<CreateEventRequest, "chatId" | "creatorId">) => {
      console.log("[useEvents] Creating event with request:", { chatId, creatorId: userId, ...request });
      const result = await api.post<Event>("/api/events", {
        chatId,
        creatorId: userId,
        ...request,
      });
      console.log("[useEvents] Event created successfully:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[useEvents] onSuccess called, invalidating queries for chatId:", chatId);
      console.log("[useEvents] Created event data:", data);
      queryClient.invalidateQueries({ queryKey: ["events", chatId] });
    },
    onError: (error) => {
      console.error("[useEvents] Failed to create event:", error);
    },
  });

  // Vote on event option
  const voteMutation = useMutation({
    mutationFn: async ({
      eventId,
      optionId,
    }: {
      eventId: string;
      optionId: string;
    }) => {
      return api.post<Event>(`/api/events/${eventId}/vote`, {
        userId,
        optionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", chatId] });
    },
  });

  // RSVP to event
  const rsvpMutation = useMutation({
    mutationFn: async ({
      eventId,
      responseType,
      optionId,
    }: {
      eventId: string;
      responseType: "yes" | "no" | "maybe";
      optionId?: string;
    }) => {
      return api.post<Event>(`/api/events/${eventId}/rsvp`, {
        userId,
        responseType,
        optionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", chatId] });
    },
  });

  // Update event
  const updateEventMutation = useMutation({
    mutationFn: async ({
      eventId,
      ...updates
    }: Omit<UpdateEventRequest, "userId"> & { eventId: string }) => {
      return api.patch<Event>(`/api/events/${eventId}`, {
        userId,
        ...updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", chatId] });
    },
  });

  // Delete event
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      console.log("[useEvents] Deleting event:", eventId);
      return api.delete<DeleteEventResponse>(`/api/events/${eventId}?userId=${userId}`);
    },
    onSuccess: (data) => {
      console.log("[useEvents] Event deleted successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["events", chatId] });
    },
    onError: (error) => {
      console.error("[useEvents] Failed to delete event:", error);
    },
  });

  // Export event to calendar
  const exportEvent = async (
    eventId: string,
    format: "ics" | "google" | "outlook" = "ics"
  ) => {
    return api.get<{ url?: string; icsData?: string }>(`/api/events/${eventId}/export?userId=${userId}&format=${format}`);
  };

  return {
    events: events || [],
    isLoading,
    refetch,
    createEvent: createEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
    rsvp: rsvpMutation.mutate,
    isRsvping: rsvpMutation.isPending,
    updateEvent: updateEventMutation.mutate,
    isUpdating: updateEventMutation.isPending,
    deleteEvent: deleteEventMutation.mutate,
    isDeleting: deleteEventMutation.isPending,
    exportEvent,
  };
}

