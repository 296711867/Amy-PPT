export interface WritableErrorStream {
  isTTY?: boolean
  on(event: 'error', listener: (error: NodeJS.ErrnoException) => void): unknown
}

export function canUseConsoleTransport(streams: readonly WritableErrorStream[]): boolean {
  return streams.length > 0 && streams.every((stream) => stream.isTTY === true)
}

export function attachBrokenPipeGuard(
  stream: WritableErrorStream,
  onBrokenPipe: () => void
): void {
  stream.on('error', (error) => {
    if (error?.code === 'EPIPE') {
      onBrokenPipe()
      return
    }
    throw error
  })
}

export function installLoggingStreamGuards(
  streams: readonly WritableErrorStream[],
  disableConsoleTransport: () => void
): void {
  let consoleTransportDisabled = false
  const disableOnce = (): void => {
    if (consoleTransportDisabled) return
    consoleTransportDisabled = true
    disableConsoleTransport()
  }

  for (const stream of streams) attachBrokenPipeGuard(stream, disableOnce)
}
