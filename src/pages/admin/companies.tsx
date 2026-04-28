/** Admin → Empresas (master only) — formulário rico (cnpj, setor, endereço, redes). */
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

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
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const { data, isLoading } = useCompanies()
  const { data: sectors = [] } = useSectors()
  const create = useCreateCompany()
  const update = useUpdateCompany(draft.id)
  const del = useDeleteCompany()

  if (user && !user.isMaster) return <Navigate to="/admin" replace />

  const items = ((data ?? []) as Company[]).slice().sort((a, b) => {
    const ao = Number((a as unknown as { displayOrder?: number }).displayOrder ?? 0)
    const bo = Number((b as unknown as { displayOrder?: number }).displayOrder ?? 0)
    if (ao !== bo) return ao - bo
    return String(a.name).localeCompare(String(b.name))
  })
  const sectorById = new Map(sectors.map(s => [s.id, s.name]))

  function openCreate() { setDraft(EMPTY); setOpen(true) }
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
    if (!draft.id && !draft.key.trim()) return toastError(new Error('Informe a chave'))
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
        await create.mutateAsync({ key: draft.key.trim(), name: draft.name.trim(), ...payload })
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
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">Clientes e parceiros — endereço, setor e redes.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova empresa</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-5 w-1/2" /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">CNPJ</th>
                <th className="px-4 py-2">Setor</th>
                <th className="px-4 py-2">Cidade/UF</th>
                <th className="px-4 py-2 w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const o = c as unknown as Record<string, unknown>
                return (
                  <tr key={String(o.id)} className="border-t">
                    <td className="px-4 py-2 font-medium">{String(o.name)}</td>
                    <td className="px-4 py-2 text-xs">{asStr(o.cnpj) || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-xs">{o.sectorId ? (sectorById.get(String(o.sectorId)) || '—') : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-xs">{[asStr(o.city), asStr(o.state)].filter(Boolean).join('/') || <span className="text-muted-foreground">—</span>}</td>
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
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader><SheetTitle>{draft.id ? 'Editar empresa' : 'Nova empresa'}</SheetTitle></SheetHeader>
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
              <div className="space-y-1"><Label>CNPJ</Label>
                <Input value={draft.cnpj} onChange={(e) => setDraft({ ...draft, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1"><Label>Setor</Label>
                <Combobox options={sectorOptions} value={draft.sectorId} onChange={(v) => setDraft({ ...draft, sectorId: v })} />
              </div>
              <div className="space-y-1"><Label>Funcionários</Label>
                <Input type="number" value={draft.employeeCount} onChange={(e) => setDraft({ ...draft, employeeCount: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>CEP</Label>
                <Input value={draft.cep} onChange={(e) => setDraft({ ...draft, cep: e.target.value })} placeholder="00000-000" />
              </div>
              <div className="space-y-1 col-span-2"><Label>Rua</Label>
                <Input value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Número</Label>
                <Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Complemento</Label>
                <Input value={draft.complement} onChange={(e) => setDraft({ ...draft, complement: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Bairro</Label>
                <Input value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Cidade</Label>
                <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>UF</Label>
                <Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} maxLength={2} />
              </div>
              <div className="space-y-1"><Label>País</Label>
                <Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>LinkedIn</Label>
                <Input value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })} placeholder="https://linkedin.com/company/..." />
              </div>
              <div className="space-y-1"><Label>Instagram</Label>
                <Input value={draft.instagram} onChange={(e) => setDraft({ ...draft, instagram: e.target.value })} placeholder="@empresa" />
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
