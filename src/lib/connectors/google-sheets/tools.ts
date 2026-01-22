import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../types';
import type { GoogleSheetsClient } from './client';

export function createGoogleSheetsTools(client: GoogleSheetsClient): ToolSet {
  return {
    google_sheets_list: tool({
      description: 'List Google Sheets spreadsheets',
      inputSchema: z.object({
        query: z.string().optional().describe('Search query to filter spreadsheets by name'),
        maxResults: z.number().optional().default(20).describe('Maximum number of results'),
      }),
      execute: async ({ query, maxResults }) => {
        const sheets = await client.listSpreadsheets(query, maxResults);
        return {
          count: sheets.length,
          spreadsheets: sheets.map((sheet) => ({
            id: sheet.id,
            name: sheet.name,
            modifiedTime: sheet.modifiedTime,
            webViewLink: sheet.webViewLink,
          })),
        };
      },
    }),

    google_sheets_get_info: tool({
      description: 'Get information about a Google Sheets spreadsheet including its sheets',
      inputSchema: z.object({
        spreadsheetId: z.string().describe('The ID of the spreadsheet'),
      }),
      execute: async ({ spreadsheetId }) => {
        const spreadsheet = await client.getSpreadsheet(spreadsheetId);
        return {
          id: spreadsheet.spreadsheetId,
          title: spreadsheet.properties.title,
          url: spreadsheet.spreadsheetUrl,
          sheets: spreadsheet.sheets.map((sheet) => ({
            id: sheet.properties.sheetId,
            title: sheet.properties.title,
            index: sheet.properties.index,
            rowCount: sheet.properties.gridProperties?.rowCount,
            columnCount: sheet.properties.gridProperties?.columnCount,
          })),
        };
      },
    }),

    google_sheets_get_values: tool({
      description: 'Get cell values from a specific range in a Google Sheet',
      inputSchema: z.object({
        spreadsheetId: z.string().describe('The ID of the spreadsheet'),
        range: z.string().describe('The A1 notation range to retrieve (e.g., "Sheet1!A1:D10")'),
      }),
      execute: async ({ spreadsheetId, range }) => {
        const values = await client.getSheetValues(spreadsheetId, range);
        return {
          range,
          rowCount: values.length,
          values,
        };
      },
    }),

    google_sheets_get_as_table: tool({
      description: 'Get a sheet as a table with headers (first row becomes column names)',
      inputSchema: z.object({
        spreadsheetId: z.string().describe('The ID of the spreadsheet'),
        sheetName: z.string().describe('The name of the sheet'),
        maxRows: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of data rows to return'),
      }),
      execute: async ({ spreadsheetId, sheetName, maxRows }) => {
        const table = await client.getSheetAsTable(spreadsheetId, sheetName, maxRows);
        return {
          headers: table.headers,
          rowCount: table.rows.length,
          rows: table.rows,
        };
      },
    }),

    google_sheets_search: tool({
      description: 'Search for Google Sheets by content',
      inputSchema: z.object({
        query: z.string().describe('Search query to find in spreadsheet content'),
      }),
      execute: async ({ query }) => {
        const sheets = await client.searchSpreadsheets(query);
        return {
          count: sheets.length,
          spreadsheets: sheets.map((sheet) => ({
            id: sheet.id,
            name: sheet.name,
            modifiedTime: sheet.modifiedTime,
            webViewLink: sheet.webViewLink,
          })),
        };
      },
    }),
  };
}
