import { db } from '@/lib/db';
import type { UpdateSettingsRequest } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const SETTINGS_ID = 'singleton';

// GET /api/settings - Get app settings
export async function GET() {
  try {
    let settings = await db.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    // Create default settings if not exist
    if (!settings) {
      settings = await db.settings.create({
        data: {
          id: SETTINGS_ID,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PATCH /api/settings - Update app settings
export async function PATCH(request: NextRequest) {
  try {
    const body: UpdateSettingsRequest = await request.json();

    const settings = await db.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        ...(body.selectedModel !== undefined && { selectedModel: body.selectedModel }),
        ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        ...(body.sidebarCollapsed !== undefined && { sidebarCollapsed: body.sidebarCollapsed }),
      },
      create: {
        id: SETTINGS_ID,
        ...(body.selectedModel !== undefined && { selectedModel: body.selectedModel }),
        ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        ...(body.sidebarCollapsed !== undefined && { sidebarCollapsed: body.sidebarCollapsed }),
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
