import { tool } from 'ai';
import { z } from 'zod';
import type { GoogleDriveClient } from './client';
import type { ToolSet } from '../types';

export function createGoogleDriveTools(client: GoogleDriveClient): ToolSet {
  return {
    google_drive_list_files: tool({
      description: 'List files in Google Drive, optionally filtered by query or folder',
      inputSchema: z.object({
        query: z.string().optional().describe('Search query to filter files by name or content'),
        folderId: z.string().optional().describe('ID of folder to list files from'),
        maxResults: z.number().optional().default(20).describe('Maximum number of results'),
      }),
      execute: async ({ query, folderId, maxResults }) => {
        const result = await client.listFiles(query, maxResults, folderId);
        return {
          count: result.files.length,
          files: result.files.map((file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType,
            size: file.size,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            owner: file.owners?.[0]?.displayName,
          })),
          hasMore: !!result.nextPageToken,
        };
      },
    }),

    google_drive_get_file: tool({
      description: 'Get details of a specific file in Google Drive',
      inputSchema: z.object({
        fileId: z.string().describe('The ID of the file to retrieve'),
      }),
      execute: async ({ fileId }) => {
        const file = await client.getFile(fileId);
        return {
          id: file.id,
          name: file.name,
          type: file.mimeType,
          size: file.size,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          owners: file.owners?.map((o) => ({ name: o.displayName, email: o.emailAddress })),
        };
      },
    }),

    google_drive_get_file_content: tool({
      description: 'Get the text content of a file in Google Drive (works with Google Docs, Sheets, text files)',
      inputSchema: z.object({
        fileId: z.string().describe('The ID of the file to read'),
      }),
      execute: async ({ fileId }) => {
        const content = await client.getFileContent(fileId);
        return {
          content: content.substring(0, 50000), // Limit content size
          truncated: content.length > 50000,
        };
      },
    }),

    google_drive_list_folders: tool({
      description: 'List folders in Google Drive',
      inputSchema: z.object({
        parentId: z.string().optional().describe('ID of parent folder (omit for root)'),
      }),
      execute: async ({ parentId }) => {
        const folders = await client.listFolders(parentId);
        return {
          count: folders.length,
          folders: folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
          })),
        };
      },
    }),

    google_drive_search: tool({
      description: 'Search for files in Google Drive by content',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        fileType: z.enum(['document', 'spreadsheet', 'presentation', 'pdf', 'any']).optional()
          .describe('Filter by file type'),
      }),
      execute: async ({ query, fileType }) => {
        let mimeType: string | undefined;
        switch (fileType) {
          case 'document':
            mimeType = 'application/vnd.google-apps.document';
            break;
          case 'spreadsheet':
            mimeType = 'application/vnd.google-apps.spreadsheet';
            break;
          case 'presentation':
            mimeType = 'application/vnd.google-apps.presentation';
            break;
          case 'pdf':
            mimeType = 'application/pdf';
            break;
        }

        const files = await client.searchFiles(query, mimeType);
        return {
          count: files.length,
          files: files.map((file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
          })),
        };
      },
    }),
  };
}
