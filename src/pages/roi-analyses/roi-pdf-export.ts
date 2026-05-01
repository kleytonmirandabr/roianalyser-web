/**
 * Exportação de ROI Analysis pra PDF.
 *
 * Gera relatório profissional via jsPDF (não usa window.print): capa + KPIs +
 * lançamentos + tabela mês×categoria. Charts viram imagem por html2canvas
 * (mas sem dependência — usa SVG inline diretamente, convertido pra dataURL).
 *
 * Páginas: A4 portrait — capa, sumário executivo, lançamentos, tabela mensal.
 */
import jsPDF from 'jspdf'
import autoTableModule from 'jspdf-autotable'
// Vite/esbuild interop: jspdf-autotable é CJS com module.exports.default,
// então o default-import pode chegar como { default: fn } em vez da função.
// Resolve isso em runtime sem assumir uma das formas.
const autoTable = (autoTableModule as unknown as { default?: typeof autoTableModule }).default
  ?? autoTableModule

import {
  familyOf, suffixOf,
  type RoiAnalysis, type RoiEntry, type RoiMetrics,
} from '@/features/roi-analyses/types'
import { formatCurrency, formatPercent } from '@/shared/lib/format'

interface ExportInput {
  roi: RoiAnalysis
  metrics: RoiMetrics
  entries: RoiEntry[]
  categoryById: Map<string, string>
  itemsById: Map<string, { name?: string; code?: string }>
  tenantName: string
  tenantLogoDataUrl: string | null
}

const COLORS = {
  primary: [99, 102, 241] as [number, number, number],          // indigo-500
  emerald: [16, 185, 129] as [number, number, number],
  rose:    [244, 63, 94] as [number, number, number],
  blue:    [59, 130, 246] as [number, number, number],
  textDark: [30, 30, 35] as [number, number, number],
  textMuted: [115, 115, 130] as [number, number, number],
  border: [220, 220, 226] as [number, number, number],
  bgSubtle: [248, 248, 250] as [number, number, number],
}

const A4 = { w: 210, h: 297 }   // mm portrait
const M = 14                     // margem mm

function fmtCurrency(v: number, currency: string): string {
  return formatCurrency(v, currency)
}

function fmtIrr(irr: number | null): string {
  if (irr == null) return '—'
  if (irr > 1) return '>100% a.a.'
  return formatPercent(irr * 100, 2)
}

/** Header padrão de cada página com logo + nome da análise + paginação. */
function drawPageHeader(doc: jsPDF, opts: ExportInput, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth()
  // Logo do tenant (se existe e couber)
  if (opts.tenantLogoDataUrl) {
    try {
      // logoDataUrl pode ser SVG (data:image/svg+xml;base64,) ou PNG
      const fmt = opts.tenantLogoDataUrl.startsWith('data:image/png') ? 'PNG' :
                  opts.tenantLogoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' :
                  null
      if (fmt) {
        doc.addImage(opts.tenantLogoDataUrl, fmt, M, 8, 28, 10, undefined, 'FAST')
      }
    } catch (_) { /* ignore — logo opcional */ }
  }
  // Nome do tenant à esquerda
  doc.setFontSize(9).setTextColor(...COLORS.textMuted)
  doc.text(opts.tenantName, M + 32, 14)
  // Nome da análise + versão à direita
  doc.setFontSize(9).setTextColor(...COLORS.textDark)
  const right = `${opts.roi.name} · v${opts.roi.version} · ${opts.roi.currency}`
  doc.text(right, pageW - M, 14, { align: 'right' })
  // Linha fina abaixo
  doc.setDrawColor(...COLORS.border).setLineWidth(0.2).line(M, 19, pageW - M, 19)
  // Footer paginação
  doc.setFontSize(8).setTextColor(...COLORS.textMuted)
  doc.text(`${pageNum} / ${totalPages}`, pageW - M, A4.h - 8, { align: 'right' })
  doc.text(`Gerado ${new Date().toLocaleDateString('pt-BR')}`, M, A4.h - 8)
}

