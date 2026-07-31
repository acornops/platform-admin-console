import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Laptop,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  PanelsTopLeft,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  X
} from 'lucide-react';
import {
  Button,
  getOverlayFocusWrapIndex,
  NavigationLink,
  NavigationSection,
  PageShell,
  Sidebar,
  ToastViewport,
  type AppToast
} from '@acornops/ui';
import { adminApi, logoutAdmin, readableError } from './api';
import { administratorInitials, resolveRoute, type RouteName } from './lib';
import { OverviewPage } from './pages/OverviewPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkspaceDefaultsPage } from './pages/WorkspaceDefaultsPage';
import { AuditPage } from './pages/AuditPage';

type ThemePreference = 'system' | 'light' | 'dark';
const themeStorageKey = 'app_theme';

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.resolvedTheme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121110' : '#7f4b3b');
}

interface NavItem {
  label: string;
  path: string;
  route: RouteName;
  icon: typeof LayoutGrid;
}

const navSections: Array<{ title?: string; items: NavItem[] }> = [
  { items: [{ label: 'Overview', path: '/', route: 'overview', icon: LayoutGrid }] },
  {
    title: 'Resource Management',
    items: [
      { label: 'Workspaces', path: '/workspaces', route: 'workspaces', icon: PanelsTopLeft },
      { label: 'Users', path: '/users', route: 'users', icon: Users }
    ]
  },
  {
    title: 'Platform Settings',
    items: [
      { label: 'Workspace', path: '/settings/workspace', route: 'settings-workspace', icon: PanelsTopLeft },
      { label: 'AI Providers', path: '/settings/ai', route: 'settings-ai', icon: Bot },
      { label: 'Capabilities', path: '/workspace-defaults', route: 'workspace-defaults', icon: SlidersHorizontal }
    ]
  },
  { title: 'Governance', items: [{ label: 'Admin Audit', path: '/audit', route: 'audit', icon: ShieldCheck }] }
];

