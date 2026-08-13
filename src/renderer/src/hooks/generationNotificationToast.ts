type GenerationNotificationTranslate = (
  key:
    | 'generationNotifications.completed'
    | 'generationNotifications.partial'
    | 'generationNotifications.paused'
    | 'generationNotifications.failed',
  params?: Record<string, string | number>
) => string

type GenerationNotificationAction = {
  label: string
  onClick: () => void
}

type GenerationNotificationEvent =
  | {
      type: 'run_completed'
      payload: {
        failedPageCount?: number
      }
    }
  | {
      type: 'run_error'
      payload: {
        message?: string
      }
    }
  | {
      type: 'run_paused'
      payload: {
        message?: string
      }
    }

export type GenerationNotificationToast = {
  type: 'success' | 'warning' | 'error'
  message: string
  options: {
    action: GenerationNotificationAction
    duration: number
    description?: string
  }
}

export function createGenerationNotificationToast({
  event,
  title,
  action,
  t
}: {
  event: GenerationNotificationEvent
  title: string
  action: GenerationNotificationAction
  t: GenerationNotificationTranslate
}): GenerationNotificationToast {
  if (event.type === 'run_completed') {
    const failedPageCount = Math.max(0, Number(event.payload.failedPageCount) || 0)
    if (failedPageCount > 0) {
      return {
        type: 'warning',
        message: t('generationNotifications.partial', { title, count: failedPageCount }),
        options: {
          action,
          duration: 8000
        }
      }
    }

    return {
      type: 'success',
      message: t('generationNotifications.completed', { title }),
      options: {
        action,
        duration: 6000
      }
    }
  }

  if (event.type === 'run_paused') {
    return {
      type: 'warning',
      message: t('generationNotifications.paused', { title }),
      options: {
        action,
        duration: 10000,
        description: event.payload.message
      }
    }
  }

  return {
    type: 'error',
    message: t('generationNotifications.failed', { title }),
    options: {
      action,
      duration: 8000
    }
  }
}
