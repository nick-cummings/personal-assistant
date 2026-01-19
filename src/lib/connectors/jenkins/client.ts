import type { JenkinsConfig } from '../types';

// Jenkins API response types
interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  buildable: boolean;
  description?: string;
  lastBuild?: {
    number: number;
    url: string;
  };
  lastSuccessfulBuild?: {
    number: number;
    url: string;
  };
  lastFailedBuild?: {
    number: number;
    url: string;
  };
  lastCompletedBuild?: {
    number: number;
    url: string;
  };
}

interface JenkinsBuild {
  number: number;
  url: string;
  result: string | null;
  building: boolean;
  timestamp: number;
  duration: number;
  estimatedDuration: number;
  displayName: string;
  description?: string;
  id: string;
  queueId: number;
  changeSets?: Array<{
    items: Array<{
      commitId: string;
      msg: string;
      author: {
        fullName: string;
      };
    }>;
  }>;
  causes?: Array<{
    shortDescription: string;
    userId?: string;
    userName?: string;
  }>;
}

interface JenkinsJobDetail extends JenkinsJob {
  builds: Array<{
    number: number;
    url: string;
  }>;
  healthReport: Array<{
    description: string;
    score: number;
  }>;
  property?: Array<{
    parameterDefinitions?: Array<{
      name: string;
      description: string;
      type: string;
      defaultParameterValue?: {
        value: string;
      };
    }>;
  }>;
}

interface JenkinsJobsResponse {
  jobs: JenkinsJob[];
}

export class JenkinsClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: JenkinsConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.authHeader =
      'Basic ' + Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const response = await fetch(`${url}/api/json`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jenkins API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private async fetchText(endpoint: string): Promise<string> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jenkins API error (${response.status}): ${error}`);
    }

    return response.text();
  }

  async listJobs(folder?: string): Promise<JenkinsJob[]> {
    const endpoint = folder ? `/job/${encodeURIComponent(folder)}` : '';
    const response = await this.fetch<JenkinsJobsResponse>(endpoint);
    return response.jobs ?? [];
  }

  async getJobStatus(jobName: string): Promise<JenkinsJobDetail> {
    const encodedName = jobName
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/job/');

    return this.fetch<JenkinsJobDetail>(`/job/${encodedName}`);
  }

  async getBuild(jobName: string, buildNumber: number | 'lastBuild'): Promise<JenkinsBuild> {
    const encodedName = jobName
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/job/');

    return this.fetch<JenkinsBuild>(`/job/${encodedName}/${buildNumber}`);
  }

  async getBuildLog(
    jobName: string,
    buildNumber: number | 'lastBuild',
    tail?: number
  ): Promise<string> {
    const encodedName = jobName
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/job/');

    const logEndpoint = tail
      ? `/job/${encodedName}/${buildNumber}/logText/progressiveText?start=0`
      : `/job/${encodedName}/${buildNumber}/consoleText`;

    const fullLog = await this.fetchText(logEndpoint);

    if (tail) {
      const lines = fullLog.split('\n');
      return lines.slice(-tail).join('\n');
    }

    return fullLog;
  }

  async testConnection(): Promise<void> {
    await this.listJobs();
  }

  getJobUrl(jobName: string): string {
    const encodedName = jobName
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/job/');
    return `${this.baseUrl}/job/${encodedName}`;
  }

  getBuildUrl(jobName: string, buildNumber: number): string {
    return `${this.getJobUrl(jobName)}/${buildNumber}`;
  }
}