/** Página 1 — capa com título grande + 4 KPIs principais + status. */
function drawCover(doc: jsPDF, opts: ExportInput) {
  const { roi, metrics } = opts
  const cur = roi.currency

  // Título
  doc.setFontSize(22).setTextColor(...COLORS.textDark).setFont('helvetica', 'bold')
  doc.text('Análise de Retorno', M, 50)
  doc.setFontSize(14).setFont('helvetica', 'normal').setTextColor(...COLORS.textMuted)
  doc.text(roi.name, M, 60)

  // Card-like KPIs em grid 2×2
  const kpis: Array<{ label: string; value: string; tone: keyof typeof COLORS }> = [
    { label: 'Receita Total',     value: fmtCurrency(metrics.totalRevenue, cur),     tone: 'emerald' },
    { label: 'Custo Total',       value: fmtCurrency(metrics.totalCost, cur),         tone: 'rose'    },
    { label: 'Investimento',      value: fmtCurrency(metrics.totalInvestment, cur),   tone: 'blue'    },
    { label: 'Resultado',         value: fmtCurrency(metrics.netValue, cur),
      tone: metrics.netValue >= 0 ? 'emerald' : 'rose' },
  ]
  const cardW = (A4.w - 2 * M - 6) / 2
  const cardH = 22
  let y = 80
  kpis.forEach((k, i) => {
    const x = M + (i % 2) * (cardW + 6)
    const yy = y + Math.floor(i / 2) * (cardH + 5)
    doc.setDrawColor(...COLORS.border).setLineWidth(0.3)
    doc.roundedRect(x, yy, cardW, cardH, 1.5, 1.5, 'S')
    doc.setFontSize(8).setTextColor(...COLORS.textMuted).setFont('helvetica', 'bold')
    doc.text(k.label.toUpperCase(), x + 4, yy + 6)
    doc.setFontSize(15).setTextColor(...COLORS[k.tone]).setFont('helvetica', 'bold')
    doc.text(k.value, x + 4, yy + 16)
  })

  // Bloco "Indicadores"
  y = 140
  doc.setFontSize(11).setTextColor(...COLORS.textDark).setFont('helvetica', 'bold')
  doc.text('Indicadores principais', M, y)
  y += 6

  const ind: Array<[string, string]> = [
    ['Receita mensal recorrente', fmtCurrency(metrics.monthlyRevenueTotal, cur)],
    ['NPV (Valor Presente Líquido)', fmtCurrency(metrics.npv, cur)],
    ['TIR a.a.', fmtIrr(metrics.irr)],
    ['Payback', metrics.paybackMonths != null ? `${metrics.paybackMonths} meses` : '—'],
    ['Margem',
      metrics.totalRevenue > 0
        ? `${((metrics.netValue / metrics.totalRevenue) * 100).toFixed(2)}%`
        : '—'],
    ['Duração do contrato', `${roi.durationMonths || 12} meses`],
  ]
  doc.setFontSize(10).setFont('helvetica', 'normal')
  ind.forEach(([k, v], i) => {
    const yy = y + i * 7
    doc.setTextColor(...COLORS.textMuted)
    doc.text(k, M + 2, yy)
    doc.setTextColor(...COLORS.textDark).setFont('helvetica', 'bold')
    doc.text(v, A4.w - M - 2, yy, { align: 'right' })
    doc.setFont('helvetica', 'normal')
  })

  // Receita Bruto vs Líquido (se houver desconto)
  if (metrics.discountStats.discountAmount > 0) {
    y = y + ind.length * 7 + 8
    doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(...COLORS.textDark)
    doc.text('Receita: bruto vs. líquido', M, y)
    y += 6
    doc.setFontSize(10).setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMuted)
    doc.text('Bruto', M + 2, y);  doc.setTextColor(...COLORS.textDark).text(fmtCurrency(metrics.discountStats.grossRevenue, cur), A4.w - M - 2, y, { align: 'right' })
    y += 6
    doc.setTextColor(...COLORS.textMuted)
    doc.text('Líquido', M + 2, y); doc.setTextColor(...COLORS.textDark).text(fmtCurrency(metrics.discountStats.netRevenue, cur), A4.w - M - 2, y, { align: 'right' })
    y += 6
    doc.setTextColor(...COLORS.rose)
    doc.text('Desconto concedido', M + 2, y);  doc.text(`−${fmtCurrency(metrics.discountStats.discountAmount, cur)}`, A4.w - M - 2, y, { align: 'right' })
  }

  // Status badge (canto inferior direito)
  doc.setFontSize(8).setTextColor(...COLORS.textMuted)
  doc.text(`Status: ${roi.status}`, A4.w - M, 28, { align: 'right' })
}

