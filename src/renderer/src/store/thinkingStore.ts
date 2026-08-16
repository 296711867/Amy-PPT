import { create } from 'zustand'
import { ipc } from '@renderer/lib/ipc'
import type {
  ThinkingActivity,
  ThinkingChatFailure,
  ThinkingStage,
  ThinkingSource,
  ThinkingChatMessage,
  ThinkingPageOutlineUpdate,
  ThinkingConnectionState
} from '@shared/thinking'
import { mergeThinkingActivity, settleThinkingActivities } from '@shared/thinking-activity'
import { normalizeThinkingChatFailure } from '@shared/thinking-chat-error'
import { appendThinkingUserMessage } from '@shared/thinking-request'
import { en } from '../i18n/en'
import { zh } from '../i18n/zh'

interface FailedThinkingRequest {
  content: string
  attachments?: ThinkingSource[]
  modelConfigId?: string
  recentMessages: ThinkingChatMessage[]
}

interface ThinkingStore {
  thinkingId: string | null
  stage: ThinkingStage
  thinkingMd: string
  contextMd: string
  sources: ThinkingSource[]
  messages: ThinkingChatMessage[]
  thinkingSteps: ThinkingActivity[]
  connectionState: ThinkingConnectionState
  chatFailure: ThinkingChatFailure | null
  animatingText: string
  loading: boolean
  error: string | null

