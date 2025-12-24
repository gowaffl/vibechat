import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearchStore } from '@/stores/searchStore';
import { Calendar, User, FileText, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SearchFilterSheet } from './SearchFilterSheet';

export const SearchFilters = () => {
  const { colors } = useTheme();
  const { 
    filters, 
    setFilters, 
    clearFilters 
  } = useSearchStore();

  const [activeSheet, setActiveSheet] = useState<'date' | 'type' | 'user' | null>(null);

  const activeFiltersCount = Object.keys(filters).length;

  const handleApplyFilter = (data: any) => {
    setFilters(data);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
            setActiveSheet('date');
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
            setActiveSheet('type');
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
            setActiveSheet('user');
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

      {/* Filter Sheet */}
      <SearchFilterSheet
        visible={!!activeSheet}
        type={activeSheet}
        onClose={() => setActiveSheet(null)}
        onApply={handleApplyFilter}
        initialValue={filters}
      />
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
});

