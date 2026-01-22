'use client';

import { useQuery } from '@tanstack/react-query';

interface SearchResult {
  id: string;
  title: string;
  folder: {
    id: string;
    name: string;
  } | null;
  messageCount: number;
  updatedAt: string;
  matchingMessages: Array<{
    id: string;
    role: string;
    excerpt: string;
    createdAt: string;
  }>;
}

interface SearchResponse {
  results: SearchResult[];
}

async function searchChats(query: string): Promise<SearchResponse> {
  if (!query || query.trim().length < 2) {
    return { results: [] };
  }

  const response = await fetch(`/api/chats/search?q=${encodeURIComponent(query)}&limit=10`);

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return response.json();
}

export function useChatSearch(query: string) {
  return useQuery({
    queryKey: ['chat-search', query],
    queryFn: () => searchChats(query),
    enabled: query.length >= 2, // Only search with 2+ characters
    staleTime: 30000, // Cache results for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous results while loading
  });
}

export type { SearchResult };
