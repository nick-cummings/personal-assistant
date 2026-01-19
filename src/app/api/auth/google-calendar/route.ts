import { NextRequest } from 'next/server';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { getGoogleCalendarAuthUrl } from '@/lib/connectors/google-calendar/client';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-calendar',
    displayName: 'Google Calendar',
    buildAuthUrl: getGoogleCalendarAuthUrl,
  });
}
