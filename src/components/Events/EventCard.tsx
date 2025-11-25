import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import LiquidGlassView from "../LiquidGlass/LiquidGlassView";
import { variantColorMap, LiquidGlassVariant } from "../LiquidGlass/variants";
import {
  Trash2,
  ChevronDown,
  Calendar,
  MapPin,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  Vote,
  Check,
  X,
  Briefcase,
  PartyPopper,
  UtensilsCrossed,
  Dumbbell,
  Edit3,
  Lock,
  Download,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import AddToCalendar from "./AddToCalendar";
import type { Event } from "@shared/contracts";

interface EventCardProps {
  event: Event;
  currentUserId: string;
  onVote: (optionId: string) => void;
  onRSVP: (responseType: "yes" | "no" | "maybe") => void;
  onExport?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onFinalize?: () => void;
  isCompact?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  currentUserId,
  onVote,
  onRSVP,
  onExport,
  onDelete,
  onEdit,
  onFinalize,
  isCompact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [expandAnim] = useState(new Animated.Value(0));
  const [actionButtonsOpacity] = useState(new Animated.Value(0));

  // Get user's vote and RSVP
  const userVote = event.responses?.find(
    (r) => r.userId === currentUserId && r.optionId !== null
  );
  const userRSVP = event.responses?.find(
    (r) => r.userId === currentUserId && r.optionId === null
  );

  // Group options by type
  const datetimeOptions = event.options?.filter((opt) => opt.optionType === "datetime") || [];
  const locationOptions = event.options?.filter((opt) => opt.optionType === "location") || [];
  const activityOptions = event.options?.filter((opt) => opt.optionType === "activity") || [];

  // Calculate RSVP counts
  const rsvpCounts = {
    yes: event.responses?.filter((r) => r.responseType === "yes" && !r.optionId).length || 0,
    maybe: event.responses?.filter((r) => r.responseType === "maybe" && !r.optionId).length || 0,
    no: event.responses?.filter((r) => r.responseType === "no" && !r.optionId).length || 0,
  };
  const totalRSVPs = rsvpCounts.yes + rsvpCounts.maybe + rsvpCounts.no;

  // Status color with gradient
  const getStatusStyle = () => {
    switch (event.status) {
      case "proposed":
        return {
          gradient: ["#0A84FF", "#0066CC"] as const,
          glow: "rgba(10, 132, 255, 0.3)",
          label: "Planning",
          Icon: Zap,
        };
      case "voting":
        return {
          gradient: ["#FF9F0A", "#FF8800"] as const,
          glow: "rgba(255, 159, 10, 0.3)",
          label: "Voting",
          Icon: Vote,
        };
      case "confirmed":
        return {
          gradient: ["#30D158", "#28A745"] as const,
          glow: "rgba(48, 209, 88, 0.3)",
          label: "Confirmed",
          Icon: CheckCircle2,
        };
      case "cancelled":
        return {
          gradient: ["#FF453A", "#CC0000"] as const,
          glow: "rgba(255, 69, 58, 0.3)",
          label: "Cancelled",
          Icon: XCircle,
        };
      default:
        return {
          gradient: ["#8E8E93", "#636366"] as const,
          glow: "rgba(142, 142, 147, 0.3)",
          label: "Event",
          Icon: Calendar,
        };
    }
  };

  const statusStyle = getStatusStyle();

  // Event type icon
  const getTypeIcon = () => {
    switch (event.eventType) {
      case "meeting":
        return Briefcase;
      case "hangout":
        return PartyPopper;
      case "meal":
        return UtensilsCrossed;
      case "activity":
        return Dumbbell;
      default:
        return Calendar;
    }
  };

  const TypeIcon = getTypeIcon();

  const getVariant = (): LiquidGlassVariant => {
    switch (event.status) {
      case "proposed":
        return "info";
      case "voting":
        return "warning";
      case "confirmed":
        return "success";
      case "cancelled":
        return "danger";
      default:
        return "default";
    }
  };

  const variant = getVariant();
  const variantColors = variantColorMap[variant];

  const handleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.parallel([
      Animated.spring(expandAnim, {
        toValue,
        useNativeDriver: false,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(actionButtonsOpacity, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <LiquidGlassView
      intensity={30}
      tint="dark"
      borderRadius={24}
      gradientColors={variantColors.gradientColors}
      borderColor={variantColors.borderColor}
      borderWidth={event.status === "confirmed" ? 2 : 1}
      shadowColor={variantColors.shadowColor}
      shadowIntensity="medium"
      style={{ marginBottom: 16 }}
    >
          {/* Header */}
          <Pressable
            onPress={handleExpand}
            style={{ padding: 20 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                {/* Status Badge with Gradient */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <LinearGradient
                    colors={statusStyle.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      shadowColor: statusStyle.glow,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.6,
                      shadowRadius: 8,
                    }}
                  >
                    <statusStyle.Icon size={12} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.5 }}>
                      {statusStyle.label}
                    </Text>
                  </LinearGradient>

                  {totalRSVPs > 0 && (
                    <View
                      style={{
                        marginLeft: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.12)",
                      }}
                    >
                      <Users size={12} color="rgba(255, 255, 255, 0.7)" strokeWidth={2.5} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255, 255, 255, 0.7)", marginLeft: 4 }}>
                        {totalRSVPs}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Title with Icon */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <TypeIcon size={18} color="rgba(255, 255, 255, 0.9)" strokeWidth={2} />
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: "#FFFFFF",
                      flex: 1,
                      letterSpacing: -0.5,
                    }}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {event.title}
                  </Text>
                </View>

                {/* Description Preview */}
                {event.description && !isExpanded && (
                  <Text
                    style={{
                      fontSize: 15,
                      color: "rgba(255, 255, 255, 0.6)",
                      marginTop: 6,
                      lineHeight: 21,
                    }}
                    numberOfLines={2}
                  >
                    {event.description}
                  </Text>
                )}
              </View>

              {/* Right Side Actions */}
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                {/* Add to Calendar - Compact button for collapsed confirmed events */}
                {!isExpanded && event.status === "confirmed" && event.eventDate && (
                  <AddToCalendar
                    eventTitle={event.title}
                    eventDescription={event.description}
                    eventDate={new Date(event.eventDate)}
                    variant="compact"
                    onSuccess={() => {
                      console.log("Event added to calendar successfully");
                    }}
                    onError={(error) => {
                      console.error("Failed to add event to calendar:", error);
                    }}
                  />
                )}

                {/* Edit Button - Only for creator and not confirmed - shown only when expanded */}
                {isExpanded && onEdit && event.creatorId === currentUserId && event.status !== "confirmed" && event.status !== "cancelled" && (
                  <Animated.View style={{ opacity: actionButtonsOpacity }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        onEdit();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      hitSlop={12}
                      style={({ pressed }) => ({
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: pressed
                          ? "rgba(10, 132, 255, 0.25)"
                          : "rgba(10, 132, 255, 0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: "rgba(10, 132, 255, 0.4)",
                      })}
                    >
                      <Edit3 size={26} color="#0A84FF" strokeWidth={2.5} />
                    </Pressable>
                  </Animated.View>
                )}

                {/* Finalize Button - Only for creator and not yet confirmed - shown only when expanded */}
                {isExpanded && onFinalize && event.creatorId === currentUserId && event.status !== "confirmed" && event.status !== "cancelled" && (
                  <Animated.View style={{ opacity: actionButtonsOpacity }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setShowFinalizeConfirm(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      hitSlop={12}
                      style={({ pressed }) => ({
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: pressed
                          ? "rgba(48, 209, 88, 0.25)"
                          : "rgba(48, 209, 88, 0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: "rgba(48, 209, 88, 0.4)",
                      })}
                    >
                      <Lock size={26} color="#30D158" strokeWidth={2.5} />
                    </Pressable>
                  </Animated.View>
                )}

                {/* Delete Button - shown only when expanded */}
                {isExpanded && onDelete && event.creatorId === currentUserId && (
                  <Animated.View style={{ opacity: actionButtonsOpacity }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      hitSlop={12}
                      style={({ pressed }) => ({
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: pressed
                          ? "rgba(255, 69, 58, 0.25)"
                          : "rgba(255, 69, 58, 0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: "rgba(255, 69, 58, 0.4)",
                      })}
                    >
                      <Trash2 size={26} color="#FF453A" strokeWidth={2.5} />
                    </Pressable>
                  </Animated.View>
                )}

                {/* Expand Button */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <Animated.View
                    style={{
                      transform: [{
                        rotate: expandAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "180deg"],
                        }),
                      }],
                    }}
                  >
                    <ChevronDown size={22} color="#FFFFFF" strokeWidth={2.5} />
                  </Animated.View>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Expanded Content */}
          {isExpanded && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {/* Full Description */}
              {event.description && (
                <View
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: "rgba(255, 255, 255, 0.85)",
                      lineHeight: 22,
                    }}
                  >
                    {event.description}
                  </Text>
                </View>
              )}

              {/* Event Date Display - Shown prominently after description */}
              {event.eventDate && (
                <View
                  style={{
                    backgroundColor: "rgba(0, 122, 255, 0.08)",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: "rgba(0, 122, 255, 0.3)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: "rgba(0, 122, 255, 0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>📅</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: "rgba(255, 255, 255, 0.6)",
                          marginBottom: 3,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Scheduled Date & Time
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                      >
                        {new Date(event.eventDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Date/Time Options */}
              {datetimeOptions.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                    <Vote size={16} color="rgba(255, 255, 255, 0.7)" strokeWidth={2} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "rgba(255, 255, 255, 0.7)",
                        textTransform: "uppercase",
                        marginLeft: 8,
                        letterSpacing: 1,
                      }}
                    >
                      Vote Now · Make Your Pick
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                    keyboardShouldPersistTaps="always"
                  >
                    {datetimeOptions.map((option) => {
                      const isSelected = userVote?.optionId === option.id;
                      const totalVotes = datetimeOptions.reduce((sum, opt) => sum + opt.votes, 0);
                      const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                      const isLeading = option.votes > 0 && option.votes === Math.max(...datetimeOptions.map(o => o.votes));

                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => {
                            onVote(option.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={({ pressed }) => ({
                            minWidth: 140,
                            borderRadius: 18,
                            overflow: "hidden",
                            opacity: pressed ? 0.8 : 1,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          })}
                        >
                          <BlurView intensity={30} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                            {isSelected && (
                              <LinearGradient
                                colors={["rgba(10, 132, 255, 0.4)", "rgba(10, 132, 255, 0.2)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                }}
                              />
                            )}
                            <View
                              style={{
                                padding: 16,
                                borderWidth: 2,
                                borderColor: isSelected
                                  ? "#0A84FF"
                                  : isLeading
                                  ? "rgba(48, 209, 88, 0.5)"
                                  : "rgba(255, 255, 255, 0.12)",
                                borderRadius: 18,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "700",
                                  color: "#FFFFFF",
                                  marginBottom: 8,
                                  lineHeight: 20,
                                }}
                              >
                                {option.optionValue}
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: isSelected ? "#0A84FF" : "rgba(255, 255, 255, 0.6)",
                                  }}
                                >
                                  {option.votes} {option.votes === 1 ? "vote" : "votes"}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: isSelected ? "#0A84FF" : isLeading ? "#30D158" : "rgba(255, 255, 255, 0.5)",
                                  }}
                                >
                                  {percentage}%
                                </Text>
                              </View>
                            </View>
                          </BlurView>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Location Options */}
              {locationOptions.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                    <Vote size={16} color="rgba(255, 255, 255, 0.7)" strokeWidth={2} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "rgba(255, 255, 255, 0.7)",
                        textTransform: "uppercase",
                        marginLeft: 8,
                        letterSpacing: 1,
                      }}
                    >
                      Vote Now · Make Your Pick
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    {locationOptions.map((option) => {
                      const isSelected = userVote?.optionId === option.id;
                      const totalVotes = locationOptions.reduce((sum, opt) => sum + opt.votes, 0);
                      const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                      const isLeading = option.votes > 0 && option.votes === Math.max(...locationOptions.map(o => o.votes));

                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => {
                            onVote(option.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={({ pressed }) => ({
                            borderRadius: 18,
                            overflow: "hidden",
                            opacity: pressed ? 0.8 : 1,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          })}
                        >
                          <BlurView intensity={30} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                            {isSelected && (
                              <LinearGradient
                                colors={["rgba(10, 132, 255, 0.4)", "rgba(10, 132, 255, 0.2)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                }}
                              />
                            )}
                            <View
                              style={{
                                paddingHorizontal: 18,
                                paddingVertical: 14,
                                borderWidth: 2,
                                borderColor: isSelected
                                  ? "#0A84FF"
                                  : isLeading
                                  ? "rgba(48, 209, 88, 0.5)"
                                  : "rgba(255, 255, 255, 0.12)",
                                borderRadius: 18,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "700",
                                  color: "#FFFFFF",
                                }}
                              >
                                {option.optionValue}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: isSelected ? "rgba(10, 132, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 10,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "700",
                                    color: isSelected ? "#0A84FF" : "rgba(255, 255, 255, 0.7)",
                                  }}
                                >
                                  {option.votes} • {percentage}%
                                </Text>
                              </View>
                            </View>
                          </BlurView>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Activity Options */}
              {activityOptions.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                    <Vote size={16} color="rgba(255, 255, 255, 0.7)" strokeWidth={2} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "rgba(255, 255, 255, 0.7)",
                        textTransform: "uppercase",
                        marginLeft: 8,
                        letterSpacing: 1,
                      }}
                    >
                      Vote Now · Make Your Pick
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    {activityOptions.map((option) => {
                      const isSelected = userVote?.optionId === option.id;
                      const totalVotes = activityOptions.reduce((sum, opt) => sum + opt.votes, 0);
                      const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                      const isLeading = option.votes > 0 && option.votes === Math.max(...activityOptions.map(o => o.votes));

                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => {
                            onVote(option.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }}
                          style={({ pressed }) => ({
                            borderRadius: 18,
                            overflow: "hidden",
                            opacity: pressed ? 0.8 : 1,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          })}
                        >
                          <BlurView intensity={30} tint="dark" style={{ borderRadius: 18, overflow: "hidden" }}>
                            {isSelected && (
                              <LinearGradient
                                colors={["rgba(10, 132, 255, 0.4)", "rgba(10, 132, 255, 0.2)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                }}
                              />
                            )}
                            <View
                              style={{
                                paddingHorizontal: 18,
                                paddingVertical: 14,
                                borderWidth: 2,
                                borderColor: isSelected
                                  ? "#0A84FF"
                                  : isLeading
                                  ? "rgba(48, 209, 88, 0.5)"
                                  : "rgba(255, 255, 255, 0.12)",
                                borderRadius: 18,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "700",
                                  color: "#FFFFFF",
                                }}
                              >
                                {option.optionValue}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: isSelected ? "rgba(10, 132, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 10,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "700",
                                    color: isSelected ? "#0A84FF" : "rgba(255, 255, 255, 0.7)",
                                  }}
                                >
                                  {option.votes} • {percentage}%
                                </Text>
                              </View>
                            </View>
                          </BlurView>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* RSVP Section */}
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Users size={16} color="rgba(255, 255, 255, 0.7)" strokeWidth={2} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "rgba(255, 255, 255, 0.7)",
                        textTransform: "uppercase",
                        marginLeft: 8,
                        letterSpacing: 1,
                      }}
                    >
                      Your Response
                    </Text>
                  </View>
                  {totalRSVPs > 0 && (
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255, 255, 255, 0.5)" }}>
                      {totalRSVPs} {totalRSVPs === 1 ? "response" : "responses"}
                    </Text>
                  )}
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(["yes", "maybe", "no"] as const).map((type) => {
                    const isSelected = userRSVP?.responseType === type;
                    const count = rsvpCounts[type];
                    const percentage = totalRSVPs > 0 ? Math.round((count / totalRSVPs) * 100) : 0;
                    const label = type === "yes" ? "Going" : type === "maybe" ? "Maybe" : "Can't Go";
                    const Icon = type === "yes" ? Check : type === "maybe" ? HelpCircle : X;
                    const colors: readonly [string, string] = type === "yes"
                      ? ["#30D158", "#28A745"]
                      : type === "maybe"
                      ? ["#FF9F0A", "#FF8800"]
                      : ["#FF453A", "#CC0000"];

                    return (
                      <Pressable
                        key={type}
                        onPress={() => {
                          onRSVP(type);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        style={({ pressed }) => ({
                          flex: 1,
                          borderRadius: 16,
                          overflow: "hidden",
                          opacity: pressed ? 0.8 : 1,
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        })}
                      >
                        {isSelected ? (
                          <LinearGradient
                            colors={colors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                              paddingVertical: 16,
                              paddingHorizontal: 12,
                              alignItems: "center",
                              borderRadius: 16,
                              shadowColor: colors[0],
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.4,
                              shadowRadius: 8,
                            }}
                          >
                            <Icon size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginBottom: 6 }} />
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "700",
                                color: "#FFFFFF",
                                marginBottom: 4,
                              }}
                            >
                              {label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: "rgba(255, 255, 255, 0.9)",
                              }}
                            >
                              {count} ({percentage}%)
                            </Text>
                          </LinearGradient>
                        ) : (
                          <BlurView intensity={20} tint="dark">
                            <View
                              style={{
                                paddingVertical: 16,
                                paddingHorizontal: 12,
                                borderRadius: 16,
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                borderWidth: 1.5,
                                borderColor: "rgba(255, 255, 255, 0.12)",
                                alignItems: "center",
                              }}
                            >
                              <Icon size={20} color="rgba(255, 255, 255, 0.5)" strokeWidth={2} style={{ marginBottom: 6 }} />
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: "700",
                                  color: "rgba(255, 255, 255, 0.8)",
                                  marginBottom: 4,
                                }}
                              >
                                {label}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: "rgba(255, 255, 255, 0.5)",
                                }}
                              >
                                {count} ({percentage}%)
                              </Text>
                            </View>
                          </BlurView>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Export Button - Enhanced for confirmed events */}
              {event.status === "confirmed" && event.eventDate && (
                <View style={{ marginTop: 16, gap: 12 }}>
                  {/* Final Event Details Banner */}
                  <View
                    style={{
                      backgroundColor: "rgba(48, 209, 88, 0.08)",
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: "rgba(48, 209, 88, 0.3)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                      <CheckCircle2 size={18} color="#30D158" strokeWidth={2.5} />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#30D158",
                          marginLeft: 8,
                          letterSpacing: 0.3,
                        }}
                      >
                        Event Finalized
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        color: "rgba(255, 255, 255, 0.8)",
                        lineHeight: 20,
                        marginBottom: 8,
                      }}
                    >
                      This event has been confirmed and locked. Add it to your calendar to stay updated!
                    </Text>
                    {/* Show Event Date */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                      <Calendar size={14} color="rgba(255, 255, 255, 0.6)" strokeWidth={2} />
                      <Text
                        style={{
                          fontSize: 13,
                          color: "rgba(255, 255, 255, 0.6)",
                          marginLeft: 6,
                          fontWeight: "500",
                        }}
                      >
                        {new Date(event.eventDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Add to Calendar Component - Prominent variant */}
                  <AddToCalendar
                    eventTitle={event.title}
                    eventDescription={event.description}
                    eventDate={new Date(event.eventDate)}
                    variant="prominent"
                    onSuccess={() => {
                      console.log("Event added to calendar successfully");
                    }}
                    onError={(error) => {
                      console.error("Failed to add event to calendar:", error);
                    }}
                  />
                </View>
              )}
            </View>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <Pressable style={{ width: "100%", maxWidth: 300 }} onPress={(e) => e.stopPropagation()}>
                <LiquidGlassView
                  intensity={80}
                  borderRadius={24}
                  gradientColors={["rgba(40, 40, 42, 0.95)", "rgba(28, 28, 30, 0.95)", "rgba(20, 20, 22, 0.95)"]}
                  borderColor="rgba(255, 69, 58, 0.3)"
                  borderWidth={1.5}
                  shadowColor="rgba(255, 69, 58, 0.4)"
                  shadowIntensity="heavy"
                >
                  <View style={{ padding: 24 }}>
                    {/* Icon */}
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: "rgba(255, 69, 58, 0.15)",
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        marginBottom: 20,
                        borderWidth: 1.5,
                        borderColor: "rgba(255, 69, 58, 0.4)",
                      }}
                    >
                      <Trash2 size={30} color="#FF453A" strokeWidth={2.5} />
                    </View>

                    {/* Title */}
                    <Text
                      style={{
                        fontSize: 21,
                        fontWeight: "700",
                        color: "#FFFFFF",
                        marginBottom: 10,
                        textAlign: "center",
                        letterSpacing: -0.5,
                      }}
                    >
                      Delete Event?
                    </Text>
                    
                    {/* Description */}
                    <Text
                      style={{
                        fontSize: 14,
                        color: "rgba(255, 255, 255, 0.7)",
                        marginBottom: 24,
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      This action cannot be undone. All votes and responses will be permanently deleted.
                    </Text>

                    {/* Buttons */}
                    <View style={{ gap: 12, alignItems: "center" }}>
                      {/* Premium Delete Button */}
                      <Pressable
                        onPress={() => {
                          setShowDeleteConfirm(false);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          onDelete?.();
                        }}
                        style={({ pressed }) => ({
                          width: "100%",
                          height: 54,
                          borderRadius: 18,
                          overflow: "hidden",
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <LinearGradient
                          colors={["#FF453A", "#E63946"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            height: 54,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 20,
                            borderWidth: 1,
                            borderColor: "rgba(255, 100, 90, 0.4)",
                            borderRadius: 18,
                            shadowColor: "#FF453A",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.4,
                            shadowRadius: 12,
                          }}
                        >
                          <Text style={{ 
                            fontSize: 17, 
                            fontWeight: "700", 
                            color: "#FFFFFF", 
                            letterSpacing: -0.3,
                          }}>
                            Delete Event
                          </Text>
                        </LinearGradient>
                      </Pressable>

                      {/* Cancel Button */}
                      <Pressable
                        onPress={() => {
                          setShowDeleteConfirm(false);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={({ pressed }) => ({
                          paddingHorizontal: 40,
                          height: 48,
                          borderRadius: 16,
                          backgroundColor: pressed
                            ? "rgba(255, 255, 255, 0.12)"
                            : "rgba(255, 255, 255, 0.06)",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.12)",
                        })}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "rgba(255, 255, 255, 0.9)", letterSpacing: -0.2 }}>
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </LiquidGlassView>
              </Pressable>
            </Pressable>
          )}

          {/* Finalize Confirmation Dialog */}
          {showFinalizeConfirm && (
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
              onPress={() => setShowFinalizeConfirm(false)}
            >
              <Pressable style={{ width: "100%", maxWidth: 300 }} onPress={(e) => e.stopPropagation()}>
                <LiquidGlassView
                  intensity={80}
                  borderRadius={24}
                  gradientColors={["rgba(40, 40, 42, 0.95)", "rgba(28, 28, 30, 0.95)", "rgba(20, 20, 22, 0.95)"]}
                  borderColor="rgba(48, 209, 88, 0.3)"
                  borderWidth={1.5}
                  shadowColor="rgba(48, 209, 88, 0.4)"
                  shadowIntensity="heavy"
                >
                  <View style={{ padding: 24 }}>
                    {/* Icon */}
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: "rgba(48, 209, 88, 0.15)",
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        marginBottom: 20,
                        borderWidth: 1.5,
                        borderColor: "rgba(48, 209, 88, 0.4)",
                      }}
                    >
                      <Lock size={30} color="#30D158" strokeWidth={2.5} />
                    </View>

                    {/* Title */}
                    <Text
                      style={{
                        fontSize: 21,
                        fontWeight: "700",
                        color: "#FFFFFF",
                        marginBottom: 10,
                        textAlign: "center",
                        letterSpacing: -0.5,
                      }}
                    >
                      Finalize Event?
                    </Text>
                    
                    {/* Description */}
                    <Text
                      style={{
                        fontSize: 14,
                        color: "rgba(255, 255, 255, 0.7)",
                        marginBottom: 24,
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      This will lock the event and prevent further voting or changes. The event will be marked as confirmed.
                    </Text>

                    {/* Buttons */}
                    <View style={{ gap: 12, alignItems: "center" }}>
                      {/* Premium Finalize Button */}
                      <Pressable
                        onPress={() => {
                          setShowFinalizeConfirm(false);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          onFinalize?.();
                        }}
                        style={({ pressed }) => ({
                          width: "100%",
                          height: 54,
                          borderRadius: 18,
                          overflow: "hidden",
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <LinearGradient
                          colors={["#30D158", "#28B04A"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            height: 54,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 20,
                            borderWidth: 1,
                            borderColor: "rgba(80, 230, 120, 0.4)",
                            borderRadius: 18,
                            shadowColor: "#30D158",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.4,
                            shadowRadius: 12,
                          }}
                        >
                          <Text style={{ 
                            fontSize: 17, 
                            fontWeight: "700", 
                            color: "#FFFFFF", 
                            letterSpacing: -0.3,
                          }}>
                            Finalize Event
                          </Text>
                        </LinearGradient>
                      </Pressable>

                      {/* Cancel Button */}
                      <Pressable
                        onPress={() => {
                          setShowFinalizeConfirm(false);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={({ pressed }) => ({
                          paddingHorizontal: 40,
                          height: 48,
                          borderRadius: 16,
                          backgroundColor: pressed
                            ? "rgba(255, 255, 255, 0.12)"
                            : "rgba(255, 255, 255, 0.06)",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.12)",
                        })}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "rgba(255, 255, 255, 0.9)", letterSpacing: -0.2 }}>
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </LiquidGlassView>
              </Pressable>
            </Pressable>
          )}
    </LiquidGlassView>
  );
};

export default EventCard;