  createWorkspace: () => Promise<string>
  loadWorkspace: (thinkingId: string) => Promise<void>
  loadLatestWorkspace: () => Promise<string | null>
  refreshWorkspace: (thinkingId?: string) => Promise<boolean>
  updatePageOutline: (page: ThinkingPageOutlineUpdate) => Promise<void>
  addMessage: (message: ThinkingChatMessage) => void
  sendMessage: (content: string, attachments?: ThinkingSource[], modelConfigId?: string) => void
  retryLastMessage: () => void
  reconnectAndRetry: () => void
  dismissChatFailure: () => void
  addThinkingStep: (step: ThinkingActivity) => void
  setAnimatingText: (text: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

let streamListenersReady = false

const readStoredLocale = (): 'zh' | 'en' => {
  if (typeof window === 'undefined') return 'zh'
  return (window.localStorage.getItem('amy-ppt:lang') ||
    window.localStorage.getItem('oh-my-ppt:lang')) === 'en'
    ? 'en'
    : 'zh'
}

export const getThinkingConnectionStepSummary = (
  reconnecting: boolean,
  locale: 'zh' | 'en' = readStoredLocale()
): string => {
  const messages = locale === 'en' ? en : zh
  return reconnecting
    ? messages.thinking.connectionRetrying
    : messages.thinking.connectionConnecting
}

function hasAssistantReply(messages: ThinkingChatMessage[], reply: string): boolean {
  const normalized = reply.trim()
  if (!normalized) return false
  return messages.some(
    (message) => message.role === 'assistant' && message.content.trim() === normalized
  )
}

function ensureThinkingStreamListeners(
  set: (
    partial:
      | Partial<ThinkingStore>
      | ((state: ThinkingStore) => Partial<ThinkingStore> | ThinkingStore)
  ) => void,
  get: () => ThinkingStore
): void {
  if (streamListenersReady) return
  streamListenersReady = true

  ipc.onThinkingStreamThinking((payload) => {
    const state = get()
    if (payload.thinkingId !== state.thinkingId) return
    state.addThinkingStep({
      id: payload.id || `${payload.toolName}:${payload.summary}`,
      type: payload.type.startsWith('tool_') ? 'tool' : 'phase',
      toolName: payload.toolName,
      summary: payload.summary,
      status:
        payload.type === 'tool_result' || payload.type === 'phase_completed'
          ? 'completed'
          : payload.type === 'phase_failed'
            ? 'failed'
            : 'running'
    })
  })

  ipc.onThinkingStreamEnd((payload) => {
    const state = get()
    if (payload.thinkingId !== state.thinkingId) return

    set({
      thinkingMd: payload.thinkingMd,
      contextMd: payload.contextMd,
      stage: payload.stage
    })
    void get().refreshWorkspace(payload.thinkingId)

    const fullText = payload.reply.trim()
    if (!fullText || hasAssistantReply(get().messages, fullText)) {
      set({
        loading: false,
        thinkingSteps: settleThinkingActivities(get().thinkingSteps, 'completed'),
        animatingText: '',
        connectionState: 'connected',
        chatFailure: null
      })
      return
    }

    let index = 0
    const charsPerTick = 3
    const tickMs = 20
    const animate = (): void => {
      const current = get()
      if (!current.loading || current.thinkingId !== payload.thinkingId) return
      index = Math.min(index + charsPerTick, fullText.length)
      current.setAnimatingText(fullText.slice(0, index))
      if (index < fullText.length) {
        setTimeout(animate, tickMs)
      } else {
        if (!hasAssistantReply(get().messages, fullText)) {
          current.addMessage({
            role: 'assistant',
            content: fullText,
            timestamp: Date.now()
          })
        }
        set({
          loading: false,
          thinkingSteps: settleThinkingActivities(get().thinkingSteps, 'completed'),
          animatingText: '',
          connectionState: 'connected',
          chatFailure: null
        })
      }
    }
    animate()
  })
}

export const useThinkingStore = create<ThinkingStore>((set, get) => {
  let failedRequest: FailedThinkingRequest | null = null

  const runRequest = (request: FailedThinkingRequest, appendUserMessage: boolean): void => {
    const thinkingId = get().thinkingId
    if (!thinkingId) return

    if (appendUserMessage) {
      set((state) => ({
        messages: appendThinkingUserMessage(state.messages, request, true)
      }))
    }

    failedRequest = null
    set({
      loading: true,
      error: null,
      chatFailure: null,
      connectionState: appendUserMessage ? 'connecting' : 'retrying',
      thinkingSteps: [
        {
          id: 'connection',
          type: 'phase',
          toolName: 'connection',
          summary: getThinkingConnectionStepSummary(!appendUserMessage),
          status: appendUserMessage ? 'running' : 'retrying'
        }
      ],
      animatingText: ''
    })

    ipc
      .thinkingChat({
        thinkingId,
        modelConfigId: request.modelConfigId,
        userMessage: request.content,
        recentMessages: request.recentMessages,
        ...(request.attachments && request.attachments.length > 0
          ? { attachments: request.attachments }
          : {})
      })
      .catch((err) => {
        const failure = normalizeThinkingChatFailure(err, readStoredLocale())
        failedRequest = request
        set((state) => {
          if (state.thinkingId !== thinkingId) return state
          return {
            error: failure.message,
            chatFailure: failure,
            connectionState: 'disconnected',
            animatingText: '',
            loading: false,
            thinkingSteps: settleThinkingActivities(state.thinkingSteps, 'failed')
          }
        })
      })
  }

  return {
    thinkingId: null,
    stage: 'collect',
    thinkingMd: '',
    contextMd: '',
    sources: [],
    messages: [],
    thinkingSteps: [],
    connectionState: 'idle',
    chatFailure: null,
    animatingText: '',
    loading: false,
    error: null,

    createWorkspace: async () => {
      ensureThinkingStreamListeners(set, get)
      failedRequest = null
      set({
        thinkingId: null,
        stage: 'collect',
        thinkingMd: '',
        contextMd: '',
        sources: [],
        messages: [],
        thinkingSteps: [],
        connectionState: 'idle',
        chatFailure: null,
        animatingText: '',
        loading: true,
        error: null
      })
      try {
        const workspace = await ipc.thinkingCreateWorkspace()
        set({
          thinkingId: workspace.thinkingId,
          stage: workspace.stage,
          thinkingMd: workspace.thinkingMd,
          contextMd: workspace.contextMd,
          sources: workspace.sources,
          messages: workspace.messages,
          thinkingSteps: [],
          animatingText: '',
          loading: false
        })
        return workspace.thinkingId
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to create workspace',
          loading: false
        })
        throw err
      }
    },

    loadWorkspace: async (thinkingId) => {
      ensureThinkingStreamListeners(set, get)
      failedRequest = null
      set({
        thinkingId,
        stage: 'collect',
        thinkingMd: '',
        contextMd: '',
        sources: [],
        messages: [],
        thinkingSteps: [],
        connectionState: 'idle',
        chatFailure: null,
        animatingText: '',
        loading: true,
        error: null
      })
      try {
        const workspace = await ipc.thinkingGetWorkspace(thinkingId)
        set({
          thinkingId: workspace.thinkingId,
          stage: workspace.stage,
          thinkingMd: workspace.thinkingMd,
          contextMd: workspace.contextMd,
          sources: workspace.sources,
          messages: workspace.messages,
          thinkingSteps: [],
          animatingText: '',
          loading: false
        })
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to load workspace',
          loading: false
        })
      }
    },

