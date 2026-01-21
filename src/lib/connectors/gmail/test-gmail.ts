/**
 * Manual test script for Gmail connector
 *
 * Usage:
 *   npx tsx src/lib/connectors/gmail/test-gmail.ts
 *
 * Make sure to set environment variables or update the config below:
 *   GMAIL_EMAIL=your-email@gmail.com
 *   GMAIL_APP_PASSWORD=your-16-char-app-password
 *
 * To generate an App Password:
 *   1. Go to https://myaccount.google.com/apppasswords
 *   2. Select "Mail" and your device
 *   3. Copy the 16-character password
 */

import { GmailImapClient } from './client';

const config = {
  email: process.env.GMAIL_EMAIL || '',
  appPassword: process.env.GMAIL_APP_PASSWORD || '',
};

async function main() {
  console.log('=== Gmail Connector Test ===\n');

  if (!config.email || !config.appPassword) {
    console.error('Error: Missing credentials');
    console.error('Set GMAIL_EMAIL and GMAIL_APP_PASSWORD environment variables');
    console.error('Example:');
    console.error(
      '  GMAIL_EMAIL=you@gmail.com GMAIL_APP_PASSWORD=abcdefghijklmnop npx tsx src/lib/connectors/gmail/test-gmail.ts'
    );
    process.exit(1);
  }

  console.log('Email:', config.email);
  console.log('App Password:', config.appPassword.substring(0, 4) + '...\n');

  const client = new GmailImapClient(config);

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

  // Test 3: List labels/folders
  console.log('--- Test 3: listLabels() ---');
  try {
    const labels = await client.listLabels();
    console.log('Found', labels.length, 'labels/folders:');
    for (const label of labels) {
      console.log(`  - ${label.name} (${label.id}): ${label.messageCount} messages, ${label.unreadCount} unread`);
    }
    console.log();
  } catch (error) {
    console.error('✗ List labels failed:', error);
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
      console.log(`    Labels: ${email.labels.join(', ')}`);
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
      console.log('  Labels:', email.labels.join(', '));
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

  // Test 7: Get emails from Sent folder (Gmail-specific path)
  console.log('--- Test 7: getEmailsInFolder("[Gmail]/Sent Mail", 3) ---');
  try {
    const emails = await client.getEmailsInFolder('[Gmail]/Sent Mail', 3);
    console.log('Found', emails.length, 'emails in Sent Mail:');
    for (const email of emails) {
      console.log(`  - [${email.id}] ${email.subject}`);
    }
    console.log();
  } catch (error) {
    console.error('✗ Get sent emails failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
