import { createElement, setInitialProperties } from './ReactDOMComponent.js'

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
