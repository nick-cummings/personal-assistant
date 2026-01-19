'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import { StreamingMessage } from './streaming-message';
import type { Message } from '@/types';

interface StreamingMessageData {
  id: string;
  role: 'assistant';
  content: string;
  createdAt: Date;
}

interface MessageListProps {
  messages: Message[];
  streamingMessage?: StreamingMessageData | null;
}

export function MessageList({ messages, streamingMessage }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, streamingMessage?.content]);

  if (messages.length === 0 && !streamingMessage) {
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
        {streamingMessage && <StreamingMessage content={streamingMessage.content} />}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}
