interface Props { expr: string | null; className?: string; }

export function CronCode({ expr, className = '' }: Props) {
  if (!expr || expr === '—') return <code className={`font-mono text-[10px] text-tm ${className}`}>—</code>;

  const m = expr.match(/^cron\((\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\)$/);
  if (!m) return <code className={`font-mono text-[10px] text-blue-light break-all ${className}`}>{expr}</code>;

  const [, min, hr, dom, month, days] = m;
  return (
    <code className={`font-mono text-[10px] ${className}`}>
      <span className="cron-paren">cron(</span>
      <span className="cron-num">{min}</span>
      <span className="cron-sep"> </span>
      <span className="cron-num">{hr}</span>
      <span className="cron-wild"> {dom} {month} </span>
      <span className="cron-days">{days}</span>
      <span className="cron-wild"> *</span>
      <span className="cron-paren">)</span>
    </code>
  );
}
