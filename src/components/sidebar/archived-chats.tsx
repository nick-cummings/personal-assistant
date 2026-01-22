'use client';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useArchivedChats } from '@/hooks/use-chats';
import { useAppStore } from '@/stores/app-store';
import { Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ChatListItem } from './chat-list-item';

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
          className="text-muted-foreground hover:text-foreground h-auto w-full justify-start gap-2 px-2 py-1.5 text-sm"
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
          <ChatListItem key={chat.id} chat={chat} isActive={selectedChatId === chat.id} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
