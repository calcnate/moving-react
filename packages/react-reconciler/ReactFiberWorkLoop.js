import { HostRoot } from '../shared/ReactWorkTags.js'
import {
  NoEffect,
  Incomplete,
  PerformedWork,
  ContentReset,
  Placement,
  Update,
  Deletion,
  Hydrating,
  PlacementAndUpdate,
  Callback,
} from '../shared/ReactSideEffectTags.js'
import { completeWork } from './ReactFiberCompleteWork.js'
import {
  commitResetTextContent,
  commitPlacement,
  commitLifeCycles as commitLayoutEffectOnFiber,
  commitDeletion,
} from './ReactFiberCommitWork.js'
import { beginWork } from './ReactFiberBeginWork.js'
import { createWorkInProgress } from '../react-reconciler/ReactFiber.js'
import {
  NoWork,
  msToExpirationTime,
  Sync,
  inferPriorityFromExpirationTime,
} from './ReactFiberExpirationTime.js'
import { now } from '../scheduler/index.js'
import {
  cancelCallback,
  flushSyncCallbackQueue,
  flushSyncCallbackQueueImpl,
  ImmediatePriority,
  NoPriority,
  scheduleSyncCallback,
} from './SchedulerWithReactIntegration.js'
import {
  markRootFinishedAtTime,
  markRootUpdatedAtTime,
} from './ReactFiberRoot.js'

const NoContext = /*                    */ 0b000000
const BatchedContext = /*               */ 0b000001
const EventContext = /*                 */ 0b000010
const DiscreteEventContext = /*         */ 0b000100
const LegacyUnbatchedContext = /*       */ 0b001000
const RenderContext = /*                */ 0b010000
const CommitContext = /*                */ 0b100000

// 标识我们在react执行栈中的哪个阶段
let executionContext = NoContext
// The fiber we're working on
let workInProgress = null
// The expiration time we're rendering
let renderExpirationTime = NoWork

let nextEffect = null

export function scheduleUpdateOnFiber(fiber, expirationTime) {
  const root = markUpdateTimeFromFiberToRoot(fiber, expirationTime)
  if (
    (executionContext & LegacyUnbatchedContext) !== NoContext &&
    (executionContext & (RenderContext | CommitContext)) === NoContext
  ) {
    performSyncWorkOnRoot(root)
  } else {
    ensureRootIsScheduled(root)
    if (executionContext === NoContext) {
      flushSyncCallbackQueue()
    }
  }
}

export function unbatchedUpdates(fn, a) {
  const prevExecutionContext = executionContext
  executionContext &= ~BatchedContext
  executionContext |= LegacyUnbatchedContext
  try {
    return fn(a)
  } finally {
    executionContext = prevExecutionContext
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue()
    }
  }
}

/**
 * 子节点有了更新任务后，把子节点的expirationTime层层往上传，直到root节点，因为更新组件树都是从root节点开始
 * 父节点的childExpirationTime用来存储更新源节点的expirationTime，表示子树中有待更新的fiber节点
 * @param {*} fiber
 * @param {*} expirationTime
 * @returns
 */
function markUpdateTimeFromFiberToRoot(fiber, expirationTime) {
  if (fiber.expirationTime < expirationTime) {
    fiber.expirationTime = expirationTime
  }
  let alternate = fiber.alternate
  if (alternate !== null && alternate.expirationTime < expirationTime) {
    alternate.expirationTime = expirationTime
  }
  let node = fiber.return
  let root = null

  if (node === null && fiber.tag === HostRoot) {
    root = fiber.stateNode
  } else {
    while (node !== null) {
      alternate = node.alternate

      if (node.childExpirationTime < expirationTime) {
        node.childExpirationTime = expirationTime
        if (
          alternate !== null &&
          alternate.childExpirationTime < expirationTime
        ) {
          alternate.childExpirationTime = expirationTime
        }
      } else if (
        alternate !== null &&
        alternate.childExpirationTime < expirationTime
      ) {
        alternate.childExpirationTime = expirationTime
      }
      if (node.return === null && node.tag === HostRoot) {
        root = node.stateNode
        break
      }
      node = node.return
    }
  }
  markRootUpdatedAtTime(root, expirationTime)
  return root
}

