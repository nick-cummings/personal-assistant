import type { AtlassianInstance, ConfluenceConfig } from '../types';

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

// Single Confluence instance client
export class ConfluenceInstanceClient {
  private baseUrl: string;
  private authHeader: string;
  public host: string;
  public name: string;

  constructor(instance: AtlassianInstance) {
    this.name = instance.name;
    this.host = instance.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.baseUrl = `https://${this.host}/wiki/api/v2`;
    this.authHeader =
      'Basic ' + Buffer.from(`${instance.email}:${instance.apiToken}`).toString('base64');
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

  async search(
    query: string,
    spaceKey?: string,
    limit: number = 20,
    options?: {
      afterDate?: string; // ISO date string - pages modified on or after this date
      beforeDate?: string; // ISO date string - pages modified before this date
      queries?: string[]; // Multiple search terms (OR logic)
    }
  ): Promise<ConfluenceSearchResult> {
    // Determine search queries - either multiple queries or single query
    const searchQueries = options?.queries?.length ? options.queries : query ? [query] : [];

    // Build date filter CQL parts
    const dateFilters: string[] = [];
    if (options?.afterDate) {
      // CQL uses format: yyyy-MM-dd or yyyy-MM-dd HH:mm
      const afterDate = new Date(options.afterDate).toISOString().split('T')[0];
      dateFilters.push(`lastModified >= "${afterDate}"`);
    }
    if (options?.beforeDate) {
      const beforeDate = new Date(options.beforeDate).toISOString().split('T')[0];
      dateFilters.push(`lastModified < "${beforeDate}"`);
    }

    // If we have search queries, we need to handle them with OR logic
    if (searchQueries.length > 0) {
      const allResults: ConfluenceSearchResult['results'] = [];
      const seenIds = new Set<string>();

      for (const q of searchQueries) {
        console.log(`[Confluence ${new Date().toISOString()}] Searching for "${q}"`);

        const cqlParts: string[] = [];
        cqlParts.push(`text ~ "${q.replace(/"/g, '\\"')}"`);
        if (spaceKey) {
          cqlParts.push(`space = "${spaceKey}"`);
        }
        cqlParts.push('type = page');
        cqlParts.push(...dateFilters);

        const cql = encodeURIComponent(cqlParts.join(' AND '));
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
        const resultCount = data.results?.length || 0;
        console.log(`[Confluence ${new Date().toISOString()}] Search for "${q}" returned ${resultCount} results`);

        for (const r of data.results || []) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            allResults.push({
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
            });
          }
        }
      }

      console.log(`[Confluence ${new Date().toISOString()}] Total unique results after all queries: ${allResults.length}`);

      // Sort by lastModified descending and limit
      allResults.sort((a, b) => {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return dateB - dateA;
      });

      return {
        results: allResults.slice(0, limit),
        totalSize: allResults.length,
        _links: {},
      };
    }

    // No text search, just date filter (or get all)
    const cqlParts: string[] = ['type = page'];
    if (spaceKey) {
      cqlParts.push(`space = "${spaceKey}"`);
    }
    cqlParts.push(...dateFilters);

