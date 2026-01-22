/**
 * Cleanup script for removing corrupted/empty messages from the database.
 *
 * Run with: bun src/scripts/cleanup-messages.ts
 *
 * This script will:
 * 1. Find all assistant messages with empty content and no tool calls
 * 2. Display them for review
 * 3. Delete them (with confirmation in interactive mode)
 */

import { db } from '../lib/db';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  console.log('🔍 Scanning for corrupted messages...\n');

  // Find empty assistant messages (no content and no tool calls)
  const emptyAssistantMessages = await db.message.findMany({
    where: {
      role: 'assistant',
      content: '',
    },
    include: {
      chat: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  // Filter to only those without tool calls
  const corruptedMessages = emptyAssistantMessages.filter((msg) => {
    const toolCalls = msg.toolCalls as unknown[];
    return !toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0;
  });

  if (corruptedMessages.length === 0) {
    console.log('✅ No corrupted messages found. Database is clean!\n');
    return;
  }

  console.log(`Found ${corruptedMessages.length} corrupted message(s):\n`);

  // Group by chat for better display
  const byChat = new Map<string, typeof corruptedMessages>();
  for (const msg of corruptedMessages) {
    const chatId = msg.chat.id;
    if (!byChat.has(chatId)) {
      byChat.set(chatId, []);
    }
    byChat.get(chatId)!.push(msg);
  }

  for (const [chatId, messages] of byChat) {
    const chatTitle = messages[0].chat.title;
    console.log(`📁 Chat: "${chatTitle}" (${chatId})`);
    for (const msg of messages) {
      console.log(`   - Message ${msg.id} (created: ${msg.createdAt.toISOString()})`);
    }
    console.log();
  }

  if (dryRun) {
    console.log('🔍 Dry run mode - no changes made.\n');
    console.log('Run without --dry-run to delete these messages.');
    return;
  }

  if (!force) {
    console.log('⚠️  Run with --force to delete these messages without confirmation.');
    console.log('    Or run with --dry-run to preview without changes.\n');
    return;
  }

  // Delete the corrupted messages
  console.log('🗑️  Deleting corrupted messages...\n');

  const result = await db.message.deleteMany({
    where: {
      id: {
        in: corruptedMessages.map((m) => m.id),
      },
    },
  });

  console.log(`✅ Deleted ${result.count} corrupted message(s).\n`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
