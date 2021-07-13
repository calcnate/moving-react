import { NoWork, Sync } from './ReactFiberExpirationTime.js'
import ReactSharedInternals from '../shared/ReactSharedInternals.js'
import {
  HasEffect as HookHasEffect,
  Passive as HookPassive,
} from './ReactHookEffectTags.js'
import {
  Update as UpdateEffect,
  Passive as PassiveEffect,
} from '../shared/ReactSideEffectTags.js'
import {
  computeExpirationForFiber,
  requestCurrentTimeForUpdate,
  scheduleUpdateOnFiber as scheduleWork,
} from './ReactFiberWorkLoop.js'
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork.js'

const { ReactCurrentDispatcher } = ReactSharedInternals

let renderExpirationTime = NoWork
let currentlyRenderingFiber = null //work-in-progress fiber节点，区别于 work-in-progress hook.
let currentHook = null
let workInProgressHook = null

export function bailoutHooks(current, workInProgress, expirationTime) {
  workInProgress.updateQueue = current.updateQueue
  workInProgress.effectTag &= ~(PassiveEffect | UpdateEffect)
  if (current.expirationTime <= expirationTime) {
    current.expirationTime = NoWork
  }
}

function areHookInputsEqual(nextDeps, prevDeps) {
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue
    }
    return false
  }
  return true
}

/**
 * 渲染带hook的函数组件
 *
 * @export
 * @param {*} current
 * @param {*} workInProgress
 * @param {*} Component
 * @param {*} props
 * @param {*} nextRenderExpirationTime
 * @returns
 */
export function renderWithHooks(
  current,
  workInProgress,
  Component,
  props,
  nextRenderExpirationTime
) {
  renderExpirationTime = nextRenderExpirationTime
  currentlyRenderingFiber = workInProgress

  workInProgress.memoizedState = null
  workInProgress.updateQueue = null
  workInProgress.expirationTime = NoWork

  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate

  let children = Component(props)

  // 函数组件执行完成后，不能再调用hook
  ReactCurrentDispatcher.current = ContextOnlyDispatcher

  renderExpirationTime = NoWork
  currentlyRenderingFiber = null

  currentHook = null
  workInProgressHook = null

  return children
}

export const ContextOnlyDispatcher = {
  useContext: () => console.error('Invalid hook call'),
  useEffect: () => console.error('Invalid hook call'),
  useMemo: () => console.error('Invalid hook call'),
  useState: () => console.error('Invalid hook call'),
}

const HooksDispatcherOnMount = {
  useCallback: mountCallback,
  useEffect: mountEffect,
  useMemo: mountMemo,
  useState: mountState,
}

const HooksDispatcherOnUpdate = {
  useCallback: updateCallback,
  useEffect: updateEffect,
  useMemo: updateMemo,
  useState: updateState,
}

function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  }

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook
  }
  return workInProgressHook
}

function updateWorkInProgressHook() {
  // This function is used both for updates and for re-renders triggered by a
  // render phase update. It assumes there is either a current hook we can
  // clone, or a work-in-progress hook from a previous render pass that we can
  // use as a base. When we reach the end of the base list, we must switch to
  // the dispatcher used for mounts.
  let nextCurrentHook
  if (currentHook === null) {
    let current = currentlyRenderingFiber.alternate
    if (current !== null) {
      nextCurrentHook = current.memoizedState
    } else {
      nextCurrentHook = null
    }
  } else {
    nextCurrentHook = currentHook.next
  }

  let nextWorkInProgressHook
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber.memoizedState
  } else {
    nextWorkInProgressHook = workInProgressHook.next
  }

  if (nextWorkInProgressHook !== null) {
    // There's already a work-in-progress. Reuse it.
    workInProgressHook = nextWorkInProgressHook
    nextWorkInProgressHook = workInProgressHook.next

    currentHook = nextCurrentHook
  } else {
    // Clone from the current hook.

    currentHook = nextCurrentHook

    const newHook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    }

    if (workInProgressHook === null) {
      // This is the first hook in the list.
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook
    } else {
      // Append to the end of the list.
      workInProgressHook = workInProgressHook.next = newHook
    }
  }
  return workInProgressHook
}

function mountEffectImpl(fiberEffectTag, hookEffectTag, create, deps) {
  const hook = mountWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  currentlyRenderingFiber.effectTag |= fiberEffectTag
  hook.memoizedState = pushEffect(
    HookHasEffect | hookEffectTag,
    create,
    undefined,
    nextDeps
  )
}

function mountCallback(callback, deps) {
  const hook = mountWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  hook.memoizedState = [callback, nextDeps]
  return callback
}

function updateCallback(callback, deps) {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1]
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0]
      }
    }
  }
  hook.memoizedState = [callback, nextDeps]
  return callback
}

function mountMemo(nextCreate, deps) {
  const hook = mountWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}

function updateMemo(nextCreate, deps) {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState
  if (prevState !== null) {
    // Assume these are defined. If they're not, areHookInputsEqual will warn.
    if (nextDeps !== null) {
      const prevDeps = prevState[1]
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0]
      }
    }
  }
  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}

function mountEffect(create, deps) {
  return mountEffectImpl(
    UpdateEffect | PassiveEffect,
    HookPassive,
    create,
    deps
  )
}

function updateEffect() {}

function createFunctionComponentUpdateQueue() {
  return {
    lastEffect: null,
  }
}

function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action
}

