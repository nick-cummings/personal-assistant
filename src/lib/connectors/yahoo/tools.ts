import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../types';
import type { YahooImapClient } from './client';

export function createYahooTools(client: YahooImapClient): ToolSet {
  return {
    yahoo_search_emails: tool({
      description:
        'Search for emails in Yahoo Mail. Returns a list of emails with their numeric IDs, subjects, senders, dates, and snippets. Use the returned numeric ID (e.g., "364833") with yahoo_get_email to retrieve the full email body.',
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            'Search query to find emails. Searches subject and body. Use empty string "" to get recent emails. Examples: "invoice", "from John", "meeting notes"'
          ),
        maxResults: z
          .number()
          .optional()
          .default(20)
          .describe('Maximum number of emails to return (default: 20)'),
      }),
      execute: async ({ query, maxResults }) => {
        console.log('[Yahoo] yahoo_search_emails called with:', { query, maxResults });

        if (!client.hasCredentials()) {
          console.log('[Yahoo] No credentials configured');
          return {
            error:
              'Yahoo Mail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          console.log('[Yahoo] Calling client.searchEmails...');
          const emails = await client.searchEmails(query, maxResults);
          console.log('[Yahoo] Search returned', emails.length, 'emails');
          return {
            count: emails.length,
            emails: emails.map((email) => ({
              id: email.id,
              subject: email.subject,
              from: email.from,
              date: email.date,
              snippet: email.snippet,
              isRead: email.isRead,
              hasAttachments: email.hasAttachments,
            })),
          };
        } catch (error) {
          console.error('[Yahoo] Search error:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('Authentication') || message.includes('auth')) {
            return {
              error:
                'Yahoo Mail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Yahoo password).',
            };
          }
          return {
            error: `Failed to search Yahoo Mail: ${message}`,
          };
        }
      },
    }),

    yahoo_get_email: tool({
      description:
        'Get the full content of a specific email from Yahoo Mail, including the complete body text. IMPORTANT: You must first use yahoo_search_emails or yahoo_get_folder_emails to get valid numeric message IDs. The messageId must be a numeric string like "364833", not a base64 or alphanumeric ID.',
      inputSchema: z.object({
        messageId: z
          .string()
          .describe(
            'The numeric ID of the email as returned by yahoo_search_emails or yahoo_get_folder_emails. Must be a numeric string like "364833" or "12345". Do NOT use alphanumeric IDs.'
          ),
      }),
      execute: async ({ messageId }) => {
        console.log('[Yahoo] yahoo_get_email called with messageId:', messageId);

        // Validate that messageId is numeric (IMAP UID format)
        if (!/^\d+$/.test(messageId)) {
          console.log('[Yahoo] Invalid messageId format (not numeric):', messageId);
          return {
            error: `Invalid email ID format: "${messageId}". The messageId must be a numeric ID (e.g., "364833") as returned by yahoo_search_emails. Please search for emails first to get valid IDs.`,
          };
        }

        if (!client.hasCredentials()) {
          console.log('[Yahoo] No credentials configured');
          return {
            error:
              'Yahoo Mail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          console.log('[Yahoo] Calling client.getEmail...');
          const email = await client.getEmail(messageId);
          console.log('[Yahoo] Got email:', {
            id: email.id,
            subject: email.subject,
            bodyLength: email.body?.length,
          });
          return {
            id: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            body: email.body,
            isRead: email.isRead,
            hasAttachments: email.hasAttachments,
          };
        } catch (error) {
          console.error('[Yahoo] Get email error:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          const stack = error instanceof Error ? error.stack : '';
          console.error('[Yahoo] Error details:', { message, stack });

          if (message.includes('Authentication') || message.includes('auth')) {
            return {
              error:
                'Yahoo Mail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Yahoo password).',
            };
          }
          if (message.includes('not found') || message.includes('Message not found')) {
            return {
              error: `Email with ID "${messageId}" was not found. It may have been deleted or moved.`,
            };
          }
          return {
            error: `Failed to get email: ${message}`,
          };
        }
      },
    }),

    yahoo_list_folders: tool({
      description:
        'List all mail folders in Yahoo Mail (e.g., Inbox, Sent, Drafts, Trash). Returns the folder ID (use with yahoo_get_folder_emails), name, total message count, and unread count for each folder.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!client.hasCredentials()) {
          return {
            error:
              'Yahoo Mail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          const folders = await client.listFolders();
          return {
            count: folders.length,
            folders: folders.map((folder) => ({
              id: folder.id,
              name: folder.name,
              messageCount: folder.messageCount,
              unreadCount: folder.unreadCount,
            })),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('Authentication') || message.includes('auth')) {
            return {
              error:
                'Yahoo Mail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Yahoo password).',
            };
          }
          return {
            error: `Failed to list folders: ${message}`,
          };
        }
      },
    }),

    yahoo_get_folder_emails: tool({
      description:
        'Get emails from a specific Yahoo Mail folder. Returns emails with their numeric IDs (use with yahoo_get_email to get full content). Use yahoo_list_folders first to discover available folder IDs.',
      inputSchema: z.object({
        folderId: z
          .string()
          .describe(
            'The folder ID to get emails from. Common values: "Inbox", "Sent", "Draft", "Trash", "Bulk" (spam), or custom folder names'
          ),
        maxResults: z
          .number()
          .optional()
          .default(20)
          .describe('Maximum number of emails to return (default: 20)'),
      }),
      execute: async ({ folderId, maxResults }) => {
        if (!client.hasCredentials()) {
          return {
            error:
              'Yahoo Mail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          const emails = await client.getEmailsInFolder(folderId, maxResults);
          return {
            count: emails.length,
            emails: emails.map((email) => ({
              id: email.id,
              subject: email.subject,
              from: email.from,
              date: email.date,
              snippet: email.snippet,
              isRead: email.isRead,
              hasAttachments: email.hasAttachments,
            })),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('Authentication') || message.includes('auth')) {
            return {
              error:
                'Yahoo Mail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Yahoo password).',
            };
          }
          return {
            error: `Failed to get emails from folder: ${message}`,
          };
        }
      },
    }),
  };
}
