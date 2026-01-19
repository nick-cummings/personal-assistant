import { NextRequest } from 'next/server';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { getGoogleSheetsAuthUrl } from '@/lib/connectors/google-sheets/client';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-sheets',
    displayName: 'Google Sheets',
    buildAuthUrl: getGoogleSheetsAuthUrl,
  });
}
