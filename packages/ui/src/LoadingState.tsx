import React from 'react';

export interface LoadingStateProps {
  label?: string;
}

/**
 * Compact collection skeleton retained for governance tables and detail panels.
 * Route-level loading uses the shared PageLoadingFallback instead.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading…'
}) => (
  <div className="space-y-3 p-5" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {[0, 1, 2].map((item) => (
      <div
        key={item}
        aria-hidden="true"
        className="h-11 animate-pulse rounded-md bg-ui-surface-strong motion-reduce:animate-none"
      />
    ))}
  </div>
);
