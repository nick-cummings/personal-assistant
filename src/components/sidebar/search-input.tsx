'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app-store';

export function SearchInput() {
  const { searchQuery, setSearchQuery } = useAppStore();

  return (
    <div className="relative px-2">
      <Search className="text-muted-foreground absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2" />
      <Input
        type="text"
        placeholder="Search chats..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pr-8 pl-8"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2"
          onClick={() => setSearchQuery('')}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
