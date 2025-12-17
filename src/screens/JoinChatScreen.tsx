import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Image,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { useTheme } from "@/contexts/ThemeContext";

const { height } = Dimensions.get("window");

const JoinChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();

  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Animation refs
  const imageScaleAnim = useRef(new Animated.Value(1)).current;

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

  const handleJoinChat = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Code Required", "Please enter an invite code");
      return;
    }

    setIsJoining(true);
    try {
      // Navigate to the Invite screen with the token
      // The Invite screen handles the actual joining logic via API
      setInviteCode("");
      navigation.navigate("Invite", { token: inviteCode.trim() });
    } catch (error) {
      console.error("Error joining chat:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to join chat. Please check the invite code and try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const backgroundGradientColors = isDark 
    ? ["#000000", "#0A0A0F", "#050508", "#000000"]
    : [colors.background, colors.backgroundSecondary, colors.surfaceSecondary, colors.background];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Background */}
        <View style={styles.backgroundContainer}>
          <LinearGradient
            colors={backgroundGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.flexOne}
          />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flexOne}
        >
          <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
            {/* Glitch Thinking Image - Top Center */}
            <Animated.View
              style={[
                styles.imageContainer,
                {
                  opacity: isKeyboardVisible ? 0.5 : 1,
                  transform: [
                    { scale: isKeyboardVisible ? 0.7 : 1 },
                    { translateY: isKeyboardVisible ? -40 : 0 }
                  ],
                  height: isKeyboardVisible ? height * 0.2 : height * 0.35,
                }
              ]}
            >
              {/* Glowing background circle */}
              <View style={[styles.glowingCircle, { backgroundColor: isDark ? "rgba(79, 195, 247, 0.15)" : "rgba(0, 122, 255, 0.1)" }]} />
              
              <Image
                source={require("../../assets/glitch_thinking.png")}
                style={styles.glitchImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Form - Bottom */}
            <View style={styles.formContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Join Chat</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enter an invite code to join a group</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Invite Code <Text style={[styles.required, { color: colors.error }]}>*</Text>
                </Text>
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Enter 8-character code..."
                  placeholderTextColor={colors.inputPlaceholder}
                  maxLength={8}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardAppearance={isDark ? "dark" : "light"}
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: colors.inputBackground, 
                      borderColor: colors.border, 
                      color: colors.text 
                    }
                  ]}
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Enter the invite code shared with you
                </Text>
              </View>

              <Pressable
                onPress={handleJoinChat}
                disabled={isJoining || !inviteCode.trim()}
                style={({ pressed }) => ({
                  opacity: pressed || isJoining || !inviteCode.trim() ? 0.7 : 1,
                  marginTop: 20,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                })}
              >
                <LinearGradient
                  colors={["#0061FF", "#00C6FF", "#00E676"]} // New VibeChat Gradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  {isJoining ? (
                    <LuxeLogoLoader size={20} />
                  ) : (
                    <Text style={styles.buttonText}>Join Chat</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  glowingCircle: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  glitchImage: {
    width: 300,
    height: 300,
  },
  formContainer: {
    paddingBottom: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  required: {
    color: "#EF4444",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
  },
  helperText: {
    fontSize: 13,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default JoinChatScreen;
