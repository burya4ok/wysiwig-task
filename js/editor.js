document.addEventListener('DOMContentLoaded', () => {
  const editArea = document.getElementById('edit-area')

  const header1Button = document.getElementById('head-1')
  const header2Button = document.getElementById('head-2')
  const boldButton = document.getElementById('bold')
  const italicButton = document.getElementById('italic')

  const header1ButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: 'header1-text', isHeader: true })
  }

  const header2ButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: 'header2-text', isHeader: true })
  }

  const boldButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: 'bold-text' })
  }
  const italicButtonHanlder = async () => {
    editArea.focus()

    execCommandWithAction(await getSelection(), { className: 'italic-text' })
  }

  // const keyMapper = (callback, options) => {
  //   const eventType = (options && options.eventType) || 'keydown'
  //   const keystrokeDelay = (options && options.keystrokeDelay) || 800

  //   let state = {
  //     buffer: [],
  //     lastKeyTime: Date.now(),
  //   }

  //   document.addEventListener(eventType, (event) => {
  //     const key = event.key.toLowerCase()
  //     const currentTime = Date.now()
  //     let buffer = []

  //     if (currentTime - state.lastKeyTime > keystrokeDelay) {
  //       buffer = [key]
  //     } else {
  //       buffer = [...state.buffer, key]
  //     }

  //     state = { buffer: buffer, lastKeyTime: currentTime }

  //     callback(buffer)
  //   })
  // }

  // const handleShortcuts = (keys = []) => {
  //   console.log(keys)
  //   if (keys.includes('meta') && keys.includes('b')) {
  //     boldButtonHanlder()
  //     return
  //   }
  //   if (keys.includes('meta') && keys.includes('i')) {
  //     italicButtonHanlder()
  //     return
  //   }
  //   if (keys.includes('meta') && keys.includes('shift') && keys.includes('1')) {
  //     header1ButtonHanlder()
  //     return
  //   }
  //   if (keys.includes('meta') && keys.includes('shift') && keys.includes('2')) {
  //     header2ButtonHanlder()
  //     return
  //   }
  // }

  // keyMapper(handleShortcuts)

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
    await updateSelection(container, action, containers)

    return
  }

  await replaceSelection(container, action, selection, containers)
}

const updateSelection = async (container, action) => {
  if (action.isHeader && !container.className.includes(action.className)) {
    container.className = action.className
  } else if (container.className.includes(action.className)) {
    container.className = container.className.replace(action.className, '')
  } else {
    container.className += ` ${action.className}`
  }

  await cleanChildren(action, container)
}

const replaceSelection = async (container, action, selection, containers) => {
  const range = selection.getRangeAt(0)

  if (
    range.commonAncestorContainer &&
    ['span'].some((listType) => listType === range.commonAncestorContainer.nodeName.toLowerCase())
  ) {
    await updateSelection(range.commonAncestorContainer, action, containers)
    return
  }

  const fragment = range.extractContents()

  const span = await createSpan(container, action, containers)
  span.appendChild(fragment)

  await cleanChildren(action, span)
  await flattenChildren(action, span)

  range.insertNode(span)
  selection.selectAllChildren(span)
}

const cleanChildren = async (action, span) => {
  if (!span.hasChildNodes()) {
    return
  }

  // Clean direct (> *) children with same style
  const children = Array.from(span.children).filter((element) => {
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
  const cleanChildrenChildren = Array.from(span.children).map((element) => {
    return cleanChildren(action, element)
  })

  if (!cleanChildrenChildren || cleanChildrenChildren.length <= 0) {
    return
  }

  await Promise.all(cleanChildrenChildren)
}

const createSpan = async (container, action) => {
  const span = document.createElement('span')
  span.className = action.className

  return span
}

// We try to not keep <span/> in the tree if we can use text
const flattenChildren = async (action, span) => {
  if (!span.hasChildNodes()) {
    return
  }

  // Flatten direct (> *) children with no style
  const children = Array.from(span.children).filter((element) => {
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
  const flattenChildrenChildren = Array.from(span.children).map((element) => {
    return flattenChildren(action, element)
  })

  if (!flattenChildrenChildren || flattenChildrenChildren.length <= 0) {
    return
  }

  await Promise.all(flattenChildrenChildren)
}
