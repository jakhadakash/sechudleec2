import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardLabel, CardTag, Divider, CardBody } from '../ui/Card';
import { api } from '../../api/client';
import type { AuditLogEntry } from '../../api/types';

export function AuditLogCard() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.auditLogs();
        setLogs(data.logs);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'instance_start': return '▶️';
      case 'instance_stop': return '⏹️';
      case 'schedule_update': return '📅';
      default: return '📝';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'instance_start': return 'Instance Started';
      case 'instance_stop': return 'Instance Stopped';
      case 'schedule_update': return 'Schedule Updated';
      default: return action;
    }
  };

  const formatDetails = (action: string, details: Record<string, any>) => {
    switch (action) {
      case 'instance_start':
      case 'instance_stop':
        return `${details.instance_id} → ${details.new_state}`;
      case 'schedule_update':
        return `${details.rule_key}: ${details.old_schedule} → ${details.new_schedule}`;
      default:
        return JSON.stringify(details);
    }
  };

  return (
    <Card delay={500}>
      <CardHeader>
        <CardLabel icon="📋">Audit Log</CardLabel>
        <CardTag>Last 20 Changes</CardTag>
      </CardHeader>
      <Divider />

      <CardBody>
        {loading ? (
          <div className="text-center py-4" style={{ color: '#7A93B8' }}>
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-4" style={{ color: '#7A93B8' }}>
            No audit logs yet
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 rounded border"
                style={{
                  backgroundColor: log.status === 'success' ? 'rgba(0,200,83,.05)' : 'rgba(255,68,68,.05)',
                  borderColor: log.status === 'success' ? 'rgba(0,200,83,.15)' : 'rgba(255,68,68,.15)'
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-sm">{getActionIcon(log.action)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold" style={{ color: '#E8EEFF' }}>
                        {getActionLabel(log.action)}
                      </div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: '#7A93B8' }}>
                        {formatDetails(log.action, log.details)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-right whitespace-nowrap" style={{ color: '#3A5070' }}>
                    {formatTimestamp(log.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
