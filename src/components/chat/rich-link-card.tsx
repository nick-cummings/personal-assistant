'use client';

import { cn } from '@/lib/utils';
import {
    Calendar, CircleDot, Cloud, ExternalLink, FileText, GitPullRequest, HardDrive, Mail, Server, Table
} from 'lucide-react';

interface RichLinkCardProps {
  url: string;
  title: string;
  description?: string;
  type:
    | 'github-pr'
    | 'github-issue'
    | 'jira'
    | 'confluence'
    | 'jenkins'
    | 'aws'
    | 'outlook-email'
    | 'outlook-event'
    | 'gmail'
    | 'yahoo'
    | 'google-drive'
    | 'google-docs'
    | 'google-sheets'
    | 'google-calendar'
    | 'google-cloud'
    | 'generic';
  metadata?: {
    status?: string;
    author?: string;
    number?: string | number;
    project?: string;
  };
}

const typeConfig = {
  'github-pr': {
    icon: GitPullRequest,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    label: 'Pull Request',
  },
  'github-issue': {
    icon: CircleDot,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Issue',
  },
  jira: {
    icon: CircleDot,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Jira',
  },
  confluence: {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Confluence',
  },
  jenkins: {
    icon: CircleDot,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Jenkins',
  },
  aws: {
    icon: Cloud,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    label: 'AWS',
  },
  'outlook-email': {
    icon: Mail,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Email',
  },
  'outlook-event': {
    icon: Calendar,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Event',
  },
  gmail: {
    icon: Mail,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Gmail',
  },
  yahoo: {
    icon: Mail,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    label: 'Yahoo Mail',
  },
  'google-drive': {
    icon: HardDrive,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    label: 'Google Drive',
  },
  'google-docs': {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Google Docs',
  },
  'google-sheets': {
    icon: Table,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Google Sheets',
  },
  'google-calendar': {
    icon: Calendar,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Google Calendar',
  },
  'google-cloud': {
    icon: Server,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Google Cloud',
  },
  generic: {
    icon: ExternalLink,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    borderColor: 'border-gray-200 dark:border-gray-800',
    label: 'Link',
  },
};

const statusColors: Record<string, string> = {
  // GitHub
  open: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  merged: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  // Jira
  'To Do': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  'In Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  // Jenkins
  SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  FAILURE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  UNSTABLE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  BUILDING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  // AWS Pipeline
  Succeeded: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  InProgress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export function RichLinkCard({ url, title, description, type, metadata }: RichLinkCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  // Use only span elements to avoid hydration errors when rendered inside <p> tags
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'hover:bg-accent/50 my-2 flex items-start gap-3 rounded-lg border p-3 transition-colors',
        config.borderColor,
        config.bgColor
      )}
    >
      <span className={cn('mt-0.5 flex-shrink-0', config.color)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          {metadata?.number && (
            <span className="text-muted-foreground text-xs">#{metadata.number}</span>
          )}
          {metadata?.project && (
            <span className="text-muted-foreground text-xs">{metadata.project}</span>
          )}
          {metadata?.status && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                statusColors[metadata.status] || 'bg-gray-100 text-gray-800'
              )}
            >
              {metadata.status}
            </span>
          )}
        </span>
        <span className="mt-0.5 truncate font-medium">{title}</span>
        {description && (
          <span className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{description}</span>
        )}
        {metadata?.author && (
          <span className="text-muted-foreground mt-1 text-xs">by {metadata.author}</span>
        )}
      </span>
      <ExternalLink className="text-muted-foreground h-4 w-4 flex-shrink-0" />
    </a>
  );
}

// Helper function to detect link type from URL
export function detectLinkType(url: string): RichLinkCardProps['type'] {
  if (url.includes('github.com')) {
    if (url.includes('/pull/')) return 'github-pr';
    if (url.includes('/issues/')) return 'github-issue';
  }
  if (url.includes('atlassian.net')) {
    if (url.includes('/wiki/')) return 'confluence';
    if (url.includes('/browse/') || url.includes('/jira/')) return 'jira';
  }
  if (url.includes('jenkins')) return 'jenkins';
  if (url.includes('console.aws.amazon.com')) return 'aws';
  if (url.includes('outlook') || url.includes('office.com')) {
    if (url.includes('calendar')) return 'outlook-event';
    return 'outlook-email';
  }
  if (url.includes('mail.google.com') || url.includes('gmail.com')) {
    return 'gmail';
  }
  if (url.includes('mail.yahoo.com') || url.includes('yahoo.com/mail')) {
    return 'yahoo';
  }
  if (url.includes('drive.google.com')) {
    return 'google-drive';
  }
  if (url.includes('docs.google.com/document')) {
    return 'google-docs';
  }
  if (url.includes('docs.google.com/spreadsheets')) {
    return 'google-sheets';
  }
  if (url.includes('calendar.google.com')) {
    return 'google-calendar';
  }
  if (url.includes('console.cloud.google.com')) {
    return 'google-cloud';
  }
  return 'generic';
}

// Parse message content to extract rich links
export function parseRichLinks(content: string): Array<{
  url: string;
  title: string;
  type: RichLinkCardProps['type'];
}> {
  const urlRegex = /https?:\/\/[^\s\]]+/g;
  const matches = content.match(urlRegex) || [];

  return matches.map((url) => {
    const type = detectLinkType(url);
    // Extract a title from the URL
    let title = url;
    try {
      const urlObj = new URL(url);
      title = urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname;
    } catch {
      // Use URL as-is if parsing fails
    }

    return { url, title, type };
  });
}
