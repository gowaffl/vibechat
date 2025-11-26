import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Camera, User as UserIcon, Bell, BellOff } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useUser } from "@/contexts/UserContext";
import { BACKEND_URL, api } from "@/lib/api";
import type { UploadImageResponse } from "@/shared/contracts";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, loading, updateUser } = useUser();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Keyboard listener
  React.useEffect(() => {
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

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    console.log("[ProfileScreen] Starting image upload...", uri);
    try {
      const filename = uri.split("/").pop() || "photo.jpg";
      console.log("[ProfileScreen] Filename:", filename);
      console.log("[ProfileScreen] Upload URL:", `${BACKEND_URL}/api/upload/image`);

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

      console.log("[ProfileScreen] Upload result status:", uploadResult.status);
      console.log("[ProfileScreen] Upload result body:", uploadResult.body);

      if (uploadResult.status === 200) {
        const response: UploadImageResponse = JSON.parse(uploadResult.body);
        console.log("[ProfileScreen] Parsed response:", response);
        if (response.success) {
          // The response.url is already a full Supabase storage URL, don't prepend BACKEND_URL
          console.log("[ProfileScreen] Image URL:", response.url);
          await updateUser({ image: response.url });
          Alert.alert("Success", "Profile photo updated!");
        }
      } else {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }
    } catch (error) {
      console.error("[ProfileScreen] Failed to upload image:", error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await updateUser({
        name: name.trim(),
        bio: bio.trim() || undefined,
      });
      Alert.alert("Success", "Profile updated!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (!user?.id) return;

    setIsUpdatingNotifications(true);
    try {
      await api.patch(`/api/users/${user.id}/notifications`, {
        pushNotificationsEnabled: value,
      });
      setPushNotificationsEnabled(value);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      Alert.alert("Error", "Failed to update notification preferences");
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Animated Gradient Background */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <LinearGradient
          colors={[
            "#000000",
            "#0A0A0F",
            "#050508",
            "#000000",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        <LinearGradient
          colors={[
            "rgba(138, 43, 226, 0.03)",
            "rgba(0, 122, 255, 0.02)",
            "transparent",
            "rgba(52, 199, 89, 0.02)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </View>
      
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 100,
              paddingHorizontal: 20,
              paddingBottom: isKeyboardVisible ? 20 : insets.bottom + 40,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="items-center mb-12">
              <View
                className="relative"
                style={{
                  shadowColor: "#007AFF",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                {user?.image && getFullImageUrl(user.image) ? (
                  <Image
                    source={{ uri: getFullImageUrl(user.image) }}
                    className="w-32 h-32 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className="w-32 h-32 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: getColorFromName(user?.name),
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 48,
                        fontWeight: "600",
                      }}
                    >
                      {getInitials(user?.name)}
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={handlePickImage}
                  disabled={isUploadingImage}
                  className="absolute bottom-0 right-0"
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0, 122, 255, 0.15)",
                      borderWidth: 2,
                      borderColor: "#007AFF",
                      shadowColor: "#007AFF",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    {isUploadingImage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Camera size={20} color="#FFFFFF" />
                    )}
                  </View>
                </Pressable>
              </View>

              <Text className="text-sm mt-4" style={{ color: "#8E8E93" }}>
                Tap camera to change photo
              </Text>
            </View>

            {/* Display Name Input - Floating Style */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: "#8E8E93" }}>
                DISPLAY NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#666666"
                className="rounded-2xl px-5 py-4 text-base"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  color: "#FFFFFF",
                  fontSize: 16,
                }}
                maxLength={50}
              />
            </View>

            {/* Bio Input */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: "#8E8E93" }}>
                BIO (OPTIONAL)
              </Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor="#666666"
                className="rounded-2xl px-5 py-4 text-base"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  color: "#FFFFFF",
                  fontSize: 16,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
                maxLength={200}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Notification Settings */}
            <View className="mb-8">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: "#8E8E93" }}>
                NOTIFICATIONS
              </Text>
              <View
                className="rounded-2xl px-5 py-4"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    {pushNotificationsEnabled ? (
                      <Bell size={20} color="#8B5CF6" />
                    ) : (
                      <BellOff size={20} color="#666666" />
                    )}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        Push Notifications
                      </Text>
                      <Text style={{ color: "#8E8E93", fontSize: 13, marginTop: 2 }}>
                        Get notified about new messages
                      </Text>
                    </View>
                  </View>
                  {isUpdatingNotifications ? (
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  ) : (
                    <Switch
                      value={pushNotificationsEnabled}
                      onValueChange={handleToggleNotifications}
                      trackColor={{ false: "#333333", true: "#8B5CF6" }}
                      thumbColor={pushNotificationsEnabled ? "#FFFFFF" : "#666666"}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={isSaving || (name === user?.name && bio === (user?.bio || "")) || !name.trim()}
              className="rounded-2xl"
              style={{
                backgroundColor: (name !== user?.name || bio !== (user?.bio || "")) && name.trim()
                  ? "rgba(0, 122, 255, 0.15)"
                  : "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                borderColor: (name !== user?.name || bio !== (user?.bio || "")) && name.trim()
                  ? "#007AFF"
                  : "rgba(255, 255, 255, 0.2)",
                padding: 16,
                alignItems: "center",
                shadowColor: (name !== user?.name || bio !== (user?.bio || "")) && name.trim() ? "#007AFF" : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  className="font-semibold text-lg"
                  style={{ color: (name !== user?.name || bio !== (user?.bio || "")) && name.trim() ? "#FFFFFF" : "#666666" }}
                >
                  Save Changes
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
    </View>
  );
};

export default ProfileScreen;
