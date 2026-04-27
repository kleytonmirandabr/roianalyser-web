/**
 * Aplica o favicon do tenant (faviconDataUrl) na tag `<link rel="icon">`
 * dinamicamente. Quando branding muda (ex: master atualiza), o favicon
 * troca sem precisar reload.
 *
 * Estratégia: localiza o `<link rel="icon">` existente. Se não houver,
 * cria. Quando faviconDataUrl é null, restaura o default (favicon.svg
 * que vem no build).
 */
import { useEffect } from 'react'

import { useBranding } from './use-branding'

const DEFAULT_FAVICON = '/v2/favicon.svg'

export function useFaviconSync() {
  const branding = useBranding()
  const faviconDataUrl = branding.data?.faviconDataUrl ?? null

  useEffect(() => {
    let link = document.querySelector(
      "link[rel='icon']",
    ) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = faviconDataUrl || DEFAULT_FAVICON
    // Type hint pra alguns browsers — image/* funciona pra data URLs.
    if (faviconDataUrl?.startsWith('data:image/png')) link.type = 'image/png'
    else if (faviconDataUrl?.startsWith('data:image/svg')) link.type = 'image/svg+xml'
    else if (faviconDataUrl?.startsWith('data:image/x-icon')) link.type = 'image/x-icon'
    else link.removeAttribute('type')
  }, [faviconDataUrl])

  // Atualiza document.title também — usa systemName quando setado.
  const systemName = branding.data?.systemName
  useEffect(() => {
    if (systemName) document.title = systemName
  }, [systemName])
}
