'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { useState } from 'react';

export interface SavedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ToolCallsSectionProps {
  toolCalls: SavedToolCall[];
  defaultOpen?: boolean;
}

// Format tool name for display (e.g., "jira_search_issues" -> "Jira Search Issues")
function formatToolName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ToolCallsSection({ toolCalls, defaultOpen = false }: ToolCallsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3" />
        <span>
          {toolCalls.length} step{toolCalls.length !== 1 ? 's' : ''} taken
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border-muted space-y-1.5 border-l-2 pl-4">
          {toolCalls.map((tool, index) => (
            <div
              key={tool.id || index}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
              )}
            >
              <Check className="h-3 w-3 flex-shrink-0 text-green-600 dark:text-green-400" />
              <span className="font-medium">{formatToolName(tool.name)}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
