import React, { useState } from 'react';
import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { ConfirmModal } from '../ui/ConfirmModal';
import { LoadVal } from '../ui/SkeletonLoader';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import type { InstanceStatus } from '../../api/types';

interface Props { data: InstanceStatus | null; onRefresh: () => void; }

function formatUptime(hrs: number | null | undefined): string {
  if (hrs === null || hrs === undefined) return '—';
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${hrs.toFixed(1)}h`;
  return `${Math.floor(hrs / 24)}d ${Math.round(hrs % 24)}h`;
}

export function ControlsCard({ data, onRefresh }: Props) {
  const { toast } = useToast();
  const [loading,   setLoading]  = useState<'start' | 'stop' | null>(null);
  const [showStop,  setShowStop] = useState(false);
  const [lastAction, setLastAction] = useState<{ label: string; time: string; type: 'start' | 'stop' } | null>(null);

  const isRunning  = data?.state === 'running';
  const isStopped  = data?.state === 'stopped';
  const isTransient = data?.state === 'pending' || data?.state === 'stopping' || data?.state === 'starting';
  const stateColor  = isRunning ? '#00E676' : isStopped ? '#FF6B6B' : '#FFB84D';

  async function handleStart() {
    setLoading('start');
    try {
      await api.start();
      toast('Instance start initiated', 'success');
      setLastAction({ label: 'Started', time: new Date().toLocaleTimeString(), type: 'start' });
      setTimeout(onRefresh, 3000);
    } catch (e: any) { toast(`Start failed: ${e.message}`, 'error'); }
    finally { setLoading(null); }
  }

  async function handleStop() {
    setShowStop(false);
    setLoading('stop');
    try {
      await api.stop();
      toast('Graceful shutdown initiated — Sidekiq flushing', 'info');
      setLastAction({ label: 'Stopped', time: new Date().toLocaleTimeString(), type: 'stop' });
      setTimeout(onRefresh, 3000);
    } catch (e: any) { toast(`Stop failed: ${e.message}`, 'error'); }
    finally { setLoading(null); }
  }

  return (
    <>
      <Card delay={50} accent={isRunning ? 'green' : isStopped ? 'red' : 'amber'}>
        <CardHeader>
          <CardLabel icon="⚡">Controls</CardLabel>
          <CardTag>Manual Override</CardTag>
        </CardHeader>
        <Divider />

        <CardBody>
          {/* State readout */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
            <div className="flex flex-col gap-0.5">
              <span className="dd-label">Current State</span>
              <div className="flex items-center gap-2">
                <span className="relative flex-shrink-0">
                  <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: stateColor }} />
                  {(isRunning || isTransient) && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-35" style={{ backgroundColor: stateColor }} />
                  )}
                </span>
                <span className="text-[14px] font-bold capitalize" style={{ color: stateColor }}>
                  {data?.state ?? '…'}
                  {isTransient && <span className="ml-1 text-[11px] opacity-60 animate-pulse-dot">…</span>}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="dd-label">Region</span>
              <span className="text-[11px] font-mono" style={{ color: '#7A93B8' }}>ap-south-1</span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: '#7A93B8' }}>
            Manual start/stop overrides the EventBridge schedule.{' '}
            <span style={{ color: '#FFB84D' }} className="font-medium">Stop flushes Sidekiq queues first.</span>
          </p>

          {/* Start / Stop buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!isStopped || loading !== null}
              onClick={handleStart}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold
                transition-all duration-150 active:scale-[.97] disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'rgba(0,200,83,.1)', color: '#00E676', border: '1px solid rgba(0,200,83,.3)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(0,200,83,.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0,200,83,.1)'; }}
            >
              {loading === 'start'
                ? <><span className="w-3.5 h-3.5 border-2 border-green/30 border-t-green rounded-full animate-spin" />Starting</>
                : <>▶ Start</>}
            </button>
            <button
              disabled={!isRunning || loading !== null}
              onClick={() => setShowStop(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold
                transition-all duration-150 active:scale-[.97] disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'rgba(255,68,68,.1)', color: '#FF6B6B', border: '1px solid rgba(255,68,68,.3)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'rgba(255,68,68,.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,68,68,.1)'; }}
            >
              {loading === 'stop'
                ? <><span className="w-3.5 h-3.5 border-2 border-red/30 border-t-red rounded-full animate-spin" />Stopping</>
                : <>⏹ Stop</>}
            </button>
          </div>

          {/* Last action */}
          {lastAction && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium"
              style={{
                backgroundColor: lastAction.type === 'start' ? 'rgba(0,200,83,.07)' : 'rgba(255,68,68,.07)',
                borderColor:     lastAction.type === 'start' ? 'rgba(0,200,83,.2)'  : 'rgba(255,68,68,.2)',
                color:           lastAction.type === 'start' ? '#00E676'            : '#FF6B6B',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: lastAction.type === 'start' ? '#00C853' : '#FF4444' }} />
              {lastAction.label} · {lastAction.time}
            </div>
          )}

          {/* ── Instance metrics (fills remaining space) ── */}
          <div className="mt-auto flex flex-col gap-2">
            <Divider />
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Uptime',       value: data ? formatUptime(data.uptime_hours) : undefined },
                { label: 'CPU Credits',  value: data?.cpu_credits !== null && data?.cpu_credits !== undefined ? String(data.cpu_credits) : data ? '—' : undefined },
                { label: 'Instance',     value: data?.instance_type ?? undefined },
                { label: 'IP Address',   value: data?.public_ip ?? undefined },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5 p-2 rounded-lg border" style={{ backgroundColor: '#0D1526', borderColor: '#1E2D45' }}>
                  <span className="dd-label">{label}</span>
                  <LoadVal
                    val={value}
                    className="text-[11px] font-bold font-mono truncate"
                    style={{ color: '#7A93B8' } as React.CSSProperties}
                    skeletonW="w-14" skeletonH="h-3"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <ConfirmModal
        open={showStop}
        title="Stop EC2 Instance?"
        variant="danger"
        confirmLabel="Stop Instance"
        message={
          <span>
            This will <span className="font-medium" style={{ color: '#FFB84D' }}>flush all Sidekiq queues</span> and
            stop the instance. GitLab will be offline until the next scheduled start.
          </span>
        }
        onConfirm={handleStop}
        onCancel={() => setShowStop(false)}
      />
    </>
  );
}

