import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image as RNImage,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Camera, Users, Sparkles, Wand2, Zap, Link2, Images, Bell, BellOff, Edit2, X, Trash2, ChevronRight } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import { ZoomableImageViewer } from "@/components/ZoomableImageViewer";
import LiquidGlassCard from "@/components/LiquidGlass/LiquidGlassCard";
import type { RootStackScreenProps } from "@/navigation/types";
import type { ChatWithMembers, UpdateChatRequest, Chat } from "@/shared/contracts";

const GroupSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const route = useRoute<RootStackScreenProps<"GroupSettings">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"GroupSettings">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();

  const { chatId } = route.params;

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  
  // These states are kept for Media/Links logic if needed, or if we want to show previews
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showLinksCollection, setShowLinksCollection] = useState(false);

  // Fetch chat details
  const { data: chat } = useQuery<ChatWithMembers>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get<ChatWithMembers>(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  // Fetch messages for media/links stats
  const { data: messagesData } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => api.get<{ messages: any[], hasMore: boolean, nextCursor: string | null }>(`/api/chats/${chatId}/messages?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });
  
  const messages = messagesData?.messages || [];
  
  const { data: mediaMessages = [] } = useQuery({
    queryKey: ["chatMedia", chatId],
    queryFn: () => api.get<any[]>(`/api/chats/${chatId}/media?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  const linkMessages = messages.filter((msg: any) => 
    msg.linkPreview && msg.linkPreview.url && !msg.isUnsent
  );

  const isCreator = chat?.creatorId === user?.id;
  const isRestricted = chat?.isRestricted || false;
  const canEdit = !isRestricted || isCreator;
  const currentMember = chat?.members?.find(m => m.userId === user?.id);
  const isMuted = currentMember?.isMuted || false;

  const muteChatMutation = useMutation({
    mutationFn: ({ chatId, isMuted }: { chatId: string; isMuted: boolean }) =>
      api.patch(`/api/chats/${chatId}/mute`, { userId: user!.id, isMuted }),
    onMutate: async ({ isMuted }) => {
      await queryClient.cancelQueries({ queryKey: ["chat", chatId] });
      const previousChat = queryClient.getQueryData(["chat", chatId]);
      queryClient.setQueryData(["chat", chatId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members?.map((m: any) =>
            m.userId === user?.id ? { ...m, isMuted } : m
          ) || [],
        };
      });
      return { previousChat };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any, _, context) => {
      if (context?.previousChat) {
        queryClient.setQueryData(["chat", chatId], context.previousChat);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update mute status");
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (updates: Omit<UpdateChatRequest, 'userId'>) =>
      api.patch<Chat>(`/api/chats/${chatId}`, { ...updates, userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update settings");
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData();
      formData.append("image", {
        uri,
        type: "image/jpeg",
        name: "group_image.jpg",
      } as any);
      formData.append("userId", user!.id);
      
      const response = await api.post<{ imageUrl: string }>(`/api/chats/${chatId}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.imageUrl;
    },
    onSuccess: (imageUrl) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      setImageUri(getFullImageUrl(imageUrl));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to upload image");
    },
  });

  const generateAvatarMutation = useMutation({
    mutationFn: () => api.post<{ imageUrl: string }>(`/api/chats/${chatId}/generate-avatar`, { userId: user?.id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      setImageUri(getFullImageUrl(data.imageUrl));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to generate avatar");
    },
  });

  const clearMessagesMutation = useMutation({
    mutationFn: () => api.delete(`/api/chats/${chatId}/messages?userId=${user?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "All messages have been cleared");
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to clear messages");
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: () => api.delete(`/api/chats/${chatId}?userId=${user?.id}`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete chat");
    },
  });

  useEffect(() => {
    if (chat) {
      setName(chat.name);
      setBio(chat.bio || "");
      setImageUri(getFullImageUrl(chat.image) || null);
    }
  }, [chat]);

  const handleUpdateAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadImageMutation.mutate(result.assets[0].uri);
    }
  };

  const handleSaveProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettingsMutation.mutate({ name, bio });
    setShowEditProfileModal(false);
  };

  const handleClearConversation = () => {
    Alert.alert(
      "Clear Conversation",
      "Are you sure you want to delete all messages? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => clearMessagesMutation.mutate(),
        },
      ]
    );
  };

  const handleDeleteChat = () => {
    Alert.alert(
      "Delete Chat",
      "Are you sure you want to delete this chat permanently? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteChatMutation.mutate(),
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={isDark ? ["#000000", "#0A0A0F", "#000000"] : [colors.background, colors.backgroundSecondary, colors.background]}
          style={{ flex: 1 }}
        />
        <LinearGradient
          colors={isDark ? ["rgba(0, 122, 255, 0.05)", "transparent"] : ["rgba(0, 122, 255, 0.1)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header & Avatar */}
        <View className="items-center mb-8">
          <Pressable
            onPress={() => {
              if (imageUri) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAvatarViewer(true);
              }
            }}
            disabled={!imageUri}
          >
            <View className="relative">
              {imageUri ? (
                <View
                  style={{
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                    borderRadius: 64,
                  }}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: 128, height: 128, borderRadius: 64 }}
                    contentFit="cover"
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: 128,
                    height: 128,
                    borderRadius: 64,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary + "26",
                    borderWidth: 1,
                    borderColor: colors.primary + "4D",
                  }}
                >
                  <Users size={48} color={colors.primary} />
                </View>
              )}
              
              {canEdit && (
                <>
                  {/* AI Generate Button */}
                  <View style={{ position: 'absolute', bottom: 0, right: 0 }}>
                    <BlurView intensity={80} tint="dark" style={{ borderRadius: 18, overflow: 'hidden' }}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          generateAvatarMutation.mutate();
                        }}
                        disabled={generateAvatarMutation.isPending}
                        style={{
                          width: 36,
                          height: 36,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(79, 195, 247, 0.3)',
                        }}
                      >
                         {generateAvatarMutation.isPending ? (
                            <LuxeLogoLoader size="small" />
                          ) : (
                            <Sparkles size={16} color={colors.text} />
                          )}
                      </Pressable>
                    </BlurView>
                  </View>

                  {/* Camera Button */}
                  <View style={{ position: 'absolute', bottom: 0, left: 0 }}>
                    <Pressable
                        onPress={handleUpdateAvatar}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: colors.inputBackground,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Camera size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </Pressable>

          <View className="mt-4 items-center">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-bold" style={{ color: colors.text }}>
                {chat?.name}
              </Text>
              {canEdit && (
                <Pressable onPress={() => setShowEditProfileModal(true)}>
                  <Edit2 size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
            {chat?.bio && (
              <Text className="text-sm text-center mt-1" style={{ color: colors.textSecondary }}>
                {chat.bio}
              </Text>
            )}
          </View>
        </View>

        {/* Media & Links Cards */}
        <View className="gap-4 mb-8">
            <LiquidGlassCard
                icon={<Images size={20} color={colors.primary} />}
                title="Media"
                subtitle={`${mediaMessages.length} items`}
                onPress={() => {
                  navigation.navigate("GroupSettingsMedia", { chatId });
                }}
            >
                {mediaMessages.length > 0 && (
                  <View className="flex-row gap-2 mt-4">
                    {mediaMessages.slice(0, 5).map((item: any) => (
                      <View key={item.id} style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.inputBackground }}>
                        <Image source={{ uri: getFullImageUrl(item.thumbnailUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      </View>
                    ))}
                    {mediaMessages.length > 5 && (
                        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.inputBackground, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>+{mediaMessages.length - 5}</Text>
                        </View>
                    )}
                  </View>
                )}
            </LiquidGlassCard>

            <LiquidGlassCard
                icon={<Link2 size={20} color={colors.primary} />}
                title="Links"
                subtitle={`${linkMessages.length} shared`}
                onPress={() => {
                  navigation.navigate("GroupSettingsLinks", { chatId });
                }}
            />
        </View>

        {/* Navigation Cards */}
        <View className="gap-4 mb-8">
            <LiquidGlassCard
                icon={<Sparkles size={20} color={colors.success} />}
                title="AI Friends"
                subtitle="Manage personalities"
                onPress={() => navigation.navigate("GroupSettingsAiFriends", { chatId })}
                variant="success"
            >
                 <View className="absolute right-4 top-1/2 -mt-3">
                    <ChevronRight size={20} color={colors.textSecondary} />
                 </View>
            </LiquidGlassCard>

            <LiquidGlassCard
                icon={<Wand2 size={20} color={colors.primary} />}
                title="Workflows"
                subtitle="Automate tasks"
                onPress={() => navigation.navigate("GroupSettingsWorkflows", { chatId })}
            >
                 <View className="absolute right-4 top-1/2 -mt-3">
                    <ChevronRight size={20} color={colors.textSecondary} />
                 </View>
            </LiquidGlassCard>

            <LiquidGlassCard
                icon={<Zap size={20} color={colors.warning} />}
                title="Custom Commands"
                subtitle="Slash commands"
                onPress={() => navigation.navigate("GroupSettingsCommands", { chatId })}
                variant="warning"
            >
                 <View className="absolute right-4 top-1/2 -mt-3">
                    <ChevronRight size={20} color={colors.textSecondary} />
                 </View>
            </LiquidGlassCard>

            <LiquidGlassCard
                icon={<Users size={20} color={colors.text} />}
                title="Members"
                subtitle={`${chat?.members?.length || 0} members`}
                onPress={() => navigation.navigate("GroupSettingsMembers", { chatId })}
            >
                 <View className="absolute right-4 top-1/2 -mt-3">
                    <ChevronRight size={20} color={colors.textSecondary} />
                 </View>
            </LiquidGlassCard>
        </View>

        {/* Settings Toggles */}
        <View className="gap-4 mb-8">
             <View
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1,
                borderColor: colors.border,
              }}
             >
                <View className="flex-row items-center gap-3">
                    {isMuted ? <BellOff size={20} color={colors.textSecondary} /> : <Bell size={20} color={colors.text} />}
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>Mute Notifications</Text>
                </View>
                <Switch
                  value={isMuted}
                  onValueChange={(value) => {
                    Haptics.selectionAsync();
                    muteChatMutation.mutate({ chatId, isMuted: value });
                  }}
                  trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                  thumbColor={colors.switchThumb}
                />
             </View>

             {isCreator && (
                <View
                style={{
                    backgroundColor: colors.inputBackground,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
                >
                    <View className="flex-row items-center gap-3">
                        <Users size={20} color={colors.text} />
                        <View>
                            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "500" }}>Restricted Mode</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Only admin can edit info</Text>
                        </View>
                    </View>
                    <Switch
                    value={isRestricted}
                    onValueChange={(value) => {
                        Haptics.selectionAsync();
                        updateSettingsMutation.mutate({ isRestricted: value });
                    }}
                    trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
                    thumbColor={colors.switchThumb}
                    />
                </View>
             )}
        </View>

        {/* Danger Zone */}
        <View className="gap-3 mb-10">
            <Pressable
                onPress={handleClearConversation}
                style={{
                    backgroundColor: colors.error + "15",
                    padding: 16,
                    borderRadius: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.error + "40"
                }}
            >
                <Trash2 size={18} color={colors.error} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.error, fontWeight: "600" }}>Clear Chat History</Text>
            </Pressable>

            {isCreator && (
                <Pressable
                    onPress={handleDeleteChat}
                    style={{
                        backgroundColor: colors.error + "15",
                        padding: 16,
                        borderRadius: 16,
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.error + "40"
                    }}
                >
                    <Trash2 size={18} color={colors.error} style={{ marginRight: 8 }} />
                    <Text style={{ color: colors.error, fontWeight: "600" }}>Delete Chat</Text>
                </Pressable>
            )}
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        >
        <Pressable 
            style={{ flex: 1, backgroundColor: colors.overlay }} 
            onPress={() => setShowEditProfileModal(false)}
        />
        <View
            style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 20,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
                Edit Group Info
            </Text>
            <Pressable
                onPress={() => setShowEditProfileModal(false)}
                style={{ padding: 4 }}
            >
                <X size={24} color={colors.text} />
            </Pressable>
            </View>

            <View className="mb-6">
            <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                GROUP NAME
            </Text>
            <TextInput
                value={name}
                onChangeText={setName}
                className="rounded-lg px-4 py-3 text-base"
                keyboardAppearance={isDark ? "dark" : "light"}
                style={{
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                }}
                placeholder="Enter group name"
                placeholderTextColor={colors.inputPlaceholder}
                maxLength={50}
            />
            </View>

            <View className="mb-8">
            <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>
                GROUP BIO
            </Text>
            <TextInput
                value={bio}
                onChangeText={setBio}
                className="rounded-lg px-4 py-3 text-base"
                keyboardAppearance={isDark ? "dark" : "light"}
                style={{
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: 100,
                textAlignVertical: "top",
                }}
                placeholder="Enter group bio (optional)"
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={4}
                maxLength={200}
            />
            </View>

            <Pressable
            onPress={handleSaveProfile}
            disabled={updateSettingsMutation.isPending}
            style={({ pressed }) => ({
                opacity: pressed || updateSettingsMutation.isPending ? 0.7 : 1,
            })}
            >
            <LinearGradient
                colors={["#4FC3F7", "#00A8E8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                }}
            >
                {updateSettingsMutation.isPending ? (
                <LuxeLogoLoader size={20} />
                ) : (
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "bold" }}>
                    Save Changes
                </Text>
                )}
            </LinearGradient>
            </Pressable>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Avatar Viewer */}
      {imageUri && (
        <ZoomableImageViewer
          visible={showAvatarViewer}
          imageUrl={imageUri}
          onClose={() => setShowAvatarViewer(false)}
          title={chat?.name}
        />
      )}
    </View>
  );
};

export default GroupSettingsScreen;
