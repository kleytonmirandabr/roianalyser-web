/**
 * Tipos espelhando os contratos do backend em
 * `roi-analyzer/backend/src/application/auth/` e `routes/auth-routes.js`.
 *
 * `User` é uma versão sanitizada (sem passwordHash/passwordSalt) — ver
 * `sanitizeUser` em backend/src/domain/app-state/app-state-utils.js.
 */

export type User = {
  id: string
  clientId?: string
  /** Multi-tenant: tenants que esse usuário pode acessar. */
  clientIds?: string[]
  /** Multi-tenant: tenant ativo selecionado (default = clientId). */
  activeClientId?: string
  profileId?: string
  name?: string
  email?: string
  username?: string
  active?: boolean
  isMaster?: boolean
  mfaEnabled?: boolean
  mfaSetupDeadline?: string | null
  defaultLanguage?: 'pt' | 'en' | 'es' | string
  activatedAt?: string | null
  hasPassword?: boolean
  /** Campos adicionais não enumerados aqui são permitidos. */
  [key: string]: unknown
}

/** Item de tenant acessível, retornado em SessionPayload. */
export type AccessibleClient = {
  id: string
  name: string
  logoDataUrl?: string | null
}

export type Profile = {
  id: string
  clientId: string
  name: string
  functionalityIds: string[]
  active: boolean
}

/** Payload de sessão estabelecida (com token). */
export type SessionPayload = {
  token: string
  user: User
  profile: Profile | null
  /** Usuário logou dentro do grace period de MFA (client exige mas user não ativou). */
  mfaGraceWarning?: boolean
  graceDaysLeft?: number
  /** Multi-tenant: lista de clients que o usuário pode acessar. */
  accessibleClients?: AccessibleClient[]
  /** Multi-tenant: clientId atualmente ativo na sessão. */
  activeClientId?: string | null
}

/** Resposta do /api/auth/login quando MFA é requerido (challenge). */
export type LoginMfaChallenge = {
  mfaRequired: true
  mfaToken: string
  mfaMethod: 'totp' | 'email' | string
}

/** Resposta do /api/auth/login quando o user precisa configurar MFA (pós-grace). */
export type LoginMfaSetupRequired = {
  mfaSetupRequired: true
  mfaToken: string
}

/** União de todas as respostas possíveis do /api/auth/login. */
export type LoginResponse =
  | SessionPayload
  | LoginMfaChallenge
  | LoginMfaSetupRequired

/** Resposta do /api/auth/session (sem token — só o payload). */
export type SessionRestoreResponse = {
  user: User
  profile: Profile | null
  /** Multi-tenant: lista de clients que o usuário pode acessar. */
  accessibleClients?: AccessibleClient[]
  /** Multi-tenant: clientId atualmente ativo na sessão. */
  activeClientId?: string | null
}

/** Resposta pública do /api/auth/branding (para tela de login). */
export type BrandingResponse = {
  logoDataUrl: string | null
  systemName: string
  /** Favicon (16/32px PNG/SVG) — aplicado dinamicamente no `<link rel="icon">`. */
  faviconDataUrl?: string | null
}

export type MfaSetupResponse = {
  otpauthUri: string
  qrCodeDataUrl: string
}

export type MfaVerifyResponse =
  | { success: true; recoveryCodes: string[] }
  | (SessionPayload & { recoveryCodes: string[] })

// Type guards
export function isMfaChallenge(r: LoginResponse): r is LoginMfaChallenge {
  return (r as LoginMfaChallenge).mfaRequired === true
}

export function isMfaSetupRequired(
  r: LoginResponse,
): r is LoginMfaSetupRequired {
  return (r as LoginMfaSetupRequired).mfaSetupRequired === true
}

export function isSessionPayload(r: LoginResponse): r is SessionPayload {
  return 'token' in r && typeof r.token === 'string'
}
