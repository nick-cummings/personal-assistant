import { tool } from 'ai';
import { z } from 'zod';
import type { YahooClient } from './client';
import type { ToolSet } from '../types';

export function createYahooTools(client: YahooClient): ToolSet {
  return {
    yahoo_search_emails: tool({
      description: 'Search for emails in Yahoo Mail',
      inputSchema: z.object({
        query: z.string().describe('Search query (supports Yahoo Mail search syntax)'),
        maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
      }),
      execute: async ({ query, maxResults }) => {
        const emails = await client.searchEmails(query, maxResults);
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
      },
    }),

    yahoo_get_email: tool({
      description: 'Get full details of a specific email from Yahoo Mail',
      inputSchema: z.object({
        messageId: z.string().describe('The ID of the email to retrieve'),
      }),
      execute: async ({ messageId }) => {
        const email = await client.getEmail(messageId);
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
      },
    }),

    yahoo_list_folders: tool({
      description: 'List all mail folders in Yahoo Mail',
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),

    yahoo_get_folder_emails: tool({
      description: 'Get emails from a specific Yahoo Mail folder',
      inputSchema: z.object({
        folderId: z.string().describe('The ID of the folder to get emails from'),
        maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
      }),
      execute: async ({ folderId, maxResults }) => {
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
      },
    }),
  };
}
