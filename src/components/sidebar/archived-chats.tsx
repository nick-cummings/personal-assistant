'use client';

import { useState } from 'react';
import { Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChatListItem } from './chat-list-item';
import { useArchivedChats } from '@/hooks/use-chats';
import { useAppStore } from '@/stores/app-store';

export function ArchivedChats() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: archivedChats, isLoading } = useArchivedChats();
  const selectedChatId = useAppStore((state) => state.selectedChatId);

  if (isLoading || !archivedChats || archivedChats.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 py-1.5 h-auto text-sm text-muted-foreground hover:text-foreground"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <Archive className="h-4 w-4 shrink-0" />
          <span>Archived</span>
          <span className="ml-auto text-xs opacity-60">{archivedChats.length}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        {archivedChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={selectedChatId === chat.id}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
