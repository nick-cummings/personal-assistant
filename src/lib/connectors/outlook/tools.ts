import { tool } from 'ai';
import { z } from 'zod';
import { OutlookClient } from './client';
import type { ToolSet } from '../types';

export function createOutlookTools(client: OutlookClient): ToolSet {
  const outlook_search_emails = tool({
    description:
      'Search emails in Outlook using Microsoft Search. Can search by subject, sender, content, etc.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Search query (e.g., "from:john@example.com", "subject:meeting", "deployment failed")'
        ),
      folder: z
        .string()
        .optional()
        .describe('Folder ID to search in (use outlook_list_folders to get IDs)'),
      limit: z.number().optional().default(10).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, folder, limit }) => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Outlook not authorized. Please visit /api/auth/outlook to complete OAuth setup.',
        };
      }

      const messages = await client.searchEmails(query, folder, limit);

      return messages.map((msg) => ({
        id: msg.id,
        subject: msg.subject,
        from: {
          name: msg.from.emailAddress.name,
          email: msg.from.emailAddress.address,
        },
        to: msg.toRecipients.map((r) => ({
          name: r.emailAddress.name,
          email: r.emailAddress.address,
        })),
        preview: msg.bodyPreview,
        receivedAt: msg.receivedDateTime,
        isRead: msg.isRead,
        importance: msg.importance,
        hasAttachments: msg.hasAttachments,
        webLink: msg.webLink,
      }));
    },
  });

  const outlook_get_email = tool({
    description: 'Get the full content of a specific email by its ID.',
    inputSchema: z.object({
      messageId: z.string().describe('The ID of the email message'),
    }),
    execute: async ({ messageId }) => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Outlook not authorized. Please visit /api/auth/outlook to complete OAuth setup.',
        };
      }

      const msg = await client.getEmail(messageId);

      // Strip HTML for plain text content
      let bodyText = msg.bodyPreview;
      if (msg.body?.contentType === 'html') {
        bodyText = msg.body.content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (msg.body?.contentType === 'text') {
        bodyText = msg.body.content;
      }

      return {
        id: msg.id,
        subject: msg.subject,
        from: {
          name: msg.from.emailAddress.name,
          email: msg.from.emailAddress.address,
        },
        to: msg.toRecipients.map((r) => ({
          name: r.emailAddress.name,
          email: r.emailAddress.address,
        })),
        body: bodyText,
        receivedAt: msg.receivedDateTime,
        sentAt: msg.sentDateTime,
        isRead: msg.isRead,
        importance: msg.importance,
        hasAttachments: msg.hasAttachments,
        webLink: msg.webLink,
      };
    },
  });

  const outlook_list_folders = tool({
    description: 'List all mail folders in Outlook. Returns folder names, IDs, and unread counts.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Outlook not authorized. Please visit /api/auth/outlook to complete OAuth setup.',
        };
      }

      const folders = await client.listFolders();

      return folders.map((folder) => ({
        id: folder.id,
        name: folder.displayName,
        unreadCount: folder.unreadItemCount,
        totalCount: folder.totalItemCount,
        hasSubfolders: folder.childFolderCount > 0,
      }));
    },
  });

  const outlook_get_calendar_events = tool({
    description: 'Get calendar events within a date range from Outlook calendar.',
    inputSchema: z.object({
      startDate: z
        .string()
        .describe('Start date in ISO format (e.g., "2024-01-15" or "2024-01-15T09:00:00")'),
      endDate: z
        .string()
        .describe('End date in ISO format (e.g., "2024-01-22" or "2024-01-22T17:00:00")'),
    }),
    execute: async ({ startDate, endDate }) => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Outlook not authorized. Please visit /api/auth/outlook to complete OAuth setup.',
        };
      }

      const events = await client.getCalendarEvents(startDate, endDate);

      return events.map((event) => ({
        id: event.id,
        subject: event.subject,
        preview: event.bodyPreview,
        start: event.start.dateTime,
        end: event.end.dateTime,
        timeZone: event.start.timeZone,
        location: event.location?.displayName,
        organizer: {
          name: event.organizer.emailAddress.name,
          email: event.organizer.emailAddress.address,
        },
        attendees: event.attendees.map((a) => ({
          name: a.emailAddress.name,
          email: a.emailAddress.address,
          response: a.status.response,
        })),
        isOnlineMeeting: event.isOnlineMeeting,
        onlineMeetingUrl: event.onlineMeetingUrl,
        webLink: event.webLink,
      }));
    },
  });

  return {
    outlook_search_emails,
    outlook_get_email,
    outlook_list_folders,
    outlook_get_calendar_events,
  };
}
