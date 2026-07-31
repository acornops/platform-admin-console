import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const baseCardClass = 'rounded-lg border border-ui-border bg-ui-surface shadow-sm';
const interactiveCardClass =
  'transition-colors hover:border-accent/30 hover:bg-ui-surface-strong/45 focus-within:border-accent/30';
const cardClassName = ({
  interactive = false,
  className
}: {
  interactive?: boolean;
  className?: string;
} = {}) => twMerge(clsx(baseCardClass, interactive && interactiveCardClass, className));

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/** Compatibility surface for platform-admin content that still needs a semantic card wrapper. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cardClassName({ interactive, className })}
      {...props}
    />
  )
);

Card.displayName = 'Card';
