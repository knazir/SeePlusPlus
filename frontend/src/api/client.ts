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
