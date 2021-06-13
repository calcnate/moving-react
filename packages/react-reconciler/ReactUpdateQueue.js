import {
  Callback,
  ShouldCapture,
  DidCapture,
} from '../shared/ReactSideEffectTags.js'

export const UpdateState = 0
export const ReplaceState = 1
export const ForceUpdate = 2
export const CaptureUpdate = 3

export function initializeUpdateQueue(fiber) {
  const queue = {
    baseState: fiber.memoizedState,
    baseQueue: null,
    shared: {
      pending: null,
    },
    effects: null,
  }
  fiber.updateQueue = queue
}

export function createUpdate(expirationTime) {
  let update = {
    expirationTime,
    tag: 0,
    payload: null,
    callback: null,
    next: null,
  }
  update.next = update
  return update
}

export function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue
  if (updateQueue === null) {
    return
  }

  const sharedQueue = updateQueue.shared
  const pending = sharedQueue.pending
  if (pending === null) {
    update.next = update
  } else {
    update.next = pending.next
    pending.next = update
  }
  sharedQueue.pending = update
}

export function cloneUpdateQueue(current, workInProgress) {
  const queue = workInProgress.updateQueue
  const currentQueue = current.updateQueue
  if (queue === currentQueue) {
    const clone = {
      baseState: currentQueue.baseState,
      baseQueue: currentQueue.baseQueue,
      shared: currentQueue.shared,
      effects: currentQueue.effects,
    }
    workInProgress.updateQueue = clone
  }
}

export function processUpdateQueue(
  workInProgress,
  props,
  instance,
  renderExpirationTime
) {
  const queue = workInProgress.updateQueue

  let baseQueue = queue.baseQueue

  let pendingQueue = queue.shared.pending
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      let baseFirst = baseQueue.next
      let pendingFirst = pendingQueue.next
      baseQueue.next = pendingFirst
      pendingQueue.next = baseFirst
    }

    baseQueue = pendingQueue

    queue.shared.pending = null

    const current = workInProgress.alternate
    if (current !== null) {
      const currentQueue = current.updateQueue
      if (currentQueue !== null) {
        currentQueue.baseQueue = pendingQueue
      }
    }
  }

  if (baseQueue !== null) {
    let first = baseQueue.next
    let newState = queue.baseState
    let newExpirationTime = 0

    let newBaseState = null
    let newBaseQueueFirst = null
    let newBaseQueueLast = null

    if (first !== null) {
      let update = first
      do {
        const updateExpirationTime = update.expirationTime
        if (updateExpirationTime < renderExpirationTime) {
          const clone = {
            expirationTime: update.expirationTime,
            suspenseConfig: update.suspenseConfig,

            tag: update.tag,
            payload: update.payload,
            callback: update.callback,

            next: null,
          }
          if (newBaseQueueLast === null) {
            newBaseQueueFirst = newBaseQueueLast = clone
            newBaseState = newState
          } else {
            newBaseQueueLast = newBaseQueueLast.next = clone
          }
          if (updateExpirationTime > newExpirationTime) {
            newExpirationTime = updateExpirationTime
          }
        } else {
          if (newBaseQueueLast !== null) {
            const clone = {
              expirationTime: 1073741823, // This update is going to be committed so we never want uncommit it.
              suspenseConfig: update.suspenseConfig,

              tag: update.tag,
              payload: update.payload,
              callback: update.callback,

              next: null,
            }
            newBaseQueueLast = newBaseQueueLast.next = clone
          }

          newState = getStateFromUpdate(
            workInProgress,
            queue,
            update,
            newState,
            props,
            instance
          )
          const callback = update.callback
          if (callback !== null) {
            workInProgress.effectTag |= Callback
            let effects = queue.effects
            if (effects === null) {
              queue.effects = [update]
            } else {
              effects.push(update)
            }
          }
        }
        update = update.next
        if (update === null || update === first) {
          pendingQueue = queue.shared.pending
          if (pendingQueue === null) {
            break
          } else {
            update = baseQueue.next = pendingQueue.next
            pendingQueue.next = first
            queue.baseQueue = baseQueue = pendingQueue
            queue.shared.pending = null
          }
        }
      } while (true)
    }

    if (newBaseQueueLast === null) {
      newBaseState = newState
    } else {
      newBaseQueueLast.next = newBaseQueueFirst
    }

    queue.baseState = newBaseState
    queue.baseQueue = newBaseQueueLast

    workInProgress.expirationTime = newExpirationTime
    workInProgress.memoizedState = newState
  }
}

function getStateFromUpdate(
  workInProgress,
  queue,
  update,
  prevState,
  nextProps,
  instance
) {
  switch (update.tag) {
    case ReplaceState: {
      const payload = update.payload
      if (typeof payload === 'function') {
        const nextState = payload.call(instance, prevState, nextProps)
        return nextState
      }
      return payload
    }
    case CaptureUpdate: {
      workInProgress.effectTag =
        (workInProgress.effectTag & ~ShouldCapture) | DidCapture
    }
    // Intentional fallthrough
    case UpdateState: {
      const payload = update.payload
      let partialState
      if (typeof payload === 'function') {
        partialState = payload.call(instance, prevState, nextProps)
      } else {
        partialState = payload
      }
      if (partialState === null || partialState === undefined) {
        return prevState
      }
      return Object.assign({}, prevState, partialState)
    }
    case ForceUpdate: {
      return prevState
    }
  }
  return prevState
}
export function commitUpdateQueue(finishedWork, finishedQueue, instance) {
  const effects = finishedQueue.effects
  finishedQueue.effects = null
  if (effects !== null) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i]
      const callback = effect.callback
      if (callback !== null) {
        effect.callback = null
        callback.call(instance)
      }
    }
  }
}
