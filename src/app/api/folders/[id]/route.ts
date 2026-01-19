import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateFolderRequest } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/folders/[id] - Update a folder
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: UpdateFolderRequest = await request.json();

    // Check folder exists
    const existing = await db.folder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Validate name if provided
    if (body.name !== undefined && body.name.trim() === '') {
      return NextResponse.json({ error: 'Folder name cannot be empty' }, { status: 400 });
    }

    // Prevent circular reference (folder cannot be its own parent or descendant)
    if (body.parentId !== undefined && body.parentId !== null) {
      if (body.parentId === id) {
        return NextResponse.json({ error: 'Folder cannot be its own parent' }, { status: 400 });
      }

      // Check if new parent exists
      const newParent = await db.folder.findUnique({
        where: { id: body.parentId },
      });
      if (!newParent) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }

      // Check for circular reference by traversing up the tree
      let currentParentId: string | null = body.parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          return NextResponse.json(
            { error: 'Cannot move folder to its own descendant' },
            { status: 400 }
          );
        }
        const parentFolder: { parentId: string | null } | null = await db.folder.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });
        currentParentId = parentFolder?.parentId ?? null;
      }
    }

    const updated = await db.folder.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
      include: {
        chats: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update folder:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

// DELETE /api/folders/[id] - Delete a folder (cascades to children)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check folder exists
    const existing = await db.folder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Delete folder (cascades to children due to onDelete: Cascade)
    // Chats will have folderId set to null due to onDelete: SetNull
    await db.folder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete folder:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
