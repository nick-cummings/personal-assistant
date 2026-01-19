import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/connectors/shared/oauth-handler';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, {
    connectorType: 'google-calendar',
    displayName: 'Google Calendar',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  });
}
