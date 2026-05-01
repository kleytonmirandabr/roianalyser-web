/**
 * Exportação ROI → PDF (v2 — design refeito).
 *
 * Filosofia: parecer um relatório executivo de consultoria, não a captura de
 * uma tela web. Cada página tem propósito único, hierarquia visual forte,
 * e densidade adequada ao A4.
 *
 * Páginas:
 *   1. Capa — logo grande, título, projeto, data, KPI cards 2x2 grandes
 *   2. Sumário executivo — indicadores em 2 colunas + receita bruto/líquido
 *   3. Gráfico saldo acumulado — desenhado nativamente no PDF (vetor crisp)
 *   4. Gráfico fluxo mensal — barras agrupadas (receita/custo/investimento)
 *   5. Lançamentos por categoria — tabelas agrupadas com totais
 *   6. Matriz mês × categoria — heatmap colorido + totais por linha/coluna
 *
 * Tudo usa as primitivas do jsPDF (texto, retângulos, paths). Sem captura
 * de DOM, sem html2canvas — fica nítido em qualquer zoom.
 */
import jsPDF from 'jspdf'
import autoTableModule from 'jspdf-autotable'

import {
  familyOf, suffixOf,
  type RoiAnalysis, type RoiEntry, type RoiMetrics,
} from '@/features/roi-analyses/types'
import { formatCurrency, formatPercent } from '@/shared/lib/format'

// Vite/esbuild interop: jspdf-autotable é CJS com module.exports.default,
// então o default-import pode chegar como { default: fn } em vez da função.
const autoTable = (autoTableModule as unknown as { default?: typeof autoTableModule }).default
  ?? autoTableModule

interface ExportInput {
  roi: RoiAnalysis
  metrics: RoiMetrics
  entries: RoiEntry[]
  categoryById: Map<string, string>
  itemsById: Map<string, { name?: string; code?: string }>
  tenantName: string
  tenantLogoDataUrl: string | null
}

// Após resolver SVG→PNG; passado internamente entre etapas do export.
type ResolvedLogo = { data: string; fmt: 'PNG' | 'JPEG' } | null

// ───────────────────────── Design tokens ─────────────────────────
const C = {
  // Marca
  brand:       [79,  70,  229] as [number, number, number],   // indigo-600
  brandSoft:   [238, 242, 255] as [number, number, number],   // indigo-50
  // Sinais
  pos:         [16, 185, 129] as [number, number, number],    // emerald-500
  posDark:     [4, 120,  87]  as [number, number, number],    // emerald-700
  posSoft:     [220, 252, 231] as [number, number, number],   // emerald-100
  neg:         [244,  63,  94] as [number, number, number],   // rose-500
  negDark:     [159,  18,  57] as [number, number, number],   // rose-800
  negSoft:     [254, 226, 226] as [number, number, number],   // rose-100
  inv:         [37,  99, 235] as [number, number, number],    // blue-600
  invSoft:     [219, 234, 254] as [number, number, number],   // blue-100
  // Neutros
  ink:         [17,  24,  39] as [number, number, number],    // gray-900
  body:        [55,  65,  81] as [number, number, number],    // gray-700
  muted:       [107, 114, 128] as [number, number, number],   // gray-500
  hairline:    [229, 231, 235] as [number, number, number],   // gray-200
  surface:     [249, 250, 251] as [number, number, number],   // gray-50
  white:       [255, 255, 255] as [number, number, number],
}

const PAGE = { w: 210, h: 297 }   // A4 portrait, mm
const M    = { left: 16, right: 16, top: 24, bottom: 18 }
const inner = () => PAGE.w - M.left - M.right

// ───────────────────────── Helpers de desenho ─────────────────────────
function setFont(doc: jsPDF, weight: 'bold' | 'normal', size: number, color: [number, number, number] = C.ink) {
  doc.setFont('helvetica', weight)
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, opts: {
  fill?: [number, number, number]
  stroke?: [number, number, number]
  radius?: number
  lineWidth?: number
}) {
  if (opts.fill) doc.setFillColor(...opts.fill)
  if (opts.stroke) doc.setDrawColor(...opts.stroke)
  if (opts.lineWidth != null) doc.setLineWidth(opts.lineWidth)
  const style = opts.fill && opts.stroke ? 'FD' : opts.fill ? 'F' : 'S'
  if (opts.radius) doc.roundedRect(x, y, w, h, opts.radius, opts.radius, style)
  else doc.rect(x, y, w, h, style)
}

