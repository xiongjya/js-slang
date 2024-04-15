export type ThreadId = number

export class Scheduler {
  private _runningThreads: Set<ThreadId> = new Set()
  private _blockedThreads: Set<ThreadId> = new Set()
  private _idleThreads: ThreadId[] = []
  private _maxThreadId = -1
  private _maxTimeQuanta: number = 15

  // Register a new thread into the scheduler (thread has never run before)
  // Returns the thread id this new thread should be associated with
  newThread(): ThreadId {
    this._maxThreadId++
    this._idleThreads.push(this._maxThreadId)
    return this._maxThreadId
  }

  // Unregister a thread from the scheduler (end of life/killed)
  // Thread should be currently executing
  deleteCurrentThread(id: ThreadId): void {
    this._runningThreads.delete(id)
  }

  // Get which thread should be executed next, and for how long
  // null means there are no idle threads to run
  // ready -> running
  selectNextThread(): [ThreadId, number] | null {
    if (this._idleThreads.length === 0) {
      return null // possible to do deadlock detection actually => if blockedThreads.length > 0
    } else {
      const nextThread = this._idleThreads.shift()!
      const timeQuanta = Math.ceil((0.5 + Math.random() * 0.5) * this._maxTimeQuanta)
      this._runningThreads.add(nextThread)
      return [nextThread, timeQuanta]
    }
  }

  // running -> ready
  pauseThread(id: ThreadId): void {
    this._runningThreads.delete(id)
    this._idleThreads.push(id)
  }

  // runnning -> blocked
  blockThread(id: ThreadId): void {
    this._runningThreads.delete(id)
    this._blockedThreads.add(id)
  }

  // blocked -> ready
  unblockThread(id: ThreadId): void {
    this._blockedThreads.delete(id)
    this._idleThreads.push(id)
  }

  hasIdleThreads(): boolean {
    return this._idleThreads.length > 0
  }
}
