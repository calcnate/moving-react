import { Update } from '../shared/ReactSideEffectTags.js'
import {
  initializeUpdateQueue,
  processUpdateQueue,
  createUpdate,
  enqueueUpdate,
  ReplaceState,
  ForceUpdate,
  cloneUpdateQueue,
} from './ReactUpdateQueue.js'
import { scheduleUpdateOnFiber as scheduleWork } from './ReactFiberWorkLoop.js'
import { Sync } from './ReactFiberExpirationTime.js'

const classComponentUpdater = {
  enqueueSetState(inst, payload, callback) {
    const fiber = inst._reactInternalFiber
    const expirationTime = Sync
    const update = createUpdate()
    update.payload = payload
    if (callback !== undefined && callback !== null) {
      update.callback = callback
    }

    enqueueUpdate(fiber, update)
    scheduleWork(fiber, expirationTime)
  },
  enqueueReplaceState(inst, payload, callback) {
    const fiber = inst._reactInternalFiber

    const update = createUpdate()
    update.tag = ReplaceState
    update.payload = payload

    if (callback !== undefined && callback !== null) {
      update.callback = callback
    }

    enqueueUpdate(fiber, update)
    scheduleWork(fiber)
  },
  enqueueForceUpdate(inst, callback) {
    const fiber = inst._reactInternalFiber

    const update = createUpdate()
    update.tag = ForceUpdate

    if (callback !== undefined && callback !== null) {
      update.callback = callback
    }

    enqueueUpdate(fiber, update)
    scheduleWork(fiber)
  },
}

export function constructClassInstance(workInProgress, ctor, props) {
  const instance = new ctor(props)
  workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null
  adoptClassInstance(workInProgress, instance)
  return instance
}
export function mountClassInstance(
  workInProgress,
  ctor,
  newProps,
  renderExpirationTime
) {
  const instance = workInProgress.stateNode
  instance.props = newProps
  instance.state = workInProgress.memoizedState

  initializeUpdateQueue(workInProgress)

  //处理更新
  processUpdateQueue(workInProgress, newProps, instance, renderExpirationTime)
  //fiber的state已经更新，同步到组件instance上
  instance.state = workInProgress.memoizedState

  if (typeof instance.componentDidMount === 'function') {
    workInProgress.effectTag |= Update
  }
}

export function updateClassInstance(
  current,
  workInProgress,
  ctor,
  newProps,
  renderExpirationTime
) {
  const instance = workInProgress.stateNode

  cloneUpdateQueue(current, workInProgress)

  const oldProps = workInProgress.memoizedProps
  instance.props = oldProps
  const oldState = workInProgress.memoizedState
  let newState = (instance.state = oldState)
  processUpdateQueue(workInProgress, newProps, instance, renderExpirationTime)
  newState = workInProgress.memoizedState
  if (oldProps === newProps && oldState === newState) {
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update
      }
    }
    return false
  }

  const { shouldComponentUpdate } = instance
  const shouldUpdate = shouldComponentUpdate
    ? shouldComponentUpdate(newProps, newState)
    : true

  if (shouldUpdate) {
    if (typeof instance.componentDidUpdate === 'function') {
      workInProgress.effectTag |= Update
    }
  } else {
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update
      }
    }

    workInProgress.memoizedProps = newProps
    workInProgress.memoizedState = newState
  }

  instance.props = newProps
  instance.state = newState

  return shouldUpdate
}

/**
 * 关联组件实例和fiber节点
 * @param {*} workInProgress
 * @param {*} instance
 */
function adoptClassInstance(workInProgress, instance) {
  instance.updater = classComponentUpdater
  workInProgress.stateNode = instance
  instance._reactInternalFiber = workInProgress
}
