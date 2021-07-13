import {
  createElement,
  diffProperties,
  setInitialProperties,
  updateDOMProperties,
} from './ReactDOMComponent.js'

export function createInstance(type, props) {
  const domElement = createElement(type, props)
  return domElement
}

export function appendInitialChild(parentInstance, child) {
  parentInstance.appendChild(child)
}

export function resetTextContent(domElement) {
  setTextContent(domElement, '')
}

function setTextContent(node, text) {
  if (text) {
    let firstChild = node.firstChild

    if (
      firstChild &&
      firstChild === node.lastChild &&
      firstChild.nodeType === 3
    ) {
      firstChild.nodeValue = text
      return
    }
  }
  node.textContent = text
}

export function insertInContainerBefore(container, child, beforeChild) {
  container.insertBefore(child, beforeChild)
}

export function appendChildToContainer(container, child) {
  let parentNode
  parentNode = container
  parentNode.appendChild(child)

  const reactRootContainer = container._reactRootContainer
  if (
    (reactRootContainer === null || reactRootContainer === undefined) &&
    parentNode.onclick === null
  ) {
    // TODO: This cast may not be sound for SVG, MathML or custom elements.
    // trapClickOnNonInteractiveElement(parentNode)
  }
}

export function finalizeInitialChildren(
  domElement,
  type,
  props,
  rootContainerInstance
) {
  setInitialProperties(domElement, type, props, rootContainerInstance)
}

export function removeChildFromContainer(container, child) {
  container.removeChild(child)
}

export function removeChild(parentInstance, child) {
  parentInstance.removeChild(child)
}

export function createTextInstance(text) {
  const textNode = document.createTextNode(text)
  return textNode
}

export function shouldSetTextContent(type, props) {
  return (
    type === 'textarea' ||
    type === 'option' ||
    type === 'noscript' ||
    typeof props.children === 'string' ||
    typeof props.children === 'number' ||
    (typeof props.dangerouslySetInnerHTML === 'object' &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  )
}

export function prepareUpdate(
  domElement,
  type,
  oldProps,
  newProps,
  rootContainerInstance,
  hostContext
) {
  return diffProperties(
    domElement,
    type,
    oldProps,
    newProps,
    rootContainerInstance
  )
}

export function commitUpdate(
  domElement,
  updatePayload,
  type,
  oldProps,
  newProps,
  internalInstanceHandle
) {
  // Apply the diff to the DOM node.
  updateProperties(domElement, updatePayload, type, oldProps, newProps)
}

// Apply the diff.
export function updateProperties(
  domElement,
  updatePayload,
  tag,
  lastRawProps,
  nextRawProps
) {
  // Apply the diff.
  updateDOMProperties(domElement, updatePayload)

  // TODO: Ensure that an update gets scheduled if any of the special props
  // changed.
  switch (tag) {
    case 'input':
      // Update the wrapper around inputs *after* updating props. This has to
      // happen after `updateDOMProperties`. Otherwise HTML5 input validations
      // raise warnings and prevent the new value from being assigned.
      ReactDOMInputUpdateWrapper(domElement, nextRawProps)
      break
    case 'textarea':
      ReactDOMTextareaUpdateWrapper(domElement, nextRawProps)
      break
    case 'select':
      // <select> value update needs to occur after <option> children
      // reconciliation
      ReactDOMSelectPostUpdateWrapper(domElement, nextRawProps)
      break
  }
}
