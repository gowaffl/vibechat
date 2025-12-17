/**
 * Workflow List Component
 *
 * Displays a list of AI workflows for a chat with toggle and edit capabilities.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import {
  Zap,
  Hash,
  AtSign,
  Clock,
  MessageSquare,
  Calendar,
  ListTodo,
  Send,
  Trash2,
  Edit2,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  actionType: string;
  isEnabled: boolean;
  createdAt: string;
}

interface WorkflowListProps {
  workflows: Workflow[];
  loading?: boolean;
  onToggle: (workflowId: string, enabled: boolean) => void;
  onEdit: (workflow: Workflow) => void;
  onDelete: (workflowId: string) => void;
  onCreateNew: () => void;
}

const TRIGGER_ICONS: Record<string, any> = {
  keyword: { icon: Hash, color: "#FF9F0A" },
  ai_mention: { icon: AtSign, color: "#007AFF" },
  scheduled: { icon: Clock, color: "#AF52DE" },
  message_pattern: { icon: MessageSquare, color: "#34C759" },
  time_based: { icon: Clock, color: "#64D2FF" },
};

const ACTION_ICONS: Record<string, any> = {
  create_event: { icon: Calendar, color: "#FF453A" },
  create_poll: { icon: ListTodo, color: "#FFD60A" },
  send_message: { icon: Send, color: "#34C759" },
  ai_response: { icon: Zap, color: "#007AFF" },
  summarize: { icon: MessageSquare, color: "#AF52DE" },
  remind: { icon: Clock, color: "#FF9F0A" },
};

const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  loading = false,
  onToggle,
  onEdit,
  onDelete,
  onCreateNew,
}) => {
  const { colors, isDark } = useTheme();

  const getTriggerInfo = (type: string) => {
    return TRIGGER_ICONS[type] || { icon: Zap, color: "#888" };
  };

  const getActionInfo = (type: string) => {
    return ACTION_ICONS[type] || { icon: Zap, color: "#888" };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading workflows...
        </Text>
      </View>
    );
  }

  if (workflows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: isDark ? "rgba(255, 159, 10, 0.15)" : "rgba(255, 159, 10, 0.1)" },
          ]}
        >
          <Zap size={32} color="#FF9F0A" />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workflows Yet</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Create your first AI workflow to automate actions in this chat
        </Text>
        <TouchableOpacity
          onPress={onCreateNew}
          style={[styles.createButton, { backgroundColor: "#FF9F0A" }]}
        >
          <Zap size={18} color="#fff" />
          <Text style={styles.createButtonText}>Create Workflow</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {workflows.map((workflow) => {
        const triggerInfo = getTriggerInfo(workflow.triggerType);
        const actionInfo = getActionInfo(workflow.actionType);
        const TriggerIcon = triggerInfo.icon;
        const ActionIcon = actionInfo.icon;

        return (
          <TouchableOpacity
            key={workflow.id}
            onPress={() => onEdit(workflow)}
            activeOpacity={0.7}
            style={[
              styles.workflowCard,
              {
                backgroundColor: isDark ? colors.glassBackground : "rgba(255, 255, 255, 0.9)",
                borderColor: workflow.isEnabled
                  ? isDark
                    ? "rgba(255, 159, 10, 0.3)"
                    : "rgba(255, 159, 10, 0.2)"
                  : isDark
                  ? colors.glassBorder
                  : "rgba(0, 0, 0, 0.06)",
                opacity: workflow.isEnabled ? 1 : 0.7,
              },
            ]}
          >
            <View style={styles.workflowHeader}>
              {/* Trigger Icon */}
              <View style={[styles.iconBadge, { backgroundColor: `${triggerInfo.color}20` }]}>
                <TriggerIcon size={18} color={triggerInfo.color} />
              </View>

              {/* Arrow */}
              <ChevronRight size={16} color={colors.textTertiary} />

              {/* Action Icon */}
              <View style={[styles.iconBadge, { backgroundColor: `${actionInfo.color}20` }]}>
                <ActionIcon size={18} color={actionInfo.color} />
              </View>

              {/* Name & Toggle */}
              <View style={styles.workflowInfo}>
                <Text
                  style={[styles.workflowName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {workflow.name}
                </Text>
                {workflow.description && (
                  <Text
                    style={[styles.workflowDesc, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {workflow.description}
                  </Text>
                )}
              </View>

              {/* Toggle */}
              <Switch
                value={workflow.isEnabled}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  onToggle(workflow.id, value);
                }}
                trackColor={{
                  false: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  true: "#FF9F0A50",
                }}
                thumbColor={workflow.isEnabled ? "#FF9F0A" : isDark ? "#888" : "#ccc"}
              />
            </View>

            {/* Actions */}
            <View style={styles.workflowActions}>
              <TouchableOpacity
                onPress={() => onEdit(workflow)}
                style={[
                  styles.actionButton,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
                ]}
              >
                <Edit2 size={14} color={colors.textSecondary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onDelete(workflow.id);
                }}
                style={[
                  styles.actionButton,
                  { backgroundColor: "rgba(239, 68, 68, 0.1)" },
                ]}
              >
                <Trash2 size={14} color="#EF4444" />
                <Text style={[styles.actionText, { color: "#EF4444" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Add More Button */}
      <TouchableOpacity
        onPress={onCreateNew}
        style={[
          styles.addButton,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)",
          },
        ]}
      >
        <Zap size={18} color="#FF9F0A" />
        <Text style={[styles.addButtonText, { color: colors.text }]}>Add Workflow</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  workflowCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  workflowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  workflowInfo: {
    flex: 1,
    marginLeft: 8,
  },
  workflowName: {
    fontSize: 16,
    fontWeight: "600",
  },
  workflowDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  workflowActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default WorkflowList;

