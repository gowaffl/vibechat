import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SearchMode = "text" | "semantic" | "hybrid";

export interface SearchFilters {
  chatId?: string;
  fromUserId?: string;
  messageTypes?: ("text" | "image" | "voice" | "video" | "poll" | "event")[];
  dateFrom?: string;
  dateTo?: string;
}

interface SearchState {
  searchQuery: string;
  isSearchOpen: boolean;
  searchMode: SearchMode;
  filters: SearchFilters;
  searchHistory: string[];
  
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  setSearchMode: (mode: SearchMode) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  toggleSearch: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      searchQuery: '',
      isSearchOpen: false,
      searchMode: "hybrid", // Default to Hybrid as requested
      filters: {},
      searchHistory: [],
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
      setSearchMode: (mode) => set({ searchMode: mode }),
      
      setFilters: (newFilters) => set((state) => ({ 
        filters: { ...state.filters, ...newFilters } 
      })),
      
      clearFilters: () => set({ filters: {} }),
      
      addToHistory: (query) => {
        const queryTrimmed = query.trim();
        if (!queryTrimmed) return;
        
        set((state) => {
          // Remove duplicates and keep top 10 recent
          const newHistory = [
            queryTrimmed,
            ...state.searchHistory.filter(q => q !== queryTrimmed)
          ].slice(0, 10);
          return { searchHistory: newHistory };
        });
      },
      
      clearHistory: () => set({ searchHistory: [] }),
      
      toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
    }),
    {
      name: 'vibe-search-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ searchHistory: state.searchHistory, searchMode: state.searchMode }), // Only persist history and preference
    }
  )
);
