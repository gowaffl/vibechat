import { create } from 'zustand';
import { ImagePreviewResponse } from '@/shared/contracts';

interface DraftState {
  // Map of chatId -> ImagePreviewResponse
  imageDrafts: Record<string, ImagePreviewResponse | null>;
  setImageDraft: (chatId: string, draft: ImagePreviewResponse | null) => void;
  clearImageDraft: (chatId: string) => void;
}

export const useDraftStore = create<DraftState>((set) => ({
  imageDrafts: {},
  setImageDraft: (chatId, draft) => set((state) => ({
    imageDrafts: { ...state.imageDrafts, [chatId]: draft }
  })),
  clearImageDraft: (chatId) => set((state) => ({
    imageDrafts: { ...state.imageDrafts, [chatId]: null }
  }))
}));
