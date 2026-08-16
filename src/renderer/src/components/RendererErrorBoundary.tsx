import { Component, type ErrorInfo, type ReactNode } from 'react'
import { en } from '../i18n/en'
import { zh } from '../i18n/zh'

type RendererLocale = 'zh' | 'en'

const readRendererLocale = (): RendererLocale => {
  if (typeof window === 'undefined') return 'zh'
  try {
    return (window.localStorage.getItem('amy-ppt:lang') ||
      window.localStorage.getItem('oh-my-ppt:lang')) === 'en'
      ? 'en'
      : 'zh'
  } catch {
    return 'zh'
  }
}

export const getRendererErrorBoundaryCopy = (
  locale: RendererLocale = readRendererLocale()
): typeof en.rendererErrorBoundary | typeof zh.rendererErrorBoundary =>
  (locale === 'en' ? en : zh).rendererErrorBoundary

type RendererErrorBoundaryProps = {
  children: ReactNode
}

type RendererErrorBoundaryState = {
  error: Error | null
}

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[renderer] React tree crashed', error, errorInfo)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    const copy = getRendererErrorBoundaryCopy()

    return (
      <main className="flex h-full min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <h1 className="organic-serif text-2xl font-semibold">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {copy.description}
          </p>
          <button
            type="button"
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--ui-action-hover)]"
            onClick={() => window.location.reload()}
          >
            {copy.refresh}
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--ui-danger-soft)] p-3 text-left text-xs text-destructive">
              {this.state.error.message}
            </pre>
          )}
        </section>
      </main>
    )
  }
}
