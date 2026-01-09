/**
 * Community Marketplace Screen
 *
 * Browse, discover, and clone AI personas and custom slash commands
 * shared by other VibeChat users.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Globe,
  Search,
  Terminal,
  Trophy,
  Star,
  Download,
  User,
  Sparkles,
  Filter,
  TrendingUp,
  Clock,
  ChevronRight,
  ChevronDown,
  Zap,
  Wand2,
  Award,
  X,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import CloneModal from "@/components/Community/CloneModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Helper function to format creator name as "FirstName L."
const formatCreatorName = (fullName: string): string => {
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return parts[0]; // Just return the name if no last name
  }
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
};

// Types
interface CommunityPersona {
  id: string;
  name: string;
  personality: string;
  tone: string;
  description: string;
  category: string;
  tags: string[];
  cloneCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: string;
  creator?: {
    id: string;
    name: string;
    image: string;
  };
}

interface CommunityCommand {
  id: string;
  command: string;
  prompt: string;
  description: string;
  category: string;
  tags: string[];
  cloneCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: string;
  creator?: {
    id: string;
    name: string;
    image: string;
  };
}

interface CommunityWorkflow {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  actionType: string;
  category: string;
  tags: string[];
  cloneCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  createdAt: string;
  creator?: {
    id: string;
    name: string;
    image: string;
  };
}

type TabType = "personas" | "commands" | "workflows" | "rankings";
type SortType = "popular" | "recent";

const CATEGORIES = [
  { id: "all", label: "All", icon: Globe },
  { id: "productivity", label: "Productivity", icon: TrendingUp },
  { id: "entertainment", label: "Entertainment", icon: Sparkles },
  { id: "support", label: "Support", icon: User },
  { id: "creative", label: "Creative", icon: Star },
  { id: "utility", label: "Utility", icon: Terminal },
];

const CommunityScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useUser();

  // State
  const [activeTab, setActiveTab] = useState<TabType>("personas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortType>("popular");
  const [personas, setPersonas] = useState<CommunityPersona[]>([]);
  const [commands, setCommands] = useState<CommunityCommand[]>([]);
  const [workflows, setWorkflows] = useState<CommunityWorkflow[]>([]);
  const [featuredPersonas, setFeaturedPersonas] = useState<CommunityPersona[]>([]);
  const [featuredCommands, setFeaturedCommands] = useState<CommunityCommand[]>([]);
  const [featuredWorkflows, setFeaturedWorkflows] = useState<CommunityWorkflow[]>([]);
  const [topPersonas, setTopPersonas] = useState<CommunityPersona[]>([]);
  const [topCommands, setTopCommands] = useState<CommunityCommand[]>([]);
  const [topWorkflows, setTopWorkflows] = useState<CommunityWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Clone modal state
  const [cloneModalVisible, setCloneModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CommunityPersona | CommunityCommand | CommunityWorkflow | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"ai_friend" | "command" | "workflow">("ai_friend");

  // Rankings expanded state
  const [personasExpanded, setPersonasExpanded] = useState(false);
  const [commandsExpanded, setCommandsExpanded] = useState(false);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(false);

  // Filter modal state
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Expanded cards state - stores IDs of expanded cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Fetch data
  const fetchPersonas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      params.append("sortBy", sortBy === "popular" ? "cloneCount" : "createdAt");

      const response = await api.get<{ items: CommunityPersona[] }>(
        `/api/community/personas?${params.toString()}`
      );
      setPersonas(response.items || []);
    } catch (error) {
      console.error("[Community] Error fetching personas:", error);
    }
  }, [searchQuery, selectedCategory, sortBy]);

  const fetchCommands = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      params.append("sortBy", sortBy === "popular" ? "cloneCount" : "createdAt");

      const response = await api.get<{ items: CommunityCommand[] }>(
        `/api/community/commands?${params.toString()}`
      );
      setCommands(response.items || []);
    } catch (error) {
      console.error("[Community] Error fetching commands:", error);
    }
  }, [searchQuery, selectedCategory, sortBy]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      params.append("sortBy", sortBy === "popular" ? "cloneCount" : "createdAt");

      const response = await api.get<{ items: CommunityWorkflow[] }>(
        `/api/community/workflows?${params.toString()}`
      );
      setWorkflows(response.items || []);
    } catch (error) {
      console.error("[Community] Error fetching workflows:", error);
    }
  }, [searchQuery, selectedCategory, sortBy]);

  const fetchRankings = useCallback(async () => {
    try {
      const response = await api.get<{
        topPersonas: CommunityPersona[];
        topCommands: CommunityCommand[];
        topWorkflows: CommunityWorkflow[];
        featuredPersonas: CommunityPersona[];
        featuredCommands: CommunityCommand[];
        featuredWorkflows: CommunityWorkflow[];
      }>("/api/community/rankings?limit=10");

      setTopPersonas(response.topPersonas || []);
      setTopCommands(response.topCommands || []);
      setTopWorkflows(response.topWorkflows || []);
      setFeaturedPersonas(response.featuredPersonas || []);
      setFeaturedCommands(response.featuredCommands || []);
      setFeaturedWorkflows(response.featuredWorkflows || []);
    } catch (error) {
      console.error("[Community] Error fetching rankings:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "personas") {
        await fetchPersonas();
      } else if (activeTab === "commands") {
        await fetchCommands();
      } else if (activeTab === "workflows") {
        await fetchWorkflows();
      } else {
        await fetchRankings();
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchPersonas, fetchCommands, fetchWorkflows, fetchRankings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleClone = (item: CommunityPersona | CommunityCommand | CommunityWorkflow, type: "ai_friend" | "command" | "workflow") => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setCloneModalVisible(true);
  };

  const handleCloneSuccess = () => {
    // Refresh data to update clone counts
    loadData();
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Render helpers
  const renderTab = (tab: TabType, label: string, icon: React.ReactNode) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        key={tab}
        onPress={() => setActiveTab(tab)}
          style={[
            styles.tab,
            {
              backgroundColor: isActive
                ? `${colors.primary}33`
                : isDark 
                  ? "rgba(255,255,255,0.1)" 
                  : "rgba(0,0,0,0.05)",
              borderColor: isActive
                ? `${colors.primary}66`
                : "transparent",
            },
          ]}
      >
        {icon}
        <Text
          style={[
            styles.tabText,
            {
              color: isActive ? colors.primary : colors.textSecondary,
              fontWeight: isActive ? "600" : "400",
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPersonaCard = (persona: CommunityPersona, index?: number) => {
    const isExpanded = expandedCards.has(persona.id);
    
    return (
      <View
        key={persona.id}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.glassBackground : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        {index !== undefined && index < 3 && (
          <View style={[styles.rankBadge, { backgroundColor: getRankColor(index) }]}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}
        
        {/* Compact View */}
        <TouchableOpacity
          onPress={() => toggleCardExpansion(persona.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainerSmall,
                { backgroundColor: `${colors.primary}33` },
              ]}
            >
              <Sparkles size={20} color={colors.primary} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {persona.name}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 1}>
                {persona.description || persona.personality}
              </Text>
            </View>
            <ChevronDown
              size={20}
              color={colors.textSecondary}
              style={{
                transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded View */}
        {isExpanded && (
          <>
            {persona.personality && persona.description && (
              <View style={styles.promptSection}>
                <Text style={[styles.promptLabel, { color: colors.textTertiary }]}>PERSONALITY</Text>
                <Text style={[styles.promptText, { color: colors.textSecondary }]}>
                  {persona.personality}
                </Text>
              </View>
            )}
            {persona.tags && persona.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {persona.tags.slice(0, 5).map((tag, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tag,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.cardFooter}>
              {persona.creator && (
                <View style={styles.creatorRow}>
                  <User size={12} color={colors.textTertiary} />
                  <Text style={[styles.creatorName, { color: colors.textTertiary }]}>
                    {formatCreatorName(persona.creator.name)}
                  </Text>
                </View>
              )}
              <View style={styles.cloneStats}>
                <Download size={14} color={colors.textSecondary} />
                <Text style={[styles.cloneCount, { color: colors.textSecondary }]}>
                  {formatNumber(persona.cloneCount)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleClone(persona, "ai_friend")}
              style={[
                styles.cloneButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Download size={16} color="#fff" />
              <Text style={styles.cloneButtonText}>Clone This Persona</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderCommandCard = (command: CommunityCommand, index?: number) => {
    const isExpanded = expandedCards.has(command.id);
    
    return (
      <View
        key={command.id}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.glassBackground : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        {index !== undefined && index < 3 && (
          <View style={[styles.rankBadge, { backgroundColor: getRankColor(index) }]}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}
        
        {/* Compact View */}
        <TouchableOpacity
          onPress={() => toggleCardExpansion(command.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainerSmall,
                { backgroundColor: isDark ? "rgba(175, 82, 222, 0.2)" : "rgba(175, 82, 222, 0.1)" },
              ]}
            >
              <Zap size={20} color="#AF52DE" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {command.command.startsWith('/') ? command.command : `/${command.command}`}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 1}>
                {command.description}
              </Text>
            </View>
            <ChevronDown
              size={20}
              color={colors.textSecondary}
              style={{
                transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded View */}
        {isExpanded && (
          <>
            {command.prompt && (
              <View style={styles.promptSection}>
                <Text style={[styles.promptLabel, { color: colors.textTertiary }]}>PROMPT</Text>
                <Text style={[styles.promptText, { color: colors.textSecondary }]}>
                  {command.prompt}
                </Text>
              </View>
            )}
            {command.tags && command.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {command.tags.slice(0, 5).map((tag, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tag,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.cardFooter}>
              {command.creator && (
                <View style={styles.creatorRow}>
                  <User size={12} color={colors.textTertiary} />
                  <Text style={[styles.creatorName, { color: colors.textTertiary }]}>
                    {formatCreatorName(command.creator.name)}
                  </Text>
                </View>
              )}
              <View style={styles.cloneStats}>
                <Download size={14} color={colors.textSecondary} />
                <Text style={[styles.cloneCount, { color: colors.textSecondary }]}>
                  {formatNumber(command.cloneCount)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleClone(command, "command")}
              style={[
                styles.cloneButton,
                { backgroundColor: "#AF52DE" },
              ]}
            >
              <Download size={16} color="#fff" />
              <Text style={styles.cloneButtonText}>Clone This Command</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderWorkflowCard = (workflow: CommunityWorkflow, index?: number) => {
    const isExpanded = expandedCards.has(workflow.id);
    
    return (
      <View
        key={workflow.id}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.glassBackground : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        {index !== undefined && index < 3 && (
          <View style={[styles.rankBadge, { backgroundColor: getRankColor(index) }]}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}
        
        {/* Compact View */}
        <TouchableOpacity
          onPress={() => toggleCardExpansion(workflow.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainerSmall,
                { backgroundColor: isDark ? "rgba(0, 122, 255, 0.2)" : "rgba(0, 122, 255, 0.1)" },
              ]}
            >
              <Wand2 size={20} color="#007AFF" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {workflow.name}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 1}>
                {workflow.description}
              </Text>
            </View>
            <ChevronDown
              size={20}
              color={colors.textSecondary}
              style={{
                transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded View */}
        {isExpanded && (
          <>
            <View style={styles.promptSection}>
              <Text style={[styles.promptLabel, { color: colors.textTertiary }]}>AUTOMATION</Text>
              <Text style={[styles.promptText, { color: colors.textSecondary }]}>
                {workflow.triggerType} → {workflow.actionType}
              </Text>
            </View>
            {workflow.tags && workflow.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {workflow.tags.slice(0, 5).map((tag, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tag,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.cardFooter}>
              {workflow.creator && (
                <View style={styles.creatorRow}>
                  <User size={12} color={colors.textTertiary} />
                  <Text style={[styles.creatorName, { color: colors.textTertiary }]}>
                    {formatCreatorName(workflow.creator.name)}
                  </Text>
                </View>
              )}
              <View style={styles.cloneStats}>
                <Download size={14} color={colors.textSecondary} />
                <Text style={[styles.cloneCount, { color: colors.textSecondary }]}>
                  {formatNumber(workflow.cloneCount)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleClone(workflow, "workflow")}
              style={[
                styles.cloneButton,
                { backgroundColor: "#007AFF" },
              ]}
            >
              <Download size={16} color="#fff" />
              <Text style={styles.cloneButtonText}>Clone This Workflow</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderFeaturedSection = () => {
    if (featuredPersonas.length === 0 && featuredCommands.length === 0 && featuredWorkflows.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Star size={20} color="#FFD60A" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
          {featuredPersonas.map((persona) => (
            <View key={persona.id} style={styles.horizontalCard}>
              {renderPersonaCard(persona)}
            </View>
          ))}
          {featuredCommands.map((command) => (
            <View key={command.id} style={styles.horizontalCard}>
              {renderCommandCard(command)}
            </View>
          ))}
          {featuredWorkflows.map((workflow) => (
            <View key={workflow.id} style={styles.horizontalCard}>
              {renderWorkflowCard(workflow)}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderRankingsTab = () => {
    const INITIAL_LIMIT = 5;

    return (
      <View>
        {renderFeaturedSection()}

        {/* Top Personas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={20} color="#FFD60A" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top AI Personas</Text>
          </View>
          {topPersonas.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No personas shared yet. Be the first!
            </Text>
          ) : (
            <>
              {topPersonas
                .slice(0, personasExpanded ? topPersonas.length : INITIAL_LIMIT)
                .map((persona, index) => renderPersonaCard(persona, index))}
              {topPersonas.length > INITIAL_LIMIT && (
                <TouchableOpacity
                  onPress={() => setPersonasExpanded(!personasExpanded)}
                  style={[
                    styles.seeMoreButton,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Text style={[styles.seeMoreText, { color: colors.primary }]}>
                    {personasExpanded ? "See Less" : `See More (${topPersonas.length - INITIAL_LIMIT})`}
                  </Text>
                  <ChevronRight
                    size={16}
                    color={colors.primary}
                    style={{
                      transform: [{ rotate: personasExpanded ? "270deg" : "90deg" }],
                    }}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Top Commands */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={20} color="#AF52DE" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Slash Commands</Text>
          </View>
          {topCommands.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No commands shared yet. Be the first!
            </Text>
          ) : (
            <>
              {topCommands
                .slice(0, commandsExpanded ? topCommands.length : INITIAL_LIMIT)
                .map((command, index) => renderCommandCard(command, index))}
              {topCommands.length > INITIAL_LIMIT && (
                <TouchableOpacity
                  onPress={() => setCommandsExpanded(!commandsExpanded)}
                  style={[
                    styles.seeMoreButton,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Text style={[styles.seeMoreText, { color: colors.primary }]}>
                    {commandsExpanded ? "See Less" : `See More (${topCommands.length - INITIAL_LIMIT})`}
                  </Text>
                  <ChevronRight
                    size={16}
                    color={colors.primary}
                    style={{
                      transform: [{ rotate: commandsExpanded ? "270deg" : "90deg" }],
                    }}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Top Workflows */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={20} color="#007AFF" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top AI Workflows</Text>
          </View>
          {topWorkflows.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No workflows shared yet. Be the first!
            </Text>
          ) : (
            <>
              {topWorkflows
                .slice(0, workflowsExpanded ? topWorkflows.length : INITIAL_LIMIT)
                .map((workflow, index) => renderWorkflowCard(workflow, index))}
              {topWorkflows.length > INITIAL_LIMIT && (
                <TouchableOpacity
                  onPress={() => setWorkflowsExpanded(!workflowsExpanded)}
                  style={[
                    styles.seeMoreButton,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Text style={[styles.seeMoreText, { color: colors.primary }]}>
                    {workflowsExpanded ? "See Less" : `See More (${topWorkflows.length - INITIAL_LIMIT})`}
                  </Text>
                  <ChevronRight
                    size={16}
                    color={colors.primary}
                    style={{
                      transform: [{ rotate: workflowsExpanded ? "270deg" : "90deg" }],
                    }}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  // Filter Modal Component
  const renderFilterModal = () => (
    <Modal
      visible={filterModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.background,
              borderTopColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.1)",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>
                SORT BY
              </Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  onPress={() => setSortBy("popular")}
                  style={[
                    styles.filterOption,
                    {
                      backgroundColor: sortBy === "popular"
                        ? `${colors.primary}26`
                        : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: sortBy === "popular"
                        ? colors.primary
                        : "transparent",
                    },
                  ]}
                >
                  <TrendingUp
                    size={20}
                    color={sortBy === "popular" ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      { color: sortBy === "popular" ? colors.primary : colors.text },
                    ]}
                  >
                    Popular
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSortBy("recent")}
                  style={[
                    styles.filterOption,
                    {
                      backgroundColor: sortBy === "recent"
                        ? `${colors.primary}26`
                        : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: sortBy === "recent"
                        ? colors.primary
                        : "transparent",
                    },
                  ]}
                >
                  <Clock
                    size={20}
                    color={sortBy === "recent" ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      { color: sortBy === "recent" ? colors.primary : colors.text },
                    ]}
                  >
                    Recent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Options */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>
                CATEGORY
              </Text>
              <View style={styles.filterGrid}>
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[
                        styles.filterGridItem,
                        {
                          backgroundColor: isActive
                            ? `${colors.primary}26`
                            : isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                          borderColor: isActive
                            ? colors.primary
                            : "transparent",
                        },
                      ]}
                    >
                      <Icon
                        size={20}
                        color={isActive ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.filterGridText,
                          { color: isActive ? colors.primary : colors.text },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Apply Button */}
          <TouchableOpacity
            onPress={() => setFilterModalVisible(false)}
            style={[styles.applyButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.titleIcon,
                { backgroundColor: `${colors.primary}26` },
              ]}
            >
              <Globe size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Community</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Discover & clone AI creations
              </Text>
            </View>
          </View>
        </View>

        {/* Search and Filter Row */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark ? colors.glassBackground : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
              },
            ]}
          >
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              placeholder="Search personas & commands..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          
          {/* Filter Button (only for personas/commands/workflows tabs) */}
          {activeTab !== "rankings" && (
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isDark ? colors.glassBackground : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
                },
              ]}
            >
              <Filter size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {renderTab("personas", "AI Personas", <Sparkles size={18} color={activeTab === "personas" ? colors.primary : colors.textSecondary} />)}
          {renderTab("commands", "Commands", <Zap size={18} color={activeTab === "commands" ? colors.primary : colors.textSecondary} />)}
          {renderTab("workflows", "Workflows", <Wand2 size={18} color={activeTab === "workflows" ? colors.primary : colors.textSecondary} />)}
          {renderTab("rankings", "Rankings", <Award size={18} color={activeTab === "rankings" ? colors.primary : colors.textSecondary} />)}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
          </View>
        ) : activeTab === "rankings" ? (
          renderRankingsTab()
        ) : activeTab === "personas" ? (
          <View style={styles.listContainer}>
            {personas.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Sparkles size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No personas found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Be the first to share an AI persona!
                </Text>
              </View>
            ) : (
              personas.map((persona) => renderPersonaCard(persona))
            )}
          </View>
        ) : activeTab === "commands" ? (
          <View style={styles.listContainer}>
            {commands.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Zap size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No commands found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Be the first to share a slash command!
                </Text>
              </View>
            ) : (
              commands.map((command) => renderCommandCard(command))
            )}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {workflows.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Wand2 size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No workflows found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Be the first to share a workflow!
                </Text>
              </View>
            ) : (
              workflows.map((workflow) => renderWorkflowCard(workflow))
            )}
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Filter Modal */}
      {renderFilterModal()}

      {/* Clone Modal */}
      <CloneModal
        visible={cloneModalVisible}
        onClose={() => setCloneModalVisible(false)}
        item={selectedItem}
        itemType={selectedItemType}
        onSuccess={handleCloneSuccess}
      />
    </View>
  );
};

// Helper functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const getRankColor = (index: number): string => {
  switch (index) {
    case 0:
      return "#FFD700"; // Gold
    case 1:
      return "#C0C0C0"; // Silver
    case 2:
      return "#CD7F32"; // Bronze
    default:
      return "#888";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  tabs: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  tabsContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingRight: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  filterSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: "row",
    gap: 12,
  },
  filterOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  filterOptionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  filterGridItem: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  filterGridText: {
    fontSize: 14,
    fontWeight: "500",
  },
  applyButton: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContainer: {
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    position: "relative",
  },
  rankBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
  },
  rankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  cardCategory: {
    fontSize: 13,
    marginTop: 2,
    textTransform: "capitalize",
  },
  cloneStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cloneCount: {
    fontSize: 14,
    fontWeight: "500",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  promptSection: {
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.15)",
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 19,
  },
  cloneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  cloneButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.15)",
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  creatorName: {
    fontSize: 11,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  horizontalList: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  horizontalCard: {
    width: SCREEN_WIDTH * 0.75,
    marginRight: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  seeMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 6,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default CommunityScreen;
