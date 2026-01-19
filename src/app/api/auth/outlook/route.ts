import { NextRequest } from 'next/server';
import { handleOAuthInitExtended } from '@/lib/connectors/shared/oauth-handler';
import { getOutlookAuthUrl } from '@/lib/connectors/outlook/client';
import type { OutlookConfig } from '@/lib/connectors/types';

export async function GET(request: NextRequest) {
  return handleOAuthInitExtended<OutlookConfig>(request, {
    connectorType: 'outlook',
    displayName: 'Outlook',
    buildAuthUrl: getOutlookAuthUrl,
  });
}