    loadLatestWorkspace: async () => {
      ensureThinkingStreamListeners(set, get)
      failedRequest = null
      try {
        const result = await ipc.thinkingGetLatestWorkspace()
        if (!result) return null
        set({
          thinkingId: result.thinkingId,
          stage: result.stage,
          thinkingMd: result.thinkingMd,
          contextMd: result.contextMd,
          sources: result.sources,
          messages: result.messages,
          thinkingSteps: [],
          connectionState: 'idle',
          chatFailure: null,
          animatingText: '',
          loading: false
        })
        return result.thinkingId
      } catch {
        return null
      }
    },

    refreshWorkspace: async (thinkingId) => {
      const activeThinkingId = thinkingId || get().thinkingId
      if (!activeThinkingId) return false

      const workspace = await ipc.thinkingGetWorkspace(activeThinkingId)
      const current = get()
      if (current.thinkingId !== activeThinkingId || workspace.thinkingId !== activeThinkingId) {
        return false
      }

      const sourcesChanged = JSON.stringify(current.sources) !== JSON.stringify(workspace.sources)
      const messagesChanged =
        !current.loading && JSON.stringify(current.messages) !== JSON.stringify(workspace.messages)
      const changed =
        current.thinkingMd !== workspace.thinkingMd ||
        current.contextMd !== workspace.contextMd ||
        current.stage !== workspace.stage ||
        sourcesChanged ||
        messagesChanged

      set({
        thinkingMd: workspace.thinkingMd,
        contextMd: workspace.contextMd,
        stage: workspace.stage,
        sources: workspace.sources,
        ...(current.loading ? {} : { messages: workspace.messages })
      })

      return changed
    },

    updatePageOutline: async (page) => {
      const { thinkingId, loading } = get()
      if (!thinkingId) throw new Error('Thinking workspace is not ready')
      if (loading) throw new Error('Thinking workspace is busy')
      const result = await ipc.thinkingUpdatePageOutline({ thinkingId, page })
      set((state) =>
        state.thinkingId === thinkingId
          ? {
              thinkingMd: result.thinkingMd
            }
          : state
      )
    },

    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

    addThinkingStep: (step) =>
      set((state) => ({
        thinkingSteps: mergeThinkingActivity(state.thinkingSteps, step),
        connectionState:
          step.id === 'connection' && step.status === 'completed'
            ? 'connected'
            : state.connectionState
      })),

    setAnimatingText: (text) => set({ animatingText: text }),

    sendMessage: (content, attachments, modelConfigId) => {
      ensureThinkingStreamListeners(set, get)
      const { thinkingId, messages } = get()
      if (!thinkingId) return
      runRequest(
        {
          content,
          attachments,
          modelConfigId,
          recentMessages: messages.slice(-8)
        },
        true
      )
    },

    retryLastMessage: () => {
      if (!failedRequest || get().loading) return
      runRequest(failedRequest, false)
    },

    reconnectAndRetry: () => {
      if (!failedRequest || get().loading) return
      runRequest(failedRequest, false)
    },

    dismissChatFailure: () => {
      failedRequest = null
      set({ chatFailure: null, error: null, connectionState: 'idle' })
    },

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    reset: () => {
      failedRequest = null
      set({
        thinkingId: null,
        stage: 'collect',
        thinkingMd: '',
        contextMd: '',
        sources: [],
        messages: [],
        thinkingSteps: [],
        connectionState: 'idle',
        chatFailure: null,
        animatingText: '',
        loading: false,
        error: null
      })
    }
  }
})
