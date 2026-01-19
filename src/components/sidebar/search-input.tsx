'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, MessageSquare, Folder, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/stores/app-store';
import { useChatSearch, type SearchResult } from '@/hooks/use-chat-search';
import { cn } from '@/lib/utils';

export function SearchInput() {
  const router = useRouter();
  const { searchQuery, setSearchQuery } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useChatSearch(searchQuery);
  const results = data?.results ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open dropdown when typing
  useEffect(() => {
    if (searchQuery.length >= 2) {
      setIsOpen(true);
    }
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setIsOpen(false);
    router.push(`/chat/${result.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative px-2">
      <Search className="text-muted-foreground absolute top-1/2 left-4 z-10 h-4 w-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search chats..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => searchQuery.length >= 2 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-8 pr-8"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-3 z-10 h-5 w-5 -translate-y-1/2"
          onClick={() => {
            setSearchQuery('');
            setIsOpen(false);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Search Results Dropdown */}
      {isOpen && searchQuery.length >= 2 && (
        <div className="bg-popover absolute top-full left-2 right-2 z-50 mt-1 rounded-md border shadow-lg">
          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No results found
              </div>
            ) : (
              <div className="py-1">
                {results.map((result) => (
                  <button
                    key={result.id}
                    className="hover:bg-accent w-full px-3 py-2 text-left transition-colors"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-medium">{result.title}</span>
                    </div>
                    {result.folder && (
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                        <Folder className="h-3 w-3" />
                        {result.folder.name}
                      </div>
                    )}
                    {result.matchingMessages.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {result.matchingMessages.slice(0, 2).map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              'text-muted-foreground truncate rounded px-2 py-1 text-xs',
                              'bg-muted/50'
                            )}
                          >
                            <span className="font-medium">
                              {msg.role === 'user' ? 'You: ' : 'Assistant: '}
                            </span>
                            {msg.excerpt}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
