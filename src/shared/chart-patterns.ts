/**
 * 图表模式召回库（改编自 ppt-master 的 chart template recall）：
 * 用"内容语义标签 → 图表模式"的召回替代让模型凭空选图表类型。
 * 每个模式绑定 Chart.js 类型与配置骨架，是图表选型的唯一事实来源，
 * 供 search_chart_patterns 工具与 amy-ppt-chart 技能共用。
 */

export type ChartPatternId =
  | 'bar-compare'
  | 'grouped-bar-compare'
  | 'stacked-bar-composition'
  | 'hbar-ranking'
  | 'line-trend'
  | 'multi-line-trend'
  | 'area-trend'
  | 'donut-share'
  | 'pie-share'
  | 'funnel-stages'
  | 'scatter-correlation'
  | 'bubble-three-var'
  | 'radar-multidim'
  | 'combo-bar-line'
  | 'bullet-target'
  | 'waterfall-bridge'
  | 'sparkline-mini'

export interface ChartPattern {
  id: ChartPatternId
  labelZh: string
  labelEn: string
  /** 语义标签（中英文），召回时的匹配词 */
  tags: string[]
  chartType: string
  whenToUse: string
  whenNotToUse: string
  /** Chart.js 配置骨架要点（写代码时的最小正确路径） */
  configHint: string
}

