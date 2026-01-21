import { db } from '@/lib/db';
import { decryptJson } from '@/lib/utils/crypto';
import {
  getCachedData,
  setCachedData,
  CACHE_TTL,
  CACHE_KEYS,
} from './service';
import type { ConnectorType } from '@/types';
import type {
  GitHubConfig,
  JiraConfig,
  ConfluenceConfig,
  JenkinsConfig,
  AWSConfig,
  OutlookConfig,
  GmailConfig,
  GoogleCalendarConfig,
  GoogleDriveConfig,
} from '@/lib/connectors/types';

/**
 * Preload configuration for each connector type
 * Defines what data to preload and with what TTL
 */
interface PreloadConfig {
  cacheKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetcher: (connectorId: string, config: any) => Promise<unknown>;
  ttl: number;
}

/**
 * Preload configurations per connector type
 */
const PRELOAD_CONFIGS: Partial<Record<ConnectorType, PreloadConfig[]>> = {
  github: [
    {
      cacheKey: CACHE_KEYS.GITHUB_PRS,
      fetcher: async (_connectorId, config: GitHubConfig) => {
        const { GitHubClient } = await import('@/lib/connectors/github/client');
        const client = new GitHubClient(config);
        // Preload recent PRs authored by user
        return client.listPullRequests(
          config.defaultOwner || '',
          { state: 'open' }
        );
      },
      ttl: CACHE_TTL.MEDIUM,
    },
  ],

  jira: [
    {
      cacheKey: CACHE_KEYS.JIRA_MY_ISSUES,
      fetcher: async (_connectorId, config: JiraConfig) => {
        const { JiraClient } = await import('@/lib/connectors/jira/client');
        const client = new JiraClient(config);
        // Preload issues assigned to current user
        return client.searchIssues('assignee = currentUser() ORDER BY updated DESC', 20);
      },
      ttl: CACHE_TTL.MEDIUM,
    },
    {
      cacheKey: CACHE_KEYS.JIRA_BOARDS,
      fetcher: async (_connectorId, config: JiraConfig) => {
        const { JiraClient } = await import('@/lib/connectors/jira/client');
        const client = new JiraClient(config);
        return client.listBoards();
      },
      ttl: CACHE_TTL.LONG,
    },
  ],

  confluence: [
    {
      cacheKey: CACHE_KEYS.CONFLUENCE_SPACES,
      fetcher: async (_connectorId, config: ConfluenceConfig) => {
        const { ConfluenceClient } = await import('@/lib/connectors/confluence/client');
        const client = new ConfluenceClient(config);
        return client.listSpaces();
      },
      ttl: CACHE_TTL.LONG,
    },
  ],

  jenkins: [
    {
      cacheKey: CACHE_KEYS.JENKINS_JOBS,
      fetcher: async (_connectorId, config: JenkinsConfig) => {
        const { JenkinsClient } = await import('@/lib/connectors/jenkins/client');
        const client = new JenkinsClient(config);
        return client.listJobs();
      },
      ttl: CACHE_TTL.MEDIUM,
    },
  ],

  aws: [
    {
      cacheKey: CACHE_KEYS.AWS_PIPELINES,
      fetcher: async (_connectorId, config: AWSConfig) => {
        const { AWSClient } = await import('@/lib/connectors/aws/client');
        const client = new AWSClient(config);
        return client.listPipelines();
      },
      ttl: CACHE_TTL.MEDIUM,
    },
  ],

  outlook: [
    {
      cacheKey: CACHE_KEYS.OUTLOOK_FOLDERS,
      fetcher: async (_connectorId, config: OutlookConfig) => {
        const { OutlookClient } = await import('@/lib/connectors/outlook/client');
        const client = new OutlookClient(config);
        return client.listFolders();
      },
      ttl: CACHE_TTL.LONG,
    },
  ],

  gmail: [
    {
      cacheKey: CACHE_KEYS.GMAIL_LABELS,
      fetcher: async (_connectorId, config: GmailConfig) => {
        const { GmailImapClient } = await import('@/lib/connectors/gmail/client');
        const client = new GmailImapClient(config);
        return client.listLabels();
      },
      ttl: CACHE_TTL.LONG,
    },
  ],

  'google-calendar': [
    {
      cacheKey: CACHE_KEYS.GOOGLE_CALENDAR_EVENTS,
      fetcher: async (_connectorId, config: GoogleCalendarConfig) => {
        const { GoogleCalendarClient } = await import('@/lib/connectors/google-calendar/client');
        const client = new GoogleCalendarClient(config);
        // Preload upcoming events for the next 7 days
        return client.getUpcomingEvents('primary', 7);
      },
      ttl: CACHE_TTL.SHORT,
    },
  ],

  'google-drive': [
    {
      cacheKey: CACHE_KEYS.GOOGLE_DRIVE_RECENT,
      fetcher: async (_connectorId, config: GoogleDriveConfig) => {
        const { GoogleDriveClient } = await import('@/lib/connectors/google-drive/client');
        const client = new GoogleDriveClient(config);
        return client.listFiles(undefined, 20);
      },
      ttl: CACHE_TTL.MEDIUM,
    },
  ],
};

