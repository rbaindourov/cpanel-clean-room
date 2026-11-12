import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  UserCheck,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { AccountRecord } from '../types/api.ts';

export const AdminAccountsPage: React.FC = () => {
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    username: '',
    password: '',
    email: '',
    planName: 'Standard',
    quotaBytes: 10737418240, // 10 GB
    bandwidthLimitBytes: 107374182400, // 100 GB
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await api.admin.getAccounts();
      if (res && res.accounts) {
        setAccounts(res.accounts);
      }
    } catch (err: any) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleImpersonate = async (username: string) => {
    await startImpersonation(username);
    navigate('/');
  };

  const handleToggleSuspend = async (acc: AccountRecord) => {
    try {
      if (acc.status === 'active') {
        await api.admin.suspendAccount(acc.username, 'Admin suspension');
      } else {
        await api.admin.resumeAccount(acc.username);
      }
      await fetchAccounts();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Are you sure you want to permanently delete tenant account '${username}'?`)) return;
    try {
      await api.admin.deleteAccount(username);
      await fetchAccounts();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.admin.createAccount(newAccount);
      setIsModalOpen(false);
      setNewAccount({
        username: '',
        password: '',
        email: '',
        planName: 'Standard',
        quotaBytes: 10737418240,
        bandwidthLimitBytes: 107374182400,
      });
      await fetchAccounts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create account');
    }
  };

  const filtered = accounts.filter(
    (a) =>
      a.username.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (a.plan_name && a.plan_name.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-amber-500" />
            <span>WHM Account Manager</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage provisioned client accounts, quotas, and perform 1-Click Support Impersonation.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAccounts}
            className="p-2 bg-[#232736] hover:bg-[#2A2F42] border border-[#343B52] rounded-lg text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm shadow transition-colors flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter accounts by username, email, plan..."
            className="w-full bg-[#232736] border border-[#343B52] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing {filtered.length} of {accounts.length} Accounts
        </span>
      </div>

      {/* Accounts Table */}
      <div className="bg-[#232736] border border-[#343B52] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-200">
          <thead className="bg-[#1E2230] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#343B52]">
            <tr>
              <th className="py-3 px-4">Username</th>
              <th className="py-3 px-4">Contact Email</th>
              <th className="py-3 px-4">Plan / Quota</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#343B52]/60">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Loading account records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  No account records found.
                </td>
              </tr>
            ) : (
              filtered.map((acc) => (
                <tr key={acc.id} className="hover:bg-[#2A2F42] transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                    <span>{acc.username}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">{acc.email}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-200">{acc.plan_name || 'Standard'}</span>
                    <span className="text-slate-400 ml-1.5 font-mono text-[11px]">
                      ({(acc.quota_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB)
                    </span>
                  </td>
                  <td className="py-3 px-4 capitalize font-mono text-slate-300">{acc.role}</td>
                  <td className="py-3 px-4">
                    {acc.status === 'active' ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[11px]">
                        <CheckCircle className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-[11px]">
                        <XCircle className="w-3 h-3" />
                        <span>Suspended</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleImpersonate(acc.username)}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
                      title="1-Click Support Impersonation"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Impersonate</span>
                    </button>
                    <button
                      onClick={() => handleToggleSuspend(acc)}
                      className="p-1 hover:bg-[#1B1E2B] rounded text-slate-400 hover:text-amber-400 transition-colors"
                      title={acc.status === 'active' ? 'Suspend Account' : 'Resume Account'}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.username)}
                      className="p-1 hover:bg-[#1B1E2B] rounded text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete Tenant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#232736] border border-[#343B52] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[#343B52] flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <span>Provision New Client Tenant</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username (Linux UID & prefix)</label>
                <input
                  type="text"
                  required
                  value={newAccount.username}
                  onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value.toLowerCase() })}
                  placeholder="e.g. clientco"
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Account Password</label>
                <input
                  type="password"
                  required
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  placeholder="Strong password"
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Hosting Package</label>
                <select
                  value={newAccount.planName}
                  onChange={(e) => setNewAccount({ ...newAccount, planName: e.target.value })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Starter">Starter (5 GB)</option>
                  <option value="Standard">Standard (10 GB)</option>
                  <option value="Pro / Reseller">Pro / Reseller (50 GB)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded bg-[#1B1E2B] hover:bg-[#2A2F42] text-slate-300 border border-[#343B52]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
