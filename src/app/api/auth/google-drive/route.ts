import { getGoogleDriveAuthUrl } from '@/lib/connectors/google-drive/client';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-drive',
    displayName: 'Google Drive',
    buildAuthUrl: getGoogleDriveAuthUrl,
  });
}
