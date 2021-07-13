import { HostRoot, HostComponent, HostText } from '../shared/ReactWorkTags.js'
import {
  createInstance,
  createTextInstance,
  prepareUpdate,
} from '../react-dom/ReactDOMHostConfig.js'
import { appendInitialChild } from '../react-dom/ReactDOMHostConfig.js'
import { finalizeInitialChildren } from '../react-dom/ReactDOMHostConfig.js'
import { Update } from '../shared/ReactSideEffectTags.js'

function markUpdate(workInProgress) {
  // Tag the fiber with an update effect. This turns a Placement into
  // a PlacementAndUpdate.
  workInProgress.effectTag |= Update
}

export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps

  //host类型的fiber会在这一步渲染到DOM上，其它类型的在commit阶段渲染
  switch (workInProgress.tag) {
    case HostRoot:
      break
    case HostComponent:
      if (current !== null && workInProgress.stateNode !== null) {
        updateHostComponent(
          current,
          workInProgress,
          workInProgress.type,
          newProps
        )
      } else {
        //创建DOM元素
        let instance = createInstance(
          workInProgress.type,
          newProps,
          workInProgress
        )

        appendAllChildren(instance, workInProgress, false, false)
        // This needs to be set before we mount Flare event listeners
        workInProgress.stateNode = instance

        //设置元素的属性
        finalizeInitialChildren(instance, workInProgress.type, newProps)
        return null
      }
      break
    case HostText:
      {
        let newText = newProps
        if (current && workInProgress.stateNode !== null) {
          const oldText = current.memoizedProps

          if (oldText !== newText) {
            markUpdate(workInProgress)
          }
        } else {
          workInProgress.stateNode = createTextInstance(newText, workInProgress)
        }
      }
      break
    default:
      break
  }
  return null
}

function appendAllChildren(parent, workInProgress) {
  let node = workInProgress.child
  while (node) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode)
    } else if (node.child !== null) {
      node.child.return = node
      node = node.child
      continue
    }
    if (node === workInProgress) {
      return
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return
      }
      node = node.return
    }
    node.sibling.return = node.return
    node = node.sibling
  }
}

function updateHostComponent(
  current,
  workInProgress,
  type,
  newProps,
  rootContainerInstance
) {
  // If we have an alternate, that means this is an update and we need to
  // schedule a side-effect to do the updates.
  const oldProps = current.memoizedProps
  if (oldProps === newProps) {
    // In mutation mode, this is sufficient for a bailout because
    // we won't touch this node even if children changed.
    return
  }

  // If we get updated because one of our children updated, we don't
  // have newProps so we'll have to reuse them.
  // TODO: Split the update API as separate for the props vs. children.
  // Even better would be if children weren't special cased at all tho.
  const instance = workInProgress.stateNode

  // TODO: Experiencing an error where oldProps is null. Suggests a host
  // component is hitting the resume path. Figure out why. Possibly
  // related to `hidden`.
  const updatePayload = prepareUpdate(
    instance,
    type,
    oldProps,
    newProps,
    rootContainerInstance
  )
  // TODO: Type this specific to this type of component.
  workInProgress.updateQueue = updatePayload
  // If the update payload indicates that there is a change or if there
  // is a new ref we mark this as an update. All the work is done in commitWork.
  if (updatePayload) {
    workInProgress.effectTag |= Update
  }
}
