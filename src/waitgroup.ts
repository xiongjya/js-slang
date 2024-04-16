import { ThreadId } from "./scheduler";

export default class WaitGroup {
private _count: number
private _waiters: ThreadId[]

constructor() {
    this._count = 0
    this._waiters = []
}

// Delta may be +ve or -ve
// Returns all threads that need to be unblocked
Add(delta: number): ThreadId[] {
    this._count += delta;
    if (delta > 0 && this._waiters.length > 0) {
        throw new Error("WaitGroup misuse: Add called concurrently with Wait")
    }
    if (this._count < 0) {
        throw new Error("Negative WaitGroup counter")
    }
    let res: ThreadId[] = [];
    if (this._count == 0) {
        res = this._waiters;
        this._waiters = [];
    }
    return res;
}

// Return true if wait returns immediately, false if wait has to block
Try_Wait(id: ThreadId): boolean {
    if (this._count > 0) {
        this._waiters.push(id)
        return false;
    }
    return true;
}


}