import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  DIAGRAM_SKILL_NAME,
  REQUIRED_PRODUCT_SKILL_NAMES,
  getRequiredProductSkillNamesForSlideSize
} from '../../../src/main/product-skills/contract'
import { requireSlideSizePreset } from '../../../src/shared/slide-size'
import {
  CONTENT_WRITING_RULES,
  FRONTEND_CAPABILITIES
} from '../../../src/main/agent-runtime/prompt/composers/shared'

const skillDir = path.join(process.cwd(), 'resources', 'skills', DIAGRAM_SKILL_NAME)

describe('amy-ppt-diagram skill', () => {
  it('ships a valid skill package with frontmatter matching skill.json', () => {
    const skillJson = JSON.parse(
      readFileSync(path.join(skillDir, 'skill.json'), 'utf8')
    ) as { name: string; version: string; source: string }
    expect(skillJson).toMatchObject({ name: DIAGRAM_SKILL_NAME, source: 'builtin' })

    const skillMd = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')
    expect(skillMd).toContain(`name: ${DIAGRAM_SKILL_NAME}`)
    expect(skillMd).toMatch(/^---\n[\s\S]*?description:/)
  })

  it('carries the core diagram rules adapted from the reference design system', () => {
    const skillMd = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')
    // 图型选型表覆盖 PPT 常用关系表达
    for (const keyword of ['流程', '时间线', '架构', '循环', '金字塔', '漏斗', '四象限', '韦恩']) {
      expect(skillMd).toContain(keyword)
    }
    // SVG 图元硬规则：肘形连线公式与标注遮罩
    expect(skillMd).toContain('M x1,y1 H mid-8 Q mid,y1')
    expect(skillMd).toMatch(/遮罩|不透明底/)
    // 复杂度预算与反模式
    expect(skillMd).toMatch(/节点 ≤ 9/)
    expect(skillMd).toMatch(/Anti-patterns|反模式/)
    expect(skillMd).toContain('对角线')
    // 风格绑定与 HTML 集成
    expect(skillMd).toContain('design contract')
    expect(skillMd).toContain('aria-label')
  })

  it('is registered as a required product skill for every slide size', () => {
    expect(REQUIRED_PRODUCT_SKILL_NAMES).toContain(DIAGRAM_SKILL_NAME)
    for (const id of ['wide-16-9', 'vertical-9-16', 'standard-4-3', 'square-1-1'] as const) {
      expect(getRequiredProductSkillNamesForSlideSize(requireSlideSizePreset(id))).toContain(
        DIAGRAM_SKILL_NAME
      )
    }
  })

  it('is routed from the generation prompts', () => {
    expect(FRONTEND_CAPABILITIES).toContain(DIAGRAM_SKILL_NAME)
    expect(FRONTEND_CAPABILITIES).toMatch(/Diagrams:/)
    expect(CONTENT_WRITING_RULES).toContain(DIAGRAM_SKILL_NAME)
    expect(CONTENT_WRITING_RULES).toMatch(/流程、结构或关系/)
  })
})
