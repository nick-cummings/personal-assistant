import { NextRequest } from 'next/server';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { getGoogleDocsAuthUrl } from '@/lib/connectors/google-docs/client';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-docs',
    displayName: 'Google Docs',
    buildAuthUrl: getGoogleDocsAuthUrl,
  });
}
