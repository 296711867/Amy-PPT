import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import {
  isAllowedIpcEventChannel,
  isAllowedIpcInvokeChannel
} from '@shared/ipc-channels'

type RendererListener = (event: unknown, ...args: any[]) => void
type WrappedRendererListener = (event: IpcRendererEvent, ...args: any[]) => void

const wrappedListeners = new Map<string, Map<RendererListener, WrappedRendererListener>>()

const assertAllowedChannel = (
  kind: 'invoke' | 'event',
  channel: unknown
): void => {
  const allowed =
    typeof channel === 'string' &&
    (kind === 'invoke' ? isAllowedIpcInvokeChannel(channel) : isAllowedIpcEventChannel(channel))
  if (!allowed) {
    throw new Error(`IPC ${kind} channel is not allowed: ${String(channel)}`)
  }
}

const ipcRendererApi = Object.freeze({
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    assertAllowedChannel('invoke', channel)
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: RendererListener): void => {
    assertAllowedChannel('event', channel)
    let listenersForChannel = wrappedListeners.get(channel)
    if (!listenersForChannel) {
      listenersForChannel = new Map()
      wrappedListeners.set(channel, listenersForChannel)
    }

    const previous = listenersForChannel.get(listener)
    if (previous) ipcRenderer.removeListener(channel, previous)

    const wrapped: WrappedRendererListener = (_event, ...args) => {
      listener(undefined, ...args)
    }
    listenersForChannel.set(listener, wrapped)
    ipcRenderer.on(channel, wrapped)
  },
  removeListener: (channel: string, listener: RendererListener): void => {
    assertAllowedChannel('event', channel)
    const listenersForChannel = wrappedListeners.get(channel)
    const wrapped = listenersForChannel?.get(listener)
    if (!wrapped) return

    ipcRenderer.removeListener(channel, wrapped)
    listenersForChannel?.delete(listener)
    if (listenersForChannel?.size === 0) wrappedListeners.delete(channel)
  }
})

const api = Object.freeze({
  ipcRenderer: ipcRendererApi,
  process: Object.freeze({ platform: process.platform }),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = api
}
