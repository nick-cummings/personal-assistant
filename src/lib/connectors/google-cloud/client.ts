import type { GoogleCloudConfig } from '../types';

interface LogEntry {
  logName: string;
  timestamp: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  resource?: {
    type: string;
    labels: Record<string, string>;
  };
}

interface CloudFunction {
  name: string;
  status: string;
  entryPoint?: string;
  runtime?: string;
  timeout?: string;
  availableMemoryMb?: number;
  httpsTrigger?: { url: string };
  eventTrigger?: { eventType: string; resource: string };
}

interface ComputeInstance {
  id: string;
  name: string;
  zone: string;
  machineType: string;
  status: string;
  networkInterfaces?: Array<{
    networkIP?: string;
    accessConfigs?: Array<{ natIP?: string }>;
  }>;
}

interface GKECluster {
  name: string;
  location: string;
  status: string;
  currentNodeCount?: number;
  currentMasterVersion?: string;
  endpoint?: string;
}

export class GoogleCloudClient {
  private config: GoogleCloudConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: GoogleCloudConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Create JWT for service account authentication
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.config.clientEmail,
      scope: [
        'https://www.googleapis.com/auth/cloud-platform.read-only',
        'https://www.googleapis.com/auth/logging.read',
        'https://www.googleapis.com/auth/compute.readonly',
      ].join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const jwt = await this.createJWT(header, payload);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Google Cloud access token: ${error}`);
    }

    const tokens = await response.json();
    this.accessToken = tokens.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokens.expires_in - 60) * 1000);

    return this.accessToken!;
  }

  private async createJWT(
    header: { alg: string; typ: string },
    payload: Record<string, unknown>
  ): Promise<string> {
    const encoder = new TextEncoder();

    const headerB64 = this.base64urlEncode(JSON.stringify(header));
    const payloadB64 = this.base64urlEncode(JSON.stringify(payload));
    const signInput = `${headerB64}.${payloadB64}`;

    // Import the private key
    const privateKey = this.config.privateKey.replace(/\\n/g, '\n');
    const pemContents = privateKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(signInput)
    );

    const signatureB64 = this.base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));

    return `${signInput}.${signatureB64}`;
  }

  private base64urlEncode(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async makeRequest<T>(url: string): Promise<T> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Cloud API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async listLogEntries(filter?: string, maxResults: number = 100): Promise<LogEntry[]> {
    const accessToken = await this.getAccessToken();

    const body: Record<string, unknown> = {
      resourceNames: [`projects/${this.config.projectId}`],
      pageSize: maxResults,
      orderBy: 'timestamp desc',
    };

    if (filter) {
      body.filter = filter;
    }

    const response = await fetch('https://logging.googleapis.com/v2/entries:list', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Cloud Logging API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.entries || [];
  }

  async listCloudFunctions(): Promise<CloudFunction[]> {
    const region = this.config.region || '-'; // '-' means all regions
    const response = await this.makeRequest<{ functions?: CloudFunction[] }>(
      `https://cloudfunctions.googleapis.com/v1/projects/${this.config.projectId}/locations/${region}/functions`
    );
    return response.functions || [];
  }

  async getCloudFunction(name: string): Promise<CloudFunction> {
    return this.makeRequest<CloudFunction>(`https://cloudfunctions.googleapis.com/v1/${name}`);
  }

  async listComputeInstances(zone?: string): Promise<ComputeInstance[]> {
    if (zone) {
      const response = await this.makeRequest<{ items?: ComputeInstance[] }>(
        `https://compute.googleapis.com/compute/v1/projects/${this.config.projectId}/zones/${zone}/instances`
      );
      return response.items || [];
    }

    // List across all zones
    const response = await this.makeRequest<{
      items?: Record<string, { instances?: ComputeInstance[] }>;
    }>(
      `https://compute.googleapis.com/compute/v1/projects/${this.config.projectId}/aggregated/instances`
    );

    const instances: ComputeInstance[] = [];
    if (response.items) {
      for (const zoneData of Object.values(response.items)) {
        if (zoneData.instances) {
          instances.push(...zoneData.instances);
        }
      }
    }
    return instances;
  }

  async listGKEClusters(): Promise<GKECluster[]> {
    const response = await this.makeRequest<{ clusters?: GKECluster[] }>(
      `https://container.googleapis.com/v1/projects/${this.config.projectId}/locations/-/clusters`
    );
    return response.clusters || [];
  }

  async getProjectInfo(): Promise<{
    projectId: string;
    projectNumber: string;
    name: string;
    state: string;
  }> {
    return this.makeRequest(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${this.config.projectId}`
    );
  }

  async testConnection(): Promise<void> {
    await this.getProjectInfo();
  }
}
