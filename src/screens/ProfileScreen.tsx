import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Keyboard,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { 
  Camera, 
  Bell, 
  BellOff, 
  Trash2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  FileText,
  Moon,
  Sun,
  Smartphone,
  Languages,
  Check,
  X
} from "lucide-react-native";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import * as FileSystem from "expo-file-system";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { BACKEND_URL, api } from "@/lib/api";
import type { UploadImageResponse } from "@/shared/contracts";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "zh-TW", name: "Chinese (Traditional)", flag: "🇹🇼" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
];

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, loading, updateUser, signOut } = useUser();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeleteSectionExpanded, setIsDeleteSectionExpanded] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [deletionFeedback, setDeletionFeedback] = useState("");
  const [summaryPreference, setSummaryPreference] = useState<"concise" | "detailed">(user?.summaryPreference || "concise");
  const [isUpdatingSummaryPreference, setIsUpdatingSummaryPreference] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage || "en");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);

  // Reset image error state when user image changes
  React.useEffect(() => {
    setImageLoadError(false);
  }, [user?.image]);

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
    try {
      // Use FileSystem.uploadAsync for proper file upload in React Native
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
          await updateUser({ image: response.url });
          setImageLoadError(false);
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

  const handleToggleSummaryPreference = async (preference: "concise" | "detailed") => {
    if (!user?.id || isUpdatingSummaryPreference) return;

    const previousPreference = summaryPreference;
    setSummaryPreference(preference);
    setIsUpdatingSummaryPreference(true);

    try {
      await api.patch(`/api/users/${user.id}`, { summaryPreference: preference });
      await updateUser({ summaryPreference: preference });
    } catch (error) {
      console.error("Failed to update summary preference:", error);
      setSummaryPreference(previousPreference);
      Alert.alert("Error", "Failed to update summary preference");
    } finally {
      setIsUpdatingSummaryPreference(false);
    }
  };

  const handleLanguageSelect = async (languageCode: string) => {
    if (!user?.id || isUpdatingLanguage) return;

    const previousLanguage = preferredLanguage;
    setPreferredLanguage(languageCode);
    setShowLanguagePicker(false);
    setIsUpdatingLanguage(true);

    try {
      await api.patch(`/api/users/${user.id}`, { preferredLanguage: languageCode });
      await updateUser({ preferredLanguage: languageCode });
    } catch (error) {
      console.error("Failed to update preferred language:", error);
      setPreferredLanguage(previousLanguage);
      Alert.alert("Error", "Failed to update preferred language");
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  const handleThemeChange = async (mode: 'light' | 'dark' | 'system') => {
    await setThemeMode(mode);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data including messages, chats, and settings will be permanently deleted.\n\nAre you absolutely sure you want to delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => setShowFeedbackModal(true),
        },
      ],
      { cancelable: true }
    );
  };

  const handleFeedbackSubmit = () => {
    setShowFeedbackModal(false);
    
    Alert.prompt(
      "Confirm Deletion",
      'To confirm, please type "DELETE" in all caps:',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: (confirmText) => {
            if (confirmText === "DELETE") {
              performAccountDeletion();
            } else {
              Alert.alert("Error", "Confirmation text did not match. Account was not deleted.");
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const handleSkipFeedback = () => {
    setShowFeedbackModal(false);
    setDeletionFeedback("");
    
    Alert.prompt(
      "Confirm Deletion",
      'To confirm, please type "DELETE" in all caps:',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: (confirmText) => {
            if (confirmText === "DELETE") {
              performAccountDeletion();
            } else {
              Alert.alert("Error", "Confirmation text did not match. Account was not deleted.");
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const performAccountDeletion = async () => {
    if (!user?.id) return;

    setIsDeletingAccount(true);
    try {
      const response = await api.delete(`/api/users/${user.id}`, {
        confirmText: "DELETE",
        feedback: deletionFeedback.trim() || undefined,
      });

      if (response.success) {
        setDeletionFeedback("");
        Alert.alert(
          "Account Deleted",
          "Your account and all associated data have been permanently deleted." + 
          (deletionFeedback.trim() ? "\n\nThank you for your feedback." : ""),
          [
            {
              text: "OK",
              onPress: async () => {
                await signOut();
              },
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error: any) {
      console.error("Failed to delete account:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to delete account. Please try again or contact support."
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <LuxeLogoLoader size="large" />
      </View>
    );
  }

  const backgroundGradientColors = isDark 
    ? ["#000000", "#0A0A0F", "#050508", "#000000"]
    : [colors.background, colors.backgroundSecondary, colors.surfaceSecondary, colors.background];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          colors={backgroundGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        <LinearGradient
          colors={[
            isDark ? "rgba(79, 195, 247, 0.03)" : "rgba(0, 122, 255, 0.05)",
            isDark ? "rgba(0, 122, 255, 0.02)" : "rgba(0, 122, 255, 0.03)",
            "transparent",
            isDark ? "rgba(52, 199, 89, 0.02)" : "rgba(52, 199, 89, 0.03)",
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
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                {user?.image && !imageLoadError ? (
                  <ExpoImage
                    source={getFullImageUrl(user.image)}
                    style={{
                      width: 128,
                      height: 128,
                      borderRadius: 64,
                    }}
                    contentFit="cover"
                    onError={(error: any) => {
                      console.error("[ProfileScreen] Image load error:", error);
                      setImageLoadError(true);
                    }}
                    onLoad={() => setImageLoadError(false)}
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
                      backgroundColor: isDark ? "rgba(0, 122, 255, 0.15)" : colors.surface,
                      borderWidth: 2,
                      borderColor: colors.primary,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    {isUploadingImage ? (
                      <LuxeLogoLoader size="small" />
                    ) : (
                      <Camera size={20} color={isDark ? "#FFFFFF" : colors.primary} />
                    )}
                  </View>
                </Pressable>
              </View>

              <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>
                Tap camera to change photo
              </Text>
            </View>

            {/* Display Name Input - Floating Style */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                DISPLAY NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
                keyboardAppearance={isDark ? "dark" : "light"}
                className="rounded-2xl px-5 py-4 text-base"
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  fontSize: 16,
                }}
                maxLength={50}
              />
            </View>

            {/* Bio Input */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                BIO (OPTIONAL)
              </Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor={colors.textTertiary}
                keyboardAppearance={isDark ? "dark" : "light"}
                className="rounded-2xl px-5 py-4 text-base"
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  fontSize: 16,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
                maxLength={200}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Appearance Settings */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                APPEARANCE
              </Text>
              <View
                className="rounded-2xl px-5 py-4"
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* Light */}
                  <Pressable 
                    onPress={() => handleThemeChange('light')} 
                    style={{ 
                      flex: 1, 
                      alignItems: 'center', 
                      padding: 12, 
                      borderRadius: 16, 
                      backgroundColor: themeMode === 'light' ? colors.primary : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      borderWidth: themeMode === 'light' ? 0 : 1,
                      borderColor: themeMode === 'light' ? 'transparent' : colors.border
                    }}
                  >
                    <Sun size={24} color={themeMode === 'light' ? '#FFF' : colors.textSecondary} />
                    <Text style={{ marginTop: 8, color: themeMode === 'light' ? '#FFF' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Light</Text>
                  </Pressable>
                  
                  {/* Dark */}
                  <Pressable 
                    onPress={() => handleThemeChange('dark')} 
                    style={{ 
                      flex: 1, 
                      alignItems: 'center', 
                      padding: 12, 
                      borderRadius: 16, 
                      backgroundColor: themeMode === 'dark' ? colors.primary : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      borderWidth: themeMode === 'dark' ? 0 : 1,
                      borderColor: themeMode === 'dark' ? 'transparent' : colors.border
                    }}
                  >
                    <Moon size={24} color={themeMode === 'dark' ? '#FFF' : colors.textSecondary} />
                    <Text style={{ marginTop: 8, color: themeMode === 'dark' ? '#FFF' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Dark</Text>
                  </Pressable>

                  {/* System */}
                  <Pressable 
                    onPress={() => handleThemeChange('system')} 
                    style={{ 
                      flex: 1, 
                      alignItems: 'center', 
                      padding: 12, 
                      borderRadius: 16, 
                      backgroundColor: themeMode === 'system' ? colors.primary : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      borderWidth: themeMode === 'system' ? 0 : 1,
                      borderColor: themeMode === 'system' ? 'transparent' : colors.border
                    }}
                  >
                    <Smartphone size={24} color={themeMode === 'system' ? '#FFF' : colors.textSecondary} />
                    <Text style={{ marginTop: 8, color: themeMode === 'system' ? '#FFF' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>System</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Notification Settings */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                NOTIFICATIONS
              </Text>
              <View
                className="rounded-2xl px-5 py-4"
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    {pushNotificationsEnabled ? (
                      <Bell size={20} color={colors.primary} />
                    ) : (
                      <BellOff size={20} color={colors.textTertiary} />
                    )}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                        Push Notifications
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        Get notified about new messages
                      </Text>
                    </View>
                  </View>
                  {isUpdatingNotifications ? (
                    <LuxeLogoLoader size="small" />
                  ) : (
                    <Switch
                      value={pushNotificationsEnabled}
                      onValueChange={handleToggleNotifications}
                      trackColor={{ false: "#333333", true: colors.primary }}
                      thumbColor={pushNotificationsEnabled ? "#FFFFFF" : "#666666"}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* AI Summary Preference */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                AI SUMMARY STYLE
              </Text>
              <View
                className="rounded-2xl px-5 py-4"
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Sparkles size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                      Summary Detail
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      {summaryPreference === "concise" ? "Quick overview" : "Full context"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleToggleSummaryPreference(summaryPreference === "concise" ? "detailed" : "concise")}
                    disabled={isUpdatingSummaryPreference}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                      borderRadius: 20,
                      padding: 4,
                    }}
                  >
                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: summaryPreference === "concise" ? colors.primary : "transparent",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Zap size={14} color={summaryPreference === "concise" ? "#FFF" : colors.textSecondary} />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: summaryPreference === "concise" ? "#FFF" : colors.textSecondary,
                        }}
                      >
                        Concise
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: summaryPreference === "detailed" ? colors.primary : "transparent",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FileText size={14} color={summaryPreference === "detailed" ? "#FFF" : colors.textSecondary} />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: summaryPreference === "detailed" ? "#FFF" : colors.textSecondary,
                        }}
                      >
                        Detailed
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Preferred Language */}
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                PREFERRED LANGUAGE
              </Text>
              <Pressable
                onPress={() => setShowLanguagePicker(true)}
                disabled={isUpdatingLanguage}
                style={({ pressed }) => ({
                  opacity: pressed || isUpdatingLanguage ? 0.7 : 1,
                })}
              >
                <View
                  className="rounded-2xl px-5 py-4"
                  style={{
                    backgroundColor: colors.inputBackground,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <Languages size={20} color={colors.primary} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                          Default Translation Language
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                          <Text style={{ fontSize: 16, marginRight: 6 }}>
                            {LANGUAGES.find(l => l.code === preferredLanguage)?.flag || "🌐"}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {LANGUAGES.find(l => l.code === preferredLanguage)?.name || "English"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {isUpdatingLanguage ? (
                      <LuxeLogoLoader size="small" />
                    ) : (
                      <ChevronRight size={20} color={colors.textSecondary} />
                    )}
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={isSaving || (name === user?.name && bio === (user?.bio || "")) || !name.trim()}
              className="rounded-2xl overflow-hidden"
              style={({ pressed }) => ({
                opacity: pressed || isSaving || (name === user?.name && bio === (user?.bio || "")) || !name.trim() ? 0.7 : 1,
                marginTop: 4,
                marginBottom: 32,
                shadowColor: (name !== user?.name || bio !== (user?.bio || "")) && name.trim() ? colors.primary : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <LinearGradient
                colors={
                  (name !== user?.name || bio !== (user?.bio || "")) && name.trim()
                    ? ["#0061FF", "#00C6FF", "#00E676"] // New VibeChat Gradient
                    : [colors.inputBackground, colors.glassBackground]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  alignItems: "center",
                  justifyContent: "center",
              }}
            >
              {isSaving ? (
                <LuxeLogoLoader size={20} />
              ) : (
                <Text
                  className="font-semibold text-lg"
                  style={{ color: (name !== user?.name || bio !== (user?.bio || "")) && name.trim() ? "#FFFFFF" : colors.textSecondary }}
                >
                  Save Changes
                </Text>
              )}
              </LinearGradient>
            </Pressable>

            {/* Delete Account Section - Collapsible */}
            <View className="mb-8">
              <Text className="text-sm font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                DANGER ZONE
              </Text>
              <View
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "rgba(255, 59, 48, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 59, 48, 0.3)",
                }}
              >
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => setIsDeleteSectionExpanded(!isDeleteSectionExpanded)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ 
                    flexDirection: "row", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    paddingVertical: 20,
                    paddingHorizontal: 20,
                  }}>
                    {/* Left side: Icon and Text */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <AlertTriangle size={20} color="#FF3B30" />
                      <Text style={{ color: "#FF3B30", fontSize: 16, fontWeight: "600" }}>
                        Delete Account
                      </Text>
                    </View>
                    
                    {/* Right side: Chevron */}
                    {isDeleteSectionExpanded ? (
                      <ChevronDown size={20} color="#FF3B30" />
                    ) : (
                      <ChevronRight size={20} color="#FF3B30" />
                    )}
                  </View>
                </Pressable>

                {/* Expanded Content */}
                {isDeleteSectionExpanded && (
                  <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                    <View style={{ height: 1, backgroundColor: "rgba(255, 59, 48, 0.2)", marginBottom: 18 }} />
                    <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 21 }}>
                      Permanently delete your account and all of your data. This action cannot be undone. All messages, chats, and settings will be lost.
                    </Text>
                    <Pressable
                      onPress={handleDeleteAccount}
                      disabled={isDeletingAccount}
                      className="rounded-2xl overflow-hidden"
                      style={({ pressed }) => ({
                        opacity: pressed || isDeletingAccount ? 0.7 : 1,
                      })}
                    >
                      <LinearGradient
                        colors={["#FF3B30", "#FF453A"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          paddingVertical: 16,
                          paddingHorizontal: 24,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isDeletingAccount ? (
                          <LuxeLogoLoader size="small" />
                        ) : (
                          <>
                            <Trash2 size={18} color="#FFFFFF" />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 16,
                                fontWeight: "600",
                                marginLeft: 10,
                              }}
                            >
                              Delete My Account
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Feedback Modal */}
        <Modal
          visible={showFeedbackModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowFeedbackModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.4)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={{
                width: "100%",
                maxWidth: 400,
                borderRadius: 24,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: isDark ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
                  padding: 24,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {/* Header */}
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: "rgba(255, 149, 0, 0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <AlertTriangle size={28} color="#FF9500" />
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    We're Sorry to See You Go
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 20,
                    }}
                  >
                    Before you leave, would you mind sharing why you're deleting your account? This helps us improve.
                  </Text>
                </View>

                {/* Feedback Input */}
                <View style={{ marginBottom: 20 }}>
                  <TextInput
                    value={deletionFeedback}
                    onChangeText={setDeletionFeedback}
                    placeholder="Your feedback (optional)..."
                    placeholderTextColor={colors.textTertiary}
                    keyboardAppearance={isDark ? "dark" : "light"}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    style={{
                      backgroundColor: colors.inputBackground,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      padding: 16,
                      color: colors.text,
                      fontSize: 15,
                      minHeight: 120,
                      textAlignVertical: "top",
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 8,
                      textAlign: "right",
                    }}
                  >
                    {deletionFeedback.length}/500
                  </Text>
                </View>

                {/* Buttons */}
                <View style={{ gap: 12 }}>
                  {/* Submit Feedback Button */}
                  <Pressable
                    onPress={handleFeedbackSubmit}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      borderRadius: 14,
                      overflow: "hidden",
                    })}
                  >
                    <LinearGradient
                      colors={["#0061FF", "#00C6FF"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        paddingVertical: 16,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 17,
                          fontWeight: "600",
                        }}
                      >
                        {deletionFeedback.trim() ? "Submit & Continue" : "Continue Without Feedback"}
                      </Text>
                    </LinearGradient>
                  </Pressable>

                  {/* Skip Button */}
                  <Pressable
                    onPress={handleSkipFeedback}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      paddingVertical: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 14,
                      backgroundColor: colors.inputBackground,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 17,
                        fontWeight: "500",
                      }}
                    >
                      Skip
                    </Text>
                  </Pressable>

                  {/* Cancel Button */}
                  <Pressable
                    onPress={() => setShowFeedbackModal(false)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 15,
                        fontWeight: "500",
                      }}
                    >
                      Cancel Deletion
                    </Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLanguagePicker(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: isDark ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.4)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={{
                width: "100%",
                maxWidth: 400,
                borderRadius: 24,
                overflow: "hidden",
                maxHeight: "80%",
              }}
            >
              <View
                style={{
                  backgroundColor: isDark ? "rgba(28, 28, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Languages size={24} color={colors.primary} />
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: colors.text,
                      }}
                    >
                      Select Language
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setShowLanguagePicker(false)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.5 : 1,
                    })}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {/* Language List */}
                <ScrollView
                  style={{ maxHeight: 500 }}
                  showsVerticalScrollIndicator={false}
                >
                  {LANGUAGES.map((lang) => {
                    const isSelected = lang.code === preferredLanguage;
                    return (
                      <Pressable
                        key={lang.code}
                        onPress={() => handleLanguageSelect(lang.code)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          paddingVertical: 14,
                          paddingHorizontal: 20,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: isSelected
                            ? isDark
                              ? "rgba(0, 122, 255, 0.15)"
                              : "rgba(0, 122, 255, 0.08)"
                            : "transparent",
                        })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Text style={{ fontSize: 24 }}>{lang.flag}</Text>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: isSelected ? "600" : "400",
                              color: isSelected ? colors.primary : colors.text,
                            }}
                          >
                            {lang.name}
                          </Text>
                        </View>
                        {isSelected && (
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: colors.primary,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </BlurView>
          </View>
        </Modal>
    </View>
  );
};

export default ProfileScreen;
