import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api/client';
import type { InstanceStatus, ScheduleData, SSLCert, DiskUsage, CostData } from './api/types';
import { useToast } from './context/ToastContext';
import { StatusCard }       from './components/dashboard/StatusCard';
import { ControlsCard }     from './components/dashboard/ControlsCard';
import { ScheduleCard }     from './components/dashboard/ScheduleCard';
import { EditScheduleCard } from './components/dashboard/EditScheduleCard';
import { SSLCard }          from './components/dashboard/SSLCard';
import { DiskUsageCard }    from './components/dashboard/DiskUsageCard';
import { CPUCreditCard }    from './components/dashboard/CPUCreditCard';
import { CostCard }         from './components/dashboard/CostCard';
import { AuditLogCard }     from './components/dashboard/AuditLogCard';

const POLL_INTERVAL = 30_000;

function PollRing({ lastUpdate }: { lastUpdate: Date | null }) {
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    if (!lastUpdate) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - lastUpdate.getTime();
      setProgress(1 - Math.min(elapsed / POLL_INTERVAL, 1));
    }, 200);
    return () => clearInterval(id);
  }, [lastUpdate]);

  const r = 7, circ = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" className="-rotate-90 flex-shrink-0">
      <circle cx="9" cy="9" r={r} fill="none" stroke="#1E2D45" strokeWidth="2.5" />
      <circle
        cx="9" cy="9" r={r} fill="none"
        stroke="#00C853" strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .2s linear' }}
      />
    </svg>
  );
}

