import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  HardDrive,
  Activity,
  Database,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/client.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const TelemetryRail: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { effectiveUser } = useAuth();
  const [telemetry, setTelemetry] = useState<any>({
    primaryDomain: 'architecturalnumbers.com',
    homeDir: '/home/vahag/public_html',
    primaryIp: '192.168.11.32',
    sharedIp: '198.57.247.185',
    phpVersion: '8.3',
    diskUsedBytes: 2576980377, // ~2.4 GB
    diskLimitBytes: 10737418240, // 10 GB
    bandwidthUsedBytes: 2147483648, // 2 GB
    bandwidthLimitBytes: 107374182400, // 100 GB
    mysqlDbsCount: 2,
    mysqlDbsLimit: 10,
    loadAvg: [0.12, 0.18, 0.15],
  });

  const fetchTelemetry = async () => {
    try {
      const res = await api.metrics.getResources();
      if (res && res.success) {
        setTelemetry((prev: any) => ({
          ...prev,
          loadAvg: res.cpu?.loadAvg || prev.loadAvg,
          diskUsedBytes: res.memoryUsedBytes ? res.memoryUsedBytes * 10 : prev.diskUsedBytes,
        }));
      }
    } catch {}
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(interval);
  }, [effectiveUser]);

  const diskLimit = telemetry.diskLimitBytes || 10737418240;
  const diskPct = Math.min(100, Math.round(((telemetry.diskUsedBytes || 0) / diskLimit) * 100));
  const bwLimit = telemetry.bandwidthLimitBytes || 107374182400;
  const bwPct = Math.min(100, Math.round(((telemetry.bandwidthUsedBytes || 0) / bwLimit) * 100));

  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

  if (collapsed) {
    return (
      <aside className="w-10 bg-[#1B1E2B] border-l border-[#343B52] h-[calc(100vh-4rem)] sticky top-16 flex flex-col items-center py-4 text-slate-400 select-none">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 hover:bg-[#232736] rounded text-slate-300 hover:text-white mb-6"
          title="Expand Statistics Rail"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <HardDrive className="w-4 h-4 mb-4 text-slate-400" />
        <Activity className="w-4 h-4 mb-4 text-slate-400" />
        <Database className="w-4 h-4 text-slate-400" />
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-[#1B1E2B] border-l border-[#343B52] h-[calc(100vh-4rem)] sticky top-16 flex flex-col p-4 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#343B52]">
        <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">General Information</span>
        <div className="flex items-center space-x-1">
          <button onClick={fetchTelemetry} className="p-1 hover:bg-[#232736] rounded text-slate-400 hover:text-white" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCollapsed(true)} className="p-1 hover:bg-[#232736] rounded text-slate-400 hover:text-white" title="Collapse">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* General Details */}
      <div className="py-3 space-y-2.5 text-xs border-b border-[#343B52]">
        <div>
          <div className="text-[11px] text-slate-400">Current User</div>
          <div className="font-semibold text-slate-200">{effectiveUser?.username || 'vahag'}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Primary Domain</div>
          <div className="font-semibold text-amber-400 flex items-center space-x-1">
            <Globe className="w-3 h-3" />
            <span>{telemetry.primaryDomain}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Home Directory</div>
          <div className="font-mono text-slate-300 text-[11px] truncate">{effectiveUser?.homeDir || telemetry.homeDir}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Shared IP Address</div>
          <div className="font-mono text-slate-300">{telemetry.sharedIp}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Active PHP Version</div>
          <div className="inline-block bg-[#232736] border border-[#343B52] px-2 py-0.5 rounded text-[11px] text-slate-200 font-mono mt-0.5">
            ea-php{telemetry.phpVersion}
          </div>
        </div>
      </div>

      {/* Statistics & Quotas */}
      <div className="pt-3 space-y-4">
        <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">Statistics & Quotas</span>

        {/* Disk Space Quota */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Disk Usage</span>
            <span className="font-medium text-slate-200">
              {formatGb(telemetry.diskUsedBytes)} / {formatGb(diskLimit)} GB ({diskPct}%)
            </span>
          </div>
          <div className="w-full bg-[#232736] h-2 rounded-full overflow-hidden border border-[#343B52]">
            <div
              className={`h-full transition-all duration-300 ${
                diskPct > 90 ? 'bg-red-500' : diskPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${diskPct}%` }}
            />
          </div>
        </div>

        {/* Bandwidth Quota */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Monthly Bandwidth</span>
            <span className="font-medium text-slate-200">
              {formatGb(telemetry.bandwidthUsedBytes)} / {formatGb(bwLimit)} GB ({bwPct}%)
            </span>
          </div>
          <div className="w-full bg-[#232736] h-2 rounded-full overflow-hidden border border-[#343B52]">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${bwPct}%` }} />
          </div>
        </div>

        {/* MySQL DB Count */}
        <div className="flex justify-between items-center text-xs py-1 border-b border-[#343B52]/50">
          <span className="text-slate-400">MySQL Databases</span>
          <span className="font-mono text-slate-200">
            {telemetry.mysqlDbsCount} / {telemetry.mysqlDbsLimit}
          </span>
        </div>

        {/* Server Load Average */}
        <div className="flex justify-between items-center text-xs py-1">
          <span className="text-slate-400">Server Load</span>
          <span className="font-mono text-emerald-400">
            {Array.isArray(telemetry.loadAvg) ? telemetry.loadAvg.map((n: number) => n.toFixed(2)).join(', ') : '0.12, 0.18, 0.15'}
          </span>
        </div>
      </div>
    </aside>
  );
};
