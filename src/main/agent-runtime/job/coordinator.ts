import {
  createAbortError,
  ResourceLock,
  resourceClaimsConflict,
  type ReleaseFunc
} from '../lock/resource-lock'
import type {
  ActiveJob,
  JobLease,
  JobOwner,
  JobReservationArgs,
  JobReservationResult
} from './types'

type ManagedJob = ActiveJob & {
  ownerToken: symbol
  controller: AbortController
  releaseLock?: ReleaseFunc
  removeExternalAbortListener: () => void
  released: boolean
}

const ownerKey = (owner: JobOwner): string => `${owner.kind}:${owner.id}`

const relayAbort = (source: AbortSignal | undefined, target: AbortController): (() => void) => {
  if (!source) return () => undefined
  const abort = (): void => target.abort(source.reason)
  if (source.aborted) {
    abort()
    return () => undefined
  }
  source.addEventListener('abort', abort, { once: true })
  return () => source.removeEventListener('abort', abort)
}

/** The sole owner of resource claims and run-level cancellation for Runtime jobs. */
export class JobCoordinator {
  private readonly lock: ResourceLock
  private readonly jobsById = new Map<string, ManagedJob>()
  private readonly jobIdByOwner = new Map<string, string>()
  private readonly suspendedOwners = new Map<string, number>()
  private readonly ownerIdleWaiters = new Map<string, Set<() => void>>()

  constructor(lock = new ResourceLock()) {
    this.lock = lock
  }

  async reserve(args: JobReservationArgs): Promise<JobReservationResult> {
    if (args.wait === 'fail') return this.tryReserve(args)
    if (this.suspendedOwners.has(ownerKey(args.owner))) {
      return { status: 'busy', conflictingJobId: `lifecycle:${ownerKey(args.owner)}` }
    }
    if (this.jobsById.has(args.jobId)) {
      return { status: 'busy', conflictingJobId: args.jobId }
    }
    const existingJobId = this.jobIdByOwner.get(ownerKey(args.owner))
    if (existingJobId) return { status: 'busy', conflictingJobId: existingJobId }
    if (args.signal?.aborted) throw createAbortError()

    const controller = new AbortController()
    const job: ManagedJob = {
      jobId: args.jobId,
      domain: args.domain,
      owner: args.owner,
      state: 'waiting',
      claims: args.claims,
      ownerToken: Symbol(args.jobId),
      controller,
      removeExternalAbortListener: relayAbort(args.signal, controller),
      released: false
    }
    this.jobsById.set(job.jobId, job)
    this.jobIdByOwner.set(ownerKey(job.owner), job.jobId)

    try {
      const releaseLock = await this.lock.acquire(job.claims, {
        ownerToken: job.ownerToken,
        signal: controller.signal,
        wait: args.wait
      })
      if (!releaseLock) {
        const conflictingJobId = this.findConflictingJobId(job)
        this.removeJob(job)
        if (!conflictingJobId) {
          throw new Error('ResourceLock reported a conflict without a registered Runtime job')
        }
        return { status: 'busy', conflictingJobId }
      }

      job.releaseLock = releaseLock
      job.state = 'active'
      return {
        status: 'acquired',
        lease: this.createLease(job)
      }
    } catch (error) {
      this.removeJob(job)
      throw error
    }
  }

  /**
   * Non-waiting variant for old synchronous IPC handlers. It keeps the same
   * owner map, claims, and cancellation controller as async reserve().
   */
  tryReserve(args: JobReservationArgs): JobReservationResult {
    if (args.wait !== 'fail') {
      throw new Error('JobCoordinator.tryReserve only supports wait=fail')
    }
    if (this.suspendedOwners.has(ownerKey(args.owner))) {
      return { status: 'busy', conflictingJobId: `lifecycle:${ownerKey(args.owner)}` }
    }
    if (this.jobsById.has(args.jobId)) {
      return { status: 'busy', conflictingJobId: args.jobId }
    }
    const existingJobId = this.jobIdByOwner.get(ownerKey(args.owner))
    if (existingJobId) return { status: 'busy', conflictingJobId: existingJobId }
    if (args.signal?.aborted) throw createAbortError()

    const controller = new AbortController()
    const job: ManagedJob = {
      jobId: args.jobId,
      domain: args.domain,
      owner: args.owner,
      state: 'waiting',
      claims: args.claims,
      ownerToken: Symbol(args.jobId),
      controller,
      removeExternalAbortListener: relayAbort(args.signal, controller),
      released: false
    }
    this.jobsById.set(job.jobId, job)
    this.jobIdByOwner.set(ownerKey(job.owner), job.jobId)

    try {
      const releaseLock = this.lock.tryAcquire(job.claims, {
        ownerToken: job.ownerToken,
        signal: controller.signal
      })
      if (!releaseLock) {
        const conflictingJobId = this.findConflictingJobId(job)
        this.removeJob(job)
        if (!conflictingJobId) {
          throw new Error('ResourceLock reported a conflict without a registered Runtime job')
        }
        return { status: 'busy', conflictingJobId }
      }

      job.releaseLock = releaseLock
      job.state = 'active'
      return { status: 'acquired', lease: this.createLease(job) }
    } catch (error) {
      this.removeJob(job)
      throw error
    }
  }

