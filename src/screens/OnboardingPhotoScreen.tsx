import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackScreenProps } from "@/navigation/types";
import { useUser } from "@/contexts/UserContext";
import { api, BACKEND_URL } from "@/lib/api";
import type { UploadImageResponse, JoinChatViaInviteResponse, GetInviteInfoResponse } from "@/shared/contracts";

const OnboardingPhotoScreen = () => {
  const navigation = useNavigation<RootStackScreenProps<"OnboardingPhoto">["navigation"]>();
  const route = useRoute<RootStackScreenProps<"OnboardingPhoto">["route"]>();
  const { user, updateUser } = useUser();
  const { name, bio } = route.params;

  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

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

    // Shimmer animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ])
    ).start();
  }, []);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 400],
  });

  const pickImageFromLibrary = async () => {
    try {
      Haptics.selectionAsync();

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Permission to access photos is required!");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setImage(uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const takePhoto = async () => {
    try {
      Haptics.selectionAsync();

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Permission to access camera is required!");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setImage(uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Use FileSystem.uploadAsync for proper file upload in React Native
      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/upload/image`,
        uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "image",
          // Don't set Content-Type header - let FileSystem set it automatically with boundary
        }
      );

      if (uploadResult.status === 200) {
        const response: UploadImageResponse = JSON.parse(uploadResult.body);
        if (response.success) {
          return response.url;
        }
      }

      throw new Error(`Upload failed with status ${uploadResult.status}`);
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handlePendingInvite = async (userId: string) => {
    try {
      // Check if there's a pending invite token
      const pendingToken = await SecureStore.getItemAsync("pendingInviteToken");
      if (pendingToken) {
        console.log("[Onboarding] Found pending invite token:", pendingToken);

        // Join the chat via invite
        const response = await api.post<JoinChatViaInviteResponse>(`/api/invite/${pendingToken}/join`, { userId });

        // Clear the pending token
        await SecureStore.deleteItemAsync("pendingInviteToken");

        if (response.success) {
          console.log("[Onboarding] Successfully joined chat via invite");
          // Fetch chat info to get the name
          const inviteInfo = await api.get<GetInviteInfoResponse>(`/api/invite/${pendingToken}`);

          // Navigate to the chat instead of chat list
          navigation.replace("Chat", {
            chatId: response.chatId,
            chatName: inviteInfo.chatName || "Chat",
          });
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("[Onboarding] Error handling pending invite:", error);
      // Continue to chat list if invite fails
      return false;
    }
  };

  const handleContinueWithPhoto = async () => {
    if (!image) return;

    try {
      setIsSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const imageUrl = await uploadImage(image);

      await updateUser({
        name,
        bio,
        image: imageUrl || undefined,
        hasCompletedOnboarding: true,
      });

      // Check for pending invite and navigate accordingly
      if (user?.id) {
        const handledInvite = await handlePendingInvite(user.id);

        if (!handledInvite) {
          navigation.replace("ChatList", undefined);
        }
      } else {
        navigation.replace("ChatList", undefined);
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      setIsSubmitting(true);
      Haptics.selectionAsync();

      await updateUser({
        name,
        bio,
        hasCompletedOnboarding: true,
      });

      // Check for pending invite and navigate accordingly
      if (user?.id) {
        const handledInvite = await handlePendingInvite(user.id);

        if (!handledInvite) {
          navigation.replace("ChatList", undefined);
        }
      } else {
        navigation.replace("ChatList", undefined);
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Animated Gradient Background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={["#000000", "#0A0A0F", "#050508", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
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
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
      
      <Animated.View
        className="flex-1 px-6 pt-24 pb-8"
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Header */}
        <View className="items-center mb-8">
          <MaskedView
            maskElement={
              <Text className="text-2xl font-bold text-center">
                Add a Profile Photo
              </Text>
            }
            style={{ height: 32, width: "100%" }}
          >
            <LinearGradient
              colors={["#3B82F6", "#4FC3F7", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </MaskedView>
          <Text className="text-base text-gray-600 text-center mt-2">
            Help others recognize you (optional)
          </Text>
        </View>

        {/* Photo Display */}
        <View className="items-center mb-8">
          <View className="w-40 h-40 rounded-full bg-gray-200 items-center justify-center mb-4 overflow-hidden">
            {image ? (
              <Image
                source={{ uri: image }}
                style={{ width: 160, height: 160 }}
              />
            ) : (
              <ImageIcon size={60} color="#9CA3AF" />
            )}
          </View>
        </View>

        {/* Photo Options */}
        <View className="mb-8 gap-3">
          <Pressable
            onPress={takePhoto}
            disabled={isUploading || isSubmitting}
            style={{ overflow: 'hidden', borderRadius: 16 }}
          >
            <LinearGradient
              colors={["#3B82F6", "#4FC3F7", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={20} color="#FFFFFF" />
              <Text className="text-white text-base font-semibold ml-2">
                Take Photo
              </Text>

              {/* Shimmer Overlay */}
              <Animated.View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 60,
                  transform: [
                    { translateX: shimmerTranslate },
                    { skewX: "-20deg" }
                  ],
                }}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255, 255, 255, 0.4)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={pickImageFromLibrary}
            disabled={isUploading || isSubmitting}
            style={{ overflow: 'hidden', borderRadius: 16 }}
          >
            <LinearGradient
              colors={["#3B82F6", "#4FC3F7", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageIcon size={20} color="#FFFFFF" />
              <Text className="text-white text-base font-semibold ml-2">
                Choose from Library
              </Text>

              {/* Shimmer Overlay */}
              <Animated.View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 60,
                  transform: [
                    { translateX: shimmerTranslate },
                    { skewX: "-20deg" }
                  ],
                }}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255, 255, 255, 0.4)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Buttons */}
        <View className="mt-auto gap-3">
          {image && (
            <Pressable
              onPress={handleContinueWithPhoto}
              disabled={isSubmitting || isUploading}
            >
              <LinearGradient
                colors={["#4FC3F7", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                {isSubmitting || isUploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-base font-semibold">
                    Continue with Photo
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          )}

          <Pressable
            onPress={handleSkip}
            disabled={isSubmitting || isUploading}
            className="py-4"
          >
            <Text style={{ color: "rgba(255, 255, 255, 0.7)", textAlign: "center", fontSize: 16, fontWeight: "500" }}>
              Skip for Now
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

export default OnboardingPhotoScreen;
