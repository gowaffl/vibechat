import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { UserPlus, Check } from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { api, BACKEND_URL } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import type { RootStackScreenProps } from "@/navigation/types";
import type { User, InviteUserToChatRequest } from "@/shared/contracts";

const InviteMembersScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<"InviteMembers">["navigation"]>();
  const route = useRoute<RootStackScreenProps<"InviteMembers">["route"]>();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { chatId, chatName } = route.params;
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Fetch all users
  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["all-users"],
    queryFn: () => api.get<User[]>("/api/users"),
  });

  // Fetch current chat members
  const { data: chatMembers = [] } = useQuery<User[]>({
    queryKey: ["chat-members", chatId],
    queryFn: () => api.get<User[]>(`/api/chats/${chatId}/members?userId=${user?.id}`),
    enabled: !!user?.id,
  });

  // Filter out users who are already members
  const availableUsers = allUsers.filter(
    (u) => !chatMembers.some((member) => member.id === u.id)
  );

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: (data: InviteUserToChatRequest) =>
      api.post(`/api/chats/${chatId}/invite`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-members", chatId] });
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
  });

  const toggleUserSelection = (userId: string) => {
    Haptics.selectionAsync();
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleInviteMembers = async () => {
    if (selectedUserIds.length === 0) {
      Alert.alert("No Users Selected", "Please select at least one user to invite");
      return;
    }

    setIsInviting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Invite all selected users
      await Promise.all(
        selectedUserIds.map((userId) =>
          inviteMemberMutation.mutateAsync({
            inviterId: user!.id,
            userIdToInvite: userId,
          })
        )
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success",
        `Invited ${selectedUserIds.length} ${selectedUserIds.length === 1 ? "member" : "members"} to ${chatName}`,
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error("Error inviting members:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to invite members. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUserIds.includes(item.id);

    return (
      <Pressable
        onPress={() => toggleUserSelection(item.id)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            backgroundColor: isSelected
              ? "rgba(138, 43, 226, 0.15)"
              : "rgba(255, 255, 255, 0.05)",
            borderRadius: 16,
            marginHorizontal: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isSelected
              ? "rgba(138, 43, 226, 0.5)"
              : "rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* User Avatar */}
          {item.image && getFullImageUrl(item.image) ? (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                marginRight: 12,
                borderWidth: 2,
                borderColor: isSelected
                  ? "rgba(138, 43, 226, 0.5)"
                  : "rgba(138, 43, 226, 0.3)",
                overflow: "hidden",
              }}
            >
              <Image
                source={{ uri: getFullImageUrl(item.image) }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: getColorFromName(item.name),
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
                borderWidth: 2,
                borderColor: isSelected
                  ? "rgba(138, 43, 226, 0.5)"
                  : "rgba(138, 43, 226, 0.3)",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                {getInitials(item.name)}
              </Text>
            </View>
          )}

          {/* User Info */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: "#FFFFFF",
                marginBottom: 2,
              }}
            >
              {item.name}
            </Text>
            {item.bio && (
              <Text
                style={{
                  fontSize: 14,
                  color: "rgba(255, 255, 255, 0.6)",
                }}
                numberOfLines={1}
              >
                {item.bio}
              </Text>
            )}
          </View>

          {/* Selection Indicator */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isSelected
                ? "#8B5CF6"
                : "rgba(255, 255, 255, 0.1)",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 12,
            }}
          >
            {isSelected && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : availableUsers.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <UserPlus size={64} color="rgba(255, 255, 255, 0.2)" strokeWidth={1.5} />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: "#FFFFFF",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            All Users Invited
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: "rgba(255, 255, 255, 0.6)",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Everyone has already been invited to this chat
          </Text>
        </View>
      ) : (
        <>
          <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text
              style={{
                fontSize: 15,
                color: "rgba(255, 255, 255, 0.6)",
                textAlign: "center",
              }}
            >
              {selectedUserIds.length > 0
                ? `${selectedUserIds.length} ${selectedUserIds.length === 1 ? "user" : "users"} selected`
                : "Select users to invite"}
            </Text>
          </View>

          <FlatList
            data={availableUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: insets.bottom + 100,
            }}
          />

          {/* Floating Invite Button */}
          {selectedUserIds.length > 0 && (
            <View
              style={{
                position: "absolute",
                bottom: insets.bottom + 20,
                left: 20,
                right: 20,
              }}
            >
              <Pressable
                onPress={handleInviteMembers}
                disabled={isInviting}
                style={({ pressed }) => ({
                  opacity: pressed || isInviting ? 0.7 : 1,
                })}
              >
                <LinearGradient
                  colors={["#8B5CF6", "#6366F1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#8B5CF6",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                  }}
                >
                  {isInviting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <UserPlus size={20} color="#FFFFFF" strokeWidth={2.5} />
                      <Text
                        style={{
                          fontSize: 17,
                          fontWeight: "600",
                          color: "#FFFFFF",
                          marginLeft: 8,
                        }}
                      >
                        Invite {selectedUserIds.length}{" "}
                        {selectedUserIds.length === 1 ? "Member" : "Members"}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default InviteMembersScreen;
