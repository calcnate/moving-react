export function now() {
  return performance.now()
}

export const Scheduler_NoPriority = 0
export const Scheduler_ImmediatePriority = 1
export const Scheduler_UserBlockingPriority = 2
export const Scheduler_NormalPriority = 3
export const Scheduler_LowPriority = 4
export const Scheduler_IdlePriority = 5

const maxSigned31BitInt = 1073741823

// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1
// Eventually times out
var USER_BLOCKING_PRIORITY = 250
var NORMAL_PRIORITY_TIMEOUT = 5000
var LOW_PRIORITY_TIMEOUT = 10000
// Never times out
var IDLE_PRIORITY = maxSigned31BitInt

let taskIdCounter = 1

let taskQueue = []

var isHostCallbackScheduled = false

let isPerformingWork = false

let isMessageLoopRunning = false
let scheduledHostCallback = null

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let yieldInterval = 5
let deadline = 0

let maxYieldInterval = 300
let needsPaint = false

var currentTask = null
var currentPriorityLevel = Scheduler_NormalPriority

export function runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case Scheduler_ImmediatePriority:
    case Scheduler_UserBlockingPriority:
    case Scheduler_NormalPriority:
    case Scheduler_LowPriority:
    case Scheduler_IdlePriority:
      break
    default:
      priorityLevel = Scheduler_NormalPriority
  }

  var previousPriorityLevel = currentPriorityLevel
  currentPriorityLevel = priorityLevel

  try {
    return eventHandler()
  } finally {
    currentPriorityLevel = previousPriorityLevel
  }
}

function workLoop(hasTimeRemaining, initialTime) {
  let currentTime = initialTime
  currentTask = peek(taskQueue)
  while (currentTask) {
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || shouldYieldToHost())
    ) {
      break
    }
    const callback = currentTask.callback

    if (callback) {
      callback()
    }
    taskQueue.pop()
    currentTask = peek(taskQueue)
  }
}

export function scheduleCallback(priorityLevel, callback) {
  let currentTime = now()
  let startTime = currentTime

  let timeout
  switch (priorityLevel) {
    case Scheduler_ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT
      break
    case Scheduler_UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY
      break
    case Scheduler_IdlePriority:
      timeout = IDLE_PRIORITY
      break
    case Scheduler_LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT
      break
    case Scheduler_NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT
      break
  }

  var expirationTime = startTime + timeout
  var newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  }

  newTask.sortIndex = expirationTime
  taskQueue.push(newTask)

  // Schedule a host callback, if needed. If we're already performing work,
  // wait until the next time we yield.
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true
    requestHostCallback(flushWork)
  }
  return newTask
}

export function cancelCallback(task) {
  task.callback = null
}

function peek(queue) {
  return queue[0]
}

const channel = new MessageChannel()
const port = channel.port2
channel.port1.onmessage = performWorkUntilDeadline

function requestHostCallback(callback) {
  scheduledHostCallback = callback
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true
    port.postMessage(null)
  }
}

function cancelHostCallback() {
  scheduledHostCallback = null
}

function performWorkUntilDeadline() {
  if (scheduledHostCallback !== null) {
    const currentTime = now()
    // Yield after `yieldInterval` ms, regardless of where we are in the vsync
    // cycle. This means there's always time remaining at the beginning of
    // the message event.
    deadline = currentTime + yieldInterval
    const hasTimeRemaining = true
    try {
      const hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime)
      if (!hasMoreWork) {
        isMessageLoopRunning = false
        scheduledHostCallback = null
      } else {
        // If there's more work, schedule the next message event at the end
        // of the preceding one.
        port.postMessage(null)
      }
    } catch (error) {
      // If a scheduler task throws, exit the current browser task so the
      // error can be observed.
      port.postMessage(null)
      throw error
    }
  } else {
    isMessageLoopRunning = false
  }
  // Yielding to the browser will give it a chance to paint, so we can
  // reset this.
  needsPaint = false
}

function flushWork(hasTimeRemaining, initialTime) {
  // We'll need a host callback the next time work is scheduled.
  isHostCallbackScheduled = false

  isPerformingWork = true
  const previousPriorityLevel = currentPriorityLevel
  try {
    return workLoop(hasTimeRemaining, initialTime)
  } finally {
    currentTask = null
    currentPriorityLevel = previousPriorityLevel
    isPerformingWork = false
  }
}

function shouldYieldToHost() {
  const currentTime = now()
  if (currentTime >= deadline) {
    if (needsPaint || navigator.scheduling.isInputPending()) {
      return true
    }
    return currentTime >= maxYieldInterval
  } else {
    return false
  }
}
