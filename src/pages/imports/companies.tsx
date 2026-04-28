import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { catalogsApi } from '@/features/catalogs/api'
import {
  ImportWizard,
  type ImportField,
} from '@/features/imports/components/import-wizard'

export function ImportCompaniesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuth()
  // Importação grava no tenant ATIVO. Veja contacts.tsx para a justificativa.
  const clientId = user?.activeClientId ?? user?.clientId ?? ''

  const fields: ImportField[] = [
    {
      fieldKey: 'name',
      label: t('imports.fields.companyName'),
      required: true,
      candidates: ['name', 'nome', 'razao_social', 'company', 'empresa'],
    },
    {
      fieldKey: 'cep',
      label: 'CEP',
      candidates: ['cep', 'zipcode', 'postal_code'],
    },
    {
      fieldKey: 'state',
      label: t('imports.fields.state'),
      candidates: ['state', 'estado', 'uf'],
    },
    {
      fieldKey: 'city',
      label: t('imports.fields.city'),
      candidates: ['city', 'cidade', 'municipio'],
    },
    {
      fieldKey: 'street',
      label: t('imports.fields.street'),
      candidates: ['street', 'rua', 'logradouro', 'address', 'endereco'],
    },
    {
      fieldKey: 'employeeCount',
      label: t('imports.fields.employeeCount'),
      candidates: ['employees', 'funcionarios', 'employee_count', 'headcount'],
    },
    {
      fieldKey: 'linkedin',
      label: 'LinkedIn',
      candidates: ['linkedin'],
    },
  ]

  async function importRow(row: Record<string, string>) {
    const payload: Record<string, unknown> = {
      name: row.name,
      cep: row.cep,
      state: row.state,
      city: row.city,
      street: row.street,
      linkedin: row.linkedin,
    }
    if (row.employeeCount) {
      const n = Number(row.employeeCount)
      if (Number.isFinite(n)) payload.employeeCount = n
    }
    if (!clientId) throw new Error('Sem clientId na sessão')
    await catalogsApi.create(clientId, 'companies', payload)
  }

  return (
    <ImportWizard
      title={t('imports.companies.title')}
      subtitle={t('imports.companies.subtitle')}
      schema={fields}
      importRow={importRow}
      onComplete={() => {
        qc.invalidateQueries({ queryKey: ['catalogs', clientId, 'companies'] })
      }}
    />
  )
}
