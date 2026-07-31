import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DataTableFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  stickyHeader?: boolean;
}

export const DataTableFrame: React.FC<DataTableFrameProps> = ({ children, className, stickyHeader = false, ...props }) => (
  <div
    className={twMerge('responsive-table-frame min-w-0 overflow-x-auto', stickyHeader && '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10', className)}
    {...props}
  >
    {children}
  </div>
);

export interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  caption: React.ReactNode;
  captionHidden?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({ caption, captionHidden = true, children, className, ...props }) => (
  <table className={twMerge('responsive-table w-full min-w-[44rem] border-collapse text-left', className)} {...props}>
    <caption className={captionHidden ? 'sr-only' : 'type-caption px-[var(--ao-surface-padding)] py-3 text-left text-ui-text-muted'}>{caption}</caption>
    {children}
  </table>
);

export type DataTableDensity = 'standard' | 'dense' | 'compact';

const dataTableHeaderCellDensityClassNames: Record<DataTableDensity, string> = {
  standard: 'px-4 py-4 sm:px-6 lg:px-8 lg:py-5',
  dense: 'px-4 py-4',
  compact: 'px-5 py-3'
};

export interface DataTableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  density?: DataTableDensity;
  numeric?: boolean;
  sortDirection?: 'ascending' | 'descending' | 'none';
  onSort?: () => void;
}

export const DataTableHeaderCell: React.FC<DataTableHeaderCellProps> = ({
  children,
  className,
  density = 'standard',
  numeric = false,
  onSort,
  sortDirection,
  ...props
}) => (
  <th
    scope="col"
    aria-sort={sortDirection}
    className={twMerge(clsx(
      'type-label bg-ui-bg text-left text-ui-text-muted',
      dataTableHeaderCellDensityClassNames[density],
      numeric && 'text-right tabular-nums',
      className
    ))}
    {...props}
  >
    {onSort ? <button type="button" className="control-target rounded-md px-1 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-control-boundary" onClick={onSort}>{children}</button> : children}
  </th>
);
