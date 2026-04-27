/**
 * HTTP client autenticado do RoiAnalyser.
 *
 * - Lê o JWT de localStorage (lembrar-me marcado) ou sessionStorage (sessão).
 * - Anexa Authorization: Bearer <token> em todas as requisições.
 * - Em 401, limpa credenciais e dispara evento 'auth:unauthorized'
 *   que o AuthProvider escuta para redirecionar ao login.
 * - A base URL é /api por padrão — o Vite faz proxy para o backend em dev
 *   (VITE_API_PROXY_TARGET) e o Nginx serve a API em produção.
 */

export const TOKEN_STORAGE_KEY = 'roi.auth.token'
export const ACTIVE_TENANT_STORAGE_KEY = 'roi.active.tenant'

export function readToken(): string | null {
  return (
    localStorage.getItem(TOKEN_STORAGE_KEY) ??
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  )
}

export function writeToken(token: string, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_STORAGE_KEY, token)
  // Garantir que só um storage contenha o token ativo.
  const other = remember ? sessionStorage : localStorage
  other.removeItem(TOKEN_STORAGE_KEY)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}

/**
 * Multi-tenant: tenant ativo escolhido pelo usuário (sobrescreve o default
 * vindo do backend). Persistido em localStorage pra sobreviver F5. Quando
 * presente, vai como header X-Active-Tenant em todas as requisições.
 */
export function readActiveTenant(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeActiveTenant(clientId: string | null) {
  try {
    if (clientId) localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, clientId)
    else localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Quando true, não anexa Authorization (ex.: login, refresh). */
  anonymous?: boolean
}

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options

  const finalHeaders = new Headers(headers)
  if (!finalHeaders.has('Accept')) {
    finalHeaders.set('Accept', 'application/json')
  }
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (!anonymous) {
    const token = readToken()
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
    // Multi-tenant: header opcional. Se ausente, backend usa user.activeClientId default.
    const activeTenant = readActiveTenant()
    if (activeTenant && !finalHeaders.has('X-Active-Tenant')) {
      finalHeaders.set('X-Active-Tenant', activeTenant)
    }
  }

  const url = path.startsWith('http')
    ? path
    : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
  })

  const contentType = response.headers.get('Content-Type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    const message =
      (isJson && typeof payload === 'object' && payload !== null
        ? ((payload as { message?: string; error?: string }).message ??
          (payload as { message?: string; error?: string }).error)
        : null) ?? response.statusText
    throw new ApiError(response.status, message, payload)
  }

  return payload as T
}

export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ) => apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
}
