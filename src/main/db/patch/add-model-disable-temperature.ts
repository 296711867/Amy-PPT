import type { createClient } from '@libsql/client'

type LibSqlClient = ReturnType<typeof createClient>

/**
 * Patch: add disable_temperature column to model_configs table.
 * Default 0 (temperature is sent). When 1, temperature param is omitted.
 */
export const patchModelConfigDisableTemperature = async (client: LibSqlClient): Promise<void> => {
  const cols = await client.execute("PRAGMA table_info('model_configs')")
  const hasColumn = cols.rows.some((r) => r.name === 'disable_temperature')
  if (hasColumn) return

  await client.execute(
    "ALTER TABLE model_configs ADD COLUMN disable_temperature INTEGER NOT NULL DEFAULT 0"
  )
}