function updateReducer(reducer, initialArg, init) {
  const hook = updateWorkInProgressHook()
  const queue = hook.queue

  queue.lastRenderedReducer = reducer

  const current = currentHook

  // The last rebase update that is NOT part of the base state.
  let baseQueue = current.baseQueue

  // The last pending update that hasn't been processed yet.
  let pendingQueue = queue.pending
  if (pendingQueue !== null) {
    // We have new updates that haven't been processed yet.
    // We'll add them to the base queue.
    if (baseQueue !== null) {
      // Merge the pending queue and the base queue.
      let baseFirst = baseQueue.next
      let pendingFirst = pendingQueue.next
      baseQueue.next = pendingFirst
      pendingQueue.next = baseFirst
    }
    current.baseQueue = baseQueue = pendingQueue
    queue.pending = null
  }

  if (baseQueue !== null) {
    // We have a queue to process.
    let first = baseQueue.next
    let newState = current.baseState

    let newBaseState = null
    let newBaseQueueFirst = null
    let newBaseQueueLast = null
    let update = first
    do {
      const updateExpirationTime = update.expirationTime
      if (updateExpirationTime < renderExpirationTime) {
        // Priority is insufficient. Skip this update. If this is the first
        // skipped update, the previous update/state is the new base
        // update/state.
        const clone = {
          expirationTime: update.expirationTime,
          suspenseConfig: update.suspenseConfig,
          action: update.action,
          eagerReducer: update.eagerReducer,
          eagerState: update.eagerState,
          next: null,
        }
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone
          newBaseState = newState
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone
        }
        // Update the remaining priority in the queue.
        if (updateExpirationTime > currentlyRenderingFiber.expirationTime) {
          currentlyRenderingFiber.expirationTime = updateExpirationTime
          markUnprocessedUpdateTime(updateExpirationTime)
        }
      } else {
        // This update does have sufficient priority.

        if (newBaseQueueLast !== null) {
          const clone = {
            expirationTime: Sync, // This update is going to be committed so we never want uncommit it.
            suspenseConfig: update.suspenseConfig,
            action: update.action,
            eagerReducer: update.eagerReducer,
            eagerState: update.eagerState,
            next: null,
          }
          newBaseQueueLast = newBaseQueueLast.next = clone
        }

        // Mark the event time of this update as relevant to this render pass.
        // TODO: This should ideally use the true event time of this update rather than
        // its priority which is a derived and not reverseable value.
        // TODO: We should skip this update if it was already committed but currently
        // we have no way of detecting the difference between a committed and suspended
        // update here.
        // markRenderEventTimeAndConfig(
        //   updateExpirationTime,
        //   update.suspenseConfig
        // )

        // Process this update.
        if (update.eagerReducer === reducer) {
          // If this update was processed eagerly, and its reducer matches the
          // current reducer, we can use the eagerly computed state.
          newState = update.eagerState
        } else {
          const action = update.action
          newState = reducer(newState, action)
        }
      }
      update = update.next
    } while (update !== null && update !== first)

    if (newBaseQueueLast === null) {
      newBaseState = newState
    } else {
      newBaseQueueLast.next = newBaseQueueFirst
    }

    // Mark that the fiber performed work, but only if the new state is
    // different from the current state.
    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate()
    }

    hook.memoizedState = newState
    hook.baseState = newBaseState
    hook.baseQueue = newBaseQueueLast

    queue.lastRenderedState = newState
  }

  const dispatch = queue.dispatch
  return [hook.memoizedState, dispatch]
}

function mountState(initialState) {
  const hook = mountWorkInProgressHook()
  if (typeof initialState === 'function') {
    initialState = initialState()
  }
  hook.memoizedState = hook.baseState = initialState
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  })
  const dispatch = (queue.dispatch = dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue
  ))
  return [hook.memoizedState, dispatch] //使用useState返回的tuple
}

function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState)
}

function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag,
    create,
    destroy,
    deps,
    // Circular
    next: null,
  }
  let componentUpdateQueue = currentlyRenderingFiber.updateQueue
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue()
    currentlyRenderingFiber.updateQueue = componentUpdateQueue
    componentUpdateQueue.lastEffect = effect.next = effect
  } else {
    const lastEffect = componentUpdateQueue.lastEffect
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect
    } else {
      const firstEffect = lastEffect.next
      lastEffect.next = effect
      effect.next = firstEffect
      componentUpdateQueue.lastEffect = effect
    }
  }
  return effect
}

function dispatchAction(fiber, queue, action) {
  const currentTime = requestCurrentTimeForUpdate()

  const expirationTime = computeExpirationForFiber(currentTime, fiber)

  const update = {
    expirationTime,
    action,
    eagerReducer: null,
    eagerState: null,
    next: null,
  }

  //与ReactUpdateQueue.js中的处理逻辑相同
  const pending = queue.pending
  if (pending === null) {
    update.next = update
  } else {
    update.next = pending.next
    pending.next = update
  }
  queue.pending = update

  const alternate = fiber.alternate
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    update.expirationTime = renderExpirationTime
    currentlyRenderingFiber.expirationTime = renderExpirationTime
  } else {
    if (
      fiber.expirationTime === NoWork &&
      (alternate === null || alternate.expirationTime === NoWork)
    ) {
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const lastRenderedReducer = queue.lastRenderedReducer
      if (lastRenderedReducer !== null) {
        let prevDispatcher

        try {
          const currentState = queue.lastRenderedState
          const eagerState = lastRenderedReducer(currentState, action)
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.eagerReducer = lastRenderedReducer
          update.eagerState = eagerState
          if (Object.is(eagerState, currentState)) {
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            return
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        } finally {
          //
        }
      }
    }

    scheduleWork(fiber, expirationTime)
  }
}
