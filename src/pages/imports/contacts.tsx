import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { catalogsApi } from '@/features/catalogs/api'
import {
  ImportWizard,
  type ImportField,
} from '@/features/imports/components/import-wizard'

export function ImportContactsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuth()
  const clientId = user?.clientId ?? ''

  const fields: ImportField[] = [
    {
      fieldKey: 'name',
      label: t('imports.fields.contactName'),
      required: true,
      candidates: ['name', 'nome', 'full_name', 'contact'],
    },
    {
      fieldKey: 'email',
      label: 'Email',
      candidates: ['email', 'e-mail', 'mail'],
    },
    {
      fieldKey: 'phone',
      label: t('imports.fields.phone'),
      candidates: ['phone', 'telefone', 'cellphone', 'celular'],
    },
    {
      fieldKey: 'role',
      label: t('imports.fields.role'),
      candidates: ['role', 'cargo', 'position', 'job_title'],
    },
    {
      fieldKey: 'companyName',
      label: t('imports.fields.companyName'),
      candidates: ['company', 'empresa', 'organization', 'organizacao'],
    },
    {
      fieldKey: 'linkedin',
      label: 'LinkedIn',
      candidates: ['linkedin'],
    },
    {
      fieldKey: 'notes',
      label: t('imports.fields.notes'),
      candidates: ['notes', 'observacoes', 'note'],
    },
  ]

  async function importRow(row: Record<string, string>) {
    if (!clientId) throw new Error('Sem clientId na sessão')
    // Resolve companyId pelo nome se possível.
    let companyId: string | undefined
    if (row.companyName) {
      try {
        const list = await catalogsApi.list(clientId, 'companies')
        companyId = list.find(
          (c) =>
            typeof c.name === 'string' &&
            c.name.trim().toLowerCase() === row.companyName.trim().toLowerCase(),
        )?.id
      } catch {
        // segue sem companyId
      }
    }
    await catalogsApi.create(clientId, 'contacts', {
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      companyId,
      linkedin: row.linkedin,
      notes: row.notes,
    })
  }

  return (
    <ImportWizard
      title={t('imports.contacts.title')}
      subtitle={t('imports.contacts.subtitle')}
      schema={fields}
      importRow={importRow}
      onComplete={() => {
        qc.invalidateQueries({ queryKey: ['catalogs', clientId, 'contacts'] })
      }}
    />
  )
}
