import { env } from './env'
import { supabase } from './supabase'

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

const messages: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'This account doesn’t have admin access.',
  404: 'Not found.',
  409: 'Conflicts with existing data (for example the slug or SKU code is already taken, or the item is still in use).',
}

/** Calls the backend admin API with the signed-in user's access token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`${env.apiUrl}/admin${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, messages[res.status] ?? json?.error ?? `Error ${res.status}`, json?.details ?? json?.error)
  }
  return json as T
}

/** Human-readable text for any error, including the backend's zod field errors. */
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : String(error)
  const details = error.details as { formErrors?: string[]; fieldErrors?: Record<string, string[]> } | undefined
  if (error.status === 400 && details?.fieldErrors) {
    const fields = Object.entries(details.fieldErrors).map(([field, errors]) => `${field}: ${errors.join(', ')}`)
    return ['Some fields need fixing:', ...(details.formErrors ?? []), ...fields].join(' ')
  }
  if (error.status === 409 && typeof error.details === 'string') return `${error.message} (${error.details})`
  return error.message
}
