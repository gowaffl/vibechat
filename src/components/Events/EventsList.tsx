import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import EventCard from "./EventCard";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import type { Event } from "@shared/contracts";

interface EventsListProps {
  events: Event[];
  currentUserId: string;
  onVote: (eventId: string, optionId: string) => void;
  onRSVP: (eventId: string, responseType: "yes" | "no" | "maybe") => void;
  onExport: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onEdit?: (event: Event) => void;
  onFinalize?: (eventId: string) => void;
  isLoading?: boolean;
}

const EventsList: React.FC<EventsListProps> = ({
  events,
  currentUserId,
  onVote,
  onRSVP,
  onExport,
  onDelete,
  onEdit,
  onFinalize,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <View style={{ alignItems: "center", padding: 32 }}>
        <LuxeLogoLoader size="large" />
        <Text
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          Loading events...
        </Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={{ alignItems: "center", padding: 32 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: "rgba(0, 122, 255, 0.15)",
              borderWidth: 2,
              borderColor: "#0A84FF",
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 17,
            fontWeight: "600",
            color: "rgba(255, 255, 255, 0.9)",
            marginBottom: 6,
          }}
        >
          No Events Yet
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "rgba(255, 255, 255, 0.6)",
            textAlign: "center",
          }}
        >
          Create an event to plan something with your group
        </Text>
      </View>
    );
  }

  // Group events by status
  const activeEvents = events.filter(
    (e) => e.status === "proposed" || e.status === "voting" || e.status === "confirmed"
  );
  const cancelledEvents = events.filter((e) => e.status === "cancelled");

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {activeEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          currentUserId={currentUserId}
          onVote={(optionId) => onVote(event.id, optionId)}
          onRSVP={(responseType) => onRSVP(event.id, responseType)}
          onExport={() => onExport(event.id)}
          onDelete={() => onDelete(event.id)}
          onEdit={onEdit ? () => onEdit(event) : undefined}
          onFinalize={onFinalize ? () => onFinalize(event.id) : undefined}
        />
      ))}

      {cancelledEvents.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: "rgba(255, 255, 255, 0.5)",
              marginTop: 16,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}
          >
            CANCELLED
          </Text>
          {cancelledEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUserId={currentUserId}
              onVote={(optionId) => onVote(event.id, optionId)}
              onRSVP={(responseType) => onRSVP(event.id, responseType)}
              onExport={() => onExport(event.id)}
              onDelete={() => onDelete(event.id)}
              isCompact
            />
          ))}
        </>
      )}
    </ScrollView>
  );
};

export default EventsList;

