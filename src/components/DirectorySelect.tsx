import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, FieldLabel, InlineAlert, Select, TextInput } from '@acornops/ui';
import { adminApi, readableError } from '../api';

export interface DirectoryItem { id: string; name?: string; displayName?: string; email?: string; }

export function DirectorySelect({ kind, id, selected, onSelect, excludedIds }: {
  kind: 'users' | 'workspaces'; id: string; selected: DirectoryItem | null;
  onSelect: (item: DirectoryItem | null) => void; excludedIds: string[];
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const nextCursor = useRef('');
  const seenCursors = useRef(new Set<string>());
  const retryAppend = useRef(false);
  const label = kind === 'users' ? 'User' : 'Workspace';
  const available = items.filter(item => !excludedIds.includes(item.id));

  const load = useCallback(async (append = false) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError(''); retryAppend.current = append;
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (query.trim()) params.set('q', query.trim());
      if (append && nextCursor.current) params.set('cursor', nextCursor.current);
      const page = await adminApi<{ items: DirectoryItem[]; nextCursor?: string }>(`/${kind}?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const next = page.nextCursor || '';
      if (next && seenCursors.current.has(next)) throw new Error('The service repeated a page cursor. Please try again.');
      if (next) seenCursors.current.add(next);
      setItems(current => append ? [...current, ...page.items.filter(item => !current.some(known => known.id === item.id))] : page.items);
      nextCursor.current = next; setCursor(next);
    } catch (reason) { if (!controller.signal.aborted) setError(readableError(reason)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [kind, query]);

  useEffect(() => {
    pending.current?.abort();
    onSelect(null); setItems([]); setCursor(''); setLoading(true);
    nextCursor.current = ''; seenCursors.current.clear();
    const timer = window.setTimeout(() => void load(), 240);
    return () => { window.clearTimeout(timer); pending.current?.abort(); };
  }, [load, onSelect]);

  return <div className="space-y-2">
    <label className="block"><span className="sr-only">Search {kind}</span><TextInput value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${kind}`} /></label>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Select id={id} ariaLabel={label} value={selected?.id || ''} onChange={value => onSelect(available.find(item => item.id === value) || null)}
      placeholder={loading && !items.length ? `Loading ${kind}…` : `Select ${label.toLowerCase()}`} disabled={loading && !items.length}
      options={available.map(item => ({ value: item.id, label: kind === 'users' ? item.displayName ? `${item.displayName} (${item.email})` : item.email || item.id : item.name || item.id }))} />
    {error && <InlineAlert tone="danger">{error}<Button disabled={loading} onClick={() => void load(retryAppend.current)}>Retry</Button></InlineAlert>}
    {cursor && <Button disabled={loading} onClick={() => void load(true)}>Load more {kind}</Button>}
  </div>;
}
