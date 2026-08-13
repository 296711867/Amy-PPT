import type { ReactNode } from 'react'
import { useSessionDetailUiStore } from '@renderer/store'
import { MessagePanel } from '../../ai-panel'
import { SpeechScriptDrawer } from '../../speech'
import { sessionDetailRightPanelClass } from './styles'

interface SessionDetailRightPanelProps {
  sessionId: string
  elementInspector?: ReactNode
}

export function SessionDetailRightPanel({
  sessionId,
  elementInspector
}: SessionDetailRightPanelProps): React.JSX.Element | null {
  const workspaceTab = useSessionDetailUiStore((state) => state.workspaceTab)
  const speechScriptDialogOpen = useSessionDetailUiStore(
    (state) => state.speechScriptDialogOpen
  )

  if (!speechScriptDialogOpen && workspaceTab !== 'ai' && !elementInspector) return null

  return (
    <aside className={sessionDetailRightPanelClass}>
      {speechScriptDialogOpen ? (
        <SpeechScriptDrawer sessionId={sessionId} />
      ) : workspaceTab === 'ai' ? (
        <MessagePanel sessionId={sessionId} />
      ) : (
        elementInspector
      )}
    </aside>
  )
}
