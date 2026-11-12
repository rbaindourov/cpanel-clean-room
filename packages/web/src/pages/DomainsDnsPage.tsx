import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit3, 
  Cloud, 
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { api } from '../api/client.ts';

export interface DomainItem {
  id: string;
  user_id: string;
  domain_name: string;
  type: 'primary' | 'addon' | 'subdomain' | 'alias';
  docroot: string;
  php_version: string;
  ssl_enabled: number;
  ssl_status: 'none' | 'pending' | 'active' | 'expired';
  force_https: number;
  use_apache_backend: number;
}

export interface DnsRecordItem {
  id: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS' | 'SOA';
  value: string;
  ttl: number;
  priority?: number;
  weight?: number;
  port?: number;
}

export interface RedirectItem {
  id: string;
  source_path: string;
  target_url: string;
  status_code: 301 | 302;
  match_type: 'exact' | 'regex' | 'wildcard';
}

export const DomainsDnsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'domains' | 'zone' | 'redirects'>('domains');
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Zone Editor State
  const [dnsRecords, setDnsRecords] = useState<DnsRecordItem[]>([]);
  const [dnsFilter, setDnsFilter] = useState<string>('ALL');
  const [newRecord, setNewRecord] = useState<{
    name: string;
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA';
    value: string;
    ttl: number;
    priority: number;
  }>({
    name: '',
    type: 'A',
    value: '',
    ttl: 300,
    priority: 0,
  });

  const [editingRecord, setEditingRecord] = useState<DnsRecordItem | null>(null);

  // Redirects State
  const [redirects, setRedirects] = useState<RedirectItem[]>([]);
  const [newRedirect, setNewRedirect] = useState({
    sourcePath: '',
    targetUrl: '',
    statusCode: 301 as 301 | 302,
    matchType: 'exact' as 'exact' | 'regex' | 'wildcard',
  });

  // Cloudflare Sync Modal
  const [showCfModal, setShowCfModal] = useState<boolean>(false);
  const [cfToken, setCfToken] = useState<string>('');
  const [syncingCf, setSyncingCf] = useState<boolean>(false);

  // AutoSSL in progress map
  const [autoSslRunning, setAutoSslRunning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDomains();
  }, []);

  useEffect(() => {
    if (selectedDomainId) {
      if (activeTab === 'zone') fetchZone(selectedDomainId);
      if (activeTab === 'redirects') fetchRedirects(selectedDomainId);
    }
  }, [selectedDomainId, activeTab]);

  const fetchDomains = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; domains: DomainItem[] }>('/domains');
      if (res && res.domains) {
        setDomains(res.domains);
        if (res.domains.length > 0 && !selectedDomainId) {
          setSelectedDomainId(res.domains[0].id);
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load domains' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchZone = async (domainId: string) => {
    try {
      const res = await api.get<{ success: boolean; records: DnsRecordItem[] }>(`/domains/${domainId}/zone`);
      setDnsRecords(res.records || []);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load DNS zone' });
    }
  };

  const fetchRedirects = async (domainId: string) => {
    try {
      const res = await api.get<{ success: boolean; redirects: RedirectItem[] }>(`/domains/${domainId}/redirects`);
      setRedirects(res.redirects || []);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load redirects' });
    }
  };

  const handleToggleHttps = async (domain: DomainItem) => {
    try {
      const nextForce = domain.force_https ? 0 : 1;
      await api.patch(`/domains/${domain.id}`, { forceHttps: nextForce });
      setDomains(domains.map(d => d.id === domain.id ? { ...d, force_https: nextForce } : d));
      setActionMessage({ type: 'success', text: `HTTPS Force redirect updated for ${domain.domain_name}` });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleRunAutoSsl = async (domain: DomainItem) => {
    setAutoSslRunning(prev => ({ ...prev, [domain.domain_name]: true }));
    try {
      await api.post('/security/ssl/autossl', {
        domain: domain.domain_name,
        email: `admin@${domain.domain_name}`,
      });
      setActionMessage({ type: 'success', text: `AutoSSL certificate issued and installed for ${domain.domain_name}` });
      await fetchDomains();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'AutoSSL issuance failed' });
    } finally {
      setAutoSslRunning(prev => ({ ...prev, [domain.domain_name]: false }));
    }
  };

  const handleAddDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.name || !newRecord.value) {
      setActionMessage({ type: 'error', text: 'Name and Target Value are required' });
      return;
    }
    if (newRecord.ttl < 60) {
      setActionMessage({ type: 'error', text: 'TTL must be at least 60 seconds' });
      return;
    }

    try {
      await api.post(`/domains/${selectedDomainId}/zone/records`, newRecord);
      setActionMessage({ type: 'success', text: `DNS record '${newRecord.name}' added successfully` });
      setNewRecord({ name: '', type: 'A', value: '', ttl: 300, priority: 0 });
      fetchZone(selectedDomainId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDnsRecord = async (recId: string) => {
    if (!confirm('Are you sure you want to delete this DNS record?')) return;
    try {
      await api.delete(`/domains/${selectedDomainId}/zone/records/${recId}`);
      setActionMessage({ type: 'success', text: 'DNS record deleted' });
      fetchZone(selectedDomainId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleCloudflareSync = async () => {
    if (!cfToken) {
      setActionMessage({ type: 'error', text: 'Cloudflare API Token required' });
      return;
    }
    setSyncingCf(true);
    try {
      await api.post(`/domains/${selectedDomainId}/zone/sync-cloudflare`, { cloudflareToken: cfToken });
      setShowCfModal(false);
      setActionMessage({ type: 'success', text: 'DNS Zone synchronized with Cloudflare successfully' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setSyncingCf(false);
    }
  };

  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRedirect.sourcePath || !newRedirect.targetUrl) {
      setActionMessage({ type: 'error', text: 'Source path and target URL are required' });
      return;
    }
    try {
      await api.post(`/domains/${selectedDomainId}/redirects`, newRedirect);
      setNewRedirect({ sourcePath: '', targetUrl: '', statusCode: 301, matchType: 'exact' });
      setActionMessage({ type: 'success', text: 'Redirect rule created successfully' });
      fetchRedirects(selectedDomainId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteRedirect = async (redId: string) => {
    try {
      await api.delete(`/domains/${selectedDomainId}/redirects/${redId}`);
      setActionMessage({ type: 'success', text: 'Redirect removed' });
      fetchRedirects(selectedDomainId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const selectedDomain = domains.find(d => d.id === selectedDomainId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#343B52]">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Globe className="w-7 h-7 text-blue-500" />
            <span>Domains & DNS Zone Editor</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            RFC 1035 BIND9 Zone Editor, Let's Encrypt AutoSSL, Document Roots & Redirects
          </p>
        </div>

        {actionMessage && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
            actionMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
          }`}>
            {actionMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#343B52] gap-2">
        <button
          onClick={() => setActiveTab('domains')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'domains'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Domains & Vhosts ({domains.length})
        </button>
        <button
          onClick={() => setActiveTab('zone')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'zone'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          RFC 1035 Zone Editor
        </button>
        <button
          onClick={() => setActiveTab('redirects')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'redirects'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          URL Redirects
        </button>
      </div>

      {/* Domain Selection Pill (for Zone & Redirect tabs) */}
      {(activeTab === 'zone' || activeTab === 'redirects') && (
        <div className="flex items-center gap-3 bg-[#232736] p-3 rounded-lg border border-[#343B52]">
          <span className="text-sm font-medium text-slate-400">Target Domain:</span>
          <select
            value={selectedDomainId}
            onChange={(e) => setSelectedDomainId(e.target.value)}
            className="bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.domain_name} ({d.type})
              </option>
            ))}
          </select>
          {selectedDomain && (
            <span className="text-xs text-slate-400 font-mono">
              DocRoot: {selectedDomain.docroot} | PHP: {selectedDomain.php_version}
            </span>
          )}
        </div>
      )}

      {/* Tab 1: Domains & Vhosts Table */}
      {activeTab === 'domains' && (
        <div className="bg-[#232736] rounded-xl border border-[#343B52] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1E2230] text-slate-400 uppercase text-[11px] font-semibold border-b border-[#343B52]">
              <tr>
                <th className="px-5 py-3">Domain Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Document Root</th>
                <th className="px-5 py-3">PHP Version</th>
                <th className="px-5 py-3">AutoSSL Status</th>
                <th className="px-5 py-3">Force HTTPS</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#343B52]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading domains...</td>
                </tr>
              ) : domains.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No domains configured.</td>
                </tr>
              ) : (
                domains.map((d) => (
                  <tr key={d.id} className="hover:bg-[#2A2F42] transition-colors">
                    <td className="px-5 py-3 font-medium text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      <span>{d.domain_name}</span>
                      <a
                        href={`https://${d.domain_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      <span className="capitalize px-2 py-0.5 rounded text-[10px] bg-[#1B1E2B] text-slate-300 border border-[#343B52]">
                        {d.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300">{d.docroot}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-400 border border-blue-800">
                        PHP {d.php_version}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {d.ssl_status === 'active' ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs">
                            <ShieldCheck className="w-4 h-4" /> Active (Let's Encrypt)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400 text-xs">
                            <ShieldAlert className="w-4 h-4" /> {d.ssl_status || 'Unsecured'}
                          </span>
                        )}
                        <button
                          onClick={() => handleRunAutoSsl(d)}
                          disabled={autoSslRunning[d.domain_name]}
                          className="p-1 rounded hover:bg-[#1B1E2B] text-slate-400 hover:text-white"
                          title="Run AutoSSL ACME Issuance"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${autoSslRunning[d.domain_name] ? 'animate-spin text-blue-400' : ''}`} />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleToggleHttps(d)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          d.force_https ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            d.force_https ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedDomainId(d.id);
                          setActiveTab('zone');
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Zone Editor
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: RFC 1035 Zone Editor */}
      {activeTab === 'zone' && (
        <div className="space-y-6">
          {/* Action Bar & Filter */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#232736] p-4 rounded-xl border border-[#343B52]">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map((type) => (
                <button
                  key={type}
                  onClick={() => setDnsFilter(type)}
                  className={`px-3 py-1 rounded text-xs font-semibold uppercase transition-colors ${
                    dnsFilter === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1B1E2B] text-slate-400 hover:text-slate-200 border border-[#343B52]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCfModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1B1E2B] hover:bg-[#2A2F42] text-amber-300 border border-amber-800/60 flex items-center gap-2"
            >
              <Cloud className="w-4 h-4 text-amber-400" />
              Sync to Cloudflare
            </button>
          </div>

          {/* Inline Add Record Form */}
          <form
            onSubmit={handleAddDnsRecord}
            className="bg-[#232736] p-4 rounded-xl border border-[#343B52] grid grid-cols-1 md:grid-cols-6 gap-3 items-end text-xs"
          >
            <div>
              <label className="block text-slate-400 mb-1">Name / Host</label>
              <input
                type="text"
                placeholder="e.g. @ or mail"
                value={newRecord.name}
                onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Type</label>
              <select
                value={newRecord.type}
                onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as any })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              >
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">TTL (seconds)</label>
              <input
                type="number"
                value={newRecord.ttl}
                min={60}
                onChange={(e) => setNewRecord({ ...newRecord, ttl: Number(e.target.value) })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Priority (MX/SRV)</label>
              <input
                type="number"
                value={newRecord.priority}
                onChange={(e) => setNewRecord({ ...newRecord, priority: Number(e.target.value) })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Target Value</label>
              <input
                type="text"
                placeholder="Target IP or FQDN"
                value={newRecord.value}
                onChange={(e) => setNewRecord({ ...newRecord, value: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-1.5 font-semibold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Record
              </button>
            </div>
          </form>

          {/* DNS Records Table */}
          <div className="bg-[#232736] rounded-xl border border-[#343B52] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E2230] text-slate-400 uppercase text-[11px] border-b border-[#343B52]">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">TTL</th>
                  <th className="px-5 py-3">Target Value</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#343B52]/60">
                {dnsRecords
                  .filter((r) => dnsFilter === 'ALL' || r.type === dnsFilter)
                  .map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#2A2F42] transition-colors">
                      <td className="px-5 py-3 font-mono font-medium text-white">{rec.name}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1B1E2B] text-slate-300 border border-[#343B52]">
                          {rec.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-400">{rec.ttl}s</td>
                      <td className="px-5 py-3 font-mono text-slate-300 break-all max-w-md">{rec.value}</td>
                      <td className="px-5 py-3 font-mono text-slate-400">{rec.priority ?? '-'}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteDnsRecord(rec.id)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                          title="Delete DNS Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: URL Redirects */}
      {activeTab === 'redirects' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddRedirect}
            className="bg-[#232736] p-4 rounded-xl border border-[#343B52] grid grid-cols-1 md:grid-cols-5 gap-3 items-end text-xs"
          >
            <div>
              <label className="block text-slate-400 mb-1">Source Path</label>
              <input
                type="text"
                placeholder="e.g. /old-page.html"
                value={newRedirect.sourcePath}
                onChange={(e) => setNewRedirect({ ...newRedirect, sourcePath: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Target URL</label>
              <input
                type="text"
                placeholder="e.g. /new-page/ or https://..."
                value={newRedirect.targetUrl}
                onChange={(e) => setNewRedirect({ ...newRedirect, targetUrl: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Status Code</label>
              <select
                value={newRedirect.statusCode}
                onChange={(e) => setNewRedirect({ ...newRedirect, statusCode: Number(e.target.value) as any })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value={301}>301 Permanent</option>
                <option value={302}>302 Temporary</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Match Type</label>
              <select
                value={newRedirect.matchType}
                onChange={(e) => setNewRedirect({ ...newRedirect, matchType: e.target.value as any })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="exact">Exact Path</option>
                <option value="wildcard">Wildcard (*)</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-1.5 font-semibold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Redirect
              </button>
            </div>
          </form>

          {/* Redirects Table */}
          <div className="bg-[#232736] rounded-xl border border-[#343B52] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E2230] text-slate-400 uppercase text-[11px] border-b border-[#343B52]">
                <tr>
                  <th className="px-5 py-3">Source Path</th>
                  <th className="px-5 py-3">Target URL</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#343B52]/60">
                {redirects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No redirect rules set for this domain.</td>
                  </tr>
                ) : (
                  redirects.map((r) => (
                    <tr key={r.id} className="hover:bg-[#2A2F42] transition-colors">
                      <td className="px-5 py-3 font-mono text-white">{r.source_path}</td>
                      <td className="px-5 py-3 font-mono text-cyan-400">{r.target_url}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1B1E2B] text-slate-300 border border-[#343B52]">
                          HTTP {r.status_code}
                        </span>
                      </td>
                      <td className="px-5 py-3 capitalize text-slate-400">{r.match_type}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRedirect(r.id)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                          title="Delete Redirect"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cloudflare Sync Modal */}
      {showCfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#232736] border border-[#343B52] rounded-xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-xs text-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-amber-400" />
                <span>Cloudflare DNS 2-Way Sync</span>
              </h3>
              <button onClick={() => setShowCfModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-400 mb-4">
              Synchronize RFC 1035 zone records between local BIND9 and Cloudflare's authoritative nameservers.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cloudflare API Token</label>
                <input
                  type="password"
                  placeholder="Bearer token with Zone.DNS permissions"
                  value={cfToken}
                  onChange={(e) => setCfToken(e.target.value)}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCfModal(false)}
                  className="px-4 py-2 rounded bg-[#1B1E2B] text-slate-300 hover:bg-[#2A2F42]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCloudflareSync}
                  disabled={syncingCf}
                  className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {syncingCf ? 'Synchronizing...' : 'Sync Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
