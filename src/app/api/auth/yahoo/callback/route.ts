import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/connectors/shared/oauth-handler';

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, {
    connectorType: 'yahoo',
    displayName: 'Yahoo Mail',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    useBasicAuth: true,
  });
}
