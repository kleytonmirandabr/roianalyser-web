/** Admin → Contatos (master only) — formulário rico (FK empresa + email + telefone). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import {
  useContacts, useCreateContact, useDeleteContact, useUpdateContact,
} from '@/features/contacts/hooks/use-contacts'
import type { Contact } from '@/features/contacts/types'
import { useCompanies } from '@/features/companies/hooks/use-companies'
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
import { isValidEmail } from '@/shared/lib/phone-mask'
import { slugify } from '@/shared/lib/slugify'
import { PhoneInput } from '@/shared/ui/phone-input'
import { AuditInfoFooter } from '@/shared/ui/audit-info-footer'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { CsvExportButton } from '@/shared/ui/csv-export-button'
interface Draft {
  id?: string; key: string; name: string
  role: string; email: string; phone: string
  companyId: string; linkedin: string; notes: string
  displayOrder: number; active: boolean
}
const EMPTY: Draft = {
  key: '', name: '', role: '', email: '', phone: '',
  companyId: '', linkedin: '', notes: '',
  displayOrder: 0, active: true,
}
function asStr(v: unknown): string { return v == null ? '' : String(v) }

export function AdminContactsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useContacts()
  const { data: companies = [] } = useCompanies()
  const create = useCreateContact()
  const update = useUpdateContact(draft.id)
  const del = useDeleteContact()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = (data ?? []) as Contact[]
  const columns = useMemo<DataTableColumn<Contact>[]>(() => [
    { key: 'name', label: 'Nome', getValue: (r: any) => r.name },
    { key: 'role', label: 'Cargo', getValue: (r: any) => r.role ?? "" },
    { key: 'companyId', label: 'Empresa', getValue: (r: any) => r.companyId ? (companyById.get(String(r.companyId)) ?? "") : "" },
    { key: 'email', label: 'E-mail', getValue: (r: any) => r.email ?? "" },
    { key: 'phone', label: 'Telefone', getValue: (r: any) => r.phone ?? "" },
  ], [])
  const dt = useDataTable(items, columns)
  const companyById = new Map(companies.map(c => [c.id, c.name]))

  function openCreate() { setDraft(EMPTY); setOpen(true) }
  function openEdit(c: Contact) {
    const o = c as unknown as Record<string, unknown>
    setDraft({
      id: String(o.id), key: String(o.key), name: String(o.name),
      role: asStr(o.role), email: asStr(o.email), phone: asStr(o.phone),
      companyId: asStr(o.companyId), linkedin: asStr(o.linkedin), notes: asStr(o.notes),
      displayOrder: Number(o.displayOrder ?? 0), active: o.active !== false,
    })
    setOpen(true)
  }
  async function handleDelete(c: Contact) {
    const ok = await confirm({ title: `Excluir contato "${c.name}"?`, destructive: true })
    if (!ok) return
    try { await del.mutateAsync(c.id); toastDeleted('Contato removido') } catch (e) { toastError(e) }
  }
  async function handleSave() {
    if (draft.email && !isValidEmail(draft.email)) return toastError(new Error('E-mail inválido'))
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
        const payload = {
      role: draft.role.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      companyId: draft.companyId || null,
      linkedin: draft.linkedin.trim() || null,
      notes: draft.notes.trim() || null,
      displayOrder: draft.displayOrder, active: draft.active,
    }
    try {
      if (draft.id) await update.mutateAsync({ name: draft.name.trim(), ...payload })
      else await create.mutateAsync({ key: (draft.key.trim() || slugify(draft.name)), name: draft.name.trim(), ...payload })
      toastSaved('Contato salvo'); setOpen(false)
    } catch (e) { toastError(e) }
  }

  const companyOptions = [
    { value: '', label: '— sem empresa —' },
    ...companies.filter(c => c.active).map(c => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.adminContacts')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.contacts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="contatos"
            rows={(dt.rows as any[])}
            columns={[
              { key: 'id', label: 'ID', getValue: (r) => (r as any).id },
              { key: 'name', label: 'Nome', getValue: (r) => (r as any).name },
              { key: 'role', label: 'Cargo', getValue: (r) => (r as any).role ?? "" },
              { key: 'email', label: 'Email', getValue: (r) => (r as any).email ?? "" },
              { key: 'phone', label: 'Telefone', getValue: (r) => (r as any).phone ?? "" },
              { key: 'companyName', label: 'Empresa', getValue: (r) => (r as any).companyName ?? "" },
              { key: 'active', label: 'Ativo', getValue: (r) => (r as any).active !== false },
              { key: 'createdAt', label: 'Criado em', getValue: (r) => (r as any).createdAt },
              { key: 'updatedAt', label: 'Atualizado em', getValue: (r) => (r as any).updatedAt },
            ]}
          />
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {t('admin.contacts.newButton')}</Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t('common.empty.contact')}</div>
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
                      <TableCell className="text-xs">{asStr(o.role) || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{o.companyId ? (companyById.get(String(o.companyId)) || '—') : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{asStr(o.email) || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{asStr(o.phone) || <span className="text-muted-foreground">—</span>}</TableCell>
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
        <SheetContent className="sm:max-w-xl">
          <SheetHeader><SheetTitle>{draft.id ? t('admin.contacts.titleEdit') : t('admin.contacts.titleNew')}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label><span>{t('common.fields.name')} *</span></Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.role')}</Label>
                <Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Diretor Comercial" />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.company')}</Label>
                <Combobox options={companyOptions} value={draft.companyId} onChange={(v) => setDraft({ ...draft, companyId: v })} />
              </div>
              <div className="space-y-1"><Label>E-mail</Label>
                <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>{t('common.fields.phone')}</Label>
                <PhoneInput value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
              </div>
              <div className="space-y-1 col-span-2"><Label>{t('common.fields.linkedin')}</Label>
                <Input value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-1 col-span-2"><Label>{t('common.fields.notes')}</Label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
                  value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
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
