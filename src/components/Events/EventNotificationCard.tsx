import React from "react";
import { View, Text, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { Event } from "@shared/contracts";

interface EventNotificationCardProps {
  event: Event;
  onPress: () => void;
}

const EventNotificationCard: React.FC<EventNotificationCardProps> = ({
  event,
  onPress,
}) => {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => ({
        borderRadius: 16,
        overflow: "hidden",
        marginTop: 8,
        // Distinctive border styling
        borderWidth: 2,
        borderColor: pressed ? "rgba(0, 122, 255, 0.5)" : "rgba(0, 122, 255, 0.35)",
        shadowColor: "#0A84FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      })}
    >
      <BlurView intensity={25} tint="dark">
        {/* Subtle blue background tint */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 122, 255, 0.08)",
          }}
        />
        
        {/* Gradient accent bar on left edge */}
        <LinearGradient
          colors={["rgba(0, 122, 255, 0.5)", "rgba(0, 122, 255, 0.2)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
          }}
        />
        
        <View style={{ padding: 18, paddingLeft: 22 }}>
          {/* Event Icon Indicator */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(0, 122, 255, 0.25)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
                borderWidth: 1,
                borderColor: "rgba(0, 122, 255, 0.4)",
              }}
            >
              <Text style={{ fontSize: 18 }}>📅</Text>
            </View>
            
            <View style={{ flex: 1 }}>
              {/* Title */}
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#FFFFFF",
                  marginBottom: 6,
                  letterSpacing: -0.3,
                  lineHeight: 24,
                }}
                numberOfLines={2}
              >
                {event.title}
              </Text>

              {/* Description */}
              {event.description && (
                <Text
                  style={{
                    fontSize: 15,
                    color: "rgba(255, 255, 255, 0.7)",
                    lineHeight: 20,
                    marginBottom: 10,
                  }}
                  numberOfLines={2}
                >
                  {event.description}
                </Text>
              )}

              {/* Date & Time */}
              {event.eventDate && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "rgba(0, 122, 255, 0.2)",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: "rgba(0, 122, 255, 0.4)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#FFFFFF",
                      }}
                    >
                      {new Date(event.eventDate).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Call to Action */}
          <View
            style={{
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#0A84FF",
                textAlign: "center",
                letterSpacing: -0.1,
              }}
            >
              Tap to view details and respond
            </Text>
          </View>
        </View>
      </BlurView>
    </Pressable>
  );
};

export default EventNotificationCard;

