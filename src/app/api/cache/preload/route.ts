import { NextResponse } from 'next/server';
import { preloadAllConnectorCaches, getCacheStatus } from '@/lib/cache';

/**
 * GET /api/cache/preload - Get cache preload status
 */
export async function GET() {
  try {
    const status = await getCacheStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get cache status:', error);
    return NextResponse.json(
      { error: 'Failed to get cache status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache/preload - Trigger cache preloading for all connectors
 */
export async function POST() {
  try {
    const results = await preloadAllConnectorCaches();

    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      fromCache: results.filter((r) => r.fromCache).length,
      results,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to preload cache:', error);
    return NextResponse.json(
      { error: 'Failed to preload cache' },
      { status: 500 }
    );
  }
}
