import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { authClient, supabaseClient } from "@/lib/authClient"; // Keep for onAuthStateChange if needed
import type { User } from "@/shared/contracts";

export default function PhoneAuthScreen() {
  const navigation = useNavigation<any>();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  const formatPhoneNumber = (text: string) => {
    const digits = text.replace(/\D/g, "");
    if (digits.startsWith("1")) {
      return `+${digits}`;
    } else if (digits.length > 0) {
      return `+1${digits}`;
    }
    return "";
  };

  const handleSendCode = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert("Invalid Phone", "Please enter a valid phone number");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Ensure E.164 format (start with +)
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

    Haptics.selectionAsync();
    setLoading(true);
    try {
      console.log("[PhoneAuth] Sending OTP to:", formattedPhone);
      
      // Use backend proxy for better logging and control
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        "/api/auth/send-otp", 
        { phone: formattedPhone }
      );

      console.log("[PhoneAuth] Send OTP response:", response);

      if (response.error) {
        throw new Error(response.error);
      }

      // Animate transition
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      setStep("code");
    } catch (error: any) {
      console.error("[PhoneAuth] Error sending code:", error);
      // Show detailed error from backend if available
      const errorMessage = error.message || "Failed to send verification code. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Ensure E.164 format
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

    Haptics.selectionAsync();
    setLoading(true);
    try {
      console.log("[PhoneAuth] Verifying OTP for:", formattedPhone);

      // Use backend proxy to verify and get/create user in one step
      const response = await api.post<{ token: string; refreshToken: string; user: User }>(
        "/api/auth/verify-otp",
        { phone: formattedPhone, code }
      );

      console.log("[PhoneAuth] Verify OTP response:", response);

      if (!response.token || !response.refreshToken || !response.user) {
        throw new Error("Invalid response from server");
      }

      // Manually set the session in the frontend Supabase client
      // This ensures authClient.getToken() works for subsequent API calls
      const { error: sessionError } = await supabaseClient.auth.setSession({
        access_token: response.token,
        refresh_token: response.refreshToken,
      });

      if (sessionError) {
        console.error("[PhoneAuth] Failed to set session:", sessionError);
        throw new Error("Failed to initialize session");
      }

      const { user } = response;

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to Birthdate Screen if new user or hasn't completed onboarding
      if (!user.birthdate) {
         // Add a small delay for effect
         setTimeout(() => {
             navigation.navigate("Birthdate", { 
                 userId: user.id, 
                 hasCompletedOnboarding: user.hasCompletedOnboarding 
             });
         }, 500);
      } else if (user.hasCompletedOnboarding) {
        navigation.navigate("MainTabs");
      } else {
        navigation.navigate("OnboardingName");
      }

    } catch (error: any) {
      console.error("[PhoneAuth] Error verifying code:", error);
      const errorMessage = error.message || "Verification failed. Please try again.";
      Alert.alert("Error", errorMessage);
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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flexOne}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              paddingBottom: isKeyboardVisible ? 20 : 60,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === "phone" ? "Enter your phone number" : "Verify your number"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "phone"
                ? "VibeChat will need to verify your account. Carrier charges may apply."
                : `Enter the code we sent to ${phone}`}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <BlurView intensity={Platform.OS === "ios" ? 30 : 60} tint="dark" style={styles.blurContainer}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"]}
                style={styles.inputGradient}
              >
                <TextInput
                  style={styles.input}
                  placeholder={step === "phone" ? "+1 239 699 8960" : "000 000"}
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  value={step === "phone" ? phone : code}
                  onChangeText={step === "phone" ? (t) => setPhone(formatPhoneNumber(t)) : setCode}
                  keyboardType={step === "phone" ? "phone-pad" : "number-pad"}
                  autoFocus
                  maxLength={step === "phone" ? 15 : 6}
                  selectionColor="#3B82F6"
                />
              </LinearGradient>
            </BlurView>
          </View>

          <Pressable
            onPress={step === "phone" ? handleSendCode : handleVerifyCode}
            disabled={loading}
            style={styles.buttonContainer}
          >
            <LinearGradient
              colors={
                loading
                  ? ["#333", "#444"]
                  : ["#3B82F6", "#4FC3F7", "#EC4899"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {step === "phone" ? "Next" : "Verify"}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {step === "code" && (
            <Pressable onPress={() => setStep("phone")} style={styles.backButton}>
              <Text style={styles.backButtonText}>Change Phone Number</Text>
            </Pressable>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
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
    paddingHorizontal: 20,
  },
  inputContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  blurContainer: {
    borderRadius: 16,
  },
  inputGradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  input: {
    fontSize: 24,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 2,
    fontWeight: "600",
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
  backButton: {
    marginTop: 24,
    alignItems: "center",
    padding: 12,
  },
  backButtonText: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
});
