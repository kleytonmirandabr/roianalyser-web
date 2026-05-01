/**
 * Exportação ROI → PDF (v3 — design de consultoria).
 *
 * Filosofia: relatório executivo com sistema visual coeso. Capa minimal,
 * Sumário Executivo com narrativa, gráficos com anotações textuais,
 * lançamentos com cards de categoria, matriz em landscape (única exceção
 * de orientação — porque a tabela 12 meses × N categorias precisa do espaço).
 *
 * Estrutura de páginas:
 *   1. Capa — banner, logo, título 36pt, projeto, hero "Resultado projetado"
 *   2. 01 |Sumário Executivo — narrativa + KPIs + indicadores
 *   3. 02 |Fluxo de caixa — saldo acumulado anotado
 *   4. 02 |Fluxo de caixa — fluxo mensal anotado
 *   5+. 03 |Lançamentos — cards de categoria + tabelas
 *   N (last). 04 |Matriz mensal — LANDSCAPE
 *
 * Sistema visual:
 *   - Cinza dominante (60%), indigo de marca (20%), verde/vermelho semântico (20%)
 *   - Tipografia Helvetica com hierarquia forte (36 → 18 → 12 → 9 → 7)
 *   - Numeração de seção "01 |Título" como âncora
 *   - Footer consistente com tenant + paginação
 */
import jsPDF from 'jspdf'
import autoTableModule from 'jspdf-autotable'

import {
  familyOf, suffixOf,
  type RoiAnalysis, type RoiEntry, type RoiMetrics,
} from '@/features/roi-analyses/types'
import { formatCurrency, formatPercent } from '@/shared/lib/format'

// Vite/esbuild interop: jspdf-autotable é CJS com module.exports.default,
// pode chegar como { default: fn } em vez da função após minify.
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

type ResolvedLogo = { data: string; fmt: 'PNG' | 'JPEG' } | null

// ───────────────────────── Design tokens ─────────────────────────
const C = {
  brand:       [79,  70,  229] as [number, number, number],   // indigo-600
  brandSoft:   [238, 242, 255] as [number, number, number],   // indigo-50
  pos:         [22, 163, 74]  as [number, number, number],    // emerald-600
  posDark:     [21, 128,  61] as [number, number, number],    // emerald-700
  posSoft:     [220, 252, 231] as [number, number, number],   // emerald-100
  neg:         [220,  38,  38] as [number, number, number],   // rose-600
  negDark:     [153,  27,  27] as [number, number, number],   // rose-800
  negSoft:     [254, 226, 226] as [number, number, number],   // rose-100
  inv:         [37,  99, 235] as [number, number, number],    // blue-600
  invSoft:     [219, 234, 254] as [number, number, number],   // blue-100
  ink:         [17,  24,  39] as [number, number, number],    // gray-900
  body:        [55,  65,  81] as [number, number, number],    // gray-700
  muted:       [107, 114, 128] as [number, number, number],   // gray-500
  mutedLight:  [156, 163, 175] as [number, number, number],   // gray-400
  hairline:    [229, 231, 235] as [number, number, number],   // gray-200
  surface:     [249, 250, 251] as [number, number, number],   // gray-50
  white:       [255, 255, 255] as [number, number, number],
}

const PAGE_PORTRAIT  = { w: 210, h: 297 }
const PAGE_LANDSCAPE = { w: 297, h: 210 }
const M = { left: 18, right: 18, top: 28, bottom: 22 }

// ───────────────────────── Utils ─────────────────────────
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

function fmtIrr(irr: number | null): string {
  if (irr == null) return '-'
  if (irr > 1) return '>100% a.a.'
  return formatPercent(irr * 100, 2)
}

// Mapeia código ISO → símbolo amigável. jsPDF Helvetica é Latin-1, então só
// símbolos ASCII/Latin-1 (€ é ok, mas usaremos prefixos curtos).
function currencySymbol(code: string): string {
  const c = (code || '').toUpperCase()
  switch (c) {
    case 'BRL': return 'R$'
    case 'USD': return 'US$'
    case 'EUR': return 'EUR'
    case 'GBP': return 'GBP'
    default: return c || 'R$'
  }
}

function fmtShortCurrency(v: number, currency: string): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  const sym = currencySymbol(currency)
  if (abs >= 1_000_000) return `${sign}${sym} ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${sym} ${(abs / 1_000).toFixed(0)}k`
  return formatCurrency(v, currency)
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
}


