import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateUserContextRequest } from '@/types';

const CONTEXT_ID = 'singleton';

const DEFAULT_CONTEXT = `# About Me

<!-- Edit this section with information about yourself -->
- Name:
- Role:
- Team:

# Key Identifiers

<!-- These help the AI find your stuff across services -->
- GitHub username:
- Jira assignee name:
- Email address:

# Projects & Repositories

<!-- List the repos, Jira projects, and AWS resources you work with most -->

# Preferences

<!-- How do you like responses? Any specific formatting preferences? -->
- Preferred response style: concise / detailed
- Timezone:
`;

// GET /api/context - Get user context document
export async function GET() {
  try {
    let context = await db.userContext.findUnique({
      where: { id: CONTEXT_ID },
    });

    // Create default context if not exist
    if (!context) {
      context = await db.userContext.create({
        data: {
          id: CONTEXT_ID,
          content: DEFAULT_CONTEXT,
        },
      });
    }

    return NextResponse.json(context);
  } catch (error) {
    console.error('Failed to fetch user context:', error);
    return NextResponse.json({ error: 'Failed to fetch user context' }, { status: 500 });
  }
}

// PUT /api/context - Update user context document
export async function PUT(request: NextRequest) {
  try {
    const body: UpdateUserContextRequest = await request.json();

    if (body.content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const context = await db.userContext.upsert({
      where: { id: CONTEXT_ID },
      update: {
        content: body.content,
      },
      create: {
        id: CONTEXT_ID,
        content: body.content,
      },
    });

    return NextResponse.json(context);
  } catch (error) {
    console.error('Failed to update user context:', error);
    return NextResponse.json({ error: 'Failed to update user context' }, { status: 500 });
  }
}
