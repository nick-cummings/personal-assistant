'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, MoreHorizontal, Pencil, Trash2, GitFork, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUpdateChat, useDeleteChat, useForkChat, useArchiveChat } from '@/hooks/use-chats';
import { useAppStore } from '@/stores/app-store';
import type { Chat } from '@/types';

interface ChatListItemProps {
  chat: Chat & { archived?: boolean };
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
        className={cn(
          'group hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm min-w-0',
          isActive && 'bg-accent'
        )}
        onClick={handleClick}
      >
        <MessageSquare className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        <span
          className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
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