async function ensureRasterLogo(dataUrl: string | null): Promise<ResolvedLogo> {
  if (!dataUrl) return null
  if (dataUrl.startsWith('data:image/png')) return { data: dataUrl, fmt: 'PNG' }
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return { data: dataUrl, fmt: 'JPEG' }
  }
  if (!dataUrl.startsWith('data:image/svg')) return null
  // SVG → PNG via canvas. NÃO usar crossOrigin pra data URLs (taints o canvas
  // mesmo sendo same-origin).
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        // Tenta detectar dimensões do SVG; se não der, usa default.
        const naturalW = img.naturalWidth || img.width || 0
        const naturalH = img.naturalHeight || img.height || 0
        const W = 480
        const ratio = naturalW > 0 && naturalH > 0 ? naturalH / naturalW : 0.35
        const H = Math.max(80, Math.round(W * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        // Fundo branco — SVGs com transparência ficam horríveis em PDF.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(img, 0, 0, W, H)
        const png = canvas.toDataURL('image/png')
        resolve({ data: png, fmt: 'PNG' })
      } catch (err) {
        console.warn('[roi-pdf] SVG logo conversion failed', err)
        resolve(null)
      }
    }
    img.onerror = (err) => {
      console.warn('[roi-pdf] SVG logo failed to load', err)
      resolve(null)
    }
    img.src = dataUrl
  })
}

// ───────────────────────── Header / Footer ─────────────────────────
function drawHeader(doc: jsPDF, opts: ExportInput, logo: ResolvedLogo, isLandscape = false) {
  const W = isLandscape ? PAGE_LANDSCAPE.w : PAGE_PORTRAIT.w
  // Linha indigo discreta no topo
  rect(doc, 0, 0, W, 1.2, { fill: C.brand })
  // Logo (se houver) à esquerda
  let x = M.left
  if (logo) {
    try {
      doc.addImage(logo.data, logo.fmt, M.left, 8, 22, 8, undefined, 'FAST')
      x = M.left + 26
    } catch { /* ignore */ }
  }
  setFont(doc, 'bold', 8.5, C.ink)
  doc.text(opts.tenantName, x, 12.5)
  setFont(doc, 'normal', 7, C.muted)
  doc.text('Análise de Retorno |' + opts.roi.name, x, 16.5)
  // Hairline
  doc.setDrawColor(...C.hairline).setLineWidth(0.2)
  doc.line(M.left, 19, W - M.right, 19)
}

function drawFooter(doc: jsPDF, opts: ExportInput, pageNum: number, total: number, isLandscape = false) {
  const W = isLandscape ? PAGE_LANDSCAPE.w : PAGE_PORTRAIT.w
  const H = isLandscape ? PAGE_LANDSCAPE.h : PAGE_PORTRAIT.h
  doc.setDrawColor(...C.hairline).setLineWidth(0.2)
  doc.line(M.left, H - 14, W - M.right, H - 14)
  setFont(doc, 'normal', 7, C.muted)
  doc.text(opts.tenantName + ' |CONFIDENCIAL', M.left, H - 8)
  doc.text(
    `Página ${pageNum} / ${total}`,
    W - M.right, H - 8, { align: 'right' },
  )
  // Versão + data centralizado
  doc.text(
    `${opts.roi.name} |v${opts.roi.version} |${new Date().toLocaleDateString('pt-BR')}`,
    W / 2, H - 8, { align: 'center' },
  )
}

