import { AppShell } from '@/components/shared/app-shell';
import { MobileHeader } from '@/components/sidebar/mobile-sidebar';
import { Sidebar } from '@/components/sidebar/sidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex h-screen flex-col md:flex-row">
        {/* Mobile header with hamburger menu */}
        <MobileHeader />

        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </AppShell>
  );
}