/**
 * 执行同步任务的入口
 * @param {*} root
 */
function performSyncWorkOnRoot(root) {
  const expirationTime = Sync

  prepareFreshStack(root, expirationTime)
  const prevExecutionContext = executionContext
  executionContext |= RenderContext
  do {
    try {
      workLoop()
      break
    } catch (thrownValue) {
      console.error(thrownValue)
    }
  } while (true)
  executionContext = prevExecutionContext

  root.finishedWork = root.current.alternate
  root.finishedExpirationTime = expirationTime

  commitRoot(root)
}

function prepareFreshStack(root, expirationTime) {
  root.finishedWork = null
  root.finishedExpirationTime = 0

  if (workInProgress) {
    let interruptedWork = workInProgress.return
    while (interruptedWork !== null) {
      // unwindInterruptedWork(interruptedWork)
      interruptedWork = interruptedWork.return
    }
  }

  //从root开始执行更新，root节点成为第一个workInProgress，并生成alternate，因为后面要操作的都是这个alternate对象，而不是workInProgress
  workInProgress = createWorkInProgress(root.current, null)
  renderExpirationTime = expirationTime
}

function workLoop() {
  while (workInProgress) {
    workInProgress = performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate
  //render阶段处理的是unitOfWork，也就是workInProgress对象
  let next = beginWork(current, unitOfWork, renderExpirationTime)
  unitOfWork.memoizedProps = unitOfWork.pendingProps
  if (!next) {
    //进入complete
    next = completeUnitOfWork(unitOfWork)
  }
  return next
}

function completeUnitOfWork(unitOfWork) {
  workInProgress = unitOfWork
  do {
    const current = workInProgress.alternate
    const returnFiber = workInProgress.return

    let next = completeWork(current, workInProgress, renderExpirationTime)
    if (next !== null) {
      return next
    }

    if (
      returnFiber !== null &&
      (returnFiber.effectTag & Incomplete) === NoEffect
    ) {
      if (returnFiber.firstEffect === null) {
        returnFiber.firstEffect = workInProgress.firstEffect
      }
      if (workInProgress.lastEffect !== null) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = workInProgress.firstEffect
        }
        returnFiber.lastEffect = workInProgress.lastEffect
      }

      const effectTag = workInProgress.effectTag
      if (effectTag > PerformedWork) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = workInProgress
        } else {
          returnFiber.firstEffect = workInProgress
        }
        returnFiber.lastEffect = workInProgress
      }
    }

    const siblingFiber = workInProgress.sibling
    if (siblingFiber !== null) {
      // If there is more work to do in this returnFiber, do that next.
      return siblingFiber
    }
    // Otherwise, return to the parent
    workInProgress = returnFiber
  } while (workInProgress !== null)
}

function commitRoot(root) {
  const finishedWork = root.finishedWork
  // const expirationTime = root.finishedExpirationTime
  if (finishedWork === null) {
    return null
  }
  root.finishedWork = null
  root.finishedExpirationTime = 0

  // const remainingExpirationTimeBeforeCommit =
  //   getRemainingExpirationTime(finishedWork)
  // markRootFinishedAtTime(
  //   root,
  //   expirationTime,
  //   remainingExpirationTimeBeforeCommit
  // )

  workInProgress = null
  renderExpirationTime = NoWork

  let firstEffect
  if (finishedWork.effectTag > PerformedWork) {
    if (finishedWork.lastEffect !== null) {
      finishedWork.lastEffect.nextEffect = finishedWork
      firstEffect = finishedWork.firstEffect
    } else {
      firstEffect = finishedWork
    }
  } else {
    // There is no effect on the root.
    firstEffect = finishedWork.firstEffect
  }

  if (firstEffect !== null) {
    const prevExecutionContext = executionContext
    executionContext |= CommitContext

    nextEffect = firstEffect
    do {
      commitBeforeMutationEffects()
    } while (nextEffect !== null)
    nextEffect = firstEffect

    do {
      commitMutationEffects(root)
    } while (nextEffect !== null)

    root.current = finishedWork
    nextEffect = firstEffect
    do {
      commitLayoutEffects(root)
    } while (nextEffect !== null)

    nextEffect = null
    // requestPaint();

    executionContext = prevExecutionContext
  } else {
    root.current = finishedWork
  }

  ensureRootIsScheduled(root)
  return null
}

