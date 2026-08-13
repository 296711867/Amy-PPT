export async function resolveThinkingHistoryStoragePath(args: {
  readStoragePath: () => Promise<unknown>
  resolveStoragePath: () => Promise<string>
}): Promise<string | null> {
  const savedStoragePath = await args.readStoragePath()
  if (typeof savedStoragePath !== 'string' || savedStoragePath.trim().length === 0) return null
  return args.resolveStoragePath()
}
