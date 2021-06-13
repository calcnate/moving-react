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
import { NoWork, msToExpirationTime, Sync } from './ReactFiberExpirationTime.js'
import { now } from '../scheduler/index.js'

// The fiber we're working on
let workInProgress = null
// The expiration time we're rendering
let renderExpirationTime = NoWork

let nextEffect = null

export function scheduleUpdateOnFiber(fiber, expirationTime) {
  const root = markUpdateTimeFromFiberToRoot(fiber, expirationTime)
  if (root === null) {
    return
  }
  if (expirationTime === Sync) {
    performSyncWorkOnRoot(root)
  }
}

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
      //子节点有了更新任务后，把子节点的expirationTime层层往上传，直到root节点，因为更新组件树都是从root节点开始
      //父节点的childExpirationTime用来存储更新源节点的expirationTime
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

  if (root !== null) {
    // Mark that the root has a pending update.
    //更新待处理时间范围
    const firstPendingTime = root.firstPendingTime
    if (expirationTime > firstPendingTime) {
      root.firstPendingTime = expirationTime
    }
  }

  return root
}

/**
 * 执行同步任务的入口
 * @param {*} root
 */
function performSyncWorkOnRoot(root) {
  const expirationTime = Sync

  //???
  prepareFreshStack(root, expirationTime)

  do {
    try {
      workLoop()
      break
    } catch (thrownValue) {
      console.error(thrownValue)
    }
  } while (true)

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
  let next = beginWork(current, unitOfWork, renderExpirationTime)
  unitOfWork.memoizedProps = unitOfWork.pendingProps
  if (!next) {
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
    } else {
      // const next = unwindWork(workInProgress, renderExpirationTime);
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
  const expirationTime = root.finishedExpirationTime
  if (finishedWork === null) {
    return null
  }
  root.finishedWork = null
  root.finishedExpirationTime = 0

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
      commitLayoutEffects(root, expirationTime)
    } while (nextEffect !== null)

    nextEffect = null
    // requestPaint();
  } else {
    root.current = finishedWork
  }
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

export function commitLayoutEffects(root, committedExpirationTime) {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag

    if (effectTag & (Update | Callback)) {
      const current = nextEffect.alternate
      commitLayoutEffectOnFiber(
        root,
        current,
        nextEffect,
        committedExpirationTime
      )
    }

    nextEffect = nextEffect.nextEffect
  }
}

let currentEventTime = NoWork
export function requestCurrentTimeForUpdate() {
  if (currentEventTime !== NoWork) {
    return currentEventTime
  }
  currentEventTime = msToExpirationTime(now())
  return currentEventTime
}
