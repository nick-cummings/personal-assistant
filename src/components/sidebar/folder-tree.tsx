'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { ChatListItem } from './chat-list-item';
import { useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/use-folders';
import { useCreateChat } from '@/hooks/use-chats';
import { useAppStore } from '@/stores/app-store';
import { useSidebarDnd, type DragItem } from './dnd-context';
import type { FolderWithChildren } from '@/types';

interface FolderTreeItemProps {
  folder: FolderWithChildren;
  level?: number;
}

export function FolderTreeItem({ folder, level = 0 }: FolderTreeItemProps) {
  const params = useParams();
  const activeChatId = params?.chatId as string | undefined;
  const { searchQuery } = useAppStore();
  const { activeItem } = useSidebarDnd();

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const createChat = useCreateChat();

  const [isOpen, setIsOpen] = useState(true);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [newFolderName, setNewFolderName] = useState('');

  // Make folder draggable
  const dragData: DragItem = {
    id: folder.id,
    type: 'folder',
    title: folder.name,
    parentId: folder.parentId,
  };

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `folder-${folder.id}`,
    data: dragData,
  });

  // Make folder droppable
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folder.id,
    data: { type: 'folder', folderId: folder.id },
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  // Check if this folder can accept the current drag item
  const canAcceptDrop = activeItem && (
    activeItem.type === 'chat' ||
    (activeItem.type === 'folder' && activeItem.id !== folder.id)
  );

  // Filter chats by search query
  const filteredChats = folder.chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if any children or chats match the search
  const hasMatchingContent =
    filteredChats.length > 0 ||
    folder.children.some((child) =>
      child.chats.some((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  // If searching and no matches, don't render
  if (searchQuery && !hasMatchingContent) {
    return null;
  }

  const handleRename = () => {
    if (newName.trim() && newName !== folder.name) {
      updateFolder.mutate({ id: folder.id, name: newName.trim() });
    }
    setShowRenameDialog(false);
  };

  const handleDelete = () => {
    deleteFolder.mutate(folder.id);
    setShowDeleteDialog(false);
  };

  const handleNewFolder = () => {
    if (newFolderName.trim()) {
      createFolder.mutate({ name: newFolderName.trim(), parentId: folder.id });
      setNewFolderName('');
    }
    setShowNewFolderDialog(false);
  };

  const handleNewChat = () => {
    createChat.mutate({ folderId: folder.id });
  };

  const FolderIcon = isOpen ? FolderOpen : Folder;

  return (
    <TooltipProvider>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          ref={setNodeRef}
          className={cn(
            'group hover:bg-accent flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
            isDragging && 'opacity-50',
            isOver && canAcceptDrop && 'bg-accent ring-2 ring-primary ring-inset'
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <div
            className="cursor-grab opacity-0 group-hover:opacity-100 touch-none"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                  <ChevronRight
                    className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')}
                  />
                </Button>
              </CollapsibleTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{isOpen ? 'Collapse' : 'Expand'}</TooltipContent>
          </Tooltip>
          <FolderIcon className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{folder.name}</span>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleNewChat}>
                <Plus className="mr-2 h-4 w-4" />
                New Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowNewFolderDialog(true)}>
                <Folder className="mr-2 h-4 w-4" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
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

        <CollapsibleContent>
          {/* Child folders */}
          {folder.children.map((child) => (
            <FolderTreeItem key={child.id} folder={child} level={level + 1} />
          ))}
          {/* Chats in this folder */}
          <div style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
            {filteredChats.map((chat) => (
              <ChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>Enter a new name for this folder.</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={updateFolder.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{folder.name}&quot;? All subfolders will be
              deleted. Chats will be moved to unfiled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteFolder.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Subfolder</DialogTitle>
            <DialogDescription>
              Create a new folder inside &quot;{folder.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewFolder} disabled={createFolder.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

interface FolderTreeProps {
  folders: FolderWithChildren[];
  unfiledChats?: { id: string; title: string; createdAt: Date; updatedAt: Date; folderId?: string | null }[];
}

function UnfiledDropZone({ children }: { children: React.ReactNode }) {
  const { activeItem } = useSidebarDnd();
  const { setNodeRef, isOver } = useDroppable({
    id: 'unfiled-root',
    data: { type: 'root', folderId: null },
  });

  const canAcceptDrop = activeItem && (
    activeItem.type === 'chat' || activeItem.type === 'folder'
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-2 px-2 min-h-[32px] rounded-md transition-colors',
        isOver && canAcceptDrop && 'bg-accent ring-2 ring-primary ring-inset'
      )}
    >
      {children}
      {isOver && canAcceptDrop && (
        <div className="text-xs text-muted-foreground py-1 text-center">
          Drop here to remove from folder
        </div>
      )}
    </div>
  );
}

export function FolderTree({ folders, unfiledChats = [] }: FolderTreeProps) {
  const params = useParams();
  const activeChatId = params?.chatId as string | undefined;
  const { searchQuery } = useAppStore();

  // Filter unfiled chats by search query
  const filteredUnfiledChats = unfiledChats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-1 w-full">
      {folders.map((folder) => (
        <FolderTreeItem key={folder.id} folder={folder} />
      ))}

      {/* Unfiled chats - droppable area */}
      <UnfiledDropZone>
        {filteredUnfiledChats.map((chat) => (
          <ChatListItem key={chat.id} chat={chat as any} isActive={chat.id === activeChatId} />
        ))}
      </UnfiledDropZone>
    </div>
  );
}
