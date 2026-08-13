import type { GenerationFailureInfo } from './generation-error'

export type GenerationCircuitState = {
  paused: boolean
  failure: GenerationFailureInfo | null
  occurrences: number
}

export function createGenerationCircuitBreaker(): {
  getState: () => GenerationCircuitState
  registerFailure: (failure: GenerationFailureInfo) => GenerationCircuitState
} {
  let state: GenerationCircuitState = {
    paused: false,
    failure: null,
    occurrences: 0
  }

  return {
    getState: () => state,
    registerFailure: (failure) => {
      if (failure.scope !== 'system') return state

      const occurrences =
        state.failure?.fingerprint === failure.fingerprint ? state.occurrences + 1 : 1
      state = {
        // Stop dispatching new pages on the first system failure. A second concurrent
        // occurrence confirms the fingerprint without sacrificing more queued pages.
        paused: true,
        failure,
        occurrences
      }
      return state
    }
  }
}
