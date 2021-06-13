import FiberNode from '../react-reconciler/ReactFiber.js'
import {
  initializeUpdateQueue,
  createUpdate,
  enqueueUpdate,
} from '../react-reconciler/ReactUpdateQueue.js'
import {
  scheduleUpdateOnFiber,
  requestCurrentTimeForUpdate,
} from '../react-reconciler/ReactFiberWorkLoop.js'
import { HostRoot } from '../shared/ReactWorkTags.js'
import { Sync } from '../react-reconciler/ReactFiberExpirationTime.js'

function FiberRootNode(containerInfo, tag) {
  this.tag = tag
  this.current = null
  this.containerInfo = containerInfo
  this.pendingChildren = null
  this.pingCache = null
  this.finishedExpirationTime = 0
  this.finishedWork = null
  this.context = null
  this.pendingContext = null
  this.callbackNode = null

  this.firstPendingTime = 0

  this.lastPingedTime = 0
  this.lastExpiredTime = 0
}

function updateContainer(element, container) {
  const current = container.current
  var expirationTime = Sync
  const update = createUpdate(expirationTime)
  update.payload = { element }
  enqueueUpdate(current, update)
  scheduleUpdateOnFiber(current, expirationTime)
}

export function render(element, container) {
  const fiberRoot = new FiberRootNode(container, 0)
  const uninitializedFiber = new FiberNode(HostRoot)
  fiberRoot.current = uninitializedFiber
  uninitializedFiber.stateNode = fiberRoot
  initializeUpdateQueue(uninitializedFiber)
  container._reactRootContainer = fiberRoot
  updateContainer(element, fiberRoot)
}

export default {
  render,
}
