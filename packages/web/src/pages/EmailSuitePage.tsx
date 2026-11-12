import React, { useState, useEffect } from 'react';
import {
  Mail,
  Plus,
  Trash2,
  Key,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../api/client.ts';

export interface MailboxItem {
  id: string;
  email: string;
  local_part: string;
  domain_name: string;
  quota_bytes: number;
  used_bytes: number;
  suspended_login: number;
  suspended_incoming: number;
}

export interface ForwarderItem {
  id: string;
  source_address: string;
  destination_address: string;
  is_catch_all: number;
}

export interface AutoresponderItem {
  id: string;
  email: string;
  local_part: string;
  subject: string;
  body: string;
  interval_hours: number;
  enabled: number;
}

export interface DeliverabilityStatus {
  domain: string;
  spf: { status: string; record: string };
  dkim: { status: string; selector: string; record: string };
  dmarc: { status: string; record: string };
}

export const EmailSuitePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mailboxes' | 'forwarders' | 'autoresponders' | 'deliverability' | 'defaultAddress'>('mailboxes');
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [forwarders, setForwarders] = useState<ForwarderItem[]>([]);
  const [autoresponders, setAutoresponders] = useState<AutoresponderItem[]>([]);
  const [deliverability, setDeliverability] = useState<DeliverabilityStatus | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Notifications
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showCreateMailbox, setShowCreateMailbox] = useState<boolean>(false);
  const [newMailbox, setNewMailbox] = useState({
    domain: '',
    localPart: '',
    password: '',
    quotaMb: 1024,
  });

  const [passwordModalMailbox, setPasswordModalMailbox] = useState<MailboxItem | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');

  const [quotaModalMailbox, setQuotaModalMailbox] = useState<MailboxItem | null>(null);
  const [newQuotaMb, setNewQuotaMb] = useState<number>(1024);

  // Forwarder Form
  const [newForwarder, setNewForwarder] = useState({
    source: '',
    destination: '',
    domain: '',
  });

  // Autoresponder Form
  const [newAutoresponder, setNewAutoresponder] = useState({
    localPart: '',
    subject: 'Out of Office / Vacation Reply',
    body: 'Thank you for your email. I am currently out of the office and will reply shortly.',
    intervalHours: 24,
  });

  // Default Address State
  const [catchAllAction, setCatchAllAction] = useState<'fail' | 'forward'>('fail');
  const [catchAllForwardTo, setCatchAllForwardTo] = useState<string>('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      if (activeTab === 'deliverability') fetchDeliverability(selectedDomain);
      if (activeTab === 'defaultAddress') fetchDefaultAddress(selectedDomain);
    }
  }, [selectedDomain, activeTab]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [mRes, fRes, aRes, dRes] = await Promise.all([
        api.get<{ success: boolean; mailboxes: MailboxItem[] }>('/email/mailboxes').catch(() => ({ success: true, mailboxes: [] })),
        api.get<{ success: boolean; forwarders: ForwarderItem[] }>('/email/forwarders').catch(() => ({ success: true, forwarders: [] })),
        api.get<{ success: boolean; autoresponders: AutoresponderItem[] }>('/email/autoresponders').catch(() => ({ success: true, autoresponders: [] })),
        api.get<{ success: boolean; domains: { domain_name: string }[] }>('/domains').catch(() => ({ success: true, domains: [] })),
      ]);

      setMailboxes(mRes.mailboxes || []);
      setForwarders(fRes.forwarders || []);
      setAutoresponders(aRes.autoresponders || []);

      const domainNames = (dRes.domains || []).map(d => d.domain_name);
      setDomains(domainNames);
      if (domainNames.length > 0) {
        setSelectedDomain(domainNames[0]);
        setNewMailbox(prev => ({ ...prev, domain: domainNames[0] }));
        setNewForwarder(prev => ({ ...prev, domain: domainNames[0] }));
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to load email suite data' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeliverability = async (domain: string) => {
    try {
      const res = await api.get<{ success: boolean } & DeliverabilityStatus>(`/email/deliverability/${domain}`);
      setDeliverability(res);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const fetchDefaultAddress = async (domain: string) => {
    try {
      const res = await api.get<{ success: boolean; action: 'fail' | 'forward'; forwardTo?: string }>(`/email/default-address/${domain}`);
      setCatchAllAction(res.action || 'fail');
      setCatchAllForwardTo(res.forwardTo || '');
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleLaunchWebmailSso = async (email: string) => {
    try {
      const res = await api.post<{ success: boolean; redirectUrl: string }>('/email/webmail/sso', { email });
      if (res.redirectUrl) {
        window.open(res.redirectUrl, '_blank');
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to initialize Webmail SSO' });
    }
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMailbox.localPart || !newMailbox.password) {
      setNotice({ type: 'error', message: 'Local part and password are required' });
      return;
    }

    try {
      await api.post('/email/mailboxes', {
        domain: newMailbox.domain,
        localPart: newMailbox.localPart,
        password: newMailbox.password,
        quotaBytes: newMailbox.quotaMb * 1024 * 1024,
      });

      setShowCreateMailbox(false);
      setNewMailbox({ domain: domains[0] || '', localPart: '', password: '', quotaMb: 1024 });
      setNotice({ type: 'success', message: 'Mailbox created successfully' });
      const mRes = await api.get<{ success: boolean; mailboxes: MailboxItem[] }>('/email/mailboxes');
      setMailboxes(mRes.mailboxes || []);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleChangePassword = async () => {
    if (!passwordModalMailbox || !newPassword) return;
    try {
      await api.patch(`/email/mailboxes/${passwordModalMailbox.id}`, { password: newPassword });
      setPasswordModalMailbox(null);
      setNewPassword('');
      setNotice({ type: 'success', message: `Password updated for ${passwordModalMailbox.email}` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleChangeQuota = async () => {
    if (!quotaModalMailbox) return;
    try {
      const quotaBytes = newQuotaMb * 1024 * 1024;
      await api.patch(`/email/mailboxes/${quotaModalMailbox.id}`, { quotaBytes });
      setQuotaModalMailbox(null);
      setNotice({ type: 'success', message: `Quota updated for ${quotaModalMailbox.email}` });
      const mRes = await api.get<{ success: boolean; mailboxes: MailboxItem[] }>('/email/mailboxes');
      setMailboxes(mRes.mailboxes || []);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleDeleteMailbox = async (mailbox: MailboxItem) => {
    if (!confirm(`Are you sure you want to delete mailbox ${mailbox.email}? This will delete all stored mail.`)) return;
    try {
      await api.delete(`/email/mailboxes/${mailbox.id}`);
      setNotice({ type: 'success', message: `Mailbox ${mailbox.email} deleted` });
      setMailboxes(mailboxes.filter(m => m.id !== mailbox.id));
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleCreateForwarder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/email/forwarders', {
        domain: newForwarder.domain,
        source: newForwarder.source,
        destinations: [newForwarder.destination],
      });
      setNotice({ type: 'success', message: 'Email forwarder created successfully' });
      setNewForwarder({ source: '', destination: '', domain: domains[0] || '' });
      const fRes = await api.get<{ success: boolean; forwarders: ForwarderItem[] }>('/email/forwarders');
      setForwarders(fRes.forwarders || []);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleDeleteForwarder = async (id: string) => {
    try {
      await api.delete(`/email/forwarders/${id}`);
      setNotice({ type: 'success', message: 'Forwarder removed' });
      setForwarders(forwarders.filter(f => f.id !== id));
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleCreateAutoresponder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/email/autoresponders', {
        domain: selectedDomain,
        localPart: newAutoresponder.localPart,
        subject: newAutoresponder.subject,
        body: newAutoresponder.body,
        intervalHours: newAutoresponder.intervalHours,
      });
      setNotice({ type: 'success', message: 'Autoresponder created and Sieve script compiled' });
      const aRes = await api.get<{ success: boolean; autoresponders: AutoresponderItem[] }>('/email/autoresponders');
      setAutoresponders(aRes.autoresponders || []);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleInstallDkim = async () => {
    if (!selectedDomain) return;
    try {
      await api.post(`/email/deliverability/${selectedDomain}/install`, { keyType: 'rsa2048' });
      setNotice({ type: 'success', message: `Generated and installed DKIM keys for ${selectedDomain}` });
      fetchDeliverability(selectedDomain);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleSaveDefaultAddress = async () => {
    try {
      await api.put(`/email/default-address/${selectedDomain}`, {
        action: catchAllAction,
        forwardTo: catchAllAction === 'forward' ? catchAllForwardTo : undefined,
      });
      setNotice({ type: 'success', message: `Catch-all default address updated for ${selectedDomain}` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#343B52]">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Mail className="w-7 h-7 text-indigo-400" />
            <span>Email Suite & Deliverability</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Postfix Virtual Aliases, Dovecot Maildirs, Rspamd DKIM/SPF/DMARC & 1-Click Roundcube Webmail SSO
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
      <div className="flex border-b border-[#343B52] gap-2">
        <button
          onClick={() => setActiveTab('mailboxes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mailboxes' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Mailboxes ({mailboxes.length})
        </button>
        <button
          onClick={() => setActiveTab('forwarders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'forwarders' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Forwarders ({forwarders.length})
        </button>
        <button
          onClick={() => setActiveTab('autoresponders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'autoresponders' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Autoresponders ({autoresponders.length})
        </button>
        <button
          onClick={() => setActiveTab('deliverability')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'deliverability' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Email Deliverability (DKIM / SPF)
        </button>
        <button
          onClick={() => setActiveTab('defaultAddress')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'defaultAddress' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Default Address (Catch-All)
        </button>
      </div>

      {/* Tab 1: Mailboxes Table */}
      {activeTab === 'mailboxes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">IMAP/POP3/SMTP enabled mailboxes on this account</span>
            <button
              onClick={() => setShowCreateMailbox(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" /> Create Mailbox
            </button>
          </div>

          <div className="bg-[#232736] rounded-xl border border-[#343B52] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E2230] text-slate-400 uppercase text-[11px] border-b border-[#343B52]">
                <tr>
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Storage Quota & Usage</th>
                  <th className="px-5 py-3">Webmail SSO</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#343B52]/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">Loading mailboxes...</td>
                  </tr>
                ) : mailboxes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No mailboxes created yet.</td>
                  </tr>
                ) : (
                  mailboxes.map((m) => {
                    const percent = m.quota_bytes > 0 ? Math.min(100, Math.round((m.used_bytes / m.quota_bytes) * 100)) : 0;
                    const barColor = percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500';

                    return (
                      <tr key={m.id} className="hover:bg-[#2A2F42] transition-colors">
                        <td className="px-5 py-4 font-medium text-white flex items-center gap-2">
                          <Mail className="w-4 h-4 text-indigo-400" />
                          <span>{m.email}</span>
                        </td>
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                            <span>{formatBytes(m.used_bytes)} used</span>
                            <span>{m.quota_bytes === 0 ? 'Unlimited' : formatBytes(m.quota_bytes)}</span>
                          </div>
                          <div className="w-full bg-[#1B1E2B] rounded-full h-2 overflow-hidden border border-[#343B52]">
                            <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleLaunchWebmailSso(m.email)}
                            className="px-3 py-1.5 rounded text-[11px] font-semibold bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800 flex items-center gap-1.5 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Roundcube SSO
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setPasswordModalMailbox(m);
                                setNewPassword('');
                              }}
                              className="p-1.5 rounded hover:bg-[#1B1E2B] text-slate-400 hover:text-white"
                              title="Change Password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setQuotaModalMailbox(m);
                                setNewQuotaMb(Math.round(m.quota_bytes / (1024 * 1024)));
                              }}
                              className="p-1.5 rounded hover:bg-[#1B1E2B] text-slate-400 hover:text-white"
                              title="Edit Disk Quota"
                            >
                              <HardDrive className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMailbox(m)}
                              className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                              title="Delete Mailbox"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Forwarders */}
      {activeTab === 'forwarders' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateForwarder}
            className="bg-[#232736] p-4 rounded-xl border border-[#343B52] grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs"
          >
            <div>
              <label className="block text-slate-400 mb-1">Source Local Part</label>
              <input
                type="text"
                placeholder="e.g. sales"
                value={newForwarder.source}
                onChange={(e) => setNewForwarder({ ...newForwarder, source: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Domain</label>
              <select
                value={newForwarder.domain}
                onChange={(e) => setNewForwarder({ ...newForwarder, domain: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>@{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Destination Address</label>
              <input
                type="email"
                placeholder="forward-target@gmail.com"
                value={newForwarder.destination}
                onChange={(e) => setNewForwarder({ ...newForwarder, destination: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded px-4 py-1.5 font-semibold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Forwarder
              </button>
            </div>
          </form>

          <div className="bg-[#232736] rounded-xl border border-[#343B52] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E2230] text-slate-400 uppercase text-[11px] border-b border-[#343B52]">
                <tr>
                  <th className="px-5 py-3">Source Address</th>
                  <th className="px-5 py-3">Destination Forwarding Address</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#343B52]/60">
                {forwarders.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">No email forwarders configured.</td>
                  </tr>
                ) : (
                  forwarders.map((f) => (
                    <tr key={f.id} className="hover:bg-[#2A2F42] transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{f.source_address}</td>
                      <td className="px-5 py-3 font-mono text-cyan-400">{f.destination_address}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteForwarder(f.id)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
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

      {/* Tab 3: Autoresponders */}
      {activeTab === 'autoresponders' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateAutoresponder}
            className="bg-[#232736] p-4 rounded-xl border border-[#343B52] space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Local Part</label>
                <input
                  type="text"
                  placeholder="e.g. info"
                  value={newAutoresponder.localPart}
                  onChange={(e) => setNewAutoresponder({ ...newAutoresponder, localPart: e.target.value })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={newAutoresponder.subject}
                  onChange={(e) => setNewAutoresponder({ ...newAutoresponder, subject: e.target.value })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Interval (Hours)</label>
                <input
                  type="number"
                  value={newAutoresponder.intervalHours}
                  min={1}
                  onChange={(e) => setNewAutoresponder({ ...newAutoresponder, intervalHours: Number(e.target.value) })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Vacation Reply Message Body</label>
              <textarea
                rows={3}
                value={newAutoresponder.body}
                onChange={(e) => setNewAutoresponder({ ...newAutoresponder, body: e.target.value })}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-4 py-1.5 font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Save Autoresponder
              </button>
            </div>
          </form>

          <div className="bg-[#232736] rounded-xl border border-[#343B52] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E2230] text-slate-400 uppercase text-[11px] border-b border-[#343B52]">
                <tr>
                  <th className="px-5 py-3">Mailbox</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#343B52]/60">
                {autoresponders.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">No autoresponders active.</td>
                  </tr>
                ) : (
                  autoresponders.map((a) => (
                    <tr key={a.id} className="hover:bg-[#2A2F42] transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{a.email}</td>
                      <td className="px-5 py-3 text-slate-300">{a.subject}</td>
                      <td className="px-5 py-3 font-mono text-slate-400">{a.interval_hours}h</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Deliverability */}
      {activeTab === 'deliverability' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-[#232736] p-3 rounded-lg border border-[#343B52]">
            <span className="text-xs font-medium text-slate-400">Inspect Domain:</span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-xs text-white"
            >
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {deliverability && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* DKIM Card */}
              <div className="bg-[#232736] p-5 rounded-xl border border-[#343B52] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span>DKIM (DomainKeys)</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {deliverability.dkim?.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Cryptographic signature verifying sender authenticity (Selector: <code>{deliverability.dkim?.selector || 'default'}</code>).
                  </p>
                  <div className="bg-[#1B1E2B] p-2.5 rounded border border-[#343B52] font-mono text-[10px] text-slate-300 break-all mb-4">
                    {deliverability.dkim?.record || 'v=DKIM1; k=rsa; p=...'}
                  </div>
                </div>
                <button
                  onClick={handleInstallDkim}
                  className="w-full bg-[#1B1E2B] hover:bg-[#2A2F42] text-indigo-300 border border-indigo-800/60 rounded px-3 py-1.5 text-xs font-semibold"
                >
                  Regenerate / Install DKIM Key
                </button>
              </div>

              {/* SPF Card */}
              <div className="bg-[#232736] p-5 rounded-xl border border-[#343B52]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>SPF Record</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {deliverability.spf?.status || 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  Authorizes this appliance mail server to dispatch email for your domain.
                </p>
                <div className="bg-[#1B1E2B] p-2.5 rounded border border-[#343B52] font-mono text-[10px] text-slate-300 break-all">
                  {deliverability.spf?.record || 'v=spf1 +a +mx +ip4:192.168.11.32 ~all'}
                </div>
              </div>

              {/* DMARC Card */}
              <div className="bg-[#232736] p-5 rounded-xl border border-[#343B52]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>DMARC Policy</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {deliverability.dmarc?.status || 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  Rejection policy protection against domain spoofing.
                </p>
                <div className="bg-[#1B1E2B] p-2.5 rounded border border-[#343B52] font-mono text-[10px] text-slate-300 break-all">
                  {deliverability.dmarc?.record || 'v=DMARC1; p=quarantine; sp=quarantine;'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Default Catch-All Address */}
      {activeTab === 'defaultAddress' && (
        <div className="bg-[#232736] p-6 rounded-xl border border-[#343B52] max-w-xl space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">Default Address (Catch-All Mailbox)</h3>
          <p className="text-slate-400">
            Handle unrouted incoming messages addressed to non-existent mailboxes under {selectedDomain}.
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="catchAll"
                checked={catchAllAction === 'fail'}
                onChange={() => setCatchAllAction('fail')}
                className="accent-indigo-500"
              />
              <span className="text-white">Discard and bounce (:fail: with standard bounce message)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="catchAll"
                checked={catchAllAction === 'forward'}
                onChange={() => setCatchAllAction('forward')}
                className="accent-indigo-500"
              />
              <span className="text-white">Forward all unrouted mail to destination email address</span>
            </label>
          </div>

          {catchAllAction === 'forward' && (
            <div>
              <label className="block text-slate-400 mb-1">Destination Address:</label>
              <input
                type="email"
                placeholder="master@example.com"
                value={catchAllForwardTo}
                onChange={(e) => setCatchAllForwardTo(e.target.value)}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleSaveDefaultAddress}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded px-4 py-2"
            >
              Save Default Address Settings
            </button>
          </div>
        </div>
      )}

      {/* Create Mailbox Modal */}
      {showCreateMailbox && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#232736] border border-[#343B52] rounded-xl w-full max-w-md p-6 shadow-2xl text-xs text-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                <span>Create New Mailbox</span>
              </h3>
              <button onClick={() => setShowCreateMailbox(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMailbox} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Username / Local Part</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. support"
                  value={newMailbox.localPart}
                  onChange={(e) => setNewMailbox({ ...newMailbox, localPart: e.target.value })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Domain</label>
                <select
                  value={newMailbox.domain}
                  onChange={(e) => setNewMailbox({ ...newMailbox, domain: e.target.value })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  {domains.map((d) => (
                    <option key={d} value={d}>@{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Strong mailbox password"
                  value={newMailbox.password}
                  onChange={(e) => setNewMailbox({ ...newMailbox, password: e.target.value })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Storage Quota (MB)</label>
                <input
                  type="number"
                  min={100}
                  value={newMailbox.quotaMb}
                  onChange={(e) => setNewMailbox({ ...newMailbox, quotaMb: Number(e.target.value) })}
                  className="w-full bg-[#1B1E2B] border border-[#343B52] rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateMailbox(false)}
                  className="px-4 py-2 rounded bg-[#1B1E2B] text-slate-300 hover:bg-[#2A2F42]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Create Mailbox
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModalMailbox && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#232736] border border-[#343B52] rounded-xl w-full max-w-sm p-6 shadow-2xl text-xs text-slate-200">
            <h3 className="text-sm font-bold text-white mb-2">Change Password</h3>
            <p className="text-slate-400 mb-4">{passwordModalMailbox.email}</p>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPasswordModalMailbox(null)}
                  className="px-3 py-1.5 rounded bg-[#1B1E2B] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white font-bold"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quota Modal */}
      {quotaModalMailbox && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#232736] border border-[#343B52] rounded-xl w-full max-w-sm p-6 shadow-2xl text-xs text-slate-200">
            <h3 className="text-sm font-bold text-white mb-2">Edit Mailbox Quota</h3>
            <p className="text-slate-400 mb-4">{quotaModalMailbox.email}</p>
            <div className="space-y-4">
              <input
                type="number"
                min={100}
                value={newQuotaMb}
                onChange={(e) => setNewQuotaMb(Number(e.target.value))}
                className="w-full bg-[#1B1E2B] border border-[#343B52] rounded p-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setQuotaModalMailbox(null)}
                  className="px-3 py-1.5 rounded bg-[#1B1E2B] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeQuota}
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white font-bold"
                >
                  Save Quota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
