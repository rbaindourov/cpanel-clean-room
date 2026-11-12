/**
 * packages/web/src/pages/DatabasesPage.tsx
 * MySQL Databases, Users, Grant Privileges Matrix, Remote Host Whitelist & phpMyAdmin SSO.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  CheckCircle,
  AlertCircle,
  Server,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client.ts';

export interface DatabaseRecord {
  id: string;
  db_name: string;
  charset: string;
  collation: string;
  size_bytes: number;
}

export interface DatabaseUserRecord {
  id: string;
  db_user: string;
  remote_host: string;
}

export interface GrantRecord {
  id: string;
  db_name: string;
  db_user: string;
  privileges: string;
}

export interface RemoteIpRecord {
  id: string;
  ip_or_cidr: string;
  comment?: string;
}

const ALL_PRIVILEGES_LIST = [
  'ALTER',
  'ALTER ROUTINE',
  'CREATE',
  'CREATE ROUTINE',
  'CREATE TEMPORARY TABLES',
  'CREATE VIEW',
  'DELETE',
  'DROP',
  'EVENT',
  'EXECUTE',
  'INDEX',
  'INSERT',
  'LOCK TABLES',
  'REFERENCES',
  'SELECT',
  'SHOW VIEW',
  'TRIGGER',
  'UPDATE',
];

export const DatabasesPage: React.FC = () => {
  const [databases, setDatabases] = useState<DatabaseRecord[]>([]);
  const [users, setUsers] = useState<DatabaseUserRecord[]>([]);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [remoteIps, setRemoteIps] = useState<RemoteIpRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showCreateDb, setShowCreateDb] = useState<boolean>(false);
  const [newDbSuffix, setNewDbSuffix] = useState<string>('');

  const [showCreateUser, setShowCreateUser] = useState<boolean>(false);
  const [newUserSuffix, setNewUserSuffix] = useState<string>('');
  const [newUserPass, setNewUserPass] = useState<string>('');

  const [showGrantModal, setShowGrantModal] = useState<boolean>(false);
  const [grantDb, setGrantDb] = useState<string>('');
  const [grantUser, setGrantUser] = useState<string>('');
  const [selectedPrivs, setSelectedPrivs] = useState<string[]>(['ALL PRIVILEGES']);

  const [showRemoteIpModal, setShowRemoteIpModal] = useState<boolean>(false);
  const [newIpOrCidr, setNewIpOrCidr] = useState<string>('');
  const [newIpComment, setNewIpComment] = useState<string>('');

  useEffect(() => {
    fetchDatabasesData();
  }, []);

  const fetchDatabasesData = async () => {
    try {
      setIsLoading(true);
      const [res, ipRes] = await Promise.all([
        api.get<{ success: boolean; databases: DatabaseRecord[]; users: DatabaseUserRecord[]; grants: GrantRecord[] }>('/databases/mysql'),
        api.get<{ success: boolean; remoteIps: RemoteIpRecord[] }>('/databases/mysql/remote-ips'),
      ]);
      setDatabases(res.databases || []);
      setUsers(res.users || []);
      setGrants(res.grants || []);
      setRemoteIps(ipRes.remoteIps || []);

      if (res.databases && res.databases.length > 0) setGrantDb(res.databases[0].db_name);
      if (res.users && res.users.length > 0) setGrantUser(res.users[0].db_user);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to load MySQL databases' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchPma = async (targetDb?: string) => {
    try {
      const res = await api.post<{ success: boolean; redirectUrl: string }>('/databases/pma/sso', {
        targetDatabase: targetDb,
      });
      if (res.redirectUrl) {
        window.open(res.redirectUrl, '_blank');
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'phpMyAdmin SSO failed' });
    }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbSuffix) return;
    try {
      await api.post('/databases/mysql/databases', { databaseName: newDbSuffix });
      setShowCreateDb(false);
      setNewDbSuffix('');
      setNotice({ type: 'success', message: 'Database created successfully' });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleDeleteDatabase = async (dbName: string) => {
    if (!confirm(`Permanently drop database '${dbName}' and all tables?`)) return;
    try {
      await api.delete(`/databases/mysql/databases/${encodeURIComponent(dbName)}`);
      setNotice({ type: 'success', message: `Database ${dbName} dropped` });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserSuffix || !newUserPass) return;
    try {
      await api.post('/databases/mysql/users', { dbUserSuffix: newUserSuffix, password: newUserPass });
      setShowCreateUser(false);
      setNewUserSuffix('');
      setNewUserPass('');
      setNotice({ type: 'success', message: 'Database user created successfully' });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleDeleteUser = async (dbUser: string) => {
    if (!confirm(`Delete database user '${dbUser}'?`)) return;
    try {
      await api.delete(`/databases/mysql/users/${encodeURIComponent(dbUser)}`);
      setNotice({ type: 'success', message: `User ${dbUser} deleted` });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleAssignGrants = async () => {
    try {
      await api.post('/databases/mysql/grants', {
        databaseName: grantDb,
        dbUserSuffix: grantUser,
        privileges: selectedPrivs,
      });
      setShowGrantModal(false);
      setNotice({ type: 'success', message: `Privileges assigned for ${grantUser} on ${grantDb}` });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleAddRemoteIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIpOrCidr) return;
    try {
      await api.post('/databases/mysql/remote-ips', { ipOrCidr: newIpOrCidr, comment: newIpComment });
      setShowRemoteIpModal(false);
      setNewIpOrCidr('');
      setNewIpComment('');
      setNotice({ type: 'success', message: 'Remote access IP whitelisted' });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleDeleteRemoteIp = async (id: string) => {
    try {
      await api.delete(`/databases/mysql/remote-ips/${id}`);
      setNotice({ type: 'success', message: 'Remote access host removed' });
      fetchDatabasesData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="p-6 bg-[#0F111A] min-h-screen text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#282D3F]">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-7 h-7 text-amber-500" />
            MySQL Databases & phpMyAdmin
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            MariaDB 10.11 Tenant Database Isolation, Granular Privileges & 1-Click phpMyAdmin SSO
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleLaunchPma()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 shadow-lg shadow-amber-900/30 transition"
          >
            <ExternalLink className="w-4 h-4" /> Launch phpMyAdmin SSO
          </button>
        </div>
      </div>

      {notice && (
        <div className={`mt-4 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
          notice.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
        }`}>
          {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notice.message}
        </div>
      )}

      {/* Databases Section */}
      <div className="mt-8 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400" />
            Current Databases ({databases.length})
          </h2>
          <button
            onClick={() => setShowCreateDb(true)}
            className="bg-[#1F2437] hover:bg-[#282F48] text-amber-300 border border-amber-800/60 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Create Database
          </button>
        </div>

        <div className="bg-[#1B1E2B] rounded-xl border border-[#282D3F] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#13151f] text-slate-400 uppercase border-b border-[#282D3F]">
              <tr>
                <th className="px-6 py-3">Database Name</th>
                <th className="px-6 py-3">Charset / Collation</th>
                <th className="px-6 py-3">Privileged Users</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282D3F]">
              {databases.map((db) => {
                const dbGrants = grants.filter((g) => g.db_name === db.db_name);
                return (
                  <tr key={db.id || db.db_name} className="hover:bg-[#202538] transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      {db.db_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {db.charset || 'utf8mb4'} / {db.collation || 'utf8mb4_unicode_ci'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {dbGrants.map((g) => (
                          <span key={g.id || `${g.db_user}-${g.db_name}`} className="px-2 py-0.5 rounded text-2xs bg-slate-800 text-slate-300 border border-slate-700">
                            {g.db_user}
                          </span>
                        ))}
                        {dbGrants.length === 0 && <span className="text-slate-500">None</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleLaunchPma(db.db_name)}
                          className="px-2.5 py-1 rounded text-2xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800 hover:bg-amber-900/60 flex items-center gap-1 transition"
                          title="Open database in phpMyAdmin"
                        >
                          <ExternalLink className="w-3 h-3" /> PMA
                        </button>
                        <button
                          onClick={() => handleDeleteDatabase(db.db_name)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                          title="Drop Database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {databases.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No databases created yet. Click "Create Database" to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users & Privileges Section */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MySQL Users */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              MySQL Users ({users.length})
            </h2>
            <button
              onClick={() => setShowCreateUser(true)}
              className="bg-[#1F2437] hover:bg-[#282F48] text-blue-300 border border-blue-800/60 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add User
            </button>
          </div>

          <div className="bg-[#1B1E2B] rounded-xl border border-[#282D3F] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#13151f] text-slate-400 uppercase border-b border-[#282D3F]">
                <tr>
                  <th className="px-6 py-3">Username</th>
                  <th className="px-6 py-3">Host</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282D3F]">
                {users.map((u) => (
                  <tr key={u.id || u.db_user} className="hover:bg-[#202538] transition-colors">
                    <td className="px-6 py-3 font-mono font-medium text-white">{u.db_user}</td>
                    <td className="px-6 py-3 font-mono text-slate-400">{u.remote_host || 'localhost'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.db_user)}
                        className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-slate-500">
                      No database users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User-to-Database Privileges Assignment */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Assign User Privileges
            </h2>
            <button
              onClick={() => setShowGrantModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-xs font-semibold transition"
            >
              Assign Privileges
            </button>
          </div>

          <div className="bg-[#1B1E2B] p-4 rounded-xl border border-[#282D3F] space-y-3">
            <p className="text-xs text-slate-400">
              Grant permissions (e.g. <code>ALL PRIVILEGES</code>, <code>SELECT</code>, <code>INSERT</code>) to connect database users to specific databases.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {grants.map((g) => (
                <div key={g.id || `${g.db_user}-${g.db_name}`} className="p-2.5 rounded bg-[#13151f] border border-[#282D3F] flex justify-between items-center text-xs">
                  <div>
                    <span className="font-mono text-white font-semibold">{g.db_user}</span>
                    <span className="text-slate-500 mx-2">→</span>
                    <span className="font-mono text-amber-300">{g.db_name}</span>
                  </div>
                  <span className="text-2xs text-slate-400 truncate max-w-xs">{g.privileges}</span>
                </div>
              ))}
              {grants.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">No privilege grants active.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Remote MySQL IP Whitelist */}
      <div className="mt-10 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            Remote MySQL Access Hosts ({remoteIps.length})
          </h2>
          <button
            onClick={() => setShowRemoteIpModal(true)}
            className="bg-[#1F2437] hover:bg-[#282F48] text-emerald-300 border border-emerald-800/60 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Whitelist IP / CIDR
          </button>
        </div>

        <div className="bg-[#1B1E2B] rounded-xl border border-[#282D3F] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#13151f] text-slate-400 uppercase border-b border-[#282D3F]">
              <tr>
                <th className="px-6 py-3">IP Address / CIDR</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282D3F]">
              {remoteIps.map((ip) => (
                <tr key={ip.id || ip.ip_or_cidr} className="hover:bg-[#202538] transition-colors">
                  <td className="px-6 py-3 font-mono font-medium text-emerald-400">{ip.ip_or_cidr}</td>
                  <td className="px-6 py-3 text-slate-400">{ip.comment || '-'}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleDeleteRemoteIp(ip.id)}
                      className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {remoteIps.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-slate-500">
                    No remote MySQL access hosts configured. Port 3306 accepts only localhost connections.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Database */}
      {showCreateDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              Create New MySQL Database
            </h3>
            <form onSubmit={handleCreateDatabase} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Database Name Suffix</label>
                <input
                  type="text"
                  placeholder="e.g. blog or shop"
                  value={newDbSuffix}
                  onChange={(e) => setNewDbSuffix(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
                <p className="text-2xs text-slate-500 mt-1">Will be prefixed with your account username automatically.</p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
                <button
                  type="button"
                  onClick={() => setShowCreateDb(false)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition"
                >
                  Create Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              Create MySQL User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Username Suffix</label>
                <input
                  type="text"
                  placeholder="e.g. appuser"
                  value={newUserSuffix}
                  onChange={(e) => setNewUserSuffix(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Strong database password"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Remote IP */}
      {showRemoteIpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              Whitelist Remote MySQL Host
            </h3>
            <form onSubmit={handleAddRemoteIp} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">IP Address or CIDR Subnet</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.100 or 10.0.0.0/24"
                  value={newIpOrCidr}
                  onChange={(e) => setNewIpOrCidr(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description / Comment</label>
                <input
                  type="text"
                  placeholder="e.g. Office VPN or Staging Server"
                  value={newIpComment}
                  onChange={(e) => setNewIpComment(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
                <button
                  type="button"
                  onClick={() => setShowRemoteIpModal(false)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
                >
                  Add IP Host
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Grant Privileges Matrix */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Assign MySQL Privileges
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">User</label>
                <select
                  value={grantUser}
                  onChange={(e) => setGrantUser(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                >
                  {users.map((u) => <option key={u.id || u.db_user} value={u.db_user}>{u.db_user}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Database</label>
                <select
                  value={grantDb}
                  onChange={(e) => setGrantDb(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                >
                  {databases.map((d) => <option key={d.id || d.db_name} value={d.db_name}>{d.db_name}</option>)}
                </select>
              </div>
            </div>

            <div className="border border-[#282D3F] rounded p-3 bg-[#0F111A]">
              <div className="flex justify-between items-center pb-2 mb-2 border-b border-[#282D3F]">
                <span className="text-xs font-semibold text-slate-300">Privileges</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPrivs.includes('ALL PRIVILEGES')) {
                      setSelectedPrivs([]);
                    } else {
                      setSelectedPrivs(['ALL PRIVILEGES']);
                    }
                  }}
                  className="text-2xs text-blue-400 hover:text-blue-300"
                >
                  {selectedPrivs.includes('ALL PRIVILEGES') ? 'Unselect All' : 'Select All Privileges'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {ALL_PRIVILEGES_LIST.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-2xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPrivs.includes('ALL PRIVILEGES') || selectedPrivs.includes(p)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPrivs([...selectedPrivs.filter((x) => x !== 'ALL PRIVILEGES'), p]);
                        } else {
                          setSelectedPrivs(selectedPrivs.filter((x) => x !== p && x !== 'ALL PRIVILEGES'));
                        }
                      }}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
              <button
                type="button"
                onClick={() => setShowGrantModal(false)}
                className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignGrants}
                className="px-4 py-2 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
              >
                Apply Privileges
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
