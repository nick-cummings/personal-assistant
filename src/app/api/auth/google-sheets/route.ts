import { getGoogleSheetsAuthUrl } from '@/lib/connectors/google-sheets/client';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-sheets',
    displayName: 'Google Sheets',
    buildAuthUrl: getGoogleSheetsAuthUrl,
  });
}
