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
  Zap,
  Award,
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

type TabType = "personas" | "commands" | "rankings";
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
  const [featuredPersonas, setFeaturedPersonas] = useState<CommunityPersona[]>([]);
  const [featuredCommands, setFeaturedCommands] = useState<CommunityCommand[]>([]);
  const [topPersonas, setTopPersonas] = useState<CommunityPersona[]>([]);
  const [topCommands, setTopCommands] = useState<CommunityCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Clone modal state
  const [cloneModalVisible, setCloneModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CommunityPersona | CommunityCommand | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"ai_friend" | "command">("ai_friend");

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

  const fetchRankings = useCallback(async () => {
    try {
      const response = await api.get<{
        topPersonas: CommunityPersona[];
        topCommands: CommunityCommand[];
        featuredPersonas: CommunityPersona[];
        featuredCommands: CommunityCommand[];
      }>("/api/community/rankings?limit=10");

      setTopPersonas(response.topPersonas || []);
      setTopCommands(response.topCommands || []);
      setFeaturedPersonas(response.featuredPersonas || []);
      setFeaturedCommands(response.featuredCommands || []);
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
      } else {
        await fetchRankings();
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchPersonas, fetchCommands, fetchRankings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleClone = (item: CommunityPersona | CommunityCommand, type: "ai_friend" | "command") => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setCloneModalVisible(true);
  };

  const handleCloneSuccess = () => {
    // Refresh data to update clone counts
    loadData();
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
                : "transparent",
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

  const renderPersonaCard = (persona: CommunityPersona, index?: number) => (
    <TouchableOpacity
      key={persona.id}
      onPress={() => handleClone(persona, "ai_friend")}
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
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${colors.primary}33` },
          ]}
        >
          <Sparkles size={24} color={colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {persona.name}
          </Text>
          <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>
            {persona.category || "General"}
          </Text>
        </View>
      </View>
      {persona.description && (
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {persona.description}
        </Text>
      )}
      {persona.personality && (
        <View style={styles.promptSection}>
          <Text style={[styles.promptLabel, { color: colors.textTertiary }]}>Personality:</Text>
          <Text style={[styles.promptText, { color: colors.textSecondary }]} numberOfLines={3}>
            {persona.personality}
          </Text>
        </View>
      )}
      {persona.tags && persona.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {persona.tags.slice(0, 3).map((tag, i) => (
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
    </TouchableOpacity>
  );

  const renderCommandCard = (command: CommunityCommand, index?: number) => (
    <TouchableOpacity
      key={command.id}
      onPress={() => handleClone(command, "command")}
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
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isDark ? "rgba(175, 82, 222, 0.2)" : "rgba(175, 82, 222, 0.1)" },
          ]}
        >
          <Zap size={24} color="#AF52DE" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {command.command.startsWith('/') ? command.command : `/${command.command}`}
          </Text>
          <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>
            {command.category || "General"}
          </Text>
        </View>
      </View>
      {command.description && (
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {command.description}
        </Text>
      )}
      {command.prompt && (
        <View style={styles.promptSection}>
          <Text style={[styles.promptLabel, { color: colors.textTertiary }]}>Prompt:</Text>
          <Text style={[styles.promptText, { color: colors.textSecondary }]} numberOfLines={3}>
            {command.prompt}
          </Text>
        </View>
      )}
      {command.tags && command.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {command.tags.slice(0, 3).map((tag, i) => (
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
    </TouchableOpacity>
  );

  const renderFeaturedSection = () => {
    if (featuredPersonas.length === 0 && featuredCommands.length === 0) return null;

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
        </ScrollView>
      </View>
    );
  };

  const renderRankingsTab = () => (
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
          topPersonas.map((persona, index) => renderPersonaCard(persona, index))
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
          topCommands.map((command, index) => renderCommandCard(command, index))
        )}
      </View>
    </View>
  );

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryScroll}
      contentContainerStyle={styles.categoryContent}
    >
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = selectedCategory === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedCategory(cat.id)}
            style={[
              styles.categoryChip,
              {
              backgroundColor: isActive
                ? `${colors.primary}33`
                : isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.05)",
              borderColor: isActive
                ? `${colors.primary}66`
                : "transparent",
              },
            ]}
          >
            <Icon size={14} color={isActive ? (isDark ? colors.primary : "#fff") : colors.textSecondary} />
            <Text
              style={[
                styles.categoryText,
                { color: isActive ? (isDark ? colors.primary : "#fff") : colors.textSecondary },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderSortToggle = () => (
    <View style={styles.sortContainer}>
      <TouchableOpacity
        onPress={() => setSortBy("popular")}
        style={[
          styles.sortButton,
          sortBy === "popular" && {
            backgroundColor: `${colors.primary}26`,
          },
        ]}
      >
        <TrendingUp
          size={16}
          color={sortBy === "popular" ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.sortText,
            { color: sortBy === "popular" ? colors.primary : colors.textSecondary },
          ]}
        >
          Popular
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setSortBy("recent")}
        style={[
          styles.sortButton,
          sortBy === "recent" && {
            backgroundColor: `${colors.primary}26`,
          },
        ]}
      >
        <Clock size={16} color={sortBy === "recent" ? colors.primary : colors.textSecondary} />
        <Text
          style={[
            styles.sortText,
            { color: sortBy === "recent" ? colors.primary : colors.textSecondary },
          ]}
        >
          Recent
        </Text>
      </TouchableOpacity>
    </View>
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

        {/* Search */}
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

        {/* Tabs */}
        <View style={styles.tabs}>
          {renderTab("personas", "AI Personas", <Sparkles size={18} color={activeTab === "personas" ? colors.primary : colors.textSecondary} />)}
          {renderTab("commands", "Commands", <Zap size={18} color={activeTab === "commands" ? colors.primary : colors.textSecondary} />)}
          {renderTab("rankings", "Rankings", <Award size={18} color={activeTab === "rankings" ? colors.primary : colors.textSecondary} />)}
        </View>

        {/* Category Filter & Sort (only for personas/commands tabs) */}
        {activeTab !== "rankings" && (
          <>
            {renderCategoryFilter()}
            {renderSortToggle()}
          </>
        )}

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
        ) : (
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
        )}

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryContent: {
    gap: 8,
    paddingRight: 16,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sortContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  sortText: {
    fontSize: 13,
    fontWeight: "500",
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
    padding: 16,
    borderRadius: 16,
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
  },
  rankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
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
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  promptSection: {
    marginBottom: 10,
    paddingTop: 8,
  },
  promptLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  creatorName: {
    fontSize: 12,
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
});

export default CommunityScreen;
