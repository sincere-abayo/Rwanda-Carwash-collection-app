import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full bg-background selection:bg-blue-500 selection:text-white">
      {/* Sidebar spacer for desktop */}
      <div className="hidden md:block md:w-64 lg:w-72 flex-shrink-0" aria-hidden="true">
        <BottomNav />
      </div>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-y-auto">
        {children}
      </div>

      {/* Mobile nav rendered at root */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

