import { NextRequest } from 'next/server';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { getGmailAuthUrl } from '@/lib/connectors/gmail/client';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'gmail',
    displayName: 'Gmail',
    buildAuthUrl: getGmailAuthUrl,
  });
}
