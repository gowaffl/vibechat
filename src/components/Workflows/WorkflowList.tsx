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
  keyword: { icon: Hash },
  ai_mention: { icon: AtSign },
  scheduled: { icon: Clock },
  message_pattern: { icon: MessageSquare },
  time_based: { icon: Clock },
};

const ACTION_ICONS: Record<string, any> = {
  create_event: { icon: Calendar },
  create_poll: { icon: ListTodo },
  send_message: { icon: Send },
  ai_response: { icon: Zap },
  summarize: { icon: MessageSquare },
  remind: { icon: Clock },
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
    return TRIGGER_ICONS[type] || { icon: Zap };
  };

  const getActionInfo = (type: string) => {
    return ACTION_ICONS[type] || { icon: Zap };
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
            { backgroundColor: `${colors.primary}${isDark ? '26' : '1A'}` },
          ]}
        >
          <Zap size={32} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workflows Yet</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Create your first AI workflow to automate actions in this chat
        </Text>
        <TouchableOpacity
          onPress={onCreateNew}
          style={[styles.createButton, { backgroundColor: colors.primary }]}
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
                backgroundColor: colors.glassBackground,
                borderColor: workflow.isEnabled
                  ? `${colors.primary}${isDark ? '4D' : '33'}`
                  : colors.glassBorder,
                opacity: workflow.isEnabled ? 1 : 0.7,
              },
            ]}
          >
            <View style={styles.workflowHeader}>
              {/* Trigger Icon */}
              <View style={[styles.iconBadge, { backgroundColor: `${colors.primary}${isDark ? '26' : '1A'}` }]}>
                <TriggerIcon size={18} color={colors.primary} />
              </View>

              {/* Arrow */}
              <ChevronRight size={16} color={colors.textTertiary} />

              {/* Action Icon */}
              <View style={[styles.iconBadge, { backgroundColor: `${colors.primary}${isDark ? '33' : '26'}` }]}>
                <ActionIcon size={18} color={colors.primary} />
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
                  true: `${colors.primary}80`,
                }}
                thumbColor={workflow.isEnabled ? colors.primary : isDark ? "#888" : "#ccc"}
                ios_backgroundColor={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
              />
            </View>

            {/* Actions */}
            <View style={[styles.workflowActions, { borderTopColor: colors.glassBorder }]}>
              <TouchableOpacity
                onPress={() => onEdit(workflow)}
                style={[
                  styles.actionButton,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
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
                  { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" },
                ]}
              >
                <Trash2 size={14} color={colors.textSecondary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Delete</Text>
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
            backgroundColor: colors.glassBackground,
            borderColor: `${colors.primary}${isDark ? '4D' : '33'}`,
          },
        ]}
      >
        <Zap size={18} color={colors.primary} />
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

