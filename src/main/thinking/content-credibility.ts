export interface CredibilityIssue {
  line: number
  text: string
  reason: string
}

const BENCHMARK_PATTERN = /\b(MMLU|HumanEval|MT-Bench|SWE-bench|GSM8K|GPQA|BIG-bench)\b/i
const METRIC_WORD_PATTERN =
  /成本|价格|准确率|召回率|错误率|幻觉|提升|下降|降低|缩短|节省|突破|达到|保持|超过|优化|损失|参数|token|fps|benchmark|score|accuracy|cost|latency|throughput/i
const EXACT_VALUE_PATTERN =
  /(?:[$￥]\s*\d|\d+(?:\.\d+)?\s*(?:%|美元|元|倍|fps|K|M|B|T|万|亿|千亿|万亿|token|tokens?)|\b\d+(?:\.\d+)?\s*(?:->|→|至|-)\s*\d+(?:\.\d+)?)/i

export function findUnsupportedPrecisionClaims(args: {
  markdown: string
  hasSources: boolean
}): CredibilityIssue[] {
  if (args.hasSources) return []

  const issues: CredibilityIssue[] = []
  const lines = args.markdown.split('\n')

  lines.forEach((line, index) => {
    const text = line.trim()
    if (!text || isAllowedStructuralNumber(text)) return

    const hasExactValue = EXACT_VALUE_PATTERN.test(text)
    const hasBenchmark = BENCHMARK_PATTERN.test(text) && /\d/.test(text)
    const hasMetricWord = METRIC_WORD_PATTERN.test(text)

    if ((hasExactValue && hasMetricWord) || hasBenchmark) {
      issues.push({
        line: index + 1,
        text,
        reason: hasBenchmark
          ? 'benchmark score without source support'
          : 'exact metric without source support'
      })
    }
  })

  return issues
}

function isAllowedStructuralNumber(text: string): boolean {
  return (
    /^##\s*Page\s+\d+\s*:/.test(text) ||
    /^##\s*Page Count$/i.test(text) ||
    /^\d+$/.test(text) ||
    /时长|分钟|页|页面数|Page Count/i.test(text)
  )
}
