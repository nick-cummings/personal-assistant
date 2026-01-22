'use client';

import { useAppKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useCallback, useState, type ReactNode } from 'react';
import { CommandPalette } from './command-palette';

interface AppShellProps {
  children: ReactNode;
}

/**
 * App shell wrapper that provides:
 * - Command palette (⌘K)
 * - Global keyboard shortcuts
 * - Background cache preloading
 */
export function AppShell({ children }: AppShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  // Register global keyboard shortcuts
  useAppKeyboardShortcuts(openCommandPalette);

  return (
    <>
      {children}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  );
}
