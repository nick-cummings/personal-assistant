'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, GitFork, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useChat, useUpdateChat, useForkChat, useAddMessage } from '@/hooks/use-chats';
import { useSettings } from '@/hooks/use-settings';
import { ANTHROPIC_MODELS } from '@/types';

interface ChatInterfaceProps {
  chatId: string;
}

export function ChatInterface({ chatId }: ChatInterfaceProps) {
  const router = useRouter();
  const { data: chat, isLoading } = useChat(chatId);
  const { data: settings, updateSettings } = useSettings();
  const updateChat = useUpdateChat();
  const forkChat = useForkChat();
  const addMessage = useAddMessage();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = () => {
    setEditTitle(chat?.title ?? '');
    setIsEditing(true);
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== chat?.title) {
      updateChat.mutate({ id: chatId, title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleFork = () => {
    forkChat.mutate(
      { id: chatId },
      {
        onSuccess: (forkedChat) => {
          router.push(`/chat/${forkedChat.id}`);
        },
      }
    );
  };

  const handleSendMessage = (content: string) => {
    addMessage.mutate({
      chatId,
      role: 'user',
      content,
    });

    // For now, just add a placeholder assistant response
    // This will be replaced with actual AI streaming in Phase 2
    setTimeout(() => {
      addMessage.mutate({
        chatId,
        role: 'assistant',
        content: 'This is a placeholder response. AI integration will be added in Phase 2.',
      });
    }, 500);
  };

  const selectedModel = ANTHROPIC_MODELS.find((m) => m.id === settings?.selectedModel);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-medium">Chat not found</p>
          <p className="text-sm">This chat may have been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="h-8 w-64"
                autoFocus
              />
            ) : (
              <>
                <h1 className="text-lg font-semibold">{chat.title}</h1>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename chat</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFork}>
                  <GitFork className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fork chat</TooltipContent>
            </Tooltip>
          </div>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    {selectedModel?.name ?? 'Select Model'}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Select model</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {ANTHROPIC_MODELS.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => {
                    updateSettings({ selectedModel: model.id });
                  }}
                >
                  {model.name}
                  {settings?.selectedModel === model.id && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages */}
        <MessageList messages={chat.messages} />

        {/* Input */}
        <ChatInput onSend={handleSendMessage} disabled={addMessage.isPending} />
      </div>
    </TooltipProvider>
  );
}
