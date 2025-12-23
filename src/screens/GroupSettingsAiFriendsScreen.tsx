import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Sparkles, Plus, Trash2, Check, Globe } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { supabaseClient } from "@/lib/authClient";
import { aiFriendsApi } from "@/api/ai-friends";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { ShareToCommunityModal } from "@/components/Community";
import type { RootStackScreenProps } from "@/navigation/types";
import type { AIFriend, CreateAIFriendRequest, UpdateAIFriendRequest } from "@/shared/contracts";

// Draggable Slider Component
const DraggableSlider: React.FC<{
  value: number;
  onValueChange: (value: number) => void;
  colors: any;
}> = ({ value, onValueChange, colors }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const sliderRef = React.useRef<View>(null);
  const layoutRef = React.useRef<{ width: number; pageX: number } | null>(null);
  const propsRef = React.useRef({ value, onValueChange });
  
  propsRef.current = { value, onValueChange };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setIsDragging(true);
        Haptics.selectionAsync();
        
        const touchX = event.nativeEvent.pageX;

        if (sliderRef.current) {
          sliderRef.current.measure((x, y, width, height, pageX, pageY) => {
            layoutRef.current = { width, pageX };
            
            const relativeX = touchX - pageX;
            const percentage = Math.max(0, Math.min(100, Math.round((relativeX / width) * 100)));
            
            if (percentage !== propsRef.current.value) {
              Haptics.selectionAsync();
              propsRef.current.onValueChange(percentage);
            }
          });
        }
      },
      onPanResponderMove: (event) => {
        if (layoutRef.current) {
          const { width, pageX } = layoutRef.current;
          const relativeX = event.nativeEvent.pageX - pageX;
          const percentage = Math.max(0, Math.min(100, Math.round((relativeX / width) * 100)));
          
          if (percentage !== propsRef.current.value) {
            Haptics.selectionAsync();
            propsRef.current.onValueChange(percentage);
          }
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
    })
  ).current;

  return (
    <View style={{ height: 40, justifyContent: "center" }}>
      <View
        ref={sliderRef}
        style={{
          height: 6,
          backgroundColor: colors.success + "33",
          borderRadius: 3,
          position: "relative",
        }}
        {...panResponder.panHandlers}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${value}%`,
            backgroundColor: colors.success,
            borderRadius: 3,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${value}%`,
            top: -7,
            width: isDragging ? 24 : 20,
            height: isDragging ? 24 : 20,
            borderRadius: isDragging ? 12 : 10,
            backgroundColor: colors.success,
            marginLeft: isDragging ? -12 : -10,
            shadowColor: colors.success,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: isDragging ? 6 : 4,
            elevation: isDragging ? 6 : 4,
          }}
        />
      </View>
    </View>
  );
};

const GroupSettingsAiFriendsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const route = useRoute<RootStackScreenProps<"GroupSettingsAiFriends">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"GroupSettingsAiFriends">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();

  const { chatId } = route.params;

  // AI Friends state
  const [selectedAiFriendId, setSelectedAiFriendId] = useState<string | null>(null);
  const [isCreatingAiFriend, setIsCreatingAiFriend] = useState(false);
  const [aiPersonality, setAiPersonality] = useState("");
  const [aiTone, setAiTone] = useState("");
  const [aiName, setAiName] = useState("");
  const [aiEngagementMode, setAiEngagementMode] = useState<"on-call" | "percentage" | "off">("on-call");
  const [aiEngagementPercent, setAiEngagementPercent] = useState<number>(50);

  // Share to Community state
  const [showShareModal, setShowShareModal] = useState(false);
  const [itemToShare, setItemToShare] = useState<{ type: "ai_friend" | "command"; data: any } | null>(null);

  // Available tone chips
  const toneOptions = [
    "Professional", "Casual", "Friendly", "Humorous", "Sarcastic", "Formal", "Enthusiastic", "Calm"
  ];

  // Fetch AI friends for this chat
  const { data: aiFriends = [], isLoading: isLoadingAiFriends } = useQuery<AIFriend[]>({
    queryKey: ["aiFriends", chatId],
    queryFn: () => aiFriendsApi.getAIFriends(chatId, user?.id || ""),
    enabled: !!user?.id && !!chatId,
  });

  // Check permissions (assuming canEdit is true for now or fetched)
  // We need to fetch chat to know if user can edit
  const { data: chat } = useQuery<any>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });
  
  const isCreator = chat?.creatorId === user?.id;
  const isRestricted = chat?.isRestricted || false;
  const canEdit = !isRestricted || isCreator;

  // Subscribe to AI friend changes
  React.useEffect(() => {
    if (!chatId) return;

    const channel = supabaseClient.channel(`ai_friends:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_friend',
          filter: `chatId=eq.${chatId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  // Auto-select first AI friend when data loads
  React.useEffect(() => {
    if (aiFriends.length > 0 && !selectedAiFriendId) {
      setSelectedAiFriendId(aiFriends[0].id);
    }
  }, [aiFriends, selectedAiFriendId]);

  // Load selected AI friend data into form fields
  React.useEffect(() => {
    const selectedFriend = aiFriends.find(f => f.id === selectedAiFriendId);
    if (selectedFriend) {
      setAiName(selectedFriend.name);
      setAiPersonality(selectedFriend.personality || "");
      setAiTone(selectedFriend.tone || "");
      setAiEngagementMode(selectedFriend.engagementMode);
      setAiEngagementPercent(selectedFriend.engagementPercent || 50);
    }
  }, [selectedAiFriendId, aiFriends]);

  const createAIFriendMutation = useMutation({
    mutationFn: (data: Omit<CreateAIFriendRequest, 'userId'>) => {
      return aiFriendsApi.createAIFriend({ ...data, userId: user?.id || "" });
    },
    onSuccess: (newFriend) => {
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      setSelectedAiFriendId(newFriend.id);
      setIsCreatingAiFriend(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to create AI friend");
    },
  });

  const updateAIFriendMutation = useMutation({
    mutationFn: ({ aiFriendId, data }: { aiFriendId: string; data: Omit<UpdateAIFriendRequest, 'userId'> }) => {
      return aiFriendsApi.updateAIFriend(aiFriendId, { ...data, userId: user?.id || "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to update AI friend");
    },
  });

  const deleteAIFriendMutation = useMutation({
    mutationFn: (aiFriendId: string) => {
      return aiFriendsApi.deleteAIFriend(aiFriendId, user?.id || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiFriends", chatId] });
      setSelectedAiFriendId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to delete AI friend");
    },
  });

  const handleCreateAIFriend = () => {
    if (!chatId) return;
    
    // Create a new friend with default values
    createAIFriendMutation.mutate({
      chatId,
      name: "New AI Friend",
      personality: "I am a helpful AI assistant.",
      tone: "Friendly",
      engagementMode: "on-call",
      engagementPercent: 50
    });
  };

  const handleSaveAiSettings = () => {
    if (!selectedAiFriendId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateAIFriendMutation.mutate({
      aiFriendId: selectedAiFriendId,
      data: {
        name: aiName,
        personality: aiPersonality,
        tone: aiTone,
        engagementMode: aiEngagementMode,
        engagementPercent: aiEngagementPercent,
      }
    });
  };

  const handleSelectTone = (tone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAiTone(tone);
    
    // Auto-save when selecting chips for better UX
    if (selectedAiFriendId) {
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: {
            tone: tone,
        }
      });
    }
  };

  const handleSelectEngagementMode = (mode: "on-call" | "percentage" | "off") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAiEngagementMode(mode);
    
    // Auto-save
    if (selectedAiFriendId) {
      updateAIFriendMutation.mutate({
        aiFriendId: selectedAiFriendId,
        data: {
            engagementMode: mode,
        }
      });
    }
  };

  const handleUpdateEngagementPercent = (value: number) => {
    setAiEngagementPercent(value);
  };

  const handleDeleteAIFriend = (id: string | null) => {
    if (!id) return;
    
    Alert.alert(
      "Delete AI Friend",
      "Are you sure you want to delete this AI friend? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteAIFriendMutation.mutate(id),
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
          colors={isDark ? ["rgba(52, 199, 89, 0.05)", "transparent"] : ["rgba(52, 199, 89, 0.1)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 60, // Header space
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Action - Create New */}
          {canEdit && (
             <View className="items-end mb-6">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleCreateAIFriend();
                  }}
                  disabled={createAIFriendMutation.isPending}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(52, 199, 89, 0.15)",
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.success + "4D",
                    }}
                  >
                    {createAIFriendMutation.isPending ? (
                        <LuxeLogoLoader size="small" />
                    ) : (
                        <>
                            <Plus size={16} color={colors.success} style={{ marginRight: 6 }} />
                            <Text style={{ color: colors.success, fontWeight: "600" }}>New AI Friend</Text>
                        </>
                    )}
                  </View>
                </Pressable>
             </View>
          )}

          {/* AI Friend Selector */}
          {aiFriends.length > 1 && (
            <View className="mb-6">
              <Text className="text-xs font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>
                SELECT AI FRIEND
              </Text>
              <View
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.success + "26",
                }}
              >
                {aiFriends.map((friend, index) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedAiFriendId(friend.id);
                    }}
                    style={{
                      padding: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: selectedAiFriendId === friend.id
                        ? "rgba(52, 199, 89, 0.1)"
                        : "transparent",
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: colors.glassBorder,
                    }}
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: friend.color,
                          marginRight: 12,
                        }}
                      />
                      <Text
                        style={{
                          color: selectedAiFriendId === friend.id ? colors.success : colors.text,
                          fontSize: 16,
                          fontWeight: selectedAiFriendId === friend.id ? "600" : "500",
                        }}
                      >
                        {friend.name}
                      </Text>
                    </View>
                    {selectedAiFriendId === friend.id && (
                      <Check size={18} color={colors.success} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {selectedAiFriendId ? (
            <View className="gap-6">
                {/* Identity Section */}
                <View>
                    <Text className="text-xs font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>IDENTITY</Text>
                    <View style={{ backgroundColor: colors.glassBackground, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.glassBorder }}>
                        <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                            Name
                        </Text>
                        <TextInput
                            value={aiName}
                            onChangeText={setAiName}
                            className="rounded-lg px-4 py-3 text-base mb-4"
                            keyboardAppearance={isDark ? "dark" : "light"}
                            style={{
                            backgroundColor: colors.inputBackground,
                            color: colors.text,
                            borderWidth: 1,
                            borderColor: colors.success + "4D",
                            }}
                            placeholder="e.g., 'Jarvis', 'Buddy'"
                            placeholderTextColor={colors.inputPlaceholder}
                            maxLength={50}
                        />

                        <Text className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                            Instructions
                        </Text>
                        <TextInput
                            value={aiPersonality}
                            onChangeText={setAiPersonality}
                            className="rounded-lg px-4 py-3 text-base"
                            keyboardAppearance={isDark ? "dark" : "light"}
                            style={{
                            backgroundColor: colors.inputBackground,
                            color: colors.text,
                            borderWidth: 1,
                            borderColor: colors.success + "4D",
                            }}
                            placeholder="e.g., 'You are a helpful friend...'"
                            placeholderTextColor={colors.inputPlaceholder}
                            multiline
                            numberOfLines={4}
                            maxLength={500}
                        />
                    </View>
                </View>

                {/* Tone Section */}
                <View>
                    <Text className="text-xs font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>TONE</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {toneOptions.map((tone) => {
                            const isSelected = aiTone === tone;
                            return (
                                <Pressable
                                key={tone}
                                onPress={() => handleSelectTone(tone)}
                                disabled={updateAIFriendMutation.isPending}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 20,
                                    backgroundColor: isSelected ? colors.success + "40" : colors.inputBackground,
                                    borderWidth: 1,
                                    borderColor: isSelected ? colors.success : colors.border,
                                }}
                                >
                                <Text
                                    className="text-sm font-medium"
                                    style={{ color: isSelected ? colors.success : colors.text }}
                                >
                                    {tone}
                                </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Engagement Section */}
                <View>
                    <Text className="text-xs font-semibold mb-3 ml-1" style={{ color: colors.textSecondary }}>ENGAGEMENT</Text>
                    <View style={{ backgroundColor: colors.glassBackground, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: colors.glassBorder }}>
                         <View className="flex-col gap-2">
                             {(["on-call", "percentage", "off"] as const).map((mode) => (
                                 <Pressable
                                    key={mode}
                                    onPress={() => handleSelectEngagementMode(mode)}
                                    style={{
                                        padding: 12,
                                        borderRadius: 12,
                                        backgroundColor: aiEngagementMode === mode ? colors.success + "20" : "transparent",
                                        borderWidth: 1,
                                        borderColor: aiEngagementMode === mode ? colors.success : "transparent",
                                    }}
                                 >
                                     <Text style={{ color: aiEngagementMode === mode ? colors.success : colors.text, fontWeight: "600", marginBottom: 2 }}>
                                         {mode === "on-call" && "On-Call Only (@ai)"}
                                         {mode === "percentage" && "Automatic Engagement"}
                                         {mode === "off" && "Off"}
                                     </Text>
                                     <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                         {mode === "on-call" && "Only responds when mentioned"}
                                         {mode === "percentage" && "Joins naturally based on %"}
                                         {mode === "off" && "Completely disabled"}
                                     </Text>
                                 </Pressable>
                             ))}
                         </View>
                    </View>

                    {aiEngagementMode === "percentage" && (
                        <View className="mt-4 p-4 rounded-xl" style={{ backgroundColor: colors.success + "10", borderWidth: 1, borderColor: colors.success + "20" }}>
                            <View className="flex-row justify-between items-center mb-4">
                                <Text style={{ color: colors.success, fontWeight: "600" }}>Frequency</Text>
                                <Text style={{ color: colors.success, fontWeight: "bold", fontSize: 18 }}>{aiEngagementPercent}%</Text>
                            </View>
                            <DraggableSlider
                                value={aiEngagementPercent}
                                onValueChange={handleUpdateEngagementPercent}
                                colors={colors}
                            />
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View className="gap-3 mb-8">
                     <Pressable
                        onPress={handleSaveAiSettings}
                        disabled={updateAIFriendMutation.isPending}
                     >
                         <View style={{
                             backgroundColor: colors.success,
                             padding: 16,
                             borderRadius: 16,
                             alignItems: "center",
                             shadowColor: colors.success,
                             shadowOffset: { width: 0, height: 4 },
                             shadowOpacity: 0.3,
                             shadowRadius: 8,
                         }}>
                             {updateAIFriendMutation.isPending ? (
                                 <LuxeLogoLoader size="small" />
                             ) : (
                                 <Text style={{ color: "#000", fontWeight: "bold", fontSize: 16 }}>Save Changes</Text>
                             )}
                         </View>
                     </Pressable>

                     <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const selectedFriend = aiFriends.find(f => f.id === selectedAiFriendId);
                            if (selectedFriend) {
                                setItemToShare({ type: "ai_friend", data: selectedFriend });
                                setShowShareModal(true);
                            }
                        }}
                     >
                         <View style={{
                             backgroundColor: colors.primary + "15",
                             padding: 16,
                             borderRadius: 16,
                             alignItems: "center",
                             flexDirection: "row",
                             justifyContent: "center",
                             borderWidth: 1,
                             borderColor: colors.primary + "40"
                         }}>
                             <Globe size={18} color={colors.primary} style={{ marginRight: 8 }} />
                             <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 16 }}>Share to Community</Text>
                         </View>
                     </Pressable>

                     {aiFriends.length > 1 && (
                         <Pressable
                            onPress={() => handleDeleteAIFriend(selectedAiFriendId)}
                         >
                             <View style={{
                                 backgroundColor: "rgba(255, 69, 58, 0.1)",
                                 padding: 16,
                                 borderRadius: 16,
                                 alignItems: "center",
                                 flexDirection: "row",
                                 justifyContent: "center",
                                 borderWidth: 1,
                                 borderColor: "#FF453A"
                             }}>
                                 <Trash2 size={18} color="#FF453A" style={{ marginRight: 8 }} />
                                 <Text style={{ color: "#FF453A", fontWeight: "600", fontSize: 16 }}>Delete AI Friend</Text>
                             </View>
                         </Pressable>
                     )}
                </View>
            </View>
          ) : (
            <View className="items-center justify-center py-20">
                <Text style={{ color: colors.textSecondary }}>No AI Friends found.</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Share Modal */}
      <ShareToCommunityModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        item={itemToShare}
      />
    </View>
  );
};

export default GroupSettingsAiFriendsScreen;
