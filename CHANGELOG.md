# Amy-PPT Changelog

## 1.0.2 (Unreleased)

- Restricted renderer IPC access to an explicit channel allowlist and hardened main-window and WebView navigation.
- Kept stored text and image-model credentials in the main process and bound credential reuse to the original provider endpoint.
- Added staged export output, session runtime refresh before export, and failure cleanup that preserves existing targets.
- Improved session, editing, preview, and recovery failure handling with focused regression coverage.
- Normalized generic and GLM model responses while preserving streamed tool calls and actionable errors.
- Made `minimal-white` the stable fallback style across standard and Thinking generation flows.
- Hardened render-readiness validation, incomplete-page rejection, and failed-page retry behavior.
- Added continuous type-check and unit-test verification and aligned release metadata and documentation.

## 1.0.1

- Added the three-level font system, reusable font schemes, and generated deck backgrounds.
- Curated 44 presentation-oriented styles and expanded the universal layout catalog to 39 compositions.
- Added semantic template roles, fidelity guards, per-slide visual-format planning, and editorial diagram guidance.
- Added repeated-failure escalation, render-level visual review, and chart-pattern recall.
- Improved GLM compatibility, page retry selection, thumbnail recovery, and targeted regression coverage.

## 1.0.0

- Established Amy-PPT as an independent desktop product identity.
- Added multiple application UI themes with Warm Apricot Coral as the default direction.
- Added editable Layout Rules and an expert Markdown editor.
- Added a 28-layout universal presentation library covering 1-6 text modules, mixed image/text compositions, and 2/3/4/6-image galleries.
- Added deterministic adjacent-slide silhouette rotation and persisted layout/image-slot recovery across retry, edit, template, and style-switch flows.
- Added opt-in per-slot AI image generation with replaceable placeholder fallback.
- Added controlled page persistence, rendered-page checks, rollback, and generation recovery.
- Added deck-level visual consistency review and bounded repair.
- Added deterministic and LLM-assisted presentation narrative review.
- Added source-document planning and page-scoped retrieval for document-to-PPT generation.
- Preserved editable HTML/PPTX workflows, style management, templates, fonts, and media tools.
