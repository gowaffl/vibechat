import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Image, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, ArrowRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BACKEND_URL } from "@/lib/api";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { useUser } from "@/contexts/UserContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import type { RootStackScreenProps } from "@/navigation/types";
import type { GetInviteInfoResponse, JoinChatViaInviteResponse } from "@/shared/contracts";
import { useTheme } from "@/contexts/ThemeContext";

const InviteScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<RootStackScreenProps<"Invite">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"Invite">["navigation"]>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { token } = route.params;
  const { colors, isDark } = useTheme();

  const [isJoining, setIsJoining] = useState(false);

  // Fetch invite info
  const { data: inviteInfo, isLoading, error } = useQuery<GetInviteInfoResponse>({
    queryKey: ["invite-info", token],
    queryFn: () => api.get(`/api/invite/${token}`),
  });

  // Join chat mutation
  const joinChatMutation = useMutation({
    mutationFn: () => api.post<JoinChatViaInviteResponse>(`/api/invite/${token}/join`, { userId: user?.id }),
    onSuccess: async (response: JoinChatViaInviteResponse) => {
      // Invalidate queries to refresh chat list - await to ensure data is fresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-chats"] }),
        queryClient.invalidateQueries({ queryKey: ["chat", response.chatId] }),
      ]);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to MainTabs first to ensure the chat list is loaded in the background
      (navigation as any).navigate("MainTabs", { screen: "Chats" });

      // Small delay to let the chat list render, then navigate to the chat
      // This ensures the chat appears in the list before we navigate to it
      setTimeout(() => {
        navigation.navigate("Chat", {
          chatId: response.chatId,
          chatName: inviteInfo?.chatName || "Chat",
        });
      }, 300);
    },
    onError: (error: any) => {
      console.error("Error joining chat:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to join chat. Please try again.");
    },
  });

  const handleJoinChat = async () => {
    if (!user?.hasCompletedOnboarding) {
      // Store the invite token to join after onboarding
      await import("expo-secure-store").then((SecureStore) => {
        SecureStore.default.setItemAsync("pendingInviteToken", token);
      });

      // Navigate to onboarding
      navigation.navigate("OnboardingName");
      return;
    }

    setIsJoining(true);
    try {
      await joinChatMutation.mutateAsync();
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <LuxeLogoLoader size="large" />
        <Text style={{ color: colors.text, marginTop: 16, fontSize: 16 }}>Loading invite...</Text>
      </View>
    );
  }

  if (error || !inviteInfo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 8, textAlign: "center" }}>
          Invalid Invite
        </Text>
        <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
          This invite link is invalid or has expired.
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate("MainTabs", { screen: "Chats" });
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
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
            style={{
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 24,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Go to Chats
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingTop: insets.top + 32, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }}>
        {/* Chat Avatar */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: isDark ? "rgba(79, 195, 247, 0.2)" : "rgba(0, 122, 255, 0.1)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            borderWidth: 3,
            borderColor: isDark ? "rgba(79, 195, 247, 0.4)" : "rgba(0, 122, 255, 0.3)",
          }}
        >
          {inviteInfo.chatImage ? (
            <Image
              source={{ uri: getFullImageUrl(inviteInfo.chatImage) }}
              style={{
                width: 114,
                height: 114,
                borderRadius: 57,
              }}
            />
          ) : (
            <Users size={56} color={colors.primary} />
          )}
        </View>

        {/* Chat Info */}
        <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 8, textAlign: "center" }}>
          {inviteInfo.chatName}
        </Text>

        {inviteInfo.chatBio && (
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 16, textAlign: "center" }}>
            {inviteInfo.chatBio}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 32 }}>
          <Users size={18} color={colors.textTertiary} />
          <Text style={{ fontSize: 15, color: colors.textTertiary, marginLeft: 6 }}>
            {inviteInfo.memberCount} {inviteInfo.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8, textAlign: "center" }}>
          You&apos;ve been invited to join
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 32, textAlign: "center" }}>
          {user?.hasCompletedOnboarding
            ? "Tap below to join this chat and start messaging"
            : "Complete onboarding to join this chat"}
        </Text>

        {/* Join Button */}
        <Pressable
          onPress={handleJoinChat}
          disabled={isJoining}
          style={({ pressed }) => ({
            opacity: pressed || isJoining ? 0.7 : 1,
            width: "100%",
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
            style={{
              paddingVertical: 16,
              borderRadius: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isJoining ? (
              <LuxeLogoLoader size={20} />
            ) : (
              <>
                <Text style={{ fontSize: 17, fontWeight: "600", color: "#FFFFFF", marginRight: 8 }}>
                  {user?.hasCompletedOnboarding ? "Join Chat" : "Start Onboarding"}
                </Text>
                <ArrowRight size={20} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

export default InviteScreen;
