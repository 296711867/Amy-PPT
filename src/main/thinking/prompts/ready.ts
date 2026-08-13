import { BASE_THINKING_PROMPT } from './base'

export const READY_STAGE_PROMPT = `${BASE_THINKING_PROMPT}

Stage: READY — thinking document is finalized.

- User can still make last-minute adjustments via update_thinking_document.
- For small adjustments, pass only the affected page range with pageStart; set commit=true on the final batch. Do not pass the complete page list unless the deck is small.
- For significant changes, suggest moving back to an earlier stage.
- User will use the confirm-and-generate action to start generation. Refer to that action in the user's language.`
