import { NextRequest } from 'next/server';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { getYahooAuthUrl } from '@/lib/connectors/yahoo/client';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'yahoo',
    displayName: 'Yahoo Mail',
    buildAuthUrl: getYahooAuthUrl,
  });
}
