'use client';

import { Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  const isLoading = content.length === 0;

  return (
    <div className="flex gap-3 py-4">
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-muted-foreground text-xs font-medium">Assistant</div>
        <div className={cn('bg-muted inline-block rounded-lg px-4 py-2 text-sm', 'text-left')}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Thinking...</span>
            </div>
          ) : (
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
                  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>,
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
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
