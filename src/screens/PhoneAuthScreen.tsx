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
  StyleSheet,
  Keyboard,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { authClient, supabaseClient } from "@/lib/authClient";
import type { User } from "@/shared/contracts";
import { useTheme } from "@/contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

export default function PhoneAuthScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

    Haptics.selectionAsync();
    setLoading(true);
    try {
      console.log("[PhoneAuth] Sending OTP to:", formattedPhone);
      
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        "/api/auth/send-otp", 
        { phone: formattedPhone }
      );

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

    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

    Haptics.selectionAsync();
    setLoading(true);
    try {
      console.log("[PhoneAuth] Verifying OTP for:", formattedPhone);

      const response = await api.post<{ token: string; refreshToken: string; user: User }>(
        "/api/auth/verify-otp",
        { phone: formattedPhone, code }
      );

      if (!response.token || !response.refreshToken || !response.user) {
        throw new Error("Invalid response from server");
      }

      const { error: sessionError } = await supabaseClient.auth.setSession({
        access_token: response.token,
        refresh_token: response.refreshToken,
      });

      if (sessionError) {
        console.error("[PhoneAuth] Failed to set session:", sessionError);
        throw new Error("Failed to initialize session");
      }

      const { user } = response;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (!user.birthdate) {
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Animated Gradient Background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={isDark ? ["#000000", "#0A0A0F", "#050508", "#000000"] : [colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        <LinearGradient
          colors={[
            isDark ? "rgba(79, 195, 247, 0.05)" : "rgba(0, 122, 255, 0.05)",
            isDark ? "rgba(0, 122, 255, 0.03)" : "rgba(0, 122, 255, 0.02)",
            "transparent",
            isDark ? "rgba(52, 199, 89, 0.03)" : "rgba(52, 199, 89, 0.02)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>

      <View style={{ flex: 1, paddingTop: 60 }}>
        {/* Top Progress Bar */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <OnboardingProgress totalSteps={4} currentStep={0} />
        </View>

        {/* Main Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flexOne}
      >
          <View style={{ flex: 1 }}>
            {/* Glitch Mascot - Centered Top */}
            <Animated.View
              style={{
                alignItems: "center",
                justifyContent: "center",
                marginTop: 20,
                opacity: isKeyboardVisible ? 0.5 : 1, // Fade out slightly when keyboard is open
                transform: [
                  { scale: isKeyboardVisible ? 0.8 : imageScaleAnim }, // Shrink slightly when keyboard open
                  { translateY: isKeyboardVisible ? -20 : 0 }
                ],
                height: height * 0.35,
              }}
            >
               {/* Glowing background effect behind Glitch */}
               <View style={{
                 position: "absolute",
                 width: 200,
                 height: 200,
                 backgroundColor: "rgba(59, 130, 246, 0.15)",
                 borderRadius: 100,
                 top: "15%",
               }} />
               
              <Image
                source={require("../../assets/glitch_phonenumber.png")}
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
                  paddingBottom: isKeyboardVisible ? 20 : 50,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 12, textAlign: "center" }}>
                  {step === "phone" ? "What's your number?" : "Verify it's you"}
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 24, paddingHorizontal: 20 }}>
              {step === "phone"
                    ? "We'll text you a code to verify your phone."
                    : `Enter the code sent to ${phone}`}
            </Text>
          </View>

          <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 24, borderWidth: 1, borderColor: colors.glassBorder }}>
            <BlurView intensity={isDark ? 60 : 80} tint={isDark ? "dark" : "light"} style={styles.blurContainer}>
              <LinearGradient
                colors={isDark ? ["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.03)"] : ["rgba(255, 255, 255, 0.6)", "rgba(255, 255, 255, 0.4)"]}
                style={styles.inputGradient}
              >
                <TextInput
                  style={{ fontSize: 24, color: colors.text, textAlign: "center", letterSpacing: 2, fontWeight: "600" }}
                      placeholder={step === "phone" ? "+1 555 000 0000" : "000 000"}
                  placeholderTextColor={colors.inputPlaceholder}
                  value={step === "phone" ? phone : code}
                  onChangeText={step === "phone" ? (t) => setPhone(formatPhoneNumber(t)) : setCode}
                  keyboardType={step === "phone" ? "phone-pad" : "number-pad"}
                      autoFocus={false} 
                  maxLength={step === "phone" ? 15 : 6}
                  selectionColor={colors.primary}
                  keyboardAppearance={isDark ? "dark" : "light"}
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
                  : ["#0061FF", "#00C6FF", "#00E676"] // New VibeChat Gradient
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <LuxeLogoLoader size={20} />
              ) : (
                <Text style={styles.buttonText}>
                  {step === "phone" ? "Next" : "Verify"}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {step === "code" && (
            <Pressable onPress={() => setStep("phone")} style={styles.backButton}>
                  <Text style={styles.backButtonText}>Change Number</Text>
            </Pressable>
          )}
        </Animated.View>
          </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
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
    paddingHorizontal: 20,
  },
  inputContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
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
    marginBottom: 10,
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
    marginTop: 16,
    alignItems: "center",
    padding: 12,
  },
  backButtonText: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
});
