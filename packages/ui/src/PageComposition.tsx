import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  embedded?: boolean;
  width?: 'full' | 'wide' | 'content' | 'narrow';
}

const pageWidthClasses: Record<NonNullable<PageShellProps['width']>, string> = {
  full: 'max-w-none',
  wide: 'mx-auto w-full max-w-[112rem]',
  content: 'mx-auto max-w-[88rem]',
  narrow: 'mx-auto max-w-5xl'
};

/** Canonical scrolling and responsive route margins for authenticated pages. */
export const PageShell = React.forwardRef<HTMLElement, PageShellProps>(
  ({ children, className, embedded = false, id = 'main', tabIndex = -1, width = 'wide', ...props }, ref) => (
    <main
      ref={ref}
      id={id}
      tabIndex={tabIndex}
      className={twMerge(clsx(
        'page-shell min-w-0 w-full max-w-full',
        embedded
          ? 'page-shell--embedded'
          : 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-ui-bg px-[var(--ao-route-padding-x)] py-[var(--ao-route-padding-y)] custom-scrollbar stable-scrollbar-gutter',
        className
      ))}
      {...props}
    >
      <div className={pageWidthClasses[width]}>{children}</div>
    </main>
  )
);

PageShell.displayName = 'PageShell';

export interface PageHeaderProps {
  actions?: React.ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  breadcrumbs?: React.ReactNode;
  className?: string;
  context?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  title: React.ReactNode;
}

/** Route identity and action hierarchy shared by every authenticated surface. */
export const PageHeader: React.FC<PageHeaderProps> = ({
  actions,
  breadcrumbs,
  className,
  context,
  description,
  title,
  ...props
}) => (
  <header
    className={twMerge(
      'page-header mb-[var(--ao-header-content-gap)] flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
      className
    )}
    {...props}
  >
    <div className="min-w-0 max-w-3xl">
      {breadcrumbs && <nav aria-label="Breadcrumb" className="mb-2 type-caption text-ui-text-muted">{breadcrumbs}</nav>}
      {context && <div className="mb-2 type-label text-ui-text-muted">{context}</div>}
      <h1 className="type-route-title break-words text-ui-text">{title}</h1>
      {description && <div className="type-body mt-2 max-w-[72ch] text-ui-text-muted">{description}</div>}
    </div>
    {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
  </header>
);

export interface PageSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  actions?: React.ReactNode;
  compact?: boolean;
  description?: React.ReactNode;
  title?: React.ReactNode;
}

export const PageSection: React.FC<PageSectionProps> = ({ actions, children, className, compact = false, description, title, ...props }) => (
  <section className={twMerge('page-section mt-[var(--ao-section-gap)] first:mt-0', className)} {...props}>
    {(title || description || actions) && (
      <div className={twMerge(
        'flex min-w-0 flex-col sm:flex-row sm:items-end sm:justify-between',
        compact ? 'mb-3 gap-2' : 'mb-4 gap-3'
      )}>
        <div className="min-w-0">
          {title && <h2 className={compact ? 'type-panel-title text-ui-text' : 'type-section-title text-ui-text'}>{title}</h2>}
          {description && <div className="type-caption mt-1 max-w-[72ch] text-ui-text-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export type DataSurfaceState = 'ready' | 'loading' | 'refreshing' | 'loadingMore' | 'empty' | 'filtered-empty' | 'error';

export interface DataSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  count?: React.ReactNode;
  description?: React.ReactNode;
  empty?: React.ReactNode;
  error?: React.ReactNode;
  feedback?: React.ReactNode;
  filteredEmpty?: React.ReactNode;
  heading?: React.ReactNode;
  icon?: React.ReactNode;
  loading?: React.ReactNode;
  retainContent?: boolean;
  statusAnnouncement?: React.ReactNode;
  state?: DataSurfaceState;
  toolbar?: React.ReactNode;
  toolbarFullWidth?: boolean;
}

export const DataSurface: React.FC<DataSurfaceProps> = ({
  children,
  className,
  count,
  description,
  empty,
  error,
  feedback,
  filteredEmpty,
  heading,
  icon,
  loading,
  retainContent = false,
  state = 'ready',
  statusAnnouncement,
  toolbar,
  toolbarFullWidth = false,
  ...props
}) => {
  const retainsContent = state === 'refreshing' || state === 'loadingMore' || (state === 'error' && retainContent);
  const stateContent = state === 'loading'
    ? loading
    : state === 'empty'
      ? empty
      : state === 'filtered-empty'
        ? filteredEmpty
        : state === 'error' && !retainContent
          ? error
          : children;
  const isBusy = state === 'loading' || state === 'refreshing' || state === 'loadingMore';

  return (
    <section className={twMerge('data-surface min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-surface shadow-sm', className)} {...props}>
      {(heading || description || icon || count || toolbar) && (
        <TableToolbar>
          {(heading || description || icon) && (
            <div className="flex min-w-0 items-center gap-3">
              {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ui-border bg-ui-surface text-accent-strong">{icon}</div>}
              <div className="min-w-0">
                {heading && <h2 className="type-section-title text-ui-text">{heading}</h2>}
                {description && <div className="type-caption mt-1 text-ui-text-muted">{description}</div>}
              </div>
            </div>
          )}
          {(count || toolbar) && <div className={twMerge(
            'flex min-w-0 flex-wrap items-center gap-3',
            toolbarFullWidth ? 'w-full' : 'shrink-0'
          )}>{count && <span className="type-caption type-emphasis text-ui-text-muted">{count}</span>}{toolbar}</div>}
        </TableToolbar>
      )}
      <div aria-busy={isBusy || undefined}>
        {stateContent}
        {retainsContent && feedback}
        {statusAnnouncement && <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{statusAnnouncement}</div>}
      </div>
    </section>
  );
};

const TableToolbar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div
    className={twMerge('table-toolbar flex flex-col gap-3 border-b border-ui-border bg-ui-bg px-[var(--ao-surface-padding)] py-4 sm:flex-row sm:items-center sm:justify-between', className)}
    {...props}
  >
    {children}
  </div>
);
