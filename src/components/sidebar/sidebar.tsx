'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeftClose, PanelLeft, Plus, FolderPlus, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useAppStore } from '@/stores/app-store';
import { useFolders, useCreateFolder } from '@/hooks/use-folders';
import { useChats, useCreateChat } from '@/hooks/use-chats';

export function Sidebar() {
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { data: folders, isLoading: foldersLoading } = useFolders();
  const { data: chats, isLoading: chatsLoading } = useChats();
  const createFolder = useCreateFolder();
  const createChat = useCreateChat();

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Get unfiled chats (chats without a folder)
  const unfiledChats = chats?.filter((chat) => !chat.folderId) ?? [];

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

  const handleNewFolder = () => {
    if (newFolderName.trim()) {
      createFolder.mutate({ name: newFolderName.trim() });
      setNewFolderName('');
    }
    setShowNewFolderDialog(false);
  };

  const isLoading = foldersLoading || chatsLoading;

  return (
    <TooltipProvider>
      <div
        className={cn(
          'bg-sidebar flex h-full flex-col border-r transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-12' : 'w-64'
        )}
      >
        {/* Header - Collapsed */}
        {sidebarCollapsed && (
          <div className="flex flex-col items-center py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                  <PanelLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>

            <Separator className="my-2" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleNewChat}>
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New chat</TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            <ThemeToggle />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Header - Expanded */}
        {!sidebarCollapsed && (
          <>
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-2 px-2">
                <span className="font-semibold whitespace-nowrap">AI Chat Hub</span>
              </div>
              <div className="flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleNewChat}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New chat</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                      <PanelLeftClose className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Collapse sidebar</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Separator />

            {/* Search */}
            <div className="py-2">
              <SearchInput />
            </div>

            <Separator />

            {/* Folder/Chat Tree */}
            <ScrollArea className="flex-1 w-full">
              <div className="p-2 w-full">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <>
                    <FolderTree folders={folders ?? []} unfiledChats={unfiledChats} />
                    <ArchivedChats />
                  </>
                )}
              </div>
            </ScrollArea>

            <Separator />

            {/* Footer */}
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
                onClick={() => router.push('/settings/context')}
              >
                <FileText className="mr-2 h-4 w-4" />
                My Context
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => router.push('/settings')}
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
          </>
        )}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Create a new folder to organize your chats.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
            autoFocus
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
