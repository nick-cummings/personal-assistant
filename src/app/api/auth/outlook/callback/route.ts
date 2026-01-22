import { exchangeOutlookCode } from '@/lib/connectors/outlook/client';
import type { OutlookConfig } from '@/lib/connectors/types';
import { db } from '@/lib/db';
import { decryptJson, encryptJson } from '@/lib/utils/crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/settings/connectors?error=${encodeURIComponent(errorDescription || error)}`,
          url.origin
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/connectors?error=No%20authorization%20code%20received', url.origin)
      );
    }

    // Get the Outlook connector config
    const connector = await db.connector.findUnique({
      where: { type: 'outlook' },
    });

    if (!connector) {
      return NextResponse.redirect(
        new URL('/settings/connectors?error=Outlook%20connector%20not%20found', url.origin)
      );
    }

    const config = decryptJson<OutlookConfig>(connector.config);
    const redirectUri = `${url.origin}/api/auth/outlook/callback`;

    // Exchange the code for tokens
    const tokens = await exchangeOutlookCode(config, code, redirectUri);

    // Update the config with the refresh token
    config.refreshToken = tokens.refresh_token;

    await db.connector.update({
      where: { type: 'outlook' },
      data: {
        config: encryptJson(config),
        enabled: true,
        lastHealthy: new Date(),
      },
    });

    // Redirect back to connectors page with success message
    return NextResponse.redirect(
      new URL('/settings/connectors?success=Outlook%20connected%20successfully', url.origin)
    );
  } catch (error) {
    console.error('Outlook OAuth callback error:', error);
    const url = new URL(request.url);
    const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(errorMessage)}`, url.origin)
    );
  }
}
