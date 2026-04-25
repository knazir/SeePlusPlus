// Thin fetch wrapper around the backend's POST /api/run. Vite dev proxies
// /api -> localhost:3000; in prod the backend is same-origin.
//
// Response is typed `unknown` for now — we JSON.stringify it into the viz
// debug pane. A real validator lands with the first viz component that
// needs typed access to the trace.

export interface RunResponse {
  [key: string]: unknown;
}

export class RunError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`POST /api/run failed (${status})`);
    this.name = 'RunError';
    this.status = status;
    this.body = body;
  }
}

export async function runCode(code: string, fetchFn: typeof fetch = fetch): Promise<RunResponse> {
  const res = await fetchFn('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new RunError(res.status, body);
  }
  return (await res.json()) as RunResponse;
}

export class WorkspaceError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'WorkspaceError';
    this.status = status;
  }
}

async function ensureOkWorkspace(res: Response, label: string): Promise<Response> {
  if (res.ok) return res;
  const body = await res.text().catch(() => '');
  throw new WorkspaceError(res.status, body || `${label} failed (${res.status})`);
}

export class AdminApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

async function ensureOkAdmin(res: Response, label: string): Promise<Response> {
  if (res.ok) return res;
  const body = await res.text().catch(() => '');
  throw new AdminApiError(res.status, body || `${label} failed (${res.status})`);
}

export interface Workspace {
  slug: string;
  code: string;
  name: string | null;
  ownerMe: boolean;
  hasOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createWorkspace(
  code: string,
  name: string | null = null,
  fetchFn: typeof fetch = fetch,
): Promise<{ slug: string }> {
  const res = await fetchFn('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name }),
    // Send the session cookie so the backend can attribute ownership
    // (owner_id) when the user is signed in.
    credentials: 'include',
  });
  await ensureOkWorkspace(res, 'POST /api/workspaces');
  return (await res.json()) as { slug: string };
}

export async function getWorkspace(
  slug: string,
  fetchFn: typeof fetch = fetch,
): Promise<Workspace> {
  const res = await fetchFn(`/api/workspaces/${encodeURIComponent(slug)}`, {
    credentials: 'include',
  });
  await ensureOkWorkspace(res, `GET /api/workspaces/${slug}`);
  return (await res.json()) as Workspace;
}

export async function updateWorkspace(
  slug: string,
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(`/api/workspaces/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include',
  });
  await ensureOkWorkspace(res, `PUT /api/workspaces/${slug}`);
}

export async function renameWorkspace(
  slug: string,
  name: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(`/api/workspaces/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    credentials: 'include',
  });
  await ensureOkWorkspace(res, `PATCH /api/workspaces/${slug}`);
}

export async function deleteWorkspace(
  slug: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(`/api/workspaces/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await ensureOkWorkspace(res, `DELETE /api/workspaces/${slug}`);
}

// --- auth -----------------------------------------------------------------

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface MeResponse {
  user: Me | null;
  providers: string[];
}

export async function fetchMe(fetchFn: typeof fetch = fetch): Promise<MeResponse> {
  const res = await fetchFn('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    return { user: null, providers: [] };
  }
  return (await res.json()) as MeResponse;
}

// --- flags ----------------------------------------------------------------

export type PublicFlags = Record<string, boolean>;

export interface AdminFlag {
  name: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export async function fetchFlags(fetchFn: typeof fetch = fetch): Promise<PublicFlags> {
  const res = await fetchFn('/api/flags');
  if (!res.ok) return {};
  return (await res.json()) as PublicFlags;
}

export async function fetchAdminFlags(
  fetchFn: typeof fetch = fetch,
): Promise<AdminFlag[]> {
  const res = await fetchFn('/api/admin/flags', { credentials: 'include' });
  await ensureOkAdmin(res, 'GET /api/admin/flags');
  const data = (await res.json()) as { flags: AdminFlag[] };
  return data.flags;
}

export async function setAdminFlag(
  name: string,
  enabled: boolean,
  description: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<AdminFlag> {
  const body: Record<string, unknown> = { enabled };
  if (description !== undefined) body.description = description;
  const res = await fetchFn(`/api/admin/flags/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  await ensureOkAdmin(res, `PUT /api/admin/flags/${name}`);
  const data = (await res.json()) as { flag: AdminFlag };
  return data.flag;
}

export async function deleteAdminFlag(
  name: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(`/api/admin/flags/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await ensureOkAdmin(res, `DELETE /api/admin/flags/${name}`);
}

export async function reloadAdminFlags(
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  await fetchFn('/api/admin/flags/reload', { method: 'POST', credentials: 'include' });
}

export async function logout(fetchFn: typeof fetch = fetch): Promise<void> {
  await fetchFn('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export interface WorkspaceListing {
  slug: string;
  name: string | null;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export async function listMyWorkspaces(
  fetchFn: typeof fetch = fetch,
): Promise<WorkspaceListing[]> {
  const res = await fetchFn('/api/workspaces/mine', { credentials: 'include' });
  await ensureOkWorkspace(res, 'GET /api/workspaces/mine');
  const data = (await res.json()) as { workspaces: WorkspaceListing[] };
  return data.workspaces;
}
