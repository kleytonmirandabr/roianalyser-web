/**
 * Drawer Visão 360 da Oportunidade — read-only.
 *
 * Aberto ao clicar no nome da opp no Kanban ou Lista. Mostra tudo o que
 * o usuário precisa saber pra decidir uma ação, SEM permitir edição.
 */
import {
  Mail, Phone, MessageCircle, ExternalLink, Building2, UserCheck, Wallet,
  History, Newspaper, Linkedin, Globe, Pencil, ArrowUpRight, Plus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppState } from '@/features/admin/hooks/use-app-state'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useContacts } from '@/features/contacts/hooks/use-contacts'
import { useOpportunities } from '@/features/opportunities/hooks/use-opportunities'
import { useOpportunityStatuses } from '@/features/opportunity-statuses/hooks/use-opportunity-statuses'
import type { Opportunity } from '@/features/opportunities/types'
import { Button } from '@/shared/ui/button'
import { formatCurrencyShort, formatDateTime, formatDate } from '@/shared/lib/format'
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/shared/ui/sheet'
import { TaskFormSheet } from '@/features/tasks/components/task-form-sheet'
import { useUserTimezone } from '@/shared/lib/use-user-timezone'

interface Props {
  open: boolean
  onClose: () => void
  opportunity: Opportunity | null
  onEdit?: (opp: Opportunity) => void
}

function Section({ icon: Icon, title, children, action }: {
  icon: any; title: string; children: any; action?: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between border-b pb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-sm">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
  )
}

