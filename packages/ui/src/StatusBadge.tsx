import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  className,
  tone = 'neutral',
  ...props
}) => {
  const toneClass =
    tone === 'success'
      ? 'border-status-success/25 bg-status-success-soft text-status-success-text'
      : tone === 'warning'
        ? 'border-status-warning/25 bg-status-warning-soft text-status-warning-text'
        : tone === 'danger'
          ? 'border-status-danger/25 bg-status-danger-soft text-status-danger-text'
          : 'border-ui-border bg-ui-bg text-ui-text-muted';

  return (
    <span
      className={twMerge(clsx('inline-flex items-center rounded-full border px-2 py-0.5 type-micro-label', toneClass, className))}
      {...props}
    >
      {children}
    </span>
  );
};
