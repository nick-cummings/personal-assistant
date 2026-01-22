import { handleOAuthCallback } from '@/lib/connectors/shared/oauth-handler';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, {
    connectorType: 'google-docs',
    displayName: 'Google Docs',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  });
}
