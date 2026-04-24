import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { AreaChart, Area, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { useCountUp } from '../../hooks/useCountUp';

interface Props { credits: number | null; instanceType: string | null; }

function mockSparkline(current: number | null) {
  if (current === null) return [];
  return Array.from({ length: 24 }, (_, i) => ({
    h: 23 - i,
    v: Math.max(0, current + (Math.random() - 0.5) * 22 + Math.sin(i / 3) * 12),
  }));
}

const ZONES = [
  { label: 'Critical', range: '<10',   color: '#FF4444', from: 0,  to: 10  },
  { label: 'Warning',  range: '10–30', color: '#F5A623', from: 10, to: 30  },
  { label: 'Healthy',  range: '≥30',   color: '#00C853', from: 30, to: 150 },
];

export function CPUCreditCard({ credits, instanceType }: Props) {
  const level = credits === null ? 'unknown'
    : credits < 10 ? 'critical'
    : credits < 30 ? 'warning'
    : 'healthy';

  const color = level === 'critical' ? '#FF4444' : level === 'warning' ? '#F5A623' : '#00C853';
  const accentColor = level === 'critical' ? 'red' : level === 'warning' ? 'amber' : 'green';
  const data = mockSparkline(credits);

  const animated = useCountUp(credits, 700);
  const earnRate = instanceType?.includes('t3.micro') ? 6 : instanceType?.includes('t3.small') ? 12 : 24;

  return (
    <Card delay={300} accent={accentColor as any}>
      <CardHeader>
        <CardLabel icon="⚡">CPU Credits</CardLabel>
        <div className="flex items-center gap-2">
          {level !== 'unknown' && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
              style={{
                backgroundColor: `${color}18`,
                color: level === 'critical' ? '#FF6B6B' : level === 'warning' ? '#FFB84D' : '#00E676',
                borderColor: `${color}40`,
              }}
            >
              {level}
            </span>
          )}
          <CardTag>{instanceType ?? 'Burstable'}</CardTag>
        </div>
      </CardHeader>
      <Divider />

      <CardBody>
        {/* Big number + meta */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[46px] font-bold tabular-nums leading-none" style={{ color }}>
              {animated ?? '—'}
            </span>
            <span className="dd-label mt-0.5">Credits Available</span>
          </div>
          <div className="flex-1 flex flex-col items-end gap-2">
            <div>
              <span className="dd-label block text-right">Earn Rate</span>
              <span className="text-[12px] font-bold" style={{ color: '#7A93B8' }}>{earnRate}/hr</span>
            </div>
            <div>
              <span className="dd-label block text-right">Warn At</span>
              <span className="text-[12px] font-bold" style={{ color: '#F5A623' }}>30 credits</span>
            </div>
          </div>
        </div>

        {/* Sparkline */}
        {data.length > 0 && (
          <div className="-mx-1" style={{ height: 56 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={color} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ background: '#0D1526', border: '1px solid #1E2D45', borderRadius: 6, fontSize: 10, padding: '4px 8px', color: '#E8EEFF' }}
                  labelFormatter={v => `${v}h ago`}
                  formatter={(v) => [Number(v).toFixed(0), 'Credits']}
                />
                <ReferenceLine y={30} stroke="#F5A623" strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.5} />
                <ReferenceLine y={10} stroke="#FF4444" strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.5} />
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#cpuGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="dd-label -mt-1">24h estimated trend · ref lines: warn=30 / critical=10</p>

        <Divider />

        {/* Zone bar */}
        <div className="mt-auto">
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px mb-2">
            {ZONES.map(z => (
              <div key={z.label} style={{ flex: z.to - z.from, background: z.color, opacity: level === 'unknown' ? .25 : 1 }} />
            ))}
          </div>
          <div className="flex justify-between">
            {ZONES.map(z => (
              <div key={z.label} className="flex items-center gap-1 text-[9px]" style={{ color: '#3A5070' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: z.color }} />
                <span>{z.label} {z.range}</span>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
