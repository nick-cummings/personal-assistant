import { getConfigFields, getConnectorMetadata } from '@/lib/connectors';
import { db } from '@/lib/db';
import { decryptJson, encryptJson } from '@/lib/utils/crypto';
import { CONNECTOR_TYPES, type ConnectorType } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ type: string }>;
}

// GET /api/connectors/[type] - Get connector config (fields only, not values)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!CONNECTOR_TYPES.includes(type as ConnectorType)) {
      return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 });
    }

    const connectorType = type as ConnectorType;
    const metadata = getConnectorMetadata(connectorType);
    const dbConnector = await db.connector.findUnique({
      where: { type: connectorType },
    });

    // Return metadata and current config (with sensitive values masked)
    const maskedConfig: Record<string, string> = {};
    if (dbConnector) {
      try {
        const config = decryptJson<Record<string, string>>(dbConnector.config);
        // Mask sensitive values
        const configFields = getConfigFields(connectorType);
        for (const field of configFields) {
          if (config[field.key]) {
            maskedConfig[field.key] = field.type === 'password' ? '••••••••' : config[field.key];
          }
        }
      } catch {
        // Config decryption failed, return empty
      }
    }

    return NextResponse.json({
      type: metadata.type,
      name: metadata.name,
      description: metadata.description,
      configFields: metadata.configFields,
      configured: !!dbConnector,
      enabled: dbConnector?.enabled ?? false,
      config: maskedConfig,
    });
  } catch (error) {
    console.error('Failed to fetch connector:', error);
    return NextResponse.json({ error: 'Failed to fetch connector' }, { status: 500 });
  }
}

// PUT /api/connectors/[type] - Update connector config
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!CONNECTOR_TYPES.includes(type as ConnectorType)) {
      return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 });
    }

    const connectorType = type as ConnectorType;
    const body = await request.json();
    const { config, enabled } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Config is required' }, { status: 400 });
    }

    // Validate required fields
    const configFields = getConfigFields(connectorType);
    for (const field of configFields) {
      if (field.required && !config[field.key]) {
        return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
      }
    }

    // Get existing config to merge (for partial updates)
    const existingConnector = await db.connector.findUnique({
      where: { type: connectorType },
    });

    let finalConfig = config;
    if (existingConnector) {
      try {
        const existingConfig = decryptJson<Record<string, string>>(existingConnector.config);
        // Merge: keep existing values for password fields that weren't changed
        finalConfig = { ...existingConfig };
        for (const [key, value] of Object.entries(config)) {
          // Don't overwrite with masked value
          if (value !== '••••••••' && value !== '') {
            finalConfig[key] = value;
          }
        }
      } catch {
        // Couldn't decrypt existing, use new config entirely
      }
    }

    // Encrypt and save
    const encryptedConfig = encryptJson(finalConfig);
    const metadata = getConnectorMetadata(connectorType);

    const connector = await db.connector.upsert({
      where: { type: connectorType },
      update: {
        config: encryptedConfig,
        enabled: enabled ?? existingConnector?.enabled ?? true,
      },
      create: {
        type: connectorType,
        name: metadata.name,
        config: encryptedConfig,
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json({
      type: connector.type,
      name: connector.name,
      configured: true,
      enabled: connector.enabled,
    });
  } catch (error) {
    console.error('Failed to update connector:', error);
    return NextResponse.json({ error: 'Failed to update connector' }, { status: 500 });
  }
}

// DELETE /api/connectors/[type] - Remove connector config
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;

    if (!CONNECTOR_TYPES.includes(type as ConnectorType)) {
      return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 });
    }

    const connectorType = type as ConnectorType;

    await db.connector.delete({
      where: { type: connectorType },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Ignore if not found
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ success: true });
    }
    console.error('Failed to delete connector:', error);
    return NextResponse.json({ error: 'Failed to delete connector' }, { status: 500 });
  }
}
