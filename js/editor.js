const STYLES_KEYS = [
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'line-height',
  'font-family',
  'color',
  'background-color',
]

const NEW_LINE_NODE = 'br'

document.addEventListener('DOMContentLoaded', () => {
  const editArea = document.getElementById('edit-area')

  const header1Button = document.getElementById('head-1')
  const header2Button = document.getElementById('head-2')
  const boldButton = document.getElementById('bold')
  const italicButton = document.getElementById('italic')

  const header1ClassName = 'header1-text'
  const header2ClassName = 'header2-text'
  const boldClassName = 'bold-text'
  const italicClassName = 'italic-text'

  const copyHandler = (isCut = false) => (event) => {
    const selection = getSelection()
    const styledText = getStyledTextOfSelection(editArea, selection)

    event.clipboardData.setData('text/html', styledText)

    if (isCut) {
      selection.deleteFromDocument()
    }

    event.preventDefault()
  }

  const hanldleNewLine = (event) => {
    if (event.key === 'Enter') {
      document.execCommand('insertLineBreak')
      event.preventDefault()
    }
  }

  editArea.addEventListener('copy', copyHandler())
  editArea.addEventListener('cut', copyHandler(true))
  editArea.addEventListener('keydown', hanldleNewLine)

  const header1ButtonHanlder = () => {
    editArea.focus()

    execCommandWithAction(getSelection(), { className: header1ClassName, isHeader: true })
  }

  const header2ButtonHanlder = () => {
    editArea.focus()

    execCommandWithAction(getSelection(), { className: header2ClassName, isHeader: true })
  }

  const boldButtonHanlder = () => {
    editArea.focus()

    execCommandWithAction(getSelection(), { className: boldClassName })
  }
  const italicButtonHanlder = () => {
    editArea.focus()

    execCommandWithAction(getSelection(), { className: italicClassName })
  }

  header1Button.onclick = header1ButtonHanlder
  header2Button.onclick = header2ButtonHanlder
  boldButton.onclick = boldButtonHanlder
  italicButton.onclick = italicButtonHanlder
})

const isElementNode = (node) => {
  return node.nodeType === Node.ELEMENT_NODE
}

const isTextNode = (node) => {
  return node.nodeType === Node.TEXT_NODE
}

const isCommentNode = (node) => {
  return node.nodeType === Node.TEXT_NODE
}

const isContainer = (containers, element) => {
  const containerTypes = containers.toLowerCase().split(',')
  return element && element.nodeName && containerTypes.includes(element.nodeName.toLowerCase())
}

const getStyledTextOfSelection = (element, selection) => {
  const nodeList = []

  element.childNodes.forEach((childNode) => {
    if (!selection.containsNode(childNode, true)) return

    const childNodeClone = childNode.cloneNode(false)

    applyComputedStyle(childNode, childNodeClone)
    cloneSelectedNode(selection, childNode, childNodeClone)

    nodeList.push(childNodeClone)
  })

  let text = ''

  nodeList.forEach((childElement) => {
    text += childElement.outerHTML || childElement.textContent || ''
  })

  return text
}

const cloneSelectedNode = (selection, node, nodeClone) => {
  if (!selection.containsNode(node, true)) return

  const range = selection.getRangeAt(0)

  let childNode = node.firstChild

  while (childNode) {
    if (!selection.containsNode(childNode, true)) {
      break
    }

    const childNodeClone = childNode.cloneNode(false)

    applyComputedStyle(childNode, childNodeClone)

    nodeClone.appendChild(childNodeClone)

    if (isTextNode(childNode)) {
      const isStartContainer = childNode === range.startContainer
      const isEndContainer = childNode === range.endContainer
      const currentTextContent = childNode.textContent || ''
      const startOffset = isStartContainer ? range.startOffset : 0
      const endOffset = isEndContainer ? range.endOffset : currentTextContent.length
      childNodeClone.textContent = currentTextContent.slice(startOffset, endOffset)
    }

    if (isElementNode(childNode)) {
      cloneSelectedNode(selection, childNode, childNodeClone)
    }

    childNode = childNode.nextSibling
  }
}

const applyComputedStyle = (currentNode, cloneNode) => {
  if (!isElementNode(currentNode) || !isElementNode(cloneNode)) return cloneNode

  const computedStyle = window.getComputedStyle(currentNode)

  STYLES_KEYS.forEach((key) => {
    const value = computedStyle.getPropertyValue(key)
    cloneNode.style.setProperty(key, value)
  })

  return cloneNode
}

