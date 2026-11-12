import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ImpersonationBanner } from '../banners/ImpersonationBanner.tsx';
import { TopBar } from '../navigation/TopBar.tsx';
import { Sidebar } from '../navigation/Sidebar.tsx';
import { TelemetryRail } from '../telemetry/TelemetryRail.tsx';

export interface AppLayoutContext {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const AppLayout: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#1B1E2B] text-slate-100 flex flex-col">
      <ImpersonationBanner />
      <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <div className="flex flex-1 relative min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 overflow-y-auto">
          <Outlet context={{ searchQuery, setSearchQuery } satisfies AppLayoutContext} />
        </main>
        <TelemetryRail />
      </div>
    </div>
  );
};
