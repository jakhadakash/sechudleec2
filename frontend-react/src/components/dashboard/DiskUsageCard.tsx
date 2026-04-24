import React from 'react';
import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { LoadVal } from '../ui/SkeletonLoader';
import type { DiskUsage } from '../../api/types';

interface Props { data: DiskUsage | null; }

export function DiskUsageCard({ data }: Props) {
  const pct    = data?.usage_percent ?? 0;
  const isCrit = pct > 85;
  const isWarn = pct > 70;
  const status = data?.status ?? 'ok';

  /* Gradient always derived from real pct, never from CSS variables */
  const barColor  = isCrit ? '#FF4444' : isWarn ? '#F5A623' : '#00C853';
  const barColor2 = isCrit ? '#FF2020' : isWarn ? '#E08800' : '#00E676';
  const barGlow   = isCrit ? 'rgba(255,68,68,.55)'  : isWarn ? 'rgba(245,166,35,.45)' : 'rgba(0,200,83,.50)';
  const barGrad   = `linear-gradient(90deg, ${barColor} 0%, ${barColor2} 100%)`;

  const ringCirc = 2 * Math.PI * 24;

  return (
    <Card delay={250} accent={isCrit ? 'red' : isWarn ? 'amber' : data ? 'green' : 'none'}>
      <CardHeader>
        <CardLabel icon="◫">Disk Usage</CardLabel>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
            style={{
              backgroundColor: isCrit ? 'rgba(255,68,68,.1)'  : isWarn ? 'rgba(245,166,35,.1)'  : 'rgba(0,200,83,.1)',
              color:           isCrit ? '#FF6B6B'              : isWarn ? '#FFB84D'              : '#00E676',
              borderColor:     isCrit ? 'rgba(255,68,68,.25)'  : isWarn ? 'rgba(245,166,35,.25)' : 'rgba(0,200,83,.25)',
            }}
          >
            {isCrit ? '⚠ Critical' : isWarn ? '⚠ Warning' : data ? '✓ OK' : '…'}
          </span>
          <CardTag>/var/opt/gitlab</CardTag>
        </div>
      </CardHeader>
      <Divider />

      <CardBody>
        {/* Ring + bar row */}
        <div className="flex items-center gap-4">
          {/* SVG donut ring */}
          <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 68, height: 68 }}>
            <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="34" cy="34" r="24" fill="none" stroke="#111D30" strokeWidth="7" />
              {data && (
                <circle
                  cx="34" cy="34" r="24" fill="none"
                  stroke={barColor} strokeWidth="7"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringCirc * (1 - pct / 100)}
                  strokeLinecap="round"
                  style={{
                    transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1), stroke .3s',
                    filter: `drop-shadow(0 0 6px ${barGlow})`,
                  }}
                />
              )}
            </svg>
            <div className="absolute flex flex-col items-center leading-none">
              {data ? (
                <>
                  <span className="text-[16px] font-bold tabular-nums" style={{ color: barColor }}>{pct}</span>
                  <span className="text-[9px] font-bold uppercase" style={{ color: '#3A5070' }}>%</span>
                </>
              ) : (
                <div className="skeleton w-8 h-4 rounded" />
              )}
            </div>
          </div>

          {/* Linear bar */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              {/* Bar track */}
              <div className="relative h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#111D30' }}>
                {data ? (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      /* Force a minimum visible width of 3px when data exists */
                      width: pct > 0 ? `${Math.min(pct, 100)}%` : '0%',
                      minWidth: pct > 0 ? '3px' : '0',
                      background: barGrad,
                      boxShadow: `0 0 10px ${barGlow}`,
                      transition: 'width .9s cubic-bezier(.4,0,.2,1)',
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 skeleton" />
                )}
                {/* Threshold markers always visible */}
                <div className="absolute inset-y-0 w-px opacity-50" style={{ left: '70%', backgroundColor: '#F5A623' }} title="70% warn" />
                <div className="absolute inset-y-0 w-px opacity-50" style={{ left: '85%', backgroundColor: '#FF4444' }} title="85% crit" />
              </div>
              {/* Scale labels */}
              <div className="flex justify-between text-[9px]" style={{ color: '#3A5070' }}>
                <span>0%</span>
                <span style={{ color: 'rgba(245,166,35,.65)' }}>70</span>
                <span style={{ color: 'rgba(255,68,68,.65)' }}>85</span>
                <span>100%</span>
              </div>
            </div>
            <div className="flex justify-between text-[11px]">
              <LoadVal val={data?.used_gb != null ? `${data.used_gb} GB used` : data ? '—' : undefined}
                className="font-medium" style={{ color: barColor } as React.CSSProperties}
                skeletonW="w-20" skeletonH="h-3" />
              <LoadVal val={data?.total_gb != null ? `of ${data.total_gb} GB` : data ? '' : undefined}
                className="font-medium" style={{ color: '#3A5070' } as React.CSSProperties}
                skeletonW="w-16" skeletonH="h-3" />
            </div>
          </div>
        </div>

        <Divider />

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Used',  val: data?.used_gb      != null ? `${data.used_gb} GB`      : data ? '—' : undefined, color: barColor },
            { label: 'Free',  val: data?.available_gb != null ? `${data.available_gb} GB` : data ? '—' : undefined, color: '#7A93B8' },
            { label: 'Total', val: data?.total_gb     != null ? `${data.total_gb} GB`     : data ? '—' : undefined, color: '#7A93B8' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col gap-0.5 p-2 rounded-lg border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
              <span className="dd-label">{label}</span>
              <LoadVal val={val} className="text-[12px] font-bold tabular-nums"
                style={{ color } as React.CSSProperties}
                skeletonW="w-12" skeletonH="h-3.5" />
            </div>
          ))}
        </div>

        {/* Zone legend */}
        <div className="flex items-center gap-4 mt-auto">
          {[
            { color: '#00C853', label: 'OK',       range: '<70%'  },
            { color: '#F5A623', label: 'Warning',  range: '70–85%' },
            { color: '#FF4444', label: 'Critical', range: '>85%'  },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1 text-[9px]" style={{ color: '#3A5070' }}>
              <span className="w-2 h-1.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              {s.label} {s.range}
            </div>
          ))}
        </div>

        {(status === 'error' || status === 'unavailable') && data?.error && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium"
            style={{
              backgroundColor: 'rgba(77,158,255,.07)',
              borderColor: 'rgba(77,158,255,.25)',
              color: '#7A93B8',
            }}
          >
            ℹ {data.error}
          </div>
        )}

        {status !== 'ok' && status !== 'error' && status !== 'unavailable' && data && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium"
            style={{
              backgroundColor: status === 'critical' ? 'rgba(255,68,68,.07)' : 'rgba(245,166,35,.07)',
              borderColor:     status === 'critical' ? 'rgba(255,68,68,.25)' : 'rgba(245,166,35,.25)',
              color:           status === 'critical' ? '#FF6B6B'             : '#FFB84D',
            }}
          >
            ⚠ {status === 'critical' ? 'Critical: disk > 85%' : 'Warning: disk > 70%'} — run artifact cleanup
          </div>
        )}
      </CardBody>
    </Card>
  );
}
