---
name: amy-ppt-diagram
description: Must be read before drawing any process flow, architecture, system structure, timeline, cycle/loop, pyramid/funnel, quadrant/comparison, or relationship diagram on an Amy-PPT slide. Defines SVG diagram primitives, elbow-connector geometry, complexity budgets, and anti-patterns so diagrams look editorial instead of AI-generated.
---

# Amy-PPT Diagram

When slide content is a **process, structure, or relationship** — not a data series — draw an inline SVG diagram instead of stacking bullet lists or generic cards. This skill defines how.

## When to use

Draw a diagram when the content answers one of these questions:

- 「这事的步骤/阶段/先后是什么」→ 流程 / 时间线
- 「系统由什么组成 / 谁连着谁」→ 架构 / 关系图
- 「怎么循环 / 怎么相互增强」→ 循环飞轮
- 「怎么分层 / 怎么收敛 / 怎么排优先级」→ 分层栈 / 漏斗 / 四象限
- 「两边怎么对比 / 有什么交集」→ 对比矩阵 / 韦恩

Do NOT draw a diagram for: numeric trends/comparisons (use the chart skill `amy-ppt-chart`), pure narrative pages, or a list with fewer than 3 relational items.

## Diagram type selection

| 你要表达的内容 | 图示类型 |
| --- | --- |
| 线性步骤、审批流、阶段推进 | 横向/纵向流程图（箭头串联） |
| 时间、里程碑、路线图 | 时间线（轴线 + 节点 + 上下交错标注） |
| 系统组成、服务拓扑、依赖关系 | 架构图（分 zone 的节点 + 肘形连线） |
| 组织结构、分类层次 | 树（父在上/左，子分层展开） |
| 相互增强的闭环、增长机制 | 循环图（节点环形排列 + 顺时针箭头） |
| 分层抽象、技术栈 | 分层栈（横向色带层 + 层内模块） |
| 收敛转化（流量/线索/招聘漏斗） | 漏斗（逐层收窄的梯形） |
| 分层优先级、信息架构 | 金字塔 |
| 两维度评估、优先级矩阵 | 四象限（2×2 + 轴标注） |
| 多方案权衡、特性对比 | 对比矩阵 / 双列对照 |
| 交集、重叠群体 | 韦恩图（≤3 圆） |

先选类型，再数内容量；超预算先砍内容或拆成 overview + detail 两页，不硬画。

## Complexity budgets（硬上限）

- 节点 ≤ 9 个（树/架构 ≤ 12 个）；连线/箭头 ≤ 12 条
- 强调焦点（accent 色）≤ 2 个；其余节点用中性填充
- 四象限每格 ≤ 4 项；漏斗 ≤ 5 层；时间线 ≤ 6 个节点
- 标注文字每个节点 ≤ 8 字（主标签）+ ≤ 14 字（副标签），长文案放图外注释区
- 超预算时：合并同类节点、把第三层细节移到图旁的说明栏、或拆页

## SVG primitives

所有图示用一个内联 `<svg viewBox="0 0 W H">` 绘制（W/H 对齐画布内容区，4px 网格取整），放进页面片段的正文文档流里（外层 flex/grid 容器，不要 absolute）。

### 节点盒（5 层结构，从下到上）

1. 盒体 `<rect rx="6">`：填充用中性色（design contract palette 的浅色或 `currentColor` 低透明），描边 1.5px 中性
2. 焦点节点：填充换 palette 强调色（浅化）+ 2px 强调描边——全图最多 2 个
3. 主标签 `<text>`：节点名，字号 ≥ 16px、`font-weight:600`、`fill` 用正文色
4. 副标签 `<text>`：技术/补充说明，10-12px、muted 色、最多一行
5. 可选图标：`<svg data-icon="id">` 放节点内左上或标签前（走 lucide 替换管线，不要手写 path）

### 连线（肘形，禁止对角线）

- 默认直角圆弧：`M x1,y1 H mid-8 Q mid,y1 mid,y1+8 V y2-8 Q mid,y2 mid+8,y2 H x2`（r=8）
- 连线交叉处加桥接弧：`a 8,8 0 0,1 16,0`
- 箭头统一用 `<marker>` 定义一次，尺寸 6-8px；双向关系两条独立线，不要画双头怪箭
- 线色用 muted/中性色；强调关系的线才用 accent，≤ 2 条
- **绝不画任意角度的对角虚线**——要么肘形，要么改布局让关系变正交

### 连线/区域标注

- 标签必须带底：`<rect fill="画布背景色">` 遮罩垫在 `<text>` 下，四周各留 6-10px，保证线不穿字
- zone/容器分组：浅色底 + 1px 虚线边 + 左上角 zone 名（12px、muted、大写或加字距）

## Style binding（与页面风格一致）

- 颜色全部取自当前页 design contract 的 palette 与背景色，不自创色板；SVG 内可用 `var(--ppt-body-font)` 等 CSS 变量
- 字体跟随页面 CSS 变量；不要在 SVG 里引入新字体
- 圆角/描边/阴影语言与当前 style 的组件规范一致（style 说直角就直角，说柔和圆角就统一圆角）
- 深色背景页面：节点填充用浅色低透明、文字反白，对比度保持可读

## HTML integration rules

- SVG 是页面片段的一部分：遵守 HTML 片段协议（单 `<div>` 根、无远程资源、标签闭合）
- `<svg>` 要有 `role="img"` 和 `aria-label="图示名称"`；装饰性连线可加 `aria-hidden="true"`
- 图 + 结论：图示页仍要一句可见的 takeaway（图下方或侧栏），图不能只靠观众自己读
- 尺寸：图示区域高度按画布内容区预算计算（同 chart 的 slot 思路），`viewBox` 比例与容器一致，`preserveAspectRatio="xMidYMid meet"`
- 动画：整图淡入或按阅读顺序 stagger 节点即可（`data-anim` 系列遵守 data-anim skill），不做 SVG path 描绘动画

## Anti-patterns（出现即重画）

- 对角线乱连、线条交叉不桥接、箭头穿过文字
- 所有盒子同款同色无层级（没有焦点）
- 发光/霓虹描边、暗底青紫渐变、无意义 drop-shadow
- 节点内塞整段文字；标注不带遮罩直接压在线上
- 图例复杂到需要图例本身再解释——直接把语义写进标签
- 用 emoji 当节点图标（用 data-icon）
- 页面只有一个孤图没有结论句；或图占满页面标题被挤没

## Pre-draw checklist

写 SVG 前依次确认（心里过一遍即可，不必输出）：

1. 类型：选了哪个图型？为什么它比列表/表格更清楚？
2. 预算：节点数、连线数是否在上限内？超了砍什么？
3. 焦点：观众第一眼应该看哪个节点/哪条线？它有 accent 吗？
4. 几何：所有连线肘形正交？标签全部有遮罩？
5. 风格：颜色/字体/圆角是否来自当前 design contract 与 style？
6. 结论：图外的 takeaway 句写了吗？
