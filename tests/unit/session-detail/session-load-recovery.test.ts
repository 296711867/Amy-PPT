import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcState = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSessionMessages: vi.fn()
}))

vi.mock('../../../src/renderer/src/lib/ipc', () => ({
  ipc: ipcState
}))

import {
  SESSION_LOAD_ERROR,
  SESSION_NOT_FOUND_ERROR,
  useSessionStore,
  type GeneratedPage,
  type Session
} from '../../../src/renderer/src/store/sessionStore'

const makeSession = (id: string): Session =>
  ({
    id,
    title: `Session ${id}`,
    topic: null,
    styleId: null,
    page_count: 1,
    slideSizeId: 'wide-16-9',
    slideWidth: 1600,
    slideHeight: 900,
    status: 'completed',
    provider: 'openai',
    model: 'model',
    created_at: 1,
    updated_at: 1,
    metadata: null
  }) as Session

const makePage = (id: string): GeneratedPage => ({
  id: `${id}-page`,
  pageNumber: 1,
  title: `Page ${id}`,
  html: '<html></html>'
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('session loading recovery', () => {
  beforeEach(() => {
    ipcState.getSession.mockReset()
    ipcState.getSessionMessages.mockReset()
    useSessionStore.setState({
      currentSession: makeSession('old'),
      currentMessages: [],
      currentGeneratedPages: [makePage('old')],
      loading: false,
      error: 'stale error'
    })
  })

  it('clears stale session data while loading and clears errors after success', async () => {
    ipcState.getSession.mockResolvedValue({
      session: makeSession('new'),
      generatedPages: [makePage('new')]
    })

    const loading = useSessionStore.getState().loadSession('new')
    expect(useSessionStore.getState()).toMatchObject({
      currentSession: null,
      currentGeneratedPages: [],
      loading: true,
      error: null
    })

    await loading
    expect(useSessionStore.getState()).toMatchObject({
      currentSession: makeSession('new'),
      currentGeneratedPages: [makePage('new')],
      loading: false,
      error: null
    })
  })

  it('clears stale data and exposes a load error when IPC fails', async () => {
    ipcState.getSession.mockRejectedValue(new Error('database unavailable'))

    await useSessionStore.getState().loadSession('new')

    expect(useSessionStore.getState()).toMatchObject({
      currentSession: null,
      currentGeneratedPages: [],
      loading: false,
      error: SESSION_LOAD_ERROR
    })
  })

  it('keeps current data when a same-session refresh fails', async () => {
    ipcState.getSession.mockRejectedValue(new Error('database unavailable'))

    await expect(useSessionStore.getState().loadSession('old')).resolves.toBe(false)

    expect(useSessionStore.getState()).toMatchObject({
      currentSession: makeSession('old'),
      currentGeneratedPages: [makePage('old')],
      loading: false,
      error: SESSION_LOAD_ERROR
    })
  })

  it('reports an invalid session separately from an IPC failure', async () => {
    ipcState.getSession.mockResolvedValue({ session: undefined, generatedPages: [] })

    await useSessionStore.getState().loadSession('missing')

    expect(useSessionStore.getState()).toMatchObject({
      currentSession: null,
      loading: false,
      error: SESSION_NOT_FOUND_ERROR
    })
  })

  it('does not let an older response overwrite the newer session', async () => {
    const oldRequest = deferred<{ session: Session; generatedPages: GeneratedPage[] }>()
    const newRequest = deferred<{ session: Session; generatedPages: GeneratedPage[] }>()
    ipcState.getSession.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)

    const oldLoad = useSessionStore.getState().loadSession('old')
    const newLoad = useSessionStore.getState().loadSession('new')

    newRequest.resolve({ session: makeSession('new'), generatedPages: [makePage('new')] })
    await newLoad
    oldRequest.resolve({ session: makeSession('old'), generatedPages: [makePage('old')] })
    await oldLoad

    expect(useSessionStore.getState()).toMatchObject({
      currentSession: makeSession('new'),
      currentGeneratedPages: [makePage('new')],
      loading: false,
      error: null
    })
  })

  it('does not let old-session messages return after a route switch', async () => {
    const oldMessages = deferred<unknown[]>()
    ipcState.getSessionMessages.mockReturnValueOnce(oldMessages.promise)
    ipcState.getSession.mockResolvedValue({ session: makeSession('new'), generatedPages: [] })
    useSessionStore.setState({ currentSession: makeSession('old'), currentMessages: [] })

    const oldLoad = useSessionStore.getState().loadMessages({
      sessionId: 'old',
      chatType: 'main'
    })
    await useSessionStore.getState().loadSession('new')
    oldMessages.resolve([
      {
        id: 'old-message',
        session_id: 'old',
        chat_scope: 'main',
        page_id: null,
        role: 'assistant',
        content: 'old response',
        type: 'text',
        tool_name: null,
        tool_call_id: null,
        token_count: null,
        created_at: 1
      }
    ])
    await oldLoad

    expect(useSessionStore.getState().currentMessages).toEqual([])
  })

  it('does not let an older chat context overwrite a newer context in the same session', async () => {
    const mainMessages = deferred<unknown[]>()
    const pageMessages = deferred<unknown[]>()
    ipcState.getSessionMessages
      .mockReturnValueOnce(mainMessages.promise)
      .mockReturnValueOnce(pageMessages.promise)

    const mainLoad = useSessionStore.getState().loadMessages({
      sessionId: 'old',
      chatType: 'main'
    })
    const pageLoad = useSessionStore.getState().loadMessages({
      sessionId: 'old',
      chatType: 'page',
      pageId: 'page-1'
    })
    pageMessages.resolve([
      {
        id: 'page-message',
        session_id: 'old',
        chat_scope: 'page',
        page_id: 'page-1',
        role: 'assistant',
        content: 'new context',
        created_at: 2
      }
    ])
    await pageLoad
    mainMessages.resolve([
      {
        id: 'main-message',
        session_id: 'old',
        chat_scope: 'main',
        page_id: null,
        role: 'assistant',
        content: 'old context',
        created_at: 1
      }
    ])
    await mainLoad

    expect(useSessionStore.getState().currentMessages.map((message) => message.id)).toEqual([
      'page-message'
    ])
  })

  it('ignores an older message failure after a newer context starts', async () => {
    const oldMessages = deferred<unknown[]>()
    ipcState.getSessionMessages
      .mockReturnValueOnce(oldMessages.promise)
      .mockResolvedValueOnce([])

    const oldLoad = useSessionStore.getState().loadMessages({
      sessionId: 'old',
      chatType: 'main'
    })
    await useSessionStore.getState().loadMessages({
      sessionId: 'old',
      chatType: 'page',
      pageId: 'page-1'
    })
    oldMessages.reject(new Error('late failure'))
    await oldLoad

    expect(useSessionStore.getState().error).toBe('stale error')
  })
})
