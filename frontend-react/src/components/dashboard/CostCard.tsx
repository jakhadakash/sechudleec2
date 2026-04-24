import React from 'react';
import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, ReferenceLine, XAxis } from 'recharts';
import { useCountUp } from '../../hooks/useCountUp';
import { LoadVal } from '../ui/SkeletonLoader';
import type { CostData } from '../../api/types';

interface Props { data: CostData | null; }

function mockDailyBars(totalInr: number | null): { day: number; v: number }[] {
  if (!totalInr) return [];
  const days = new Date().getDate();
  const perDay = totalInr / days;
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    v: Math.max(0, perDay * (0.75 + Math.random() * 0.5)),
  }));
}

export function CostCard({ data }: Props) {
  const bars        = mockDailyBars(data?.cost_inr ?? null);
  const dailyTarget = (data?.target_monthly_inr ?? 1600) / 30;
  const onTrack     = data?.on_track;
  const target      = data?.target_monthly_inr ?? 1600;

  const animatedCost = useCountUp(data?.projected_monthly_inr ?? null);
  const actualCost = useCountUp(data?.actual_projected_monthly_inr ?? null);
  const today = new Date().getDate();

  return (
    <Card delay={350} accent={onTrack === false ? 'red' : onTrack === true ? 'green' : 'none'}>
      <CardHeader>
        <CardLabel icon="₹">Monthly Cost</CardLabel>
        <div className="flex items-center gap-2">
          {onTrack !== null && onTrack !== undefined && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
              style={{
                backgroundColor: onTrack ? 'rgba(0,200,83,.1)'  : 'rgba(255,68,68,.1)',
                color:           onTrack ? '#00E676' : '#FF6B6B',
                borderColor:     onTrack ? 'rgba(0,200,83,.25)' : 'rgba(255,68,68,.25)',
              }}
            >
              {onTrack ? '↓ On Track' : '↑ Over Budget'}
            </span>
          )}
          <CardTag>Cost Explorer</CardTag>
        </div>
      </CardHeader>
      <Divider />

      <CardBody>
        {/* Big number */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-start gap-0.5">
              <span className="text-[14px] font-semibold mt-2.5" style={{ color: '#7A93B8' }}>₹</span>
              <span className="text-[44px] font-bold tabular-nums leading-none" style={{ color: onTrack === false ? '#FF6B6B' : '#00E676' }}>
                {animatedCost?.toLocaleString('en-IN') ?? '0'}
              </span>
            </div>
            <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#7A93B8' }}>
              Expected with scheduling (43% uptime)
            </p>
            <p className="text-[9px] mt-1" style={{ color: '#3A5070' }}>
              Actual: ₹{actualCost?.toLocaleString('en-IN') ?? '0'} (running more than scheduled)
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1 items-end">
            <div>
              <span className="dd-label block text-right">Day {today}</span>
              <span className="text-[11px] font-bold" style={{ color: '#7A93B8' }}>of ~30</span>
            </div>
            <div>
              <span className="dd-label block text-right">Target</span>
              <span className="text-[11px] font-bold" style={{ color: '#7A93B8' }}>₹{target.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        {bars.length > 0 && (
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} barSize={4} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <XAxis
                  dataKey="day" tick={{ fontSize: 8, fill: '#3A5070', fontFamily: 'Geist Mono, monospace' }}
                  tickLine={false} axisLine={false} interval={4}
                />
                <Tooltip
                  contentStyle={{ background: '#0D1526', border: '1px solid #1E2D45', borderRadius: 8, fontSize: 10, padding: '4px 8px', color: '#E8EEFF' }}
                  formatter={(v) => [`₹${Number(v).toFixed(0)}`, 'Cost']}
                  labelFormatter={v => `Day ${v}`}
                  cursor={{ fill: 'rgba(77,158,255,.04)' }}
                />
                <ReferenceLine y={dailyTarget} stroke="#F5A623" strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.55} />
                <Bar dataKey="v" radius={[2,2,0,0]}>
                  {bars.map((b, i) => (
                    <Cell key={i} fill={
                      b.v > dailyTarget * 1.4 ? '#FF4444'
                      : b.v > dailyTarget ? '#F5A623'
                      : '#00C853'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <Divider />

        <div className="flex flex-col gap-0 mt-auto">
          {[
            { lbl: 'Without scheduling (24/7)',   val: data?.projected_without_scheduling_inr ? `₹${data.projected_without_scheduling_inr.toLocaleString('en-IN')}` : data ? '—' : undefined, color: '#FF6B6B', info: 'EC2 + EBS both 24/7' },
            { lbl: 'Monthly savings',             val: data?.potential_monthly_savings_inr ? `₹${data.potential_monthly_savings_inr.toLocaleString('en-IN')} (${data.cost_reduction_percent}%)` : data ? '—' : undefined, color: '#00E676', info: 'Savings from EC2 scheduling' },
          ].map(({ lbl, val, color, info }) => (
            <div key={lbl} className="flex justify-between items-center py-1.5 border-b last:border-0 text-[11px]" style={{ borderColor: '#152135' }} title={info}>
              <span style={{ color: '#7A93B8' }}>{lbl}</span>
              <LoadVal val={val} className="font-bold" style={{ color } as React.CSSProperties} skeletonW="w-14" skeletonH="h-3" />
            </div>
          ))}
        </div>

        {/* Cost breakdown */}
        {data && (
          <div className="mt-2 pt-2 border-t text-[10px]" style={{ borderColor: '#152135', color: '#3A5070' }}>
            <div className="flex justify-between">
              <span>EC2 (24/7):</span>
              <span>₹{data.ec2_instance_24_7_inr?.toLocaleString('en-IN') ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>EC2 (scheduled 43%):</span>
              <span>₹{data.ec2_instance_scheduled_inr?.toLocaleString('en-IN') ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>EBS 60GB gp3:</span>
              <span>₹{data.ebs_volume_monthly_inr?.toLocaleString('en-IN') ?? '—'}</span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
