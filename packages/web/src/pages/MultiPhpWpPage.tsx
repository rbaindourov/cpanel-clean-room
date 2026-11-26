/**
 * packages/web/src/pages/MultiPhpWpPage.tsx
 * MultiPHP Manager (5.6-8.5 FPM Pool Switcher, INI Directives) & WordPress Toolkit.
 */

import React, { useState, useEffect } from 'react';
import {
  Code,
  Layers,
  RefreshCw,
  ExternalLink,
  Plus,
  CheckCircle,
  AlertCircle,
  Settings,
  Copy,
  Zap,
  Globe,
} from 'lucide-react';
import { api } from '../api/client.ts';

export interface DomainPhpPool {
  domain: string;
  phpVersion: string;
  socketPath: string;
}

export interface WpInstallation {
  id: string;
  domain: string;
  path: string;
  version: string;
  autoUpdate: boolean;
  status: string;
}

export interface PhpDirectives {
  memory_limit: string;
  upload_max_filesize: string;
  post_max_size: string;
  max_execution_time: string;
  max_input_time: string;
  display_errors: string;
}

const SUPPORTED_PHP_VERSIONS = [
  '5.6', '7.0', '7.1', '7.2', '7.3', '7.4', '8.0', '8.1', '8.2', '8.3', '8.4', '8.5'
];

