import { NoWork } from './ReactFiberExpirationTime.js'

export function FiberRootNode(containerInfo, tag) {
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

export function markRootFinishedAtTime(
  root,
  finishedExpirationTime,
  remainingExpirationTime
) {
  // Update the range of pending times
  root.firstPendingTime = remainingExpirationTime

  if (finishedExpirationTime <= root.lastPingedTime) {
    // Clear the pinged time
    root.lastPingedTime = NoWork
  }

  if (finishedExpirationTime <= root.lastExpiredTime) {
    // Clear the expired time
    root.lastExpiredTime = NoWork
  }
}

export function markRootUpdatedAtTime(root, expirationTime) {
  // Update the range of pending times
  const firstPendingTime = root.firstPendingTime
  if (expirationTime > firstPendingTime) {
    root.firstPendingTime = expirationTime
  }
}
