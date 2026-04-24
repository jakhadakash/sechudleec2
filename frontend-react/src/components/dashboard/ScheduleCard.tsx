import { useState } from 'react';
import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { CronCode } from '../ui/CronCode';
import type { ScheduleData } from '../../api/types';

interface Props { data: ScheduleData | null; }

function parseISTTime(cron: string | null): { display: string; frac: number } {
  if (!cron) return { display: '—', frac: 0 };
  const m = cron.match(/cron\((\d+)\s+(\d+)/);
  if (!m) return { display: cron, frac: 0 };
  let istH = parseInt(m[2]) + 5, istM = parseInt(m[1]) + 30;
  if (istM >= 60) { istM -= 60; istH++; }
  if (istH >= 24) istH -= 24;
  const ap  = istH < 12 ? 'AM' : 'PM';
  const h12 = istH === 0 ? 12 : istH > 12 ? istH - 12 : istH;
  return {
    display: `${h12}:${String(istM).padStart(2,'0')} ${ap}`,
    frac: (istH + istM / 60) / 24,
  };
}

function parseDayLabel(cron: string | null): string {
  if (!cron) return '—';
  const m = cron.match(/\*\s+(\S+)\s+\*/);
  if (!m) return '—';
  return m[1].replace('MON-FRI','Mon–Fri').replace('MON-SAT','Mon–Sat').replace('MON-SUN','Mon–Sun');
}

export function ScheduleCard({ data }: Props) {
  const [showUtc, setShowUtc] = useState(false);

  const startRule = data?.daily_start;
  const stopRule  = data?.daily_stop;
  const startCron = startRule?.schedule ?? null;
  const stopCron  = stopRule?.schedule  ?? null;

  const startParsed  = parseISTTime(startCron);
  const stopParsed   = parseISTTime(stopCron);
  const startFrac    = startParsed.frac || 9/24;
  const stopFrac     = stopParsed.frac  || 21/24;
  const activeDays   = parseDayLabel(startCron);
  const windowHours  = Math.round((stopFrac - startFrac) * 24 * 10) / 10;
  const offHours     = Math.round((24 - windowHours) * 10) / 10;
  const savingsPct   = Math.round((offHours / 24) * 100);
  const isEnabled    = startRule?.state === 'ENABLED';

  return (
    <Card delay={100} accent={isEnabled ? 'green' : 'none'}>
      <CardHeader>
        <CardLabel icon="⏱">Active Schedule</CardLabel>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
            style={{
              backgroundColor: isEnabled ? 'rgba(0,200,83,.1)' : 'rgba(30,45,69,.5)',
              color:           isEnabled ? '#00E676' : '#3A5070',
              borderColor:     isEnabled ? 'rgba(0,200,83,.25)' : '#1E2D45',
            }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: isEnabled ? '#00C853' : '#3A5070' }}
            />
            {isEnabled ? 'Active' : 'Paused'}
          </span>
          <button
            onClick={() => setShowUtc(v => !v)}
            className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide transition-colors"
            style={{ backgroundColor: '#111D30', color: '#7A93B8', borderColor: '#2A3F5F' }}
          >
            {showUtc ? 'UTC' : 'IST'}
          </button>
          <CardTag>EventBridge</CardTag>
        </div>
      </CardHeader>
      <Divider />

      <CardBody>
        {/* 24h timeline */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[9px] font-medium" style={{ color: '#3A5070' }}>
            <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>12AM</span>
          </div>
          <div className="relative h-4 rounded overflow-hidden" style={{ backgroundColor: '#162038', border: '1px solid #1E2D45' }}>
            {/* active window */}
            <div
              className="absolute inset-y-0"
              style={{
                left: `${startFrac * 100}%`,
                width: `${(stopFrac - startFrac) * 100}%`,
                background: 'linear-gradient(90deg, rgba(0,200,83,.22), rgba(0,200,83,.12))',
              }}
            />
            {/* markers */}
            <div className="absolute inset-y-0 w-px" style={{ left: `${startFrac * 100}%`, backgroundColor: '#00C853', boxShadow: '0 0 4px rgba(0,200,83,.6)' }} />
            <div className="absolute inset-y-0 w-px" style={{ left: `${stopFrac  * 100}%`, backgroundColor: '#FF4444', boxShadow: '0 0 4px rgba(255,68,68,.6)' }} />
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span style={{ color: '#00E676' }}>▲ {startParsed.display} IST</span>
            <span style={{ color: '#FF6B6B' }}>▼ {stopParsed.display} IST</span>
          </div>
        </div>

        <Divider />

        {/* Rule rows */}
        <div className="flex flex-col gap-1">
          {[
            { key: 'daily_start', rule: startRule, cron: startCron, dotColor: '#00C853', label: 'Wake-up' },
            { key: 'daily_stop',  rule: stopRule,  cron: stopCron,  dotColor: '#FF4444', label: 'Sleep'   },
          ].map(({ key, rule, cron, dotColor, label }) => (
            <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[.015] transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="text-[11px] font-medium" style={{ color: '#7A93B8' }}>{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <CronCode expr={showUtc ? cron : null} className={showUtc ? '' : 'hidden'} />
                {!showUtc && (
                  <span className="text-[10px] font-mono font-bold" style={{ color: '#82BFFF' }}>
                    {parseISTTime(cron).display} IST
                  </span>
                )}
                {rule?.state && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wide uppercase"
                    style={{
                      backgroundColor: rule.state === 'ENABLED' ? 'rgba(0,200,83,.1)'  : 'rgba(30,45,69,.5)',
                      color:           rule.state === 'ENABLED' ? '#00E676' : '#3A5070',
                      borderColor:     rule.state === 'ENABLED' ? 'rgba(0,200,83,.25)' : '#1E2D45',
                    }}
                  >
                    {rule.state === 'ENABLED' ? 'ON' : 'OFF'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <Divider />

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1.5 mt-auto">
          {[
            { label: 'Days',    value: activeDays,        color: '#E8EEFF' },
            { label: 'On/day',  value: `${windowHours}h`, color: '#00E676' },
            { label: 'Off/day', value: `${offHours}h`,    color: '#FF6B6B' },
            { label: 'Savings', value: `~${savingsPct}%`, color: '#F5A623' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col gap-0.5 p-1.5 rounded-lg border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
              <span className="dd-label">{label}</span>
              <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
