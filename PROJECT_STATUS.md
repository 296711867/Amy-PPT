# Amy-PPT Project Status

## Current Release

- Product: Amy-PPT
- Version: `1.0.0`
- Repository: `https://github.com/296711867/Amy-PPT`
- Stack: Electron 39, React 19, TypeScript, LangChain/Deep Agents, libSQL/Drizzle, Vitest

## Completed

- Amy-PPT product identity, logo, application icons, README assets, update manifest, and version `1.0.0`.
- Multiple UI themes with Warm Apricot Coral as the default.
- Editable Layout Rules and expert Markdown layout configuration.
- Universal layout catalog with 28 presentation compositions:
  - 1-6 section text layouts with multiple silhouettes.
  - Left/right image and text compositions.
  - 2, 3, 4, and 6-image gallery compositions.
- Agent planning contract that assigns `layoutId` and rotates repeated adjacent silhouettes.
- Per-slot placeholder or opt-in AI image generation with partial fallback.
- Persisted layout and image-slot recovery for generation, retry, template, edit, and style-switch flows.
- Generation harnesses, pause/retry recovery, source-document planning, deck visual review, and narrative review.

## Verification Policy

- Run focused Vitest files for each changed domain.
- Run `pnpm run typecheck:node` and `pnpm run typecheck:web` before release.
- Do not run `npm run lint` or `npm run build` in this workspace unless the repository instructions change.

## Next Work

- Add rendered reference previews for the universal layout catalog.
- Collect real-deck evaluation results to tune layout routing and density budgets.
- Expand image prompt planning from generic slot subjects to explicit per-slot visual briefs.
- Prepare signed release artifacts and update `version.json` download links when binaries are published.
