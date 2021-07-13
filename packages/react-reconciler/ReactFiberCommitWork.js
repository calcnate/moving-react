import {
  resetTextContent,
  insertInContainerBefore,
  appendChildToContainer,
  removeChildFromContainer,
  removeChild,
  commitUpdate,
} from '../react-dom/ReactDOMHostConfig.js'
import { HostComponent, HostRoot } from '../shared/ReactWorkTags.js'
import { ContentReset } from '../shared/ReactSideEffectTags.js'
import { Placement, Update } from '../shared/ReactSideEffectTags.js'
import {
  HostText,
  FunctionComponent,
  ClassComponent,
} from '../shared/ReactWorkTags.js'
import { commitUpdateQueue } from './ReactUpdateQueue.js'
import { NoEffect, Passive } from './ReactHookEffectTags.js'
import {
  NoEffect as NoHookEffect,
  HasEffect as HookHasEffect,
  Layout as HookLayout,
  Passive as HookPassive,
} from './ReactHookEffectTags.js'

export function commitResetTextContent(current) {
  resetTextContent(current.stateNode)
}

function getHostParentFiber(fiber) {
  let parent = fiber.return
  while (parent !== null) {
    if (parent.tag === HostComponent || parent.tag === HostRoot) {
      return parent
    }
    parent = parent.return
  }
}

export function commitPlacement(finishedWork) {
  const parentFiber = getHostParentFiber(finishedWork)

  let parent
  let isContainer
  const parentStateNode = parentFiber.stateNode

  switch (parentFiber.tag) {
    case HostComponent:
      parent = parentStateNode
      isContainer = false
      break
    case HostRoot:
      parent = parentStateNode.containerInfo
      isContainer = true
      break

    default:
      console.log(
        'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.'
      )
  }
  if (parentFiber.effectTag & ContentReset) {
    resetTextContent(parent)

    parentFiber.effectTag &= ~ContentReset
  }

  const before = getHostSibling(finishedWork)
  if (isContainer) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent)
  } else {
    insertOrAppendPlacementNode(finishedWork, before, parent)
  }
}

function getHostSibling(fiber) {
  let node = fiber
  siblings: while (true) {
    while (node.sibling === null) {
      if (
        node.return === null ||
        node.return.tag === HostComponent ||
        node.return.tag === HostRoot
      ) {
        return null
      }
      node = node.return
    }
    node.sibling.return = node.return
    node = node.sibling
    while (node.tag !== HostComponent && node.tag !== HostText) {
      if (node.effectTag & Placement) {
        continue siblings
      }

      if (node.child === null) {
        continue siblings
      } else {
        node.child.return = node
        node = node.child
      }
    }

    if (!(node.effectTag & Placement)) {
      return node.stateNode
    }
  }
}

function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
  const { tag } = node
  const isHost = tag === HostComponent || tag === HostText
  if (isHost) {
    const stateNode = isHost ? node.stateNode : node.stateNode.instance
    if (before) {
      insertInContainerBefore(parent, stateNode, before)
    } else {
      appendChildToContainer(parent, stateNode)
    }
  } else {
    const child = node.child

    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent)
      let sibling = child.sibling
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent)
        sibling = sibling.sibling
      }
    }
  }
}

export function commitLifeCycles(finishedRoot, current, finishedWork) {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      return
    }
    case ClassComponent: {
      const instance = finishedWork.stateNode
      if (finishedWork.effectTag & Update) {
        if (current === null) {
          instance.componentDidMount()
        } else {
          const prevProps = current.memoizedProps
          const prevState = current.memoizedState

          instance.componentDidUpdate(
            prevProps,
            prevState,
            instance.__reactInternalSnapshotBeforeUpdate
          )
        }
      }
      const updateQueue = finishedWork.updateQueue
      if (updateQueue !== null) {
        commitUpdateQueue(finishedWork, updateQueue, instance)
      }
      return
    }
    case HostRoot: {
      const updateQueue = finishedWork.updateQueue
      if (updateQueue !== null) {
        let instance = null
        if (finishedWork.child !== null) {
          switch (finishedWork.child.tag) {
            case HostComponent:
              instance = finishedWork.child.stateNode
              break
            case ClassComponent:
              instance = finishedWork.child.stateNode
              break
          }
        }
        commitUpdateQueue(finishedWork, updateQueue, instance)
      }
      return
    }
    case HostComponent: {
      return
    }
    case HostText: {
      return
    }
  }
}

