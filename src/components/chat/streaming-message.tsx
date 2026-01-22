'use client';

import type { ToolCallInfo } from '@/hooks/use-chat-stream';
import { cn } from '@/lib/utils';
import { Bot, Check, Loader2, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingMessageProps {
  content: string;
  toolCalls?: ToolCallInfo[];
  isToolRunning?: boolean;
}

// Format tool name for display (e.g., "jira_search_issues" -> "Jira Search Issues")
function formatToolName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StreamingMessage({
  content,
  toolCalls = [],
  isToolRunning = false,
}: StreamingMessageProps) {
  const isLoading = content.length === 0 && toolCalls.length === 0;
  const showSpinner = isLoading || isToolRunning;

  return (
    <div className="flex gap-3 py-4">
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-muted-foreground text-xs font-medium">Assistant</div>
        <div className={cn('bg-muted inline-block rounded-lg px-4 py-2 text-sm', 'text-left')}>
          {/* Initial loading state */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          )}

          {/* Tool calls display */}
          {toolCalls.length > 0 && (
            <div className="mb-3 space-y-2">
              {toolCalls.map((tool) => (
                <div
                  key={tool.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                    tool.state === 'pending'
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                      : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                  )}
                >
                  {tool.state === 'pending' ? (
                    <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  )}
                  <Wrench className="text-muted-foreground h-3 w-3" />
                  <span className="font-medium">{formatToolName(tool.name)}</span>
                  {tool.state === 'pending' && (
                    <span className="text-muted-foreground">Running...</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Streamed content */}
          {content.length > 0 && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <pre className="bg-background/50 my-2 overflow-x-auto rounded-md p-3">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-background/50 rounded px-1 py-0.5 text-xs" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="text-xs" {...props}>
                        {children}
                      </code>
                    );
                  },
                  a: ({ children, ...props }) => (
                    <a className="text-primary underline hover:no-underline" {...props}>
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="my-2 list-disc pl-4">{children}</ul>,
                  ol: ({ children }) => <ol className="my-2 list-decimal pl-4">{children}</ol>,
                  li: ({ children }) => <li className="my-1">{children}</li>,
                  h1: ({ children }) => <h1 className="mt-4 mb-2 text-lg font-bold">{children}</h1>,
                  h2: ({ children }) => (
                    <h2 className="mt-3 mb-2 text-base font-bold">{children}</h2>
                  ),
                  h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-bold">{children}</h3>,
                  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-primary/50 my-2 border-l-2 pl-3 italic">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="border-border my-4" />,
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto">
                      <table className="min-w-full border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-muted border-border border px-2 py-1 text-left font-medium">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-border border px-2 py-1">{children}</td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
              {/* Show cursor when actively streaming text */}
              {!showSpinner && (
                <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
              )}
            </div>
          )}

          {/* Show spinner after content when tool is running */}
          {content.length > 0 && isToolRunning && (
            <div className="border-border/50 mt-3 flex items-center gap-2 border-t pt-3">
              <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
              <span className="text-muted-foreground text-xs">Processing tool results...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
