const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { error?: string; details?: unknown };
  if (!response.ok) throw new ApiError(body.error ?? "Something went wrong", response.status, body.details);
  return body as T;
}

export const authUrl = `${API_URL}/api/v1/auth/google`;
export const slackConnectUrl = `${API_URL}/api/v1/integrations/slack/connect`;