    const cql = encodeURIComponent(cqlParts.join(' AND '));
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
      results: data.results.map(
        (r: {
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
        })
      ),
      totalSize: data.totalSize ?? data.results.length,
      _links: data._links ?? {},
    };
  }

  async getPage(pageId: string): Promise<ConfluencePage & { bodyContent: string }> {
    const page = await this.fetch<ConfluencePage>(`/pages/${pageId}?body-format=storage`);

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
    const response = await this.fetch<ConfluencePageResponse>(`/pages/${pageId}/children?limit=50`);
    return response.results;
  }

  async testConnection(): Promise<void> {
    await this.listSpaces();
  }

  async createDraftPage(options: {
    spaceId: string;
    title: string;
    content?: string;
    parentId?: string;
  }): Promise<ConfluencePage> {
    // Use REST API v2 for creating pages
    const body: {
      spaceId: string;
      status: string;
      title: string;
      parentId?: string;
      body?: {
        representation: string;
        value: string;
      };
    } = {
      spaceId: options.spaceId,
      status: 'draft',
      title: options.title,
    };

    if (options.parentId) {
      body.parentId = options.parentId;
    }

    if (options.content) {
      // Convert plain text to basic storage format
      body.body = {
        representation: 'storage',
        value: this.textToStorageFormat(options.content),
      };
    }

    return this.fetch<ConfluencePage>('/pages', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private textToStorageFormat(text: string): string {
    // Convert plain text to Confluence storage format (XHTML)
    // Split by double newlines for paragraphs, single newlines become <br/>
    const paragraphs = text.split(/\n\n+/);
    return paragraphs
      .map((para) => {
        const escaped = para
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br />');
        return `<p>${escaped}</p>`;
      })
      .join('\n');
  }

  async listDraftPages(spaceKey?: string, limit: number = 20): Promise<ConfluenceSearchResult> {
    // Use REST API v1 which supports draft status (v2 does not)
    let url = `https://${this.host}/wiki/rest/api/content?status=draft&limit=${limit}&expand=version,space`;

    if (spaceKey) {
      url += `&spaceKey=${encodeURIComponent(spaceKey)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence draft pages error (${response.status}): ${error}`);
    }

    const data = await response.json();

    return {
      results: data.results.map(
        (r: {
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
            title: r.title || '(Untitled Draft)',
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
        })
      ),
      totalSize: data.size ?? data.results.length,
      _links: data._links ?? {},
    };
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

// Multi-instance Confluence client manager
export class ConfluenceClient {
  private instances: Map<string, ConfluenceInstanceClient> = new Map();
  private instanceList: AtlassianInstance[] = [];

  constructor(config: ConfluenceConfig) {
    // Handle both new multi-instance and legacy single-instance configs
    if (config.instances && config.instances.length > 0) {
      this.instanceList = config.instances;
      for (const instance of config.instances) {
        this.instances.set(instance.name, new ConfluenceInstanceClient(instance));
      }
    } else if (config.host && config.email && config.apiToken) {
      // Legacy single-instance config - convert to instance format
      const legacyInstance: AtlassianInstance = {
        name: 'Default',
        host: config.host,
        email: config.email,
        apiToken: config.apiToken,
      };
      this.instanceList = [legacyInstance];
      this.instances.set('Default', new ConfluenceInstanceClient(legacyInstance));
    }
  }

  hasCredentials(): boolean {
    return this.instances.size > 0;
  }

  // Get list of configured instance names
  getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }

  // Get a specific instance by name
  getInstance(name: string): ConfluenceInstanceClient | undefined {
    return this.instances.get(name);
  }

  // Get all instances
  getAllInstances(): ConfluenceInstanceClient[] {
    return Array.from(this.instances.values());
  }

  // Execute a query across all instances (or a specific one)
  async queryAllInstances<T>(
    queryFn: (client: ConfluenceInstanceClient) => Promise<T>,
    instanceName?: string
  ): Promise<{ instance: string; host: string; result: T }[]> {
    const results: { instance: string; host: string; result: T }[] = [];

    if (instanceName) {
      const instance = this.instances.get(instanceName);
      if (instance) {
        const result = await queryFn(instance);
        results.push({ instance: instance.name, host: instance.host, result });
      }
    } else {
      // Query all instances in parallel
      const promises = Array.from(this.instances.entries()).map(async ([name, client]) => {
        try {
          const result = await queryFn(client);
          return { instance: name, host: client.host, result };
        } catch (error) {
          // Log but don't fail - one instance failing shouldn't break others
          console.error(`[Confluence] Error querying instance "${name}":`, error);
          return null;
        }
      });

      const settled = await Promise.all(promises);
      for (const r of settled) {
        if (r) results.push(r);
      }
    }

    return results;
  }

  // Legacy methods that work with the first/default instance
  // Keeping for backward compatibility with tests

  get host(): string {
    const first = this.getAllInstances()[0];
    return first?.host || '';
  }

  async listSpaces(): Promise<ConfluenceSpace[]> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Confluence instances configured');
    return first.listSpaces();
  }

  async search(
    query: string,
    spaceKey?: string,
    limit: number = 20,
    options?: {
      afterDate?: string;
      beforeDate?: string;
      queries?: string[];
    }
  ): Promise<ConfluenceSearchResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Confluence instances configured');
    return first.search(query, spaceKey, limit, options);
  }

  async getPage(pageId: string): Promise<ConfluencePage & { bodyContent: string }> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Confluence instances configured');
    return first.getPage(pageId);
  }

  async getPageChildren(pageId: string): Promise<ConfluencePage[]> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Confluence instances configured');
    return first.getPageChildren(pageId);
  }

  async testConnection(): Promise<void> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Confluence instances configured');
    return first.testConnection();
  }

  async listDraftPages(spaceKey?: string, limit: number = 20): Promise<ConfluenceSearchResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Confluence instances configured');
    return first.listDraftPages(spaceKey, limit);
  }
}
