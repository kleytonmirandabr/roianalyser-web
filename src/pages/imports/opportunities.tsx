import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { projectsApi } from '@/features/projects/api'
import {
  ImportWizard,
  type ImportField,
} from '@/features/imports/components/import-wizard'

export function ImportOpportunitiesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const fields: ImportField[] = [
    {
      fieldKey: 'name',
      label: t('imports.fields.opportunityName'),
      required: true,
      candidates: ['name', 'nome', 'opportunity', 'oportunidade'],
    },
    {
      fieldKey: 'status',
      label: t('imports.fields.status'),
      candidates: ['status', 'estado', 'fase'],
    },
    {
      fieldKey: 'currency',
      label: t('imports.fields.currency'),
      candidates: ['currency', 'moeda'],
    },
    {
      fieldKey: 'clientName',
      label: t('imports.fields.client'),
      candidates: ['client', 'cliente', 'company', 'empresa'],
    },
    {
      fieldKey: 'description',
      label: t('imports.fields.description'),
      candidates: ['description', 'descricao', 'notes'],
    },
  ]

  async function importRow(row: Record<string, string>) {
    await projectsApi.create({
      name: row.name,
      status: row.status || 'draft',
      currency: row.currency || 'BRL',
      payload: {
        clientName: row.clientName,
        description: row.description,
      },
    })
  }

  return (
    <ImportWizard
      title={t('imports.opportunities.title')}
      subtitle={t('imports.opportunities.subtitle')}
      schema={fields}
      importRow={importRow}
      onComplete={() => {
        qc.invalidateQueries({ queryKey: ['projects', 'list'] })
      }}
    />
  )
}
