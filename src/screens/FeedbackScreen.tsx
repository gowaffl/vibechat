import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Plus, Map, List, History } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

import { useFeatureRequests, useChangelog, FeatureRequest } from "@/hooks/useFeedback";
import FeatureRequestCard from "@/components/Feedback/FeatureRequestCard";
import ChangelogCard from "@/components/Feedback/ChangelogCard";
import CreateRequestModal from "@/components/Feedback/CreateRequestModal";
import { useTheme } from "@/contexts/ThemeContext";

type Tab = 'requests' | 'roadmap' | 'changelog';

const FeedbackScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { colors, isDark } = useTheme();

  // Data Fetching
  const { data: requests, isLoading: isLoadingRequests } = useFeatureRequests(
    'score', 
    activeTab === 'roadmap' ? 'roadmap' : 'requests'
  );
  
  const { data: changelog, isLoading: isLoadingChangelog } = useChangelog();

  const renderContent = () => {
    if (activeTab === 'changelog') {
      if (isLoadingChangelog) {
        return <ActivityIndicator color={colors.primary} style={styles.loader} />;
      }
      
      return (
        <Animated.FlatList
          data={changelog}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChangelogCard entry={item} />}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={Layout.springify()}
          entering={FadeIn}
          exiting={FadeOut}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No changelog entries yet.</Text>
            </View>
          }
        />
      );
    }

    // Requests & Roadmap share similar structure (list of requests)
    if (isLoadingRequests) {
      return <ActivityIndicator color={colors.primary} style={styles.loader} />;
    }

    return (
      <Animated.FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeatureRequestCard 
            request={item} 
            isRoadmap={activeTab === 'roadmap'} 
          />
        )}
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={Layout.springify()}
        entering={FadeIn}
        exiting={FadeOut}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeTab === 'roadmap' 
                ? "Nothing on the roadmap yet." 
                : "No requests yet. Be the first!"}
            </Text>
          </View>
        }
      />
    );
  };

  const TabButton = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
    <TouchableOpacity 
      onPress={() => setActiveTab(id)}
      style={styles.tabWrapper}
    >
      {activeTab === id && (
        <LinearGradient
          colors={isDark ? ["rgba(79, 195, 247, 0.15)", "rgba(0, 168, 232, 0.05)"] : ["rgba(0, 122, 255, 0.15)", "rgba(0, 122, 255, 0.05)"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={styles.tabContent}>
        <Icon 
          size={16} 
          color={activeTab === id ? colors.primary : colors.textSecondary} 
          style={styles.tabIcon}
        />
        <Text style={[
          styles.tabLabel, 
          { color: activeTab === id ? colors.primary : colors.textSecondary },
          activeTab === id && styles.activeTabLabel
        ]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const backgroundGradientColors = isDark 
    ? ["#000000", "#0A0A0F", "#050508", "#000000"]
    : [colors.background, colors.backgroundSecondary, colors.surfaceSecondary, colors.background];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={backgroundGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </View>

      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Pressable 
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Feedback & Roadmap</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.tabsContainer}>
          <View style={[styles.tabsBackground, { backgroundColor: isDark ? 'rgba(20, 20, 25, 0.6)' : 'rgba(255, 255, 255, 0.6)', borderColor: colors.border }]}>
            <TabButton id="requests" label="Requests" icon={List} />
            <TabButton id="roadmap" label="Roadmap" icon={Map} />
            <TabButton id="changelog" label="Changelog" icon={History} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>

      {activeTab === 'requests' && (
        <Pressable 
          style={[styles.fab, { bottom: insets.bottom + 20, shadowColor: colors.glassShadow }]}
          onPress={() => setIsModalOpen(true)}
        >
          <LinearGradient
            colors={isDark ? ["#007AFF", "#00C6FF"] : [colors.primary, colors.secondary || colors.primary]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Plus size={24} color="#FFF" />
            <Text style={styles.fabText}>New Request</Text>
          </LinearGradient>
        </Pressable>
      )}

      <CreateRequestModal 
        visible={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  tabsBackground: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  tabWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  activeTabButton: {
    // Removed
  },
  tabIcon: {
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabLabel: {
    textShadowColor: 'rgba(79, 195, 247, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  fabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default FeedbackScreen;
