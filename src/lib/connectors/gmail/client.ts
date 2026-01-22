import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';

export interface GmailImapConfig {
  email: string;
  appPassword: string;
}

export interface GmailEmail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
  messageCount: number;
  unreadCount: number;
}

export class GmailImapClient {
  private config: GmailImapConfig;

  constructor(config: GmailImapConfig) {
    this.config = config;
  }

  hasCredentials(): boolean {
    return !!(this.config.email && this.config.appPassword);
  }

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: this.config.email,
        pass: this.config.appPassword,
      },
      logger: false,
    });
  }

  async searchEmails(
    query: string,
    maxResults: number = 20,
    options?: {
      afterDate?: string; // ISO date string
      beforeDate?: string; // ISO date string
      queries?: string[]; // Multiple search terms (OR logic)
    }
  ): Promise<GmailEmail[]> {
    const client = this.createClient();
    const emails: GmailEmail[] = [];
    const seenUids = new Set<number>();

    try {
      await client.connect();
      const lock = await client.getMailboxLock('[Gmail]/All Mail');

      try {
        // Build base date criteria object (properties are ANDed together in ImapFlow)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const baseCriteria: any = {};
        if (options?.afterDate) {
          baseCriteria.since = new Date(options.afterDate);
        }
        if (options?.beforeDate) {
          baseCriteria.before = new Date(options.beforeDate);
        }

        // Determine search queries - either multiple queries or single query
        const searchQueries = options?.queries?.length ? options.queries : query ? [query] : [];

        // If no text queries, just search with date criteria or all
        if (searchQueries.length === 0) {
          const searchCriteria = Object.keys(baseCriteria).length > 0 ? baseCriteria : { all: true };

          const searchResult = await client.search(searchCriteria, { uid: true });
          if (searchResult && Array.isArray(searchResult)) {
            for (const uid of searchResult) {
              seenUids.add(uid);
            }
          }
        } else {
          // Search for each query term and combine results (OR logic across queries)
          for (const q of searchQueries) {
            // Combine text search with date criteria in a single object (ANDed together)
            const searchCriteria = {
              text: q,
              ...baseCriteria,
            };

            console.log(`[Gmail ${new Date().toISOString()}] Searching for "${q}" with criteria:`, JSON.stringify(searchCriteria, (key, value) =>
              value instanceof Date ? value.toISOString() : value
            ));

            const searchResult = await client.search(searchCriteria, { uid: true });
            const resultCount = searchResult && Array.isArray(searchResult) ? searchResult.length : 0;
            console.log(`[Gmail ${new Date().toISOString()}] Search for "${q}" returned ${resultCount} results`);

            if (searchResult && Array.isArray(searchResult)) {
              for (const uid of searchResult) {
                seenUids.add(uid);
              }
            }
          }
          console.log(`[Gmail ${new Date().toISOString()}] Total unique results after all queries: ${seenUids.size}`);
        }

        if (seenUids.size === 0) {
          return [];
        }

        // Convert to array, sort by UID (most recent last), take last N, then reverse for most recent first
        const allUids = Array.from(seenUids).sort((a, b) => a - b);
        const recentUids = allUids.slice(-maxResults).reverse();

        for (const uid of recentUids) {
          const message = await client.fetchOne(
            String(uid),
            {
              envelope: true,
              flags: true,
              bodyStructure: true,
              source: true,
              labels: true,
            },
            { uid: true }
          );

          if (message && message.source) {
            const parsed = await simpleParser(message.source);
            emails.push(this.parseMessage(String(uid), message, parsed));
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return emails;
  }

  async getEmail(messageId: string): Promise<GmailEmail> {
    const client = this.createClient();

    try {
      await client.connect();
      const lock = await client.getMailboxLock('[Gmail]/All Mail');

      try {
        const message = await client.fetchOne(
          messageId,
          {
            envelope: true,
            flags: true,
            bodyStructure: true,
            source: true,
            labels: true,
          },
          { uid: true }
        );

        if (!message || !message.source) {
          throw new Error('Message not found');
        }

        const parsed = await simpleParser(message.source);
        return this.parseMessage(messageId, message, parsed, true);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async listLabels(): Promise<GmailLabel[]> {
    const client = this.createClient();
    const labels: GmailLabel[] = [];

    try {
      await client.connect();
      const mailboxes = await client.list();

      for (const mailbox of mailboxes) {
        try {
          const status = await client.status(mailbox.path, {
            messages: true,
            unseen: true,
          });

          labels.push({
            id: mailbox.path,
            name: mailbox.name,
            messageCount: status.messages || 0,
            unreadCount: status.unseen || 0,
          });
        } catch {
          // Some folders might not be accessible
          labels.push({
            id: mailbox.path,
            name: mailbox.name,
            messageCount: 0,
            unreadCount: 0,
          });
        }
      }
    } finally {
      await client.logout();
    }

    return labels;
  }

  async getEmailsInFolder(folderId: string, maxResults: number = 20): Promise<GmailEmail[]> {
    const client = this.createClient();
    const emails: GmailEmail[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folderId);

      try {
        const status = await client.status(folderId, { messages: true });
        const totalMessages = status.messages || 0;

        if (totalMessages === 0) {
          return [];
        }

        // Get the most recent messages
        const startSeq = Math.max(1, totalMessages - maxResults + 1);
        const range = `${startSeq}:*`;

        for await (const message of client.fetch(range, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          source: true,
          labels: true,
        })) {
          if (message.source) {
            const parsed = await simpleParser(message.source);
            emails.push(this.parseMessage(String(message.uid), message, parsed));
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return emails.reverse(); // Most recent first
  }

  private parseMessage(
    uid: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any,
    parsed: ParsedMail,
    includeBody: boolean = false
  ): GmailEmail {
    const envelope = message.envelope || {};
    const flags = message.flags || new Set();
    const labels = message.labels || [];

    const from = envelope.from?.[0];
    const to = envelope.to || [];

    return {
      id: uid,
      subject: envelope.subject || '(No Subject)',
      from: from ? `${from.name || ''} <${from.address || ''}>`.trim() : 'Unknown',
      to: to.map((t: { name?: string; address?: string }) =>
        `${t.name || ''} <${t.address || ''}>`.trim()
      ),
      date: envelope.date?.toISOString() || new Date().toISOString(),
      snippet: (parsed.text || '').substring(0, 200),
      body: includeBody ? parsed.text || parsed.html || '' : undefined,
      isRead: flags.has('\\Seen'),
      hasAttachments: (parsed.attachments?.length || 0) > 0,
      labels: Array.isArray(labels) ? labels : [],
    };
  }

  async testConnection(): Promise<void> {
    const client = this.createClient();
    try {
      await client.connect();
      // Just connecting successfully means credentials are valid
    } finally {
      await client.logout();
    }
  }
}
