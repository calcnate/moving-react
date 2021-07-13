import setTextContent from '../react-dom/setTextContent.js'

const DANGEROUSLY_SET_INNER_HTML = 'dangerouslySetInnerHTML'
const SUPPRESS_CONTENT_EDITABLE_WARNING = 'suppressContentEditableWarning'
const SUPPRESS_HYDRATION_WARNING = 'suppressHydrationWarning'
const AUTOFOCUS = 'autoFocus'
const CHILDREN = 'children'
const STYLE = 'style'
const HTML = '__html'
const DEPRECATED_flareListeners = 'DEPRECATED_flareListeners'

export function createElement(type) {
  return document.createElement(type)
}

export function setInitialProperties(
  domElement,
  tag,
  rawProps,
  rootContainerElement
) {
  let props = rawProps

  setInitialDOMProperties(tag, domElement, rootContainerElement, props)
}

const registrationNameDependencies = {
  onClick: 'click',
}

function setInitialDOMProperties(
  tag,
  domElement,
  rootContainerElement,
  nextProps
) {
  for (const propKey in nextProps) {
    const nextProp = nextProps[propKey]
    if (propKey === 'style') {
      //处理style对象，赞不关注
    } else if (propKey === 'dangerouslySetInnerHTML') {
      const nextHtml = nextProp ? nextProp['html'] : undefined
      if (nextHtml != null) {
        // setInnerHTML(domElement, nextHtml)
      }
    } else if (propKey === 'children') {
      if (typeof nextProp === 'string') {
        const canSetTextContent = tag !== 'textarea' || nextProp !== ''
        if (canSetTextContent) {
          setTextContent(domElement, nextProp)
        }
      } else if (typeof nextProp === 'number') {
        setTextContent(domElement, '' + nextProp)
      }
    } else if (registrationNameDependencies.hasOwnProperty(propKey) > -1) {
      if (nextProp != null) {
        // ensureListeningTo(rootContainerElement, propKey)//暂时不关注事件绑定
        const type = registrationNameDependencies[propKey]
        domElement.addEventListener(type, nextProp)
      }
    } else if (nextProp != null) {
      domElement.setAttribute(propKey, nextProp)
    }
  }
}

// Calculate the diff between the two objects.
export function diffProperties(
  domElement,
  tag,
  lastRawProps,
  nextRawProps,
  rootContainerElement
) {
  let updatePayload = null

  let lastProps
  let nextProps
  lastProps = lastRawProps
  nextProps = nextRawProps
  if (
    typeof lastProps.onClick !== 'function' &&
    typeof nextProps.onClick === 'function'
  ) {
    // TODO: This cast may not be sound for SVG, MathML or custom elements.
    trapClickOnNonInteractiveElement(domElement)
  }

  let propKey
  let styleName
  let styleUpdates = null
  for (propKey in lastProps) {
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      lastProps[propKey] == null
    ) {
      continue
    }
    if (propKey === STYLE) {
      const lastStyle = lastProps[propKey]
      for (styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {}
          }
          styleUpdates[styleName] = ''
        }
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML || propKey === CHILDREN) {
      // Noop. This is handled by the clear text mechanism.
    } else if (propKey === AUTOFOCUS) {
      // Noop. It doesn't work on updates anyway.
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      // This is a special case. If any listener updates we need to ensure
      // that the "current" fiber pointer gets updated so we need a commit
      // to update this element.
      if (!updatePayload) {
        updatePayload = []
      }
    } else {
      // For all other deleted properties we add it to the queue. We use
      // the whitelist in the commit phase instead.
      ;(updatePayload = updatePayload || []).push(propKey, null)
    }
  }
  for (propKey in nextProps) {
    const nextProp = nextProps[propKey]
    const lastProp = lastProps != null ? lastProps[propKey] : undefined
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      continue
    }
    if (propKey === STYLE) {
      if (lastProp) {
        // Unset styles on `lastProp` but not on `nextProp`.
        for (styleName in lastProp) {
          if (
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {}
            }
            styleUpdates[styleName] = ''
          }
        }
        // Update styles that changed since `lastProp`.
        for (styleName in nextProp) {
          if (
            nextProp.hasOwnProperty(styleName) &&
            lastProp[styleName] !== nextProp[styleName]
          ) {
            if (!styleUpdates) {
              styleUpdates = {}
            }
            styleUpdates[styleName] = nextProp[styleName]
          }
        }
      } else {
        // Relies on `updateStylesByID` not mutating `styleUpdates`.
        if (!styleUpdates) {
          if (!updatePayload) {
            updatePayload = []
          }
          updatePayload.push(propKey, styleUpdates)
        }
        styleUpdates = nextProp
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      const nextHtml = nextProp ? nextProp[HTML] : undefined
      const lastHtml = lastProp ? lastProp[HTML] : undefined
      if (nextHtml != null) {
        if (lastHtml !== nextHtml) {
          ;(updatePayload = updatePayload || []).push(propKey, nextHtml)
        }
      } else {
        // TODO: It might be too late to clear this if we have children
        // inserted already.
      }
    } else if (propKey === CHILDREN) {
      if (
        lastProp !== nextProp &&
        (typeof nextProp === 'string' || typeof nextProp === 'number')
      ) {
        ;(updatePayload = updatePayload || []).push(propKey, '' + nextProp)
      }
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        // We eagerly listen to this even though we haven't committed yet.

        ensureListeningTo(rootContainerElement, propKey)
      }
      if (!updatePayload && lastProp !== nextProp) {
        // This is a special case. If any listener updates we need to ensure
        // that the "current" props pointer gets updated so we need a commit
        // to update this element.
        updatePayload = []
      }
    } else {
      // For any other property we always add it to the queue and then we
      // filter it out using the whitelist during the commit.
      ;(updatePayload = updatePayload || []).push(propKey, nextProp)
    }
  }
  if (styleUpdates) {
    ;(updatePayload = updatePayload || []).push(STYLE, styleUpdates)
  }
  return updatePayload
}

export function updateDOMProperties(domElement, updatePayload) {
  // TODO: Handle wasCustomComponentTag
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i]
    const propValue = updatePayload[i + 1]
    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue)
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      setInnerHTML(domElement, propValue)
    } else if (propKey === CHILDREN) {
      setTextContent(domElement, propValue)
    } else {
      setValueForProperty(domElement, propKey, propValue)
    }
  }
}