/**
 * Result of a preload operation
 */
export interface PreloadResult {
  connectorType: ConnectorType;
  cacheKey: string;
  success: boolean;
  fromCache: boolean;
  error?: string;
}

/**
 * Preload cache for a specific connector
 */
export async function preloadConnectorCache(
  connectorId: string,
  connectorType: ConnectorType,
  config: unknown
): Promise<PreloadResult[]> {
  const preloadConfigs = PRELOAD_CONFIGS[connectorType];
  if (!preloadConfigs) {
    return [];
  }

  const results: PreloadResult[] = [];

  for (const preloadConfig of preloadConfigs) {
    try {
      // Check if we already have fresh cached data
      const existing = await getCachedData(connectorId, preloadConfig.cacheKey);
      if (existing !== null) {
        results.push({
          connectorType,
          cacheKey: preloadConfig.cacheKey,
          success: true,
          fromCache: true,
        });
        continue;
      }

      // Fetch and cache the data
      const data = await preloadConfig.fetcher(connectorId, config);
      await setCachedData(connectorId, preloadConfig.cacheKey, data, preloadConfig.ttl);

      results.push({
        connectorType,
        cacheKey: preloadConfig.cacheKey,
        success: true,
        fromCache: false,
      });
    } catch (error) {
      results.push({
        connectorType,
        cacheKey: preloadConfig.cacheKey,
        success: false,
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Preload cache for all enabled connectors
 * This runs in the background when a chat is opened
 */
export async function preloadAllConnectorCaches(): Promise<PreloadResult[]> {
  const connectors = await db.connector.findMany({
    where: { enabled: true },
  });

  const allResults: PreloadResult[] = [];

  // Run preloads in parallel for all connectors
  const promises = connectors.map(async (connector) => {
    try {
      const config = decryptJson(connector.config);
      const results = await preloadConnectorCache(
        connector.id,
        connector.type as ConnectorType,
        config
      );
      return results;
    } catch (error) {
      console.error(`Failed to preload cache for ${connector.type}:`, error);
      return [];
    }
  });

  const resultArrays = await Promise.all(promises);
  for (const results of resultArrays) {
    allResults.push(...results);
  }

  return allResults;
}

/**
 * Check if cache needs refresh for any connector
 */
export async function getCacheStatus(): Promise<{
  connectorId: string;
  type: string;
  cacheKey: string;
  isStale: boolean;
  expiresAt: Date | null;
}[]> {
  const connectors = await db.connector.findMany({
    where: { enabled: true },
    include: { cachedData: true },
  });

  const status: {
    connectorId: string;
    type: string;
    cacheKey: string;
    isStale: boolean;
    expiresAt: Date | null;
  }[] = [];

  const now = new Date();

  for (const connector of connectors) {
    const preloadConfigs = PRELOAD_CONFIGS[connector.type as ConnectorType] || [];

    for (const preloadConfig of preloadConfigs) {
      const cached = connector.cachedData.find(
        (c) => c.cacheKey === preloadConfig.cacheKey
      );

      status.push({
        connectorId: connector.id,
        type: connector.type,
        cacheKey: preloadConfig.cacheKey,
        isStale: cached ? cached.expiresAt < now : true,
        expiresAt: cached?.expiresAt || null,
      });
    }
  }

  return status;
}
