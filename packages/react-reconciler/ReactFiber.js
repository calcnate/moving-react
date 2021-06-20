import { NoEffect } from '../shared/ReactSideEffectTags.js'
import { NoWork } from './ReactFiberExpirationTime.js'

export default function FiberNode(tag, pendingProps, key) {
  // Instance
  this.tag = tag //标记不同的组件类型，详见shared/ReactWorkTags.js
  this.key = key //标记同层级不同的组件
  this.elementType = null //ReactElement.$$typeof，详见shared/ReactSymbols.js
  this.type = null //创建ReactElement时候的type
  this.stateNode = null //组件的instance或者DOM节点

  // Fiber
  this.return = null //父节点，除了根节点，其它节点都有return属性
  this.child = null //第一个子节点
  this.sibling = null //兄弟节点
  this.index = 0

  this.ref = null

  this.pendingProps = pendingProps //新的变动带来的新的props
  this.memoizedProps = null //上一次渲染完成后的props
  this.updateQueue = null //fiber对应的组件产生的state update会放到这里
  this.memoizedState = null //上一次渲染后的state
  this.dependencies = null //暂不关注

  // Effects
  this.effectTag = NoEffect //记录side effect，side effect类型详见shared/ReactSideEffectTags.js
  this.nextEffect = null //指向下一个有side effect的fiber节点，整个是一个单链表

  this.firstEffect = null //子树中第一个有side effect的fiber节点
  this.lastEffect = null //子树中最后一个有side effect的fiber节点

  this.expirationTime = NoWork //代表此节点产生的任务应该在未来某个时间点完成，不包含子节点产生的任务
  this.childExpirationTime = NoWork //用于快速确定子节点中有无待处理的变化

  //备胎节点，每当fiber产生更新，会复制一份fiber存到这个属性中，后续的更新操作都是操作这个备胎节点
  this.alternate = null
}

export function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate
  if (workInProgress === null) {
    workInProgress = new FiberNode(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    )
    workInProgress.elementType = current.elementType
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode

    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    workInProgress.pendingProps = pendingProps

    workInProgress.effectTag = NoEffect

    // The effect list is no longer valid.
    workInProgress.nextEffect = null
    workInProgress.firstEffect = null
    workInProgress.lastEffect = null
  }

  workInProgress.childExpirationTime = current.childExpirationTime
  workInProgress.expirationTime = current.expirationTime

  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.updateQueue = current.updateQueue

  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  workInProgress.ref = current.ref

  return workInProgress
}
