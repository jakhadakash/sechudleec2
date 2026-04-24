import type { InstanceStatus, ScheduleData, SSLCert, DiskUsage, CostData, ScheduleUpdate, AuditLogsResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Debug: Log the API URL being used
console.log('API_BASE_URL:', API_BASE_URL);
console.log('Environment:', import.meta.env.MODE);

function getApiKey(): string {
  let key = sessionStorage.getItem('ec2_api_key') ?? '';
  if (!key) {
    key = window.prompt('Enter dashboard API key:') ?? '';
    if (key) sessionStorage.setItem('ec2_api_key', key);
  }
  return key;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}/api${path}`;
  console.log('Fetching:', url); // Debug log
  const res = await fetch(url, {
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
