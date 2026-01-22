import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../connectors/types';

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      date: string;
      links: {
        npm?: string;
        homepage?: string;
        repository?: string;
        bugs?: string;
      };
      publisher?: {
        username: string;
        email?: string;
      };
      maintainers?: Array<{
        username: string;
        email?: string;
      }>;
      license?: string;
    };
    score: {
      final: number;
      detail: {
        quality: number;
        popularity: number;
        maintenance: number;
      };
    };
    downloads?: {
      weekly: number;
      monthly: number;
    };
    dependents?: string;
  }>;
  total: number;
}

interface NpmPackageDetails {
  name: string;
  description?: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, unknown>;
  time: Record<string, string>;
  maintainers: Array<{ name: string; email?: string }>;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  keywords?: string[];
  license?: string;
  readme?: string;
  readmeFilename?: string;
}

function extractGitHubUrl(repoUrl?: string): string | null {
  if (!repoUrl) return null;

  // Handle various GitHub URL formats
  const match = repoUrl.match(
    /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/i
  );
  if (match) {
    return `https://github.com/${match[1]}/${match[2]}`;
  }
  return null;
}

function formatDownloads(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return String(num);
}

export function createNpmTool(): ToolSet {
  const npm = tool({
    description:
      'Search npm registry for packages, get package details, and find GitHub repository links. Use this for finding JavaScript/TypeScript libraries, checking versions, and getting package metadata.',
    inputSchema: z.object({
      operation: z
        .enum(['search', 'info'])
        .describe(
          '"search" to find packages by keyword, "info" to get details about a specific package'
        ),
      query: z
        .string()
        .describe(
          'For "search": keywords to search for (supports multiple terms like "react form validation"). For "info": exact package name'
        ),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of results to return for search (default: 10, max: 20)'),
      ranking: z
        .enum(['optimal', 'popularity', 'maintenance', 'quality'])
        .optional()
        .default('optimal')
        .describe(
          'How to rank results: "optimal" balances all factors favoring popular maintained packages (default), "popularity" prioritizes download counts, "maintenance" prioritizes recently updated packages, "quality" prioritizes code quality metrics'
        ),
    }),
    execute: async ({ operation, query, limit, ranking }) => {
      console.log(`[NPM ${new Date().toISOString()}] ${operation}: "${query}" (ranking: ${ranking ?? 'optimal'})`);

      // Ensure valid limit
      const resultLimit = Math.min(limit ?? 10, 20);

      // Determine ranking weights - npm API supports popularity, quality, maintenance boosts (0.0-2.0)
      // Default balanced, but we'll boost for better results
      const rankingWeights = {
        optimal: { popularity: 1.5, quality: 1.0, maintenance: 1.2 }, // Favor popular, maintained packages
        popularity: { popularity: 2.0, quality: 0.5, maintenance: 0.5 },
        maintenance: { popularity: 0.5, quality: 0.5, maintenance: 2.0 },
        quality: { popularity: 0.5, quality: 2.0, maintenance: 0.5 },
      };

      const weights = rankingWeights[ranking ?? 'optimal'];

      try {
        if (operation === 'search') {
          // Search for packages with ranking weights
          const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${resultLimit}&popularity=${weights.popularity}&quality=${weights.quality}&maintenance=${weights.maintenance}`;
          const response = await fetch(url);

          if (!response.ok) {
            return { error: `npm search failed: ${response.status} ${response.statusText}` };
          }

          const data: NpmSearchResult = await response.json();

          // Map results with raw download numbers for sorting
          const mappedResults = data.objects.map((obj) => {
            const pkg = obj.package;
            const githubUrl = extractGitHubUrl(pkg.links.repository);
            const weeklyDownloads = obj.downloads?.weekly ?? 0;

            return {
              name: pkg.name,
              version: pkg.version,
              description: pkg.description || '',
              keywords: pkg.keywords?.slice(0, 5) || [],
              license: pkg.license || 'Unknown',
              links: {
                npm: `https://www.npmjs.com/package/${pkg.name}`,
                homepage: pkg.links.homepage || null,
                github: githubUrl,
              },
              downloads: obj.downloads
                ? {
                    weekly: formatDownloads(obj.downloads.weekly),
                    monthly: formatDownloads(obj.downloads.monthly),
                    _weeklyRaw: weeklyDownloads, // For sorting
                  }
                : { weekly: '0', monthly: '0', _weeklyRaw: 0 },
              dependents: obj.dependents ? parseInt(obj.dependents, 10) : null,
              score: {
                overall: Math.round(obj.score.final * 100) / 100,
                quality: Math.round(obj.score.detail.quality * 100),
                popularity: Math.round(obj.score.detail.popularity * 100),
                maintenance: Math.round(obj.score.detail.maintenance * 100),
              },
              lastPublished: pkg.date,
              _lastPublishedDate: new Date(pkg.date).getTime(), // For sorting
            };
          });

          // Sort results based on ranking preference
          const effectiveRanking = ranking ?? 'optimal';
          let results;
          if (effectiveRanking === 'popularity' || effectiveRanking === 'optimal') {
            // Sort by weekly downloads (descending)
            results = [...mappedResults].sort((a, b) =>
              (b.downloads?._weeklyRaw ?? 0) - (a.downloads?._weeklyRaw ?? 0)
            );
          } else if (effectiveRanking === 'maintenance') {
            // Sort by last published date (most recent first)
            results = mappedResults.sort((a, b) => b._lastPublishedDate - a._lastPublishedDate);
          } else {
            // quality - keep API ordering
            results = mappedResults;
          }

          // Remove internal sorting fields from output
          const cleanResults = results.map(({ _lastPublishedDate, downloads, ...rest }) => ({
            ...rest,
            downloads: downloads ? { weekly: downloads.weekly, monthly: downloads.monthly } : null,
          }));

          console.log(`[NPM ${new Date().toISOString()}] Found ${cleanResults.length} packages`);

          return {
            operation: 'search',
            query,
            total: data.total,
            count: cleanResults.length,
            results: cleanResults,
          };
        } else if (operation === 'info') {
          // Get package details
          const url = `https://registry.npmjs.org/${encodeURIComponent(query)}`;
          const response = await fetch(url);

          if (!response.ok) {
            if (response.status === 404) {
              return { error: `Package not found: ${query}` };
            }
            return { error: `npm info failed: ${response.status} ${response.statusText}` };
          }

          const data: NpmPackageDetails = await response.json();
          const githubUrl = extractGitHubUrl(data.repository?.url);

          // Get version history (last 5 versions)
          const versionTimes = Object.entries(data.time)
            .filter(([key]) => key !== 'created' && key !== 'modified')
            .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
            .slice(0, 5);

          // Truncate readme if too long
          const readme = data.readme
            ? data.readme.length > 3000
              ? data.readme.substring(0, 3000) + '\n\n... (truncated)'
              : data.readme
            : null;

          const result = {
            operation: 'info',
            name: data.name,
            description: data.description || '',
            latestVersion: data['dist-tags']?.latest || 'unknown',
            distTags: data['dist-tags'] || {},
            license: data.license || 'Unknown',
            keywords: data.keywords?.slice(0, 10) || [],
            links: {
              npm: `https://www.npmjs.com/package/${data.name}`,
              homepage: data.homepage || null,
              github: githubUrl,
              issues: githubUrl ? `${githubUrl}/issues` : null,
            },
            maintainers: data.maintainers?.slice(0, 5).map((m) => m.name) || [],
            recentVersions: versionTimes.map(([version, date]) => ({
              version,
              date: new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
            })),
            created: data.time?.created
              ? new Date(data.time.created).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null,
            lastModified: data.time?.modified
              ? new Date(data.time.modified).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null,
            readme,
          };

          console.log(`[NPM ${new Date().toISOString()}] Got info for ${data.name}@${result.latestVersion}`);

          return result;
        }

        return { error: `Unknown operation: ${operation}` };
      } catch (error) {
        console.error(`[NPM ${new Date().toISOString()}] Error:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: `npm ${operation} failed: ${message}` };
      }
    },
  });

  return { npm };
}
