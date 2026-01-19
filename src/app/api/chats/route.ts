import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateChatRequest } from '@/types';

// GET /api/chats - List all chats
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folderId = searchParams.get('folderId');
    const archived = searchParams.get('archived') === 'true';

    const whereClause: {
      folderId?: string | null;
      archived: boolean;
    } = { archived };

    if (folderId === 'unfiled') {
      whereClause.folderId = null;
    } else if (folderId) {
      whereClause.folderId = folderId;
    }

    const chats = await db.chat.findMany({
      where: whereClause,
      include: {
        folder: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: archived ? { archivedAt: 'desc' } : { updatedAt: 'desc' },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

// POST /api/chats - Create a new chat
export async function POST(request: NextRequest) {
  try {
    const body: CreateChatRequest = await request.json();

    // If folderId is provided, verify it exists
    if (body.folderId) {
      const folder = await db.folder.findUnique({
        where: { id: body.folderId },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    const chat = await db.chat.create({
      data: {
        title: body.title?.trim() || 'New Chat',
        folderId: body.folderId ?? null,
      },
      include: {
        folder: true,
        messages: true,
      },
    });

    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}
