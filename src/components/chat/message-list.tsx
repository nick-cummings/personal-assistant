'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import type { Message } from '@/types';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">No messages yet</p>
          <p className="text-sm">Start a conversation by typing a message below.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="mx-auto max-w-3xl py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}
