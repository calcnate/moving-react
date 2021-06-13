import setTextContent from '../react-dom/setTextContent.js'

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
      }
    } else if (nextProp != null) {
      domElement.setAttribute(propKey, nextProp)
    }
  }
}