async function ensureRasterLogo(dataUrl: string | null): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  if (!dataUrl) return null
  // Se já é PNG/JPEG, devolve como está.
  if (dataUrl.startsWith('data:image/png')) return { data: dataUrl, fmt: 'PNG' }
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return { data: dataUrl, fmt: 'JPEG' }
  }
  // SVG (data:image/svg+xml;base64,...) — jsPDF não desenha SVG. Renderiza
  // num <canvas> off-screen e exporta PNG.
  if (!dataUrl.startsWith('data:image/svg')) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const W = 320
        const ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width || W)
        const H = Math.max(48, Math.round(W * (Number.isFinite(ratio) ? ratio : 0.4)))
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        // Fundo branco (SVGs com transparência ficam horríveis em PDF).
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(img, 0, 0, W, H)
        resolve({ data: canvas.toDataURL('image/png'), fmt: 'PNG' })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

function fmtIrr(irr: number | null): string {
  if (irr == null) return '—'
  if (irr > 1) return '>100% a.a.'
  return formatPercent(irr * 100, 2)
}

function fmtShortCurrency(v: number, currency: string): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${currency} ${(v / 1_000).toFixed(0)}k`
  return formatCurrency(v, currency)
}

// ───────────────────────── Header / Footer ─────────────────────────
function drawHeader(doc: jsPDF, opts: ExportInput, logo: ResolvedLogo, pageNum: number, total: number) {
  const w = PAGE.w
  // Logo + nome tenant
  let xCursor = M.left
  if (logo) {
    try {
      doc.addImage(logo.data, logo.fmt, M.left, 8, 22, 8, undefined, 'FAST')
      xCursor = M.left + 25
    } catch { /* logo opcional, não bloquear export */ }
  }
  setFont(doc, 'bold', 9, C.ink)
  doc.text(opts.tenantName, xCursor, 13)
  setFont(doc, 'normal', 7, C.muted)
  doc.text('Análise de Retorno', xCursor, 17)

  // Direita: nome análise + página
  setFont(doc, 'normal', 8, C.muted)
  doc.text(`${opts.roi.name} · v${opts.roi.version}`, w - M.right, 13, { align: 'right' })
  doc.text(`${pageNum} / ${total}`, w - M.right, 17, { align: 'right' })

  // Linha fina
  doc.setDrawColor(...C.hairline).setLineWidth(0.3)
  doc.line(M.left, 20, w - M.right, 20)
}

function drawFooter(doc: jsPDF) {
  setFont(doc, 'normal', 7, C.muted)
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    M.left, PAGE.h - 8,
  )
  doc.text('CONFIDENCIAL — uso interno', PAGE.w - M.right, PAGE.h - 8, { align: 'right' })
}

// ───────────────────────── Página 1 — Capa ─────────────────────────
function drawCover(doc: jsPDF, opts: ExportInput, logo: ResolvedLogo) {
  const { roi, metrics } = opts
  const cur = roi.currency

  // Logo grande do tenant no topo (se houver)
  if (logo) {
    try {
      doc.addImage(logo.data, logo.fmt, M.left, 14, 50, 18, undefined, 'FAST')
    } catch { /* ignore */ }
  }
  // Nome do tenant (label corporativo) — alinhado à direita, mesma altura do logo
  setFont(doc, 'bold', 11, C.muted)
  doc.text(opts.tenantName.toUpperCase(), PAGE.w - M.right, 24, { align: 'right' })
  setFont(doc, 'normal', 8, C.muted)
  doc.text('Relatório de Análise de Retorno (ROI)', PAGE.w - M.right, 29, { align: 'right' })

  // Banner colorido topo (acento de marca)
  rect(doc, 0, 0, PAGE.w, 4, { fill: C.brand })

  // Título grande
  setFont(doc, 'bold', 28, C.ink)
  doc.text('Análise de Retorno', M.left, 50)
  // Linha decorativa abaixo do título
  doc.setDrawColor(...C.brand).setLineWidth(0.8)
  doc.line(M.left, 53, M.left + 40, 53)

  // Subtítulo: nome do projeto
  setFont(doc, 'normal', 14, C.body)
  doc.text(roi.name, M.left, 60)

  // Linha de meta (versão / moeda / data)
  setFont(doc, 'normal', 9, C.muted)
  const meta: string[] = [
    `Versão ${roi.version}`,
    cur,
    `${roi.durationMonths || 12} meses`,
    new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
  ]
  doc.text(meta.join('  ·  '), M.left, 67)

  // Status badge (canto direito)
  const isApproved = roi.status === 'approved'
  const statusLabel = (roi.status || 'draft').toUpperCase()
  const statusW = doc.getTextWidth(statusLabel) + 8
  rect(doc, PAGE.w - M.right - statusW, 45, statusW, 7, {
    fill: isApproved ? C.posSoft : C.brandSoft,
    radius: 1.5,
  })
  setFont(doc, 'bold', 8, isApproved ? C.posDark : C.brand)
  doc.text(statusLabel, PAGE.w - M.right - statusW / 2, 49.5, { align: 'center' })

  // ── KPI cards 2x2 (grandes) ─────────────────────────────
  const kpis = [
    { label: 'RECEITA TOTAL',  value: fmtShortCurrency(metrics.totalRevenue, cur),    accent: C.pos,  full: formatCurrency(metrics.totalRevenue, cur) },
    { label: 'CUSTO TOTAL',    value: fmtShortCurrency(metrics.totalCost, cur),       accent: C.neg,  full: formatCurrency(metrics.totalCost, cur) },
    { label: 'INVESTIMENTO',   value: fmtShortCurrency(metrics.totalInvestment, cur), accent: C.inv,  full: formatCurrency(metrics.totalInvestment, cur) },
    { label: 'RESULTADO',      value: fmtShortCurrency(metrics.netValue, cur),        accent: metrics.netValue >= 0 ? C.pos : C.neg, full: formatCurrency(metrics.netValue, cur) },
  ]
  const cardW = (inner() - 6) / 2
  const cardH = 36
  const cardY = 90
  kpis.forEach((k, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M.left + col * (cardW + 6)
    const y = cardY + row * (cardH + 6)
    // Card body
    rect(doc, x, y, cardW, cardH, { fill: C.white, stroke: C.hairline, radius: 2, lineWidth: 0.3 })
    // Faixa de cor à esquerda
    rect(doc, x, y, 2.5, cardH, { fill: k.accent })
    // Label
    setFont(doc, 'bold', 8, C.muted)
    doc.text(k.label, x + 6, y + 9)
    // Valor (curto)
    setFont(doc, 'bold', 22, k.accent)
    doc.text(k.value, x + 6, y + 24)
    // Valor full em pequeno
    setFont(doc, 'normal', 8, C.muted)
    doc.text(k.full, x + 6, y + 31)
  })

  // ── Indicadores principais ─────────────────────────────
  const indY = cardY + 2 * (cardH + 6) + 14
  setFont(doc, 'bold', 12, C.ink)
  doc.text('Indicadores principais', M.left, indY)
  doc.setDrawColor(...C.brand).setLineWidth(0.6)
  doc.line(M.left, indY + 1.5, M.left + 30, indY + 1.5)

  const ind: Array<[string, string, [number, number, number]?]> = [
    ['Receita mensal recorrente', formatCurrency(metrics.monthlyRevenueTotal, cur), C.posDark],
    ['NPV (Valor Presente Líquido)', formatCurrency(metrics.npv, cur), metrics.npv >= 0 ? C.posDark : C.negDark],
    ['TIR a.a.', fmtIrr(metrics.irr)],
    ['Payback', metrics.paybackMonths != null ? `${metrics.paybackMonths} meses` : 'Não atinge'],
    ['Margem',
      metrics.totalRevenue > 0
        ? `${((metrics.netValue / metrics.totalRevenue) * 100).toFixed(2)}%`
        : '—'],
    ['Duração do contrato', `${roi.durationMonths || 12} meses`],
  ]
  let yy = indY + 8
  ind.forEach(([k, v, color]) => {
    setFont(doc, 'normal', 10, C.body)
    doc.text(k, M.left + 2, yy)
    setFont(doc, 'bold', 10, color || C.ink)
    doc.text(v, PAGE.w - M.right - 2, yy, { align: 'right' })
    // Hairline divider
    doc.setDrawColor(...C.hairline).setLineWidth(0.2)
    doc.line(M.left, yy + 1.5, PAGE.w - M.right, yy + 1.5)
    yy += 7
  })

  // ── Receita: bruto vs líquido (se houver desconto) ─────────────
  if (metrics.discountStats.discountAmount > 0) {
    yy += 6
    setFont(doc, 'bold', 12, C.ink)
    doc.text('Composição da receita', M.left, yy)
    doc.setDrawColor(...C.brand).setLineWidth(0.6)
    doc.line(M.left, yy + 1.5, M.left + 30, yy + 1.5)
    yy += 9
    const ds = metrics.discountStats
    const rows: Array<[string, string, [number, number, number]]> = [
      ['Bruto', formatCurrency(ds.grossRevenue, cur), C.body],
      ['Líquido', formatCurrency(ds.netRevenue, cur), C.posDark],
      ['Desconto concedido', `-${formatCurrency(ds.discountAmount, cur)}`, C.negDark],
    ]
    rows.forEach(([k, v, color]) => {
      setFont(doc, 'normal', 10, C.body)
      doc.text(k, M.left + 2, yy)
      setFont(doc, 'bold', 10, color)
      doc.text(v, PAGE.w - M.right - 2, yy, { align: 'right' })
      doc.setDrawColor(...C.hairline).setLineWidth(0.2)
      doc.line(M.left, yy + 1.5, PAGE.w - M.right, yy + 1.5)
      yy += 7
    })
  }
}

// ───────────────────────── Página — Charts ─────────────────────────
function drawChartsPage(doc: jsPDF, opts: ExportInput) {
  const { roi, metrics } = opts
  const cur = roi.currency
  const flow = metrics.monthlyFlow
  if (flow.length === 0) return

  doc.addPage()
  setFont(doc, 'bold', 16, C.ink)
  doc.text('Fluxo de caixa', M.left, 30)
  setFont(doc, 'normal', 9, C.muted)
  doc.text('Saldo acumulado mês a mês e composição mensal por categoria.', M.left, 36)

  // ──── Chart 1: Saldo Acumulado ────
  const chart1 = { x: M.left, y: 44, w: inner(), h: 90 }
  setFont(doc, 'bold', 11, C.ink)
  doc.text('Saldo acumulado', chart1.x, chart1.y - 2)

  const cumValues = flow.map(f => f.cumulative)
  const maxC = Math.max(0, ...cumValues)
  const minC = Math.min(0, ...cumValues)
  const range = (maxC - minC) || 1

  const padL = 18, padR = 4, padT = 8, padB = 14
  const innerW = chart1.w - padL - padR
  const innerH = chart1.h - padT - padB
  const xs = (i: number) => chart1.x + padL + (i / Math.max(1, flow.length - 1)) * innerW
  const ys = (v: number) => chart1.y + padT + ((maxC - v) / range) * innerH

  // Grid Y (4 ticks)
  setFont(doc, 'normal', 7, C.muted)
  for (let i = 0; i <= 4; i++) {
    const v = maxC - (range * i / 4)
    const y = chart1.y + padT + (i / 4) * innerH
    doc.setDrawColor(...(v === 0 ? C.muted : C.hairline)).setLineWidth(v === 0 ? 0.4 : 0.2)
    doc.line(chart1.x + padL, y, chart1.x + padL + innerW, y)
    doc.text(fmtShortCurrency(v, cur), chart1.x + padL - 1, y + 1.5, { align: 'right' })
  }

  // Eixo X — TODOS os meses
  for (let i = 0; i < flow.length; i++) {
    const x = xs(i)
    doc.setDrawColor(...C.hairline).setLineWidth(0.15)
    doc.line(x, chart1.y + padT + innerH, x, chart1.y + padT + innerH + 1.5)
    setFont(doc, 'normal', 6, C.muted)
    doc.text(`m${flow[i].month}`, x, chart1.y + padT + innerH + 5, { align: 'center' })
  }

  // Payback marker
  if (metrics.paybackMonths != null) {
    const idx = flow.findIndex(f => f.month === metrics.paybackMonths)
    if (idx >= 0) {
      const px = xs(idx)
      doc.setDrawColor(...C.pos).setLineWidth(0.4)
      // Linha tracejada via sequência de pequenos segmentos
      for (let yy = chart1.y + padT; yy < chart1.y + padT + innerH; yy += 2.5) {
        doc.line(px, yy, px, Math.min(yy + 1.5, chart1.y + padT + innerH))
      }
      setFont(doc, 'bold', 6.5, C.posDark)
      doc.text(`Payback m${metrics.paybackMonths}`, px, chart1.y + padT - 1, { align: 'center' })
    }
  }

  // Linha + área (com cor por sinal)
  // Área sob a linha
  for (let i = 0; i < flow.length - 1; i++) {
    const a = flow[i], b = flow[i + 1]
    const x1 = xs(i), x2 = xs(i + 1)
    const y1 = ys(a.cumulative), y2 = ys(b.cumulative)
    const yZero = ys(0)
    const aPos = a.cumulative >= 0
    const bPos = b.cumulative >= 0
    const fillTone = (aPos && bPos) ? [...C.posSoft] as [number, number, number]
      : (!aPos && !bPos) ? [...C.negSoft] as [number, number, number]
      : null
    if (fillTone) {
      doc.setFillColor(...fillTone)
      doc.lines([[0, yZero - y1], [x2 - x1, y2 - yZero], [0, yZero - y2]], x1, y1, [1, 1], 'F', true)
    }
    // Linha
    const lineColor = aPos && bPos ? C.pos : !aPos && !bPos ? C.neg : aPos ? C.pos : C.neg
    doc.setDrawColor(...lineColor).setLineWidth(0.7)
    doc.line(x1, y1, x2, y2)
  }

  // Pontos nos vértices
  flow.forEach((f, i) => {
    const x = xs(i), y = ys(f.cumulative)
    const c = f.cumulative >= 0 ? C.pos : C.neg
    doc.setFillColor(...c)
    doc.circle(x, y, 0.8, 'F')
  })

  // ──── Chart 2: Fluxo mensal (barras agrupadas) ────
  const chart2 = { x: M.left, y: 150, w: inner(), h: 90 }
  setFont(doc, 'bold', 11, C.ink)
  doc.text('Fluxo mensal por categoria', chart2.x, chart2.y - 2)

  // Legenda
  const legendY = chart2.y - 2
  const drawLegend = (x: number, color: [number, number, number], label: string) => {
    rect(doc, x, legendY - 3, 3, 3, { fill: color, radius: 0.5 })
    setFont(doc, 'normal', 7, C.body)
    doc.text(label, x + 4, legendY)
  }
  drawLegend(chart2.x + 60,  C.pos, 'Receita')
  drawLegend(chart2.x + 90,  C.neg, 'Custo')
  drawLegend(chart2.x + 115, C.inv, 'Investimento')

  const innerW2 = chart2.w - padL - padR
  const innerH2 = chart2.h - padT - padB
  const xs2 = (i: number) => chart2.x + padL + (i + 0.5) * (innerW2 / flow.length)

  const max2 = Math.max(...flow.map(f => Math.max(f.inflow, f.outflow + f.investment)), 1)
  const ys2 = (v: number) => chart2.y + padT + (1 - v / max2) * innerH2

  // Grid Y
  for (let i = 0; i <= 4; i++) {
    const v = max2 * (1 - i / 4)
    const y = chart2.y + padT + (i / 4) * innerH2
    doc.setDrawColor(...C.hairline).setLineWidth(0.2)
    doc.line(chart2.x + padL, y, chart2.x + padL + innerW2, y)
    setFont(doc, 'normal', 6, C.muted)
    doc.text(fmtShortCurrency(v, cur), chart2.x + padL - 1, y + 1.5, { align: 'right' })
  }
  // Linha base (zero)
  doc.setDrawColor(...C.muted).setLineWidth(0.4)
  doc.line(chart2.x + padL, chart2.y + padT + innerH2, chart2.x + padL + innerW2, chart2.y + padT + innerH2)

  // Eixo X — TODOS os meses
  for (let i = 0; i < flow.length; i++) {
    setFont(doc, 'normal', 6, C.muted)
    doc.text(`m${flow[i].month}`, xs2(i), chart2.y + padT + innerH2 + 5, { align: 'center' })
  }

  // 3 barras por mês (receita / custo / investimento)
  const slotW = innerW2 / flow.length
  const barW = Math.min(2.4, (slotW - 0.6) / 3)
  flow.forEach((f, i) => {
    const cx = xs2(i)
    const yBase = chart2.y + padT + innerH2
    // Receita (verde)
    if (f.inflow > 0) {
      const h = (f.inflow / max2) * innerH2
      rect(doc, cx - barW * 1.5 - 0.3, yBase - h, barW, h, { fill: C.pos })
    }
    // Custo (vermelho)
    if (f.outflow > 0) {
      const h = (f.outflow / max2) * innerH2
      rect(doc, cx - barW / 2, yBase - h, barW, h, { fill: C.neg })
    }
    // Investimento (azul)
    if (f.investment > 0) {
      const h = (f.investment / max2) * innerH2
      rect(doc, cx + barW / 2 + 0.3, yBase - h, barW, h, { fill: C.inv })
    }
  })
  void ys2
}

// ───────────────────────── Página — Lançamentos ─────────────────────────
function drawEntries(doc: jsPDF, opts: ExportInput) {
  const { roi, entries, categoryById, itemsById } = opts
  const cur = roi.currency
  const dur = roi.durationMonths || 12
  if (entries.length === 0) return

  doc.addPage()
  setFont(doc, 'bold', 16, C.ink)
  doc.text('Lançamentos', M.left, 30)
  setFont(doc, 'normal', 9, C.muted)
  doc.text(`${entries.length} ${entries.length > 1 ? 'itens' : 'item'} agrupados por categoria.`, M.left, 36)

  // Agrupar
  const groups = new Map<string, { name: string; items: RoiEntry[]; total: number; family: string }>()
  for (const e of entries) {
    const catId = e.categoryId || 'none'
    const catName = e.categoryId
      ? (categoryById.get(String(e.categoryId)) || `#${e.categoryId}`)
      : (e.categoryKey || 'Sem categoria')
    const fam = familyOf(e.comportamento) || 'EXPENSE'
    const g = groups.get(String(catId)) || { name: catName, items: [], total: 0, family: fam }
    g.items.push(e)
    const qty = Number(e.quantity) || 0
    const unit = Number(e.unitValue) || 0
    const disc = Number(e.discountPct) || 0
    const net = qty * unit * (1 - disc / 100)
    const suf = suffixOf(e.comportamento)
    let total = net
    if (suf === 'MONTHLY') total = net * Math.max(0, dur - (Math.max(1, e.startMonth || 1)) + 1)
    g.total += fam === 'INCOME' ? total : -total
    groups.set(String(catId), g)
  }

  let y = 44
  const order: Record<string, number> = { INCOME: 0, MIXED: 1, EXPENSE: 2, INVESTMENT: 3 }
  const sorted = Array.from(groups.entries()).sort(
    (a, b) => (order[a[1].family] - order[b[1].family]) || Math.abs(b[1].total) - Math.abs(a[1].total),
  )

  for (const [, g] of sorted) {
    const accent = g.family === 'INCOME' ? C.pos : g.family === 'INVESTMENT' ? C.inv : C.neg
    const accentSoft = g.family === 'INCOME' ? C.posSoft : g.family === 'INVESTMENT' ? C.invSoft : C.negSoft

    // Cabeçalho da categoria (banner)
    rect(doc, M.left, y, inner(), 7, { fill: accentSoft })
    rect(doc, M.left, y, 1.5, 7, { fill: accent })
    setFont(doc, 'bold', 10, C.ink)
    doc.text(g.name, M.left + 4, y + 4.7)
    setFont(doc, 'normal', 8, C.muted)
    doc.text(`${g.items.length} item${g.items.length > 1 ? 's' : ''}`, M.left + 70, y + 4.7)
    setFont(doc, 'bold', 10, g.total >= 0 ? C.posDark : C.negDark)
    const sign = g.total >= 0 ? '+' : '-'
    doc.text(`${sign}${formatCurrency(Math.abs(g.total), cur)}`, PAGE.w - M.right - 2, y + 4.7, { align: 'right' })
    y += 9

    // Linhas
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
        suf === 'INSTALLMENT' && e.installments ? `m${start} ─ ${e.installments}x`
        : suf === 'MONTHLY' ? `m${start}–m${dur}`
        : `m${start} (única)`
      const sign = fam === 'INCOME' ? '+' : '-'
      return [
        it.name || e.description || '—',
        qty.toLocaleString('pt-BR'),
        formatCurrency(unit, cur),
        disc > 0 ? `${disc.toFixed(1)}%` : '—',
        window,
        `${sign}${formatCurrency(impact, cur)}`,
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Qtd', 'Unitário', 'Desc.', 'Janela', 'Impacto']],
      body: rows,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: C.hairline, lineWidth: 0.1, textColor: C.body },
      headStyles: { fontStyle: 'bold', textColor: C.muted, fontSize: 7, fillColor: C.surface },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold', textColor: C.ink },
        1: { halign: 'right', cellWidth: 18 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'center', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const cell = data.cell.raw as string
          if (cell?.startsWith('+')) data.cell.styles.textColor = C.posDark
          else if (cell?.startsWith('-')) data.cell.styles.textColor = C.negDark
        }
      },
      margin: { left: M.left, right: M.right },
    })
    // @ts-expect-error — autoTable.lastAutoTable
    y = (doc.lastAutoTable.finalY ?? y) + 6

    if (y > PAGE.h - 30) {
      doc.addPage()
      y = 30
    }
  }
}

