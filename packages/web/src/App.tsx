/**
 * packages/web/src/App.tsx
 * React Router setup for cPanel Clean-Room Jupiter Modernized Control Panel SPA.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { AdminAccountsPage } from './pages/AdminAccountsPage.tsx';
import { FileManagerPage } from './pages/FileManagerPage.tsx';
import { TerminalPage } from './pages/TerminalPage.tsx';
import { DomainsDnsPage } from './pages/DomainsDnsPage.tsx';
import { EmailSuitePage } from './pages/EmailSuitePage.tsx';
import { DatabasesPage } from './pages/DatabasesPage.tsx';
import { MultiPhpWpPage } from './pages/MultiPhpWpPage.tsx';
import { BackupsCpmovePage } from './pages/BackupsCpmovePage.tsx';
import { api } from './api/client.ts';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const token = api.getToken();

  if (isLoading && token) {
    return (
      <div className="min-h-screen bg-[#141721] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400">Loading Control Panel...</p>
        </div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/admin/accounts" element={<AdminAccountsPage />} />
            <Route path="/files" element={<FileManagerPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/domains" element={<DomainsDnsPage />} />
            <Route path="/email" element={<EmailSuitePage />} />
            <Route path="/databases" element={<DatabasesPage />} />
            <Route path="/software" element={<MultiPhpWpPage />} />
            <Route path="/backup" element={<BackupsCpmovePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
