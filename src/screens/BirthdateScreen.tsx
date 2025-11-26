import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "@/lib/api";

export default function BirthdateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, hasCompletedOnboarding } = route.params || {};
  
  const [date, setDate] = useState(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID is missing. Please try logging in again.");
      navigation.navigate("PhoneAuth");
      return;
    }

    // Check age (must be at least 13)
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
      age--;
    }

    if (age < 13) {
      Alert.alert("Age Requirement", "You must be at least 13 years old to use VibeChat.");
      return;
    }

    setLoading(true);
    Haptics.selectionAsync();

    try {
      // Update user with birthdate
      await api.patch(`/api/users/${userId}`, {
        birthdate: date.toISOString(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (hasCompletedOnboarding) {
        navigation.navigate("MainTabs", { screen: "Chats" });
      } else {
        navigation.navigate("OnboardingName");
      }
    } catch (error) {
      console.error("Failed to update birthdate:", error);
      Alert.alert("Error", "Failed to save birthdate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Animated Gradient Background */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#000000", "#0A0A0F", "#050508", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.flexOne}
        />
        <LinearGradient
          colors={[
            "rgba(79, 195, 247, 0.05)",
            "rgba(0, 122, 255, 0.03)",
            "transparent",
            "rgba(52, 199, 89, 0.03)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overlayGradient}
        />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>When were you born?</Text>
          <Text style={styles.subtitle}>
            This is required to ensure safety settings. Your birthdate will not be shown publicly.
          </Text>
        </View>

        <View style={styles.pickerContainer}>
          <BlurView intensity={Platform.OS === "ios" ? 30 : 60} tint="dark" style={styles.blurContainer}>
             <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  const currentDate = selectedDate || date;
                  setDate(currentDate);
                }}
                textColor="white"
                themeVariant="dark"
                style={styles.datePicker}
                maximumDate={new Date()}
              />
          </BlurView>
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={loading}
          style={styles.buttonContainer}
        >
          <LinearGradient
            colors={["#3B82F6", "#4FC3F7", "#EC4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  flexOne: {
    flex: 1,
  },
  backgroundContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  pickerContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  blurContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePicker: {
    width: "100%",
    height: 200,
  },
  buttonContainer: {
    overflow: "hidden",
    borderRadius: 16,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

