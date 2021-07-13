import {
  scheduleCallback as Scheduler_scheduleCallback,
  cancelCallback as scheduleCancelCallback,
  Scheduler_ImmediatePriority,
  Scheduler_UserBlockingPriority,
  Scheduler_NormalPriority,
  Scheduler_LowPriority,
  Scheduler_IdlePriority,
  runWithPriority as Scheduler_runWithPriority,
} from '../scheduler/index.js'

export const ImmediatePriority = 99
export const UserBlockingPriority = 98
export const NormalPriority = 97
export const LowPriority = 96
export const IdlePriority = 95
export const NoPriority = 90

let syncQueue = null
let immediateQueueCallbackNode = null
let isFlushingSyncQueue = false

export function flushSyncCallbackQueue() {
  if (immediateQueueCallbackNode !== null) {
    const node = immediateQueueCallbackNode
    immediateQueueCallbackNode = null
    scheduleCancelCallback(node)
  }
  flushSyncCallbackQueueImpl()
}

export function flushSyncCallbackQueueImpl() {
  if (!isFlushingSyncQueue && syncQueue !== null) {
    // Prevent re-entrancy.
    isFlushingSyncQueue = true
    let i = 0
    try {
      const isSync = true
      const queue = syncQueue
      runWithPriority(ImmediatePriority, () => {
        for (; i < queue.length; i++) {
          let callback = queue[i]
          do {
            callback = callback(isSync)
          } while (callback)
        }
      })
      syncQueue = null
    } catch (error) {
      // If something throws, leave the remaining callbacks on the queue.
      if (syncQueue !== null) {
        syncQueue = syncQueue.slice(i + 1)
      }
      Scheduler_scheduleCallback(
        Scheduler_ImmediatePriority,
        flushSyncCallbackQueue
      )
      throw error
    } finally {
      isFlushingSyncQueue = false
    }
  }
}
export function cancelCallback(callbackNode) {
  if (callbackNode !== {}) {
    scheduleCancelCallback(callbackNode)
  }
}

export function scheduleSyncCallback(callback) {
  if (syncQueue === null) {
    syncQueue = [callback]
    immediateQueueCallbackNode = Scheduler_scheduleCallback(
      Scheduler_ImmediatePriority,
      flushSyncCallbackQueueImpl
    )
  } else {
    syncQueue.push(callback)
  }
  return {}
}

function reactPriorityToSchedulerPriority(reactPriorityLevel) {
  switch (reactPriorityLevel) {
    case ImmediatePriority:
      return Scheduler_ImmediatePriority
    case UserBlockingPriority:
      return Scheduler_UserBlockingPriority
    case NormalPriority:
      return Scheduler_NormalPriority
    case LowPriority:
      return Scheduler_LowPriority
    case IdlePriority:
      return Scheduler_IdlePriority
    default:
      return
  }
}

export function runWithPriority(reactPriorityLevel, fn) {
  const priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel)
  return Scheduler_runWithPriority(priorityLevel, fn)
}

export function scheduleCallback(reactPriorityLevel, callback, options) {
  const priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel)
  return Scheduler_scheduleCallback(priorityLevel, callback, options)
}
