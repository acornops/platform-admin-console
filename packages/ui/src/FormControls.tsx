import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { menuOptionClassName } from './menuStyles';

export const FieldLabel: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, className, ...props }) => (
  <label className={twMerge('block type-label text-ui-text', className)} {...props}>
    {children}
  </label>
);

export const HelpText: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
  <p className={twMerge('type-caption mt-1 text-ui-text-muted', className)} {...props}>
    {children}
  </p>
);

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ checked, className, disabled, label, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={twMerge(
      'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9',
      className
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors',
        checked ? 'border-ui-text bg-ui-text' : 'border-control-boundary bg-ui-surface-strong'
      )}
    >
      <span
        className={clsx(
          'h-[1.125rem] w-[1.125rem] rounded-full bg-ui-surface shadow-sm ring-1 ring-inset ring-ui-border transition-transform',
          checked ? 'translate-x-[1.125rem]' : 'translate-x-0'
        )}
      />
    </span>
  </button>
));

Switch.displayName = 'Switch';

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
  selected?: boolean;
}

export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(({ className, destructive, disabled, selected, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="menuitem"
    disabled={disabled}
    className={menuOptionClassName({
      className,
      destructive,
      disabled,
      selected
    })}
    {...props}
  />
));

MenuItem.displayName = 'MenuItem';
