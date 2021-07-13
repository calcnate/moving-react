import { NoWork } from './ReactFiberExpirationTime.js'

export function FiberRootNode(containerInfo, tag) {
  this.tag = tag
  this.current = null
  this.containerInfo = containerInfo
  this.pendingChildren = null
  this.pingCache = null
  this.finishedExpirationTime = NoWork
  this.finishedWork = null
  this.context = null
  this.pendingContext = null
  this.callbackNode = null

  this.firstPendingTime = NoWork

  this.lastPingedTime = NoWork
  this.lastExpiredTime = NoWork
}

export function markRootFinishedAtTime(
  root,
  finishedExpirationTime,
  remainingExpirationTime
) {
  // Update the range of pending times
  root.firstPendingTime = remainingExpirationTime
}

export function markRootUpdatedAtTime(root, expirationTime) {
  // Update the range of pending times
  const firstPendingTime = root.firstPendingTime
  if (expirationTime > firstPendingTime) {
    root.firstPendingTime = expirationTime
  }
}
