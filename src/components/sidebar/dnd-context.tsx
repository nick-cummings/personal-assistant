'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { MessageSquare, Folder } from 'lucide-react';
import { useUpdateChat } from '@/hooks/use-chats';
import { useUpdateFolder } from '@/hooks/use-folders';

export type DraggableType = 'chat' | 'folder';

export interface DragItem {
  id: string;
  type: DraggableType;
  title: string;
  parentId?: string | null;
}

interface DndContextValue {
  activeItem: DragItem | null;
  overId: string | null;
  overType: 'folder' | 'root' | null;
}

const SidebarDndContext = createContext<DndContextValue>({
  activeItem: null,
  overId: null,
  overType: null,
});

export function useSidebarDnd() {
  return useContext(SidebarDndContext);
}

interface SidebarDndProviderProps {
  children: React.ReactNode;
}

export function SidebarDndProvider({ children }: SidebarDndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overType, setOverType] = useState<'folder' | 'root' | null>(null);

  const updateChat = useUpdateChat();
  const updateFolder = useUpdateFolder();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DragItem | undefined;
    if (data) {
      setActiveItem(data);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      const overData = over.data.current as { type?: string; accepts?: DraggableType[] } | undefined;
      setOverId(over.id as string);
      setOverType(overData?.type === 'folder' ? 'folder' : overData?.type === 'root' ? 'root' : null);
    } else {
      setOverId(null);
      setOverType(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveItem(null);
    setOverId(null);
    setOverType(null);

    if (!over) return;

    const activeData = active.data.current as DragItem | undefined;
    const overData = over.data.current as { type?: string; folderId?: string | null } | undefined;

    if (!activeData) return;

    const targetFolderId = overData?.type === 'folder'
      ? (over.id as string)
      : overData?.type === 'root'
        ? null
        : null;

    // Don't do anything if dropping on the same location
    if (activeData.type === 'chat' && activeData.parentId === targetFolderId) {
      return;
    }
    if (activeData.type === 'folder' && activeData.parentId === targetFolderId) {
      return;
    }

    // Prevent dropping a folder into itself or its descendants
    if (activeData.type === 'folder' && targetFolderId === activeData.id) {
      return;
    }

    if (activeData.type === 'chat') {
      updateChat.mutate({
        id: activeData.id,
        folderId: targetFolderId,
      });
    } else if (activeData.type === 'folder') {
      updateFolder.mutate({
        id: activeData.id,
        parentId: targetFolderId,
      });
    }
  }, [updateChat, updateFolder]);

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setOverId(null);
    setOverType(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SidebarDndContext.Provider value={{ activeItem, overId, overType }}>
        {children}
      </SidebarDndContext.Provider>

      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-sm shadow-lg border">
            {activeItem.type === 'chat' ? (
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="truncate max-w-[150px]">{activeItem.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
