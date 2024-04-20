import Heap, { address } from './heap'
import { ThreadId } from './scheduler'

export default class WaitGroup {
  private _addr: number
  private _waiters: ThreadId[]

  constructor(address: address) {
    this._addr = address
    this._waiters = []
  }

  // Delta may be +ve or -ve
  // Returns all threads that need to be unblocked
  Add(delta: number, heap: Heap): ThreadId[] {
    const count = heap.address_to_JS_value(this._addr) + delta;
    heap.heap_change_Number(this._addr, count)
    if (delta > 0 && this._waiters.length > 0) {
      throw new Error('WaitGroup misuse: Add called concurrently with Wait')
    }
    if (count < 0) {
      throw new Error('Negative WaitGroup counter')
    }
    let res: ThreadId[] = []
    if (count == 0) {
      res = this._waiters
      this._waiters = []
    }
    return res
  }

  // Return true if wait returns immediately, false if wait has to block
  Try_Wait(id: ThreadId, heap: Heap): boolean {
    if (heap.address_to_JS_value(this._addr) > 0) {
      this._waiters.push(id)
      return false
    }
    return true
  }
}
