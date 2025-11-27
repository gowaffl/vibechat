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
  Dimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "@/lib/api";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { OnboardingProgress } from "@/components/OnboardingProgress";

const { width, height } = Dimensions.get("window");

export default function BirthdateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, hasCompletedOnboarding } = route.params || {};
  
  const [date, setDate] = useState(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const imageScaleAnim = useRef(new Animated.Value(0.9)).current;

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
      Animated.spring(imageScaleAnim, {
        toValue: 1,
        tension: 40,
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

      <View style={{ flex: 1, paddingTop: 60 }}>
         {/* Top Progress Bar */}
         <View style={{ alignItems: "center", marginBottom: 20 }}>
           <OnboardingProgress totalSteps={4} currentStep={1} />
         </View>

         {/* Main Content */}
         <View style={{ flex: 1 }}>
            {/* Glitch Mascot - Centered Top */}
            <Animated.View
              style={{
                alignItems: "center",
                justifyContent: "center",
                marginTop: 10,
                transform: [{ scale: imageScaleAnim }],
                height: height * 0.35,
              }}
            >
               {/* Glowing background effect behind Glitch */}
               <View style={{
                 position: "absolute",
                 width: 200,
                 height: 200,
                 backgroundColor: "rgba(236, 72, 153, 0.15)", // Pink glow for Bday
                 borderRadius: 100,
                 top: "15%",
               }} />
               
              <Image
                source={require("../../assets/glitch_bday.png")}
                style={{ 
                  width: width * 0.8, 
                  height: width * 0.8,
                  maxWidth: 350,
                  maxHeight: 350,
                }}
                contentFit="contain"
              />
            </Animated.View>

            {/* Bottom Input Section */}
      <Animated.View
        style={[
                styles.bottomSheet,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
                <Text style={styles.title}>When's your birthday?</Text>
          <Text style={styles.subtitle}>
                  Just to make sure you're old enough to vibe. We won't show this on your profile.
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
            colors={["#0061FF", "#00C6FF", "#00E676"]} // New VibeChat Gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            {loading ? (
              <LuxeLogoLoader size={20} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
         </View>
      </View>
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
  bottomSheet: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 32,
    paddingBottom: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
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
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePicker: {
    width: "100%",
    height: 180,
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
