export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'REQUEST_FAILED',
    public readonly status = 500
  ) {
    super(message);
  }
}

let csrfToken = '';

export function adminLoginPath(status: number, code: string | undefined, returnTo: string) {
  const encodedReturnTo = encodeURIComponent(returnTo);
  if (status === 401) return `/admin-auth/oidc/login?return_to=${encodedReturnTo}`;
  if (code === 'ADMIN_REAUTH_REQUIRED') {
    return `/admin-auth/oidc/login?reauthenticate=true&return_to=${encodedReturnTo}`;
  }
  return '';
}

async function refreshCsrfToken() {
  const response = await fetch('/admin-console-api/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new AdminApiError('Could not establish a protected admin session.', 'CSRF_UNAVAILABLE', response.status);
  const body = await response.json() as { csrfToken?: string };
  if (!body.csrfToken) throw new AdminApiError('Could not establish a protected admin session.', 'CSRF_UNAVAILABLE', response.status);
  csrfToken = body.csrfToken;
}

export async function adminApi<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const method = options.method || 'GET';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !csrfToken) await refreshCsrfToken();
  const response = await fetch(`/admin-console-api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'x-csrf-token': csrfToken } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try { payload = await response.json() as ApiErrorPayload; } catch { /* non-JSON upstream error */ }
    const loginPath = adminLoginPath(response.status, payload.error?.code, `${location.pathname}${location.search}`);
    if (loginPath) {
      location.assign(loginPath);
      throw new AdminApiError(
        payload.error?.message || 'Administrator sign-in is required.',
        payload.error?.code || 'ADMIN_REAUTH_REQUIRED',
        response.status
      );
    }
    throw new AdminApiError(
      payload.error?.message || `The governance service returned ${response.status}.`,
      payload.error?.code,
      response.status
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function logoutAdmin() {
  if (!csrfToken) await refreshCsrfToken();
  await fetch('/admin-auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken }
  });
  location.assign('/');
}

export function readableError(error: unknown) {
  if (error instanceof AdminApiError && error.code === 'LAST_OWNER') {
    return 'Workspace must keep at least one owner';
  }
  return error instanceof Error ? error.message : 'The governance service did not return a usable response.';
}

export async function loadAllPages<T>(path: string, limit = 100): Promise<T[]> {
  const items: T[] = [];
  let cursor = '';
  do {
    const separator = path.includes('?') ? '&' : '?';
    const page = await adminApi<{ items: T[]; nextCursor?: string }>(
      `${path}${separator}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    );
    items.push(...(page.items || []));
    cursor = page.nextCursor || '';
  } while (cursor);
  return items;
}
