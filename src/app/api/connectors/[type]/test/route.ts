import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptJson } from '@/lib/utils/crypto';
import { createConnectorInstance } from '@/lib/connectors';
import { CONNECTOR_TYPES, type ConnectorType } from '@/types';

// Import connectors to ensure they're registered
import '@/lib/connectors';

interface RouteParams {
  params: Promise<{ type: string }>;
}

// POST /api/connectors/[type]/test - Test connector connection
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!CONNECTOR_TYPES.includes(type as ConnectorType)) {
      return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 });
    }

    const connectorType = type as ConnectorType;

    // Check if connector is configured
    const dbConnector = await db.connector.findUnique({
      where: { type: connectorType },
    });

    if (!dbConnector) {
      return NextResponse.json(
        { success: false, error: 'Connector not configured' },
        { status: 400 }
      );
    }

    // Create connector instance and test
    const connector = await createConnectorInstance(connectorType);

    if (!connector) {
      return NextResponse.json(
        { success: false, error: 'Failed to create connector instance' },
        { status: 500 }
      );
    }

    const result = await connector.testConnection();

    // Update lastHealthy if successful
    if (result.success) {
      await db.connector.update({
        where: { type: connectorType },
        data: { lastHealthy: new Date() },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to test connector:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test connector',
      },
      { status: 500 }
    );
  }
}
