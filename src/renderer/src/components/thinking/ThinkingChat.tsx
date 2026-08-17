import { useState, useRef, useEffect, type KeyboardEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useT } from '@renderer/i18n'
import { useToastStore } from '@renderer/store'
import { ipc } from '@renderer/lib/ipc'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip'
import {
  Bot,
  BookOpen,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileSearch,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  RefreshCw,
  Send,
  Settings2,
  User,
  WifiOff,
  X
} from 'lucide-react'
import { ScrollArea } from '../ui/ScrollArea'
import type {
  ThinkingActivity,
  ThinkingChatFailure,
  ThinkingChatMessage,
  ThinkingConnectionState,
  ThinkingSource
} from '@shared/thinking'
import { ModelSelectButton } from '../model/ModelActionButton'
import { useModelAction } from '@renderer/hooks/useModelAction'

const MAX_DOCUMENT_SIZE_MB = 10
const MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024
const MAX_IMAGE_SIZE_MB = 5
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['.md', '.txt', '.text', '.csv', '.docx'])
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const getFileExtension = (name: string): string => {
  const match = name
    .trim()
    .toLowerCase()
    .match(/\.[^.]+$/)
  return match?.[0] || ''
}

const isSupportedImageFile = (file: File): boolean => {
  const ext = getFileExtension(file.name)
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext)
}

const isSupportedThinkingFile = (file: File): boolean => {
  const ext = getFileExtension(file.name)
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(ext) || SUPPORTED_IMAGE_EXTENSIONS.has(ext)
}

function StepIcon({ step }: { step: ThinkingActivity }): ReactElement {
  if (step.status === 'completed') return <Check className="h-3 w-3 shrink-0 text-primary" />
  if (step.status === 'failed')
    return <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
  if (step.status === 'retrying')
    return <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-warning" />
  const name = step.toolName
  if (name === 'read_file') return <FolderOpen className="h-3 w-3 shrink-0 text-info" />
  if (name === 'grep') return <FileSearch className="h-3 w-3 shrink-0 text-info" />
  if (name === 'update_thinking_document')
    return <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
  if (name === 'update_context_document')
    return <BookOpen className="h-3 w-3 shrink-0 text-primary" />
  return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-info" />
}

interface ThinkingChatProps {
  thinkingId: string
  messages: ThinkingChatMessage[]
  sources: ThinkingSource[]
  pendingSources: ThinkingSource[]
  loading: boolean
  thinkingSteps: ThinkingActivity[]
  connectionState: ThinkingConnectionState
  chatFailure: ThinkingChatFailure | null
  animatingText: string
  onSend: (content: string, modelConfigId: string) => void
  onSourcesUploaded: (sources: ThinkingSource[]) => void
  onSourceRemoved: (sourceId: string) => void
  onRetry: () => void
  onReconnect: () => void
  onDismissFailure: () => void
}

