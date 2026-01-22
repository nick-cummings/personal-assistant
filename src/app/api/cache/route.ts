import { cleanupExpiredCache, getCacheStats } from '@/lib/cache';
import { NextResponse } from 'next/server';

/**
 * GET /api/cache - Get cache statistics
 */
export async function GET() {
  try {
    const stats = await getCacheStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return NextResponse.json({ error: 'Failed to get cache statistics' }, { status: 500 });
  }
}

/**
 * DELETE /api/cache - Cleanup expired cache entries
 */
export async function DELETE() {
  try {
    const count = await cleanupExpiredCache();
    return NextResponse.json({ cleaned: count });
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
    return NextResponse.json({ error: 'Failed to cleanup cache' }, { status: 500 });
  }
}
