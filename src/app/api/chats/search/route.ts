import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.trim().toLowerCase();

    // Search in chat titles and message content
    // Using SQLite's LIKE for simple text search
    const chats = await db.chat.findMany({
      where: {
        OR: [
          {
            title: {
              contains: searchTerm,
            },
          },
          {
            messages: {
              some: {
                content: {
                  contains: searchTerm,
                },
              },
            },
          },
        ],
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          where: {
            content: {
              contains: searchTerm,
            },
          },
          take: 3, // Return up to 3 matching messages per chat
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    // Format results with highlighted excerpts
    const results = chats.map((chat) => {
      // Get excerpt from matching messages
      const matchingMessages = chat.messages.map((msg) => {
        // Find the position of the search term and extract surrounding context
        const lowerContent = msg.content.toLowerCase();
        const matchIndex = lowerContent.indexOf(searchTerm);

        let excerpt = msg.content;
        if (matchIndex !== -1) {
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(msg.content.length, matchIndex + searchTerm.length + 50);
          excerpt =
            (start > 0 ? '...' : '') +
            msg.content.substring(start, end) +
            (end < msg.content.length ? '...' : '');
        } else if (msg.content.length > 150) {
          excerpt = msg.content.substring(0, 150) + '...';
        }

        return {
          id: msg.id,
          role: msg.role,
          excerpt,
          createdAt: msg.createdAt,
        };
      });

      return {
        id: chat.id,
        title: chat.title,
        folder: chat.folder,
        messageCount: chat._count.messages,
        updatedAt: chat.updatedAt,
        matchingMessages,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Chat search error:', error);
    return NextResponse.json({ error: 'Failed to search chats' }, { status: 500 });
  }
}
