import { tool } from 'ai';
import { z } from 'zod';
import { GmailClient } from './client';
import type { ToolSet } from '../types';

export function createGmailTools(client: GmailClient): ToolSet {
  const gmail_search_emails = tool({
    description:
      'Search emails in Gmail using Gmail search syntax. Can search by sender, subject, content, labels, etc.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Gmail search query (e.g., "from:john@example.com", "subject:meeting", "is:unread", "label:work")'
        ),
      limit: z.number().optional().default(10).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, limit }) => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Gmail not authorized. Please visit /api/auth/gmail to complete OAuth setup.',
        };
      }

      const messages = await client.searchEmails(query, limit);

      return messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: GmailClient.getHeader(msg, 'Subject') ?? '(no subject)',
        from: GmailClient.getHeader(msg, 'From'),
        to: GmailClient.getHeader(msg, 'To'),
        date: GmailClient.getHeader(msg, 'Date'),
        snippet: msg.snippet,
        labels: msg.labelIds,
        webLink: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
      }));
    },
  });

  const gmail_get_email = tool({
    description: 'Get the full content of a specific email by its ID.',
    inputSchema: z.object({
      messageId: z.string().describe('The ID of the email message'),
    }),
    execute: async ({ messageId }) => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Gmail not authorized. Please visit /api/auth/gmail to complete OAuth setup.',
        };
      }

      const msg = await client.getEmail(messageId);
      const body = GmailClient.getPlainTextBody(msg);

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: GmailClient.getHeader(msg, 'Subject') ?? '(no subject)',
        from: GmailClient.getHeader(msg, 'From'),
        to: GmailClient.getHeader(msg, 'To'),
        cc: GmailClient.getHeader(msg, 'Cc'),
        date: GmailClient.getHeader(msg, 'Date'),
        body,
        labels: msg.labelIds,
        webLink: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
      };
    },
  });

  const gmail_list_labels = tool({
    description: 'List all Gmail labels (folders/categories). Returns label names and unread counts.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!client.hasRefreshToken()) {
        return {
          error: 'Gmail not authorized. Please visit /api/auth/gmail to complete OAuth setup.',
        };
      }

      const labels = await client.listLabels();

      return labels.map((label) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        messagesTotal: label.messagesTotal,
        messagesUnread: label.messagesUnread,
      }));
    },
  });

  return {
    gmail_search_emails,
    gmail_get_email,
    gmail_list_labels,
  };
}
