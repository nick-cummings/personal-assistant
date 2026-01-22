import { handleOAuthCallback } from '@/lib/connectors/shared/oauth-handler';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, {
    connectorType: 'google-drive',
    displayName: 'Google Drive',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  });
}
