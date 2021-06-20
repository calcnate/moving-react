import { Deletion, Placement } from '../shared/ReactSideEffectTags.js'
import {
  ClassComponent,
  HostComponent,
  HostText,
  IndeterminateComponent,
} from '../shared/ReactWorkTags.js'
import FiberNode from './ReactFiber.js'

function ChildReconciler(shouldTrackSideEffects) {
  function placeSingleChild(newFiber) {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.effectTag = Placement
    }
    return newFiber
  }

  function reconcileSingleElement(
    returnFiber,
    currentFirstChild,
    element,
    expirationTime
  ) {
    const type = element.type
    const key = element.key

    const pendingProps = element.props
    //根据render方法返回的ReactElement生成fiber节点
    const created = createFiberFromTypeAndProps(
      type,
      key,
      pendingProps,
      expirationTime
    )
    created.return = returnFiber
    return created
  }

  function reconcileSingleTextNode(
    returnFiber,
    currentFirstChild,
    textContent,
    expirationTime
  ) {
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling)
      const existing = useFiber(currentFirstChild, textContent)
      existing.return = returnFiber
      return existing
    }
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    deleteRemainingChildren(returnFiber, currentFirstChild)
    const created = new FiberNode(HostText, textContent)
    created.expirationTime = expirationTime
    created.return = returnFiber
    return created
  }

  function reconcileChildFibers(
    returnFiber,
    currentFirstChild,
    newChild,
    expirationTime
  ) {
    const isObject = typeof newChild === 'object' && newChild !== null

    //处理ReactElement
    if (isObject) {
      return placeSingleChild(
        reconcileSingleElement(
          returnFiber,
          currentFirstChild,
          newChild,
          expirationTime
        )
      )
    }

    //文本节点
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          String(newChild),
          expirationTime
        )
      )
    }
  }

  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    // assuming that after the first child we've already added everything.
    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
    return null
  }

  function deleteChild(returnFiber, childToDelete) {
    // Deletions are added in reversed order so we add it to the front.
    // At this point, the return fiber's effect list is empty except for
    // deletions, so we can just append the deletion to the list. The remaining
    // effects aren't added until the complete phase. Once we implement
    // resuming, this may not be true.
    const last = returnFiber.lastEffect
    if (last !== null) {
      last.nextEffect = childToDelete
      returnFiber.lastEffect = childToDelete
    } else {
      returnFiber.firstEffect = returnFiber.lastEffect = childToDelete
    }
    childToDelete.nextEffect = null
    childToDelete.effectTag = Deletion
  }

  return reconcileChildFibers
}

function createFiberFromTypeAndProps(type, key, pendingProps) {
  let fiberTag = IndeterminateComponent

  if (typeof type === 'function') {
    fiberTag = ClassComponent
  } else if (typeof type === 'string') {
    fiberTag = HostComponent
  }
  const fiber = new FiberNode(fiberTag, pendingProps, key)
  fiber.elementType = type
  fiber.type = type

  return fiber
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)
