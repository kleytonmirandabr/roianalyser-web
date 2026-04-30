/** Admin → Empresas (master only) — formulário rico (cnpj, setor, endereço, redes). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useCompanies, useCreateCompany, useDeleteCompany, useUpdateCompany,
} from '@/features/companies/hooks/use-companies'
import type { Company } from '@/features/companies/types'
import { useSectors } from '@/features/sectors/hooks/use-sectors'
import { confirm } from '@/shared/ui/confirm-dialog'
import { toastDeleted, toastError, toastSaved } from '@/shared/lib/toasts'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Combobox } from '@/shared/ui/combobox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  DataTableActiveFilters, DataTableHeaderCell, DataTablePagination,
  useDataTable, type DataTableColumn,
} from '@/shared/ui/data-table'
import { fetchViaCep, normalizeCep } from '@/shared/lib/viacep'
import { slugify } from '@/shared/lib/slugify'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { CsvExportButton } from '@/shared/ui/csv-export-button'
interface Draft {
  id?: string
  key: string; name: string; cnpj: string; sectorId: string
  employeeCount: string
  country: string; state: string; city: string; district: string
  street: string; number: string; complement: string; cep: string
  linkedin: string; instagram: string
  displayOrder: number; active: boolean
}
const EMPTY: Draft = {
  key: '', name: '', cnpj: '', sectorId: '', employeeCount: '',
  country: '', state: '', city: '', district: '',
  street: '', number: '', complement: '', cep: '',
  linkedin: '', instagram: '',
  displayOrder: 0, active: true,
}

function asStr(v: unknown): string { return v == null ? '' : String(v) }

export function AdminCompaniesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useCompanies()
  const { data: sectors = [] } = useSectors()
  const create = useCreateCompany()
  const update = useUpdateCompany(draft.id)
  const del = useDeleteCompany()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = (data ?? []) as Company[]
  const columns = useMemo<DataTableColumn<Company>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'cnpj', label: 'CNPJ', getValue: (r: any) => r.cnpj ?? "" },
    { key: 'sectorId', label: 'Setor', getValue: (r: any) => r.sectorId ? (sectorById.get(String(r.sectorId)) ?? "") : "" },
    { key: 'city', label: 'Cidade/UF', getValue: (r: any) => [r.city, r.state].filter(Boolean).join("/") },
  ], [])
  const dt = useDataTable(items, columns)
  const sectorById = new Map(sectors.map(s => [s.id, s.name]))

  function openCreate() { setDraft(EMPTY); setOpen(true) }

  // ViaCEP autofill: ao sair do campo CEP, busca endereço e preenche
  // rua/bairro/cidade/UF se estiverem vazios. País fica como Brasil.
  async function handleCepBlur() {
    if (!normalizeCep(draft.cep)) return
    const data = await fetchViaCep(draft.cep)
    if (!data) return
    setDraft((d) => ({
      ...d,
      street: data.logradouro || d.street || '',
      district: data.bairro || d.district || '',
      city: data.localidade || d.city || '',
      state: data.uf || d.state || '',
      country: 'Brasil',
      // complement: ViaCEP raramente retorna; mantém o que o user já digitou
      complement: d.complement || data.complemento || '',
    }))
  }
  function openEdit(c: Company) {
    const o = c as unknown as Record<string, unknown>
    setDraft({
      id: String(o.id), key: String(o.key), name: String(o.name),
      cnpj: asStr(o.cnpj), sectorId: asStr(o.sectorId),
      employeeCount: o.employeeCount != null ? String(o.employeeCount) : '',
      country: asStr(o.country), state: asStr(o.state), city: asStr(o.city),
      district: asStr(o.district), street: asStr(o.street), number: asStr(o.number),
      complement: asStr(o.complement), cep: asStr(o.cep),
      linkedin: asStr(o.linkedin), instagram: asStr(o.instagram),
      displayOrder: Number(o.displayOrder ?? 0), active: o.active !== false,
    })
    setOpen(true)
  }
  async function handleDelete(c: Company) {
    const ok = await confirm({ title: `Excluir empresa "${c.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(c.id); toastDeleted('Empresa removida') } catch (e) { toastError(e) }
  }
  async function handleSave() {
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
        const payload = {
      cnpj: draft.cnpj.trim() || null,
      sectorId: draft.sectorId || null,
      employeeCount: draft.employeeCount ? Number(draft.employeeCount) : null,
      country: draft.country.trim() || null,
      state: draft.state.trim() || null,
      city: draft.city.trim() || null,
      district: draft.district.trim() || null,
      street: draft.street.trim() || null,
      number: draft.number.trim() || null,
      complement: draft.complement.trim() || null,
      cep: draft.cep.trim() || null,
      linkedin: draft.linkedin.trim() || null,
      instagram: draft.instagram.trim() || null,
      displayOrder: draft.displayOrder, active: draft.active,
    }
    try {
      if (draft.id) {
        await update.mutateAsync({ name: draft.name.trim(), ...payload })
      } else {
        await create.mutateAsync({ key: (draft.key.trim() || slugify(draft.name)), name: draft.name.trim(), ...payload })
      }
      toastSaved('Empresa salva'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  const sectorOptions = [
    { value: '', label: '— sem setor —' },
    ...sectors.filter(s => s.active).map(s => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminCompanies')}</h1>
          <p className="text-sm text-muted-foreground">Clientes e parceiros — endereço, setor e redes.</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="empresas"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'cnpj', label: 'CNPJ', getValue: (r) => (r as any).cnpj ?? "" },
              { key: 'email', label: 'Email', getValue: (r) => (r as any).email ?? "" },
              { key: 'phone', label: 'Telefone', getValue: (r) => (r as any).phone ?? "" },
              { key: 'city', label: 'Cidade', getValue: (r) => (r as any).city ?? "" },
              { key: 'state', label: 'UF', getValue: (r) => (r as any).state ?? "" },
              { key: 'active', label: 'Ativo', getValue: (r) => (r as any).active !== false },
              { key: 'createdAt', label: 'Criada em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizada em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('admin.companies.newButton')}</Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</div>
        ) : (
          <>
            <DataTableActiveFilters state={dt} columns={columns} />
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <DataTableHeaderCell key={col.key} column={col} state={dt} />
                  ))}
                  <TableHead className="w-32 text-center">{t('common.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dt.paginatedRows.map((c) => {
                  const o = c as unknown as Record<string, unknown>
                  return (
                    <TableRow key={String(o.id)}>
                      <TableCell className="font-medium">{String(o.name)}</TableCell>
                      <TableCell className="text-xs">{asStr(o.cnpj) || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{o.sectorId ? (sectorById.get(String(o.sectorId)) || '—') : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{[asStr(o.city), asStr(o.state)].filter(Boolean).join('/') || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <DataTablePagination state={dt} />
          </>
        )}
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader><SheetTitle>{draft.id ? t('admin.companies.titleEdit') : t('admin.companies.titleNew')}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label><span>{t('common.fields.name')} *</span></Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>CNPJ</Label>
                <Input value={draft.cnpj} onChange={(e) => setDraft({ ...draft, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.sector')}</Label>
                <Combobox options={sectorOptions} value={draft.sectorId} onChange={(v) => setDraft({ ...draft, sectorId: v })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.employees')}</Label>
                <Input type="number" value={draft.employeeCount} onChange={(e) => setDraft({ ...draft, employeeCount: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressCep')}</Label>
                <Input value={draft.cep} onChange={(e) => setDraft({ ...draft, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" />
              </div>
              <div className="space-y-1 col-span-2"><Label>{t('common.fields.addressStreet')}</Label>
                <Input value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressNumber')}</Label>
                <Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressComplement')}</Label>
                <Input value={draft.complement} onChange={(e) => setDraft({ ...draft, complement: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressDistrict')}</Label>
                <Input value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressCity')}</Label>
                <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressUf')}</Label>
                <Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} maxLength={2} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.addressCountry')}</Label>
                <Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.linkedin')}</Label>
                <Input value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })} placeholder="https://linkedin.com/company/..." />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.instagram')}</Label>
                <Input value={draft.instagram} onChange={(e) => setDraft({ ...draft, instagram: e.target.value })} placeholder="@empresa" />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
                <Label>{t('common.fields.active')}</Label>
              </div>
            </div>
            {draft.id && (
              <AuditInfoFooter
                createdAt={(draft as any).createdAt}
                updatedAt={(draft as any).updatedAt}
              />
            )}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> {t('common.actions.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
