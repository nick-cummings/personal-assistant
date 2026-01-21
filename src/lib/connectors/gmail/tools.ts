import { tool } from 'ai';
import { z } from 'zod';
import type { GmailImapClient } from './client';
import type { ToolSet } from '../types';

export function createGmailTools(client: GmailImapClient): ToolSet {
  return {
    gmail_search_emails: tool({
      description:
        'Search for emails in Gmail. Returns a list of emails with their numeric IDs, subjects, senders, dates, and snippets. Use the returned numeric ID (e.g., "46161") with gmail_get_email to retrieve the full email body.',
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
        console.log('[Gmail] gmail_search_emails called with:', { query, maxResults });

        if (!client.hasCredentials()) {
          console.log('[Gmail] No credentials configured');
          return {
            error: 'Gmail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          console.log('[Gmail] Calling client.searchEmails...');
          const emails = await client.searchEmails(query, maxResults);
          console.log('[Gmail] Search returned', emails.length, 'emails');
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
              labels: email.labels,
            })),
          };
        } catch (error) {
          console.error('[Gmail] Search error:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('Authentication') || message.includes('auth') || message.includes('Invalid credentials')) {
            return {
              error: 'Gmail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Google password).',
            };
          }
          return {
            error: `Failed to search Gmail: ${message}`,
          };
        }
      },
    }),

    gmail_get_email: tool({
      description:
        'Get the full content of a specific email from Gmail, including the complete body text. IMPORTANT: You must first use gmail_search_emails or gmail_get_folder_emails to get valid numeric message IDs. The messageId must be a numeric string like "46161", not a base64 or alphanumeric ID.',
      inputSchema: z.object({
        messageId: z
          .string()
          .describe(
            'The numeric ID of the email as returned by gmail_search_emails or gmail_get_folder_emails. Must be a numeric string like "46161" or "12345". Do NOT use alphanumeric IDs.'
          ),
      }),
      execute: async ({ messageId }) => {
        console.log('[Gmail] gmail_get_email called with messageId:', messageId);

        // Validate that messageId is numeric (IMAP UID format)
        if (!/^\d+$/.test(messageId)) {
          console.log('[Gmail] Invalid messageId format (not numeric):', messageId);
          return {
            error: `Invalid email ID format: "${messageId}". The messageId must be a numeric ID (e.g., "12345") as returned by gmail_search_emails. Please search for emails first to get valid IDs.`,
          };
        }

        if (!client.hasCredentials()) {
          console.log('[Gmail] No credentials configured');
          return {
            error: 'Gmail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          console.log('[Gmail] Calling client.getEmail...');
          const email = await client.getEmail(messageId);
          console.log('[Gmail] Got email:', { id: email.id, subject: email.subject, bodyLength: email.body?.length });
          return {
            id: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            body: email.body,
            isRead: email.isRead,
            hasAttachments: email.hasAttachments,
            labels: email.labels,
          };
        } catch (error) {
          console.error('[Gmail] Get email error:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          const stack = error instanceof Error ? error.stack : '';
          console.error('[Gmail] Error details:', { message, stack });

          if (message.includes('Authentication') || message.includes('auth') || message.includes('Invalid credentials')) {
            return {
              error: 'Gmail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Google password).',
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

    gmail_list_labels: tool({
      description:
        'List all mail folders and labels in Gmail (e.g., INBOX, Sent Mail, Drafts, custom labels). Returns the folder ID (use with gmail_get_folder_emails), name, total message count, and unread count for each folder.',
      inputSchema: z.object({}),
      execute: async () => {
        console.log('[Gmail] gmail_list_labels called');

        if (!client.hasCredentials()) {
          console.log('[Gmail] No credentials configured');
          return {
            error: 'Gmail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          console.log('[Gmail] Calling client.listLabels...');
          const labels = await client.listLabels();
          console.log('[Gmail] Found', labels.length, 'labels');
          return {
            count: labels.length,
            labels: labels.map((label) => ({
              id: label.id,
              name: label.name,
              messageCount: label.messageCount,
              unreadCount: label.unreadCount,
            })),
          };
        } catch (error) {
          console.error('[Gmail] List labels error:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('Authentication') || message.includes('auth') || message.includes('Invalid credentials')) {
            return {
              error: 'Gmail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Google password).',
            };
          }
          return {
            error: `Failed to list labels: ${message}`,
          };
        }
      },
    }),

    gmail_get_folder_emails: tool({
      description:
        'Get emails from a specific Gmail folder or label. Returns emails with their numeric IDs (use with gmail_get_email to get full content). Use gmail_list_labels first to discover available folder IDs.',
      inputSchema: z.object({
        folderId: z
          .string()
          .describe(
            'The folder ID to get emails from. Common values: "INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts", "[Gmail]/Spam", "[Gmail]/Trash", "[Gmail]/All Mail", or custom label names like "Work" or "Personal"'
          ),
        maxResults: z
          .number()
          .optional()
          .default(20)
          .describe('Maximum number of emails to return (default: 20)'),
      }),
      execute: async ({ folderId, maxResults }) => {
        console.log('[Gmail] gmail_get_folder_emails called with:', { folderId, maxResults });

        if (!client.hasCredentials()) {
          console.log('[Gmail] No credentials configured');
          return {
            error: 'Gmail not configured. Please add your email and app password in Settings → Connectors.',
          };
        }

        try {
          console.log('[Gmail] Calling client.getEmailsInFolder...');
          const emails = await client.getEmailsInFolder(folderId, maxResults);
          console.log('[Gmail] Found', emails.length, 'emails in folder');
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
              labels: email.labels,
            })),
          };
        } catch (error) {
          console.error('[Gmail] Get folder emails error:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (message.includes('Authentication') || message.includes('auth') || message.includes('Invalid credentials')) {
            return {
              error: 'Gmail authentication failed. Please check your app password in Settings → Connectors. Make sure you are using an App Password (not your regular Google password).',
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
