/**
 * Campo de upload de imagem que converte arquivo local em data URL (base64)
 * inline. Persistência fica como string — sem upload pra S3, sem servidor
 * de mídia. Adequado pra logos pequenas (clientes, branding) onde ~50–200KB
 * cabem confortavelmente no JSON do payload.
 *
 * Quando virar comum ter dezenas de imagens grandes (anexos de projeto,
 * fotos de produto), trocar essa abordagem por upload real fica em outra
 * sprint — só esse componente precisa mudar.
 */
import { Image, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'

type ImageUploadFieldProps = {
  /** Data URL ou null. */
  value: string | null | undefined
  onChange: (dataUrl: string | null) => void
  /** Tamanho máximo em KB (default 200). Acima disso mostra erro. */
  maxSizeKb?: number
  /** MIME accept (default image/*). */
  accept?: string
  /** Rótulo opcional pra hint do botão upload. */
  buttonLabel?: string
  disabled?: boolean
  /**
   * Tamanho da preview (px). Default 64. Quando definido, vira quadrado
   * `previewSize × previewSize`. Se você precisa de aspect-ratio diferente
   * (ex: logo retangular do sistema), use `previewWidth` + `previewHeight`.
   */
  previewSize?: number
  /** Largura da preview em px. Sobrescreve `previewSize` se definido. */
  previewWidth?: number
  /** Altura da preview em px. Sobrescreve `previewSize` se definido. */
  previewHeight?: number
}

export function ImageUploadField({
  value,
  onChange,
  maxSizeKb = 200,
  accept = 'image/*',
  buttonLabel,
  disabled,
  previewSize = 64,
  previewWidth,
  previewHeight,
}: ImageUploadFieldProps) {
  const w = previewWidth ?? previewSize
  const h = previewHeight ?? previewSize
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSelect(file: File | null) {
    if (!file) return
    setError(null)
    const sizeKb = Math.ceil(file.size / 1024)
    if (sizeKb > maxSizeKb) {
      setError(t('imageUpload.tooBig', { max: maxSizeKb, actual: sizeKb }))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError(t('imageUpload.readError'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') onChange(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted',
            !value && 'text-muted-foreground',
          )}
          style={{ width: w, height: h }}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Image className="h-6 w-6" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            disabled={disabled}
            onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {buttonLabel ?? t('imageUpload.choose')}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t('imageUpload.remove')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t('imageUpload.hint', { max: maxSizeKb })}
      </p>
      {error && (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
