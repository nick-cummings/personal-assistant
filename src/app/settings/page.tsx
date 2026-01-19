'use client';

import Link from 'next/link';
import { FileText, Settings as SettingsIcon, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your AI Chat Hub preferences</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Link href="/settings/context" className="block">
            <div className="hover:bg-accent flex items-center gap-4 rounded-lg border p-4 transition-colors">
              <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                <FileText className="text-primary h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-medium">My Context</h2>
                <p className="text-muted-foreground text-sm">
                  Edit your personal context document that the AI uses to personalize responses
                </p>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4 rounded-lg border p-4 opacity-50">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg">
              <Plug className="text-muted-foreground h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium">Connectors</h2>
              <p className="text-muted-foreground text-sm">
                Configure connections to external services (Coming in Phase 3)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg border p-4 opacity-50">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg">
              <SettingsIcon className="text-muted-foreground h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium">General Settings</h2>
              <p className="text-muted-foreground text-sm">
                Configure default model, system prompt, and other preferences (Coming soon)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
