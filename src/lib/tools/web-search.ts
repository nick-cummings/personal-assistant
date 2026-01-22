import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../connectors/types';

interface SerpApiResult {
  organic_results?: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
  knowledge_graph?: {
    title?: string;
    description?: string;
    source?: {
      name: string;
      link: string;
    };
  };
  answer_box?: {
    answer?: string;
    snippet?: string;
    title?: string;
    link?: string;
  };
  error?: string;
}

export function createWebSearchTool(apiKey: string): ToolSet {
  const web_search = tool({
    description:
      'Search the web for current information. Use this for questions about recent events, documentation, news, or any information that may have changed since training. Returns titles, URLs, and snippets from search results.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      numResults: z
        .number()
        .optional()
        .default(5)
        .describe('Number of results to return (default: 5, max: 10)'),
    }),
    execute: async ({ query, numResults }) => {
      console.log(`[WebSearch ${new Date().toISOString()}] Searching for: "${query}"`);

      // Ensure numResults has a valid value (default to 5 if undefined/null)
      const limit = Math.min(numResults ?? 5, 10);

      try {
        const params = new URLSearchParams({
          q: query,
          api_key: apiKey,
          engine: 'google',
          num: String(limit),
        });

        const response = await fetch(`https://serpapi.com/search?${params.toString()}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[WebSearch ${new Date().toISOString()}] API error:`, errorText);
          return {
            error: `Search failed: ${response.status} ${response.statusText}`,
          };
        }

        const data: SerpApiResult = await response.json();

        if (data.error) {
          return { error: data.error };
        }

        const results: Array<{
          title: string;
          url: string;
          snippet: string;
        }> = [];

        // Include answer box if present (direct answers)
        if (data.answer_box) {
          results.push({
            title: data.answer_box.title || 'Direct Answer',
            url: data.answer_box.link || '',
            snippet: data.answer_box.answer || data.answer_box.snippet || '',
          });
        }

        // Include knowledge graph if present
        if (data.knowledge_graph?.description) {
          results.push({
            title: data.knowledge_graph.title || 'Knowledge Panel',
            url: data.knowledge_graph.source?.link || '',
            snippet: data.knowledge_graph.description,
          });
        }

        // Include organic results
        for (const result of data.organic_results || []) {
          results.push({
            title: result.title,
            url: result.link,
            snippet: result.snippet,
          });
        }

        console.log(`[WebSearch ${new Date().toISOString()}] Found ${results.length} results`);

        return {
          query,
          count: results.length,
          results: results.slice(0, limit),
        };
      } catch (error) {
        console.error(`[WebSearch ${new Date().toISOString()}] Error:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: `Search failed: ${message}` };
      }
    },
  });

  return { web_search };
}
