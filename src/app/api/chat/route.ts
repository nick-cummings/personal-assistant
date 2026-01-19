import { streamText, generateText, stepCountIs, type ModelMessage } from 'ai';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getModel } from '@/lib/ai/client';
import { buildSystemPrompt, generateTitlePrompt } from '@/lib/ai/prompts';
import { getAllConnectorTools } from '@/lib/connectors';

// Import connectors to ensure they're registered
import '@/lib/connectors';

export const maxDuration = 60;

interface ChatRequestBody {
  chatId: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { chatId, message } = body;

    if (!chatId || !message) {
      return new Response(JSON.stringify({ error: 'chatId and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the chat and settings
    const [chat, settings] = await Promise.all([
      db.chat.findUnique({
        where: { id: chatId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
      db.settings.findUnique({ where: { id: 'singleton' } }),
    ]);

    if (!chat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save the user message
    const userMessage = await db.message.create({
      data: {
        chatId,
        role: 'user',
        content: message,
      },
    });

    // Build system prompt
    const systemPrompt = await buildSystemPrompt();

    // Convert existing messages to ModelMessage format
    const messages: ModelMessage[] = [
      ...chat.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Get the selected model
    const modelId = settings?.selectedModel ?? 'claude-sonnet-4-20250514';
    const model = getModel(modelId);

    // Get connector tools
    const connectorTools = await getAllConnectorTools();
    const hasTools = Object.keys(connectorTools).length > 0;
    const tools = hasTools ? connectorTools : undefined;

    // Check if this is the first user message (for title generation)
    const isFirstMessage = chat.messages.filter((m) => m.role === 'user').length === 0;
    const shouldGenerateTitle = isFirstMessage && chat.title === 'New Chat';

    // Create assistant message placeholder that we'll update
    const assistantMessage = await db.message.create({
      data: {
        chatId,
        role: 'assistant',
        content: '',
      },
    });

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(5), // Allow up to 5 tool call rounds
      async onFinish({ text }) {
        // Update the assistant message with final content
        await db.message.update({
          where: { id: assistantMessage.id },
          data: { content: text },
        });

        // Generate title if needed (in background, don't block the response)
        if (shouldGenerateTitle) {
          generateChatTitle(chatId, message, modelId).catch(console.error);
        }
      },
    });

    // Return the stream with message IDs in headers
    return result.toTextStreamResponse({
      headers: {
        'X-User-Message-Id': userMessage.id,
        'X-Assistant-Message-Id': assistantMessage.id,
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function generateChatTitle(chatId: string, firstMessage: string, modelId: string) {
  try {
    const model = getModel(modelId);
    const { text } = await generateText({
      model,
      prompt: generateTitlePrompt(firstMessage),
      maxOutputTokens: 30,
    });

    const title = text.trim().replace(/^["']|["']$/g, '');
    if (title) {
      await db.chat.update({
        where: { id: chatId },
        data: { title },
      });
    }
  } catch (error) {
    console.error('Failed to generate chat title:', error);
  }
}
