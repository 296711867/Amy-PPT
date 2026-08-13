import { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { Activity, ArrowDownToLine, ArrowUpFromLine, Coins, RefreshCw } from 'lucide-react'
import type { ModelUsagePeriod, ModelUsageStats } from '@shared/model-usage'
import { ipc } from '../../lib/ipc'
import { useLang } from '../../i18n'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../ui/Button'
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs'

type UsageChartPalette = {
  series: string[]
  grid: string
  text: string
  mutedText: string
  surface: string
  tooltip: string
  tooltipText: string
  tooltipMuted: string
}

const CHART_FALLBACK: UsageChartPalette = {
  series: ['#5d6b4d', '#8fbc8f', '#c8b89e', '#d4e4c1', '#3e4a32', '#a8b89a'],
  grid: 'rgb(93 107 77 / 10%)',
  text: '#3e4a32',
  mutedText: '#6f765f',
  surface: '#fffaf0',
  tooltip: '#3e4a32',
  tooltipText: '#f5f1e8',
  tooltipMuted: '#d4e4c1'
}

const readUsageChartPalette = (): UsageChartPalette => {
  if (typeof document === 'undefined') return CHART_FALLBACK
  const styles = window.getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback

  return {
    series: CHART_FALLBACK.series.map((fallback, index) =>
      read(`--ui-chart-${index + 1}`, fallback)
    ),
    grid: read('--ui-chart-grid', CHART_FALLBACK.grid),
    text: read('--ui-text', CHART_FALLBACK.text),
    mutedText: read('--ui-text-tertiary', CHART_FALLBACK.mutedText),
    surface: read('--ui-surface-solid', CHART_FALLBACK.surface),
    tooltip: read('--ui-chart-tooltip', CHART_FALLBACK.tooltip),
    tooltipText: read('--ui-chart-tooltip-text', CHART_FALLBACK.tooltipText),
    tooltipMuted: read('--ui-chart-tooltip-muted', CHART_FALLBACK.tooltipMuted)
  }
}

const formatTokens = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

export function TokenUsageDashboard(): React.JSX.Element {
  const { t } = useLang()
  const uiTheme = useSettingsStore((state) => state.settings?.theme)
  const chartPalette = useMemo(readUsageChartPalette, [uiTheme])
  const [period, setPeriod] = useState<ModelUsagePeriod>('30d')
  const [stats, setStats] = useState<ModelUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const modelCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const hourlyCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [todayStats, setTodayStats] = useState<ModelUsageStats | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void ipc
      .getModelUsage(period)
      .then((result) => {
        if (active) setStats(result)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : t('settings.usageLoadFailed'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [period, refreshKey, t])

  useEffect(() => {
    let active = true
    void ipc
      .getModelUsage('today')
      .then((result) => {
        if (active) setTodayStats(result)
      })
      .catch(() => {
        /* hourly panel is supplementary, ignore errors */
      })
    return () => {
      active = false
    }
  }, [refreshKey])

  const modelRows = useMemo(() => stats?.byModel.slice(0, 8) || [], [stats])
  const modelMax = useMemo(
    () => modelRows.reduce((max, item) => Math.max(max, item.totalTokens), 0) || 1,
    [modelRows]
  )

  const totalTokens = stats?.totals.totalTokens || 0
  const inputTokens = stats?.totals.inputTokens || 0
  const outputTokens = stats?.totals.outputTokens || 0
  const callCount = stats?.totals.callCount || 0

  const statCards = [
    {
      label: t('settings.usageTotalTokens'),
      value: totalTokens,
      icon: Coins,
      bg: 'bg-[var(--ui-feature-surface-1)]',
      iconBg: 'bg-[var(--ui-feature-accent-1)]'
    },
    {
      label: t('settings.usageInputTokens'),
      value: inputTokens,
      icon: ArrowDownToLine,
      bg: 'bg-[var(--ui-feature-surface-2)]',
      iconBg: 'bg-[var(--ui-feature-accent-2)]'
    },
    {
      label: t('settings.usageOutputTokens'),
      value: outputTokens,
      icon: ArrowUpFromLine,
      bg: 'bg-[var(--ui-feature-surface-3)]',
      iconBg: 'bg-[var(--ui-feature-accent-3)]'
    },
    {
      label: t('settings.usageCalls'),
      value: callCount,
      icon: Activity,
      bg: 'bg-[var(--ui-feature-surface-4)]',
      iconBg: 'bg-[var(--ui-feature-accent-4)]'
    }
  ]

  useEffect(() => {
    const canvas = trendCanvasRef.current
    if (!canvas || !stats) return
    const totals = stats.byDay.map((item) => item.totalTokens)
    const chart = new Chart(canvas, {
      data: {
        labels: stats.byDay.map((item) => item.date.slice(5)),
        datasets: [
          {
            type: 'bar',
            label: t('settings.usageInputTokens'),
            data: stats.byDay.map((item) => item.inputTokens),
            backgroundColor: chartPalette.series[1],
            borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            stack: 'tokens',
            maxBarThickness: 26,
            yAxisID: 'y',
            order: 2
          },
          {
            type: 'bar',
            label: t('settings.usageOutputTokens'),
            data: stats.byDay.map((item) => item.outputTokens),
            backgroundColor: chartPalette.series[2],
            borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            stack: 'tokens',
            maxBarThickness: 26,
            yAxisID: 'y',
            order: 3
          },
          {
            type: 'line',
            label: t('settings.usageTotalTokens'),
            data: totals,
            borderColor: chartPalette.series[0],
            backgroundColor: chartPalette.series[0],
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: chartPalette.series[0],
            pointHoverBorderColor: chartPalette.surface,
            pointHoverBorderWidth: 2,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              padding: 10,
              color: chartPalette.text,
              font: { size: 10 }
            }
          },
          tooltip: {
            backgroundColor: chartPalette.tooltip,
            padding: 10,
            cornerRadius: 10,
            titleColor: chartPalette.tooltipText,
            bodyColor: chartPalette.tooltipMuted,
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${Number(context.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: chartPalette.mutedText, font: { size: 11 } },
            border: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: (value) => formatTokens(Number(value)),
              color: chartPalette.mutedText,
              font: { size: 11 }
            },
            grid: { color: chartPalette.grid },
            border: { display: false }
          },
          y1: {
            stacked: false,
            beginAtZero: true,
            display: false,
            max: Math.max(...totals, 1) * 1.15
          }
        }
      }
    })
    return () => chart.destroy()
  }, [chartPalette, stats, t])

  useEffect(() => {
    const canvas = modelCanvasRef.current
    if (!canvas || modelRows.length === 0) return
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: modelRows.map((item) => item.model),
        datasets: [
          {
            data: modelRows.map((item) => item.totalTokens),
            backgroundColor: modelRows.map(
              (_, index) => chartPalette.series[index % chartPalette.series.length]
            ),
            borderColor: chartPalette.surface,
            borderWidth: 3,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chartPalette.tooltip,
            padding: 10,
            cornerRadius: 10,
            titleColor: chartPalette.tooltipText,
            bodyColor: chartPalette.tooltipMuted,
            callbacks: {
              label: (context) => `${context.label}: ${formatTokens(Number(context.raw))}`
            }
          }
        }
      }
    })
    return () => chart.destroy()
  }, [chartPalette, modelRows])

  useEffect(() => {
    const canvas = hourlyCanvasRef.current
    const hours = todayStats?.byHour
    if (!canvas || !Array.isArray(hours) || hours.length === 0) return
    const ctx = canvas.getContext('2d')
    const makeFill = (color: string) => {
      if (!ctx) return `${color}22`
      const gradient = ctx.createLinearGradient(0, 0, 0, 200)
      gradient.addColorStop(0, `${color}40`)
      gradient.addColorStop(1, `${color}00`)
      return gradient
    }
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: hours.map((item) => `${String(item.hour).padStart(2, '0')}:00`),
        datasets: [
          {
            label: t('settings.usageInputTokens'),
            data: hours.map((item) => item.inputTokens),
            borderColor: chartPalette.series[0],
            backgroundColor: makeFill(chartPalette.series[0]),
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: chartPalette.series[0],
            pointHoverBorderColor: chartPalette.surface,
            pointHoverBorderWidth: 2
          },
          {
            label: t('settings.usageOutputTokens'),
            data: hours.map((item) => item.outputTokens),
            borderColor: chartPalette.series[1],
            backgroundColor: makeFill(chartPalette.series[1]),
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: chartPalette.series[1],
            pointHoverBorderColor: chartPalette.surface,
            pointHoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              padding: 10,
              color: chartPalette.text,
              font: { size: 10 }
            }
          },
          tooltip: {
            backgroundColor: chartPalette.tooltip,
            padding: 10,
            cornerRadius: 10,
            titleColor: chartPalette.tooltipText,
            bodyColor: chartPalette.tooltipMuted,
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${Number(context.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: chartPalette.mutedText,
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatTokens(Number(value)),
              color: chartPalette.mutedText,
              font: { size: 10 }
            },
            grid: { color: chartPalette.grid },
            border: { display: false }
          }
        }
      }
    })
    return () => chart.destroy()
  }, [chartPalette, todayStats, t])

  const periods: Array<{ value: ModelUsagePeriod; label: string }> = [
    { value: '7d', label: t('settings.usagePeriod7d') },
    { value: '30d', label: t('settings.usagePeriod30d') },
    { value: 'all', label: t('settings.usagePeriodAll') }
  ]

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-primary">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t('settings.usageLoading')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={period} onValueChange={(value) => setPeriod(value as ModelUsagePeriod)}>
          <TabsList className="min-h-9 px-1">
            {periods.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="h-7 px-3.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setRefreshKey((value) => value + 1)}
          className="h-8 text-primary hover:text-foreground"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('settings.usageRefresh')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/35 bg-[var(--ui-danger-soft)] p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={`group relative overflow-hidden rounded-lg border border-border ${card.bg} p-5 text-foreground shadow-[0_14px_34px_rgb(var(--ui-shadow-color)/0.1)] transition-[border-color,filter,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--ui-border-strong)] hover:brightness-[1.03]`}
            >
              <div className="relative flex items-start justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg} text-[var(--ui-feature-on-accent)] shadow-[0_8px_18px_rgb(var(--ui-shadow-color)/0.16)]`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="relative mt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {card.label}
                </p>
                <p className="organic-serif mt-1.5 text-[24px] font-semibold leading-none text-foreground">
                  {card.value.toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="soft-card rounded-lg bg-card p-5">
        <h3 className="organic-serif mb-3 text-base font-semibold text-foreground">
          {t('settings.usageTodayHourly')}
        </h3>
        <div className="h-[clamp(200px,20vw,320px)]">
          {todayStats?.byHour?.some((item) => item.callCount > 0) ? (
            <canvas ref={hourlyCanvasRef} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('settings.usageEmpty')}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <div className="soft-card flex h-full flex-col rounded-lg bg-card p-5">
          <h3 className="organic-serif mb-3 text-base font-semibold text-foreground">
            {t('settings.usageTrend')}
          </h3>
          <div className="min-h-[240px] flex-1">
            {stats?.byDay.length ? (
              <canvas ref={trendCanvasRef} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('settings.usageEmpty')}
              </div>
            )}
          </div>
        </div>

        <div className="soft-card rounded-lg bg-card p-5">
          <h3 className="organic-serif mb-3 text-base font-semibold text-foreground">
            {t('settings.usageByModel')}
          </h3>
          {modelRows.length ? (
            <>
              <div className="mx-auto h-[140px] max-w-[180px]">
                <canvas ref={modelCanvasRef} />
              </div>
              <div className="mt-3 space-y-2">
                {modelRows.map((item, index) => {
                  const color = chartPalette.series[index % chartPalette.series.length]
                  const barPct = (item.totalTokens / modelMax) * 100
                  return (
                    <div key={`${item.provider}:${item.model}`}>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className="min-w-0 flex-1 truncate text-foreground"
                          title={`${item.provider} / ${item.model}`}
                        >
                          {item.model}
                        </span>
                        <span className="tabular-nums text-primary">
                          {formatTokens(item.totalTokens)}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barPct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              {t('settings.usageEmpty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
