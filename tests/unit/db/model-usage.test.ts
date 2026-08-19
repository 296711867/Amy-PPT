import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rmWithRetry } from '../../helpers/rm-retry'
import * as schema from '../../../src/main/db/schema'
import { runDatabasePatches } from '../../../src/main/db/patch'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'ohmyppt-test-user-data'))
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import { PPTDatabase } from '../../../src/main/db/database'

describe('model usage session persistence', () => {
  const roots: string[] = []

  afterEach(async () => {
    for (const root of roots.splice(0)) await rmWithRetry(root)
  })

  it('adds session_id and its index to an existing usage table idempotently', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ohmyppt-model-usage-'))
    roots.push(root)
    const dbPath = path.join(root, 'legacy.db')
    const client = createClient({ url: `file:${dbPath}` })
    await client.execute(`
      CREATE TABLE model_usage_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        model_config_id TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        usage_source TEXT NOT NULL DEFAULT 'provider',
        created_at INTEGER NOT NULL
      )
    `)
    await runDatabasePatches({
      client,
      db: drizzle(client, { schema }),
      resolveStoragePath: async () => ''
    })
    await runDatabasePatches({
      client,
      db: drizzle(client, { schema }),
      resolveStoragePath: async () => ''
    })

    const columns = await client.execute('PRAGMA table_info(model_usage_events)')
    const columnNames = columns.rows.map((row) =>
      String((row as Record<string, unknown>).name || '')
    )
    expect(columnNames).toContain('session_id')

    const indexes = await client.execute('PRAGMA index_list(model_usage_events)')
    const indexNames = indexes.rows.map((row) =>
      String((row as Record<string, unknown>).name || '')
    )
    expect(indexNames).toContain('idx_model_usage_events_session')
    await client.close()
  })

  it('persists session ids and distinguishes un-attributed usage from zero usage', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ohmyppt-model-usage-'))
    roots.push(root)
    const db = new PPTDatabase(path.join(root, 'test.db'))
    await db.init()

    try {
      const attributedSessionId = await db.createSession({
        title: 'Attributed',
        topic: 'Attributed',
        slideSizeId: 'wide-16-9',
        slideWidth: 1600,
        slideHeight: 900,
        provider: 'test',
        model: 'test-model'
      })
      const emptySessionId = await db.createSession({
        title: 'No usage',
        topic: 'No usage',
        slideSizeId: 'wide-16-9',
        slideWidth: 1600,
        slideHeight: 900,
        provider: 'test',
        model: 'test-model'
      })

      await db.recordModelUsage({
        provider: 'test',
        model: 'test-model',
        sessionId: attributedSessionId,
        inputTokens: 7,
        outputTokens: 5,
        totalTokens: 12,
        source: 'provider'
      })
      await db.recordModelUsage({
        provider: 'test',
        model: 'test-model',
        sessionId: attributedSessionId,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        source: 'estimated'
      })
      await db.recordModelUsage({
        provider: 'test',
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        source: 'provider'
      })

      const sessions = await db.listSessions()
      expect(sessions.find((session) => session.id === attributedSessionId)?.totalTokens).toBe(12)
      expect(sessions.find((session) => session.id === emptySessionId)?.totalTokens).toBeNull()
    } finally {
      await db.close()
    }
  })
})
