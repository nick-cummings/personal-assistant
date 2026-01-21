'use client';

import { useState } from 'react';
import { User, Bot, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { RichLinkCard, detectLinkType } from './rich-link-card';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isTool) {
    return (
      <div className="flex gap-3 py-2">
        <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-muted-foreground text-xs font-medium">Tool: {message.toolName}</div>
          <div className="bg-muted rounded-md p-3 text-sm">
            <pre className="font-mono text-xs whitespace-pre-wrap">{message.content}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('group flex gap-3 py-4', isUser && 'flex-row-reverse')}>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        <div className={cn('flex-1 space-y-2', isUser && 'text-right')}>
          <div className="text-muted-foreground text-xs font-medium">
            {isUser ? 'You' : 'Assistant'}
          </div>
        <div
          className={cn(
            'inline-block rounded-lg px-4 py-2 text-sm',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
            !isUser && 'text-left'
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style code blocks
                  pre: ({ children }) => (
                    <pre className="bg-background/50 overflow-x-auto rounded-md p-3 my-2">
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
                  // Style links - use rich cards for recognized external URLs
                  a: ({ children, href, ...props }) => {
                    // Check if this is a recognized external link
                    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                      const linkType = detectLinkType(href);
                      if (linkType !== 'generic') {
                        // Render as rich link card for recognized services
                        const title = typeof children === 'string' ? children : href;
                        return (
                          <RichLinkCard
                            url={href}
                            title={title}
                            type={linkType}
                          />
                        );
                      }
                    }
                    // Default link styling for unrecognized or internal links
                    return (
                      <a
                        className="text-primary underline hover:no-underline"
                        href={href}
                        target={href?.startsWith('http') ? '_blank' : undefined}
                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  // Style lists
                  ul: ({ children }) => <ul className="list-disc pl-4 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 my-2">{children}</ol>,
                  li: ({ children }) => <li className="my-1">{children}</li>,
                  // Style headings
                  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                  // Style paragraphs - use div to allow block-level children like RichLinkCard
                  p: ({ children }) => <div className="my-2 first:mt-0 last:mb-0">{children}</div>,
                  // Style blockquotes
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic">
                      {children}
                    </blockquote>
                  ),
                  // Style horizontal rules
                  hr: () => <hr className="my-4 border-border" />,
                  // Style tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-2 py-1 bg-muted font-medium text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1">{children}</td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isAssistant && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy message'}</TooltipContent>
            </Tooltip>
          )}
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
