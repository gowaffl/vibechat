import React, { useState } from "react";
import { View, Text, Pressable, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Plus } from "lucide-react-native";
import { WorkflowBuilderModal, WorkflowList } from "@/components/Workflows";
import type { RootStackScreenProps } from "@/navigation/types";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";

const GroupSettingsWorkflowsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const route = useRoute<RootStackScreenProps<"GroupSettingsWorkflows">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"GroupSettingsWorkflows">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();

  const { chatId } = route.params;

  // Workflow state
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  // Check permissions (assuming canEdit is true for now or fetched)
  const { data: chat } = useQuery<any>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });
  
  const isCreator = chat?.creatorId === user?.id;
  const isRestricted = chat?.isRestricted || false;
  const canEdit = !isRestricted || isCreator;

  // Fetch workflows for this chat
  const { data: workflows = [], isLoading: isLoadingWorkflows } = useQuery<any[]>({
    queryKey: ["workflows", chatId],
    queryFn: () => api.get(`/api/workflows?chatId=${chatId}&userId=${user?.id}`),
    enabled: !!chatId && !!user?.id,
  });

  const toggleWorkflowMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/workflows/${id}`, { isEnabled, userId: user?.id }),
    onMutate: async ({ id, isEnabled }) => {
      await queryClient.cancelQueries({ queryKey: ["workflows", chatId] });
      const previousWorkflows = queryClient.getQueryData(["workflows", chatId]);
      
      queryClient.setQueryData(["workflows", chatId], (old: any[]) =>
        old?.map((w) => (w.id === id ? { ...w, isEnabled } : w))
      );
      
      return { previousWorkflows };
    },
    onError: (error, _, context) => {
      if (context?.previousWorkflows) {
        queryClient.setQueryData(["workflows", chatId], context.previousWorkflows);
      }
      console.error("[Workflows] Failed to toggle workflow:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/workflows/${id}?userId=${user?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[Workflows] Failed to delete workflow:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete workflow");
    },
  });

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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingTop: insets.top + 60, paddingHorizontal: 20 }}>
          {/* Header Action - Create New */}
          {canEdit && (
             <View className="items-end mb-4">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setEditingWorkflowId(null);
                    setShowWorkflowBuilder(true);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(0, 122, 255, 0.15)",
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.primary + "4D",
                    }}
                  >
                     <Plus size={16} color={colors.primary} style={{ marginRight: 6 }} />
                     <Text style={{ color: colors.primary, fontWeight: "600" }}>New Workflow</Text>
                  </View>
                </Pressable>
             </View>
          )}

          <WorkflowList
            workflows={workflows}
            loading={isLoadingWorkflows}
            onToggle={(workflowId, enabled) => {
              toggleWorkflowMutation.mutate({ id: workflowId, isEnabled: enabled });
            }}
            onEdit={(workflow) => {
              setEditingWorkflowId(workflow.id);
              setShowWorkflowBuilder(true);
            }}
            onDelete={(workflowId) => {
              Alert.alert(
                "Delete Workflow",
                "Are you sure you want to delete this workflow?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteWorkflowMutation.mutate(workflowId),
                  },
                ]
              );
            }}
            onCreateNew={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setEditingWorkflowId(null);
              setShowWorkflowBuilder(true);
            }}
          />
        </View>
      </KeyboardAvoidingView>

      <WorkflowBuilderModal
        visible={showWorkflowBuilder}
        onClose={() => {
          setShowWorkflowBuilder(false);
          setEditingWorkflowId(null);
        }}
        chatId={chatId}
        userId={user?.id || ""}
        workflow={editingWorkflowId ? workflows.find((w) => w.id === editingWorkflowId) : null}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ["workflows", chatId] });
          setShowWorkflowBuilder(false);
          setEditingWorkflowId(null);
        }}
      />
    </View>
  );
};

export default GroupSettingsWorkflowsScreen;