// ───────────────────────── Página — Matriz mensal ─────────────────────────
function drawMonthlyMatrix(doc: jsPDF, opts: ExportInput) {
  const { roi, entries, categoryById } = opts
  const cur = roi.currency
  const dur = roi.durationMonths || 12
  if (entries.length === 0) return

  doc.addPage()  // mantém a4 portrait (mesma orientação)
  setFont(doc, 'bold', 16, C.ink)
  doc.text('Fluxo mensal por categoria', M.left, 30)
  setFont(doc, 'normal', 9, C.muted)
  doc.text('Receitas em verde, custos/investimentos em vermelho. Heatmap proporcional ao valor absoluto.', M.left, 36)

  // Reconstrói matriz
  type Col = { name: string; perMonth: number[]; total: number; family: string }
  const colMap = new Map<string, Col>()
  for (const e of entries) {
    const catId = String(e.categoryId || 'none')
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
    const col = colMap.get(catId) || { name: catName, perMonth: Array.from({ length: dur }, () => 0), total: 0, family: fam }
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
    colMap.set(catId, col)
  }
  const order: Record<string, number> = { INCOME: 0, MIXED: 1, EXPENSE: 2, INVESTMENT: 3 }
  const cols = Array.from(colMap.values()).sort((a, b) =>
    (order[a.family] - order[b.family]) || (b.total - a.total),
  )

  const totals = Array.from({ length: dur }, (_, i) => cols.reduce((s, c) => s + c.perMonth[i], 0))
  const cumulative: number[] = []
  let acc = 0
  for (const v of totals) { acc += v; cumulative.push(acc) }
  let payback: number | null = null
  let totalOut = 0
  for (let i = 0; i < dur; i++) {
    if (totals[i] < 0) totalOut += -totals[i]
    if (payback == null && cumulative[i] >= 0 && totalOut > 0) payback = i + 1
  }

  // Heat scale (p95)
  const allVals = cols.flatMap(c => c.perMonth.map(v => Math.abs(v)))
  const sortedVals = allVals.filter(v => v > 0).sort((a, b) => a - b)
  const p95 = sortedVals.length > 0 ? sortedVals[Math.floor(sortedVals.length * 0.95)] : 1

  const head = ['Mês', ...cols.map(c => c.name), 'Líquido', 'Acumulado']
  const body = Array.from({ length: dur }, (_, i) => {
    const isPayback = payback === i + 1
    const monthCell = isPayback
      ? { content: `m${i + 1} ◆`, styles: { fontStyle: 'bold' as const, fillColor: C.posSoft, textColor: C.posDark } }
      : { content: `m${i + 1}`, styles: { fontStyle: 'bold' as const } }
    const row: any[] = [
      monthCell,
      ...cols.map(c => {
        const v = c.perMonth[i]
        if (v === 0) return { content: '—', styles: { textColor: [200, 200, 200] as [number, number, number], halign: 'center' as const } }
        const intensity = Math.min(1, Math.abs(v) / p95)
        const tone = v > 0 ? C.posSoft : C.negSoft
        const text = v > 0 ? C.posDark : C.negDark
        // Mistura branco→tone proporcional
        const fill: [number, number, number] = [
          Math.round(255 - (255 - tone[0]) * intensity),
          Math.round(255 - (255 - tone[1]) * intensity),
          Math.round(255 - (255 - tone[2]) * intensity),
        ]
        return { content: formatCurrency(Math.abs(v), cur), styles: { fillColor: fill, textColor: text, halign: 'center' as const } }
      }),
      {
        content: totals[i] === 0 ? '—' : formatCurrency(totals[i], cur),
        styles: { textColor: totals[i] >= 0 ? C.posDark : C.negDark, halign: 'center' as const, fontStyle: 'bold' as const, fillColor: totals[i] >= 0 ? C.posSoft : C.negSoft },
      },
      {
        content: formatCurrency(cumulative[i], cur),
        styles: { textColor: cumulative[i] >= 0 ? C.posDark : C.negDark, halign: 'center' as const, fontStyle: 'bold' as const },
      },
    ]
    return row
  })

  autoTable(doc, {
    startY: 42,
    head: [head],
    body,
    foot: [[
      { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: C.surface, textColor: C.ink, halign: 'center' } },
      ...cols.map(c => ({
        content: c.total === 0 ? '—' : formatCurrency(Math.abs(c.total), cur),
        styles: { fontStyle: 'bold' as const, fillColor: C.surface, halign: 'center' as const, textColor: c.total > 0 ? C.posDark : c.total < 0 ? C.negDark : C.ink },
      })),
      {
        content: formatCurrency(totals.reduce((a, v) => a + v, 0), cur),
        styles: { fontStyle: 'bold' as const, fillColor: C.surface, halign: 'center' as const, textColor: totals.reduce((a, v) => a + v, 0) >= 0 ? C.posDark : C.negDark },
      },
      {
        content: formatCurrency(cumulative[cumulative.length - 1] || 0, cur),
        styles: { fontStyle: 'bold' as const, fillColor: C.surface, halign: 'center' as const, textColor: (cumulative[cumulative.length - 1] || 0) >= 0 ? C.posDark : C.negDark },
      },
    ]],
    theme: 'plain',
    styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: C.hairline, lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: { fillColor: C.surface, textColor: C.muted, fontStyle: 'bold', halign: 'center', fontSize: 6.5, lineWidth: 0.2, cellPadding: 1.2 },
    columnStyles: { 0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' } },
    tableWidth: 'auto',
    margin: { left: M.left, right: M.right },
  })
}

// ───────────────────────── Função pública ─────────────────────────
export async function exportRoiToPdf(input: ExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Resolve SVG→PNG uma vez. jsPDF não desenha SVG nativamente,
  // e silenciosamente ignora addImage com SVG.
  const logo = await ensureRasterLogo(input.tenantLogoDataUrl)

  drawCover(doc, input, logo)
  drawChartsPage(doc, input)
  drawEntries(doc, input)
  drawMonthlyMatrix(doc, input)

  // Header + footer em todas as páginas (exceto capa, que já tem logo grande)
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    if (i > 1) drawHeader(doc, input, logo, i, total)
    drawFooter(doc)
  }

  const slug = input.roi.name.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')
  doc.save(`roi-${slug}-v${input.roi.version}.pdf`)
}
