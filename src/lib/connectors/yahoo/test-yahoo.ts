/**
 * Manual test script for Yahoo Mail connector
 *
 * Usage:
 *   npx tsx src/lib/connectors/yahoo/test-yahoo.ts
 *
 * Make sure to set environment variables or update the config below:
 *   YAHOO_EMAIL=your-email@yahoo.com
 *   YAHOO_APP_PASSWORD=your-16-char-app-password
 */

import { YahooImapClient } from './client';

const config = {
  email: process.env.YAHOO_EMAIL || '',
  appPassword: process.env.YAHOO_APP_PASSWORD || '',
};

async function main() {
  console.log('=== Yahoo Mail Connector Test ===\n');

  if (!config.email || !config.appPassword) {
    console.error('Error: Missing credentials');
    console.error('Set YAHOO_EMAIL and YAHOO_APP_PASSWORD environment variables');
    console.error('Example:');
    console.error(
      '  YAHOO_EMAIL=you@yahoo.com YAHOO_APP_PASSWORD=abcdefghijklmnop npx tsx src/lib/connectors/yahoo/test-yahoo.ts'
    );
    process.exit(1);
  }

  console.log('Email:', config.email);
  console.log('App Password:', config.appPassword.substring(0, 4) + '...\n');

  const client = new YahooImapClient(config);

  // Test 1: Check credentials method
  console.log('--- Test 1: hasCredentials() ---');
  console.log('Has credentials:', client.hasCredentials());
  console.log();

  // Test 2: Test connection
  console.log('--- Test 2: testConnection() ---');
  try {
    await client.testConnection();
    console.log('✓ Connection successful!\n');
  } catch (error) {
    console.error('✗ Connection failed:', error);
    process.exit(1);
  }

  // Test 3: List folders
  console.log('--- Test 3: listFolders() ---');
  try {
    const folders = await client.listFolders();
    console.log('Found', folders.length, 'folders:');
    for (const folder of folders) {
      console.log(
        `  - ${folder.name} (${folder.id}): ${folder.messageCount} messages, ${folder.unreadCount} unread`
      );
    }
    console.log();
  } catch (error) {
    console.error('✗ List folders failed:', error);
  }

  // Test 4: Search emails (empty query = all emails)
  console.log('--- Test 4: searchEmails("", 5) ---');
  let firstEmailId: string | null = null;
  try {
    const emails = await client.searchEmails('', 5);
    console.log('Found', emails.length, 'emails:');
    for (const email of emails) {
      console.log(`  - [${email.id}] ${email.subject}`);
      console.log(`    From: ${email.from}`);
      console.log(`    Date: ${email.date}`);
      console.log(`    Read: ${email.isRead}, Attachments: ${email.hasAttachments}`);
      console.log(`    Snippet: ${email.snippet.substring(0, 100)}...`);
      console.log();
      if (!firstEmailId) {
        firstEmailId = email.id;
      }
    }
  } catch (error) {
    console.error('✗ Search emails failed:', error);
  }

  // Test 5: Get specific email
  if (firstEmailId) {
    console.log('--- Test 5: getEmail("' + firstEmailId + '") ---');
    try {
      const email = await client.getEmail(firstEmailId);
      console.log('Got email:');
      console.log('  ID:', email.id);
      console.log('  Subject:', email.subject);
      console.log('  From:', email.from);
      console.log('  To:', email.to.join(', '));
      console.log('  Date:', email.date);
      console.log('  Read:', email.isRead);
      console.log('  Has Attachments:', email.hasAttachments);
      console.log('  Body length:', email.body?.length || 0, 'chars');
      console.log('  Body preview:', email.body?.substring(0, 200) || '(empty)');
      console.log();
    } catch (error) {
      console.error('✗ Get email failed:', error);
      if (error instanceof Error) {
        console.error('  Message:', error.message);
        console.error('  Stack:', error.stack);
      }
    }
  } else {
    console.log('--- Test 5: Skipped (no emails found) ---\n');
  }

  // Test 6: Get emails from INBOX folder
  console.log('--- Test 6: getEmailsInFolder("INBOX", 3) ---');
  try {
    const emails = await client.getEmailsInFolder('INBOX', 3);
    console.log('Found', emails.length, 'emails in INBOX:');
    for (const email of emails) {
      console.log(`  - [${email.id}] ${email.subject}`);
    }
    console.log();
  } catch (error) {
    console.error('✗ Get folder emails failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
