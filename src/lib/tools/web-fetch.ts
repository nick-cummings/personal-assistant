import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../connectors/types';

// Simple HTML to text conversion
function htmlToText(html: string): string {
  return html
    // Remove script and style elements
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert common block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n')
    .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract title from HTML
function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

// Extract meta description from HTML
function extractDescription(html: string): string | null {
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaMatch) return metaMatch[1].trim();

  const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  return ogMatch ? ogMatch[1].trim() : null;
}

export function createWebFetchTool(): ToolSet {
  const web_fetch = tool({
    description:
      'Fetch and read the content of a web page. Use this to read articles, documentation, or any web page the user shares. Returns the page title, description, and text content.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL of the web page to fetch'),
      maxLength: z
        .number()
        .optional()
        .default(10000)
        .describe('Maximum characters of content to return (default: 10000)'),
    }),
    execute: async ({ url, maxLength }) => {
      console.log(`[WebFetch ${new Date().toISOString()}] Fetching: ${url}`);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; PersonalAssistant/1.0; +https://github.com/personal-assistant)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          console.error(`[WebFetch ${new Date().toISOString()}] HTTP error: ${response.status}`);
          return {
            error: `Failed to fetch page: ${response.status} ${response.statusText}`,
          };
        }

        const contentType = response.headers.get('content-type') || '';

        // Handle non-HTML content
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          if (contentType.includes('application/json')) {
            const json = await response.json();
            const jsonStr = JSON.stringify(json, null, 2);
            return {
              url,
              contentType: 'application/json',
              content: jsonStr.substring(0, maxLength),
              truncated: jsonStr.length > maxLength,
            };
          }

          if (contentType.includes('text/')) {
            const text = await response.text();
            return {
              url,
              contentType,
              content: text.substring(0, maxLength),
              truncated: text.length > maxLength,
            };
          }

          return {
            error: `Unsupported content type: ${contentType}. This tool only supports HTML and text content.`,
          };
        }

        const html = await response.text();
        const title = extractTitle(html);
        const description = extractDescription(html);
        const textContent = htmlToText(html);

        console.log(
          `[WebFetch ${new Date().toISOString()}] Fetched ${textContent.length} chars from: ${title || url}`
        );

        return {
          url,
          title: title || undefined,
          description: description || undefined,
          content: textContent.substring(0, maxLength),
          truncated: textContent.length > maxLength,
          originalLength: textContent.length,
        };
      } catch (error) {
        console.error(`[WebFetch ${new Date().toISOString()}] Error:`, error);

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return { error: 'Request timed out after 15 seconds' };
          }
          return { error: `Failed to fetch page: ${error.message}` };
        }

        return { error: 'Failed to fetch page: Unknown error' };
      }
    },
  });

  return { web_fetch };
}
