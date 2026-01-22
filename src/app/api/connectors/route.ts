import { getAllConnectorMetadata } from '@/lib/connectors';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/connectors - List all connectors with status
export async function GET() {
  try {
    // Get all connector metadata
    const metadata = getAllConnectorMetadata();

    // Get configured connectors from DB
    const dbConnectors = await db.connector.findMany();
    const configuredMap = new Map(dbConnectors.map((c) => [c.type, c]));

    // Build response with status for each connector type
    const connectors = metadata.map((meta) => {
      const configured = configuredMap.get(meta.type);

      return {
        type: meta.type,
        name: meta.name,
        description: meta.description,
        configured: !!configured,
        enabled: configured?.enabled ?? false,
        lastHealthy: configured?.lastHealthy ?? null,
      };
    });

    return NextResponse.json(connectors);
  } catch (error) {
    console.error('Failed to fetch connectors:', error);
    return NextResponse.json({ error: 'Failed to fetch connectors' }, { status: 500 });
  }
}
