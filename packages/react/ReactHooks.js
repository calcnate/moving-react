import ReactSharedInternals from '../shared/ReactSharedInternals.js'
const { ReactCurrentDispatcher } = ReactSharedInternals

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current
  return dispatcher
}

export function useState(initialState) {
  const dispatcher = resolveDispatcher()
  return dispatcher.useState(initialState)
}

export function useEffect(create, deps) {
  const dispatcher = resolveDispatcher()
  return dispatcher.useEffect(create, deps)
}
