import type { IpcRendererEvent } from 'electron'

type IpcRendererListener = (event: unknown, ...args: any[]) => void

interface RendererIpcApi {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: IpcRendererListener): void
  removeListener(channel: string, listener: IpcRendererListener): void
}

declare global {
  interface Window {
    electron: {
      ipcRenderer: RendererIpcApi
      process: {
        readonly platform: string
      }
      getPathForFile: (file: File) => string
    }
  }
}
