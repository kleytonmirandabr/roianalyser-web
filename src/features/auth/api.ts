import { api } from '@/shared/api/client'

import type {
  BrandingResponse,
  LoginResponse,
  MfaSetupResponse,
  MfaVerifyResponse,
  SessionPayload,
  SessionRestoreResponse,
} from './types'

export type LoginInput = {
  login: string
  password: string
}

export type MfaChallengeInput = {
  /** Código TOTP (6 dígitos) OU... */
  code?: string
  /** ... código de recuperação. */
  recoveryCode?: string
  /** Se true, backend seta cookie trustedDevice para pular MFA futuramente. */
  rememberDevice?: boolean
}

export type ResetPasswordInput = {
  token: string
  newPassword: string
}

export type ActivateAccountInput = {
  token: string
  username: string
  newPassword: string
}

export const authApi = {
  /** GET /api/auth/branding — público, para tela de login. */
  branding: () =>
    api.get<BrandingResponse>('/auth/branding', { anonymous: true }),

  /** POST /api/auth/login — pode retornar session, challenge ou setup-required. */
  login: (input: LoginInput) =>
    api.post<LoginResponse>('/auth/login', input, { anonymous: true }),

  /** GET /api/auth/session — restaura sessão via Bearer token. */
  session: () => api.get<SessionRestoreResponse>('/auth/session'),

  /** POST /api/auth/logout — invalida token no servidor. */
  logout: () => api.post<void>('/auth/logout'),

  /** POST /api/auth/forgot-password — solicita e-mail de reset. */
  forgotPassword: (input: { login: string }) =>
    api.post<{ sent?: boolean; emailMode?: string }>(
      '/auth/forgot-password',
      input,
      { anonymous: true },
    ),

  /** POST /api/auth/reset-password — aplica nova senha via token. */
  resetPassword: (input: ResetPasswordInput) =>
    api.post<{ success?: boolean }>('/auth/reset-password', input, {
      anonymous: true,
    }),

  /** POST /api/auth/activate — usuário define username + senha ao ativar conta. */
  activate: (input: ActivateAccountInput) =>
    api.post<{ activated: boolean; userId: string; message?: string }>(
      '/auth/activate',
      input,
      { anonymous: true },
    ),

  /** POST /api/auth/mfa/challenge — consome mfaToken, retorna sessão real. */
  mfaChallenge: (input: MfaChallengeInput, mfaToken: string) =>
    api.post<SessionPayload>('/auth/mfa/challenge', input, {
      anonymous: true,
      headers: { Authorization: `Bearer ${mfaToken}` },
    }),

  /** POST /api/auth/mfa/email-code — envia código por e-mail (alternativa ao TOTP). */
  mfaEmailCode: (mfaToken: string) =>
    api.post<{ sent?: boolean }>('/auth/mfa/email-code', undefined, {
      anonymous: true,
      headers: { Authorization: `Bearer ${mfaToken}` },
    }),

  /** POST /api/auth/mfa/setup — gera QR code e URI para o authenticator. */
  mfaSetup: () => api.post<MfaSetupResponse>('/auth/mfa/setup'),

  /** POST /api/auth/mfa/verify — confirma código e ativa MFA na conta. */
  mfaVerify: (code: string) =>
    api.post<MfaVerifyResponse>('/auth/mfa/verify', { code }),

  /** POST /api/auth/mfa/disable — desliga MFA após validar TOTP atual. */
  mfaDisable: (code: string) =>
    api.post<{ success?: boolean }>('/auth/mfa/disable', { code }),

  /**
   * POST /api/auth/switch-tenant — multi-tenant.
   * Troca o tenant ativo da sessão. Backend valida acesso (clientIds) e
   * persiste em users.active_client_id. Retorna a nova SessionRestoreResponse
   * com accessibleClients e activeClientId atualizados.
   */
  switchTenant: (clientId: string) =>
    api.post<SessionRestoreResponse>('/auth/switch-tenant', { clientId }),
}