export const CHART_PATTERNS: readonly ChartPattern[] = [
  {
    id: 'bar-compare',
    labelZh: '柱状对比',
    labelEn: 'Bar comparison',
    tags: ['category comparison', 'compare categories', 'ranking', 'single metric', '对比', '比较', '排名', '排行', '各分类'],
    chartType: 'bar',
    whenToUse: '对比 2-8 个分类上的单一指标',
    whenNotToUse: '分类超过 8 个（改 hbar-ranking 或分组归并）；时间序列（用 line-trend）',
    configHint: 'type:"bar"，labels=分类，一个 dataset；关闭 legend；数值直接标注（datalabels 或 axis ticks）'
  },
  {
    id: 'grouped-bar-compare',
    labelZh: '分组柱状',
    labelEn: 'Grouped bar',
    tags: ['two series compare', 'multi series categories', 'group comparison', 'before after', '分组对比', '两个系列', '多系列对比', '前后对比'],
    chartType: 'bar',
    whenToUse: '在相同分类上对比 2-3 个系列（如本期 vs 上期、A vs B）',
    whenNotToUse: '系列超过 3 个（改 stacked-bar-composition 或拆页）；只是单系列（用 bar-compare）',
    configHint: 'type:"bar"，多个 dataset + 不同 backgroundColor；保持系列色与 deck palette 对应'
  },
  {
    id: 'stacked-bar-composition',
    labelZh: '堆叠构成',
    labelEn: 'Stacked composition',
    tags: ['part to whole', 'composition', 'breakdown', 'constituents', '构成', '占比组成', '拆解', '各部分'],
    chartType: 'bar',
    whenToUse: '展示每个分类内部的构成（部分加总等于整体）',
    whenNotToUse: '需要精确读出各部分角度（用 donut-share）；部分有正负（用 waterfall-bridge）',
    configHint: 'type:"bar" + options.scales.y.stacked=true + dataset.stack="total"；份额差异大时配百分比标注'
  },
  {
    id: 'hbar-ranking',
    labelZh: '横向排名',
    labelEn: 'Horizontal ranking',
    tags: ['long labels', 'top n', 'ranking list', 'many categories', '排名', '榜单', '长标签', 'top'],
    chartType: 'bar',
    whenToUse: '分类名较长或数量 8-15 个的排名场景',
    whenNotToUse: '只有 2-4 个短标签分类（用 bar-compare 更紧凑）',
    configHint: 'type:"bar" + options.indexAxis:"y"；按数值排序后展示；第一名可用 accent 色'
  },
  {
    id: 'line-trend',
    labelZh: '趋势折线',
    labelEn: 'Line trend',
    tags: ['time series', 'trend', 'over time', 'growth', '变化趋势', '随时间', '增长', '走势'],
    chartType: 'line',
    whenToUse: '一个指标随时间/顺序的走势（≥4 个时间点）',
    whenNotToUse: '少于 4 个点（用 bar-compare）；分类无顺序含义（用 bar-compare）',
    configHint: 'type:"line"，tension≈0.25，x 为时间标签；首末点数值必标注'
  },
  {
    id: 'multi-line-trend',
    labelZh: '多线趋势',
    labelEn: 'Multi-line trend',
    tags: ['multiple trends', 'compare trends', 'several series over time', '多条趋势', '趋势对比', '多个指标随时间'],
    chartType: 'line',
    whenToUse: '对比 2-4 条同量纲的时间趋势',
    whenNotToUse: '系列量纲不同（改 combo-bar-line 或拆两张图）；超过 4 条（合并或拆页）',
    configHint: 'type:"line"，多 dataset；只保留必要的 pointRadius；图例放图外顶部'
  },
  {
    id: 'area-trend',
    labelZh: '面积趋势',
    labelEn: 'Area trend',
    tags: ['cumulative', 'volume over time', 'total', '累积', '总量', '面积'],
    chartType: 'line',
    whenToUse: '强调累积量或总量的时间变化（单系列）',
    whenNotToUse: '多系列会互相遮挡（改 stacked area 或拆分）',
    configHint: 'type:"line" + dataset.fill=true + 半透明 backgroundColor'
  },
  {
    id: 'donut-share',
    labelZh: '环形占比',
    labelEn: 'Doughnut share',
    tags: ['proportion', 'share', 'percentage breakdown', 'market share', '占比', '比例', '市场份额', '百分比'],
    chartType: 'doughnut',
    whenToUse: '2-5 个部分的占比构成，中心可放总量/结论',
    whenNotToUse: '部分超过 6 个或差异极小（改 stacked-bar-composition 或 hbar-ranking）',
    configHint: 'type:"doughnut"，cutout≈"62%"；中心用绝对定位 div 放 hero 数字；每片直接标注名称+百分比'
  },
  {
    id: 'pie-share',
    labelZh: '饼图占比',
    labelEn: 'Pie share',
    tags: ['simple proportion', 'two parts', 'half', '简单占比', '两部分'],
    chartType: 'pie',
    whenToUse: '仅 2-3 个部分的简单占比',
    whenNotToUse: '其余场景一律优先 donut-share（饼图更占空间且不易标数值）',
    configHint: 'type:"pie"；仍需每片标注百分比，不依赖颜色区分'
  },
  {
    id: 'funnel-stages',
    labelZh: '漏斗阶段',
    labelEn: 'Funnel stages',
    tags: ['conversion', 'funnel', 'pipeline', 'stages drop', '漏斗', '转化', '流失', '阶段递减'],
    chartType: 'bar',
    whenToUse: '3-6 个逐级递减的阶段（线索→成交、投递→录用）',
    whenNotToUse: '阶段不单调递减（改 bar-compare 如实展示）',
    configHint: 'type:"bar" + indexAxis:"y"，按阶段顺序排序；每级标注绝对值与转化率；递减用同色透明度渐变'
  },
  {
    id: 'scatter-correlation',
    labelZh: '散点相关',
    labelEn: 'Scatter correlation',
    tags: ['correlation', 'relationship', 'distribution', 'two variables', '相关性', '分布', '两个变量', '散点'],
    chartType: 'scatter',
    whenToUse: '观察两个连续变量的关系或分布（≥10 个点）',
    whenNotToUse: '点数少于 10 个（直接用表格/文字说明）',
    configHint: 'type:"scatter"，dataset.data=[{x,y}]；如需分组用多 dataset + 同形不同色'
  },
  {
    id: 'bubble-three-var',
    labelZh: '气泡三变量',
    labelEn: 'Bubble three-variable',
    tags: ['three variables', 'bubble', 'size matters', '三个变量', '气泡'],
    chartType: 'bubble',
    whenToUse: '同时呈现 x、y、规模三个变量的少量对象（≤20 个泡）',
    whenNotToUse: '观众需要精确读数值（气泡面积不可读，改散点+表格）',
    configHint: 'type:"bubble"，dataset.data=[{x,y,r}]；必须给每个关键气泡留名称标注'
  },
  {
    id: 'radar-multidim',
    labelZh: '雷达多维',
    labelEn: 'Radar multi-dimension',
    tags: ['multi dimension', 'profile', 'competency', 'spider', '多维', '能力图谱', '画像', '评估维度'],
    chartType: 'radar',
    whenToUse: '3-8 个维度的 1-3 个对象画像对比（能力评估、方案打分）',
    whenNotToUse: '维度超过 8 个或对象超过 3 个（改 grouped-bar-compare）',
    configHint: 'type:"radar"，r 米 pointLabels 保持可读字号；填充半透明；维度名要短'
  },
  {
    id: 'combo-bar-line',
    labelZh: '柱线组合',
    labelEn: 'Bar + line combo',
    tags: ['value and rate', 'dual axis', 'amount and growth', 'bar line', '金额和增长率', '双轴', '量和率'],
    chartType: 'bar',
    whenToUse: '同页呈现绝对量（柱）与其比率/趋势（线），如营收与同比',
    whenNotToUse: '两个指标都无量纲差异（用 multi-line-trend 或 grouped-bar）',
    configHint: 'datasets 混合 type:"bar" 与 type:"line" + 线挂 y1 轴（position:"right"）；双轴必须分别标清单位'
  },
  {
    id: 'bullet-target',
    labelZh: '目标达成',
    labelEn: 'Bullet target',
    tags: ['target vs actual', 'progress', 'goal', 'kpi attainment', '目标', '达成率', '进度', 'kpi'],
    chartType: 'bar',
    whenToUse: '少量指标（1-4 个）的实际 vs 目标达成情况',
    whenNotToUse: '指标多且都需要精确对比（改 grouped-bar-compare）',
    configHint: '横向 bar：目标用细条或刻度线（stack 画法），实际用粗条；达成率直接标注'
  },
  {
    id: 'waterfall-bridge',
    labelZh: '瀑布桥接',
    labelEn: 'Waterfall bridge',
    tags: ['cumulative change', 'bridge', 'increase decrease', '贡献拆解', '增减', '桥接', '从a到b的变化'],
    chartType: 'bar',
    whenToUse: '拆解从期初到期末的增减贡献（成本变化、差额分析，3-7 步）',
    whenNotToUse: '步骤超过 7 个（归并为"其他"）',
    configHint: '浮动柱画法：每步 dataset 用 [base, delta] + stack，起点/终点画全柱；增减用不同色'
  },
  {
    id: 'sparkline-mini',
    labelZh: '迷你趋势',
    labelEn: 'Sparkline mini',
    tags: ['mini chart', 'in card trend', 'small trend', '迷你图', '卡片内趋势'],
    chartType: 'line',
    whenToUse: '在指标卡内嵌一条无轴小趋势，强化数字的方向感',
    whenNotToUse: '观众需要读出具体数值（改 line-trend）',
    configHint: 'type:"line" 高度 40-64px：关 axes/legend/tooltip，pointRadius=0，只留一条线 + 末点标记'
  }
]

