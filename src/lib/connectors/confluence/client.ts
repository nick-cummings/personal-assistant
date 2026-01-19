import type { ConfluenceConfig } from '../types';

// Confluence API response types
interface ConfluenceSpace {
  id: number;
  key: string;
  name: string;
  type: string;
  status: string;
  _links: {
    webui: string;
  };
}

interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  status: string;
  spaceId: string;
  parentId?: string;
  authorId: string;
  createdAt: string;
  version: {
    number: number;
    message?: string;
    createdAt: string;
    authorId: string;
  };
  body?: {
    storage?: {
      value: string;
      representation: string;
    };
    atlas_doc_format?: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
    editui?: string;
  };
}

interface ConfluenceSearchResult {
  results: Array<{
    content: ConfluencePage;
    excerpt: string;
    lastModified: string;
  }>;
  totalSize: number;
  _links: {
    next?: string;
  };
}

interface ConfluencePageResponse {
  results: ConfluencePage[];
  _links: {
    next?: string;
  };
}

interface ConfluenceSpacesResponse {
  results: ConfluenceSpace[];
  _links: {
    next?: string;
  };
}

export class ConfluenceClient {
  private baseUrl: string;
  private authHeader: string;
  public host: string;

  constructor(config: ConfluenceConfig) {
    this.host = config.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.baseUrl = `https://${this.host}/wiki/api/v2`;
    this.authHeader =
      'Basic ' + Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listSpaces(): Promise<ConfluenceSpace[]> {
    const response = await this.fetch<ConfluenceSpacesResponse>('/spaces?limit=50&status=current');
    return response.results;
  }

  async search(query: string, spaceKey?: string, limit: number = 20): Promise<ConfluenceSearchResult> {
    const cqlParts: string[] = [];

    // Add text search
    cqlParts.push(`text ~ "${query.replace(/"/g, '\\"')}"`);

    // Add space filter if provided
    if (spaceKey) {
      cqlParts.push(`space = "${spaceKey}"`);
    }

    // Only search pages (not attachments, etc.)
    cqlParts.push('type = page');

    const cql = encodeURIComponent(cqlParts.join(' AND '));

    // Use CQL search endpoint
    const searchUrl = `https://${this.host}/wiki/rest/api/content/search?cql=${cql}&limit=${limit}&expand=version,space`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence search error (${response.status}): ${error}`);
    }

    const data = await response.json();

    return {
      results: data.results.map((r: {
        id: string;
        title: string;
        type: string;
        status: string;
        space?: { key: string };
        version?: { number: number; when: string; by?: { accountId: string } };
        _links: { webui: string };
        excerpt?: string;
      }) => ({
        content: {
          id: r.id,
          title: r.title,
          type: r.type,
          status: r.status,
          spaceId: r.space?.key ?? '',
          authorId: r.version?.by?.accountId ?? '',
          createdAt: r.version?.when ?? '',
          version: {
            number: r.version?.number ?? 1,
            createdAt: r.version?.when ?? '',
            authorId: r.version?.by?.accountId ?? '',
          },
          _links: r._links,
        },
        excerpt: r.excerpt ?? '',
        lastModified: r.version?.when ?? '',
      })),
      totalSize: data.totalSize ?? data.results.length,
      _links: data._links ?? {},
    };
  }

  async getPage(pageId: string): Promise<ConfluencePage & { bodyContent: string }> {
    const page = await this.fetch<ConfluencePage>(
      `/pages/${pageId}?body-format=storage`
    );

    // Extract body content
    let bodyContent = '';
    if (page.body?.storage?.value) {
      // Convert storage format (HTML-like) to plain text
      bodyContent = this.stripHtml(page.body.storage.value);
    }

    return {
      ...page,
      bodyContent,
    };
  }

  async getPageChildren(pageId: string): Promise<ConfluencePage[]> {
    const response = await this.fetch<ConfluencePageResponse>(
      `/pages/${pageId}/children?limit=50`
    );
    return response.results;
  }

  async testConnection(): Promise<void> {
    await this.listSpaces();
  }

  private stripHtml(html: string): string {
    // Basic HTML stripping - removes tags but keeps text content
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
