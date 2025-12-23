import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRoute, useNavigation } from "@react-navigation/native";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Zap, Plus, Edit2, Trash2, Globe } from "lucide-react-native";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import { ShareToCommunityModal } from "@/components/Community";
import type { RootStackScreenProps } from "@/navigation/types";
import type { CustomSlashCommand, GetCustomCommandsResponse, CreateCustomCommandRequest, UpdateCustomCommandRequest } from "@/shared/contracts";

const GroupSettingsCommandsScreen = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const route = useRoute<RootStackScreenProps<"GroupSettingsCommands">["route"]>();
  const navigation = useNavigation<RootStackScreenProps<"GroupSettingsCommands">["navigation"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();

  const { chatId } = route.params;

  const [isAddingCommand, setIsAddingCommand] = useState(false);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [newCommand, setNewCommand] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  
  // Share to Community state
  const [showShareModal, setShowShareModal] = useState(false);
  const [itemToShare, setItemToShare] = useState<{ type: "ai_friend" | "command"; data: any } | null>(null);

  // Check permissions
  const { data: chat } = useQuery<any>({
    queryKey: ["chat", chatId],
    queryFn: () => api.get(`/api/chats/${chatId}?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });
  
  const isCreator = chat?.creatorId === user?.id;
  const isRestricted = chat?.isRestricted || false;
  const canEdit = !isRestricted || isCreator;

  // Fetch custom commands
  const { data: customCommands = [] } = useQuery<CustomSlashCommand[]>({
    queryKey: ["customCommands", chatId],
    queryFn: () => api.get<GetCustomCommandsResponse>(`/api/chats/${chatId}/commands?userId=${user?.id}`).then(res => res.commands),
    enabled: !!user?.id && !!chatId,
  });

  const createCommandMutation = useMutation({
    mutationFn: (data: CreateCustomCommandRequest) =>
      api.post(`/api/chats/${chatId}/commands`, { ...data, userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      setIsAddingCommand(false);
      setNewCommand("");
      setNewPrompt("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[CustomCommands] Failed to create command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to create custom command");
    },
  });

  const updateCommandMutation = useMutation({
    mutationFn: ({ commandId, data }: { commandId: string; data: UpdateCustomCommandRequest }) =>
      api.patch(`/api/chats/${chatId}/commands/${commandId}`, { ...data, userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      setEditingCommandId(null);
      setNewCommand("");
      setNewPrompt("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[CustomCommands] Failed to update command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update custom command");
    },
  });

  const deleteCommandMutation = useMutation({
    mutationFn: (commandId: string) =>
      api.delete(`/api/chats/${chatId}/commands/${commandId}?userId=${user?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customCommands", chatId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[CustomCommands] Failed to delete command:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete custom command");
    },
  });

  const handleCreateCommand = () => {
    if (!newCommand || !newPrompt) {
      Alert.alert("Missing Fields", "Please enter both a command name and a prompt.");
      return;
    }

    // Ensure command starts with /
    const formattedCommand = newCommand.startsWith("/") ? newCommand : `/${newCommand}`;
    
    // Check if command already exists
    if (customCommands.some(c => c.command.toLowerCase() === formattedCommand.toLowerCase())) {
        Alert.alert("Duplicate Command", "A command with this name already exists.");
        return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createCommandMutation.mutate({
      command: formattedCommand,
      prompt: newPrompt,
    });
  };

  const handleUpdateCommand = () => {
    if (!editingCommandId || !newCommand || !newPrompt) return;

    const formattedCommand = newCommand.startsWith("/") ? newCommand : `/${newCommand}`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateCommandMutation.mutate({
      commandId: editingCommandId,
      data: {
        command: formattedCommand,
        prompt: newPrompt,
      },
    });
  };

  const handleEditCommand = (cmd: CustomSlashCommand) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingCommandId(cmd.id);
    setNewCommand(cmd.command);
    setNewPrompt(cmd.prompt);
    setIsAddingCommand(false);
  };

  const handleDeleteCommand = (commandId: string) => {
    Alert.alert(
      "Delete Command",
      "Are you sure you want to delete this custom command?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteCommandMutation.mutate(commandId),
        },
      ]
    );
  };

  const handleCancelEditing = () => {
    setEditingCommandId(null);
    setIsAddingCommand(false);
    setNewCommand("");
    setNewPrompt("");
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
          colors={isDark ? ["rgba(255, 159, 10, 0.05)", "transparent"] : ["rgba(255, 159, 10, 0.1)", "transparent"]}
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
              paddingTop: insets.top + 60,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 20,
            }}
            keyboardShouldPersistTaps="handled"
        >
             {/* Header Action - Create New */}
             {canEdit && !isAddingCommand && !editingCommandId && (
                <View className="items-end mb-6">
                    <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleCancelEditing();
                        setIsAddingCommand(true);
                    }}
                    >
                    <View
                        style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(255, 159, 10, 0.15)",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: colors.warning + "4D",
                        }}
                    >
                        <Plus size={16} color={colors.warning} style={{ marginRight: 6 }} />
                        <Text style={{ color: colors.warning, fontWeight: "600" }}>New Command</Text>
                    </View>
                    </Pressable>
                </View>
            )}

            {/* Description */}
            <Text className="text-sm mb-6 text-center" style={{ color: colors.textSecondary }}>
                Create custom AI commands. Use them in chat like /image or /meme.
            </Text>

            {/* Add New Command Form */}
            {isAddingCommand && (
                <View className="mb-6 p-5 rounded-2xl" style={{ backgroundColor: colors.glassBackground, borderWidth: 1, borderColor: colors.glassBorder }}>
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.warning }}>
                    NEW COMMAND
                  </Text>
                  <TextInput
                    value={newCommand}
                    onChangeText={setNewCommand}
                    className="rounded-xl px-4 py-3 text-base mb-4"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="/roast, /factcheck, etc."
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="none"
                    maxLength={50}
                  />
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.warning }}>
                    AI PROMPT
                  </Text>
                  <TextInput
                    value={newPrompt}
                    onChangeText={setNewPrompt}
                    className="rounded-xl px-4 py-3 text-base mb-4"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="e.g., 'Roast the user's message in a funny way'"
                    placeholderTextColor={colors.inputPlaceholder}
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                  />
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={handleCancelEditing}
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="font-semibold" style={{ color: colors.text }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCreateCommand}
                      className="flex-1"
                      disabled={createCommandMutation.isPending}
                    >
                      <View
                        style={{
                          borderRadius: 12,
                          padding: 12,
                          alignItems: "center",
                          backgroundColor: "rgba(255, 159, 10, 0.15)",
                          borderWidth: 1,
                          borderColor: "#FF9F0A",
                        }}
                      >
                        {createCommandMutation.isPending ? (
                          <LuxeLogoLoader size="small" />
                        ) : (
                          <Text className="font-semibold" style={{ color: colors.warning }}>Create</Text>
                        )}
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Edit Command Form */}
              {editingCommandId && (
                <View className="mb-6 p-5 rounded-2xl" style={{ backgroundColor: colors.glassBackground, borderWidth: 1, borderColor: colors.glassBorder }}>
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.warning }}>
                    EDIT COMMAND
                  </Text>
                  <TextInput
                    value={newCommand}
                    onChangeText={setNewCommand}
                    className="rounded-xl px-4 py-3 text-base mb-4"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="/roast, /factcheck, etc."
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="none"
                    maxLength={50}
                  />
                  <Text className="text-xs font-semibold mb-2" style={{ color: colors.warning }}>
                    AI PROMPT
                  </Text>
                  <TextInput
                    value={newPrompt}
                    onChangeText={setNewPrompt}
                    className="rounded-xl px-4 py-3 text-base mb-4"
                    keyboardAppearance={isDark ? "dark" : "light"}
                    style={{
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderWidth: 1,
                      borderColor: colors.warning + "4D",
                    }}
                    placeholder="e.g., 'Roast the user's message in a funny way'"
                    placeholderTextColor={colors.inputPlaceholder}
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                  />
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={handleCancelEditing}
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="font-semibold" style={{ color: colors.text }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleUpdateCommand}
                      className="flex-1"
                      disabled={updateCommandMutation.isPending}
                    >
                      <View
                        style={{
                          borderRadius: 12,
                          padding: 12,
                          alignItems: "center",
                          backgroundColor: "rgba(255, 159, 10, 0.15)",
                          borderWidth: 1,
                          borderColor: "#FF9F0A",
                        }}
                      >
                        {updateCommandMutation.isPending ? (
                          <LuxeLogoLoader size="small" />
                        ) : (
                          <Text className="font-semibold" style={{ color: colors.warning }}>Update</Text>
                        )}
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Commands List */}
              {customCommands.length > 0 ? (
                <View className="gap-3">
                  {customCommands.map((cmd) => (
                    <View
                      key={cmd.id}
                      className="p-4 rounded-xl"
                      style={{
                        backgroundColor: colors.inputBackground,
                        borderWidth: 1,
                        borderColor: "rgba(255, 159, 10, 0.2)",
                      }}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-lg font-bold" style={{ color: colors.warning }}>
                          {cmd.command}
                        </Text>
                        <View className="flex-row gap-3">
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setItemToShare({ type: "command", data: cmd });
                              setShowShareModal(true);
                            }}
                          >
                            <Globe size={18} color={colors.primary} />
                          </Pressable>
                          {canEdit && (
                            <>
                              <Pressable
                                onPress={() => handleEditCommand(cmd)}
                                disabled={isAddingCommand || editingCommandId !== null}
                              >
                                <Edit2 size={18} color={colors.text} />
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeleteCommand(cmd.id)}
                                disabled={deleteCommandMutation.isPending}
                              >
                                <Trash2 size={18} color={colors.error} />
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                      <Text className="text-base" style={{ color: colors.textSecondary }}>
                        {cmd.prompt}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : !isAddingCommand && (
                <View className="items-center py-10">
                    <Zap size={48} color={colors.warning + "40"} />
                    <Text className="text-base text-center mt-4" style={{ color: colors.textSecondary }}>
                    No custom commands yet.{'\n'}Tap + New Command to create one!
                    </Text>
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

export default GroupSettingsCommandsScreen;
