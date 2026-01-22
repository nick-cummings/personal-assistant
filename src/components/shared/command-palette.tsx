'use client';

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut
} from '@/components/ui/command';
import { useChats, useCreateChat } from '@/hooks/use-chats';
import { ALL_SHORTCUTS, formatShortcut } from '@/hooks/use-keyboard-shortcuts';
import { useAppStore } from '@/stores/app-store';
import {
    FileText, Keyboard, MessageSquare, Moon, PanelLeft, PanelLeftClose, Plug, Plus, Search, Settings, Sun
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { theme, setTheme } = useTheme();
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const { data: chats } = useChats();
  const createChatMutation = useCreateChat();

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  // Filter chats based on search
  const filteredChats = chats?.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() =>
              runCommand(async () => {
                const chat = await createChatMutation.mutateAsync({ title: 'New Chat' });
                if (chat) {
                  router.push(`/chat/${chat.id}`);
                }
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New Chat</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runCommand(() => {
                const searchInput = document.querySelector(
                  '[data-search-input]'
                ) as HTMLInputElement;
                searchInput?.focus();
              })
            }
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search Chats</span>
            <CommandShortcut>⌘/</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(toggleSidebar)}>
            {sidebarCollapsed ? (
              <PanelLeft className="mr-2 h-4 w-4" />
            ) : (
              <PanelLeftClose className="mr-2 h-4 w-4" />
            )}
            <span>{sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Recent Chats */}
        {filteredChats && filteredChats.length > 0 && (
          <>
            <CommandGroup heading="Recent Chats">
              {filteredChats.slice(0, 5).map((chat) => (
                <CommandItem
                  key={chat.id}
                  onSelect={() => runCommand(() => router.push(`/chat/${chat.id}`))}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>{chat.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/chat'))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chat</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push('/settings/connectors'))}>
            <Plug className="mr-2 h-4 w-4" />
            <span>Connectors</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push('/settings/context'))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>My Context</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Theme */}
        <CommandGroup heading="Appearance">
          <CommandItem
            onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Keyboard Shortcuts Help */}
        <CommandGroup heading="Help">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                // Show keyboard shortcuts in a modal or navigate to help
                alert(
                  'Keyboard Shortcuts:\n\n' +
                    ALL_SHORTCUTS.map((s) => `${formatShortcut(s)}: ${s.description}`).join('\n')
                );
              })
            }
          >
            <Keyboard className="mr-2 h-4 w-4" />
            <span>Keyboard Shortcuts</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
