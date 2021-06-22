import {
  FunctionComponent,
  ClassComponent,
  HostRoot,
} from '../shared/ReactWorkTags.js'
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

export function beginWork(current, workInProgress, renderExpirationTime) {
  const updateExpirationTime = workInProgress.expirationTime

  if (current !== null) {
    if (updateExpirationTime === NoWork) {
      //不需要更新的节点直接跳过
      return bailoutOnAlreadyFinishedWork(
        current,
        workInProgress,
        renderExpirationTime
      )
    }
  }

  //update在本函数内处理完成，重置expirationTime
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
    //第一次渲染组件时，instance是空的
    //创建instance
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
  //current对应屏幕上的DOM，current为空就挂载子元素，不为空则diff子元素
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
  //check子节点是否有未完成的更新
  const childExpirationTime = workInProgress.childExpirationTime
  if (childExpirationTime < renderExpirationTime) {
    //没有待完成的更新，直接跳过
    return null
  } else {
    //这里clone主要是为了给子fiber增加alternate属性
    cloneChildFibers(workInProgress)
    return workInProgress.child
  }
}

function cloneChildFibers(workInProgress) {
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