// ───────────────────────── PÁGINA 1 — Capa ─────────────────────────
function drawCover(doc: jsPDF, opts: ExportInput, logo: ResolvedLogo) {
  const { roi, metrics } = opts
  const cur = roi.currency
  const W = PAGE_PORTRAIT.w
  const H = PAGE_PORTRAIT.h

  // Banner colorido topo (acento de marca)
  rect(doc, 0, 0, W, 6, { fill: C.brand })

  // Logo + nome tenant (cabeçalho da capa, mais alto que páginas internas)
  if (logo) {
    try {
      doc.addImage(logo.data, logo.fmt, M.left, 14, 50, 18, undefined, 'FAST')
    } catch { /* ignore */ }
  }
  setFont(doc, 'bold', 11, C.ink)
  doc.text(opts.tenantName.toUpperCase(), W - M.right, 22, { align: 'right' })
  setFont(doc, 'normal', 8, C.muted)
  doc.text('Relatório Confidencial |Pré-venda', W - M.right, 27, { align: 'right' })

  // Bloco do título — verticalmente centrado num bloco superior
  const titleY = 80
  setFont(doc, 'normal', 10, C.brand)
  doc.text('RELATÓRIO', M.left, titleY)
  setFont(doc, 'bold', 36, C.ink)
  doc.text('Análise de Retorno', M.left, titleY + 13)
  // Subtítulo: nome do projeto
  setFont(doc, 'normal', 16, C.body)
  const projectLines = doc.splitTextToSize(roi.name, W - M.left - M.right)
  doc.text(projectLines, M.left, titleY + 24)

  // Linha decorativa
  doc.setDrawColor(...C.brand).setLineWidth(1)
  doc.line(M.left, titleY + 34, M.left + 50, titleY + 34)

  // Meta info — sem caractere |que jsPDF não desenha bem
  setFont(doc, 'normal', 9.5, C.muted)
  const metaItems = [
    `Versão ${roi.version}`,
    `Moeda ${currencySymbol(cur)}`,
    `${roi.durationMonths || 12} meses`,
    new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
  ]
  doc.text(metaItems.join('   |   '), M.left, titleY + 42)

  // ── KPI Hero — Resultado projetado, gigante ──
  const heroY = 175
  rect(doc, M.left, heroY, W - M.left - M.right, 70, {
    fill: C.surface, stroke: C.hairline, radius: 3, lineWidth: 0.4,
  })
  // Faixa colorida à esquerda (tom indica sinal do resultado)
  rect(doc, M.left, heroY, 4, 70, { fill: metrics.netValue >= 0 ? C.pos : C.neg })

  setFont(doc, 'bold', 9, C.muted)
  doc.text('RESULTADO PROJETADO', M.left + 10, heroY + 13)

  setFont(doc, 'bold', 42, metrics.netValue >= 0 ? C.posDark : C.negDark)
  doc.text(formatCurrency(metrics.netValue, cur), M.left + 10, heroY + 35)

  // Sub-stats em linha
  const subY = heroY + 50
  setFont(doc, 'normal', 8, C.muted)
  doc.text('PAYBACK', M.left + 10, subY)
  doc.text('TIR a.a.', M.left + 70, subY)
  doc.text('NPV', M.left + 130, subY)

  setFont(doc, 'bold', 14, C.ink)
  doc.text(metrics.paybackMonths != null ? `${metrics.paybackMonths} meses` : 'Não atinge', M.left + 10, subY + 8)
  doc.text(fmtIrr(metrics.irr), M.left + 70, subY + 8)
  doc.text(fmtShortCurrency(metrics.npv, cur), M.left + 130, subY + 8)

  // Status badge (canto inferior direito da capa) — em PT
  const isApproved = roi.status === 'approved'
  const statusLabel = (STATUS_LABELS[roi.status as string] || 'Rascunho').toUpperCase()
  const statusW = doc.getTextWidth(statusLabel) + 10
  rect(doc, W - M.right - statusW, H - 30, statusW, 7, {
    fill: isApproved ? C.posSoft : C.brandSoft, radius: 1.5,
  })
  setFont(doc, 'bold', 8, isApproved ? C.posDark : C.brand)
  doc.text(statusLabel, W - M.right - statusW / 2, H - 25.5, { align: 'center' })

  // Footer da capa
  setFont(doc, 'normal', 7, C.muted)
  doc.text(opts.tenantName + ' |CONFIDENCIAL |Distribuição restrita', M.left, H - 22)
}

// ───────────────────────── Section header ─────────────────────────
function drawSectionHeader(doc: jsPDF, num: string, title: string, subtitle?: string) {
  const y = 32
  setFont(doc, 'bold', 10, C.brand)
  doc.text(num, M.left, y)
  setFont(doc, 'bold', 18, C.ink)
  doc.text(title, M.left + 12, y)
  if (subtitle) {
    setFont(doc, 'normal', 9, C.muted)
    doc.text(subtitle, M.left + 12, y + 6)
  }
  // Linha indigo
  doc.setDrawColor(...C.brand).setLineWidth(0.7)
  doc.line(M.left, y + 11, M.left + 30, y + 11)
}

