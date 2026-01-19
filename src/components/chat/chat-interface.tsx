'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, GitFork, ChevronDown, Archive, ArchiveRestore, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useChat, useUpdateChat, useForkChat, useArchiveChat, useDeleteChat } from '@/hooks/use-chats';
import { useChatStream } from '@/hooks/use-chat-stream';
import { useSettings } from '@/hooks/use-settings';
import { ANTHROPIC_MODELS } from '@/types';

interface ChatInterfaceProps {
  chatId: string;
}

export function ChatInterface({ chatId }: ChatInterfaceProps) {
  const router = useRouter();
  const { data: chat, isLoading, refetch } = useChat(chatId);
  const { data: settings, updateSettings } = useSettings();
  const updateChat = useUpdateChat();
  const forkChat = useForkChat();
  const archiveChat = useArchiveChat();
  const deleteChat = useDeleteChat();
  const { sendMessage, isStreaming, streamingMessage, error } = useChatStream({
    chatId,
    onFinish: () => refetch(),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    sendMessage(content);
  };

  const handleArchive = () => {
    archiveChat.mutate(
      { id: chatId, archived: !chat?.archived },
      {
        onSuccess: () => {
          if (!chat?.archived) {
            router.push('/chat');
          }
        },
      }
    );
  };

  const handleDelete = () => {
    deleteChat.mutate(chatId, {
      onSuccess: () => {
        router.push('/chat');
      },
    });
    setShowDeleteDialog(false);
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

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleArchive}>
                  {chat.archived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        <MessageList messages={chat.messages} streamingMessage={streamingMessage} />

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Input */}
        <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{chat.title}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteChat.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
