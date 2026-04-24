import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import type { SSLCert } from '../../api/types';

interface Props { data: SSLCert[] | null; }

function RingTimer({ days }: { days: number | null }) {
  const max = 90;
  const r = 20, circ = 2 * Math.PI * r;
  const pct = days === null ? 0 : Math.min(days / max, 1);
  const color = !days ? '#3A5070' : days < 14 ? '#FF4444' : days < 30 ? '#F5A623' : '#00C853';
  const bgCol = !days ? '#0D1526'  : days < 14 ? 'rgba(255,68,68,.07)' : days < 30 ? 'rgba(245,166,35,.07)' : 'rgba(0,200,83,.07)';

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 50, height: 50, background: bgCol, borderRadius: '50%' }}>
      <svg width="50" height="50" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
        <circle cx="25" cy="25" r={r} fill="none" stroke="rgba(30,45,69,.8)" strokeWidth="4" />
        <circle cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .7s ease, stroke .3s', filter: `drop-shadow(0 0 3px ${color}80)` }}
        />
      </svg>
      <div className="flex flex-col items-center leading-none z-10">
        <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{days ?? '?'}</span>
        <span className="text-[7px] font-bold uppercase tracking-wide" style={{ color: '#3A5070' }}>days</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string; label: string }> = {
    ok:       { bg: 'rgba(0,200,83,.1)',    color: '#00E676', border: 'rgba(0,200,83,.25)',   label: 'Valid' },
    warning:  { bg: 'rgba(245,166,35,.1)',  color: '#FFB84D', border: 'rgba(245,166,35,.25)', label: 'Expiring' },
    critical: { bg: 'rgba(255,68,68,.1)',   color: '#FF6B6B', border: 'rgba(255,68,68,.25)',  label: 'Critical' },
    error:    { bg: 'rgba(30,45,69,.5)',    color: '#3A5070', border: '#1E2D45',              label: 'Error' },
  };
  const s = cfg[status] ?? cfg.error;
  return (
    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color, borderColor: s.border }}>
      {s.label}
    </span>
  );
}

export function SSLCard({ data }: Props) {
  const hasCritical = data?.some(c => c.status === 'critical');
  const hasWarning  = data?.some(c => c.status === 'warning');

  return (
    <Card delay={200} accent={hasCritical ? 'red' : hasWarning ? 'amber' : data ? 'green' : 'none'}>
      <CardHeader>
        <CardLabel icon="🔒">SSL Certificates</CardLabel>
        <div className="flex items-center gap-2">
          {data && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
              style={{
                backgroundColor: hasCritical ? 'rgba(255,68,68,.1)'  : hasWarning ? 'rgba(245,166,35,.1)'  : 'rgba(0,200,83,.1)',
                color:           hasCritical ? '#FF6B6B'              : hasWarning ? '#FFB84D'              : '#00E676',
                borderColor:     hasCritical ? 'rgba(255,68,68,.25)'  : hasWarning ? 'rgba(245,166,35,.25)' : 'rgba(0,200,83,.25)',
              }}
            >
              {hasCritical ? '⚠ Critical' : hasWarning ? '⚠ Warning' : '✓ All Clear'}
            </span>
          )}
          <CardTag>Certbot</CardTag>
        </div>
      </CardHeader>

      {hasCritical && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium"
          style={{ backgroundColor: 'rgba(255,68,68,.07)', borderColor: 'rgba(255,68,68,.25)', color: '#FF6B6B' }}>
          ⚠ Certificate expiring soon — renew immediately
        </div>
      )}

      <Divider />

      <CardBody>
        {!data ? (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: '#3A5070' }}>
            <span className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#1E2D45', borderTopColor: '#3A5070' }} />
            Checking certificates…
          </div>
        ) : data.length === 0 ? (
          <p className="text-[11px]" style={{ color: '#3A5070' }}>No domains configured</p>
        ) : data.map(cert => {
          const fmtDate = cert.expiry_date
            ? new Date(cert.expiry_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
            : cert.error ?? 'Unknown';
          return (
            <div key={cert.domain} className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-150"
              style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A3F5F'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E2D45'; }}>
              <RingTimer days={cert.days_remaining} />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`https://${cert.domain}`} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] font-bold transition-colors truncate"
                    style={{ color: '#E8EEFF' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#82BFFF'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#E8EEFF'; }}>
                    {cert.domain}
                  </a>
                  <StatusBadge status={cert.status} />
                </div>
                <span className="text-[10px]" style={{ color: '#3A5070' }}>Expires {fmtDate}</span>
                {cert.days_remaining !== null && (
                  <span className="text-[10px] font-semibold" style={{ color: '#7A93B8' }}>{cert.days_remaining} days remaining</span>
                )}
              </div>
            </div>
          );
        })}

        {data && data.length > 0 && !hasCritical && !hasWarning && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-medium mt-auto"
            style={{ backgroundColor: 'rgba(0,200,83,.06)', borderColor: 'rgba(0,200,83,.18)', color: '#00E676' }}>
            ✓ All certificates valid — auto-renew configured
          </div>
        )}
      </CardBody>
    </Card>
  );
}
