import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  Animated,
  Keyboard,
  Easing,
  TouchableWithoutFeedback,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { useUser } from "@/contexts/UserContext";
import { useAnalytics, useScreenTracking } from "@/hooks/useAnalytics";
import type { CreateChatRequest, CreateChatResponse } from "@/shared/contracts";

const { width, height } = Dimensions.get("window");

const CreateChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  const [newChatName, setNewChatName] = useState("");
  const [newChatBio, setNewChatBio] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Track screen view
  useScreenTracking("CreateChat");

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

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: (data: CreateChatRequest) => api.post<CreateChatResponse>("/api/chats", data),
    onSuccess: (newChat: CreateChatResponse) => {
      // Track chat creation
      analytics.capture('chat_created', {
        chat_type: 'group',
        has_bio: !!newChat.bio,
        chat_id: newChat.id,
      });
      
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      setNewChatName("");
      setNewChatBio("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset the tab to Chats so back button goes to list
      navigation.navigate("Chats");

      // Navigate to the new chat
      navigation.navigate("Chat", {
        chatId: newChat.id,
        chatName: newChat.name,
      });
    },
    onError: (error: any) => {
      console.error("Error creating chat:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to create chat. Please try again.");
    },
  });

  const handleCreateChat = async () => {
    if (!newChatName.trim()) {
      Alert.alert("Name Required", "Please enter a chat name");
      return;
    }

    setIsCreating(true);
    try {
      await createChatMutation.mutateAsync({
        name: newChatName.trim(),
        bio: newChatBio.trim() || null,
        creatorId: user!.id,
      });
    } finally {
      setIsCreating(false);
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Mascot Logo - Centered Top */}
          <Animated.View
            style={{
              alignItems: "center",
              justifyContent: "center",
              marginTop: insets.top + 20,
              opacity: isKeyboardVisible ? 0.5 : 1,
              transform: [
                { scale: isKeyboardVisible ? 0.7 : imageScaleAnim },
                { translateY: isKeyboardVisible ? -30 : 0 }
              ],
              height: isKeyboardVisible ? height * 0.2 : height * 0.35,
            }}
          >
             {/* Glowing background effect */}
             <View style={{
               position: "absolute",
               width: 220,
               height: 220,
               backgroundColor: "rgba(0, 198, 255, 0.15)",
               borderRadius: 110,
               top: "15%",
             }} />
             
            <Image
              source={require("../../assets/vibechat mascot logo.png")}
              style={{ 
                width: width * 0.85, 
                height: width * 0.85,
                maxWidth: 380,
                maxHeight: 380,
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
                paddingBottom: isKeyboardVisible ? 20 : 40,
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Create New Chat</Text>
              <Text style={styles.subtitle}>Start a new group conversation</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Chat Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  value={newChatName}
                  onChangeText={setNewChatName}
                  placeholder="Enter chat name..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  maxLength={100}
                  keyboardAppearance="dark"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  value={newChatBio}
                  onChangeText={setNewChatBio}
                  placeholder="What's this chat about?"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  maxLength={200}
                  multiline
                  numberOfLines={3}
                  keyboardAppearance="dark"
                  style={[styles.input, styles.textArea]}
                />
              </View>

              <Pressable
                onPress={handleCreateChat}
                disabled={isCreating || !newChatName.trim()}
                style={({ pressed }) => ({
                  opacity: pressed || isCreating || !newChatName.trim() ? 0.7 : 1,
                  marginTop: 10,
                })}
              >
                <LinearGradient
                  colors={["#0061FF", "#00C6FF", "#00E676"]} // New VibeChat Gradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  {isCreating ? (
                    <LuxeLogoLoader size={20} />
                  ) : (
                    <Text style={styles.buttonText}>Create Chat</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
          </View>
        </TouchableWithoutFeedback>
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
  overlayGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 4,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  button: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0061FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});

export default CreateChatScreen;
