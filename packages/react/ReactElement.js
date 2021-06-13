import { REACT_ELEMENT_TYPE } from '../shared/ReactSymbols.js'

function ReactElement(type, key, props) {
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    props,
  }
}

export function createElement(type, config, children) {
  const props = {}
  if (config) {
    for (const propName in config) {
      if (hasOwnProperty.call(config, propName)) {
        props[propName] = config[propName]
      }
    }
  }

  const childrenLength = arguments.length - 2
  if (childrenLength === 1) {
    props.children = children
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength)
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[2 + i]
    }
    props.children = childArray
  }

  return ReactElement(type, null, props)
}
