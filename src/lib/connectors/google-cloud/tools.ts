import { tool } from 'ai';
import { z } from 'zod';
import type { GoogleCloudClient } from './client';
import type { ToolSet } from '../types';

export function createGoogleCloudTools(client: GoogleCloudClient): ToolSet {
  return {
    gcp_list_logs: tool({
      description: 'List recent log entries from Google Cloud Logging',
      inputSchema: z.object({
        filter: z.string().optional().describe('Log filter expression (e.g., "severity>=ERROR")'),
        maxResults: z.number().optional().default(100).describe('Maximum number of results'),
      }),
      execute: async ({ filter, maxResults }) => {
        const entries = await client.listLogEntries(filter, maxResults);
        return {
          count: entries.length,
          entries: entries.map((entry) => ({
            timestamp: entry.timestamp,
            severity: entry.severity,
            logName: entry.logName.split('/').pop(),
            message: entry.textPayload || JSON.stringify(entry.jsonPayload),
            resource: entry.resource?.type,
          })),
        };
      },
    }),

    gcp_list_functions: tool({
      description: 'List Cloud Functions in the project',
      inputSchema: z.object({}),
      execute: async () => {
        const functions = await client.listCloudFunctions();
        return {
          count: functions.length,
          functions: functions.map((fn) => ({
            name: fn.name.split('/').pop(),
            fullName: fn.name,
            status: fn.status,
            runtime: fn.runtime,
            entryPoint: fn.entryPoint,
            memory: fn.availableMemoryMb,
            timeout: fn.timeout,
            trigger: fn.httpsTrigger ? 'HTTP' : 'Event',
            url: fn.httpsTrigger?.url,
          })),
        };
      },
    }),

    gcp_get_function: tool({
      description: 'Get details of a specific Cloud Function',
      inputSchema: z.object({
        functionName: z.string().describe('Full resource name of the function'),
      }),
      execute: async ({ functionName }) => {
        const fn = await client.getCloudFunction(functionName);
        return {
          name: fn.name.split('/').pop(),
          fullName: fn.name,
          status: fn.status,
          runtime: fn.runtime,
          entryPoint: fn.entryPoint,
          memory: fn.availableMemoryMb,
          timeout: fn.timeout,
          httpTrigger: fn.httpsTrigger,
          eventTrigger: fn.eventTrigger,
        };
      },
    }),

    gcp_list_compute_instances: tool({
      description: 'List Compute Engine VM instances',
      inputSchema: z.object({
        zone: z.string().optional().describe('Zone to filter by (omit for all zones)'),
      }),
      execute: async ({ zone }) => {
        const instances = await client.listComputeInstances(zone);
        return {
          count: instances.length,
          instances: instances.map((instance) => ({
            id: instance.id,
            name: instance.name,
            zone: instance.zone.split('/').pop(),
            machineType: instance.machineType.split('/').pop(),
            status: instance.status,
            internalIP: instance.networkInterfaces?.[0]?.networkIP,
            externalIP: instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP,
          })),
        };
      },
    }),

    gcp_list_gke_clusters: tool({
      description: 'List GKE (Kubernetes) clusters in the project',
      inputSchema: z.object({}),
      execute: async () => {
        const clusters = await client.listGKEClusters();
        return {
          count: clusters.length,
          clusters: clusters.map((cluster) => ({
            name: cluster.name,
            location: cluster.location,
            status: cluster.status,
            nodeCount: cluster.currentNodeCount,
            masterVersion: cluster.currentMasterVersion,
            endpoint: cluster.endpoint,
          })),
        };
      },
    }),

    gcp_get_project_info: tool({
      description: 'Get information about the Google Cloud project',
      inputSchema: z.object({}),
      execute: async () => {
        return client.getProjectInfo();
      },
    }),
  };
}
