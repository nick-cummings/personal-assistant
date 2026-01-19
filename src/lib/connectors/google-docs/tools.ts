import { tool } from 'ai';
import { z } from 'zod';
import type { GoogleDocsClient } from './client';
import type { ToolSet } from '../types';

export function createGoogleDocsTools(client: GoogleDocsClient): ToolSet {
  return {
    google_docs_list: tool({
      description: 'List Google Docs documents',
      inputSchema: z.object({
        query: z.string().optional().describe('Search query to filter documents by name'),
        maxResults: z.number().optional().default(20).describe('Maximum number of results'),
      }),
      execute: async ({ query, maxResults }) => {
        const docs = await client.listDocuments(query, maxResults);
        return {
          count: docs.length,
          documents: docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            modifiedTime: doc.modifiedTime,
            webViewLink: doc.webViewLink,
          })),
        };
      },
    }),

    google_docs_get: tool({
      description: 'Get the full text content of a Google Doc',
      inputSchema: z.object({
        documentId: z.string().describe('The ID of the document to retrieve'),
      }),
      execute: async ({ documentId }) => {
        const [doc, text] = await Promise.all([
          client.getDocument(documentId),
          client.getDocumentText(documentId),
        ]);
        return {
          id: doc.documentId,
          title: doc.title,
          content: text.substring(0, 50000),
          truncated: text.length > 50000,
        };
      },
    }),

    google_docs_search: tool({
      description: 'Search for Google Docs by content',
      inputSchema: z.object({
        query: z.string().describe('Search query to find in document content'),
      }),
      execute: async ({ query }) => {
        const docs = await client.searchDocuments(query);
        return {
          count: docs.length,
          documents: docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            modifiedTime: doc.modifiedTime,
            webViewLink: doc.webViewLink,
          })),
        };
      },
    }),
  };
}