export function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    nextEffect = nextEffect.nextEffect
  }
}

function commitMutationEffects(root) {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag

    if (effectTag & ContentReset) {
      commitResetTextContent(nextEffect)
    }

    let primaryEffectTag =
      effectTag & (Placement | Update | Deletion | Hydrating)
    switch (primaryEffectTag) {
      case Placement: {
        commitPlacement(nextEffect)

        nextEffect.effectTag &= ~Placement
        break
      }
      case PlacementAndUpdate: {
        commitPlacement(nextEffect)
        nextEffect.effectTag &= ~Placement
        const current = nextEffect.alternate
        // commitWork(current, nextEffect)
        break
      }

      case Update: {
        const current = nextEffect.alternate
        // commitWork(current, nextEffect)
        break
      }
      case Deletion: {
        commitDeletion(root, nextEffect)
        break
      }
    }

    nextEffect = nextEffect.nextEffect
  }
}

export function discreteUpdates(fn, a, b, c, d) {
  const callback = fn.bind(null, a, b, c, d)
  return callback()
}

export function commitLayoutEffects(root) {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag

    if (effectTag & (Update | Callback)) {
      const current = nextEffect.alternate
      commitLayoutEffectOnFiber(root, current, nextEffect)
    }

    nextEffect = nextEffect.nextEffect
  }
}

let currentEventTime = NoWork
export function requestCurrentTimeForUpdate() {
  if (currentEventTime !== NoWork) {
    return currentEventTime
  }
  currentEventTime = msToExpirationTime(now()) //以当前的时间来作为过期时间，表示立即执行
  return currentEventTime
}

export function computeExpirationForFiber() {
  //暂时只考虑同步模式
  return Sync
}

function ensureRootIsScheduled(root) {
  const lastExpiredTime = root.lastExpiredTime
  if (lastExpiredTime !== NoWork) {
    return
  }
  const expirationTime = root.firstPendingTime
  const existingCallbackNode = root.callbackNode
  if (expirationTime === NoWork) {
    // There's nothing to work on.
    if (existingCallbackNode !== null) {
      root.callbackNode = null
      root.callbackExpirationTime = NoWork
      root.callbackPriority = NoPriority
    }
    return
  }

  const currentTime = requestCurrentTimeForUpdate()
  const priorityLevel = inferPriorityFromExpirationTime(
    currentTime,
    expirationTime
  )

  if (existingCallbackNode !== null) {
    const existingCallbackPriority = root.callbackPriority
    const existingCallbackExpirationTime = root.callbackExpirationTime
    if (
      // Callback must have the exact same expiration time.
      existingCallbackExpirationTime === expirationTime &&
      // Callback must have greater or equal priority.
      existingCallbackPriority >= priorityLevel
    ) {
      // Existing callback is sufficient.
      return
    }
    cancelCallback(existingCallbackNode)
  }

  root.callbackExpirationTime = expirationTime
  root.callbackPriority = priorityLevel

  let callbackNode
  if (expirationTime === Sync) {
    // Sync React callbacks are scheduled on a special internal queue
    callbackNode = scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
  }

  root.callbackNode = callbackNode
}

function getNextRootExpirationTimeToWorkOn(root) {
  // Determines the next expiration time that the root should render, taking
  // into account levels that may be suspended, or levels that may have
  // received a ping.

  const lastExpiredTime = root.lastExpiredTime
  if (lastExpiredTime !== NoWork) {
    return lastExpiredTime
  }

  // If the first pending time is suspended, check if there's a lower priority
  // pending level that we know about. Or check if we received a ping. Work
  // on whichever is higher priority.
  const lastPingedTime = root.lastPingedTime
  const nextKnownPendingLevel = root.nextKnownPendingLevel
  const nextLevel =
    lastPingedTime > nextKnownPendingLevel
      ? lastPingedTime
      : nextKnownPendingLevel

  return nextLevel
}
