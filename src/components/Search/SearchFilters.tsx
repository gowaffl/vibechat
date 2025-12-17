import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearchStore, SearchMode } from '@/stores/searchStore';
import { Calendar, User, FileText, X, Check, Brain, Search as SearchIcon } from 'lucide-react-native';
import clsx from 'clsx';
import * as Haptics from 'expo-haptics';

export const SearchFilters = () => {
  const { colors, isDark } = useTheme();
  const { 
    filters, 
    setFilters, 
    searchMode, 
    setSearchMode, 
    clearFilters 
  } = useSearchStore();

  const activeFiltersCount = Object.keys(filters).length;

  const toggleMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (searchMode === 'hybrid') setSearchMode('text');
    else if (searchMode === 'text') setSearchMode('semantic');
    else setSearchMode('hybrid');
  };

  const ModeIcon = useMemo(() => {
    switch (searchMode) {
      case 'hybrid': return Brain;
      case 'semantic': return Brain; // Maybe a different icon?
      case 'text': return SearchIcon;
    }
  }, [searchMode]);

  const modeLabel = useMemo(() => {
    switch (searchMode) {
      case 'hybrid': return 'Hybrid';
      case 'semantic': return 'AI Only';
      case 'text': return 'Text Only';
    }
  }, [searchMode]);

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Search Mode Toggle */}
        <Pressable 
          onPress={toggleMode}
          style={[
            styles.chip, 
            { 
              backgroundColor: searchMode === 'text' ? colors.card : colors.primary + '20',
              borderColor: searchMode === 'text' ? colors.border : colors.primary
            }
          ]}
        >
          <ModeIcon size={14} color={searchMode === 'text' ? colors.text : colors.primary} />
          <Text style={[
            styles.chipText, 
            { color: searchMode === 'text' ? colors.text : colors.primary, fontWeight: '600' }
          ]}>
            {modeLabel}
          </Text>
        </Pressable>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Date Filter */}
        <Pressable 
          style={[
            styles.chip, 
            { 
              backgroundColor: (filters.dateFrom || filters.dateTo) ? colors.primary : colors.card,
              borderColor: (filters.dateFrom || filters.dateTo) ? colors.primary : colors.border
            }
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // TODO: Open Date Picker Sheet
          }}
        >
          <Calendar size={14} color={(filters.dateFrom || filters.dateTo) ? '#FFF' : colors.text} />
          <Text style={[
            styles.chipText, 
            { color: (filters.dateFrom || filters.dateTo) ? '#FFF' : colors.text }
          ]}>
            Date
          </Text>
          {(filters.dateFrom || filters.dateTo) && (
            <Pressable 
              onPress={() => setFilters({ dateFrom: undefined, dateTo: undefined })}
              hitSlop={8}
            >
              <X size={12} color="#FFF" style={{ marginLeft: 4 }} />
            </Pressable>
          )}
        </Pressable>

        {/* Type Filter */}
        <Pressable 
          style={[
            styles.chip, 
            { 
              backgroundColor: filters.messageTypes?.length ? colors.primary : colors.card,
              borderColor: filters.messageTypes?.length ? colors.primary : colors.border
            }
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // TODO: Open Type Picker Sheet
          }}
        >
          <FileText size={14} color={filters.messageTypes?.length ? '#FFF' : colors.text} />
          <Text style={[
            styles.chipText, 
            { color: filters.messageTypes?.length ? '#FFF' : colors.text }
          ]}>
            Type
          </Text>
           {filters.messageTypes && filters.messageTypes.length > 0 && (
            <Pressable 
              onPress={() => setFilters({ messageTypes: undefined })}
              hitSlop={8}
            >
              <X size={12} color="#FFF" style={{ marginLeft: 4 }} />
            </Pressable>
          )}
        </Pressable>

        {/* Sender Filter */}
        <Pressable 
          style={[
            styles.chip, 
            { 
              backgroundColor: filters.fromUserId ? colors.primary : colors.card,
              borderColor: filters.fromUserId ? colors.primary : colors.border
            }
          ]}
           onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // TODO: Open User Picker Sheet
          }}
        >
          <User size={14} color={filters.fromUserId ? '#FFF' : colors.text} />
          <Text style={[
            styles.chipText, 
            { color: filters.fromUserId ? '#FFF' : colors.text }
          ]}>
            Sender
          </Text>
           {filters.fromUserId && (
            <Pressable 
              onPress={() => setFilters({ fromUserId: undefined })}
              hitSlop={8}
            >
              <X size={12} color="#FFF" style={{ marginLeft: 4 }} />
            </Pressable>
          )}
        </Pressable>

        {/* Clear All */}
        {activeFiltersCount > 0 && (
          <Pressable 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              clearFilters();
            }}
            style={[styles.chip, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive }]}
          >
            <Text style={[styles.chipText, { color: colors.destructive }]}>Reset</Text>
          </Pressable>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  }
});