export const MultiPhpWpPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'php' | 'wp'>('php');
  const [pools, setPools] = useState<DomainPhpPool[]>([]);
  const [wpSites, setWpSites] = useState<WpInstallation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // INI Editor Modal
  const [iniDomain, setIniDomain] = useState<string | null>(null);
  const [directives, setDirectives] = useState<PhpDirectives>({
    memory_limit: '512M',
    upload_max_filesize: '512M',
    post_max_size: '512M',
    max_execution_time: '120',
    max_input_time: '60',
    display_errors: 'Off',
  });

  // Clone Modal
  const [cloneSite, setCloneSite] = useState<WpInstallation | null>(null);
  const [cloneTargetPath, setCloneTargetPath] = useState<string>('');

  // Install WP Modal
  const [showInstallWp, setShowInstallWp] = useState<boolean>(false);
  const [installData, setInstallData] = useState({
    domain: '',
    path: '/home/acme/public_html',
    title: 'My Clean Room Site',
    adminUser: 'admin',
    adminEmail: 'admin@example.com',
    dbName: 'wp',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [pRes, wRes] = await Promise.all([
        api.get<{ success: boolean; domainPools: DomainPhpPool[] }>('/software/php/domains'),
        api.get<{ success: boolean; installations: WpInstallation[] }>('/software/wordpress'),
      ]);
      setPools(pRes.domainPools || []);
      setWpSites(wRes.installations || []);
      if (pRes.domainPools && pRes.domainPools.length > 0 && !installData.domain) {
        setInstallData((prev) => ({ ...prev, domain: pRes.domainPools[0].domain }));
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to load runtimes data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePhpVersion = async (domain: string, toVersion: string) => {
    try {
      await api.put(`/software/php/domains/${encodeURIComponent(domain)}`, { phpVersion: toVersion });
      setPools(pools.map((p) => (p.domain === domain ? { ...p, phpVersion: toVersion } : p)));
      setNotice({ type: 'success', message: `PHP version for ${domain} switched to PHP ${toVersion}` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleOpenIni = async (domain: string) => {
    try {
      setIniDomain(domain);
      const res = await api.get<{ success: boolean; directives: PhpDirectives }>(`/software/php/ini/${encodeURIComponent(domain)}`);
      if (res.directives) setDirectives(res.directives);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleSaveIni = async () => {
    if (!iniDomain) return;
    try {
      await api.put(`/software/php/ini/${encodeURIComponent(iniDomain)}`, { directives });
      setIniDomain(null);
      setNotice({ type: 'success', message: `PHP INI directives updated and FPM reloaded for ${iniDomain}` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleWpSso = async (site: WpInstallation) => {
    try {
      const res = await api.post<{ success: boolean; loginUrl: string }>(`/software/wordpress/${site.id}/sso`, {
        domain: site.domain,
        path: site.path,
      });
      if (res.loginUrl) {
        window.open(res.loginUrl, '_blank');
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'WordPress SSO failed' });
    }
  };

  const handleToggleAutoUpdate = async (site: WpInstallation) => {
    try {
      const nextStatus = !site.autoUpdate;
      await api.put(`/software/wordpress/${site.id}/autoupdate`, {
        domain: site.domain,
        path: site.path,
        autoUpdate: nextStatus,
      });
      setWpSites(wpSites.map((s) => (s.id === site.id ? { ...s, autoUpdate: nextStatus } : s)));
      setNotice({ type: 'success', message: `Auto-update ${nextStatus ? 'enabled' : 'disabled'} for ${site.domain}` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleCloneWp = async () => {
    if (!cloneSite || !cloneTargetPath) return;
    try {
      await api.post('/software/wordpress/clone', {
        domain: cloneSite.domain,
        path: cloneSite.path,
        targetPath: cloneTargetPath,
      });
      setCloneSite(null);
      setNotice({ type: 'success', message: `WordPress cloned to ${cloneTargetPath} successfully` });
      fetchData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleInstallWp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/software/wordpress/install', installData);
      setShowInstallWp(false);
      setNotice({ type: 'success', message: `WordPress installed successfully on ${installData.domain}` });
      fetchData();
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
            <Code className="w-7 h-7 text-emerald-400" />
            MultiPHP Manager & WP-CLI Toolkit
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Independent Per-Domain PHP-FPM Pools (5.6–8.5), Custom INI Directives & WordPress Manager
          </p>
        </div>

        {notice && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
            notice.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
          }`}>
            {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {notice.message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#282D3F] mt-6 gap-2">
        <button
          onClick={() => setActiveTab('php')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'php' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          MultiPHP Manager ({pools.length})
        </button>
        <button
          onClick={() => setActiveTab('wp')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'wp' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          WordPress Toolkit ({wpSites.length})
        </button>
      </div>

      {/* Tab 1: MultiPHP Manager */}
      {activeTab === 'php' && (
        <div className="mt-6 space-y-4">
          <div className="bg-[#1B1E2B] rounded-xl border border-[#282D3F] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#13151f] text-slate-400 uppercase border-b border-[#282D3F]">
                <tr>
                  <th className="px-6 py-3">Domain</th>
                  <th className="px-6 py-3">Active PHP Version</th>
                  <th className="px-6 py-3">FPM Socket</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282D3F]">
                {pools.map((p) => {
                  const isEol = ['5.6', '7.0', '7.1', '7.2', '7.3', '7.4'].includes(p.phpVersion);
                  return (
                    <tr key={p.domain} className="hover:bg-[#202538] transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        {p.domain}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={p.phpVersion}
                            onChange={(e) => handleUpdatePhpVersion(p.domain, e.target.value)}
                            className="bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          >
                            {SUPPORTED_PHP_VERSIONS.map((v) => (
                              <option key={v} value={v}>PHP {v}</option>
                            ))}
                          </select>
                          {isEol && (
                            <span className="px-2 py-0.5 rounded text-2xs bg-amber-950 text-amber-400 border border-amber-800">
                              Legacy / EOL
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400 text-2xs">{p.socketPath}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenIni(p.domain)}
                          className="px-3 py-1.5 rounded text-xs font-semibold bg-[#202538] hover:bg-[#282F48] text-slate-300 border border-slate-700 flex items-center gap-1.5 ml-auto transition"
                        >
                          <Settings className="w-3.5 h-3.5" /> INI Editor
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pools.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No domain pools configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: WordPress Manager */}
      {activeTab === 'wp' && (
        <div className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Manage WP installations, staging environments & 1-click SSO</span>
            <button
              onClick={() => setShowInstallWp(true)}
              className="bg-[#1F2437] hover:bg-[#282F48] text-emerald-300 border border-emerald-800/60 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Install WordPress
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wpSites.map((site) => (
              <div key={site.id} className="bg-[#1B1E2B] p-6 rounded-xl border border-[#282D3F] space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-400" />
                      {site.domain}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">{site.path}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-950 text-blue-300 border border-blue-800">
                    WordPress {site.version}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#13151f] border border-[#282D3F]">
                  <span className="text-xs text-slate-300">Auto-Update Core & Plugins</span>
                  <button
                    onClick={() => handleToggleAutoUpdate(site)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      site.autoUpdate ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        site.autoUpdate ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleWpSso(site)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-900/30 transition"
                  >
                    <ExternalLink className="w-4 h-4" /> 1-Click WP Admin Login
                  </button>
                  <button
                    onClick={() => {
                      setCloneSite(site);
                      setCloneTargetPath(`${site.path}_staging`);
                    }}
                    className="bg-[#202538] hover:bg-[#282F48] text-slate-300 border border-slate-700 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-4 h-4" /> Clone / Staging
                  </button>
                </div>
              </div>
            ))}
            {wpSites.length === 0 && !isLoading && (
              <div className="col-span-2 p-8 text-center bg-[#1B1E2B] rounded-xl border border-[#282D3F] text-slate-500 text-xs">
                No WordPress sites found. Click "Install WordPress" to launch a new instance.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: INI Editor */}
      {iniDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              PHP INI Editor: {iniDomain}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">memory_limit</label>
                <input
                  type="text"
                  value={directives.memory_limit}
                  onChange={(e) => setDirectives({ ...directives, memory_limit: e.target.value })}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">upload_max_filesize</label>
                <input
                  type="text"
                  value={directives.upload_max_filesize}
                  onChange={(e) => setDirectives({ ...directives, upload_max_filesize: e.target.value })}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">post_max_size</label>
                <input
                  type="text"
                  value={directives.post_max_size}
                  onChange={(e) => setDirectives({ ...directives, post_max_size: e.target.value })}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">max_execution_time (sec)</label>
                <input
                  type="text"
                  value={directives.max_execution_time}
                  onChange={(e) => setDirectives({ ...directives, max_execution_time: e.target.value })}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
              <button
                type="button"
                onClick={() => setIniDomain(null)}
                className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveIni}
                className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
              >
                Save Directives
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clone Staging */}
      {cloneSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-400" />
              Clone WordPress to Staging
            </h3>
            <p className="text-xs text-slate-400">
              Source: <span className="font-mono text-white">{cloneSite.path}</span> ({cloneSite.domain})
            </p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Directory Path</label>
              <input
                type="text"
                value={cloneTargetPath}
                onChange={(e) => setCloneTargetPath(e.target.value)}
                className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-xs text-white font-mono"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
              <button
                type="button"
                onClick={() => setCloneSite(null)}
                className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloneWp}
                className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                Start Clone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Install WordPress */}
      {showInstallWp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Install WordPress via WP-CLI
            </h3>
            <form onSubmit={handleInstallWp} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Domain</label>
                  <select
                    value={installData.domain}
                    onChange={(e) => setInstallData({ ...installData, domain: e.target.value })}
                    className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                  >
                    {pools.map((p) => (
                      <option key={p.domain} value={p.domain}>{p.domain}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Site Title</label>
                  <input
                    type="text"
                    value={installData.title}
                    onChange={(e) => setInstallData({ ...installData, title: e.target.value })}
                    className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Install Path</label>
                <input
                  type="text"
                  value={installData.path}
                  onChange={(e) => setInstallData({ ...installData, path: e.target.value })}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Admin Username</label>
                  <input
                    type="text"
                    value={installData.adminUser}
                    onChange={(e) => setInstallData({ ...installData, adminUser: e.target.value })}
                    className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={installData.adminEmail}
                    onChange={(e) => setInstallData({ ...installData, adminEmail: e.target.value })}
                    className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-1.5 text-xs text-white"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
                <button
                  type="button"
                  onClick={() => setShowInstallWp(false)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
                >
                  Install Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
