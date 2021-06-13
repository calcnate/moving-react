export const NoWork = 0
export const Never = 1
export const Idle = 2
export const ContinuousHydration = 3
export const Sync = 1073741823 //用最大有符号整数代表Sync模式
export const Batched = Sync - 1

const UNIT_SIZE = 10
const MAGIC_NUMBER_OFFSET = Batched - 1

// 1 unit of expiration time represents 10ms.
export function msToExpirationTime(ms) {
  // Always subtract from the offset so that we don't clash with the magic number for NoWork.
  return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0)
}
