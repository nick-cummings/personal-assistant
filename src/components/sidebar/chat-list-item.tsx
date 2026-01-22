'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useArchiveChat, useDeleteChat, useForkChat, useUpdateChat } from '@/hooks/use-chats';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import type { Chat } from '@/types';
import { useDraggable } from '@dnd-kit/core';
import {
    Archive,
    ArchiveRestore, GitFork, GripVertical, MessageSquare,
    MoreHorizontal,
    Pencil,
    Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DragItem } from './dnd-context';

interface ChatListItemProps {
  chat: Chat & { archived?: boolean; folderId?: string | null };
  isActive?: boolean;
}

export function ChatListItem({ chat, isActive }: ChatListItemProps) {
  const router = useRouter();
  const { setSelectedChat } = useAppStore();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();
  const forkChat = useForkChat();
  const archiveChat = useArchiveChat();

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title);

  const dragData: DragItem = {
    id: chat.id,
    type: 'chat',
    title: chat.title,
    parentId: chat.folderId,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chat-${chat.id}`,
    data: dragData,
  });

  const handleClick = () => {
    setSelectedChat(chat.id);
    router.push(`/chat/${chat.id}`);
  };

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== chat.title) {
      updateChat.mutate({ id: chat.id, title: newTitle.trim() });
    }
    setShowRenameDialog(false);
  };

  const handleDelete = () => {
    deleteChat.mutate(chat.id, {
      onSuccess: () => {
        if (isActive) {
          router.push('/chat');
        }
      },
    });
    setShowDeleteDialog(false);
  };

  const handleFork = () => {
    forkChat.mutate(
      { id: chat.id },
      {
        onSuccess: (forkedChat) => {
          router.push(`/chat/${forkedChat.id}`);
        },
      }
    );
  };

  const handleArchive = () => {
    archiveChat.mutate(
      { id: chat.id, archived: !chat.archived },
      {
        onSuccess: () => {
          if (isActive && !chat.archived) {
            router.push('/chat');
          }
        },
      }
    );
  };

  return (
    <TooltipProvider>
      <div
        ref={setNodeRef}
        className={cn(
          'group hover:bg-accent flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm',
          isActive && 'bg-accent',
          isDragging && 'opacity-50'
        )}
        onClick={handleClick}
      >
        <div
          className="cursor-grab touch-none opacity-0 group-hover:opacity-100"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="text-muted-foreground h-3 w-3" />
        </div>
        <MessageSquare className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        <span
          className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ maxWidth: '140px' }}
          title={chat.title}
        >
          {chat.title}
        </span>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleFork}>
              <GitFork className="mr-2 h-4 w-4" />
              Fork
            </DropdownMenuItem>
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

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>Enter a new name for this chat.</DialogDescription>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Chat name"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={updateChat.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
