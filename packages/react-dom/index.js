import FiberNode from '../react-reconciler/ReactFiber.js'
import {
  initializeUpdateQueue,
  createUpdate,
  enqueueUpdate,
} from '../react-reconciler/ReactUpdateQueue.js'
import {
  scheduleUpdateOnFiber,
  requestCurrentTimeForUpdate,
  computeExpirationForFiber,
  unbatchedUpdates,
} from '../react-reconciler/ReactFiberWorkLoop.js'
import { HostRoot } from '../shared/ReactWorkTags.js'
import { FiberRootNode } from '../react-reconciler/ReactFiberRoot.js'

/**
 * 初始化和更新统一使用这个方法
 * @param {*} element
 * @param {*} container
 */
function updateContainer(element, container) {
  const current = container.current
  const currentTime = requestCurrentTimeForUpdate()
  const expirationTime = computeExpirationForFiber(currentTime, current)
  const update = createUpdate(expirationTime)
  update.payload = { element }
  enqueueUpdate(current, update)
  scheduleUpdateOnFiber(current, expirationTime)
}

/**
 * ReactDOM.render方法，react应用的入口
 * @param {*} element
 * @param {*} container dom容器
 */
export function render(element, container) {
  const fiberRoot = new FiberRootNode(container, 0)
  const uninitializedFiber = new FiberNode(HostRoot)

  fiberRoot.current = uninitializedFiber
  uninitializedFiber.stateNode = fiberRoot

  initializeUpdateQueue(uninitializedFiber)
  container._reactRootContainer = fiberRoot

  unbatchedUpdates(() => {
    updateContainer(element, fiberRoot)
  })
}

export default {
  render,
}
