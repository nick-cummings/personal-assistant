import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateChatRequest, CreateMessageRequest } from '@/types';
import type { Prisma } from '@/generated/prisma';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/chats/[id] - Get a chat with all messages
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const chat = await db.chat.findUnique({
      where: { id },
      include: {
        folder: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to fetch chat:', error);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}

// PATCH /api/chats/[id] - Update a chat (title, folder)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: UpdateChatRequest = await request.json();

    // Check chat exists
    const existing = await db.chat.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // If folderId is provided, verify it exists
    if (body.folderId) {
      const folder = await db.folder.findUnique({
        where: { id: body.folderId },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    const updateData: {
      title?: string;
      folderId?: string | null;
      archived?: boolean;
      archivedAt?: Date | null;
    } = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim() || 'Untitled';
    }
    if (body.folderId !== undefined) {
      updateData.folderId = body.folderId;
    }
    if (body.archived !== undefined) {
      updateData.archived = body.archived;
      updateData.archivedAt = body.archived ? new Date() : null;
    }

    const updated = await db.chat.update({
      where: { id },
      data: updateData,
      include: {
        folder: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update chat:', error);
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 });
  }
}

// DELETE /api/chats/[id] - Delete a chat
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check chat exists
    const existing = await db.chat.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Delete chat (cascades to messages due to onDelete: Cascade)
    await db.chat.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}

// POST /api/chats/[id] - Add a message to a chat
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: CreateMessageRequest = await request.json();

    // Check chat exists
    const chat = await db.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Validate role
    const validRoles = ['user', 'assistant', 'system', 'tool'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid message role' }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        chatId: id,
        role: body.role,
        content: body.content,
        toolCalls: body.toolCalls as Prisma.InputJsonValue | undefined,
        toolName: body.toolName ?? undefined,
      },
    });

    // Update chat's updatedAt
    await db.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
