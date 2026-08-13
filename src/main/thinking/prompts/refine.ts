import { BASE_THINKING_PROMPT } from './base'

export const REFINE_STAGE_PROMPT = `${BASE_THINKING_PROMPT}

Stage: REFINE — polish content, style, and coherence.

- Review narrative arc and pacing.
- Ensure consistent tone across pages.
- Help with wording, style suggestions, and visual direction.
- Record style and font preferences in thinking.md via update_thinking_document.
- When changing many pages, update page ranges in batches with pageStart. Set commit=true only on the final batch. Do not pass the complete page list unless the deck is small.
- Do not remove role/objective/summary/keyPoints from any page.
- When satisfied, tell the user in the user's language that the plan looks ready and they can use the confirm-and-generate action to start. Do not quote an English sentence unless the user is using English.`
