import { useState } from 'react';
import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { CronCode } from '../ui/CronCode';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';

const DAYS = [
  { key: 'MON', short: 'M', full: 'Mon' },
  { key: 'TUE', short: 'T', full: 'Tue' },
  { key: 'WED', short: 'W', full: 'Wed' },
  { key: 'THU', short: 'T', full: 'Thu' },
  { key: 'FRI', short: 'F', full: 'Fri' },
  { key: 'SAT', short: 'S', full: 'Sat' },
  { key: 'SUN', short: 'S', full: 'Sun' },
];

const DAY_ORDER: Record<string, number> = { MON:0,TUE:1,WED:2,THU:3,FRI:4,SAT:5,SUN:6 };

function buildTimeOptions() {
  const opts: { value: string; label: string }[] = [];
  for (let h = 5; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const hh = String(h).padStart(2,'0');
      const mm = String(m).padStart(2,'0');
      const ap = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${ap} IST` });
    }
  }
  return opts;
}

function istToUtc(timeStr: string): { h: number; m: number } {
  let [h, m] = timeStr.split(':').map(Number);
  m -= 30; h -= 5;
  if (m < 0) { m += 60; h--; }
  if (h < 0) h += 24;
  return { h, m };
}

function buildDayStr(selected: string[]): string {
  const sorted = [...selected].sort((a,b) => DAY_ORDER[a] - DAY_ORDER[b]);
  if (sorted.join(',') === 'MON,TUE,WED,THU,FRI,SAT,SUN') return 'MON-SUN';
  if (sorted.join(',') === 'MON,TUE,WED,THU,FRI,SAT')     return 'MON-SAT';
  if (sorted.join(',') === 'MON,TUE,WED,THU,FRI')         return 'MON-FRI';
  return sorted.join(',');
}

function buildCron(days: string[], timeStr: string): string {
  const { h, m } = istToUtc(timeStr);
  return `cron(${m} ${h} ? * ${buildDayStr(days)} *)`;
}

interface Props { onSaved: () => void; }

export function EditScheduleCard({ onSaved }: Props) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['MON','TUE','WED','THU','FRI','SAT'])
  );
  const [startTime, setStartTime] = useState('09:00');
  const [stopTime,  setStopTime]  = useState('21:00');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const timeOpts = buildTimeOptions();

  function toggle(day: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  const startCron = selected.size ? buildCron([...selected], startTime) : null;
  const stopCron  = selected.size ? buildCron([...selected], stopTime)  : null;

  async function save() {
    if (!selected.size || !startCron || !stopCron) { toast('Select at least one day', 'warning'); return; }
    setSaving(true);
    try {
      await Promise.all([
        api.updateSchedule({ rule_key: 'daily_start', cron_expression: startCron }),
        api.updateSchedule({ rule_key: 'daily_stop',  cron_expression: stopCron }),
      ]);
      toast('Schedule updated', 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e: any) {
      toast(`Failed: ${e.message}`, 'error');
    } finally { setSaving(false); }
  }

  return (
    <Card delay={150} accent="blue">
      <CardHeader>
        <CardLabel icon="✏">Edit Schedule</CardLabel>
        <CardTag>IST = UTC+5:30</CardTag>
      </CardHeader>
      <Divider />

      <CardBody>
        {/* Day picker */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.13em] mb-2" style={{ color: '#8B949E' }}>
            Active Days
          </p>
          <div className="flex gap-1">
            {DAYS.map((d, i) => {
              const on = selected.has(d.key);
              const isWeekend = i >= 5;
              return (
                <button
                  key={d.key}
                  onClick={() => toggle(d.key)}
                  title={d.full}
                  className="flex-1 flex flex-col items-center py-2 rounded-xl border text-[11px] font-bold
                    transition-all duration-150 active:scale-[.92]"
                  style={{
                    backgroundColor: on
                      ? isWeekend ? 'rgba(245,166,35,.12)' : 'rgba(0,200,83,.12)'
                      : '#161B22',
                    borderColor: on
                      ? isWeekend ? 'rgba(245,166,35,.4)' : 'rgba(0,200,83,.4)'
                      : '#30363D',
                    color: on
                      ? isWeekend ? '#FFB84D' : '#00E676'
                      : '#8B949E',
                  }}
                >
                  {d.short}
                  <span
                    className="mt-1 w-1 h-1 rounded-full transition-colors"
                    style={{ backgroundColor: on ? (isWeekend ? '#F5A623' : '#00C853') : '#30363D' }}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-1" style={{ color: '#3A5070', fontSize: '8.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>
            <span>Mon</span>
            <span>Sat Sun</span>
          </div>
        </div>

        {/* Time selects */}
        <div className="grid grid-cols-2 gap-2">
          {([
            { label: '☀ Wake-up', value: startTime, setter: setStartTime },
            { label: '🌙 Sleep',  value: stopTime,  setter: setStopTime  },
          ]).map(({ label, value, setter }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label
                className="text-[10px] font-bold uppercase tracking-[.1em]"
                style={{ color: '#8B949E' }}
              >
                {label}
              </label>
              <select
                value={value}
                onChange={e => setter(e.target.value)}
                style={{
                  backgroundColor: '#1C2128',
                  color: '#F0F6FC',
                  borderColor: '#30363D',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderRadius: '8px',
                  padding: '6px 28px 6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  cursor: 'pointer',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238B949E' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  width: '100%',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#388BFD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(56,139,253,.15)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#30363D'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {timeOpts.map(o => (
                  <option key={o.value} value={o.value} style={{ backgroundColor: '#1C2128', color: '#F0F6FC' }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Cron preview */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
          {[['Start', startCron], ['Stop', stopCron]].map(([lbl, val]) => (
            <div key={lbl} className="flex items-start gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest w-8 pt-0.5 flex-shrink-0" style={{ color: '#3A5070' }}>
                {lbl}
              </span>
              <CronCode expr={val} />
            </div>
          ))}
        </div>

        {/* Apply button */}
        <button
          onClick={save}
          disabled={saving || !selected.size}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[12px] transition-all duration-200 active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
          style={{
            backgroundColor: saved ? '#238636' : '#1a7f37',
            color: '#FFFFFF',
            border: '1px solid',
            borderColor: saved ? '#2EA043' : '#238636',
            boxShadow: saved ? '0 0 20px rgba(46,160,67,.4)' : '0 0 12px rgba(35,134,54,.2)',
            cursor: (saving || !selected.size) ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => { if (!saving && selected.size) e.currentTarget.style.backgroundColor = '#2EA043'; }}
          onMouseLeave={e => { if (!saving && selected.size) e.currentTarget.style.backgroundColor = saved ? '#238636' : '#1a7f37'; }}
        >
          {saving
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
            : saved
            ? '✓ Schedule Applied'
            : 'Apply Schedule'}
        </button>
      </CardBody>
    </Card>
  );
}