// ───────────────────────── PÁGINA 2 — Sumário Executivo ─────────────────────────
function drawExecutiveSummary(doc: jsPDF, opts: ExportInput) {
  const { roi, metrics } = opts
  const cur = roi.currency
  doc.addPage()
  drawSectionHeader(doc, '01', 'Sumário Executivo', 'Visão consolidada da análise de retorno')

  // ── Narrativa textual gerada ──
  let y = 56
  const dur = roi.durationMonths || 12
  const margemPct = metrics.totalRevenue > 0 ? (metrics.netValue / metrics.totalRevenue) * 100 : 0
  const paybackText = metrics.paybackMonths != null
    ? `O payback ocorre no mês ${metrics.paybackMonths}, indicando retorno do investimento em ${
        metrics.paybackMonths <= dur / 2 ? 'menos da metade' : 'mais da metade'
      } do ciclo de ${dur} meses.`
    : `Não foi atingido payback dentro de ${dur} meses analisados — a operação permanece com saldo acumulado negativo.`
  const tirText = metrics.irr != null
    ? `A TIR projetada é de ${fmtIrr(metrics.irr)}, ${metrics.irr > 0.2 ? 'um patamar atrativo' : 'requerendo análise comparativa contra alternativas de mesmo risco'}.`
    : 'A TIR não pôde ser calculada — fluxos de caixa sem inversão de sinal.'
  const npvText = `O NPV é de ${formatCurrency(metrics.npv, cur)}${
    metrics.npv > 0 ? ', sustentando viabilidade econômica.' : ', indicando retorno abaixo do custo de capital.'
  }`

  setFont(doc, 'normal', 10, C.body)
  const narrative = [
    `Esta análise projeta receita total de ${formatCurrency(metrics.totalRevenue, cur)} contra custo de ${formatCurrency(metrics.totalCost, cur)} e investimento de ${formatCurrency(metrics.totalInvestment, cur)}, totalizando ${metrics.netValue >= 0 ? 'resultado positivo' : 'resultado negativo'} de ${formatCurrency(metrics.netValue, cur)} ao longo de ${dur} meses.`,
    paybackText,
    `${tirText} ${npvText} A margem líquida da operação é de ${margemPct.toFixed(1)}%.`,
  ].join(' ')
  const narrativeLines = doc.splitTextToSize(narrative, PAGE_PORTRAIT.w - M.left - M.right)
  doc.text(narrativeLines, M.left, y)
  y += narrativeLines.length * 5 + 8

  // ── KPI cards horizontais ──
  const cardW = (PAGE_PORTRAIT.w - M.left - M.right - 9) / 4
  const cardH = 26
  const kpis: Array<{ label: string; value: string; accent: [number, number, number]; full?: string }> = [
    { label: 'RECEITA', value: fmtShortCurrency(metrics.totalRevenue, cur), accent: C.pos, full: formatCurrency(metrics.totalRevenue, cur) },
    { label: 'CUSTO', value: fmtShortCurrency(metrics.totalCost, cur), accent: C.neg, full: formatCurrency(metrics.totalCost, cur) },
    { label: 'INVESTIMENTO', value: fmtShortCurrency(metrics.totalInvestment, cur), accent: C.inv, full: formatCurrency(metrics.totalInvestment, cur) },
    { label: 'RESULTADO', value: fmtShortCurrency(metrics.netValue, cur), accent: metrics.netValue >= 0 ? C.pos : C.neg, full: formatCurrency(metrics.netValue, cur) },
  ]
  kpis.forEach((k, i) => {
    const x = M.left + i * (cardW + 3)
    rect(doc, x, y, cardW, cardH, { fill: C.white, stroke: C.hairline, radius: 1.5, lineWidth: 0.3 })
    rect(doc, x, y, cardW, 1.2, { fill: k.accent })
    setFont(doc, 'bold', 7, C.muted)
    doc.text(k.label, x + 3, y + 7)
    setFont(doc, 'bold', 14, k.accent)
    doc.text(k.value, x + 3, y + 17)
    setFont(doc, 'normal', 7, C.mutedLight)
    if (k.full && k.full !== k.value) doc.text(k.full, x + 3, y + 22)
  })
  y += cardH + 12

  // ── Indicadores ──
  setFont(doc, 'bold', 11, C.ink)
  doc.text('Indicadores principais', M.left, y)
  doc.setDrawColor(...C.brand).setLineWidth(0.5)
  doc.line(M.left, y + 1.5, M.left + 25, y + 1.5)
  y += 8
  const ind: Array<[string, string, [number, number, number]?]> = [
    ['Receita mensal recorrente', formatCurrency(metrics.monthlyRevenueTotal, cur), C.posDark],
    ['NPV (Valor Presente Líquido)', formatCurrency(metrics.npv, cur), metrics.npv >= 0 ? C.posDark : C.negDark],
    ['TIR a.a.', fmtIrr(metrics.irr)],
    ['Payback', metrics.paybackMonths != null ? `${metrics.paybackMonths} meses` : 'Não atinge'],
    ['Margem líquida', `${margemPct.toFixed(2)}%`],
    ['Duração do contrato', `${dur} meses`],
  ]
  ind.forEach(([k, v, color]) => {
    setFont(doc, 'normal', 9.5, C.body)
    doc.text(k, M.left + 1, y)
    setFont(doc, 'bold', 9.5, color || C.ink)
    doc.text(v, PAGE_PORTRAIT.w - M.right - 1, y, { align: 'right' })
    doc.setDrawColor(...C.hairline).setLineWidth(0.15)
    doc.line(M.left, y + 1.5, PAGE_PORTRAIT.w - M.right, y + 1.5)
    y += 6.5
  })

  // ── Composição da receita ──
  if (metrics.discountStats.discountAmount > 0) {
    y += 6
    setFont(doc, 'bold', 11, C.ink)
    doc.text('Composição da receita', M.left, y)
    doc.setDrawColor(...C.brand).setLineWidth(0.5)
    doc.line(M.left, y + 1.5, M.left + 25, y + 1.5)
    y += 8
    const ds = metrics.discountStats
    const rows: Array<[string, string, [number, number, number]]> = [
      ['Bruto (sem desconto)', formatCurrency(ds.grossRevenue, cur), C.body],
      ['Líquido (com desconto)', formatCurrency(ds.netRevenue, cur), C.posDark],
      ['Desconto concedido', `-${formatCurrency(ds.discountAmount, cur)}`, C.negDark],
    ]
    rows.forEach(([k, v, color]) => {
      setFont(doc, 'normal', 9.5, C.body)
      doc.text(k, M.left + 1, y)
      setFont(doc, 'bold', 9.5, color)
      doc.text(v, PAGE_PORTRAIT.w - M.right - 1, y, { align: 'right' })
      doc.setDrawColor(...C.hairline).setLineWidth(0.15)
      doc.line(M.left, y + 1.5, PAGE_PORTRAIT.w - M.right, y + 1.5)
      y += 6.5
    })
  }
}

