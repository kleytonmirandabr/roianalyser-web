import { Grid3x3, Map as MapIcon, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCatalog } from '@/features/catalogs/hooks/use-catalog'
import { financialSummaries } from '@/features/dashboard/lib/aggregations'
import {
  BR_GEO_BY_UF,
  BR_GEO_HEIGHT,
  BR_GEO_LOCATIONS,
  BR_GEO_WIDTH,
  pathCentroid,
} from '@/features/dashboard/lib/br-geo'
import {
  BR_GRID_HEIGHT,
  BR_GRID_WIDTH,
  BR_STATE_BY_UF,
  BR_TILE_MAP,
} from '@/features/dashboard/lib/br-tile-map'
import { formatCurrency } from '@/features/projects/lib/money'
import type { Project } from '@/features/projects/types'
import { cn } from '@/shared/lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

type StateBucket = {
  state: string
  count: number
  totalRevenue: number
  wonCount: number
}

type MapMode = 'geo' | 'tile'
const MAP_MODE_KEY = 'planflow.dashboard.geoMapMode'

/**
 * Distribuição geográfica das oportunidades, agrupando projetos pelo estado
 * da empresa cliente. Usa o catálogo `companies` pra resolver state.
 *
 * V2: dois modos de visualização — `geo` (paths SVG reais dos 27 estados,
 * formas geográficas do IBGE) e `tile` (grid de quadrados estilo NYT). User
 * alterna no header do widget e a preferência persiste no localStorage.
 *
 * Drill-down opcional: quando `onStateClick` é passado pelo Dashboard,
 * clicar num estado emite o UF — Dashboard usa pra filtrar a lista.
 */
