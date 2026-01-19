'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Plus, Settings, FileText, FolderPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SearchInput } from './search-input';
import { FolderTree } from './folder-tree';
import { ArchivedChats } from './archived-chats';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { ThemeToggle } from '@/components/theme-toggle';
import { useFolders, useCreateFolder } from '@/hooks/use-folders';
import { useChats, useCreateChat } from '@/hooks/use-chats';

interface MobileSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const router = useRouter();
  const { data: folders, isLoading: foldersLoading } = useFolders();
  const { data: chats, isLoading: chatsLoading } = useChats();
  const createFolder = useCreateFolder();
  const createChat = useCreateChat();

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const unfiledChats = chats?.filter((chat) => !chat.folderId) ?? [];

  const handleNewChat = () => {
    createChat.mutate(
      {},
      {
        onSuccess: (chat) => {
          onOpenChange?.(false);
          router.push(`/chat/${chat.id}`);
        },
      }
    );
  };

  const handleNewFolder = () => {
    if (newFolderName.trim()) {
      createFolder.mutate({ name: newFolderName.trim() });
      setNewFolderName('');
    }
    setShowNewFolderDialog(false);
  };

  const handleNavigation = (path: string) => {
    onOpenChange?.(false);
    router.push(path);
  };

  const isLoading = foldersLoading || chatsLoading;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>AI Chat Hub</SheetTitle>
              <Button variant="ghost" size="icon" onClick={handleNewChat}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          <div className="py-2 px-2">
            <SearchInput />
          </div>

          <Separator />

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  <FolderTree
                    folders={folders ?? []}
                    unfiledChats={unfiledChats}
                  />
                  <ArchivedChats />
                </>
              )}
            </div>
          </ScrollArea>

          <Separator />

          <div className="p-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleNavigation('/settings/context')}
            >
              <FileText className="mr-2 h-4 w-4" />
              My Context
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleNavigation('/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Separator className="my-2" />
            <div className="flex items-center justify-between px-2">
              <span className="text-muted-foreground text-sm">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder to organize your chats.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewFolderDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleNewFolder} disabled={createFolder.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Mobile header with menu button
 */
export function MobileHeader() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const createChat = useCreateChat();

  const handleNewChat = () => {
    createChat.mutate(
      {},
      {
        onSuccess: (chat) => {
          router.push(`/chat/${chat.id}`);
        },
      }
    );
  };

  return (
    <>
      <div className="flex md:hidden items-center justify-between border-b p-2">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-semibold">AI Chat Hub</span>
        <Button variant="ghost" size="icon" onClick={handleNewChat}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <MobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </>
  );
}
