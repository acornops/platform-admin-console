import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRoute } from './lib';

export const ADMIN_NAVIGATION_EVENT = 'admin-console:navigation';
export type AdminNavigationRequest = CustomEvent<{ proceed: () => void }>;
const indexKey = 'adminConsoleHistoryIndex';

// Only app-owned same-document entries are indexed. Full document exits use
// beforeunload, so null-state entry/reload never assumes a previous app entry.
export function useAdminNavigation(onNavigated: (next: ReturnType<typeof resolveRoute>, previous: ReturnType<typeof resolveRoute>) => void) {
  const [route, setRoute] = useState(() => resolveRoute(location.pathname));
  const currentRoute = useRef(route);
  const index = useRef<number>(history.state?.[indexKey] ?? 0);
  const restoring = useRef(false);
  const allowTraversal = useRef(false);
  const navigated = useRef(onNavigated);
  navigated.current = onNavigated;
  const commitRoute = useCallback(() => {
    const next = resolveRoute(location.pathname);
    const previous = currentRoute.current;
    currentRoute.current = next;
    setRoute(next);
    navigated.current(next, previous);
  }, []);
  const navigate = useCallback((path: string, options: { replace?: boolean; forced?: boolean } = {}) => {
    const proceed = () => {
      if (options.replace) history.replaceState({ ...history.state, [indexKey]: index.current }, '', path);
      else if (`${location.pathname}${location.search}` !== path) {
        index.current += 1;
        history.pushState({ ...history.state, [indexKey]: index.current }, '', path);
      }
      commitRoute();
    };
    if (options.forced || dispatchEvent(new CustomEvent(ADMIN_NAVIGATION_EVENT, { cancelable: true, detail: { proceed } }))) proceed();
  }, [commitRoute]);
  useEffect(() => {
    history.replaceState({ ...history.state, [indexKey]: index.current }, '');
    const pop = () => {
      if (restoring.current) { restoring.current = false; return; }
      const nextIndex = history.state?.[indexKey];
      if (allowTraversal.current || !Number.isInteger(nextIndex)) {
        allowTraversal.current = false;
        index.current = Number.isInteger(nextIndex) ? nextIndex : 0;
        commitRoute();
        return;
      }
      const delta = index.current - nextIndex;
      const proceed = () => { allowTraversal.current = true; history.go(-delta); };
      if (delta && !dispatchEvent(new CustomEvent(ADMIN_NAVIGATION_EVENT, { cancelable: true, detail: { proceed } }))) {
        restoring.current = true;
        history.go(delta);
      } else { index.current = nextIndex; commitRoute(); }
    };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, [commitRoute]);
  return { route, navigate };
}
