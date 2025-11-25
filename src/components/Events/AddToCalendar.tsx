import React, { useState } from "react";
import { View, Text, Pressable, Alert, Platform, Linking } from "react-native";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import { Calendar as CalendarIcon, CalendarPlus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

interface AddToCalendarProps {
  eventTitle: string;
  eventDescription?: string | null;
  eventDate: Date;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: "default" | "prominent" | "compact";
}

const AddToCalendar: React.FC<AddToCalendarProps> = ({
  eventTitle,
  eventDescription,
  eventDate,
  onSuccess,
  onError,
  variant = "default",
}) => {
  const [isAdding, setIsAdding] = useState(false);

  const addToAppleCalendar = async () => {
    try {
      setIsAdding(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Request calendar permissions
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Calendar permission is needed to add events to your calendar."
        );
        onError?.("Calendar permission denied");
        return;
      }

      // Get the default calendar (or create one if needed)
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (cal) => cal.allowsModifications && cal.source.name === "Default"
      ) || calendars.find((cal) => cal.allowsModifications);

      if (!defaultCalendar) {
        Alert.alert("Error", "No modifiable calendar found on your device.");
        onError?.("No modifiable calendar found");
        return;
      }

      // Calculate end time (1 hour after start by default)
      const endDate = new Date(eventDate);
      endDate.setHours(endDate.getHours() + 1);

      // Create the calendar event
      const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
        title: eventTitle,
        notes: eventDescription || undefined,
        startDate: eventDate,
        endDate: endDate,
        timeZone: "GMT",
      });

      console.log("[AddToCalendar] Event created with ID:", eventId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Event added to your calendar!");
      onSuccess?.();
    } catch (error) {
      console.error("[AddToCalendar] Error adding to Apple Calendar:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to add event to calendar. Please try again.");
      onError?.(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsAdding(false);
    }
  };

  const addToGoogleCalendar = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Format dates for Google Calendar URL
      const formatGoogleDate = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
      };

      const startDate = formatGoogleDate(eventDate);
      const endDate = new Date(eventDate);
      endDate.setHours(endDate.getHours() + 1);
      const endDateFormatted = formatGoogleDate(endDate);

      // Create Google Calendar URL
      const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        eventTitle
      )}&dates=${startDate}/${endDateFormatted}&details=${encodeURIComponent(
        eventDescription || ""
      )}&sf=true&output=xml`;

      // Open in browser
      Linking.openURL(googleCalendarUrl).catch((err) => {
        console.error("[AddToCalendar] Error opening Google Calendar:", err);
        Alert.alert("Error", "Failed to open Google Calendar. Please try again.");
        onError?.(err instanceof Error ? err.message : "Unknown error");
      });

      onSuccess?.();
    } catch (error) {
      console.error("[AddToCalendar] Error with Google Calendar:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to create Google Calendar link. Please try again.");
      onError?.(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleAddToCalendar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "Add to Calendar",
      "Choose where to add this event:",
      [
        {
          text: "Apple Calendar",
          onPress: addToAppleCalendar,
        },
        {
          text: "Google Calendar",
          onPress: addToGoogleCalendar,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
  };

  // Compact variant - icon only for collapsed view
  if (variant === "compact") {
    return (
      <Pressable
        onPress={handleAddToCalendar}
        disabled={isAdding}
        hitSlop={12}
        style={({ pressed }) => ({
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: pressed
            ? "rgba(52, 199, 89, 0.25)"
            : "rgba(52, 199, 89, 0.15)",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: "rgba(52, 199, 89, 0.4)",
          opacity: isAdding ? 0.6 : 1,
        })}
      >
        <CalendarPlus size={26} color="#34C759" strokeWidth={2.5} />
      </Pressable>
    );
  }

  // Prominent variant - large premium button for finalized events
  if (variant === "prominent") {
    return (
      <Pressable
        onPress={handleAddToCalendar}
        disabled={isAdding}
        style={({ pressed }) => ({
          width: "100%",
          height: 56,
          borderRadius: 18,
          overflow: "hidden",
          transform: [{ scale: pressed ? 0.98 : 1 }],
          marginTop: 16,
          opacity: isAdding ? 0.7 : 1,
        })}
      >
        <LinearGradient
          colors={["#34C759", "#28A745"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
            borderWidth: 1,
            borderColor: "rgba(80, 230, 120, 0.4)",
            borderRadius: 18,
            shadowColor: "#34C759",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            flexDirection: "row",
            gap: 10,
          }}
        >
          <CalendarPlus size={22} color="#FFFFFF" strokeWidth={2.5} />
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: "#FFFFFF",
              letterSpacing: -0.3,
            }}
          >
            {isAdding ? "Adding to Calendar..." : "Add to Calendar"}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  // Default variant
  return (
    <Pressable
      onPress={handleAddToCalendar}
      disabled={isAdding}
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? "rgba(52, 199, 89, 0.25)"
          : "rgba(52, 199, 89, 0.15)",
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "rgba(52, 199, 89, 0.3)",
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: isAdding ? 0.6 : 1,
      })}
    >
      <CalendarIcon size={18} color="#34C759" strokeWidth={2.5} />
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: "#34C759",
        }}
      >
        {isAdding ? "Adding..." : "Add to Calendar"}
      </Text>
    </Pressable>
  );
};

export default AddToCalendar;

