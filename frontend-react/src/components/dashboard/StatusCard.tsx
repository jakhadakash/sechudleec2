import { useState } from 'react';
import { Card, CardHeader, CardLabel, Divider, CardBody } from '../ui/Card';
import { StatusSkeleton, LoadVal, Skeleton } from '../ui/SkeletonLoader';
import type { InstanceStatus } from '../../api/types';

interface Props { data: InstanceStatus | null; loading: boolean; }

const STATE_CONFIG = {
  running:  { dot: 'bg-green animate-pulse-dot', badge: 'bg-green/10 text-green-light border-green/25',  accent: 'green' as const, label: 'Running'  },
  stopped:  { dot: 'bg-red',                     badge: 'bg-red/10   text-red-light   border-red/25',    accent: 'red'   as const, label: 'Stopped'  },
  pending:  { dot: 'bg-amber animate-pulse-dot', badge: 'bg-amber/10 text-amber-light border-amber/25', accent: 'amber' as const, label: 'Pending'  },
  stopping: { dot: 'bg-amber animate-pulse-dot', badge: 'bg-amber/10 text-amber-light border-amber/25', accent: 'amber' as const, label: 'Stopping' },
  starting: { dot: 'bg-blue  animate-pulse-dot', badge: 'bg-blue/10  text-blue-light  border-blue/25',  accent: 'blue'  as const, label: 'Starting' },
} as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })}
      title="Copy"
      className="ml-1 opacity-0 group-hover/row:opacity-100 transition-all text-[10px] px-1 rounded hover:text-blue-light"
      style={{ color: '#3A5070' }}
    >
      {copied ? '✓' : '⎘'}
    </button>
  );
}

function formatUptime(hrs: number | null | undefined): string | null {
  if (hrs === null || hrs === undefined) return null;
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h`;
}

export function StatusCard({ data, loading }: Props) {
  const cfg = data ? (STATE_CONFIG[data.state as keyof typeof STATE_CONFIG] ?? STATE_CONFIG.stopped) : null;
  const isConnecting = loading && !data;
  const isTransient  = data?.state === 'starting' || data?.state === 'stopping' || data?.state === 'pending';

  return (
    <Card delay={0} accent={cfg?.accent ?? 'none'}>
      {/* Scanning sweep while connecting / transitioning */}
      {(isConnecting || isTransient) && (
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue/60 to-transparent animate-scan z-10" />
      )}

      <CardHeader>
        <CardLabel icon="◈">Instance Status</CardLabel>
        {cfg ? (
          <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${cfg.badge}`}>
            <span className="relative flex-shrink-0">
              <span className={`block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {data?.state === 'running' && (
                <span className="absolute inset-0 rounded-full bg-green animate-ping opacity-40" />
              )}
            </span>
            {cfg.label}
          </span>
        ) : (
          <Skeleton className="h-5 w-20 rounded-full" />
        )}
      </CardHeader>
      <Divider />

      {isConnecting ? (
        <StatusSkeleton />
      ) : (
        <CardBody>
          {/* Primary fields */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="group/row flex flex-col gap-0.5">
              <span className="dd-label">Instance ID</span>
              <div className="flex items-center">
                <LoadVal val={data?.instance_id} className="text-[12px] font-semibold font-mono text-blue-light truncate" skeletonW="w-24" />
                {data?.instance_id && <CopyButton text={data.instance_id} />}
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="dd-label">Instance Type</span>
              <LoadVal val={data?.instance_type} className="text-[12px] font-semibold text-tp" skeletonW="w-16" />
            </div>
            <div className="group/row flex flex-col gap-0.5">
              <span className="dd-label">Public IP</span>
              <div className="flex items-center">
                <LoadVal val={data?.public_ip} className="text-[12px] font-semibold font-mono text-blue-light truncate" skeletonW="w-20" />
                {data?.public_ip && <CopyButton text={data.public_ip} />}
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="dd-label">Uptime</span>
              <LoadVal
                val={data ? (formatUptime(data.uptime_hours) ?? '—') : undefined}
                className="text-[14px] font-bold text-green-light tabular-nums"
                skeletonW="w-12" skeletonH="h-5"
              />
            </div>
          </div>

          <Divider />

          {/* Secondary mini-stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Region', value: data ? 'ap-south-1'  : undefined },
              { label: 'AZ',     value: data ? 'ap-south-1a' : undefined },
              { label: 'vCPUs',  value: data ? (data.instance_type?.includes('t3') ? '2' : '—') : undefined },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 p-2 rounded-lg border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
                <span className="dd-label">{label}</span>
                <LoadVal val={value} className="text-[11px] font-semibold" skeletonW="w-12" skeletonH="h-3" />
              </div>
            ))}
          </div>

          {/* CPU Credits mini bar — fills bottom space */}
          {data !== null && (
            <div className="mt-auto flex flex-col gap-1.5 p-2.5 rounded-xl border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
              <div className="flex items-center justify-between">
                <span className="dd-label">CPU Credits</span>
                <LoadVal
                  val={data.cpu_credits !== null ? String(data.cpu_credits) : undefined}
                  className="text-[11px] font-bold tabular-nums"
                  skeletonW="w-8" skeletonH="h-3"
                />
              </div>
              {data.cpu_credits !== null && (
                <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#162038' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min((data.cpu_credits / 150) * 100, 100)}%`,
                      background: data.cpu_credits < 10 ? '#FF4444' : data.cpu_credits < 30 ? '#F5A623' : 'linear-gradient(90deg,#00C853,#00E676)',
                      boxShadow: data.cpu_credits < 10 ? '0 0 6px rgba(255,68,68,.5)' : data.cpu_credits < 30 ? '0 0 6px rgba(245,166,35,.4)' : '0 0 6px rgba(0,200,83,.4)',
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}