const CJK_CHAR_RE = /[\u4e00-\u9fff]/

const tokenizeQuery = (query: string): string[] => {
  const normalized = String(query || '')
    .toLowerCase()
    .replace(/[，。、；！？,.!?;:()（）\[\]]/g, ' ')
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length > 0)
  // 中文按字切分补充子串召回能力（"占比组成" 命中 "占比"）
  const cjkTokens: string[] = []
  for (const token of tokens) {
    if (CJK_CHAR_RE.test(token)) {
      cjkTokens.push(token)
      if (token.length >= 3) cjkTokens.push(token.slice(0, 2))
    }
  }
  return [...tokens, ...cjkTokens]
}

export interface ChartPatternMatch {
  pattern: ChartPattern
  score: number
}

/** 按内容描述语义召回图表模式；无命中时返回空数组。 */
export function recallChartPatterns(query: string, limit = 5): ChartPatternMatch[] {
  const raw = String(query || '').trim().toLowerCase()
  if (!raw) return []
  const tokens = tokenizeQuery(raw)
  const matches: ChartPatternMatch[] = []
  for (const pattern of CHART_PATTERNS) {
    let score = 0
    for (const tag of pattern.tags) {
      const tagLower = tag.toLowerCase()
      if (tagLower === raw) score += 8
      else if (tagLower.includes(raw) || raw.includes(tagLower)) score += 5
    }
    for (const token of tokens) {
      for (const tag of pattern.tags) {
        const tagLower = tag.toLowerCase()
        if (tagLower.includes(token) || token.includes(tagLower)) {
          score += 2
          break
        }
      }
      if (pattern.labelZh.includes(token) || pattern.labelEn.toLowerCase().includes(token)) {
        score += 2
      }
    }
    if (score > 0) matches.push({ pattern, score })
  }
  return matches.sort((a, b) => b.score - a.score || a.pattern.id.localeCompare(b.pattern.id)).slice(0, Math.max(1, limit))
}

/** 紧凑目录（注入提示词用）：每模式一行。 */
export function formatChartPatternCatalogPrompt(): string {
  return CHART_PATTERNS.map(
    (pattern) =>
      `- ${pattern.id} (${pattern.labelZh}, ${pattern.chartType}): ${pattern.whenToUse}; avoid: ${pattern.whenNotToUse} [tags: ${pattern.tags.slice(0, 6).join('/')}]`
  ).join('\n')
}

/** 单模式详情（工具返回用）：含 Chart.js 配置骨架。 */
export function formatChartPatternDetail(pattern: ChartPattern): string {
  return [
    `${pattern.id} — ${pattern.labelZh} (${pattern.labelEn}, Chart.js ${pattern.chartType})`,
    `Use when: ${pattern.whenToUse}`,
    `Avoid when: ${pattern.whenNotToUse}`,
    `Config: ${pattern.configHint}`,
    `Tags: ${pattern.tags.join(', ')}`
  ].join('\n')
}