// ───────────────────────── Chart helpers ─────────────────────────
function drawCumulativeChart(doc: jsPDF, opts: ExportInput, area: { x: number; y: number; w: number; h: number }) {
  const { roi, metrics } = opts
  const flow = metrics.monthlyFlow
  if (flow.length === 0) return
  const cur = roi.currency

  const pad = { l: 22, r: 6, t: 12, b: 16 }
  const innerW = area.w - pad.l - pad.r
  const innerH = area.h - pad.t - pad.b
  const cumValues = flow.map(f => f.cumulative)
  const maxC = Math.max(0, ...cumValues)
  const minC = Math.min(0, ...cumValues)
  const range = (maxC - minC) || 1
  const xs = (i: number) => area.x + pad.l + (i / Math.max(1, flow.length - 1)) * innerW
  const ys = (v: number) => area.y + pad.t + ((maxC - v) / range) * innerH
  const yZero = ys(0)

  // Grid Y (4 ticks)
  for (let i = 0; i <= 4; i++) {
    const v = maxC - (range * i / 4)
    const y = area.y + pad.t + (i / 4) * innerH
    doc.setDrawColor(...(Math.abs(v) < 0.01 ? C.muted : C.hairline)).setLineWidth(Math.abs(v) < 0.01 ? 0.4 : 0.15)
    doc.line(area.x + pad.l, y, area.x + pad.l + innerW, y)
    setFont(doc, 'normal', 7, C.muted)
    doc.text(fmtShortCurrency(v, cur), area.x + pad.l - 1.5, y + 1.2, { align: 'right' })
  }

  // Eixo X — todos os meses
  flow.forEach((f, i) => {
    setFont(doc, 'normal', 6.5, C.muted)
    doc.text(`m${f.month}`, xs(i), area.y + pad.t + innerH + 5, { align: 'center' })
  })

  // Áreas (trapézio fechado entre linha e zero)
  for (let i = 0; i < flow.length - 1; i++) {
    const a = flow[i], b = flow[i + 1]
    const x1 = xs(i), x2 = xs(i + 1)
    const y1 = ys(a.cumulative), y2 = ys(b.cumulative)
    const aPos = a.cumulative >= 0
    const bPos = b.cumulative >= 0
    // Só preenche segmentos onde ambos pontos têm mesmo sinal (evita
    // ambiguidade em cruzamento de zero — desenha a linha neutra).
    if (aPos === bPos) {
      const fill = aPos ? C.posSoft : C.negSoft
      doc.setFillColor(...fill)
      // Path triângulo/trapézio: (x1,y1) -> (x2,y2) -> (x2,yZero) -> (x1,yZero) -> close
      doc.lines(
        [[x2 - x1, y2 - y1], [0, yZero - y2], [x1 - x2, 0]],
        x1, y1, [1, 1], 'F', true,
      )
    }
  }
  // Linhas (depois das áreas pra ficar por cima)
  for (let i = 0; i < flow.length - 1; i++) {
    const a = flow[i], b = flow[i + 1]
    const x1 = xs(i), x2 = xs(i + 1)
    const y1 = ys(a.cumulative), y2 = ys(b.cumulative)
    const aPos = a.cumulative >= 0
    const bPos = b.cumulative >= 0
    const lineColor = aPos && bPos ? C.pos : !aPos && !bPos ? C.neg : aPos ? C.pos : C.neg
    doc.setDrawColor(...lineColor).setLineWidth(0.8)
    doc.line(x1, y1, x2, y2)
  }

  // Pontos nos extremos + payback (não em todos pra não poluir)
  const drawPoint = (i: number, color: [number, number, number]) => {
    if (i < 0 || i >= flow.length) return
    doc.setFillColor(...color)
    doc.circle(xs(i), ys(flow[i].cumulative), 1.2, 'F')
    doc.setFillColor(255, 255, 255)
    doc.circle(xs(i), ys(flow[i].cumulative), 0.5, 'F')
  }
  drawPoint(0, flow[0].cumulative >= 0 ? C.pos : C.neg)
  drawPoint(flow.length - 1, flow[flow.length - 1].cumulative >= 0 ? C.pos : C.neg)

  // Anotações de início e fim — só o valor, sem label adicional pra não poluir
  const startV = flow[0].cumulative
  const endV = flow[flow.length - 1].cumulative
  setFont(doc, 'bold', 7, startV >= 0 ? C.posDark : C.negDark)
  doc.text(fmtShortCurrency(startV, cur), xs(0) + 1.5, ys(startV) + (startV >= 0 ? -2 : 5), { align: 'left' })
  setFont(doc, 'bold', 7, endV >= 0 ? C.posDark : C.negDark)
  doc.text(fmtShortCurrency(endV, cur), xs(flow.length - 1) - 1.5, ys(endV) + (endV >= 0 ? -2 : 5), { align: 'right' })

  // Payback marker
  if (metrics.paybackMonths != null) {
    const idx = flow.findIndex(f => f.month === metrics.paybackMonths)
    if (idx >= 0) {
      const px = xs(idx)
      doc.setDrawColor(...C.pos).setLineWidth(0.5)
      // dashed line via small segments
      for (let yy = area.y + pad.t; yy < area.y + pad.t + innerH; yy += 2.5) {
        doc.line(px, yy, px, Math.min(yy + 1.5, area.y + pad.t + innerH))
      }
      drawPoint(idx, C.pos)
      // Etiqueta
      const labelText = `Payback m${metrics.paybackMonths}`
      const labelW = doc.getTextWidth(labelText) + 4
      rect(doc, px - labelW / 2, area.y + pad.t - 7, labelW, 5, { fill: C.posSoft, radius: 0.6 })
      setFont(doc, 'bold', 6.5, C.posDark)
      doc.text(labelText, px, area.y + pad.t - 3.5, { align: 'center' })
    }
  }
}