/** Página 2+ — Lançamentos agrupados por categoria. */
function drawEntries(doc: jsPDF, opts: ExportInput, addPage: () => void) {
  const { roi, entries, categoryById, itemsById } = opts
  const cur = roi.currency
  const dur = roi.durationMonths || 12

  if (entries.length === 0) return

  addPage()
  doc.setFontSize(14).setTextColor(...COLORS.textDark).setFont('helvetica', 'bold')
  doc.text('Lançamentos', M, 30)
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...COLORS.textMuted)
  doc.text(`${entries.length} item${entries.length > 1 ? 's' : ''} agrupados por categoria`, M, 36)

  // Agrupa
  const groups = new Map<string, { name: string; items: RoiEntry[]; total: number }>()
  for (const e of entries) {
    const catId = e.categoryId || 'none'
    const catName = e.categoryId
      ? (categoryById.get(String(e.categoryId)) || `#${e.categoryId}`)
      : (e.categoryKey || 'Sem categoria')
    const g = groups.get(catId) || { name: catName, items: [], total: 0 }
    g.items.push(e)
    const qty = Number(e.quantity) || 0
    const unit = Number(e.unitValue) || 0
    const disc = Number(e.discountPct) || 0
    const net = qty * unit * (1 - disc / 100)
    const suf = suffixOf(e.comportamento)
    let total = net
    if (suf === 'MONTHLY') total = net * Math.max(0, dur - (Math.max(1, e.startMonth || 1)) + 1)
    g.total += total
    groups.set(String(catId), g)
  }

  let y = 42
  for (const [catId, g] of Array.from(groups.entries()).sort((a, b) => b[1].total - a[1].total)) {
    void catId
    const rows = g.items.map(e => {
      const it = itemsById.get(String(e.catalogItemId)) || {}
      const fam = familyOf(e.comportamento)
      const suf = suffixOf(e.comportamento)
      const qty = Number(e.quantity) || 0
      const unit = Number(e.unitValue) || 0
      const disc = Number(e.discountPct) || 0
      const net = qty * unit * (1 - disc / 100)
      const start = Math.max(1, Number(e.startMonth) || 1)
      let impact = net
      if (suf === 'MONTHLY') impact = net * Math.max(0, dur - start + 1)
      const window =
        suf === 'INSTALLMENT' && e.installments ? `m${start}/${e.installments}`
        : suf === 'MONTHLY' ? `m${start}–m${dur}`
        : `m${start}`
      const sign = fam === 'INCOME' ? '+' : '−'
      return [
        it.name || e.description || '—',
        e.comportamento ? e.comportamento.replace('_', ' ') : '—',
        qty.toLocaleString('pt-BR'),
        fmtCurrency(unit, cur),
        disc > 0 ? `${disc.toFixed(2)}%` : '—',
        window,
        `${sign}${fmtCurrency(impact, cur)}`,
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [[
        { content: g.name, colSpan: 5, styles: { fillColor: COLORS.bgSubtle, textColor: COLORS.textDark, halign: 'left', fontStyle: 'bold' } },
        { content: `${g.items.length} item${g.items.length > 1 ? 's' : ''}`, styles: { fillColor: COLORS.bgSubtle, textColor: COLORS.textMuted, halign: 'right' } },
        { content: fmtCurrency(g.total, cur), styles: { fillColor: COLORS.bgSubtle, textColor: COLORS.textDark, halign: 'right', fontStyle: 'bold' } },
      ], ['Item', 'Comportamento', 'Qtd', 'Valor unit.', 'Desc.', 'Janela', 'Impacto']],
      body: rows,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: COLORS.border, lineWidth: 0.1 },
      headStyles: { fontStyle: 'bold', textColor: COLORS.textMuted, fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 32 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 28 },
      },
      didDrawCell: (data) => {
        // Color da coluna Impacto pelo prefixo
        if (data.section === 'body' && data.column.index === 6) {
          const cell = data.cell.raw as string
          if (cell?.startsWith('+')) {
            doc.setTextColor(...COLORS.emerald)
          } else if (cell?.startsWith('−')) {
            doc.setTextColor(...COLORS.rose)
          }
        }
      },
      margin: { left: M, right: M },
    })
    // @ts-expect-error — autoTable injeta lastAutoTable
    y = (doc.lastAutoTable.finalY ?? y) + 4

    // page-break se passar 80% da altura
    if (y > A4.h - 30) {
      addPage()
      y = 30
    }
  }
}

