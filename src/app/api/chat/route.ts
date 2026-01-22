import { getModel } from '@/lib/ai/client';
import { buildSystemPrompt, generateTitlePrompt } from '@/lib/ai/prompts';
import { getAllConnectorTools } from '@/lib/connectors';
import { db } from '@/lib/db';
import { generateText, stepCountIs, streamText, type ModelMessage } from 'ai';
import { NextRequest } from 'next/server';

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
    // Filter out empty assistant messages (placeholders from interrupted streams)
    const messages: ModelMessage[] = [
      ...chat.messages
        .filter((msg) => {
          // Keep all non-assistant messages
          if (msg.role !== 'assistant') return true;
          // Keep assistant messages that have content or tool calls
          return msg.content.trim() !== '' || (msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0);
        })
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content || ' ', // Ensure non-empty content for API
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

    // Track tool calls as they happen
    const collectedToolCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }> = [];

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(10), // Allow up to 10 tool call rounds for complex queries
      async onFinish({ text }) {
        // Update the assistant message with final content and tool calls
        await db.message.update({
          where: { id: assistantMessage.id },
          data: {
            content: text,
            toolCalls:
              collectedToolCalls.length > 0
                ? (collectedToolCalls as unknown as Parameters<
                    typeof db.message.update
                  >[0]['data']['toolCalls'])
                : undefined,
          },
        });

        // Generate title if needed - await so the title is ready when client refetches
        if (shouldGenerateTitle) {
          await generateChatTitle(chatId, message, modelId);
        }
      },
    });

    // Stream the response with tool call information
    // Use fullStream which includes tool-call and tool-result events
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            // Collect tool calls for saving to the database
            if (part.type === 'tool-call') {
              // The SDK uses 'args' for static tools and 'input' for dynamic tools
              const args = 'args' in part ? part.args : 'input' in part ? part.input : {};
              collectedToolCalls.push({
                id: part.toolCallId,
                name: part.toolName,
                args: args as Record<string, unknown>,
              });
            }

            // Send each part as a newline-delimited JSON event
            const event = JSON.stringify(part) + '\n';
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
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