function drawMonthlyBarsChart(doc: jsPDF, opts: ExportInput, area: { x: number; y: number; w: number; h: number }) {
  const { roi, metrics } = opts
  const flow = metrics.monthlyFlow
  if (flow.length === 0) return
  const cur = roi.currency

  const pad = { l: 22, r: 6, t: 12, b: 16 }
  const innerW = area.w - pad.l - pad.r
  const innerH = area.h - pad.t - pad.b
  const xs = (i: number) => area.x + pad.l + (i + 0.5) * (innerW / flow.length)
  const max2 = Math.max(...flow.map(f => Math.max(f.inflow, f.outflow + f.investment)), 1)

  // Grid Y
  for (let i = 0; i <= 4; i++) {
    const v = max2 * (1 - i / 4)
    const y = area.y + pad.t + (i / 4) * innerH
    doc.setDrawColor(...C.hairline).setLineWidth(0.15)
    doc.line(area.x + pad.l, y, area.x + pad.l + innerW, y)
    setFont(doc, 'normal', 7, C.muted)
    doc.text(fmtShortCurrency(v, cur), area.x + pad.l - 1.5, y + 1.2, { align: 'right' })
  }
  doc.setDrawColor(...C.muted).setLineWidth(0.4)
  doc.line(area.x + pad.l, area.y + pad.t + innerH, area.x + pad.l + innerW, area.y + pad.t + innerH)

  // X-axis — todos meses
  flow.forEach((f, i) => {
    setFont(doc, 'normal', 6.5, C.muted)
    doc.text(`m${f.month}`, xs(i), area.y + pad.t + innerH + 5, { align: 'center' })
  })

  const slotW = innerW / flow.length
  const barW = Math.min(2.6, (slotW - 0.8) / 3)
  const yBase = area.y + pad.t + innerH
  flow.forEach((f, i) => {
    const cx = xs(i)
    if (f.inflow > 0) {
      const h = (f.inflow / max2) * innerH
      rect(doc, cx - barW * 1.5 - 0.4, yBase - h, barW, h, { fill: C.pos, radius: 0.3 })
    }
    if (f.outflow > 0) {
      const h = (f.outflow / max2) * innerH
      rect(doc, cx - barW / 2, yBase - h, barW, h, { fill: C.neg, radius: 0.3 })
    }
    if (f.investment > 0) {
      const h = (f.investment / max2) * innerH
      rect(doc, cx + barW / 2 + 0.4, yBase - h, barW, h, { fill: C.inv, radius: 0.3 })
    }
  })
}

