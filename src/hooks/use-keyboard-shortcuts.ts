'use client';

import { useAppStore } from '@/stores/app-store';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

/**
 * Check if an element is an input-like element
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  );
}

/**
 * Hook for global keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (unless it's a meta/ctrl shortcut)
      if (isInputElement(document.activeElement)) {
        // Allow only meta/ctrl shortcuts in inputs
        if (!event.metaKey && !event.ctrlKey) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta
          ? event.metaKey
          : shortcut.ctrl
            ? event.ctrlKey
            : !event.metaKey && !event.ctrlKey;
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey
          : shortcut.meta
            ? event.metaKey
            : !event.metaKey && !event.ctrlKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // For meta/ctrl shortcuts, match either
        const modifierMatch =
          shortcut.meta || shortcut.ctrl
            ? (event.metaKey || event.ctrlKey) && shiftMatch && altMatch
            : metaMatch && ctrlMatch && shiftMatch && altMatch;

        if (keyMatch && modifierMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for app-wide keyboard shortcuts
 */
export function useAppKeyboardShortcuts(onCommandPalette?: () => void) {
  const router = useRouter();
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      meta: true,
      description: 'Open command palette',
      action: () => onCommandPalette?.(),
    },
    {
      key: 'n',
      meta: true,
      description: 'New chat',
      action: () => router.push('/chat'),
    },
    {
      key: 'b',
      meta: true,
      description: 'Toggle sidebar',
      action: toggleSidebar,
    },
    {
      key: ',',
      meta: true,
      description: 'Open settings',
      action: () => router.push('/settings'),
    },
    {
      key: '/',
      meta: true,
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        searchInput?.focus();
      },
    },
    {
      key: 'Escape',
      description: 'Close dialogs / blur input',
      action: () => {
        const activeElement = document.activeElement as HTMLElement;
        activeElement?.blur?.();
      },
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

/**
 * Get formatted shortcut key string for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.meta || shortcut.ctrl) {
    parts.push('⌘');
  }
  if (shortcut.shift) {
    parts.push('⇧');
  }
  if (shortcut.alt) {
    parts.push('⌥');
  }

  // Format special keys
  const keyDisplay =
    {
      escape: 'Esc',
      enter: '↵',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
      backspace: '⌫',
      delete: '⌦',
      ' ': 'Space',
    }[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase();

  parts.push(keyDisplay);

  return parts.join('');
}

/**
 * All available keyboard shortcuts for documentation
 */
export const ALL_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'k',
    meta: true,
    description: 'Open command palette',
    action: () => {},
  },
  {
    key: 'n',
    meta: true,
    description: 'New chat',
    action: () => {},
  },
  {
    key: 'b',
    meta: true,
    description: 'Toggle sidebar',
    action: () => {},
  },
  {
    key: ',',
    meta: true,
    description: 'Open settings',
    action: () => {},
  },
  {
    key: '/',
    meta: true,
    description: 'Focus search',
    action: () => {},
  },
  {
    key: 'Escape',
    description: 'Close dialogs / blur input',
    action: () => {},
  },
];
