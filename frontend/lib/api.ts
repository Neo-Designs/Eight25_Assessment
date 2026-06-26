export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Server error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: Omit<RequestInit, 'method' | 'body' | 'headers'> & { timeoutMs?: number },
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...options,
  });
}

export function isOfflineError(err: unknown): boolean {
  return err instanceof TypeError && err.message.toLowerCase().includes('fetch');
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (isOfflineError(err)) {
    return 'Cannot reach backend. Is the FastAPI server running?';
  }
  return err instanceof Error ? err.message : fallback;
}