// ───────────────────────── PÁGINAS — Charts ─────────────────────────
function drawChartsPages(doc: jsPDF, opts: ExportInput) {
  const flow = opts.metrics.monthlyFlow
  if (flow.length === 0) return

  // ── Página: Saldo acumulado ──
  doc.addPage()
  drawSectionHeader(doc, '02', 'Fluxo de caixa', 'Trajetória do saldo acumulado e composição mensal')

  setFont(doc, 'bold', 12, C.ink)
  doc.text('Saldo acumulado', M.left, 58)
  setFont(doc, 'normal', 9, C.muted)
  doc.text('Em verde quando positivo, em vermelho quando negativo. O marker indica o mês de payback.', M.left, 64)

  drawCumulativeChart(doc, opts, {
    x: M.left, y: 68,
    w: PAGE_PORTRAIT.w - M.left - M.right,
    h: 95,
  })

  // ── Página: Fluxo mensal ──
  setFont(doc, 'bold', 12, C.ink)
  doc.text('Fluxo mensal por origem', M.left, 180)
  setFont(doc, 'normal', 9, C.muted)
  doc.text('Receita (verde), custo (vermelho) e investimento (azul) por mês.', M.left, 186)

  // Legenda
  const legendY = 192
  const drawLegend = (x: number, color: [number, number, number], label: string) => {
    rect(doc, x, legendY - 2.5, 3, 3, { fill: color, radius: 0.5 })
    setFont(doc, 'normal', 8, C.body)
    doc.text(label, x + 4, legendY)
  }
  drawLegend(M.left,        C.pos, 'Receita')
  drawLegend(M.left + 26,   C.neg, 'Custo')
  drawLegend(M.left + 50,   C.inv, 'Investimento')

  drawMonthlyBarsChart(doc, opts, {
    x: M.left, y: 198,
    w: PAGE_PORTRAIT.w - M.left - M.right,
    h: 70,
  })
}

