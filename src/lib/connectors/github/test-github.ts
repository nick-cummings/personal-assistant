/**
 * Manual test script for GitHub connector
 *
 * Usage:
 *   bun run src/lib/connectors/github/test-github.ts
 *
 * Make sure to set environment variables in .env:
 *   GITHUB_TOKEN=your-personal-access-token
 *   GITHUB_DEFAULT_OWNER=your-github-username (optional)
 */

import { GitHubClient } from './client';

const config = {
  token: process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '',
  defaultOwner: process.env.GITHUB_DEFAULT_OWNER || process.env.GITHUB_OWNER || '',
};

// Use a well-known public repo for testing
const TEST_REPO = 'facebook/react';

async function main() {
  console.log('=== GitHub Connector Test ===\n');

  if (!config.token) {
    console.error('Error: Missing credentials');
    console.error('Set GITHUB_TOKEN environment variable');
    console.error('Example:');
    console.error('  GITHUB_TOKEN=ghp_xxxx bun run src/lib/connectors/github/test-github.ts');
    process.exit(1);
  }

  console.log('Token:', config.token.substring(0, 8) + '...');
  console.log('Default owner:', config.defaultOwner || '(not set)');
  console.log('Test repo:', TEST_REPO);
  console.log();

  const client = new GitHubClient(config);

  // Test 1: Check credentials method
  console.log('--- Test 1: hasCredentials() ---');
  console.log('Has credentials:', client.hasCredentials());
  console.log();

  // Test 2: Test connection
  console.log('--- Test 2: testConnection() ---');
  try {
    const user = await client.testConnection();
    console.log('Connection successful!');
    console.log('  Logged in as:', user.login);
    console.log();
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }

  // Test 3: List pull requests
  console.log(
    `--- Test 3: listPullRequests("${TEST_REPO}", { state: "open", limit via slice }) ---`
  );
  let firstPrNumber: number | null = null;
  try {
    const prs = await client.listPullRequests(TEST_REPO, { state: 'open' });
    const limitedPrs = prs.slice(0, 5);
    console.log('Found', prs.length, 'open pull requests (showing first 5):');
    for (const pr of limitedPrs) {
      console.log(`  - #${pr.number}: ${pr.title}`);
      console.log(`    Author: ${pr.user.login}, Branch: ${pr.head.ref} -> ${pr.base.ref}`);
      console.log(
        `    Draft: ${pr.draft}, Labels: ${pr.labels.map((l) => l.name).join(', ') || 'None'}`
      );
      console.log();
      if (!firstPrNumber) {
        firstPrNumber = pr.number;
      }
    }
  } catch (error) {
    console.error('List PRs failed:', error);
  }

  // Test 4: Get specific PR
  if (firstPrNumber) {
    console.log(`--- Test 4: getPullRequest("${TEST_REPO}", ${firstPrNumber}) ---`);
    try {
      const pr = await client.getPullRequest(TEST_REPO, firstPrNumber);
      console.log('Got pull request:');
      console.log('  Number:', pr.number);
      console.log('  Title:', pr.title);
      console.log('  Author:', pr.user.login);
      console.log('  State:', pr.state);
      console.log('  Draft:', pr.draft);
      console.log('  Additions:', pr.additions, ', Deletions:', pr.deletions);
      console.log('  Changed files:', pr.changed_files);
      console.log('  Mergeable state:', pr.mergeable_state || 'N/A');
      console.log('  Description:', (pr.body || '').substring(0, 100) + '...');
      console.log();
    } catch (error) {
      console.error('Get PR failed:', error);
    }
  } else {
    console.log('--- Test 4: Skipped (no open PRs found) ---\n');
  }

  // Test 5: Get PR comments
  if (firstPrNumber) {
    console.log(`--- Test 5: getPullRequestComments("${TEST_REPO}", ${firstPrNumber}) ---`);
    try {
      const { comments, reviews } = await client.getPullRequestComments(TEST_REPO, firstPrNumber);
      console.log('Found', comments.length, 'comments and', reviews.length, 'reviews:');
      for (const comment of comments.slice(0, 3)) {
        console.log(`  - Comment by ${comment.user.login} (${comment.created_at}):`);
        console.log(`    ${comment.body.substring(0, 80)}${comment.body.length > 80 ? '...' : ''}`);
      }
      if (comments.length > 3) {
        console.log(`  ... and ${comments.length - 3} more comments`);
      }
      for (const review of reviews.slice(0, 3)) {
        console.log(`  - Review by ${review.user.login}: ${review.state}`);
        if (review.body) {
          console.log(`    ${review.body.substring(0, 80)}${review.body.length > 80 ? '...' : ''}`);
        }
      }
      if (reviews.length > 3) {
        console.log(`  ... and ${reviews.length - 3} more reviews`);
      }
      console.log();
    } catch (error) {
      console.error('Get PR comments failed:', error);
    }
  } else {
    console.log('--- Test 5: Skipped (no open PRs found) ---\n');
  }

  // Test 6: List workflow runs
  console.log(`--- Test 6: listWorkflowRuns("${TEST_REPO}", { limit: 5 }) ---`);
  let firstRunId: number | null = null;
  try {
    const runs = await client.listWorkflowRuns(TEST_REPO, { limit: 5 });
    console.log('Found', runs.length, 'workflow runs:');
    for (const run of runs) {
      console.log(`  - [${run.id}] ${run.name} #${run.run_number}`);
      console.log(
        `    Branch: ${run.head_branch}, Status: ${run.status}, Conclusion: ${run.conclusion || 'N/A'}`
      );
      console.log(
        `    Commit: "${run.head_commit.message.substring(0, 50)}..." by ${run.head_commit.author.name}`
      );
      console.log();
      if (!firstRunId) {
        firstRunId = run.id;
      }
    }
  } catch (error) {
    console.error('List workflow runs failed:', error);
  }

  // Test 7: Get specific workflow run
  if (firstRunId) {
    console.log(`--- Test 7: getWorkflowRun("${TEST_REPO}", ${firstRunId}) ---`);
    try {
      const run = await client.getWorkflowRun(TEST_REPO, firstRunId);
      console.log('Got workflow run:');
      console.log('  ID:', run.id);
      console.log('  Name:', run.name);
      console.log('  Run number:', run.run_number);
      console.log('  Branch:', run.head_branch);
      console.log('  Status:', run.status);
      console.log('  Conclusion:', run.conclusion || 'N/A');
      console.log('  Created:', run.created_at);
      console.log('  Updated:', run.updated_at);
      console.log();
    } catch (error) {
      console.error('Get workflow run failed:', error);
    }
  } else {
    console.log('--- Test 7: Skipped (no workflow runs found) ---\n');
  }

  // Test 8: Search issues
  console.log('--- Test 8: searchIssues("repo:facebook/react is:issue is:open label:bug") ---');
  try {
    const results = await client.searchIssues('repo:facebook/react is:issue is:open label:bug');
    console.log('Found', results.length, 'results:');
    for (const item of results.slice(0, 5)) {
      const type = item.pull_request ? 'PR' : 'Issue';
      console.log(`  - [${type}] #${item.number}: ${item.title}`);
      console.log(`    State: ${item.state}, Author: ${item.user.login}`);
      console.log(`    Labels: ${item.labels.map((l) => l.name).join(', ') || 'None'}`);
      console.log();
    }
    if (results.length > 5) {
      console.log(`  ... and ${results.length - 5} more results`);
    }
  } catch (error) {
    console.error('Search issues failed:', error);
  }

  // Test 9: Search for PRs by author (if we have a default owner)
  if (config.defaultOwner) {
    console.log(`--- Test 9: searchIssues("is:pr author:${config.defaultOwner}") ---`);
    try {
      const results = await client.searchIssues(`is:pr author:${config.defaultOwner}`);
      console.log('Found', results.length, 'PRs by', config.defaultOwner, ':');
      for (const item of results.slice(0, 5)) {
        console.log(`  - #${item.number}: ${item.title}`);
        console.log(`    State: ${item.state}, Created: ${item.created_at}`);
      }
      if (results.length > 5) {
        console.log(`  ... and ${results.length - 5} more results`);
      }
      console.log();
    } catch (error) {
      console.error('Search by author failed:', error);
    }
  } else {
    console.log('--- Test 9: Skipped (no default owner set) ---\n');
  }

  // Test 10: List repos for authenticated user
  console.log('--- Test 10: listRepos() ---');
  try {
    const repos = await client.listRepos({ limit: 10, sort: 'updated' });
    console.log('Found', repos.length, 'repositories (showing up to 10):');
    for (const repo of repos) {
      console.log(`  - ${repo.full_name} (${repo.private ? 'private' : 'public'})`);
      console.log(
        `    Language: ${repo.language || 'N/A'}, Stars: ${repo.stargazers_count}, Forks: ${repo.forks_count}`
      );
      console.log(`    Last pushed: ${repo.pushed_at}`);
    }
    console.log();
  } catch (error) {
    console.error('List repos failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
