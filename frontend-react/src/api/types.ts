export interface InstanceStatus {
  instance_id: string;
  state: 'running' | 'stopped' | 'pending' | 'stopping' | 'starting';
  instance_type: string;
  launch_time: string | null;
  uptime_hours: number | null;
  public_ip: string;
  cpu_credits: number | null;
}

export interface ScheduleRule {
  rule_name: string;
  schedule: string | null;
  state: 'ENABLED' | 'DISABLED' | 'NOT_FOUND';
  description?: string;
}

export type ScheduleData = Record<string, ScheduleRule>;

export interface SSLCert {
  domain: string;
  expiry_date: string | null;
  days_remaining: number | null;
  status: 'ok' | 'warning' | 'critical' | 'error';
  error: string | null;
}

export interface DiskUsage {
  total_gb: number | null;
  used_gb: number | null;
  available_gb: number | null;
  usage_percent: number | null;
  status: 'ok' | 'warning' | 'critical' | 'error' | 'unavailable';
  error: string | null;
}

export interface CostData {
  period_start: string | null;
  period_end: string | null;
  cost_usd: number | null;
  cost_inr: number | null;
  actual_projected_monthly_inr: number | null;
  projected_monthly_inr: number | null;
  projected_without_scheduling_inr: number | null;
  potential_monthly_savings_inr: number | null;
  ec2_instance_24_7_inr: number | null;
  ec2_instance_scheduled_inr: number | null;
  ebs_volume_monthly_inr: number | null;
  scheduling_uptime_percent: number;
  cost_reduction_percent: number;
  target_monthly_inr: number;
  on_track: boolean | null;
  error: string | null;
}

export interface ScheduleUpdate {
  rule_key: string;
  cron_expression: string;
}

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  status: string;
  details: Record<string, any>;
  user?: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
}
