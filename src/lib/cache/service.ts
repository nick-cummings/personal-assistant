import { db } from '@/lib/db';

/**
 * Default cache TTL values in milliseconds
 */
export const CACHE_TTL = {
  SHORT: 5 * 60 * 1000, // 5 minutes - for frequently changing data
  MEDIUM: 15 * 60 * 1000, // 15 minutes - default
  LONG: 60 * 60 * 1000, // 1 hour - for rarely changing data
  DAY: 24 * 60 * 60 * 1000, // 24 hours - for static data
} as const;

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  // GitHub
  GITHUB_PRS: 'github:prs',
  GITHUB_ISSUES: 'github:issues',
  GITHUB_ACTIONS: 'github:actions',

  // Jira
  JIRA_MY_ISSUES: 'jira:my_issues',
  JIRA_SPRINT: 'jira:sprint',
  JIRA_BOARDS: 'jira:boards',

  // Confluence
  CONFLUENCE_SPACES: 'confluence:spaces',
  CONFLUENCE_RECENT: 'confluence:recent',

  // Jenkins
  JENKINS_JOBS: 'jenkins:jobs',
  JENKINS_BUILDS: 'jenkins:builds',

  // AWS
  AWS_PIPELINES: 'aws:pipelines',
  AWS_ECS_SERVICES: 'aws:ecs_services',
  AWS_LAMBDAS: 'aws:lambdas',

  // Outlook
  OUTLOOK_FOLDERS: 'outlook:folders',
  OUTLOOK_RECENT_EMAILS: 'outlook:recent_emails',
  OUTLOOK_CALENDAR: 'outlook:calendar',

  // Gmail
  GMAIL_LABELS: 'gmail:labels',
  GMAIL_RECENT_EMAILS: 'gmail:recent_emails',

  // Google Calendar
  GOOGLE_CALENDAR_EVENTS: 'google_calendar:events',

  // Google Drive
  GOOGLE_DRIVE_RECENT: 'google_drive:recent',

  // Google Docs
  GOOGLE_DOCS_RECENT: 'google_docs:recent',

  // Google Sheets
  GOOGLE_SHEETS_RECENT: 'google_sheets:recent',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS] | string;

/**
 * Get cached data for a connector
 */
export async function getCachedData<T>(connectorId: string, cacheKey: CacheKey): Promise<T | null> {
  const cached = await db.cachedData.findUnique({
    where: {
      connectorId_cacheKey: {
        connectorId,
        cacheKey,
      },
    },
  });

  if (!cached) {
    return null;
  }

  // Check if expired
  if (new Date() > cached.expiresAt) {
    // Clean up expired entry
    await db.cachedData
      .delete({
        where: { id: cached.id },
      })
      .catch(() => {
        // Ignore deletion errors (concurrent delete)
      });
    return null;
  }

  try {
    return JSON.parse(cached.data) as T;
  } catch {
    return null;
  }
}

/**
 * Set cached data for a connector
 */
export async function setCachedData<T>(
  connectorId: string,
  cacheKey: CacheKey,
  data: T,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttl);

  await db.cachedData.upsert({
    where: {
      connectorId_cacheKey: {
        connectorId,
        cacheKey,
      },
    },
    create: {
      connectorId,
      cacheKey,
      data: JSON.stringify(data),
      expiresAt,
    },
    update: {
      data: JSON.stringify(data),
      expiresAt,
      updatedAt: new Date(),
    },
  });
}

/**
 * Invalidate cached data for a connector
 */
export async function invalidateCache(connectorId: string, cacheKey?: CacheKey): Promise<void> {
  if (cacheKey) {
    // Invalidate specific cache key
    await db.cachedData
      .delete({
        where: {
          connectorId_cacheKey: {
            connectorId,
            cacheKey,
          },
        },
      })
      .catch(() => {
        // Ignore if not found
      });
  } else {
    // Invalidate all cache for this connector
    await db.cachedData.deleteMany({
      where: { connectorId },
    });
  }
}

/**
 * Invalidate all expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const result = await db.cachedData.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}

/**
 * Get cached data or fetch fresh data if cache miss/expired
 */
export async function getOrFetch<T>(
  connectorId: string,
  cacheKey: CacheKey,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Try to get from cache first
  const cached = await getCachedData<T>(connectorId, cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  await setCachedData(connectorId, cacheKey, data, ttl);

  return data;
}

/**
 * Background refresh - fetches new data and updates cache without blocking
 * Returns stale data immediately while refreshing in background
 */
export async function getWithBackgroundRefresh<T>(
  connectorId: string,
  cacheKey: CacheKey,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<{ data: T | null; isStale: boolean; refreshPromise?: Promise<T> }> {
  const cached = await db.cachedData.findUnique({
    where: {
      connectorId_cacheKey: {
        connectorId,
        cacheKey,
      },
    },
  });

  if (!cached) {
    // No cache - fetch and wait
    const data = await fetcher();
    await setCachedData(connectorId, cacheKey, data, ttl);
    return { data, isStale: false };
  }

  const isExpired = new Date() > cached.expiresAt;

  if (isExpired) {
    // Cache is stale - return stale data and refresh in background
    const staleData = JSON.parse(cached.data) as T;
    const refreshPromise = (async () => {
      const freshData = await fetcher();
      await setCachedData(connectorId, cacheKey, freshData, ttl);
      return freshData;
    })();

    return {
      data: staleData,
      isStale: true,
      refreshPromise,
    };
  }

  // Cache is fresh
  return {
    data: JSON.parse(cached.data) as T,
    isStale: false,
  };
}

/**
 * Get all cache entries for a connector (for debugging/admin)
 */
export async function getCacheStats(connectorId?: string) {
  const where = connectorId ? { connectorId } : {};

  const entries = await db.cachedData.findMany({
    where,
    select: {
      connectorId: true,
      cacheKey: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const now = new Date();
  return entries.map((entry) => ({
    ...entry,
    isExpired: entry.expiresAt < now,
    ttlRemaining: Math.max(0, entry.expiresAt.getTime() - now.getTime()),
  }));
}
