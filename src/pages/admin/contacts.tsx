/** Admin → Contatos (master only) — formulário rico (FK empresa + email + telefone). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

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
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useContacts()
  const { data: companies = [] } = useCompanies()
  const create = useCreateContact()
  const update = useUpdateContact(draft.id)
  const del = useDeleteContact()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = ((data ?? []) as Contact[]).slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
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
    if (!draft.name.trim()) return toastError(new Error('Informe o nome'))
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave'))
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
      else await create.mutateAsync({ key: draft.key.trim(), name: draft.name.trim(), ...payload })
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
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-sm text-muted-foreground">Pessoas vinculadas a empresas — comercial, técnico, etc.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo contato</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum contato cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Cargo</th>
                <th className="px-4 py-2">Empresa</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Telefone</th>
                <th className="px-4 py-2 w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const o = c as unknown as Record<string, unknown>
                return (
                  <tr key={String(o.id)} className="border-t">
                    <td className="px-4 py-2 font-medium">{String(o.name)}</td>
                    <td className="px-4 py-2 text-xs">{asStr(o.role) || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-xs">{o.companyId ? (companyById.get(String(o.companyId)) || '—') : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-xs">{asStr(o.email) || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-xs">{asStr(o.phone) || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader><SheetTitle>{draft.id ? 'Editar contato' : 'Novo contato'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label>Nome *</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              {!draft.id && (
                <div className="space-y-1 col-span-2"><Label>Chave (snake_case) *</Label>
                  <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} />
                </div>
              )}
              <div className="space-y-1"><Label>Cargo</Label>
                <Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Diretor Comercial" />
              </div>
              <div className="space-y-1"><Label>Empresa</Label>
                <Combobox options={companyOptions} value={draft.companyId} onChange={(v) => setDraft({ ...draft, companyId: v })} />
              </div>
              <div className="space-y-1"><Label>E-mail</Label>
                <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Telefone</Label>
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="(11) 99999-0000" />
              </div>
              <div className="space-y-1 col-span-2"><Label>LinkedIn</Label>
                <Input value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-1 col-span-2"><Label>Observações</Label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
                  value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
              <div className="space-y-1"><Label>Ordem</Label>
                <Input type="number" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Checkbox checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c === true })} />
                <Label>Ativo</Label>
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