// ───────────────────────── PÁGINAS — Lançamentos ─────────────────────────
function drawEntries(doc: jsPDF, opts: ExportInput) {
  const { roi, entries, categoryById, itemsById } = opts
  const cur = roi.currency
  const dur = roi.durationMonths || 12
  if (entries.length === 0) return

  doc.addPage()
  drawSectionHeader(doc, '03', 'Lançamentos', `${entries.length} ${entries.length > 1 ? 'itens' : 'item'} agrupados por categoria`)

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

  let y = 56
  const order: Record<string, number> = { INCOME: 0, MIXED: 1, EXPENSE: 2, INVESTMENT: 3 }
  const sorted = Array.from(groups.entries()).sort(
    (a, b) => (order[a[1].family] - order[b[1].family]) || Math.abs(b[1].total) - Math.abs(a[1].total),
  )

  for (const [, g] of sorted) {
    const accent = g.family === 'INCOME' ? C.pos : g.family === 'INVESTMENT' ? C.inv : C.neg
    const accentSoft = g.family === 'INCOME' ? C.posSoft : g.family === 'INVESTMENT' ? C.invSoft : C.negSoft

    // Card de categoria — header bem distinto
    rect(doc, M.left, y, PAGE_PORTRAIT.w - M.left - M.right, 11, {
      fill: accentSoft, radius: 1.5,
    })
    rect(doc, M.left, y, 1.8, 11, { fill: accent })
    setFont(doc, 'bold', 11, C.ink)
    doc.text(g.name, M.left + 5, y + 7)
    setFont(doc, 'normal', 7.5, C.muted)
    doc.text(`${g.items.length} item${g.items.length > 1 ? 's' : ''} |${g.family.toLowerCase()}`, M.left + 5 + doc.getTextWidth(g.name) + 4, y + 7)
    setFont(doc, 'bold', 11, g.total >= 0 ? C.posDark : C.negDark)
    const sign = g.total >= 0 ? '+' : '-'
    doc.text(`${sign}${formatCurrency(Math.abs(g.total), cur)}`, PAGE_PORTRAIT.w - M.right - 3, y + 7, { align: 'right' })
    y += 13

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
        suf === 'INSTALLMENT' && e.installments ? `m${start} (${e.installments}x)`
        : suf === 'MONTHLY' ? `m${start} a m${dur}`
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
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: C.hairline, lineWidth: 0.1, textColor: C.body },
      headStyles: { fontStyle: 'bold', textColor: C.muted, fontSize: 7, fillColor: C.surface, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      columnStyles: {
        0: { cellWidth: 68, fontStyle: 'bold', textColor: C.ink },
        1: { halign: 'right', cellWidth: 16 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'center', cellWidth: 14 },
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
    y = (doc.lastAutoTable.finalY ?? y) + 7

    if (y > PAGE_PORTRAIT.h - 32) {
      doc.addPage()
      drawSectionHeader(doc, '03', 'Lançamentos (continuação)', '')
      y = 56
    }
  }
}

// ───────────────────────── PÁGINA — Matriz mensal (LANDSCAPE) ─────────────────────────
function drawMonthlyMatrix(doc: jsPDF, opts: ExportInput) {
  const { roi, entries, categoryById } = opts
  const cur = roi.currency
  const dur = roi.durationMonths || 12
  if (entries.length === 0) return

  doc.addPage('a4', 'landscape')
  drawSectionHeader(doc, '04', 'Fluxo mensal por categoria',
    'Heatmap proporcional ao valor absoluto. Receitas em verde, custos/investimentos em vermelho.')

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

  const allVals = cols.flatMap(c => c.perMonth.map(v => Math.abs(v)))
  const sortedVals = allVals.filter(v => v > 0).sort((a, b) => a - b)
  const p95 = sortedVals.length > 0 ? sortedVals[Math.floor(sortedVals.length * 0.95)] : 1

  const head = ['Mês', ...cols.map(c => c.name), 'Líquido', 'Acumulado']
  const body = Array.from({ length: dur }, (_, i) => {
    const isPayback = payback === i + 1
    const monthCell = isPayback
      ? { content: `m${i + 1} *`, styles: { fontStyle: 'bold' as const, fillColor: C.posSoft, textColor: C.posDark } }
      : { content: `m${i + 1}`, styles: { fontStyle: 'bold' as const } }
    const row: any[] = [
      monthCell,
      ...cols.map(c => {
        const v = c.perMonth[i]
        if (v === 0) return { content: '—', styles: { textColor: C.mutedLight, halign: 'center' as const } }
        const intensity = Math.min(1, Math.abs(v) / p95)
        const tone = v > 0 ? C.posSoft : C.negSoft
        const text = v > 0 ? C.posDark : C.negDark
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
    startY: 50,
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
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: C.hairline, lineWidth: 0.1 },
    headStyles: { fillColor: C.surface, textColor: C.muted, fontStyle: 'bold', halign: 'center', fontSize: 7.5, lineWidth: 0.2 },
    columnStyles: { 0: { halign: 'center', cellWidth: 16, fontStyle: 'bold' } },
    margin: { left: M.left, right: M.right },
  })
}

// ───────────────────────── Função pública ─────────────────────────
export async function exportRoiToPdf(input: ExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const logo = await ensureRasterLogo(input.tenantLogoDataUrl)

  drawCover(doc, input, logo)
  drawExecutiveSummary(doc, input)
  drawChartsPages(doc, input)
  drawEntries(doc, input)
  drawMonthlyMatrix(doc, input)

  // Header + footer em todas as páginas exceto capa.
  // Detecta orientação por largura da página (jsPDF: getPageInfo retorna pageInfo.pageContext.mediaBox)
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    if (i === 1) continue  // capa tem cabeçalho próprio
    const w = doc.internal.pageSize.getWidth()
    const isLandscape = w > 250
    drawHeader(doc, input, logo, isLandscape)
    drawFooter(doc, input, i, total, isLandscape)
  }

  const slug = input.roi.name.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')
  doc.save(`roi-${slug}-v${input.roi.version}.pdf`)
}
