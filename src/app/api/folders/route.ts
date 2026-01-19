import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateFolderRequest, FolderWithChildren } from '@/types';

// GET /api/folders - List all folders as a tree
export async function GET() {
  try {
    const folders = await db.folder.findMany({
      include: {
        chats: {
          where: { archived: false },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Build tree structure
    const folderMap = new Map<string, FolderWithChildren>();
    const rootFolders: FolderWithChildren[] = [];

    // First pass: create map entries
    for (const folder of folders) {
      folderMap.set(folder.id, { ...folder, children: [] });
    }

    // Second pass: build tree
    for (const folder of folders) {
      const folderWithChildren = folderMap.get(folder.id)!;
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(folderWithChildren);
        } else {
          // Parent doesn't exist, treat as root
          rootFolders.push(folderWithChildren);
        }
      } else {
        rootFolders.push(folderWithChildren);
      }
    }

    return NextResponse.json(rootFolders);
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

// POST /api/folders - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const body: CreateFolderRequest = await request.json();

    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // If parentId is provided, verify it exists
    if (body.parentId) {
      const parent = await db.folder.findUnique({
        where: { id: body.parentId },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }
    }

    // Get max sortOrder for siblings
    const maxSortOrder = await db.folder.aggregate({
      _max: { sortOrder: true },
      where: { parentId: body.parentId ?? null },
    });

    const folder = await db.folder.create({
      data: {
        name: body.name.trim(),
        parentId: body.parentId ?? null,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
      },
      include: {
        chats: true,
      },
    });

    return NextResponse.json({ ...folder, children: [] }, { status: 201 });
  } catch (error) {
    console.error('Failed to create folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
