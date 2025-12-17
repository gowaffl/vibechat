/**
 * Workflow Builder Modal
 *
 * Modal for creating and editing AI workflow automations.
 * Supports various trigger types and action types.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  X,
  Zap,
  MessageSquare,
  Calendar,
  ListTodo,
  Send,
  Clock,
  AtSign,
  Hash,
  ChevronRight,
  Check,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Workflow {
  id?: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: any;
  actionType: string;
  actionConfig: any;
  isEnabled?: boolean;
}

interface WorkflowBuilderModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  workflow?: Workflow | null; // For editing existing workflows
  onSuccess?: () => void;
}

const TRIGGER_TYPES = [
  {
    id: "keyword",
    label: "Keyword Trigger",
    description: 'When someone says specific words (e.g., "meeting")',
    icon: Hash,
    color: "#FF9F0A",
  },
  {
    id: "ai_mention",
    label: "@AI Mention",
    description: "When someone mentions @AI with a command",
    icon: AtSign,
    color: "#007AFF",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    description: "Run at specific times (daily, weekly)",
    icon: Clock,
    color: "#AF52DE",
  },
  {
    id: "message_pattern",
    label: "Message Pattern",
    description: "Match messages with regex patterns",
    icon: MessageSquare,
    color: "#34C759",
  },
];

const ACTION_TYPES = [
  {
    id: "create_event",
    label: "Create Event",
    description: "Automatically create a calendar event",
    icon: Calendar,
    color: "#FF453A",
  },
  {
    id: "create_poll",
    label: "Create Poll",
    description: "Start a poll based on the message",
    icon: ListTodo,
    color: "#FFD60A",
  },
  {
    id: "send_message",
    label: "Send Message",
    description: "Send an automated response",
    icon: Send,
    color: "#34C759",
  },
  {
    id: "ai_response",
    label: "AI Response",
    description: "Let AI respond with custom prompt",
    icon: Zap,
    color: "#007AFF",
  },
  {
    id: "summarize",
    label: "Summarize Chat",
    description: "Generate a summary of recent messages",
    icon: MessageSquare,
    color: "#AF52DE",
  },
];

const WorkflowBuilderModal: React.FC<WorkflowBuilderModalProps> = ({
  visible,
  onClose,
  chatId,
  workflow,
  onSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  // Form state
  const [step, setStep] = useState(1); // 1: Name, 2: Trigger, 3: Action, 4: Config
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [actionConfig, setActionConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || "");
      setSelectedTrigger(workflow.triggerType);
      setSelectedAction(workflow.actionType);
      setTriggerConfig(workflow.triggerConfig || {});
      setActionConfig(workflow.actionConfig || {});
      setStep(4); // Go to config step for editing
    } else {
      resetForm();
    }
  }, [workflow, visible]);

  const resetForm = () => {
    setStep(1);
    setName("");
    setDescription("");
    setSelectedTrigger(null);
    setSelectedAction(null);
    setTriggerConfig({});
    setActionConfig({});
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!user || !selectedTrigger || !selectedAction || !name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        chatId,
        userId: user.id,
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType: selectedTrigger,
        triggerConfig,
        actionType: selectedAction,
        actionConfig,
      };

      if (workflow?.id) {
        // Update existing
        await api.patch(`/api/workflows/${workflow.id}`, payload);
      } else {
        // Create new
        await api.post("/api/workflows", payload);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error("[WorkflowBuilder] Error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return selectedTrigger !== null;
    if (step === 3) return selectedAction !== null;
    return true;
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Name Your Workflow</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Give it a descriptive name so you remember what it does
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder='e.g., "Meeting Detector"'
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
            color: colors.text,
          },
        ]}
      />

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description (optional)"
        placeholderTextColor={colors.textTertiary}
        multiline
        numberOfLines={2}
        style={[
          styles.textArea,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
            color: colors.text,
          },
        ]}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Choose a Trigger</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        What should activate this workflow?
      </Text>

      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {TRIGGER_TYPES.map((trigger) => {
          const Icon = trigger.icon;
          const isSelected = selectedTrigger === trigger.id;
          return (
            <TouchableOpacity
              key={trigger.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedTrigger(trigger.id);
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? `${trigger.color}20`
                      : `${trigger.color}10`
                    : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: isSelected ? trigger.color : "transparent",
                },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${trigger.color}20` }]}>
                <Icon size={22} color={trigger.color} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{trigger.label}</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  {trigger.description}
                </Text>
              </View>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: trigger.color }]}>
                  <Check size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Choose an Action</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        What should happen when triggered?
      </Text>

      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {ACTION_TYPES.map((action) => {
          const Icon = action.icon;
          const isSelected = selectedAction === action.id;
          return (
            <TouchableOpacity
              key={action.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedAction(action.id);
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? `${action.color}20`
                      : `${action.color}10`
                    : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: isSelected ? action.color : "transparent",
                },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${action.color}20` }]}>
                <Icon size={22} color={action.color} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{action.label}</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  {action.description}
                </Text>
              </View>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: action.color }]}>
                  <Check size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Configure Details</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Fine-tune your workflow settings
      </Text>

      <ScrollView style={styles.configList} showsVerticalScrollIndicator={false}>
        {/* Trigger Config */}
        {selectedTrigger === "keyword" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Trigger Keywords</Text>
            <TextInput
              value={triggerConfig.keywords?.join(", ") || ""}
              onChangeText={(text) =>
                setTriggerConfig({
                  ...triggerConfig,
                  keywords: text.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="meeting, schedule, call, sync"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
            <Text style={[styles.configHint, { color: colors.textTertiary }]}>
              Separate keywords with commas
            </Text>
          </View>
        )}

        {selectedTrigger === "scheduled" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Schedule</Text>
            <TextInput
              value={triggerConfig.time || ""}
              onChangeText={(text) => setTriggerConfig({ ...triggerConfig, time: text })}
              placeholder="09:00"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
            <Text style={[styles.configHint, { color: colors.textTertiary }]}>
              Time in 24-hour format (HH:MM)
            </Text>
          </View>
        )}

        {selectedTrigger === "message_pattern" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Regex Pattern</Text>
            <TextInput
              value={triggerConfig.pattern || ""}
              onChangeText={(text) => setTriggerConfig({ ...triggerConfig, pattern: text })}
              placeholder="\b(meeting|schedule)\b"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
          </View>
        )}

        {/* Action Config */}
        {selectedAction === "send_message" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Message Template</Text>
            <TextInput
              value={actionConfig.messageTemplate || ""}
              onChangeText={(text) => setActionConfig({ ...actionConfig, messageTemplate: text })}
              placeholder="Hey! Looks like you mentioned a meeting..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
          </View>
        )}

        {selectedAction === "ai_response" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>AI System Prompt</Text>
            <TextInput
              value={actionConfig.systemPrompt || ""}
              onChangeText={(text) => setActionConfig({ ...actionConfig, systemPrompt: text })}
              placeholder="You are a helpful assistant that..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
          </View>
        )}

        {selectedAction === "create_event" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Event Title Template</Text>
            <TextInput
              value={actionConfig.eventTitle || ""}
              onChangeText={(text) => setActionConfig({ ...actionConfig, eventTitle: text })}
              placeholder="Meeting: {{topic}}"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
            <TouchableOpacity
              onPress={() =>
                setActionConfig({
                  ...actionConfig,
                  extractFromMessage: !actionConfig.extractFromMessage,
                })
              }
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: actionConfig.extractFromMessage ? colors.primary : "transparent",
                    borderColor: actionConfig.extractFromMessage ? colors.primary : colors.textSecondary,
                  },
                ]}
              >
                {actionConfig.extractFromMessage && <Check size={12} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                Extract details from message with AI
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedAction === "summarize" && (
          <View style={styles.configSection}>
            <Text style={[styles.configLabel, { color: colors.text }]}>Messages to Summarize</Text>
            <TextInput
              value={String(actionConfig.messageCount || 50)}
              onChangeText={(text) =>
                setActionConfig({ ...actionConfig, messageCount: parseInt(text) || 50 })
              }
              placeholder="50"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                  color: colors.text,
                },
              ]}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <BlurView
        intensity={isDark ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
          <View
            style={[
              styles.modal,
              {
                backgroundColor: isDark ? colors.cardBackground : "#fff",
                borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isDark ? "rgba(255, 159, 10, 0.2)" : "rgba(255, 159, 10, 0.1)" },
                  ]}
                >
                  <Zap size={24} color="#FF9F0A" />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {workflow ? "Edit Workflow" : "New Workflow"}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Step {step} of 4
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View style={styles.progress}>
              {[1, 2, 3, 4].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: s <= step ? "#FF9F0A" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    },
                  ]}
                />
              ))}
            </View>

            {/* Content */}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}

            {/* Error */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              {step > 1 && (
                <TouchableOpacity
                  onPress={() => setStep(step - 1)}
                  style={[
                    styles.backButton,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={step < 4 ? () => setStep(step + 1) : handleSave}
                disabled={!canProceed() || saving}
                style={[
                  styles.nextButton,
                  {
                    backgroundColor: canProceed() && !saving ? "#FF9F0A" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    flex: step === 1 ? 1 : undefined,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>{step < 4 ? "Next" : "Save Workflow"}</Text>
                    {step < 4 && <ChevronRight size={18} color="#fff" />}
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  keyboardAvoid: {
    width: "100%",
    alignItems: "center",
  },
  modal: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  progress: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    minHeight: 300,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  optionsList: {
    maxHeight: 280,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 10,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  configList: {
    maxHeight: 280,
  },
  configSection: {
    marginBottom: 16,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  configHint: {
    fontSize: 12,
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 4,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default WorkflowBuilderModal;

