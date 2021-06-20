import {
  IdlePriority,
  ImmediatePriority,
  NormalPriority,
  UserBlockingPriority,
} from './SchedulerWithReactIntegration.js'

export const NoWork = 0
export const Never = 1
export const Idle = 2
export const ContinuousHydration = 3
export const Sync = 1073741823 //用最大有符号整数代表Sync模式
export const Batched = Sync - 1

const UNIT_SIZE = 10
const MAGIC_NUMBER_OFFSET = Batched - 1

export const HIGH_PRIORITY_EXPIRATION = 150
export const HIGH_PRIORITY_BATCH_SIZE = 100

export const LOW_PRIORITY_EXPIRATION = 5000
export const LOW_PRIORITY_BATCH_SIZE = 250

// 1 unit of expiration time represents 10ms.
export function msToExpirationTime(ms) {
  // Always subtract from the offset so that we don't clash with the magic number for NoWork.
  return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0)
}
export function expirationTimeToMs(expirationTime) {
  return (MAGIC_NUMBER_OFFSET - expirationTime) * UNIT_SIZE
}

export function inferPriorityFromExpirationTime(currentTime, expirationTime) {
  if (expirationTime === Sync) {
    return ImmediatePriority
  }
  if (expirationTime === Never || expirationTime === Idle) {
    return IdlePriority
  }
  const msUntil =
    expirationTimeToMs(expirationTime) - expirationTimeToMs(currentTime)
  if (msUntil <= 0) {
    return ImmediatePriority
  }
  if (msUntil <= HIGH_PRIORITY_EXPIRATION + HIGH_PRIORITY_BATCH_SIZE) {
    return UserBlockingPriority
  }
  if (msUntil <= LOW_PRIORITY_EXPIRATION + LOW_PRIORITY_BATCH_SIZE) {
    return NormalPriority
  }

  // TODO: Handle LowPriority

  // Assume anything lower has idle priority
  return IdlePriority
}
