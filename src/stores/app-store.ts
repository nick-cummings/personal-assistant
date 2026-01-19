'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Selected chat
  selectedChatId: string | null;
  setSelectedChat: (chatId: string | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Selected chat
      selectedChatId: null,
      setSelectedChat: (chatId) => set({ selectedChatId: chatId }),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'ai-chat-hub-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