export function OpportunityViewSheet({ open, onClose, opportunity, onEdit }: Props) {
  const tz = useUserTimezone()
  const [taskOpen, setTaskOpen] = useState(false)
  const { data: companies = [] } = useCompanies()
  const { data: contacts = [] } = useContacts()
  const { data: opps = [] } = useOpportunities()
  const { data: statuses = [] } = useOpportunityStatuses()
  const appState = useAppState()
  const tenantUsers = (appState.data?.users ?? []) as Array<{ id?: string; name?: string; email?: string }>

  const company = useMemo(() => {
    if (!opportunity?.companyId) return null
    return (companies as any[]).find(c => String(c.id) === String(opportunity.companyId))
  }, [companies, opportunity])

  const contact = useMemo(() => {
    if (!opportunity?.contactId) return null
    return (contacts as any[]).find(c => String(c.id) === String(opportunity.contactId))
  }, [contacts, opportunity])

  const status = useMemo(() => {
    if (!opportunity?.statusId) return null
    return statuses.find(s => String(s.id) === String(opportunity.statusId))
  }, [statuses, opportunity])

  const responsibleName = useMemo(() => {
    if (!opportunity?.responsibleId) return '—'
    const u = tenantUsers.find(x => String(x.id) === String(opportunity.responsibleId))
    return u?.name || u?.email || '—'
  }, [tenantUsers, opportunity])

  const createdByName = useMemo(() => {
    if (!opportunity?.createdBy) return '—'
    const u = tenantUsers.find(x => String(x.id) === String(opportunity.createdBy))
    return u?.name || u?.email || '—'
  }, [tenantUsers, opportunity])

  const otherOppsOfCompany = useMemo(() => {
    if (!opportunity || !company) return []
    return opps.filter(o =>
      String(o.companyId) === String(company.id) &&
      String(o.id) !== String(opportunity.id) &&
      !o.deletedAt
    ).slice(0, 5)
  }, [opps, company, opportunity])

  const aggregateOfCompany = useMemo(() => {
    if (!opportunity || !company) return { won: 0, lost: 0, open: 0 }
    const all = opps.filter(o => String(o.companyId) === String(company.id) && !o.deletedAt)
    const statusById = new Map(statuses.map(s => [String(s.id), s]))
    let won = 0, lost = 0, open = 0
    for (const o of all) {
      const cat = o.statusId ? statusById.get(String(o.statusId))?.category : null
      if ((cat as string) === 'gain' || (cat as string) === 'won') won++
      else if ((cat as string) === 'loss' || (cat as string) === 'lost') lost++
      else open++
    }
    return { won, lost, open }
  }, [opps, company, opportunity, statuses])

  if (!opportunity) return null

  const q = encodeURIComponent(company?.name || '')
  const newsLinks = company ? [
    { label: 'Google News', href: `https://news.google.com/search?q=${q}`, icon: Newspaper },
    { label: 'LinkedIn',    href: `https://www.linkedin.com/search/results/companies/?keywords=${q}`, icon: Linkedin },
    { label: 'Bing News',   href: `https://www.bing.com/news/search?q=${q}`, icon: Globe },
  ] : []

  const contactPhone = contact?.phone ? String(contact.phone).replace(/\D/g, '') : ''
  const phoneLink = contactPhone ? `tel:+${contactPhone}` : null
  const whatsappLink = contactPhone ? `https://wa.me/${contactPhone}` : null
  const emailLink = contact?.email ? `mailto:${contact.email}` : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{opportunity.name}</span>
            {status?.name && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: (status.color || '#6b7280') + '22', color: status.color || '#6b7280' }}
              >
                {status.name}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-5">
          <Section icon={Wallet} title="Pipeline">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor estimado">
                <span className="text-base font-semibold tabular-nums">
                  {opportunity.estimatedValue != null
                    ? formatCurrencyShort(opportunity.estimatedValue, opportunity.currency)
                    : '—'}
                </span>
              </Field>
              <Field label="Probabilidade">
                {opportunity.probability != null ? `${opportunity.probability}%` : '—'}
              </Field>
              <Field label="Fechamento previsto">
                {opportunity.expectedCloseDate ? formatDate(opportunity.expectedCloseDate) : '—'}
              </Field>
              <Field label="Tempo de contrato">
                {opportunity.contractDurationMonths != null
                  ? `${opportunity.contractDurationMonths} ${opportunity.contractDurationMonths === 1 ? 'mês' : 'meses'}`
                  : '—'}
              </Field>
            </div>
            {opportunity.description && (
              <div className="pt-2 border-t border-dashed">
                <Field label="Descrição">
                  <p className="whitespace-pre-wrap text-sm">{opportunity.description}</p>
                </Field>
              </div>
            )}
          </Section>

          <Section icon={Building2} title="Empresa">
            {company ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome">{company.name}</Field>
                  <Field label="Setor">{(company as any).sectorName || (company as any).sector || '—'}</Field>
                  <Field label="CNPJ">{(company as any).cnpj || '—'}</Field>
                  <Field label="Cidade/UF">
                    {((company as any).city || (company as any).state)
                      ? `${(company as any).city || ''}${(company as any).state ? '/' + (company as any).state : ''}`
                      : '—'}
                  </Field>
                </div>

                <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">Buscar notícias da empresa</div>
                  <div className="flex flex-wrap gap-1.5">
                    {newsLinks.map(n => {
                      const Icon = n.icon
                      return (
                        <a
                          key={n.label}
                          href={n.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-muted/50 transition-colors"
                        >
                          <Icon className="h-3 w-3" />
                          {n.label}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-md border p-2.5 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">Histórico no CRM</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-emerald-50 dark:bg-emerald-950/20 p-2">
                      <div className="text-xs text-muted-foreground">Ganhas</div>
                      <div className="text-lg font-bold text-emerald-600">{aggregateOfCompany.won}</div>
                    </div>
                    <div className="rounded bg-amber-50 dark:bg-amber-950/20 p-2">
                      <div className="text-xs text-muted-foreground">Em aberto</div>
                      <div className="text-lg font-bold text-amber-600">{aggregateOfCompany.open}</div>
                    </div>
                    <div className="rounded bg-red-50 dark:bg-red-950/20 p-2">
                      <div className="text-xs text-muted-foreground">Perdidas</div>
                      <div className="text-lg font-bold text-red-600">{aggregateOfCompany.lost}</div>
                    </div>
                  </div>
                  {otherOppsOfCompany.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-dashed">
                      <div className="text-xs text-muted-foreground">Outras oportunidades:</div>
                      {otherOppsOfCompany.map(o => (
                        <Link
                          key={o.id}
                          to={`/opportunities/${o.id}`}
                          className="flex items-center justify-between text-xs hover:bg-muted/50 rounded px-1.5 py-0.5"
                          onClick={onClose}
                        >
                          <span className="truncate">{o.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {o.estimatedValue != null ? formatCurrencyShort(o.estimatedValue, o.currency) : '—'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem empresa associada.</p>
            )}
          </Section>

          <Section icon={UserCheck} title="Contato">
            {contact ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome">{contact.name}</Field>
                  <Field label="Cargo">{(contact as any).role || '—'}</Field>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {emailLink && (
                    <a href={emailLink} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors">
                      <Mail className="h-3.5 w-3.5" /> {contact.email}
                    </a>
                  )}
                  {phoneLink && (
                    <a href={phoneLink} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors">
                      <Phone className="h-3.5 w-3.5" /> {contact.phone}
                    </a>
                  )}
                  {whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem contato associado.</p>
            )}
          </Section>

          <Section icon={UserCheck} title="Responsável">
            <div className="text-sm">{responsibleName}</div>
          </Section>

          <Section icon={History} title="Auditoria">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Criada em">{formatDateTime(opportunity.createdAt, tz)}</Field>
              <Field label="Atualizada em">{formatDateTime(opportunity.updatedAt, tz)}</Field>
              <Field label="Criada por">{createdByName}</Field>
            </div>
          </Section>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" type="button" onClick={onClose}>Fechar</Button>
          <Button variant="outline" type="button" onClick={() => setTaskOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Tarefa
          </Button>
          <Button asChild variant="outline">
            <Link to={`/opportunities/${opportunity.id}`} onClick={onClose}>
              <ArrowUpRight className="h-4 w-4 mr-1" /> Abrir página
            </Link>
          </Button>
          {onEdit && (
            <Button type="button" onClick={() => onEdit(opportunity)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
      <TaskFormSheet
        open={taskOpen}
        entityType="opportunity"
        entityId={String(opportunity.id)}
        lockEntity
        onClose={() => setTaskOpen(false)}
      />
    </Sheet>
  )
}
