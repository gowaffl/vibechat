import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, Platform, Modal, Share } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAnalytics, useScreenTracking } from "@/hooks/useAnalytics";
import { Users, UserPlus, X, Copy, Check, Share2 } from "lucide-react-native";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";
import type { RootStackScreenProps } from "@/navigation/types";
import type { GenerateInviteLinkResponse } from "@/shared/contracts";

const GroupSettingsMembersScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const route = useRoute<RootStackScreenProps<"GroupSettingsMembers">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"GroupSettingsMembers">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();
  const analytics = useAnalytics();

  const { chatId } = route.params;

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Track screen view
  useScreenTracking("GroupSettingsMembers", {
    chat_id: chatId,
  });

  // Fetch chat details including members
  const { data: chat } = useQuery<any>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  const isCreator = chat?.creatorId === user?.id;
  const isRestricted = chat?.isRestricted || false;
  
  const generateInviteLinkMutation = useMutation({
    mutationFn: () => api.post<GenerateInviteLinkResponse>(`/api/chats/${chatId}/invite-link`, { userId: user?.id }),
    onSuccess: (data) => {
      setInviteToken(data.inviteToken);
      setInviteLink(data.inviteLink);
      setShowInviteModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[Members] Failed to generate invite link:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to generate invite link");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/api/chats/${chatId}/members/${userId}?requesterId=${user?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[Members] Failed to remove member:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to remove member");
    },
  });

  const handleGenerateInviteLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (inviteToken) {
      setShowInviteModal(true);
    } else {
      generateInviteLinkMutation.mutate();
    }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${userName} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMemberMutation.mutate(userId),
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
      >
        <View className="flex-row items-center justify-between mb-6">
            <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
                {chat?.members?.length || 0} MEMBERS
            </Text>
            {/* Invite Button - Hide in Restricted Mode if not Creator */}
            {(!isRestricted || isCreator) && (
                <Pressable
                onPress={handleGenerateInviteLink}
                style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                })}
                >
                <View
                    className="flex-row items-center px-4 py-2 rounded-full"
                    style={{
                    backgroundColor: colors.primary + "26",
                    borderWidth: 1,
                    borderColor: colors.primary + "4D",
                    }}
                >
                    <UserPlus size={16} color={colors.primary} />
                    <Text className="ml-2 font-semibold text-sm" style={{ color: colors.primary }}>
                    Invite
                    </Text>
                </View>
                </Pressable>
            )}
        </View>

        <View
            style={{
            backgroundColor: colors.inputBackground,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            }}
        >
            {chat?.members?.map((member: any, index: number) => (
                <View
                  key={member.id}
                  className="flex-row items-center p-4"
                  style={{ 
                      borderBottomWidth: index < chat.members.length - 1 ? 0.5 : 0, 
                      borderBottomColor: colors.glassBorder 
                  }}
                >
                  {member.user?.image && getFullImageUrl(member.user.image) ? (
                    <Image
                      source={{ uri: getFullImageUrl(member.user.image) }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: getColorFromName(member.user?.name),
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
                        {getInitials(member.user?.name)}
                      </Text>
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold" style={{ color: colors.text }}>
                      {member.user?.name || "Unknown"}
                      {member.userId === user?.id && " (You)"}
                      {member.userId === chat.creatorId && <Text style={{ color: colors.primary }}> • Owner</Text>}
                    </Text>
                    {member.user?.bio && (
                      <Text className="text-sm" style={{ color: colors.textSecondary }} numberOfLines={1}>
                        {member.user.bio}
                      </Text>
                    )}
                  </View>
                  {/* Remove member button - only show for creator and not for themselves */}
                  {isCreator && member.userId !== user?.id && (
                    <Pressable
                      onPress={() => handleRemoveMember(member.userId, member.user?.name || "this member")}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.5 : 1,
                        padding: 8,
                      })}
                    >
                        <X size={18} color={colors.error} />
                    </Pressable>
                  )}
                </View>
            ))}
        </View>
      </ScrollView>

      {/* Invite Link Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <Pressable 
            style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}
            onPress={() => setShowInviteModal(false)}
        >
            <Pressable 
                style={{
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingTop: 24,
                    paddingBottom: insets.bottom + 24,
                    paddingHorizontal: 20,
                    width: "100%",
                }}
                onPress={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text }}>
                    Invite to Chat
                    </Text>
                    <Pressable
                    onPress={() => setShowInviteModal(false)}
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.inputBackground,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    >
                    <X size={20} color={colors.text} />
                    </Pressable>
                </View>

                <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 20 }}>
                    Share this link with anyone to invite them to join this chat
                </Text>

                {inviteToken ? (
                    <>
                    {/* Invite Code */}
                    <View
                        style={{
                        backgroundColor: colors.primary + "26",
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        borderWidth: 2,
                        borderColor: "rgba(79, 195, 247, 0.4)",
                        alignItems: "center",
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary, marginBottom: 12 }}>
                        INVITE CODE
                        </Text>
                        <Text
                        style={{
                            fontSize: 32,
                            fontWeight: "bold",
                            color: colors.text,
                            fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                            letterSpacing: 4,
                        }}
                        selectable
                        >
                        {inviteToken}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <Pressable
                        onPress={async () => {
                            if (inviteToken) {
                            await Clipboard.setStringAsync(inviteToken);
                            setLinkCopied(true);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setTimeout(() => setLinkCopied(false), 2000);
                            }
                        }}
                        style={({ pressed }) => ({
                            opacity: pressed ? 0.7 : 1,
                            flex: 1,
                        })}
                        >
                        <View
                            style={{
                            backgroundColor: colors.primary + "26",
                            borderWidth: 1,
                            borderColor: "rgba(79, 195, 247, 0.3)",
                            borderRadius: 12,
                            paddingVertical: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            }}
                        >
                            {linkCopied ? (
                            <>
                                <Check size={20} color={colors.primary} />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary, marginLeft: 8 }}>
                                Copied!
                                </Text>
                            </>
                            ) : (
                            <>
                                <Copy size={20} color={colors.primary} />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary, marginLeft: 8 }}>
                                Copy Code
                                </Text>
                            </>
                            )}
                        </View>
                        </Pressable>

                        <Pressable
                        onPress={async () => {
                            if (inviteToken && inviteLink && chat?.name) {
                              const shareMessage = `Join our chat "${chat.name}" on VibeChat!\n\n${inviteLink}`;
                              
                              try {
                                // Try to use Share API with timeout
                                const sharePromise = Share.share({ message: shareMessage });
                                const timeoutPromise = new Promise((_, reject) => 
                                  setTimeout(() => reject(new Error("Share timeout")), 3000)
                                );
                                
                                await Promise.race([sharePromise, timeoutPromise]);
                                
                                // Track invite sent
                                analytics.capture('invite_sent', {
                                  chat_id: chatId,
                                  chat_type: 'group',
                                  method: 'share_sheet',
                                });
                                
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              } catch (error: any) {
                                console.log("[Members] Share failed, using clipboard fallback:", error?.message);
                                
                                // Fallback: Copy to clipboard and show alert
                                await Clipboard.setStringAsync(shareMessage);
                                
                                // Track invite sent via clipboard
                                analytics.capture('invite_sent', {
                                  chat_id: chatId,
                                  chat_type: 'group',
                                  method: 'clipboard',
                                });
                                
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                
                                Alert.alert(
                                  "Invite Link Copied!",
                                  `The invite link has been copied to your clipboard. Share it with anyone you want to invite to "${chat.name}"!`,
                                  [{ text: "OK" }]
                                );
                              }
                            }
                        }}
                        style={({ pressed }) => ({
                            opacity: pressed ? 0.7 : 1,
                            flex: 1,
                        })}
                        >
                        <View
                            style={{
                            backgroundColor: colors.inputBackground,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingVertical: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            }}
                        >
                            <Share2 size={20} color={colors.text} />
                            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginLeft: 8 }}>
                            Share
                            </Text>
                        </View>
                        </Pressable>
                    </View>
                    </>
                ) : (
                    <View style={{ padding: 20, alignItems: "center" }}>
                        <LuxeLogoLoader size="small" />
                        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                            Generating invite...
                        </Text>
                    </View>
                )}
            </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default GroupSettingsMembersScreen;