  cancel(jobId: string): boolean {
    const job = this.jobsById.get(jobId)
    if (!job || job.controller.signal.aborted) return false
    job.controller.abort()
    return true
  }

  cancelOwner(owner: JobOwner): number {
    let cancelled = 0
    for (const job of this.jobsById.values()) {
      if (job.owner.kind === owner.kind && job.owner.id === owner.id && this.cancel(job.jobId)) {
        cancelled += 1
      }
    }
    return cancelled
  }

  async suspendOwners(owners: JobOwner[], timeoutMs = 15_000): Promise<() => void> {
    const uniqueOwners = [...new Map(owners.map((owner) => [ownerKey(owner), owner])).values()]
    for (const owner of uniqueOwners) {
      const key = ownerKey(owner)
      this.suspendedOwners.set(key, (this.suspendedOwners.get(key) || 0) + 1)
    }

    try {
      for (const owner of uniqueOwners) this.cancelOwner(owner)
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          Promise.all(uniqueOwners.map((owner) => this.waitForOwnerIdle(owner))),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Timed out waiting for active session work to stop')),
              timeoutMs
            )
          })
        ])
      } finally {
        if (timeout) clearTimeout(timeout)
      }
    } catch (error) {
      this.releaseSuspendedOwners(uniqueOwners)
      throw error
    }

    let released = false
    return () => {
      if (released) return
      released = true
      this.releaseSuspendedOwners(uniqueOwners)
    }
  }

  getByOwner(owner: JobOwner): ActiveJob | null {
    const jobId = this.jobIdByOwner.get(ownerKey(owner))
    const job = jobId ? this.jobsById.get(jobId) : undefined
    return job ? this.toActiveJob(job) : null
  }

  private createLease(job: ManagedJob): JobLease {
    return {
      jobId: job.jobId,
      signal: job.controller.signal,
      release: () => this.release(job)
    }
  }

  private release(job: ManagedJob): void {
    if (job.released) return
    job.released = true
    job.releaseLock?.()
    this.removeJob(job)
  }

  private removeJob(job: ManagedJob): void {
    job.removeExternalAbortListener()
    if (this.jobsById.get(job.jobId) === job) this.jobsById.delete(job.jobId)
    if (this.jobIdByOwner.get(ownerKey(job.owner)) === job.jobId) {
      this.jobIdByOwner.delete(ownerKey(job.owner))
      const waiters = this.ownerIdleWaiters.get(ownerKey(job.owner))
      this.ownerIdleWaiters.delete(ownerKey(job.owner))
      waiters?.forEach((resolve) => resolve())
    }
  }

  private waitForOwnerIdle(owner: JobOwner): Promise<void> {
    const key = ownerKey(owner)
    if (!this.jobIdByOwner.has(key)) return Promise.resolve()
    return new Promise((resolve) => {
      const waiters = this.ownerIdleWaiters.get(key) || new Set<() => void>()
      waiters.add(resolve)
      this.ownerIdleWaiters.set(key, waiters)
      if (!this.jobIdByOwner.has(key)) {
        waiters.delete(resolve)
        resolve()
      }
    })
  }

  private releaseSuspendedOwners(owners: JobOwner[]): void {
    for (const owner of owners) {
      const key = ownerKey(owner)
      const count = this.suspendedOwners.get(key) || 0
      if (count <= 1) this.suspendedOwners.delete(key)
      else this.suspendedOwners.set(key, count - 1)
    }
  }

  private findConflictingJobId(job: ManagedJob): string | undefined {
    for (const candidate of this.jobsById.values()) {
      if (candidate === job) continue
      if (resourceClaimsConflict(job.claims, candidate.claims)) return candidate.jobId
    }
    return undefined
  }

  private toActiveJob(job: ManagedJob): ActiveJob {
    return {
      jobId: job.jobId,
      domain: job.domain,
      owner: job.owner,
      state: job.state,
      claims: job.claims
    }
  }
}
