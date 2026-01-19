'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateChat } from '@/hooks/use-chats';

export default function ChatPage() {
  const router = useRouter();
  const createChat = useCreateChat();

  const handleNewChat = () => {
    createChat.mutate(
      {},
      {
        onSuccess: (chat) => {
          router.push(`/chat/${chat.id}`);
        },
      }
    );
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
        <MessageSquare className="text-muted-foreground h-8 w-8" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Welcome to AI Chat Hub</h1>
        <p className="text-muted-foreground mt-2">
          Start a new conversation or select an existing chat from the sidebar.
        </p>
      </div>
      <Button onClick={handleNewChat} disabled={createChat.isPending}>
        <Plus className="mr-2 h-4 w-4" />
        New Chat
      </Button>
    </div>
  );
}
