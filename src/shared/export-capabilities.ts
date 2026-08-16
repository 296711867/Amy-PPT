export type ExportCapabilityReason = 'ffmpeg-missing' | 'ffmpeg-check-failed'

export type ExportCapability = {
  available: boolean
  reason: ExportCapabilityReason | null
}

export type ExportCapabilities = {
  video: ExportCapability
}