export default function App() {
  const { toast } = useToast();
  const [status,   setStatus]   = useState<InstanceStatus | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData   | null>(null);
  const [ssl,      setSSL]      = useState<SSLCert[]       | null>(null);
  const [disk,     setDisk]     = useState<DiskUsage       | null>(null);
  const [cost,     setCost]     = useState<CostData        | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try { setStatus(await api.status()); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      api.status().then(setStatus).catch(() => {}),
      api.getSchedule().then(setSchedule).catch(() => {}),
      api.ssl().then(setSSL).catch(() => {}),
      api.disk().then(setDisk).catch(() => {}),
      api.cost().then(setCost).catch(() => {}),
    ]);
    setLoading(false);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
      if (e.key === 'r' || e.key === 'R') { fetchAll(); toast('Refreshing…', 'info'); }
      if (e.key === 'x' || e.key === 'X') toast('Use the Stop button to confirm shutdown', 'warning');
      if ((e.key === 's' || e.key === 'S') && status?.state === 'stopped') {
        api.start().then(() => { toast('Start initiated', 'success'); setTimeout(fetchStatus, 3000); }).catch(err => toast(err.message, 'error'));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, fetchStatus, fetchAll, toast]);

  const sslCritical = ssl?.some(c => c.status === 'critical');
  const diskWarn    = (disk?.usage_percent ?? 0) > 70;

  const statusBarItems = [
    {
      label: 'Instance',
      value: status?.state ?? (loading ? '…' : '—'),
      color: status?.state === 'running' ? 'text-green-light' : status?.state === 'stopped' ? 'text-red-light' : 'text-amber',
      dot:   status?.state === 'running' ? 'bg-green animate-pulse-dot shadow-green-glow' : status?.state === 'stopped' ? 'bg-red' : 'bg-amber animate-pulse-dot',
    },
    {
      label: 'Schedule',
      value: schedule ? (schedule.daily_start?.state === 'ENABLED' ? 'Active' : 'Paused') : '—',
      color: schedule?.daily_start?.state === 'ENABLED' ? 'text-green-light' : 'text-tm',
      dot:   schedule?.daily_start?.state === 'ENABLED' ? 'bg-green' : 'bg-border',
    },
    {
      label: 'SSL',
      value: !ssl ? '—' : sslCritical ? 'Critical' : 'Healthy',
      color: sslCritical ? 'text-red-light' : !ssl ? 'text-tm' : 'text-green-light',
      dot:   sslCritical ? 'bg-red' : !ssl ? 'bg-border' : 'bg-green',
    },
    {
      label: 'Disk',
      value: disk?.usage_percent != null ? `${disk.usage_percent}%` : '—',
      color: (disk?.usage_percent ?? 0) > 85 ? 'text-red-light' : diskWarn ? 'text-amber' : 'text-green-light',
      dot:   (disk?.usage_percent ?? 0) > 85 ? 'bg-red' : diskWarn ? 'bg-amber' : 'bg-green',
    },
    {
      label: 'Cost/mo',
      value: cost?.projected_monthly_inr != null ? `₹${cost.projected_monthly_inr.toLocaleString('en-IN')}` : '—',
      color: cost?.on_track === false ? 'text-red-light' : 'text-tp',
      dot:   cost?.on_track === false ? 'bg-red' : 'bg-green',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-bg font-sans relative overflow-x-hidden">

      {/* ── Ambient background blobs ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Emerald — top-left */}
        <div
          className="absolute animate-glow-pulse"
          style={{ top: '-15%', left: '-10%', width: '680px', height: '680px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,83,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />
        {/* Blue — bottom-right */}
        <div
          className="absolute animate-glow-pulse"
          style={{ bottom: '-15%', right: '-10%', width: '620px', height: '620px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(77,158,255,0.05) 0%, transparent 70%)', filter: 'blur(40px)', animationDelay: '2s' }}
        />
        {/* Subtle dot grid overlay */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(30,45,69,.35) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
      </div>

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-5
        bg-[rgba(13,17,23,0.92)] backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue to-purple flex items-center justify-center text-[11px] text-white font-bold shadow-blue-glow">
              ⚙
            </div>
            <nav className="flex items-center gap-1 text-[12px]">
              <span className="text-tm">AWS</span>
              <span className="text-border-hi mx-1">/</span>
              <span className="text-ts">EC2</span>
              <span className="text-border-hi mx-1">/</span>
              <span className="text-tp font-semibold">Scheduler</span>
            </nav>
          </div>
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-red-light bg-red/8 border border-red/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-dot shadow-red-glow" />
            Production
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Poll ring + last update */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-tm font-mono">
            <PollRing lastUpdate={lastUpdate} />
            {lastUpdate
              ? <span><span className="text-ts">Updated</span> <span className="text-tp">{lastUpdate.toLocaleTimeString()}</span></span>
              : <span className="animate-pulse">connecting…</span>}
          </div>
          <button
            onClick={() => { fetchAll(); toast('Refreshed', 'info'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-ts hover:text-tp
              bg-card-2 border border-border hover:border-border-hi transition-all duration-150 active:scale-95"
            title="Refresh (R)"
          >
            ↻ Refresh
          </button>
          <span className="hidden xl:flex items-center gap-1 text-[10px] text-tm px-2.5 py-1.5 bg-card border border-border-soft rounded-lg font-mono tracking-wide">
            <kbd className="text-ts">S</kbd><span className="mx-0.5">start</span>
            <span className="mx-1.5 text-border-hi">·</span>
            <kbd className="text-ts">X</kbd><span className="mx-0.5">stop</span>
            <span className="mx-1.5 text-border-hi">·</span>
            <kbd className="text-ts">R</kbd><span className="mx-0.5">refresh</span>
          </span>
        </div>
      </header>

      {/* ── Global Status Bar ── */}
      <div className="sticky top-12 z-30 flex items-stretch border-b border-border bg-[rgba(13,17,23,0.88)] backdrop-blur-xl h-11">
        {statusBarItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-4 border-r border-border last:border-r-0 flex-1 min-w-0 hover:bg-white/[.015] transition-colors cursor-default">
            <div className="relative flex-shrink-0">
              <span className={`block w-1.5 h-1.5 rounded-full ${item.dot}`} />
              {item.dot.includes('animate-pulse-dot') && (
                <span className={`absolute inset-0 rounded-full animate-ping opacity-30 ${item.dot.includes('green') ? 'bg-green' : item.dot.includes('amber') ? 'bg-amber' : 'bg-red'}`} />
              )}
            </div>
            <div className="flex flex-col min-w-0 leading-none">
              <span className="text-[8.5px] font-bold uppercase tracking-[.13em] text-tm mb-0.5">{item.label}</span>
              <span className={`text-[11px] font-bold truncate ${item.color}`}>{item.value}</span>
            </div>
          </div>
        ))}
        <div className="hidden lg:flex items-center gap-1.5 px-4 border-l border-border flex-shrink-0">
          <span className="text-[8.5px] font-bold uppercase tracking-[.13em] text-tm">Polling</span>
          <span className="text-[11px] font-bold text-ts font-mono">30s</span>
        </div>
      </div>

      {/* ── Alert Banners ── */}
      {(sslCritical || diskWarn) && (
        <div className="px-5 pt-3 flex flex-col gap-1.5">
          {sslCritical && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red/8 border border-red/25 rounded-xl text-[11px] text-red-light font-medium animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-red flex-shrink-0" />
              SSL certificate expiring within 14 days — renew immediately
            </div>
          )}
          {diskWarn && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber/8 border border-amber/25 rounded-xl text-[11px] text-amber-light font-medium animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" />
              Disk usage above 70% — run GitLab artifact cleanup
            </div>
          )}
        </div>
      )}

      {/* ── Card Grid ─────────────────────────────────────────────
          Mobile:  1 col, natural height (scroll)
          Tablet:  2 col, natural height (scroll)
          Desktop: 4×2 fixed-height grid filling viewport
        ──────────────────────────────────────────────────────── */}
      <main className="
        grid gap-3 p-4
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-4 xl:grid-rows-[repeat(2,minmax(0,1fr))]
        [&>*]:min-h-0
      ">
        <StatusCard     data={status}   loading={loading} />
        <ControlsCard   data={status}   onRefresh={fetchStatus} />
        <ScheduleCard   data={schedule} />
        <EditScheduleCard onSaved={async () => { try { setSchedule(await api.getSchedule()); } catch {} }} />
        <SSLCard        data={ssl} />
        <DiskUsageCard  data={disk} />
        <CPUCreditCard  credits={status?.cpu_credits ?? null} instanceType={status?.instance_type ?? null} />
        <CostCard       data={cost} />
        
        {/* Audit Log - spans 2 columns on desktop */}
        <div className="xl:col-span-2">
          <AuditLogCard />
        </div>
      </main>
    </div>
  );
}