function MessageMarkdown({
  content,
  role
}: {
  content: string
  role: ThinkingChatMessage['role']
}): ReactElement {
  const isUser = role === 'user'
  const mutedText = isUser ? 'text-primary-foreground/85' : 'text-muted-foreground'
  const strongText = isUser ? 'text-primary-foreground' : 'text-foreground'
  const borderColor = isUser ? 'border-white/30' : 'border-[var(--ui-border-strong)]'
  const listClass = isUser
    ? 'mb-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed marker:text-primary-foreground/70'
    : 'mb-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed marker:text-muted-foreground'
  const orderedListClass = isUser
    ? 'mb-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed marker:text-primary-foreground/70'
    : 'mb-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed marker:text-muted-foreground'
  const codeClass = isUser
    ? 'rounded bg-primary-foreground/15 px-1 py-0.5 font-mono text-[12px] text-primary-foreground'
    : 'rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground'

  return (
    <div className="markdown-message [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p
              className={`mb-2 whitespace-pre-wrap text-[13px] leading-relaxed ${isUser ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className={`font-semibold ${strongText}`}>{children}</strong>
          ),
          em: ({ children }) => <em className={mutedText}>{children}</em>,
          ul: ({ children }) => <ul className={listClass}>{children}</ul>,
          ol: ({ children }) => <ol className={orderedListClass}>{children}</ol>,
          li: ({ children }) => (
            <li className={isUser ? 'text-primary-foreground' : 'text-foreground'}>{children}</li>
          ),
          code: ({ children }) => <code className={codeClass}>{children}</code>,
          pre: ({ children }) => (
            <pre
              className={`mb-2 overflow-x-auto rounded-md p-3 text-[12px] leading-relaxed ${isUser ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-foreground'}`}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`mb-2 border-l-2 pl-3 text-[13px] leading-relaxed ${borderColor} ${mutedText}`}
            >
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={
                isUser
                  ? 'underline decoration-white/50 underline-offset-2'
                  : 'text-primary underline underline-offset-2'
              }
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function ThinkingChat({
  thinkingId,
  messages,
  sources,
  pendingSources,
  loading,
  thinkingSteps,
  connectionState,
  chatFailure,
  animatingText,
  onSend,
  onSourcesUploaded,
  onSourceRemoved,
  onRetry,
  onReconnect,
  onDismissFailure
}: ThinkingChatProps): ReactElement {
  const t = useT()
  const navigate = useNavigate()
  const { success, error: toastError } = useToastStore()
  const modelAction = useModelAction()
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null)
  const [thinkingExpanded, setThinkingExpanded] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)

  const visibleThinkingSteps = thinkingSteps.filter((step) => step.summary.trim())
  const connectionLabel =
    connectionState === 'connecting'
      ? t('thinking.connectionConnecting')
      : connectionState === 'retrying'
        ? t('thinking.connectionRetrying')
        : connectionState === 'connected'
          ? t('thinking.connectionConnected')
          : connectionState === 'disconnected'
            ? t('thinking.connectionDisconnected')
            : ''

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
      })
    })
  }, [messages, loading, visibleThinkingSteps, animatingText])

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || loading || modelAction.activatingModelConfigId) return
    const modelConfigId = await modelAction.ensureModelActive()
    if (!modelConfigId) return
    onSend(text, modelConfigId)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (composingRef.current || e.nativeEvent.isComposing) return
      e.preventDefault()
      void handleSend()
    }
  }

  const handleAttachClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (files: FileList | null): Promise<void> => {
    const selectedFiles = Array.from(files || [])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (selectedFiles.length === 0) return

    const unsupportedFile = selectedFiles.find((file) => !isSupportedThinkingFile(file))
    if (unsupportedFile) {
      toastError(t('home.unsupportedFileTitle'), {
        description: t('thinking.uploadTooltip', {
          documentMaxSize: MAX_DOCUMENT_SIZE_MB,
          imageMaxSize: MAX_IMAGE_SIZE_MB
        })
      })
      return
    }

    const oversizedFile = selectedFiles.find((file) => {
      const maxSizeBytes = isSupportedImageFile(file)
        ? MAX_IMAGE_SIZE_BYTES
        : MAX_DOCUMENT_SIZE_BYTES
      return file.size > maxSizeBytes
    })
    if (oversizedFile) {
      const isImage = isSupportedImageFile(oversizedFile)
      toastError(t('home.documentTooLargeTitle'), {
        description: isImage
          ? t('home.imageTooLarge', { maxSize: MAX_IMAGE_SIZE_MB })
          : t('home.documentTooLarge', { maxSize: MAX_DOCUMENT_SIZE_MB })
      })
      return
    }

    const payloadFiles = selectedFiles
      .map((file) => ({
        path: window.electron?.getPathForFile?.(file) || '',
        name: file.name
      }))
      .filter((file) => file.path)

    if (payloadFiles.length === 0) return

    setUploading(true)
    try {
      const result = await ipc.thinkingUploadSources({
        thinkingId,
        files: payloadFiles
      })
      onSourcesUploaded(
        result.sources.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind as ThinkingSource['kind']
        }))
      )
      const hasDocumentFile = payloadFiles.some((file) =>
        SUPPORTED_DOCUMENT_EXTENSIONS.has(getFileExtension(file.name))
      )
      success(t('thinking.sourceUploaded'), {
        description: hasDocumentFile ? t('thinking.sourcePreprocessHint') : undefined
      })
    } catch (err) {
      toastError(t('thinking.uploadFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveSource = async (sourceId: string): Promise<void> => {
    if (loading || removingSourceId) return
    setRemovingSourceId(sourceId)
    try {
      await ipc.thinkingRemoveSource({ thinkingId, sourceId })
      onSourceRemoved(sourceId)
    } catch (err) {
      toastError(t('thinking.removeSourceFailed'), {
        description: err instanceof Error ? err.message : t('common.retryLater')
      })
    } finally {
      setRemovingSourceId(null)
    }
  }

  const sourceIcon = (kind: ThinkingSource['kind']): ReactElement =>
    kind === 'image' ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="flex-1 px-5 py-5" viewportRef={scrollRef}>
        {sources.length > 0 && (
          <div className="mb-4 flex justify-end">
            <div className="rounded-full bg-[var(--ui-action-soft)] px-3 py-1 text-[11px] font-semibold text-primary">
              {t('thinking.sourceCount', { count: sources.length })}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[5%_95%_10%_90%/85%_15%_85%_15%] ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-[var(--ui-focus)] text-primary-foreground'
                }`}
              >
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-foreground'
                }`}
              >
                <MessageMarkdown content={msg.content} role={msg.role} />
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.attachments.map((att) => (
                      <span
                        key={att.id}
                        className={`inline-flex max-w-[200px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          msg.role === 'user'
                            ? 'border border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground/90'
                            : 'border border-[var(--ui-border-strong)] bg-[var(--ui-action-soft)] text-primary'
                        }`}
                      >
                        {sourceIcon(att.kind)}
                        <span className="truncate">{att.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(loading || visibleThinkingSteps.length > 0) && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5%_95%_10%_90%/85%_15%_85%_15%] bg-[var(--ui-focus)] text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[78%] space-y-2">
                {/* Thinking process - collapsible */}
                {visibleThinkingSteps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setThinkingExpanded(!thinkingExpanded)}
                    className="flex w-[280px] max-w-full items-center gap-1.5 rounded-full border border-border bg-[var(--ui-surface-inset)] px-3 py-2 text-left text-[11px] text-primary transition-colors hover:bg-[var(--ui-action-soft)]"
                  >
                    {thinkingExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                    <span className="font-medium">
                      {loading ? t('thinking.thinking') : t('thinking.activityLog')}
                    </span>
                    {connectionLabel && <span className="truncate opacity-70">{connectionLabel}</span>}
                    {loading && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
                  </button>
                )}
                {thinkingExpanded && visibleThinkingSteps.length > 0 && (
                  <div className="w-[280px] max-w-full rounded-[1.25rem] border border-border bg-background">
                    <div className="space-y-1.5 px-3 py-2">
                      {visibleThinkingSteps.map((step, idx) => (
                        <div
                          key={`${step.toolName}-${step.summary}-${idx}`}
                          className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"
                        >
                          <StepIcon step={step} />
                          <span className="min-w-0 flex-1 break-words">{step.summary}</span>
                          <span className="shrink-0 text-[9px] opacity-70">
                            {step.status === 'completed'
                              ? t('thinking.activityCompleted')
                              : step.status === 'failed'
                                ? t('thinking.activityFailed')
                              : step.status === 'retrying'
                                ? t('thinking.activityRetrying')
                                : t('thinking.activityRunning')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Animated response text */}
                {loading && animatingText ? (
                  <div className="rounded-[1.5rem] border border-border bg-background px-4 py-3 text-[13px] leading-relaxed shadow-sm">
                    <MessageMarkdown content={animatingText} role="assistant" />
                  </div>
                ) : loading && visibleThinkingSteps.length === 0 ? (
                  <div className="w-[180px] rounded-[1.5rem] border border-border bg-background px-4 py-3 text-[13px] text-primary shadow-sm">
                    <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin align-[-2px]" />
                    {t('thinking.thinking')}
                  </div>
                ) : null}
              </div>
            </div>
          )}
          {!loading && chatFailure && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <WifiOff className="h-4 w-4" />
              </div>
              <div className="max-w-[82%] rounded-lg border border-destructive/25 bg-destructive/5 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      {t('thinking.replyFailedTitle')}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {chatFailure.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDismissFailure}
                    className="rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                    title={t('thinking.dismissFailure')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--ui-action)] px-3 text-[11px] font-semibold text-primary-foreground hover:bg-[var(--ui-action-hover)]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t('thinking.retry')}
                  </button>
                  {chatFailure.reconnectable && (
                    <button
                      type="button"
                      onClick={onReconnect}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[11px] font-medium text-foreground hover:bg-muted"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t('thinking.reconnect')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/settings?tab=model')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {t('thinking.checkModelSettings')}
                  </button>
                </div>
                {chatFailure.technicalDetail && (
                  <details className="mt-3 text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      {t('thinking.technicalDetails')}
                    </summary>
                    <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/5 p-2 font-mono leading-relaxed">
                      {chatFailure.technicalDetail}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-[var(--ui-surface-elevated)] px-4 py-3">
        <div className="rounded-xl border border-border bg-background px-2 py-2 shadow-sm focus-within:border-[var(--ui-focus)] focus-within:ring-2 focus-within:ring-[var(--ui-action-soft)]">
          {pendingSources.length > 0 && (
            <div className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto px-2 pb-1.5">
              {pendingSources.map((source) => (
                <span
                  key={source.id}
                  className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-[var(--ui-border-strong)] bg-[var(--ui-action-soft)] px-2.5 py-1 text-[10px] font-medium text-primary"
                >
                  {sourceIcon(source.kind)}
                  <span className="truncate">{source.name}</span>
                  <button
                    type="button"
                    className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--ui-selected)] disabled:opacity-40"
                    onClick={() => void handleRemoveSource(source.id)}
                    disabled={loading || removingSourceId === source.id}
                    title={t('thinking.removeSource')}
                  >
                    {removingSourceId === source.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    disabled={loading || uploading}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-[var(--ui-action-soft)] hover:text-foreground disabled:opacity-40"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-[12px]">
                  {t('thinking.uploadTooltip', {
                    documentMaxSize: MAX_DOCUMENT_SIZE_MB,
                    imageMaxSize: MAX_IMAGE_SIZE_MB
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <textarea
              className="max-h-36 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder={t('thinking.inputPlaceholder')}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onCompositionStart={() => {
                composingRef.current = true
              }}
              onCompositionEnd={() => {
                composingRef.current = false
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="flex shrink-0 items-center gap-1">
              <ModelSelectButton modelAction={modelAction} disabled={loading} />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={loading || Boolean(modelAction.activatingModelConfigId) || !input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[var(--ui-action-hover)] disabled:opacity-40 disabled:hover:bg-primary"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.text,.csv,.docx,.png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={(event) => void handleFilesSelected(event.target.files)}
        />
      </div>
    </div>
  )
}