export function App() {
  const [route, setRoute] = useState(() => resolveRoute(location.pathname));
  const [identity, setIdentity] = useState<any>(null);
  const [identityError, setIdentityError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const accountRootRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const themeItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const appContentRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem(themeStorageKey);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  });

  const navigate = useCallback((path: string, options: { replace?: boolean } = {}) => {
    if (options.replace) history.replaceState({}, '', path);
    else if (`${location.pathname}${location.search}` !== path) history.pushState({}, '', path);
    setRoute(resolveRoute(new URL(path, location.origin).pathname));
    setMobileOpen(false);
    setAccountOpen(false);
    setThemeOpen(false);
    requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const pop = () => setRoute(resolveRoute(location.pathname));
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(themeStorageKey, theme); } catch { /* Appearance still applies for this page. */ }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => { if (theme === 'system') applyTheme('system'); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [theme]);

  useEffect(() => {
    if (!accountOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!accountRootRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
        setThemeOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setAccountOpen(false);
      setThemeOpen(false);
      accountTriggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const content = appContentRef.current;
    const previousAriaHidden = content?.getAttribute('aria-hidden') ?? null;
    const previousInert = content?.inert ?? false;
    if (content) {
      content.inert = true;
      content.setAttribute('aria-hidden', 'true');
    }
    const focusTimer = window.setTimeout(() => mobileCloseRef.current?.focus({ preventScroll: true }), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleEscape);
      if (content) {
        content.inert = previousInert;
        if (previousAriaHidden === null) content.removeAttribute('aria-hidden');
        else content.setAttribute('aria-hidden', previousAriaHidden);
      }
      mobileTriggerRef.current?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

  useEffect(() => {
    adminApi('/me')
      .then((value) => setIdentity(value.actor))
      .catch((error) => setIdentityError(readableError(error)));
  }, []);

  const notify = useCallback((input: string | { message: string; tone?: 'success' | 'danger' }) => {
    const value = typeof input === 'string' ? { message: input, tone: 'success' as const } : input;
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, ...value }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3800);
  }, []);

  const role = identity?.roles?.[0] || '';
  const canMutate = role === 'platform-admin';
  const hiddenRoutes = useMemo(() => new Set<RouteName>(
    role === 'platform-admin-auditor'
      ? ['overview', 'workspaces', 'users', 'settings-workspace', 'settings-ai', 'workspace-defaults']
      : role === 'platform-admin-viewer'
        ? ['audit']
        : []
  ), [role]);

  useEffect(() => {
    if (!identity || !hiddenRoutes.has(route.name)) return;
    navigate(role === 'platform-admin-auditor' ? '/audit' : '/', { replace: true });
  }, [hiddenRoutes, identity, navigate, role, route.name]);

  const pageProps = { navigate, notify, canMutate };
  const page = route.name === 'overview'
    ? <OverviewPage {...pageProps} />
    : route.name === 'workspaces'
      ? <WorkspacesPage {...pageProps} resourceId={route.resourceId} />
      : route.name === 'users'
        ? <UsersPage {...pageProps} resourceId={route.resourceId} />
        : route.name === 'settings-workspace'
          ? <SettingsPage {...pageProps} category="workspace" />
          : route.name === 'settings-ai'
            ? <SettingsPage {...pageProps} category="ai" />
            : route.name === 'workspace-defaults'
              ? <WorkspaceDefaultsPage {...pageProps} />
              : <AuditPage {...pageProps} />;

  const sidebar = (instance: 'desktop' | 'mobile') => (
    <Sidebar className="admin-sidebar h-full w-64" aria-label="Primary navigation">
      <div className="flex h-[5.25rem] items-center gap-3 px-5">
        <img src="/admin-brandmark.svg" alt="" width="35" height="41" />
        <div className="min-w-0">
          <div className="text-xl leading-5 text-brand-brown"><strong>acorn</strong><b className="text-accent">ops</b></div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--admin-clay-strong))]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Platform Admin
          </div>
        </div>
      </div>
      <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pt-2">
        {navSections.map((section, sectionIndex) => (
          <NavigationSection title={section.title} key={section.title || sectionIndex}>
            {section.items.filter((item) => !hiddenRoutes.has(item.route)).map((item) => {
              const Icon = item.icon;
              return (
                <NavigationLink
                  key={item.path}
                  href={item.path}
                  active={route.name === item.route}
                  leading={<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  className="admin-nav-link"
                  onClick={(event) => { event.preventDefault(); navigate(item.path); }}
                >
                  {item.label}
                </NavigationLink>
              );
            })}
          </NavigationSection>
        ))}
      </nav>
      <div ref={accountRootRef} className="relative border-t border-[rgb(var(--admin-border))] p-3">
        <button
          ref={accountTriggerRef}
          type="button"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-controls={`${instance}-admin-account-menu`}
          aria-expanded={accountOpen}
          onClick={() => { setAccountOpen((current) => !current); setThemeOpen(false); }}
          className="flex w-full items-center gap-3 rounded-md p-2 text-left outline-none hover:bg-[rgb(var(--admin-clay-soft))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--admin-clay)/.35)]"
        >
          <span className="admin-avatar grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold">
            {administratorInitials(identity)}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-ui-text">{identity?.displayName || identity?.email || 'Platform admin'}</strong>
            <small className="block truncate text-xs text-ui-text-muted">{role ? role.replaceAll('-', ' ') : identityError || 'Loading identity…'}</small>
          </span>
          <ChevronDown className={`h-4 w-4 text-ui-text-muted transition-transform ${accountOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {accountOpen && (
          <div id={`${instance}-admin-account-menu`} role="menu" aria-label="Account" className="absolute inset-x-3 bottom-[4.5rem] z-40 rounded-lg border border-ui-border bg-ui-surface p-2 shadow-lg">
            <div className="border-b border-ui-border px-2 py-2">
              <strong className="block truncate text-sm text-ui-text">{identity?.displayName || 'Platform admin'}</strong>
              <small className="block truncate text-xs text-ui-text-muted">{identity?.email || identity?.subject}</small>
            </div>
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-controls={`${instance}-theme-menu`}
              aria-expanded={themeOpen}
              className="mt-1 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-ui-text hover:bg-ui-bg"
              onClick={() => setThemeOpen((current) => !current)}
              onKeyDown={(event) => {
                if (!themeOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                  event.preventDefault();
                  setThemeOpen(true);
                  requestAnimationFrame(() => themeItemRefs.current[['system', 'light', 'dark'].indexOf(theme)]?.focus({ preventScroll: true }));
                }
              }}
            >
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
              <span className="flex-1"><strong className="block">Theme</strong><small className="text-ui-text-muted">{theme[0].toUpperCase() + theme.slice(1)}</small></span>
              <ChevronDown className={`h-4 w-4 text-ui-text-muted ${themeOpen ? 'rotate-180' : ''}`} />
            </button>
            {themeOpen && (
              <div
                id={`${instance}-theme-menu`}
                role="menu"
                aria-label="Appearance"
                className="ml-7 border-l border-ui-border pl-2"
                onKeyDown={(event) => {
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const current = themeItemRefs.current.findIndex((item) => item === document.activeElement);
                  const last = themeItemRefs.current.length - 1;
                  const next = event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? last
                      : event.key === 'ArrowDown'
                        ? (current + 1) % themeItemRefs.current.length
                        : (current - 1 + themeItemRefs.current.length) % themeItemRefs.current.length;
                  themeItemRefs.current[next]?.focus({ preventScroll: true });
                }}
              >
                {(['system', 'light', 'dark'] as ThemePreference[]).map((value) => (
                  <button
                    ref={(element) => { themeItemRefs.current[['system', 'light', 'dark'].indexOf(value)] = element; }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === value}
                    key={value}
                    onClick={() => { setTheme(value); setThemeOpen(false); }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-ui-text hover:bg-ui-bg"
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                    {theme === value && <span className="text-accent-strong">✓</span>}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={logoutPending}
              className="mt-1 flex w-full items-center gap-3 border-t border-ui-border px-2 py-3 text-left text-sm font-semibold text-status-danger-text hover:bg-status-danger-soft"
              onClick={() => {
                setLogoutPending(true);
                logoutAdmin().catch((error) => {
                  setLogoutPending(false);
                  notify({ message: readableError(error), tone: 'danger' });
                });
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {logoutPending ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        )}
      </div>
    </Sidebar>
  );

  return (
    <div className="flex h-dvh min-h-0 bg-ui-bg">
      <div className="hidden lg:block">{sidebar('desktop')}</div>
      {mobileOpen && (
        <div
          ref={mobileDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
          className="fixed inset-0 z-40 flex lg:hidden"
          onKeyDown={(event) => {
            if (event.key !== 'Tab' || !mobileDialogRef.current) return;
            const focusable = Array.from(mobileDialogRef.current.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            const nextIndex = getOverlayFocusWrapIndex({
              currentIndex: focusable.findIndex((element) => element === document.activeElement),
              focusableCount: focusable.length,
              shiftKey: event.shiftKey
            });
            if (nextIndex === null) return;
            event.preventDefault();
            focusable[nextIndex]?.focus({ preventScroll: true });
          }}
        >
          <button type="button" className="absolute inset-0 bg-ui-text/35" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <div className="mobile-drawer relative h-full w-[min(18rem,86vw)]">
            <Button
              ref={mobileCloseRef}
              variant="tertiary"
              size="icon"
              className="mobile-drawer-close absolute z-10"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            {sidebar('mobile')}
          </div>
        </div>
      )}
      <div ref={appContentRef} className="flex min-w-0 flex-1 flex-col">
        <header className="compact-header admin-sidebar flex shrink-0 items-center gap-3 border-b lg:hidden">
          <Button ref={mobileTriggerRef} variant="tertiary" size="icon" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen((current) => !current)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <ShieldCheck className="h-4 w-4 text-[rgb(var(--admin-clay-strong))]" aria-hidden="true" />
          <span className="text-sm font-semibold text-[rgb(var(--admin-clay-strong))]">Platform Admin</span>
        </header>
        <PageShell key={route.name}>{page}</PageShell>
      </div>
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
