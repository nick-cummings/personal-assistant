import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/chats/[id]/fork - Fork a chat (copy messages to new chat)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Get original chat with messages
    const original = await db.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Create new chat with copied messages
    const forkedChat = await db.chat.create({
      data: {
        title: body.title?.trim() || `${original.title} (Fork)`,
        folderId: body.folderId !== undefined ? body.folderId : original.folderId,
        messages: {
          create: original.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls ?? undefined,
            toolName: msg.toolName,
          })),
        },
      },
      include: {
        folder: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(forkedChat, { status: 201 });
  } catch (error) {
    console.error('Failed to fork chat:', error);
    return NextResponse.json({ error: 'Failed to fork chat' }, { status: 500 });
  }
}