function commitHookEffectListMount(tag, finishedWork) {
  const updateQueue = finishedWork.updateQueue
  let lastEffect = updateQueue !== null ? updateQueue.lastEffect : null
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next
    let effect = firstEffect
    do {
      if ((effect.tag & tag) === tag) {
        // Mount
        const create = effect.create
        effect.destroy = create()
      }
      effect = effect.next
    } while (effect !== firstEffect)
  }
}

export function commitDeletion(finishedRoot, current, renderPriorityLevel) {
  unmountHostComponents(finishedRoot, current, renderPriorityLevel)
  detachFiber(current)
}

function detachFiber(current) {
  const alternate = current.alternate
  current.return = null
  current.child = null
  current.memoizedState = null
  current.updateQueue = null
  current.dependencies = null
  current.alternate = null
  current.firstEffect = null
  current.lastEffect = null
  current.pendingProps = null
  current.memoizedProps = null
  current.stateNode = null
  if (alternate !== null) {
    detachFiber(alternate)
  }
}

function unmountHostComponents(finishedRoot, current) {
  let node = current

  let currentParent
  let currentParentIsContainer

  while (true) {
    let parent = node.return

    while (parent) {
      const parentStateNode = parent.stateNode
      switch (parent.tag) {
        case HostComponent:
          currentParent = parentStateNode
          currentParentIsContainer = false
          break
        case HostRoot:
          currentParent = parentStateNode.containerInfo
          currentParentIsContainer = true
          break
      }
      parent = parent.return
    }

    if (node.tag === HostComponent || node.tag === HostText) {
      if (currentParentIsContainer) {
        removeChildFromContainer(currentParent, node.stateNode)
      } else {
        removeChild(currentParent, node.stateNode)
      }
    } else {
      if (node.child !== null) {
        node.child.return = node
        node = node.child
        continue
      }
    }
    if (node === current) {
      return
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === current) {
        return
      }
      node = node.return
    }
    node.sibling.return = node.return
    node = node.sibling
  }
}

function commitHookEffectListUnmount(tag, finishedWork) {
  const updateQueue = finishedWork.updateQueue
  let lastEffect = updateQueue !== null ? updateQueue.lastEffect : null
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next
    let effect = firstEffect
    do {
      if ((effect.tag & tag) === tag) {
        // Unmount
        const destroy = effect.destroy
        effect.destroy = undefined
        if (destroy !== undefined) {
          destroy()
        }
      }
      effect = effect.next
    } while (effect !== firstEffect)
  }
}

export function commitPassiveHookEffects(finishedWork) {
  if ((finishedWork.effectTag & Passive) !== NoEffect) {
    switch (finishedWork.tag) {
      case FunctionComponent: {
        commitHookEffectListUnmount(HookPassive | HookHasEffect, finishedWork)
        commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork)
        break
      }
      default:
        break
    }
  }
}

export function commitWork(current, finishedWork) {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      // Layout effects are destroyed during the mutation phase so that all
      // destroy functions for all fibers are called before any create functions.
      // This prevents sibling component effects from interfering with each other,
      // e.g. a destroy function in one component should never override a ref set
      // by a create function in another component during the same commit.
      commitHookEffectListUnmount(HookLayout | HookHasEffect, finishedWork)
      return
    }
    case ClassComponent: {
      return
    }
    case HostComponent: {
      const instance = finishedWork.stateNode
      if (instance != null) {
        // Commit the work prepared earlier.
        const newProps = finishedWork.memoizedProps
        // For hydration we reuse the update path but we treat the oldProps
        // as the newProps. The updatePayload will contain the real change in
        // this case.
        const oldProps = current !== null ? current.memoizedProps : newProps
        const type = finishedWork.type
        // TODO: Type the updateQueue to be specific to host components.
        const updatePayload = finishedWork.updateQueue
        finishedWork.updateQueue = null
        if (updatePayload !== null) {
          commitUpdate(
            instance,
            updatePayload,
            type,
            oldProps,
            newProps,
            finishedWork
          )
        }
      }
      return
    }
    case HostText: {
      const textInstance = finishedWork.stateNode
      const newText = finishedWork.memoizedProps
      // For hydration we reuse the update path but we treat the oldProps
      // as the newProps. The updatePayload will contain the real change in
      // this case.
      const oldText = current !== null ? current.memoizedProps : newText
      commitTextUpdate(textInstance, oldText, newText)
      return
    }
    case HostRoot: {
      return
    }
  }
}