/** Última página — Tabela mês × categoria + totais. */
function drawMonthlyTable(doc: jsPDF, opts: ExportInput, addPage: () => void) {
  const { roi, entries, categoryById } = opts
  const cur = roi.currency
  const dur = roi.durationMonths || 12

  if (entries.length === 0) return

  addPage()
  doc.setFontSize(14).setTextColor(...COLORS.textDark).setFont('helvetica', 'bold')
  doc.text('Fluxo de caixa por categoria', M, 30)
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...COLORS.textMuted)
  doc.text('Cada coluna é uma categoria. Receitas em verde, custos/investimentos em vermelho.', M, 36)

  // Reconstrói matriz mês × categoria (mesma lógica de monthly-table.tsx)
  type Col = { categoryName: string; perMonth: number[]; total: number; family: string }
  const colMap = new Map<string, Col>()
  for (const e of entries) {
    const catId = e.categoryId || 'none'
    const catName = e.categoryId
      ? (categoryById.get(String(e.categoryId)) || `#${e.categoryId}`)
      : (e.categoryKey || 'Sem categoria')
    const fam = familyOf(e.comportamento) || 'EXPENSE'
    const suf = suffixOf(e.comportamento)
    const qty = Number(e.quantity) || 0
    const unit = Number(e.unitValue) || 0
    const disc = Number(e.discountPct) || 0
    const net = qty * unit * (1 - disc / 100)
    const sign = fam === 'INCOME' ? 1 : -1
    const startIdx = Math.max(0, (Number(e.startMonth) || 1) - 1)
    const col = colMap.get(String(catId)) || {
      categoryName: catName, perMonth: Array.from({ length: dur }, () => 0), total: 0, family: fam,
    }
    if (col.family !== fam) col.family = 'MIXED'
    if (suf === 'ONE_TIME') {
      if (startIdx < dur) col.perMonth[startIdx] += sign * net
    } else if (suf === 'MONTHLY') {
      for (let m = startIdx; m < dur; m++) col.perMonth[m] += sign * net
    } else if (suf === 'INSTALLMENT') {
      const n = Math.max(1, Number(e.installments) || 1)
      const each = net / n
      for (let k = 0; k < n; k++) {
        const m = startIdx + k
        if (m < dur) col.perMonth[m] += sign * each
      }
    }
    col.total = col.perMonth.reduce((a, v) => a + v, 0)
    colMap.set(String(catId), col)
  }
  const order: Record<string, number> = { INCOME: 0, MIXED: 1, EXPENSE: 2, INVESTMENT: 3 }
  const cols = Array.from(colMap.values()).sort((a, b) => (order[a.family] - order[b.family]) || (b.total - a.total))

  // Constrói linhas da tabela
  const totalsPerMonth = Array.from({ length: dur }, (_, i) => cols.reduce((s, c) => s + c.perMonth[i], 0))
  const cumulative: number[] = []
  let acc = 0
  for (const v of totalsPerMonth) { acc += v; cumulative.push(acc) }
  let payback: number | null = null
  let totalOut = 0
  for (let i = 0; i < dur; i++) {
    if (totalsPerMonth[i] < 0) totalOut += -totalsPerMonth[i]
    if (payback === null && cumulative[i] >= 0 && totalOut > 0) payback = i + 1
  }

  const head = ['Mês', ...cols.map(c => c.categoryName), 'Líquido', 'Acumulado']
  const body: any[] = Array.from({ length: dur }, (_, i) => {
    const row: any[] = [
      payback === i + 1
        ? { content: `m${i + 1}`, styles: { fontStyle: 'bold', fillColor: [225, 244, 234] as [number, number, number] } }
        : { content: `m${i + 1}` },
      ...cols.map(c => {
        const v = c.perMonth[i]
        if (v === 0) return { content: '—', styles: { textColor: COLORS.textMuted, halign: 'center' } }
        const tone = v > 0 ? COLORS.emerald : COLORS.rose
        return { content: fmtCurrency(Math.abs(v), cur), styles: { textColor: tone, halign: 'center' } }
      }),
      {
        content: totalsPerMonth[i] === 0 ? '—' : fmtCurrency(totalsPerMonth[i], cur),
        styles: { textColor: totalsPerMonth[i] >= 0 ? COLORS.emerald : COLORS.rose, halign: 'center', fontStyle: 'bold' },
      },
      {
        content: fmtCurrency(cumulative[i], cur),
        styles: { textColor: cumulative[i] >= 0 ? COLORS.emerald : COLORS.rose, halign: 'center', fontStyle: 'bold' },
      },
    ]
    return row
  })

  autoTable(doc, {
    startY: 42,
    head: [head],
    body,
    foot: [[
      { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: COLORS.bgSubtle } },
      ...cols.map(c => ({
        content: c.total === 0 ? '—' : fmtCurrency(Math.abs(c.total), cur),
        styles: { fontStyle: 'bold' as const, fillColor: COLORS.bgSubtle, halign: 'center' as const, textColor: c.total > 0 ? COLORS.emerald : c.total < 0 ? COLORS.rose : COLORS.textDark },
      })),
      { content: fmtCurrency(totalsPerMonth.reduce((a, v) => a + v, 0), cur), styles: { fontStyle: 'bold' as const, fillColor: COLORS.bgSubtle, halign: 'center' as const, textColor: COLORS.textDark } },
      { content: fmtCurrency(cumulative[cumulative.length - 1] || 0, cur), styles: { fontStyle: 'bold' as const, fillColor: COLORS.bgSubtle, halign: 'center' as const, textColor: COLORS.textDark } },
    ]],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: COLORS.border, lineWidth: 0.1 },
    headStyles: { fillColor: COLORS.bgSubtle, textColor: COLORS.textMuted, fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: { 0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' } },
    margin: { left: M, right: M },
  })
}

/** Função pública: gera e baixa o PDF. */
export async function exportRoiToPdf(input: ExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Páginas
  drawCover(doc, input)
  drawEntries(doc, input, () => doc.addPage())
  drawMonthlyTable(doc, input, () => doc.addPage())

  // Header em todas as páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawPageHeader(doc, input, i, totalPages)
  }

  const filename = `roi-${input.roi.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-v${input.roi.version}.pdf`
  doc.save(filename)
}
