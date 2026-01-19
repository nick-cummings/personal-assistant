import { tool } from 'ai';
import { z } from 'zod';
import { ConfluenceClient } from './client';
import type { ToolSet } from '../types';

export function createConfluenceTools(client: ConfluenceClient): ToolSet {
  const confluence_list_spaces = tool({
    description: 'List available Confluence spaces that the user has access to.',
    inputSchema: z.object({}),
    execute: async () => {
      const spaces = await client.listSpaces();

      return spaces.map((space) => ({
        id: space.id,
        key: space.key,
        name: space.name,
        type: space.type,
        status: space.status,
        url: `https://${client.host}/wiki${space._links.webui}`,
      }));
    },
  });

  const confluence_search = tool({
    description:
      'Search Confluence pages and content using text search. Returns matching pages with excerpts.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Search query text (e.g., "deployment guide", "API documentation")'),
      spaceKey: z
        .string()
        .optional()
        .describe('Limit search to a specific space key (e.g., "DEV", "OPS")'),
      limit: z.number().optional().default(10).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, spaceKey, limit }) => {
      const results = await client.search(query, spaceKey, limit);

      return {
        totalResults: results.totalSize,
        pages: results.results.map((r) => ({
          id: r.content.id,
          title: r.content.title,
          spaceKey: r.content.spaceId,
          excerpt: r.excerpt,
          lastModified: r.lastModified,
          url: `https://${client.host}/wiki${r.content._links.webui}`,
        })),
      };
    },
  });

  const confluence_get_page = tool({
    description: 'Get the full content of a Confluence page by its ID.',
    inputSchema: z.object({
      pageId: z.string().describe('The ID of the page to retrieve'),
    }),
    execute: async ({ pageId }) => {
      const page = await client.getPage(pageId);

      return {
        id: page.id,
        title: page.title,
        spaceId: page.spaceId,
        status: page.status,
        version: page.version.number,
        lastModified: page.version.createdAt,
        content: page.bodyContent,
        url: `https://${client.host}/wiki${page._links.webui}`,
        editUrl: page._links.editui
          ? `https://${client.host}/wiki${page._links.editui}`
          : undefined,
      };
    },
  });

  const confluence_get_page_children = tool({
    description: 'Get child pages of a specific Confluence page.',
    inputSchema: z.object({
      pageId: z.string().describe('The ID of the parent page'),
    }),
    execute: async ({ pageId }) => {
      const children = await client.getPageChildren(pageId);

      return children.map((child) => ({
        id: child.id,
        title: child.title,
        status: child.status,
        lastModified: child.version.createdAt,
        url: `https://${client.host}/wiki${child._links.webui}`,
      }));
    },
  });

  return {
    confluence_list_spaces,
    confluence_search,
    confluence_get_page,
    confluence_get_page_children,
  };
}
