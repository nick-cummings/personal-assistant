import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';

export interface YahooImapConfig {
  email: string;
  appPassword: string;
}

export interface YahooEmail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export interface YahooFolder {
  id: string;
  name: string;
  messageCount: number;
  unreadCount: number;
}

export class YahooImapClient {
  private config: YahooImapConfig;

  constructor(config: YahooImapConfig) {
    this.config = config;
  }

  hasCredentials(): boolean {
    return !!(this.config.email && this.config.appPassword);
  }

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true,
      auth: {
        user: this.config.email,
        pass: this.config.appPassword,
      },
      logger: false,
    });
  }

  async searchEmails(query: string, maxResults: number = 20): Promise<YahooEmail[]> {
    const client = this.createClient();
    const emails: YahooEmail[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Search for messages - IMAP search syntax
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let searchCriteria: any = { all: true };

        if (query) {
          // Search in subject (IMAP TEXT search includes subject and body)
          searchCriteria = { text: query };
        }

        const searchResult = await client.search(searchCriteria, { uid: true });

        // Handle the case where search returns no messages
        if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
          return [];
        }

        const messages = searchResult;

        // Get the most recent messages (last N)
        const recentUids = messages.slice(-maxResults).reverse();

        for (const uid of recentUids) {
          const message = await client.fetchOne(
            String(uid),
            {
              envelope: true,
              flags: true,
              bodyStructure: true,
              source: true,
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

  async getEmail(messageId: string): Promise<YahooEmail> {
    const client = this.createClient();

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const message = await client.fetchOne(
          messageId,
          {
            envelope: true,
            flags: true,
            bodyStructure: true,
            source: true,
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

  async listFolders(): Promise<YahooFolder[]> {
    const client = this.createClient();
    const folders: YahooFolder[] = [];

    try {
      await client.connect();
      const mailboxes = await client.list();

      for (const mailbox of mailboxes) {
        try {
          const status = await client.status(mailbox.path, {
            messages: true,
            unseen: true,
          });

          folders.push({
            id: mailbox.path,
            name: mailbox.name,
            messageCount: status.messages || 0,
            unreadCount: status.unseen || 0,
          });
        } catch {
          // Some folders might not be accessible
          folders.push({
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

    return folders;
  }

  async getEmailsInFolder(folderId: string, maxResults: number = 20): Promise<YahooEmail[]> {
    const client = this.createClient();
    const emails: YahooEmail[] = [];

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
  ): YahooEmail {
    const envelope = message.envelope || {};
    const flags = message.flags || new Set();

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
