import type { InstanceStatus, ScheduleData, SSLCert, DiskUsage, CostData, ScheduleUpdate, AuditLogsResponse } from './types';

function getApiKey(): string {
  let key = sessionStorage.getItem('ec2_api_key') ?? '';
  if (!key) {
    key = window.prompt('Enter dashboard API key:') ?? '';
    if (key) sessionStorage.setItem('ec2_api_key', key);
  }
  return key;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  status:         () => req<InstanceStatus>('/status'),
  start:          () => req<{ action: string; current_state: string }>('/start', { method: 'POST' }),
  stop:           () => req<{ action: string; current_state: string }>('/stop',  { method: 'POST' }),
  getSchedule:    () => req<ScheduleData>('/schedule'),
  updateSchedule: (body: ScheduleUpdate) =>
    req<{ rule_key: string; updated_to: string }>('/schedule', { method: 'POST', body: JSON.stringify(body) }),
  ssl:            () => req<SSLCert[]>('/ssl'),
  disk:           () => req<DiskUsage>('/disk'),
  cost:           () => req<CostData>('/cost'),
  auditLogs:      () => req<AuditLogsResponse>('/audit'),
};
