import { type ReactNode, useRef } from 'react';

type Accent = 'green' | 'red' | 'amber' | 'blue' | 'none';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  accent?: Accent;
}

export function Card({ children, className = '', delay = 0, accent = 'none' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  const accentClass = accent !== 'none' ? `accent-${accent}` : '';

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`relative flex flex-col gap-3 p-4 rounded-2xl
        h-full min-h-0 overflow-hidden group
        animate-fade-up glass-card ${accentClass} ${className}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {/* Mouse-tracking radial glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(77,158,255,.045), transparent 70%)' }}
      />
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between min-h-[22px] flex-shrink-0">{children}</div>;
}

export function CardLabel({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-ts">
      {icon && <span className="text-[11px] opacity-75">{icon}</span>}
      {children}
    </div>
  );
}

export function CardTag({ children }: { children: ReactNode }) {
  return (
    <span className="text-[9px] font-bold text-tm bg-card-3 border border-border px-2 py-0.5 rounded tracking-[.06em] uppercase flex-shrink-0">
      {children}
    </span>
  );
}

export function Divider() {
  return <div className="border-t border-border-soft flex-shrink-0" />;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex-1 min-h-0 flex flex-col gap-3 overflow-auto ${className}`}>{children}</div>;
}
