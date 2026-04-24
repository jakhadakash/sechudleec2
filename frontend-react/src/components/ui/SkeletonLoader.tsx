import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function StatusSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-28" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a shimmer skeleton when value is null/undefined,
 * otherwise renders the string value with optional className.
 */
export function LoadVal({
  val,
  className = '',
  style,
  skeletonW = 'w-16',
  skeletonH = 'h-3.5',
}: {
  val: string | number | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  skeletonW?: string;
  skeletonH?: string;
}) {
  if (val === null || val === undefined) {
    return <div className={`skeleton rounded ${skeletonH} ${skeletonW}`} />;
  }
  return <span className={className} style={style}>{val}</span>;
}

