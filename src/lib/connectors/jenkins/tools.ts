import { tool } from 'ai';
import { z } from 'zod';
import { JenkinsClient } from './client';
import type { ToolSet } from '../types';

export function createJenkinsTools(client: JenkinsClient): ToolSet {
  const jenkins_list_jobs = tool({
    description:
      'List all Jenkins jobs, optionally within a specific folder. Shows job names, status colors, and last build info.',
    inputSchema: z.object({
      folder: z
        .string()
        .optional()
        .describe('Folder path to list jobs from (e.g., "my-folder" or "parent/child")'),
    }),
    execute: async ({ folder }) => {
      const jobs = await client.listJobs(folder);

      return jobs.map((job) => ({
        name: job.name,
        url: job.url,
        status: job.color,
        buildable: job.buildable,
        description: job.description,
        lastBuild: job.lastBuild?.number,
        lastSuccessfulBuild: job.lastSuccessfulBuild?.number,
        lastFailedBuild: job.lastFailedBuild?.number,
      }));
    },
  });

  const jenkins_get_job_status = tool({
    description:
      'Get detailed status of a Jenkins job including health, recent builds, and parameters.',
    inputSchema: z.object({
      jobName: z
        .string()
        .describe('Job name, including folder path if applicable (e.g., "my-job" or "folder/my-job")'),
    }),
    execute: async ({ jobName }) => {
      const job = await client.getJobStatus(jobName);

      // Extract parameter definitions if available
      const parameters =
        job.property
          ?.find((p) => p.parameterDefinitions)
          ?.parameterDefinitions?.map((param) => ({
            name: param.name,
            description: param.description,
            type: param.type,
            defaultValue: param.defaultParameterValue?.value,
          })) ?? [];

      return {
        name: job.name,
        url: job.url,
        status: job.color,
        buildable: job.buildable,
        description: job.description,
        healthReport: job.healthReport?.map((h) => ({
          description: h.description,
          score: h.score,
        })),
        lastBuild: job.lastBuild?.number,
        lastSuccessfulBuild: job.lastSuccessfulBuild?.number,
        lastFailedBuild: job.lastFailedBuild?.number,
        lastCompletedBuild: job.lastCompletedBuild?.number,
        recentBuilds: job.builds?.slice(0, 10).map((b) => b.number),
        parameters,
      };
    },
  });

  const jenkins_get_build = tool({
    description: 'Get details about a specific Jenkins build including result, duration, and changes.',
    inputSchema: z.object({
      jobName: z
        .string()
        .describe('Job name, including folder path if applicable (e.g., "my-job" or "folder/my-job")'),
      buildNumber: z
        .union([z.number(), z.literal('lastBuild')])
        .describe('Build number or "lastBuild" for the most recent build'),
    }),
    execute: async ({ jobName, buildNumber }) => {
      const build = await client.getBuild(jobName, buildNumber);

      // Extract commit info from changesets
      const changes =
        build.changeSets?.flatMap((cs) =>
          cs.items.map((item) => ({
            commitId: item.commitId?.substring(0, 8),
            message: item.msg,
            author: item.author.fullName,
          }))
        ) ?? [];

      // Extract build triggers
      const triggers =
        build.causes?.map((c) => ({
          description: c.shortDescription,
          user: c.userName,
        })) ?? [];

      return {
        number: build.number,
        url: client.getBuildUrl(jobName, build.number),
        result: build.result,
        building: build.building,
        displayName: build.displayName,
        description: build.description,
        timestamp: new Date(build.timestamp).toISOString(),
        duration: build.duration,
        durationMinutes: Math.round(build.duration / 60000),
        estimatedDuration: build.estimatedDuration,
        triggers,
        changes,
      };
    },
  });

  const jenkins_get_build_log = tool({
    description:
      'Get the console output log from a Jenkins build. Can return full log or just the last N lines.',
    inputSchema: z.object({
      jobName: z
        .string()
        .describe('Job name, including folder path if applicable (e.g., "my-job" or "folder/my-job")'),
      buildNumber: z
        .union([z.number(), z.literal('lastBuild')])
        .describe('Build number or "lastBuild" for the most recent build'),
      tail: z
        .number()
        .optional()
        .describe('Only return the last N lines of the log. If omitted, returns full log.'),
    }),
    execute: async ({ jobName, buildNumber, tail }) => {
      const log = await client.getBuildLog(jobName, buildNumber, tail);

      // Truncate if too long (avoid sending huge logs to the model)
      const maxLength = 50000;
      const truncated = log.length > maxLength;
      const content = truncated ? log.substring(log.length - maxLength) : log;

      return {
        jobName,
        buildNumber: typeof buildNumber === 'number' ? buildNumber : 'lastBuild',
        url:
          typeof buildNumber === 'number'
            ? `${client.getBuildUrl(jobName, buildNumber)}/console`
            : `${client.getJobUrl(jobName)}/lastBuild/console`,
        truncated,
        lineCount: content.split('\n').length,
        log: content,
      };
    },
  });

  return {
    jenkins_list_jobs,
    jenkins_get_job_status,
    jenkins_get_build,
    jenkins_get_build_log,
  };
}
