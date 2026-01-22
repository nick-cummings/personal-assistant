import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../types';
import { ConfluenceClient } from './client';

// Helper to get instance names for schema description
function getInstanceDescription(client: ConfluenceClient): string {
  const names = client.getInstanceNames();
  if (names.length === 0) return 'Instance name (no instances configured)';
  if (names.length === 1) return `Instance name. Available: "${names[0]}"`;
  return `Instance name. Available: ${names.map((n) => `"${n}"`).join(', ')}. Leave empty to query all instances.`;
}

export function createConfluenceTools(client: ConfluenceClient): ToolSet {
  const confluence_list_spaces = tool({
    description:
      'List available Confluence spaces that the user has access to. Returns space ID, key, name, and URL. Use the space key with confluence_search to filter searches to a specific space. When multiple Confluence instances are configured, queries all instances by default.',
    inputSchema: z.object({
      instance: z.string().optional().describe(getInstanceDescription(client)),
    }),
    execute: async ({ instance }) => {
      console.log('[Confluence] confluence_list_spaces called with:', { instance });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Querying instances for spaces...');
        const results = await client.queryAllInstances(
          (instanceClient) => instanceClient.listSpaces(),
          instance
        );

        if (results.length === 0) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Confluence instances configured.',
          };
        }

        // Flatten results from all instances
        const allSpaces: Array<{
          instance: string;
          host: string;
          id: number;
          key: string;
          name: string;
          type: string;
          status: string;
          url: string;
        }> = [];

        for (const { instance: instName, host, result } of results) {
          for (const space of result) {
            allSpaces.push({
              instance: instName,
              host,
              id: space.id,
              key: space.key,
              name: space.name,
              type: space.type,
              status: space.status,
              url: `https://${host}/wiki${space._links.webui}`,
            });
          }
        }

        console.log(
          '[Confluence] Found',
          allSpaces.length,
          'spaces across',
          results.length,
          'instances'
        );

        return {
          instancesQueried: results.map((r) => r.instance),
          count: allSpaces.length,
          spaces: allSpaces,
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
      'Search Confluence pages and content using text search. Supports date range filtering and multiple search terms in a single call. Returns matching pages with their IDs, titles, space keys, excerpts, and URLs. Use the page ID with confluence_get_page to retrieve the full content. When multiple Confluence instances are configured, queries all instances by default.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .default('')
        .describe(
          'Single search query text to find pages. Examples: "deployment guide", "API documentation". Ignored if "queries" is provided.'
        ),
      queries: z
        .array(z.string())
        .optional()
        .describe(
          'Multiple search terms to search for (OR logic). Use this to search for related terms in a single call. Example: ["runbook", "playbook", "procedure"] to find operational docs.'
        ),
      afterDate: z
        .string()
        .optional()
        .describe(
          'Only return pages modified on or after this date. Use ISO format: "2025-01-01" or "2025-12-22T00:00:00Z"'
        ),
      beforeDate: z
        .string()
        .optional()
        .describe(
          'Only return pages modified before this date. Use ISO format: "2025-02-01" or "2025-01-22T23:59:59Z"'
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
        .describe('Maximum number of results to return per instance (default: 10)'),
      instance: z.string().optional().describe(getInstanceDescription(client)),
    }),
    execute: async ({ query, queries, afterDate, beforeDate, spaceKey, limit, instance }) => {
      console.log(`[Confluence ${new Date().toISOString()}] confluence_search called with:`, {
        query,
        queries,
        afterDate,
        beforeDate,
        spaceKey,
        limit,
        instance,
      });

      if (!client.hasCredentials()) {
        console.log(`[Confluence ${new Date().toISOString()}] No credentials configured`);
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log(`[Confluence ${new Date().toISOString()}] Querying instances for search...`);
        const results = await client.queryAllInstances(
          (instanceClient) => instanceClient.search(query || '', spaceKey, limit, { afterDate, beforeDate, queries }),
          instance
        );

        if (results.length === 0) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Confluence instances configured.',
          };
        }

        // Flatten results from all instances
        const allPages: Array<{
          instance: string;
          host: string;
          id: string;
          title: string;
          spaceKey: string;
          excerpt: string;
          lastModified: string;
          url: string;
        }> = [];

        let totalSize = 0;
        for (const { instance: instName, host, result } of results) {
          totalSize += result.totalSize;
          for (const r of result.results) {
            allPages.push({
              instance: instName,
              host,
              id: r.content.id,
              title: r.content.title,
              spaceKey: r.content.spaceId,
              excerpt: r.excerpt,
              lastModified: r.lastModified,
              url: `https://${host}/wiki${r.content._links.webui}`,
            });
          }
        }

        console.log(
          '[Confluence] Search returned',
          allPages.length,
          'results across',
          results.length,
          'instances'
        );

        return {
          instancesQueried: results.map((r) => r.instance),
          totalResults: totalSize,
          pages: allPages,
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
      'Get the full content of a Confluence page by its ID. Returns the page title, content (as plain text), version info, and URLs. Use confluence_search first to find page IDs. When multiple Confluence instances are configured and no instance is specified, searches all instances for the page.',
    inputSchema: z.object({
      pageId: z
        .string()
        .describe(
          'The numeric ID of the page to retrieve, as returned by confluence_search (e.g., "123456789")'
        ),
      instance: z.string().optional().describe(getInstanceDescription(client)),
    }),
    execute: async ({ pageId, instance }) => {
      console.log('[Confluence] confluence_get_page called with:', { pageId, instance });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Querying instances for page...');
        const results = await client.queryAllInstances(async (instanceClient) => {
          try {
            return await instanceClient.getPage(pageId);
          } catch (e) {
            // Page not found in this instance - return null
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('404') || msg.includes('Not Found')) {
              return null;
            }
            throw e;
          }
        }, instance);

        // Find the first instance that has this page
        const found = results.find((r) => r.result !== null);

        if (!found || !found.result) {
          if (instance) {
            return {
              error: `Page with ID "${pageId}" was not found in instance "${instance}". It may have been deleted or you may not have access.`,
            };
          }
          return {
            error: `Page with ID "${pageId}" was not found in any configured Confluence instance. It may have been deleted or you may not have access.`,
          };
        }

        const page = found.result;
        console.log('[Confluence] Got page from instance:', found.instance, {
          id: page.id,
          title: page.title,
          contentLength: page.bodyContent?.length,
        });

        return {
          instance: found.instance,
          host: found.host,
          id: page.id,
          title: page.title,
          spaceId: page.spaceId,
          status: page.status,
          version: page.version.number,
          lastModified: page.version.createdAt,
          content: page.bodyContent,
          url: `https://${found.host}/wiki${page._links.webui}`,
          editUrl: page._links.editui
            ? `https://${found.host}/wiki${page._links.editui}`
            : undefined,
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
      'Get child pages of a specific Confluence page. Useful for navigating page hierarchies. Returns page IDs, titles, and URLs of all direct children. When multiple Confluence instances are configured and no instance is specified, searches all instances for the page.',
    inputSchema: z.object({
      pageId: z
        .string()
        .describe('The numeric ID of the parent page whose children you want to list'),
      instance: z.string().optional().describe(getInstanceDescription(client)),
    }),
    execute: async ({ pageId, instance }) => {
      console.log('[Confluence] confluence_get_page_children called with:', { pageId, instance });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Querying instances for page children...');
        const results = await client.queryAllInstances(async (instanceClient) => {
          try {
            return await instanceClient.getPageChildren(pageId);
          } catch (e) {
            // Page not found in this instance - return null
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('404') || msg.includes('Not Found')) {
              return null;
            }
            throw e;
          }
        }, instance);

        // Find the first instance that has this page
        const found = results.find((r) => r.result !== null);

        if (!found || !found.result) {
          if (instance) {
            return {
              error: `Page with ID "${pageId}" was not found in instance "${instance}". It may have been deleted or you may not have access.`,
            };
          }
          return {
            error: `Page with ID "${pageId}" was not found in any configured Confluence instance. It may have been deleted or you may not have access.`,
          };
        }

        const children = found.result;
        console.log(
          '[Confluence] Found',
          children.length,
          'child pages from instance:',
          found.instance
        );

        return {
          instance: found.instance,
          host: found.host,
          count: children.length,
          children: children.map((child) => ({
            id: child.id,
            title: child.title,
            status: child.status,
            lastModified: child.version?.createdAt ?? '',
            url: `https://${found.host}/wiki${child._links.webui}`,
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
      'List draft (unpublished) pages in Confluence. Drafts are pages that have been created but not yet published. Returns page IDs, titles, space keys, and URLs. Note: Uses deprecated REST API v1 as v2 does not support draft pages. When multiple Confluence instances are configured, queries all instances by default.',
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
        .describe('Maximum number of results to return per instance (default: 20)'),
      instance: z.string().optional().describe(getInstanceDescription(client)),
    }),
    execute: async ({ spaceKey, limit, instance }) => {
      console.log('[Confluence] confluence_list_drafts called with:', {
        spaceKey,
        limit,
        instance,
      });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Confluence] Querying instances for drafts...');
        const results = await client.queryAllInstances(
          (instanceClient) => instanceClient.listDraftPages(spaceKey, limit),
          instance
        );

        if (results.length === 0) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Confluence instances configured.',
          };
        }

        // Flatten results from all instances
        const allDrafts: Array<{
          instance: string;
          host: string;
          id: string;
          title: string;
          spaceKey: string;
          status: string;
          lastModified: string;
          url: string;
        }> = [];

        let totalSize = 0;
        for (const { instance: instName, host, result } of results) {
          totalSize += result.totalSize;
          for (const r of result.results) {
            allDrafts.push({
              instance: instName,
              host,
              id: r.content.id,
              title: r.content.title,
              spaceKey: r.content.spaceId,
              status: r.content.status,
              lastModified: r.lastModified,
              url: `https://${host}/wiki${r.content._links.webui}`,
            });
          }
        }

        console.log(
          '[Confluence] Found',
          allDrafts.length,
          'draft pages across',
          results.length,
          'instances'
        );

        return {
          instancesQueried: results.map((r) => r.instance),
          totalResults: totalSize,
          drafts: allDrafts,
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

  // Add a tool to list configured instances
  const confluence_list_instances = tool({
    description:
      'List all configured Confluence instances. Returns the instance names that can be used to filter other Confluence tools.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[Confluence] confluence_list_instances called');

      if (!client.hasCredentials()) {
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      const instances = client.getAllInstances();
      return {
        total: instances.length,
        instances: instances.map((inst) => ({
          name: inst.name,
          host: inst.host,
        })),
      };
    },
  });

  const confluence_create_draft = tool({
    description:
      'Create a new draft page in Confluence. The page will be saved as a draft (not published) so it can be reviewed and edited before publishing. Returns the page ID, title, and URLs for viewing and editing. Use confluence_list_spaces first to find the space ID where you want to create the page.',
    inputSchema: z.object({
      spaceId: z
        .string()
        .describe(
          'The ID of the space where the page should be created. Use confluence_list_spaces to find available space IDs.'
        ),
      title: z.string().describe('The title of the new page'),
      content: z
        .string()
        .optional()
        .describe(
          'Optional: The content of the page as plain text. Paragraphs should be separated by blank lines. If not provided, an empty page will be created.'
        ),
      parentId: z
        .string()
        .optional()
        .describe(
          'Optional: The ID of the parent page if this should be a child page. Use confluence_search or confluence_get_page_children to find parent page IDs.'
        ),
      instance: z.string().optional().describe(getInstanceDescription(client)),
    }),
    execute: async ({ spaceId, title, content, parentId, instance }) => {
      console.log('[Confluence] confluence_create_draft called with:', {
        spaceId,
        title,
        contentLength: content?.length,
        parentId,
        instance,
      });

      if (!client.hasCredentials()) {
        console.log('[Confluence] No credentials configured');
        return {
          error:
            'Confluence not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        // Determine which instance to use
        const instanceName = instance || client.getInstanceNames()[0];
        const instanceClient = client.getInstance(instanceName);

        if (!instanceClient) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Confluence instances configured.',
          };
        }

        console.log('[Confluence] Creating draft page in instance:', instanceName);

        const page = await instanceClient.createDraftPage({
          spaceId,
          title,
          content,
          parentId,
        });

        console.log('[Confluence] Draft page created:', {
          id: page.id,
          title: page.title,
          status: page.status,
        });

        return {
          success: true,
          instance: instanceName,
          host: instanceClient.host,
          id: page.id,
          title: page.title,
          spaceId: page.spaceId,
          status: page.status,
          url: `https://${instanceClient.host}/wiki${page._links.webui}`,
          editUrl: page._links.editui
            ? `https://${instanceClient.host}/wiki${page._links.editui}`
            : `https://${instanceClient.host}/wiki/pages/resumedraft.action?draftId=${page.id}`,
          message: `Draft page "${title}" created successfully. You can edit it at the editUrl before publishing.`,
        };
      } catch (error) {
        console.error('[Confluence] Create draft error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Confluence authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('403') || message.includes('Forbidden')) {
          return {
            error:
              'You do not have permission to create pages in this space. Check your Confluence permissions.',
          };
        }
        if (message.includes('404')) {
          return {
            error: `Space with ID "${spaceId}" was not found. Use confluence_list_spaces to find valid space IDs.`,
          };
        }
        return {
          error: `Failed to create Confluence draft: ${message}`,
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
    confluence_list_instances,
    confluence_create_draft,
  };
}
