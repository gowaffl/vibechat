import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  PanResponder,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import LiquidGlassCard from "../LiquidGlass/LiquidGlassCard";
import LiquidGlassButton from "../LiquidGlass/LiquidGlassButton";
import { useTheme } from "@/contexts/ThemeContext";

import type { Event } from "@shared/contracts";

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    description: string,
    type: "meeting" | "hangout" | "meal" | "activity" | "other",
    eventDate: Date | null,
    timezone: string,
    options: Array<{ optionType: "datetime" | "location" | "activity"; optionValue: string }>
  ) => void;
  isCreating?: boolean;
  initialEvent?: Partial<Event> | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const EVENT_TYPES = [
  { id: "meeting" as const, label: "Meeting", example: "Plan a meeting" },
  { id: "hangout" as const, label: "Hangout", example: "Casual get-together" },
  { id: "meal" as const, label: "Meal", example: "Lunch or dinner plans" },
  { id: "activity" as const, label: "Activity", example: "Movie, game, etc" },
  { id: "other" as const, label: "Other", example: "Any other event" },
] as const;

const CreateEventModal: React.FC<CreateEventModalProps> = ({
  visible,
  onClose,
  onCreate,
  isCreating = false,
  initialEvent,
}) => {
  const { colors, isDark } = useTheme();
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const dragY = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(visible);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"meeting" | "hangout" | "meal" | "activity" | "other">("meeting");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      // Light feedback on open
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (initialEvent) {
        setTitle(initialEvent.title);
        setDescription(initialEvent.description || "");
        setType(initialEvent.eventType);
        setEventDate(initialEvent.eventDate ? new Date(initialEvent.eventDate) : null);
        const optionValues = initialEvent.options?.map((o) => o.optionValue) || [];
        if (optionValues.length > 0) {
          setShowOptions(true);
          if (optionValues.length < 2) {
            // Ensure at least two input fields
            while(optionValues.length < 2) optionValues.push("");
          }
          setOptions(optionValues);
        } else {
          setShowOptions(false);
          setOptions(["", ""]);
        }
      } else {
         // Reset form only if NOT editing (or if we just opened fresh)
         // Actually, better to just reset if !initialEvent
          setTitle("");
          setDescription("");
          setType("meeting");
          setEventDate(null);
          setShowOptions(false);
          setOptions(["", ""]);
      }

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 800,
          damping: 50,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => setShowModal(false));
    }
  }, [visible, slideAnim, fadeAnim, initialEvent]);

  const handleClose = () => {
    // Removed haptic on close
    onClose();
  };

  // PanResponder for swipe-down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Haptics.selectionAsync();
          onClose();
          Animated.spring(dragY, {
            toValue: 0,
            stiffness: 800,
            damping: 50,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            stiffness: 800,
            damping: 50,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          stiffness: 800,
          damping: 50,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Reset drag position when modal closes
  useEffect(() => {
    if (!visible) {
      dragY.setValue(0);
    }
  }, [visible]);

  // Get user's timezone for accurate time handling
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleCreate = () => {
    console.log("=== [CreateEventModal] handleCreate called ===");
    const validOptions = options.filter((opt) => opt.trim().length > 0);
    console.log("[CreateEventModal] Title:", title.trim(), "Valid options:", validOptions.length, "Show options:", showOptions);
    
    // Validate: title is required, options only required if showOptions is true
    if (!title.trim()) {
      console.log("[CreateEventModal] Validation failed - title is required");
      return;
    }
    
    if (showOptions && validOptions.length < 2) {
      console.log("[CreateEventModal] Validation failed - at least 2 options required when options are enabled");
      return;
    }

    // Determine optionType based on event type
    // For meetings/hangouts, options are typically datetime
    // For meals, options could be datetime or location
    // For activities, options are activity choices
    let optionType: "datetime" | "location" | "activity" = "datetime";
    if (type === "activity") {
      optionType = "activity";
    } else if (type === "meal") {
      optionType = "location"; // Could also be datetime
    }

    const formattedOptions = showOptions && validOptions.length >= 2
      ? validOptions.map((optionValue) => ({
          optionType,
          optionValue,
        }))
      : [];

    console.log("[CreateEventModal] Calling onCreate with:", { title: title.trim(), description: description.trim(), type, eventDate, timezone: userTimezone, options: formattedOptions });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCreate(title.trim(), description.trim(), type, eventDate, userTimezone, formattedOptions);
    console.log("[CreateEventModal] onCreate called successfully");
  };

  // LOW-20: Get a sensible default time (next hour, rounded)
  const getDefaultDateTime = () => {
    const now = new Date();
    const defaultDate = new Date(now);
    // Round up to the next hour
    defaultDate.setHours(now.getHours() + 1);
    defaultDate.setMinutes(0);
    defaultDate.setSeconds(0);
    defaultDate.setMilliseconds(0);
    return defaultDate;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      // Create a new Date that preserves the exact time the user selected
      const newDate = new Date(selectedDate.getTime());
      console.log("[CreateEventModal] Date selected:", {
        selectedDate: selectedDate.toString(),
        newDate: newDate.toString(),
        timezone: userTimezone,
        isoString: newDate.toISOString(),
      });
      
      if (Platform.OS === "ios") {
        // On iOS with datetime mode, the picker returns the complete date+time
        setEventDate(newDate);
      } else {
        // On Android, we have separate pickers, so preserve time when selecting date
        const currentDate = eventDate || getDefaultDateTime();
        const mergedDate = new Date(currentDate);
        
        // Update the date portion while preserving time
        mergedDate.setFullYear(newDate.getFullYear());
        mergedDate.setMonth(newDate.getMonth());
        mergedDate.setDate(newDate.getDate());
        
        setEventDate(mergedDate);
        
        // After selecting date, show time picker on Android
        setTimeout(() => setShowTimePicker(true), 300);
      }
      
      Haptics.selectionAsync();
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      // Create a new Date object to avoid mutating the existing state
      // LOW-20: Use sensible default if no date set
      const currentDate = eventDate || getDefaultDateTime();
      const newDate = new Date(currentDate);
      
      // Update the time portion while preserving date
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);
      
      console.log("[CreateEventModal] Time selected:", {
        selectedTime: selectedTime.toString(),
        newDate: newDate.toString(),
        timezone: userTimezone,
        isoString: newDate.toISOString(),
      });
      
      setEventDate(newDate);
      Haptics.selectionAsync();
    }
  };

  const formatEventDate = (date: Date | null) => {
    if (!date) return "Not set";
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short", // Show timezone abbreviation (EST, PST, etc.)
    };
    return date.toLocaleString("en-US", options);
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
      Haptics.selectionAsync();
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
      Haptics.selectionAsync();
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validOptions = options.filter((opt) => opt.trim().length > 0);
  const canCreate = title.trim().length > 0 && (!showOptions || validOptions.length >= 2) && !isCreating;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
        }}
      >
        <BlurView intensity={40} tint={colors.blurTint} style={{ flex: 1 }}>
          {/* Backdrop */}
          <Pressable style={{ flex: 1 }} onPress={handleClose}>
            <View style={{ flex: 1 }} />
          </Pressable>

          {/* Modal Content */}
          <Animated.View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: SCREEN_HEIGHT * 0.9,
              transform: [
                { translateY: slideAnim },
                { translateY: dragY }
              ],
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <SafeAreaView>
                {/* Handle Bar for swipe down */}
                <View
                  {...panResponder.panHandlers}
                  style={{
                    alignItems: "center",
                    paddingTop: 14,
                    paddingBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 5,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)",
                      borderRadius: 2.5,
                    }}
                  />
                </View>

                <View
                  style={{
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    overflow: "hidden",
                  }}
                >
                <BlurView intensity={80} tint={colors.blurTint}>
                  <LinearGradient
                    colors={[
                      "rgba(10, 149, 255, 0.15)",
                      "rgba(0, 122, 255, 0.08)",
                      "rgba(0, 0, 0, 0.5)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: 20 }}
                  >
                    {/* Handle Bar */}
                    <View style={{ alignItems: "center", marginBottom: 16 }}>
                      <View
                        style={{
                          width: 40,
                          height: 5,
                          borderRadius: 2.5,
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.15)",
                        }}
                      />
                    </View>

                    {/* Header */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 24,
                        marginBottom: 20,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: colors.text,
                            marginBottom: 4,
                          }}
                        >
                          {initialEvent ? "✏️ Edit Event" : "📅 Create Event"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: colors.textSecondary,
                          }}
                        >
                          {initialEvent ? "Update event details" : "Plan something with your group"}
                        </Text>
                      </View>

                      <Pressable
                        onPress={handleClose}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: pressed
                            ? "rgba(255, 255, 255, 0.15)"
                            : "rgba(255, 255, 255, 0.1)",
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text style={{ fontSize: 20, color: "#FFFFFF" }}>✕</Text>
                      </Pressable>
                    </View>

                    {/* Form Content */}
                    <ScrollView
                      style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
                      contentContainerStyle={{
                        paddingHorizontal: 24,
                        paddingBottom: isKeyboardVisible ? 20 : 24,
                      }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {/* Event Title */}
                      <LiquidGlassCard
                        variant="event"
                        title="Event Title"
                        style={{ marginBottom: 16 }}
                      >
                        <TextInput
                          value={title}
                          onChangeText={setTitle}
                          placeholder="e.g., Movie Night, Dinner Plans..."
                          placeholderTextColor={colors.inputPlaceholder}
                          keyboardAppearance={isDark ? "dark" : "light"}
                          style={{
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 16,
                            color: colors.text,
                            fontWeight: "600",
                          }}
                          maxLength={100}
                        />
                      </LiquidGlassCard>

                      {/* Description */}
                      <LiquidGlassCard
                        variant="event"
                        title="Description (Optional)"
                        style={{ marginBottom: 16 }}
                      >
                        <TextInput
                          value={description}
                          onChangeText={setDescription}
                          placeholder="Add details about the event..."
                          placeholderTextColor={colors.inputPlaceholder}
                          keyboardAppearance={isDark ? "dark" : "light"}
                          multiline
                          numberOfLines={3}
                          style={{
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 15,
                            color: colors.text,
                            minHeight: 80,
                            textAlignVertical: "top",
                          }}
                          maxLength={500}
                        />
                      </LiquidGlassCard>

                      {/* Event Date & Time */}
                      <LiquidGlassCard
                        variant="event"
                        title="Event Date & Time"
                        subtitle="When will this event happen?"
                        style={{ marginBottom: 16 }}
                      >
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            setShowDatePicker(true);
                          }}
                          style={{
                            backgroundColor: eventDate
                              ? "rgba(10, 149, 255, 0.15)"
                              : "rgba(255, 255, 255, 0.08)",
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: eventDate
                              ? "rgba(10, 149, 255, 0.3)"
                              : "rgba(255, 255, 255, 0.1)",
                            padding: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 15,
                                color: eventDate ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
                                fontWeight: eventDate ? "600" : "400",
                              }}
                            >
                              {eventDate ? formatEventDate(eventDate) : "Tap to select date & time"}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 20 }}>📅</Text>
                        </Pressable>

                        {eventDate && (
                          <Pressable
                            onPress={() => {
                              Haptics.selectionAsync();
                              setEventDate(null);
                            }}
                            style={{
                              marginTop: 8,
                              padding: 10,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                color: "rgba(255, 59, 48, 0.8)",
                                fontWeight: "600",
                              }}
                            >
                              Clear Date
                            </Text>
                          </Pressable>
                        )}
                      </LiquidGlassCard>

                      {/* Date/Time Picker - iOS Modal */}
                      {showDatePicker && Platform.OS === "ios" && (
                        <Modal transparent animationType="slide">
                          <Pressable
                            style={{
                              flex: 1,
                              backgroundColor: "rgba(0, 0, 0, 0.5)",
                              justifyContent: "flex-end",
                            }}
                            onPress={() => setShowDatePicker(false)}
                          >
                            <View
                              style={{
                                backgroundColor: "#1C1C1E",
                                borderTopLeftRadius: 20,
                                borderTopRightRadius: 20,
                                paddingBottom: 34,
                              }}
                              onStartShouldSetResponder={() => true}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  paddingHorizontal: 20,
                                  paddingVertical: 16,
                                  borderBottomWidth: 1,
                                  borderBottomColor: "rgba(255, 255, 255, 0.1)",
                                }}
                              >
                                <Pressable
                                  onPress={() => {
                                    setEventDate(null);
                                    setShowDatePicker(false);
                                  }}
                                >
                                  <Text style={{ color: "#FF3B30", fontSize: 16 }}>Clear</Text>
                                </Pressable>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                                  Select Date & Time
                                </Text>
                                <Pressable onPress={() => setShowDatePicker(false)}>
                                  <Text style={{ color: "#0A95FF", fontSize: 16, fontWeight: "600" }}>
                                    Done
                                  </Text>
                                </Pressable>
                              </View>
                              {/* LOW-20: Use sensible default (next hour, rounded) */}
                              <DateTimePicker
                                value={eventDate || getDefaultDateTime()}
                                mode="datetime"
                                display="spinner"
                                onChange={handleDateChange}
                                minimumDate={new Date()}
                                textColor="#FFFFFF"
                                themeVariant="dark"
                              />
                            </View>
                          </Pressable>
                        </Modal>
                      )}

                      {/* Date/Time Picker - Android - LOW-20: Use sensible default */}
                      {showDatePicker && Platform.OS === "android" && (
                        <DateTimePicker
                          value={eventDate || getDefaultDateTime()}
                          mode="date"
                          display="default"
                          onChange={handleDateChange}
                          minimumDate={new Date()}
                        />
                      )}
                      {showTimePicker && Platform.OS === "android" && (
                        <DateTimePicker
                          value={eventDate || getDefaultDateTime()}
                          mode="time"
                          display="default"
                          onChange={handleTimeChange}
                        />
                      )}

                      {/* Event Type */}
                      <LiquidGlassCard
                        variant="event"
                        title="Event Type"
                        style={{ marginBottom: 16 }}
                      >
                        <View style={{ gap: 8 }}>
                          {EVENT_TYPES.map((eventType) => (
                            <Pressable
                              key={eventType.id}
                              onPress={() => {
                                Haptics.selectionAsync();
                                setType(eventType.id);
                              }}
                              style={{
                                backgroundColor:
                                  type === eventType.id
                                    ? "rgba(10, 149, 255, 0.2)"
                                    : "rgba(255, 255, 255, 0.05)",
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor:
                                  type === eventType.id
                                    ? "#0A95FF"
                                    : "rgba(255, 255, 255, 0.1)",
                                padding: 12,
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 15,
                                    fontWeight: "700",
                                    color: colors.text,
                                    marginBottom: 2,
                                  }}
                                >
                                  {eventType.label}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.textSecondary,
                                  }}
                                >
                                  {eventType.example}
                                </Text>
                              </View>
                              {type === eventType.id && (
                                <Text style={{ fontSize: 18, color: "#0A95FF" }}>✓</Text>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      </LiquidGlassCard>

                      {/* Options Toggle/Section */}
                      {!showOptions ? (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            setShowOptions(true);
                          }}
                          style={{
                            backgroundColor: "rgba(10, 149, 255, 0.1)",
                            borderRadius: 14,
                            borderWidth: 2,
                            borderColor: "rgba(10, 149, 255, 0.3)",
                            borderStyle: "dashed",
                            padding: 18,
                            marginBottom: 16,
                            alignItems: "center",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: "rgba(10, 149, 255, 0.2)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ fontSize: 18, color: "#0A95FF" }}>+</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "600",
                                  color: colors.text,
                                  marginBottom: 4,
                                }}
                              >
                                Add Voting Options?
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: colors.textSecondary,
                                  lineHeight: 18,
                                }}
                              >
                                Do you need to give options or choices for your friends to vote on for this event?
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      ) : (
                        <LiquidGlassCard
                          variant="event"
                          title="Voting Options (Min 2)"
                          subtitle="Add choices for people to vote on"
                          style={{ marginBottom: 16 }}
                        >
                          <View style={{ gap: 10 }}>
                            {options.map((option, index) => (
                              <View
                                key={index}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <TextInput
                                    value={option}
                                    onChangeText={(value) => updateOption(index, value)}
                                    placeholder={
                                      type === "meeting" || type === "hangout"
                                        ? "e.g., Saturday 7pm"
                                        : type === "meal"
                                        ? "e.g., Italian Restaurant"
                                        : type === "activity"
                                        ? "e.g., Watch a movie"
                                        : "Option " + (index + 1)
                                    }
                                    placeholderTextColor={colors.inputPlaceholder}
                                    keyboardAppearance={isDark ? "dark" : "light"}
                                    style={{
                                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
                                      borderRadius: 10,
                                      padding: 12,
                                      fontSize: 15,
                                      color: colors.text,
                                    }}
                                  />
                                </View>
                                {options.length > 2 && (
                                  <Pressable
                                    onPress={() => removeOption(index)}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 16,
                                      backgroundColor: "rgba(255, 59, 48, 0.2)",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text style={{ fontSize: 16, color: "#FF3B30" }}>
                                      ✕
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            ))}

                            {options.length < 10 && (
                              <Pressable
                                onPress={addOption}
                                style={{
                                  backgroundColor: "rgba(10, 149, 255, 0.15)",
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: "rgba(10, 149, 255, 0.3)",
                                  borderStyle: "dashed",
                                  padding: 12,
                                  alignItems: "center",
                                  marginTop: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    color: "#0A95FF",
                                    fontWeight: "600",
                                  }}
                                >
                                  + Add Option
                                </Text>
                              </Pressable>
                            )}

                            {/* Remove Options Button */}
                            <Pressable
                              onPress={() => {
                                Haptics.selectionAsync();
                                setShowOptions(false);
                                setOptions(["", ""]);
                              }}
                              style={{
                                backgroundColor: "rgba(255, 59, 48, 0.1)",
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: "rgba(255, 59, 48, 0.3)",
                                padding: 10,
                                alignItems: "center",
                                marginTop: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: "#FF3B30",
                                  fontWeight: "600",
                                }}
                              >
                                Remove Options Section
                              </Text>
                            </Pressable>
                          </View>
                        </LiquidGlassCard>
                      )}
                    </ScrollView>

                    {/* Actions */}
                    <View
                      style={{
                        paddingHorizontal: 24,
                        paddingTop: 16,
                        paddingBottom: 16,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <LiquidGlassButton
                        onPress={handleCreate}
                        variant="primary"
                        size="large"
                        disabled={!canCreate}
                        loading={isCreating}
                      >
                        {initialEvent ? "Update Event" : "Create Event 🎉"}
                      </LiquidGlassButton>
                    </View>
                  </LinearGradient>
                </BlurView>
                </View>
              </SafeAreaView>
            </KeyboardAvoidingView>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

export default CreateEventModal;

