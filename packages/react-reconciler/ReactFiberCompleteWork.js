import { HostRoot, HostComponent, HostText } from '../shared/ReactWorkTags.js'
import {
  createInstance,
  createTextInstance,
} from '../react-dom/ReactDOMHostConfig.js'
import { appendInitialChild } from '../react-dom/ReactDOMHostConfig.js'
import { finalizeInitialChildren } from '../react-dom/ReactDOMHostConfig.js'
import { Update } from '../shared/ReactSideEffectTags.js'

export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps

  //host类型的fiber会在这一步渲染到DOM上，其它类型的在commit阶段渲染
  switch (workInProgress.tag) {
    case HostRoot:
      break
    case HostComponent:
      if (current !== null && workInProgress.stateNode !== null) {
        //updateHostComponent(current,workInProgress,type,newProps)
      } else {
        //创建DOM元素
        let instance = createInstance(
          workInProgress.type,
          newProps,
          workInProgress
        )

        appendAllChildren(instance, workInProgress, false, false)
        // This needs to be set before we mount Flare event listeners

        //设置元素的属性
        finalizeInitialChildren(instance, workInProgress.type, newProps)
        workInProgress.stateNode = instance
      }
      break
    case HostText:
      {
        let newText = newProps
        if (current && workInProgress.stateNode !== null) {
          const oldText = current.memoizedProps

          if (oldText !== newText) {
            workInProgress.effectTag |= Update
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
  while (node !== null) {
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
