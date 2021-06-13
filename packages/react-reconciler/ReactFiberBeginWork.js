import {
  FunctionComponent,
  ClassComponent,
  HostRoot,
} from '../shared/ReactWorkTags.js'
import { Placement } from '../shared/ReactSideEffectTags.js'
import {
  constructClassInstance,
  mountClassInstance,
  updateClassInstance,
} from './ReactFiberClassComponent.js'
import {
  cloneUpdateQueue,
  processUpdateQueue,
} from '../react-reconciler/ReactUpdateQueue.js'

import { reconcileChildFibers, mountChildFibers } from './ReactChildFiber.js'
import { NoWork } from './ReactFiberExpirationTime.js'
import { createWorkInProgress } from './ReactFiber.js'

let didReceiveUpdate = false

export function beginWork(current, workInProgress, renderExpirationTime) {
  const updateExpirationTime = workInProgress.expirationTime
  if (current !== null) {
    const oldProps = current.memoizedProps
    const newProps = workInProgress.pendingProps
    if (oldProps !== newProps) {
      didReceiveUpdate = true
    } else if (updateExpirationTime < renderExpirationTime) {
      didReceiveUpdate = false
      return bailoutOnAlreadyFinishedWork(
        current,
        workInProgress,
        renderExpirationTime
      )
    } else {
      didReceiveUpdate = false
    }
  } else {
    didReceiveUpdate = false
  }

  workInProgress.expirationTime = NoWork

  switch (workInProgress.tag) {
    case FunctionComponent: {
      const Component = workInProgress.type
      const unresolvedProps = workInProgress.pendingProps
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        unresolvedProps,
        renderExpirationTime
      )
    }
    case ClassComponent: {
      const Component = workInProgress.type
      const unresolvedProps = workInProgress.pendingProps
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        unresolvedProps,
        renderExpirationTime
      )
    }
    case HostRoot: {
      return updateHostRoot(current, workInProgress, renderExpirationTime)
    }
  }
}

function updateFunctionComponent() {}

function updateClassComponent(
  current,
  workInProgress,
  Component,
  nextProps,
  renderExpirationTime
) {
  const instance = workInProgress.stateNode
  let shouldUpdate
  if (instance === null) {
    if (current !== null) {
      current.alternate = null
      workInProgress.alternate = null
      workInProgress.effectTag |= Placement
    }

    constructClassInstance(workInProgress, Component, nextProps)
    mountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderExpirationTime
    )
    shouldUpdate = true
  } else if (current === null) {
    //
  } else {
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      Component,
      nextProps,
      renderExpirationTime
    )
  }
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    renderExpirationTime
  )
  return nextUnitOfWork
}

function updateHostRoot(current, workInProgress, renderExpirationTime) {
  const updateQueue = workInProgress.updateQueue

  const nextProps = workInProgress.pendingProps
  const prevState = workInProgress.memoizedState
  const prevChildren = prevState !== null ? prevState.element : null
  cloneUpdateQueue(current, workInProgress)
  processUpdateQueue(workInProgress, nextProps, null, renderExpirationTime)
  const nextState = workInProgress.memoizedState
  const nextChildren = nextState.element
  if (nextChildren === prevChildren) {
    console.log('prevChildren === nextChildren')
    return
  }

  reconcileChildren(current, workInProgress, nextChildren, renderExpirationTime)
  return workInProgress.child
}

function finishClassComponent(
  current,
  workInProgress,
  Component,
  shouldUpdate,
  renderExpirationTime
) {
  if (!shouldUpdate) {
    return
  }
  const instance = workInProgress.stateNode
  let nextChildren = instance.render()
  reconcileChildren(current, workInProgress, nextChildren, renderExpirationTime)
  workInProgress.memoizedState = instance.state
  return workInProgress.child
}

function reconcileChildren(
  current,
  workInProgress,
  nextChildren,
  renderExpirationTime
) {
  if (current === null) {
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderExpirationTime
    )
  } else {
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderExpirationTime
    )
  }
}

function bailoutOnAlreadyFinishedWork(
  current,
  workInProgress,
  renderExpirationTime
) {
  if (current !== null) {
    // Reuse previous dependencies
    workInProgress.dependencies = current.dependencies
  }
  //check子节点是否有未完成的更新
  const childExpirationTime = workInProgress.childExpirationTime
  if (childExpirationTime < renderExpirationTime) {
    return null
  } else {
    cloneChildFibers(current, workInProgress)
    return workInProgress.child
  }
}

function cloneChildFibers(current, workInProgress) {
  if (workInProgress.child === null) {
    return
  }
  let currentChild = workInProgress.child
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps)
  workInProgress.child = newChild
  newChild.return = workInProgress
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    )
    newChild.return = workInProgress
  }
  newChild.sibling = null
}
