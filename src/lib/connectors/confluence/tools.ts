import { tool } from 'ai';
import { z } from 'zod';
import { ConfluenceClient } from './client';
import type { ToolSet } from '../types';

export function createConfluenceTools(client: ConfluenceClient): ToolSet {
  const confluence_list_spaces = tool({
    description:
      'List available Confluence spaces that the user has access to. Returns space ID, key, name, and URL. Use the space key with confluence_search to filter searches to a specific space.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[Confluence] confluence_list_spaces called');

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Calling client.listSpaces...');
        const spaces = await client.listSpaces();
        console.log('[Confluence] Found', spaces.length, 'spaces');

        return {
          count: spaces.length,
          spaces: spaces.map((space) => ({
            id: space.id,
            key: space.key,
            name: space.name,
            type: space.type,
            status: space.status,
            url: `https://${client.host}/wiki${space._links.webui}`,
          })),
        };
      } catch (error) {
        console.error('[Confluence] List spaces error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Confluence authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        return {
          error: `Failed to list Confluence spaces: ${message}`,
        };
      }
    },
  });

  const confluence_search = tool({
    description:
      'Search Confluence pages and content using text search. Returns matching pages with their IDs, titles, space keys, excerpts, and URLs. Use the page ID with confluence_get_page to retrieve the full content.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Search query text to find pages. Examples: "deployment guide", "API documentation", "onboarding process"'
        ),
      spaceKey: z
        .string()
        .optional()
        .describe(
          'Optional: Limit search to a specific space key (e.g., "DEV", "OPS", "HR"). Use confluence_list_spaces to find available space keys.'
        ),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of results to return (default: 10)'),
    }),
    execute: async ({ query, spaceKey, limit }) => {
      console.log('[Confluence] confluence_search called with:', { query, spaceKey, limit });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Calling client.search...');
        const results = await client.search(query, spaceKey, limit);
        console.log('[Confluence] Search returned', results.results.length, 'results');

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
      } catch (error) {
        console.error('[Confluence] Search error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Confluence authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        return {
          error: `Failed to search Confluence: ${message}`,
        };
      }
    },
  });

  const confluence_get_page = tool({
    description:
      'Get the full content of a Confluence page by its ID. Returns the page title, content (as plain text), version info, and URLs. Use confluence_search first to find page IDs.',
    inputSchema: z.object({
      pageId: z
        .string()
        .describe(
          'The numeric ID of the page to retrieve, as returned by confluence_search (e.g., "123456789")'
        ),
    }),
    execute: async ({ pageId }) => {
      console.log('[Confluence] confluence_get_page called with pageId:', pageId);

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Calling client.getPage...');
        const page = await client.getPage(pageId);
        console.log('[Confluence] Got page:', {
          id: page.id,
          title: page.title,
          contentLength: page.bodyContent?.length,
        });

        return {
          id: page.id,
          title: page.title,
          spaceId: page.spaceId,
          status: page.status,
          version: page.version.number,
          lastModified: page.version.createdAt,
          content: page.bodyContent,
          url: `https://${client.host}/wiki${page._links.webui}`,
          editUrl: page._links.editui ? `https://${client.host}/wiki${page._links.editui}` : undefined,
        };
      } catch (error) {
        console.error('[Confluence] Get page error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Confluence authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Page with ID "${pageId}" was not found. It may have been deleted or you may not have access.`,
          };
        }
        return {
          error: `Failed to get Confluence page: ${message}`,
        };
      }
    },
  });

  const confluence_get_page_children = tool({
    description:
      'Get child pages of a specific Confluence page. Useful for navigating page hierarchies. Returns page IDs, titles, and URLs of all direct children.',
    inputSchema: z.object({
      pageId: z
        .string()
        .describe('The numeric ID of the parent page whose children you want to list'),
    }),
    execute: async ({ pageId }) => {
      console.log('[Confluence] confluence_get_page_children called with pageId:', pageId);

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Calling client.getPageChildren...');
        const children = await client.getPageChildren(pageId);
        console.log('[Confluence] Found', children.length, 'child pages');

        return {
          count: children.length,
          children: children.map((child) => ({
            id: child.id,
            title: child.title,
            status: child.status,
            lastModified: child.version?.createdAt ?? '',
            url: `https://${client.host}/wiki${child._links.webui}`,
          })),
        };
      } catch (error) {
        console.error('[Confluence] Get page children error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Confluence authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Page with ID "${pageId}" was not found. It may have been deleted or you may not have access.`,
          };
        }
        return {
          error: `Failed to get child pages: ${message}`,
        };
      }
    },
  });

  const confluence_list_drafts = tool({
    description:
      'List draft (unpublished) pages in Confluence. Drafts are pages that have been created but not yet published. Returns page IDs, titles, space keys, and URLs. Note: Uses deprecated REST API v1 as v2 does not support draft pages.',
    inputSchema: z.object({
      spaceKey: z
        .string()
        .optional()
        .describe(
          'Optional: Limit to drafts in a specific space key (e.g., "DEV", "OPS"). Use confluence_list_spaces to find available space keys.'
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of results to return (default: 20)'),
    }),
    execute: async ({ spaceKey, limit }) => {
      console.log('[Confluence] confluence_list_drafts called with:', { spaceKey, limit });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Calling client.listDraftPages...');
        const results = await client.listDraftPages(spaceKey, limit);
        console.log('[Confluence] Found', results.results.length, 'draft pages');

        return {
          totalResults: results.totalSize,
          drafts: results.results.map((r) => ({
            id: r.content.id,
            title: r.content.title,
            spaceKey: r.content.spaceId,
            status: r.content.status,
            lastModified: r.lastModified,
            url: `https://${client.host}/wiki${r.content._links.webui}`,
          })),
        };
      } catch (error) {
        console.error('[Confluence] List drafts error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Confluence authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        return {
          error: `Failed to list Confluence drafts: ${message}`,
        };
      }
    },
  });

  return {
    confluence_list_spaces,
    confluence_search,
    confluence_get_page,
    confluence_get_page_children,
    confluence_list_drafts,
  };
}
