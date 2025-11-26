import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Image, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, ArrowRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BACKEND_URL } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import type { RootStackScreenProps } from "@/navigation/types";
import type { GetInviteInfoResponse, JoinChatViaInviteResponse } from "@/shared/contracts";

const InviteScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<RootStackScreenProps<"Invite">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"Invite">["navigation"]>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { token } = route.params;

  const [isJoining, setIsJoining] = useState(false);

  // Fetch invite info
  const { data: inviteInfo, isLoading, error } = useQuery<GetInviteInfoResponse>({
    queryKey: ["invite-info", token],
    queryFn: () => api.get(`/api/invite/${token}`),
  });

  // Join chat mutation
  const joinChatMutation = useMutation({
    mutationFn: () => api.post<JoinChatViaInviteResponse>(`/api/invite/${token}/join`, { userId: user?.id }),
    onSuccess: (response: JoinChatViaInviteResponse) => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to the chat
      navigation.navigate("Chat", {
        chatId: response.chatId,
        chatName: inviteInfo?.chatName || "Chat",
      });
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

  const getFullImageUrl = (imageUrl: string | null | undefined): string => {
    if (!imageUrl) return "";
    // If already a full URL, extract the path and reconstruct with current BACKEND_URL
    // This handles cases where the URL was saved with a different backend URL
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      try {
        const url = new URL(imageUrl);
        // Use the pathname (e.g., /uploads/image.jpg) with current BACKEND_URL
        return `${BACKEND_URL}${url.pathname}`;
      } catch {
        // If URL parsing fails, return as is
        return imageUrl;
      }
    }
    return `${BACKEND_URL}${imageUrl}`;
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{ color: "#FFFFFF", marginTop: 16, fontSize: 16 }}>Loading invite...</Text>
      </View>
    );
  }

  if (error || !inviteInfo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#FFFFFF", marginBottom: 8, textAlign: "center" }}>
          Invalid Invite
        </Text>
        <Text style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)", textAlign: "center", marginBottom: 24 }}>
          This invite link is invalid or has expired.
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate("MainTabs", { screen: "Chats" });
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <LinearGradient
            colors={["#8B5CF6", "#6366F1"]}
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
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <View style={{ flex: 1, paddingTop: insets.top + 32, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }}>
        {/* Chat Avatar */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: "rgba(138, 43, 226, 0.2)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            borderWidth: 3,
            borderColor: "rgba(138, 43, 226, 0.4)",
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
            <Users size={56} color="#8B5CF6" />
          )}
        </View>

        {/* Chat Info */}
        <Text style={{ fontSize: 28, fontWeight: "bold", color: "#FFFFFF", marginBottom: 8, textAlign: "center" }}>
          {inviteInfo.chatName}
        </Text>

        {inviteInfo.chatBio && (
          <Text style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)", marginBottom: 16, textAlign: "center" }}>
            {inviteInfo.chatBio}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 32 }}>
          <Users size={18} color="rgba(255, 255, 255, 0.5)" />
          <Text style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.5)", marginLeft: 6 }}>
            {inviteInfo.memberCount} {inviteInfo.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF", marginBottom: 8, textAlign: "center" }}>
          You&apos;ve been invited to join
        </Text>
        <Text style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.6)", marginBottom: 32, textAlign: "center" }}>
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
          })}
        >
          <LinearGradient
            colors={["#8B5CF6", "#6366F1"]}
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
              <ActivityIndicator size="small" color="#FFFFFF" />
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