export function GeoDistribution({
  projects,
  onStateClick,
}: {
  projects: Project[]
  onStateClick?: (uf: string) => void
}) {
  const { t } = useTranslation()
  const companies = useCatalog('companies')
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    if (typeof window === 'undefined') return 'geo'
    const stored = window.localStorage.getItem(MAP_MODE_KEY)
    return stored === 'tile' ? 'tile' : 'geo'
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(MAP_MODE_KEY, mapMode)
  }, [mapMode])

  const buckets = useMemo<StateBucket[]>(() => {
    const map = new Map<string, StateBucket>()
    const summaries = financialSummaries(projects)
    const summaryByProject = new Map(summaries.map((s) => [s.project.id, s]))
    const companyByName = new Map(
      (companies.data ?? [])
        .filter((c) => typeof c.name === 'string')
        .map((c) => [String(c.name).toLowerCase().trim(), c]),
    )

    for (const p of projects) {
      const payload = (p.payload ?? {}) as Record<string, unknown>
      let state = ''
      if (typeof payload.clientState === 'string') {
        state = payload.clientState
      } else if (typeof payload.state === 'string') {
        state = payload.state
      } else {
        const clientName =
          typeof p.clientName === 'string'
            ? p.clientName
            : typeof payload.clientName === 'string'
              ? payload.clientName
              : ''
        const company = clientName
          ? companyByName.get(clientName.toLowerCase().trim())
          : undefined
        if (company && typeof company.state === 'string') {
          state = company.state
        }
      }
      if (!state) state = '—'
      const key = state.toUpperCase().slice(0, 2)
      const bucket = map.get(key) ?? {
        state: key,
        count: 0,
        totalRevenue: 0,
        wonCount: 0,
      }
      bucket.count++
      const summary = summaryByProject.get(p.id)
      if (summary) bucket.totalRevenue += summary.totalRevenue
      // detecção heurística de "won" pelo nome do status
      if (p.status?.toLowerCase().includes('ganho') || p.status?.toLowerCase().includes('won')) {
        bucket.wonCount++
      }
      map.set(key, bucket)
    }
    return [...map.values()]
      .sort((a, b) => b.totalRevenue - a.totalRevenue || b.count - a.count)
      .slice(0, 12)
  }, [projects, companies.data])

  if (buckets.length === 0 || (buckets.length === 1 && buckets[0].state === '—')) {
    return null
  }

  const maxRevenue = buckets.reduce((m, b) => Math.max(m, b.totalRevenue), 0)
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0)
  const tenantCurrency = projects[0]?.currency ?? 'BRL'

  // Indexa por UF pra o tile map render rápido.
  const bucketByUf = new Map(buckets.map((b) => [b.state, b]))
  // Detecta se a maioria dos buckets são UFs brasileiras conhecidas — se
  // sim, mostra o tile map. Caso contrário (tenants internacionais), volta
  // pra lista vertical.
  const knownUfs = buckets.filter((b) => BR_STATE_BY_UF.has(b.state)).length
  const showMap = knownUfs >= Math.max(1, Math.floor(buckets.length / 2))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              {t('dashboard.geoTitle')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.geoDesc')}
            </p>
          </div>
          {showMap && (
            <div
              role="tablist"
              aria-label={t('dashboard.geoMapMode.label')}
              className="inline-flex shrink-0 rounded-md border border-border bg-muted/40 p-0.5 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mapMode === 'geo'}
                onClick={() => setMapMode('geo')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors',
                  mapMode === 'geo'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title={t('dashboard.geoMapMode.geo')}
              >
                <MapIcon className="h-3.5 w-3.5" />
                <span>{t('dashboard.geoMapMode.geo')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mapMode === 'tile'}
                onClick={() => setMapMode('tile')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors',
                  mapMode === 'tile'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title={t('dashboard.geoMapMode.tile')}
              >
                <Grid3x3 className="h-3.5 w-3.5" />
                <span>{t('dashboard.geoMapMode.tile')}</span>
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showMap ? (
          mapMode === 'geo' ? (
            <BrazilGeoMap
              bucketByUf={bucketByUf}
              maxRevenue={maxRevenue}
              currency={tenantCurrency}
              onStateClick={onStateClick}
            />
          ) : (
            <BrazilTileMap
              bucketByUf={bucketByUf}
              maxRevenue={maxRevenue}
              currency={tenantCurrency}
              onStateClick={onStateClick}
            />
          )
        ) : (
          <div className="space-y-1.5">
            {buckets.map((b) => {
              const revPct = maxRevenue > 0 ? (b.totalRevenue / maxRevenue) * 100 : 0
              const countPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0
              const intensity = Math.max(20, revPct)
              return (
                <div
                  key={b.state}
                  className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <span className="font-mono text-sm font-bold text-foreground">
                    {b.state}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t('dashboard.geoLabel.count', { count: b.count })}
                        {b.wonCount > 0 && (
                          <span className="ml-1 text-emerald-600">
                            · {b.wonCount} ganhos
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-foreground font-medium">
                        {formatCurrency(b.totalRevenue, tenantCurrency)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          revPct > 0 ? 'bg-primary' : 'bg-muted-foreground/30',
                        )}
                        style={{
                          width: `${revPct}%`,
                          opacity: 0.5 + intensity / 200,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {countPct.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Tile map SVG do Brasil. Cada UF é um quadrado com:
 *  - cor proporcional a totalRevenue (rgb(79,70,229) = primary)
 *  - sigla centralizada
 *  - hover destaca + mostra tooltip com count e valor
 *  - estados sem nenhum projeto aparecem em cinza claro
 */
function BrazilTileMap({
  bucketByUf,
  maxRevenue,
  currency,
  onStateClick,
}: {
  bucketByUf: Map<string, StateBucket>
  maxRevenue: number
  currency: string
  onStateClick?: (uf: string) => void
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<string | null>(null)

  // Tile config — escolhido pra caber numa coluna média (~480px).
  const TILE = 44
  const GAP = 4
  const VB_W = BR_GRID_WIDTH * (TILE + GAP)
  const VB_H = BR_GRID_HEIGHT * (TILE + GAP)

  const hoveredBucket = hovered ? bucketByUf.get(hovered) ?? null : null
  const hoveredState = hovered ? BR_STATE_BY_UF.get(hovered) ?? null : null

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full max-w-2xl mx-auto"
        role="img"
        aria-label={t('dashboard.geoTitle')}
      >
        {BR_TILE_MAP.map((s) => {
          const bucket = bucketByUf.get(s.uf)
          const x = s.x * (TILE + GAP)
          const y = s.y * (TILE + GAP)
          // Intensidade — 0 quando sem projetos, escala suave até 1.
          const intensity =
            !bucket || maxRevenue === 0 ? 0 : Math.max(0.15, bucket.totalRevenue / maxRevenue)
          const isHovered = hovered === s.uf
          const clickable = !!onStateClick && !!bucket
          return (
            <g
              key={s.uf}
              onMouseEnter={() => setHovered(s.uf)}
              onMouseLeave={() => setHovered((h) => (h === s.uf ? null : h))}
              onClick={() => clickable && onStateClick?.(s.uf)}
              className={clickable ? 'cursor-pointer' : 'cursor-default'}
            >
              <rect
                x={x}
                y={y}
                width={TILE}
                height={TILE}
                rx={4}
                fill={
                  bucket
                    ? `rgb(79 70 229 / ${intensity})`
                    : 'hsl(var(--muted))'
                }
                stroke={isHovered ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                strokeWidth={isHovered ? 2 : 1}
              />
              <text
                x={x + TILE / 2}
                y={y + TILE / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                className={cn(
                  'pointer-events-none select-none transition-colors',
                  bucket && intensity > 0.5
                    ? 'fill-primary-foreground'
                    : 'fill-foreground',
                )}
              >
                {s.uf}
              </text>
              {bucket && (
                <text
                  x={x + TILE / 2}
                  y={y + TILE - 6}
                  textAnchor="middle"
                  fontSize={9}
                  className={cn(
                    'pointer-events-none select-none tabular-nums',
                    intensity > 0.5
                      ? 'fill-primary-foreground/80'
                      : 'fill-muted-foreground',
                  )}
                >
                  {bucket.count}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hoveredBucket && hoveredState ? (
        <div className="rounded-md border border-border bg-card p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-foreground">
              {hoveredState.name} ({hoveredState.uf})
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {formatCurrency(hoveredBucket.totalRevenue, currency)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('dashboard.geoLabel.count', { count: hoveredBucket.count })}
            {hoveredBucket.wonCount > 0 &&
              ` · ${hoveredBucket.wonCount} ${t('dashboard.geoLabel.won')}`}
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t('dashboard.geoLabel.hover')}
        </p>
      )}
    </div>
  )
}

/**
 * Mapa SVG real do Brasil — paths topojson dos 27 estados + DF.
 *
 * Mesma lógica de cor/hover/tooltip do tile map, mas renderiza formas
 * geográficas reais. Útil quando o usuário quer enxergar a distribuição
 * espacial verdadeira (Sul/Sudeste compactos, Norte/Centro-Oeste
 * extensos), em vez do grid uniforme do tile map.
 *
 * Tradeoffs vs tile map:
 *   - Estados pequenos (DF, ES, AL, SE, RJ) ficam com label minúsculo —
 *     resolvemos com `pathCentroid` calculado por UF e fontSize adaptativo.
 *   - Bundle: +~25 KB gzipped por causa dos paths embutidos. Aceitável
 *     pra um dashboard que só carrega quando user navega pra ele.
 *   - Performance: 27 paths renderizam fácil <16ms; sem perceptível.
 */
function BrazilGeoMap({
  bucketByUf,
  maxRevenue,
  currency,
  onStateClick,
}: {
  bucketByUf: Map<string, StateBucket>
  maxRevenue: number
  currency: string
  onStateClick?: (uf: string) => void
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<string | null>(null)

  // Centroides (cx, cy) por UF — calculados uma vez, usados pra
  // posicionar a sigla. `useMemo` pra não recalcular em cada render.
  const centroids = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number }>()
    for (const loc of BR_GEO_LOCATIONS) {
      const c = pathCentroid(loc.path)
      if (c) map.set(loc.uf, c)
    }
    return map
  }, [])

  const hoveredBucket = hovered ? bucketByUf.get(hovered) ?? null : null
  const hoveredLocation = hovered ? BR_GEO_BY_UF.get(hovered) ?? null : null

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${BR_GEO_WIDTH} ${BR_GEO_HEIGHT}`}
        className="w-full max-w-2xl mx-auto"
        role="img"
        aria-label={t('dashboard.geoTitle')}
      >
        {/* Paths dos estados */}
        {BR_GEO_LOCATIONS.map((loc) => {
          const bucket = bucketByUf.get(loc.uf)
          const intensity =
            !bucket || maxRevenue === 0
              ? 0
              : Math.max(0.18, bucket.totalRevenue / maxRevenue)
          const isHovered = hovered === loc.uf
          const clickable = !!onStateClick && !!bucket
          return (
            <path
              key={loc.uf}
              d={loc.path}
              fill={
                bucket
                  ? `rgb(79 70 229 / ${intensity})`
                  : 'hsl(var(--muted))'
              }
              stroke={
                isHovered ? 'hsl(var(--primary))' : 'hsl(var(--border))'
              }
              strokeWidth={isHovered ? 1.5 : 0.8}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => setHovered(loc.uf)}
              onMouseLeave={() =>
                setHovered((h) => (h === loc.uf ? null : h))
              }
              onClick={() => clickable && onStateClick?.(loc.uf)}
              tabIndex={clickable ? 0 : -1}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onStateClick?.(loc.uf)
                }
              }}
              className={cn(
                'transition-colors focus:outline-none',
                clickable && 'cursor-pointer focus:stroke-primary',
              )}
              role={clickable ? 'button' : undefined}
              aria-label={`${loc.name}${
                bucket
                  ? `, ${bucket.count} ${t('dashboard.geoLabel.shortCount', {
                      defaultValue: 'projetos',
                    })}`
                  : ''
              }`}
            >
              <title>
                {loc.name} ({loc.uf})
                {bucket
                  ? ` — ${bucket.count} · ${formatCurrency(
                      bucket.totalRevenue,
                      currency,
                    )}`
                  : ''}
              </title>
            </path>
          )
        })}

        {/* Labels: sigla UF no centroide. fontSize adaptativo por estado
            — pequenos (DF, RJ, SE, AL) ganham label menor; grandes (AM,
            MT, PA, BA) usam padrão. Renderizado depois dos paths pra
            ficar por cima. */}
        {BR_GEO_LOCATIONS.map((loc) => {
          const c = centroids.get(loc.uf)
          if (!c) return null
          const bucket = bucketByUf.get(loc.uf)
          const intensity =
            !bucket || maxRevenue === 0
              ? 0
              : Math.max(0.18, bucket.totalRevenue / maxRevenue)
          // Estados visualmente menores: usar fontSize 9 em vez de 12.
          const small = ['DF', 'RJ', 'SE', 'AL', 'ES', 'PB', 'RN'].includes(
            loc.uf,
          )
          return (
            <text
              key={`label-${loc.uf}`}
              x={c.cx}
              y={c.cy + (small ? 3 : 4)}
              textAnchor="middle"
              fontSize={small ? 9 : 12}
              fontWeight={600}
              className={cn(
                'pointer-events-none select-none',
                bucket && intensity > 0.5
                  ? 'fill-primary-foreground'
                  : 'fill-foreground',
              )}
            >
              {loc.uf}
            </text>
          )
        })}
      </svg>
      {hoveredBucket && hoveredLocation ? (
        <div className="rounded-md border border-border bg-card p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-foreground">
              {hoveredLocation.name} ({hoveredLocation.uf})
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {formatCurrency(hoveredBucket.totalRevenue, currency)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('dashboard.geoLabel.count', { count: hoveredBucket.count })}
            {hoveredBucket.wonCount > 0 &&
              ` · ${hoveredBucket.wonCount} ${t('dashboard.geoLabel.won')}`}
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {onStateClick
            ? t('dashboard.geoLabel.hoverClick', {
                defaultValue:
                  'Passe o mouse pra ver detalhes — clique pra filtrar projetos.',
              })
            : t('dashboard.geoLabel.hover')}
        </p>
      )}
    </div>
  )
}
