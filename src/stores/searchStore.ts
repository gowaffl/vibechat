import { create } from 'zustand';

interface SearchState {
  searchQuery: string;
  isSearchOpen: boolean;
  searchMode: "text" | "semantic";
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  setSearchMode: (mode: "text" | "semantic") => void;
  toggleSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: '',
  isSearchOpen: false,
  searchMode: "semantic", // Default to AI Semantic Search as requested
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
}));

