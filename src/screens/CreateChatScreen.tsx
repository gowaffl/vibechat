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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import type { CreateChatRequest, CreateChatResponse } from "@/shared/contracts";

const CreateChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [newChatName, setNewChatName] = useState("");
  const [newChatBio, setNewChatBio] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: (data: CreateChatRequest) => api.post<CreateChatResponse>("/api/chats", data),
    onSuccess: (newChat: CreateChatResponse) => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      setNewChatName("");
      setNewChatBio("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to the new chat
      // We need to go to the Chat screen which is in the RootStack
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
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flexOne}
      >
        <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>Create New Chat</Text>
          <Text style={styles.subtitle}>Start a new group conversation</Text>

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
                style={[styles.input, styles.textArea]}
              />
            </View>

            <Pressable
              onPress={handleCreateChat}
              disabled={isCreating || !newChatName.trim()}
              style={({ pressed }) => ({
                opacity: pressed || isCreating || !newChatName.trim() ? 0.7 : 1,
                marginTop: 20,
              })}
            >
              <LinearGradient
                colors={["#4FC3F7", "#00A8E8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Create Chat</Text>
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
    fontSize: 16,
    color: "#FFFFFF",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
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

export default CreateChatScreen;

