'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Sidebar } from '../../components/layout/sidebar';
import { TopBar } from '../../components/layout/topbar';
import { ToastContainer } from '../../components/ui/toast';
import { PinGate } from '../../components/layout/pin-gate';
import { useUIStore } from '../../lib/stores/uiStore';
import { useAccountStore } from '../../lib/stores/accountStore';
import { VersionChecker } from '../../components/shared/version-checker';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const unlocked = useUIStore((s) => s.unlocked);
  const loadAccounts = useAccountStore((s) => s.loadFromSupabase);

  useEffect(() => {
    if (unlocked) {
      loadAccounts();
    }
  }, [unlocked, loadAccounts]);

  if (!unlocked) return <PinGate />;

  return (
    <QueryClientProvider client={queryClient}>
      <VersionChecker />
      <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto pb-24 lg:pb-0">
            <div className="max-w-[1400px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
      <ToastContainer />
    </QueryClientProvider>
  );
}