const getSelection = () => {
  let selectedSelection = null

  if (window && window.getSelection) {
    selectedSelection = window.getSelection()
  } else if (document && document.getSelection) {
    selectedSelection = document.getSelection()
  } else if (document && document.selection) {
    selectedSelection = document.selection.createRange().text
  }

  return selectedSelection
}

const execCommandWithAction = (selection, action, containers = 'div') => {
  if (!document || !selection) {
    return
  }

  const anchorNode = selection.anchorNode

  if (!anchorNode) {
    return
  }

  const container =
    isTextNode(anchorNode.nodeType) && !isCommentNode(anchorNode.nodeType) ? anchorNode : anchorNode.parentElement

  const sameSelection = container && container.innerText === selection.toString()

  if (
    sameSelection &&
    !isContainer(containers, container) &&
    (container.className.includes(action.className) || action.isHeader)
  ) {
    updateSelection(container, action)

    return
  }

  replaceSelection(container, action, selection)
}

const updateSelection = (container, action) => {
  if (action.isHeader) {
    if (!container.className.includes(action.className)) {
      if (container.tagName.toLowerCase() === 'span') {
        extendAndReplaceElement(container, action)
      } else {
        container.className = action.className
      }
    } else {
      container.className = container.className.replace(action.className, '')
      extendAndReplaceElement(container, { className: '' })
    }
  } else if (container.className.includes(action.className)) {
    container.className = container.className.replace(action.className, '')
  } else {
    container.className += ` ${action.className}`
  }

  cleanChildren(action, container)
}

const replaceSelection = (container, action, selection) => {
  const range = selection.getRangeAt(0)

  if (
    range.commonAncestorContainer &&
    ['span', 'h1', 'h2'].some((listType) => listType === range.commonAncestorContainer.nodeName.toLowerCase())
  ) {
    updateSelection(range.commonAncestorContainer, action)
    return
  }

  const fragment = range.extractContents()

  const el = createElement(action)
  el.appendChild(fragment)

  cleanChildren(action, el)
  flattenChildren(action, el)

  range.insertNode(el)
  selection.selectAllChildren(el)
}

const cleanChildren = (action, el) => {
  if (!el.hasChildNodes()) {
    return
  }

  const children = Array.from(el.children).filter((element) => {
    return element.className.includes(action.className)
  })

  if (children && children.length > 0) {
    children.forEach((element) => {
      element.className = element.className.replace(action.className, '')

      if (element.getAttribute('className') === '' || element.className === null) {
        element.removeAttribute('className')
      }
    })
  }

  const cleanChildrenChildren = Array.from(el.children).map((element) => {
    return cleanChildren(action, element)
  })

  if (!cleanChildrenChildren || cleanChildrenChildren.length <= 0) {
    return
  }

  cleanChildrenChildren
}

const extendAndReplaceElement = (element, action) => {
  const selection = getSelection()
  const newElement = createElement(action)

  newElement.className += ` ${element.className}`
  newElement.innerHTML = element.innerHTML

  element.replaceWith(newElement)

  selection.selectAllChildren(newElement)
}

const createElement = (action) => {
  let element = 'span'

  switch (action.className) {
    case 'header1-text': {
      element = 'h1'
      break
    }
    case 'header2-text': {
      element = 'h2'
      break
    }
  }
  const el = document.createElement(element)
  el.className = action.className

  return el
}

const flattenChildren = (action, el) => {
  if (!el.hasChildNodes()) {
    return
  }

  const children = Array.from(el.children).filter((element) => {
    const className = element.getAttribute('className') || element.className
    return !className || className === ''
  })

  if (children && children.length > 0) {
    children.forEach((element) => {
      const styledChildren = element.querySelectorAll(action.className)
      if (!styledChildren || styledChildren.length === 0) {
        if (element.nodeName.toLowerCase() !== NEW_LINE_NODE) {
          const text = document.createTextNode(element.textContent || element.outerHTML)
          element.parentElement.replaceChild(text, element)
        }
      }
    })

    return
  }

  const flattenChildrenChildren = Array.from(el.children).map((element) => {
    return flattenChildren(action, element)
  })

  if (!flattenChildrenChildren || flattenChildrenChildren.length <= 0) {
    return
  }

  return flattenChildrenChildren
}
