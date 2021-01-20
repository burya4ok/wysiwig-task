document.addEventListener('DOMContentLoaded', () => {
  const defaultFontSize = +window.getComputedStyle(document.documentElement).fontSize.replace('px', '')

  const editArea = document.getElementById('edit-area')

  const header1Button = document.getElementById('head-1')
  const header2Button = document.getElementById('head-2')
  const boldButton = document.getElementById('bold')
  const italicButton = document.getElementById('italic')

  const header1ClassName = 'header1-text'
  const header2ClassName = 'header2-text'
  const boldClassName = 'bold-text'
  const italicClassName = 'italic-text'

  const cssRulesForHeaders = Array.from(document.styleSheets)
    .reduce((rules, styleSheet) => rules.concat(Array.from(styleSheet.cssRules)), [])
    .filter((rule) => rule.selectorText.includes(header1ClassName) || rule.selectorText.includes(header2ClassName))

  const copyHandler = (isCut = false) => (event) => {
    const selection = document.getSelection()
    const selectionContent = selection.getRangeAt(0).cloneContents()

    const convertNodeStyles = (node) => {
      if (node.nodeType !== 3) {
        if (node.className) {
          convertStylesToInline(node, node.className.toLowerCase())
        }

        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            convertNodeStyles(node.childNodes[i])
          }
        }
      }
      return node
    }

    const convertedChildren = Array.from(selectionContent.childNodes).map(convertNodeStyles)

    const wrap = document.createElement('div')

    wrap.append(...convertedChildren)

    event.clipboardData.setData('text/html', wrap.innerHTML)

    if (isCut) {
      selection.deleteFromDocument()
    }

    event.preventDefault()
  }

  const convertStylesToInline = (node, className) => {
    const cssRule = cssRulesForHeaders.find((r) => r.selectorText.includes(className))
    if (cssRule) {
      Array.from(cssRule.style).forEach((styleName) => {
        let value = cssRule.style[styleName]

        if (value.includes('rem')) {
          const relativeValue = parseFloat(value)
          value = relativeValue * defaultFontSize + 'px'
        }
        node.style[styleName] = value
      })
    }
  }

  editArea.addEventListener('copy', copyHandler())
  editArea.addEventListener('cut', copyHandler(true))

  const header1ButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: header1ClassName, isHeader: true })
  }

  const header2ButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: header2ClassName, isHeader: true })
  }

  const boldButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: boldClassName })
  }
  const italicButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: italicClassName })
  }

  header1Button.onclick = header1ButtonHanlder
  header2Button.onclick = header2ButtonHanlder
  boldButton.onclick = boldButtonHanlder
  italicButton.onclick = italicButtonHanlder
})

const getSelection = async () => {
  return new Promise((resolve) => {
    let selectedSelection = null

    if (window && window.getSelection) {
      selectedSelection = window.getSelection()
    } else if (document && document.getSelection) {
      selectedSelection = document.getSelection()
    } else if (document && document.selection) {
      selectedSelection = document.selection.createRange().text
    }

    resolve(selectedSelection)
  })
}

const isContainer = (containers, element) => {
  const containerTypes = containers.toLowerCase().split(',')
  return element && element.nodeName && containerTypes.includes(element.nodeName.toLowerCase())
}

const execCommandWithAction = async (selection, action, containers = 'div') => {
  if (!document || !selection) {
    return
  }

  const anchorNode = selection.anchorNode

  if (!anchorNode) {
    return
  }

  const container =
    anchorNode.nodeType !== Node.TEXT_NODE && anchorNode.nodeType !== Node.COMMENT_NODE
      ? anchorNode
      : anchorNode.parentElement

  const sameSelection = container && container.innerText === selection.toString()

  if (
    sameSelection &&
    !isContainer(containers, container) &&
    (container.className.includes(action.className) || action.isHeader)
  ) {
    await updateSelection(container, action)

    return
  }

  await replaceSelection(container, action, selection)
}

const updateSelection = async (container, action) => {
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

  await cleanChildren(action, container)
}

const replaceSelection = async (container, action, selection) => {
  const range = selection.getRangeAt(0)

  if (
    range.commonAncestorContainer &&
    ['span', 'h1', 'h2'].some((listType) => listType === range.commonAncestorContainer.nodeName.toLowerCase())
  ) {
    await updateSelection(range.commonAncestorContainer, action)
    return
  }

  const fragment = range.extractContents()

  const el = createElement(action)
  el.appendChild(fragment)

  await cleanChildren(action, el)
  await flattenChildren(action, el)

  range.insertNode(el)
  selection.selectAllChildren(el)
}

const cleanChildren = async (action, el) => {
  if (!el.hasChildNodes()) {
    return
  }

  // Clean direct (> *) children with same style
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

  // Direct children (> *) may have children (*) which need to be cleaned too
  const cleanChildrenChildren = Array.from(el.children).map((element) => {
    return cleanChildren(action, element)
  })

  if (!cleanChildrenChildren || cleanChildrenChildren.length <= 0) {
    return
  }

  await Promise.all(cleanChildrenChildren)
}

const extendAndReplaceElement = (element, action) => {
  const selection = document.getSelection()
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

// We try to not keep <el/> in the tree if we can use text
const flattenChildren = async (action, el) => {
  if (!el.hasChildNodes()) {
    return
  }

  // Flatten direct (> *) children with no style
  const children = Array.from(el.children).filter((element) => {
    const className = element.getAttribute('className') || element.className
    return !className || className === ''
  })

  if (children && children.length > 0) {
    children.forEach((element) => {
      // Can only be flattened if there is no other style applied to a children, like a color to part of a text with a background
      const styledChildren = element.querySelectorAll(action.className)
      if (!styledChildren || styledChildren.length === 0) {
        const text = document.createTextNode(element.textContent)
        element.parentElement.replaceChild(text, element)
      }
    })

    return
  }

  // Direct children (> *) may have children (*) which need to be flattened too
  const flattenChildrenChildren = Array.from(el.children).map((element) => {
    return flattenChildren(action, element)
  })

  if (!flattenChildrenChildren || flattenChildrenChildren.length <= 0) {
    return
  }

  await Promise.all(flattenChildrenChildren)
}
