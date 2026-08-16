import { describe, expect, it } from 'vitest'
import { createRuntimeConcurrencyGate } from '../../../src/main/generation/concurrency-gate'
import {
  normalizePageConcurrencyPreference,
  resolvePageWorkerCount
} from '../../../src/shared/page-concurrency'

describe('page concurrency preference', () => {
  it('normalizes stored values and falls back to auto', () => {
    expect(normalizePageConcurrencyPreference('serial')).toBe('serial')
    expect(normalizePageConcurrencyPreference('parallel')).toBe('parallel')
    expect(normalizePageConcurrencyPreference('auto')).toBe('auto')
    expect(normalizePageConcurrencyPreference(undefined)).toBe('auto')
    expect(normalizePageConcurrencyPreference('turbo')).toBe('auto')
    expect(normalizePageConcurrencyPreference(2)).toBe('auto')
  })

  it('resolves worker counts per preference', () => {
    expect(resolvePageWorkerCount('serial', 10)).toBe(1)
    expect(resolvePageWorkerCount('parallel', 2)).toBe(2)
    expect(resolvePageWorkerCount('parallel', 1)).toBe(1)
    // auto keeps the historical thresholds: dual queue from 3 pages on
    expect(resolvePageWorkerCount('auto', 3)).toBe(2)
    expect(resolvePageWorkerCount('auto', 2)).toBe(1)
  })
})

describe('createRuntimeConcurrencyGate', () => {
  it('allows up to the initial capacity concurrently', async () => {
    const gate = createRuntimeConcurrencyGate(2)
    let active = 0
    let peak = 0
    const task = async (): Promise<void> => {
      await gate.acquire()
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      gate.release()
    }
    await Promise.all(Array.from({ length: 5 }, task))

    expect(peak).toBe(2)
    expect(gate.activeCount).toBe(0)
  })

  it('downgrades capacity so queued tasks run serially', async () => {
    const gate = createRuntimeConcurrencyGate(2)
    const started: number[] = []
    let active = 0
    let peak = 0
    const task = async (id: number): Promise<void> => {
      await gate.acquire()
      active += 1
      peak = Math.max(peak, active)
      started.push(id)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      gate.release()
    }

    const all = Promise.all([task(1), task(2), task(3)])
    gate.downgradeCapacity(1)
    await all

    expect(gate.capacity).toBe(1)
    expect(peak).toBeLessThanOrEqual(2)
    expect(started).toEqual([1, 2, 3])
  })

  it('never upgrades capacity through downgradeCapacity', () => {
    const gate = createRuntimeConcurrencyGate(1)
    gate.downgradeCapacity(2)
    expect(gate.capacity).toBe(1)
  })
})
