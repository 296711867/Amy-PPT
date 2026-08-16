/**
 * Counting semaphore whose capacity can be lowered mid-run. p-limit 3.x fixes
 * concurrency at creation, but a rate-limited provider needs a live downgrade
 * from 2 parallel pages to 1 without dropping queued pages.
 *
 * Capacity only ever shrinks within a run (downgrade-on-throttle); raising it
 * back would re-trigger the same provider limit.
 */
export interface RuntimeConcurrencyGate {
  acquire(): Promise<void>
  release(): void
  /** Lower the capacity; queued acquires honor the new value immediately. */
  downgradeCapacity(capacity: number): void
  readonly capacity: number
  readonly activeCount: number
}

export function createRuntimeConcurrencyGate(initialCapacity: number): RuntimeConcurrencyGate {
  let capacity = Math.max(1, Math.floor(initialCapacity))
  let active = 0
  const waiters: Array<() => void> = []

  const pump = (): void => {
    while (active < capacity && waiters.length > 0) {
      active += 1
      waiters.shift()!()
    }
  }

  return {
    acquire: () =>
      new Promise<void>((resolve) => {
        waiters.push(resolve)
        pump()
      }),
    release: () => {
      active = Math.max(0, active - 1)
      pump()
    },
    downgradeCapacity: (nextCapacity) => {
      const target = Math.max(1, Math.floor(nextCapacity))
      if (target >= capacity) return
      capacity = target
    },
    get capacity() {
      return capacity
    },
    get activeCount() {
      return active
    }
  }
}
