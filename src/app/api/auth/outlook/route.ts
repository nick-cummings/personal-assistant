import { getOutlookAuthUrl } from '@/lib/connectors/outlook/client';
import { handleOAuthInitExtended } from '@/lib/connectors/shared/oauth-handler';
import type { OutlookConfig } from '@/lib/connectors/types';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthInitExtended<OutlookConfig>(request, {
    connectorType: 'outlook',
    displayName: 'Outlook',
    buildAuthUrl: getOutlookAuthUrl,
  });
}
