import { getGoogleDocsAuthUrl } from '@/lib/connectors/google-docs/client';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-docs',
    displayName: 'Google Docs',
    buildAuthUrl: getGoogleDocsAuthUrl,
  });
}
