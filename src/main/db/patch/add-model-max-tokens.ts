import type { createClient } from '@libsql/client'

type LibSqlClient = ReturnType<typeof createClient>

/**
 * Patch: add max_tokens column to model_configs table.
 * Default 4096 (safe for GLM series, reasonable for most models).
 */
export const patchModelConfigMaxTokens = async (client: LibSqlClient): Promise<void> => {
  // Check if column already exists
  const cols = await client.execute("PRAGMA table_info('model_configs')")
  const hasMaxTokens = cols.rows.some((r) => r.name === 'max_tokens')
  if (hasMaxTokens) return

  await client.execute(
    "ALTER TABLE model_configs ADD COLUMN max_tokens INTEGER NOT NULL DEFAULT 4096"
  )
}
