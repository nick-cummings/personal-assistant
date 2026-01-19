'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useContext } from '@/hooks/use-context';

const DEFAULT_CONTEXT = `# About Me

<!-- Edit this section with information about yourself -->
- Name:
- Role:
- Team:

# Key Identifiers

<!-- These help the AI find your stuff across services -->
- GitHub username:
- Jira assignee name:
- Email address:

# Projects & Repositories

<!-- List the repos, Jira projects, and AWS resources you work with most -->

# Preferences

<!-- How do you like responses? Any specific formatting preferences? -->
- Preferred response style: concise / detailed
- Timezone:
`;

export default function ContextEditorPage() {
  const { data: context, isLoading, updateContext, isUpdating } = useContext();
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize content from fetched context
  useEffect(() => {
    if (context?.content) {
      setContent(context.content);
      setHasChanges(false);
    }
  }, [context?.content]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== context?.content);
  };

  const handleSave = () => {
    updateContext(
      { content },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const handleReset = () => {
    setContent(DEFAULT_CONTEXT);
    setHasChanges(DEFAULT_CONTEXT !== context?.content);
  };

  const handleRevert = () => {
    if (context?.content) {
      setContent(context.content);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/settings">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Settings</TooltipContent>
            </Tooltip>
            <div>
              <h1 className="text-xl font-semibold">My Context</h1>
              <p className="text-muted-foreground text-sm">
                This document helps the AI understand who you are and personalize responses
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Default
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to default template</TooltipContent>
            </Tooltip>
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleRevert}>
                Discard Changes
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isUpdating}>
              {isUpdating ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="mx-auto h-full max-w-4xl">
            <div className="relative h-full">
              <Textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="h-full resize-none font-mono text-sm"
                placeholder="Enter your context document in Markdown format..."
              />
              {hasChanges && (
                <div className="absolute right-3 top-3">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    Unsaved changes
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer help text */}
        <div className="border-t px-6 py-3">
          <p className="text-muted-foreground text-center text-xs">
            Use Markdown formatting. This context is included with every chat to help the AI provide
            personalized responses.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
