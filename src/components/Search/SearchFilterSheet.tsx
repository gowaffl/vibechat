import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  Pressable, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  Platform,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { X, Check, Search, Calendar, User, FileText, Image as ImageIcon, Mic, Video, Link } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Image } from 'expo-image';
import { getFullImageUrl } from '@/utils/imageHelpers';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type FilterType = 'date' | 'type' | 'user' | null;

interface SearchFilterSheetProps {
  visible: boolean;
  type: FilterType;
  onClose: () => void;
  onApply: (data: any) => void;
  initialValue?: any;
}

export const SearchFilterSheet: React.FC<SearchFilterSheetProps> = ({
  visible,
  type,
  onClose,
  onApply,
  initialValue
}) => {
  const { colors, isDark } = useTheme();
  
  // Date State
  const [fromDate, setFromDate] = useState<Date | undefined>(initialValue?.dateFrom ? new Date(initialValue.dateFrom) : undefined);
  const [toDate, setToDate] = useState<Date | undefined>(initialValue?.dateTo ? new Date(initialValue.dateTo) : undefined);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Type State
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialValue?.messageTypes || []);

  // User State
  const [selectedUser, setSelectedUser] = useState<string | undefined>(initialValue?.fromUserId);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Reset state when opening
  useEffect(() => {
    if (visible) {
      if (type === 'date') {
        setFromDate(initialValue?.dateFrom ? new Date(initialValue.dateFrom) : undefined);
        setToDate(initialValue?.dateTo ? new Date(initialValue.dateTo) : undefined);
      } else if (type === 'type') {
        setSelectedTypes(initialValue?.messageTypes || []);
      } else if (type === 'user') {
        setSelectedUser(initialValue?.fromUserId);
        setUserSearchQuery('');
      }
    }
  }, [visible, type, initialValue]);

  // Fetch users for picker
  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get<any[]>('/api/users'),
    enabled: visible && type === 'user',
  });

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users;
    return users.filter(u => 
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  }, [users, userSearchQuery]);

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (type === 'date') {
      onApply({ 
        dateFrom: fromDate?.toISOString(), 
        dateTo: toDate?.toISOString() 
      });
    } else if (type === 'type') {
      onApply({ messageTypes: selectedTypes.length > 0 ? selectedTypes : undefined });
    } else if (type === 'user') {
      onApply({ fromUserId: selectedUser });
    }
    onClose();
  };

  const renderDateContent = () => (
    <View style={styles.contentSection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Date Range</Text>
      
      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>From</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={fromDate || new Date()}
              mode="date"
              display="compact"
              onChange={(e, date) => {
                if (date) setFromDate(date);
              }}
              style={{ alignSelf: 'flex-start' }}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          ) : (
            <>
              <Pressable 
                style={[styles.androidDateBtn, { borderColor: colors.border }]}
                onPress={() => setShowFromPicker(true)}
              >
                <Text style={{ color: colors.text }}>{fromDate ? fromDate.toLocaleDateString() : 'Select Date'}</Text>
              </Pressable>
              {showFromPicker && (
                <DateTimePicker
                  value={fromDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(e, date) => {
                    setShowFromPicker(false);
                    if (date) setFromDate(date);
                  }}
                />
              )}
            </>
          )}
        </View>
        
        <View style={styles.dateCol}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>To</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={toDate || new Date()}
              mode="date"
              display="compact"
              onChange={(e, date) => {
                if (date) setToDate(date);
              }}
              style={{ alignSelf: 'flex-start' }}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          ) : (
            <>
               <Pressable 
                style={[styles.androidDateBtn, { borderColor: colors.border }]}
                onPress={() => setShowToPicker(true)}
              >
                <Text style={{ color: colors.text }}>{toDate ? toDate.toLocaleDateString() : 'Select Date'}</Text>
              </Pressable>
              {showToPicker && (
                <DateTimePicker
                  value={toDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(e, date) => {
                    setShowToPicker(false);
                    if (date) setToDate(date);
                  }}
                />
              )}
            </>
          )}
        </View>
      </View>
      
      <Pressable 
        onPress={() => {
          setFromDate(undefined);
          setToDate(undefined);
        }}
        style={{ marginTop: 16, alignSelf: 'center' }}
      >
        <Text style={{ color: colors.destructive, fontSize: 15 }}>Clear Dates</Text>
      </Pressable>
    </View>
  );

  const messageTypes = [
    { id: 'text', label: 'Text', icon: FileText },
    { id: 'image', label: 'Image', icon: ImageIcon },
    { id: 'voice', label: 'Voice', icon: Mic },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'link', label: 'Link', icon: Link },
  ];

  const renderTypeContent = () => (
    <View style={styles.contentSection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Message Types</Text>
      <View style={styles.grid}>
        {messageTypes.map((t) => {
          const isSelected = selectedTypes.includes(t.id);
          const Icon = t.icon;
          return (
            <Pressable
              key={t.id}
              style={[
                styles.typeCard,
                { 
                  backgroundColor: isSelected ? colors.primary + '20' : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border
                }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isSelected) {
                  setSelectedTypes(prev => prev.filter(id => id !== t.id));
                } else {
                  setSelectedTypes(prev => [...prev, t.id]);
                }
              }}
            >
              <Icon size={24} color={isSelected ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.typeLabel, 
                { color: isSelected ? colors.primary : colors.text }
              ]}>{t.label}</Text>
              {isSelected && (
                <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFF" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderUserContent = () => (
    <View style={[styles.contentSection, { flex: 1 }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Sender</Text>
      
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          value={userSearchQuery}
          onChangeText={setUserSearchQuery}
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
        />
        {userSearchQuery.length > 0 && (
          <Pressable onPress={() => setUserSearchQuery('')}>
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedUser === item.id;
          return (
            <Pressable
              style={[
                styles.userItem,
                { borderBottomColor: colors.border }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedUser(isSelected ? undefined : item.id);
              }}
            >
              {item.image ? (
                <Image
                  source={{ uri: getFullImageUrl(item.image) }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>
                    {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
              {isSelected && (
                <Check size={20} color={colors.primary} />
              )}
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );

  if (!visible || !type) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[
          styles.sheetContainer,
          { 
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            maxHeight: type === 'user' ? SCREEN_HEIGHT * 0.7 : 'auto'
          }
        ]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>
              {type === 'date' ? 'Filter by Date' : type === 'type' ? 'Filter by Type' : 'Filter by Sender'}
            </Text>
            <Pressable onPress={handleApply} hitSlop={10}>
              <Text style={[styles.applyBtn, { color: colors.primary }]}>Apply</Text>
            </Pressable>
          </View>

          {type === 'date' && renderDateContent()}
          {type === 'type' && renderTypeContent()}
          {type === 'user' && renderUserContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  applyBtn: {
    fontSize: 17,
    fontWeight: '600',
  },
  contentSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  // Date Styles
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  dateCol: {
    flex: 1,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  androidDateBtn: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  // Type Styles
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // User Styles
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#333',
  },
  userName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});

