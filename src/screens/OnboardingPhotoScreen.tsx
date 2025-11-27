import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Image as RNImage,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import type { RootStackScreenProps } from "@/navigation/types";
import { useUser } from "@/contexts/UserContext";
import { api, BACKEND_URL } from "@/lib/api";
import type { UploadImageResponse, JoinChatViaInviteResponse, GetInviteInfoResponse } from "@/shared/contracts";

const { width, height } = Dimensions.get("window");

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
  const imageScaleAnim = useRef(new Animated.Value(0.9)).current;
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
      Animated.spring(imageScaleAnim, {
        toValue: 1,
        tension: 40,
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

      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/upload/image`,
        uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "image",
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
      const pendingToken = await SecureStore.getItemAsync("pendingInviteToken");
      if (pendingToken) {
        console.log("[Onboarding] Found pending invite token:", pendingToken);
        const response = await api.post<JoinChatViaInviteResponse>(`/api/invite/${pendingToken}/join`, { userId });
        await SecureStore.deleteItemAsync("pendingInviteToken");

        if (response.success) {
          console.log("[Onboarding] Successfully joined chat via invite");
          const inviteInfo = await api.get<GetInviteInfoResponse>(`/api/invite/${pendingToken}`);
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

      if (user?.id) {
        const handledInvite = await handlePendingInvite(user.id);
        if (!handledInvite) {
          navigation.replace("MainTabs");
        }
      } else {
        navigation.replace("MainTabs");
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

      if (user?.id) {
        const handledInvite = await handlePendingInvite(user.id);
        if (!handledInvite) {
          navigation.replace("MainTabs");
        }
      } else {
        navigation.replace("MainTabs");
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
      
      <View style={{ flex: 1, paddingTop: 60 }}>
         {/* Top Progress Bar */}
         <View style={{ alignItems: "center", marginBottom: 20 }}>
           <OnboardingProgress totalSteps={4} currentStep={3} />
         </View>

         {/* Glitch Mascot - Centered Top */}
         <Animated.View
            style={{
              alignItems: "center",
              justifyContent: "center",
              marginTop: 10,
              transform: [{ scale: imageScaleAnim }],
              height: height * 0.25,
            }}
          >
             {/* Glowing background effect */}
             <View style={{
               position: "absolute",
               width: 180,
               height: 180,
               backgroundColor: "rgba(59, 130, 246, 0.15)", // Blue glow
               borderRadius: 90,
               top: "15%",
             }} />
             
            <Image
              source={require("../../assets/glitch_photo.png")}
              style={{ 
                width: width * 0.6, 
                height: width * 0.6,
                maxWidth: 300,
                maxHeight: 300,
              }}
              contentFit="contain"
            />
          </Animated.View>
      
      <Animated.View
            className="flex-1 px-6 pb-8"
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
              justifyContent: "flex-end",
        }}
      >
        {/* Header */}
        <View className="items-center mb-8">
              <Text style={{ fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginBottom: 12, textAlign: "center" }}>
                One last thing...
              </Text>
              <Text style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)", textAlign: "center", paddingHorizontal: 16 }}>
                Add a profile photo so your friends can recognize you.
          </Text>
        </View>

            {/* Photo Preview */}
        <View className="items-center mb-8">
              <View 
                style={{
                    width: 120, 
                    height: 120, 
                    borderRadius: 60, 
                    backgroundColor: "rgba(255,255,255,0.1)", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: image ? "#3B82F6" : "rgba(255,255,255,0.2)"
                }}
              >
            {image ? (
              <Image
                source={{ uri: image }}
                    style={{ width: 120, height: 120 }}
                    contentFit="cover"
              />
            ) : (
                  <ImageIcon size={48} color="rgba(255,255,255,0.3)" />
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
                  colors={["rgba(59, 130, 246, 0.2)", "rgba(59, 130, 246, 0.1)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: "center",
                justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(59, 130, 246, 0.5)"
              }}
            >
                  <Camera size={20} color="#3B82F6" />
              <Text className="text-white text-base font-semibold ml-2">
                Take Photo
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={pickImageFromLibrary}
            disabled={isUploading || isSubmitting}
            style={{ overflow: 'hidden', borderRadius: 16 }}
          >
            <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: "center",
                justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)"
              }}
            >
              <ImageIcon size={20} color="#FFFFFF" />
              <Text className="text-white text-base font-semibold ml-2">
                Choose from Library
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Buttons */}
            <View className="gap-3">
          {image && (
            <Pressable
              onPress={handleContinueWithPhoto}
              disabled={isSubmitting || isUploading}
                  style={{ borderRadius: 16, overflow: "hidden", marginBottom: 8 }}
            >
              <LinearGradient
                    colors={["#0061FF", "#00C6FF", "#00E676"]} // New VibeChat Gradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                      paddingVertical: 18,
                  alignItems: "center",
                }}
              >
                {isSubmitting || isUploading ? (
                  <LuxeLogoLoader size={20} />
                ) : (
                      <Text className="text-white text-lg font-bold">
                        Looks Good!
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
                <Text style={{ color: "rgba(255, 255, 255, 0.5)", textAlign: "center", fontSize: 16, fontWeight: "500" }}>
                  {image ? "Cancel" : "Skip for Now"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
      </View>
    </View>
  );
};

export default OnboardingPhotoScreen;
