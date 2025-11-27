import React, { useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";

const JoinChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

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

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#000000", "#0A0A0F", "#050508", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.flexOne}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flexOne}
      >
        <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>Join Chat</Text>
          <Text style={styles.subtitle}>Enter an invite code to join a group</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Invite Code <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Enter 8-character code..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                maxLength={8}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.helperText}>
                Enter the invite code shared with you
              </Text>
            </View>

            <Pressable
              onPress={handleJoinChat}
              disabled={isJoining || !inviteCode.trim()}
              style={({ pressed }) => ({
                opacity: pressed || isJoining || !inviteCode.trim() ? 0.7 : 1,
                marginTop: 20,
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
      </KeyboardAvoidingView>
    </View>
  );
};

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
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
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
    color: "#FFFFFF",
  },
  required: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
  },
  helperText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
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

