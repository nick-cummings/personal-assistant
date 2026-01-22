import { getGoogleCalendarAuthUrl } from '@/lib/connectors/google-calendar/client';
import { handleOAuthInit } from '@/lib/connectors/shared/oauth-handler';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return handleOAuthInit(request, {
    connectorType: 'google-calendar',
    displayName: 'Google Calendar',
    buildAuthUrl: getGoogleCalendarAuthUrl,
  });
}
