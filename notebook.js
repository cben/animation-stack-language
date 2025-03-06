const lang = require('./lang.js')
const CodeMirror = require('/node_modules/codemirror/lib/codemirror.js')

const EXAMPLES = {
  en: ` white black
   fade slow
blue
swap

red yellow fade
yellow green fade
glue
green cyan fade
glue
cyan blue fade
glue
blue purple fade
glue

copy
slow
swap

copy
copy reverse glue`,
  he: ` לבן שחור
   מעבר לאט
כחול
החלף

אדום צהוב מעבר
צהוב ירוק מעבר
הדבק
ירוק תכלת מעבר
הדבק
תכלת כחול מעבר
הדבק
כחול סגול מעבר
הדבק

שכפל
לאט
החלף

שכפל
שכפל הפוך הדבק`,
}
var exampleButton = document.getElementById('example')

var langSelector = document.getElementById('lang')

var hasBackend = true  // until proven otherwise

// Set by initEditor() at the end...
var editor, doc

var dictionary = document.getElementById('dictionary')

const showDictionary = () => {
  const words = Object.keys(lang.wordsByLanguage[langSelector.value])
  //words.sort() — actually no, lang.js definition order is logical.
  dictionary.replaceChildren(
    ...words.map(w => {
      let el = document.createElement('span')
      el.innerText = ' ' + w + ' ' // spaces help when copy-pasted
      return el
    })
  )
}

// HACK: Executing word-by-word *as part of CodeMirror parsing*,
// so that we retain the execution state after each word, and also highlight errors.

const editorConfig = () => {
  const dictionary = lang.wordsByLanguage[langSelector.value]
  return {
    mode: { // CM passes this into `modeOptions` 2nd arg below
      name: 'animation-stack-language',
      initialState: lang.initialState(dictionary, []),
    },
    direction: lang.isRightToLeft(langSelector.value) ? 'rtl' : 'ltr',
  }
}

CodeMirror.defineMode('animation-stack-language',
  (cmConfig, modeOptions) => {
    return {
      // Keeping evaluation state inside CodeMirror mode is convenient
      // and even gives us partial caching on edits for free.
      // TODO: once I support function defitions, will need
      // invalidation when another definition is changed.
      startState: () => (
        { langState: modeOptions.initialState }
      ),

      // TODO optimize (CodeMirror by default copies arrays, no need as we're immutable)
      //copyState: (modeState) =>

      token: (stream, modeState) => {
        if (stream.eatSpace()) {
          return ''
        }
        let m = stream.match(/^\S+/)
        if (m.length > 0) {
          const [word] = m
          modeState.langState = lang.evalSmallStep(modeState.langState, word)
          if (modeState.langState.error) {
            if (modeState.langState.error === 'NameError') {
              return 'word unknown'
            } else {
              return 'word error'
            }
          } else {
            return 'word good'
          }
        }
      }
    }
  }
)

var result = document.getElementById('result')

const cssChannel = (val) => Math.round(lang.clipChannel(val)).toString()

const renderColor = (color) => {
  const { red, green, blue } = color

  let el = document.createElement('span')
  el.className = 'moment_color'
  el.textContent = '█' // U+2588 FULL BLOCK
  el.style.color = `rgb(${cssChannel(red)}, ${cssChannel(green)}, ${cssChannel(blue)})`
  return el
}

const renderAnim = (anim) => {
  let el = document.createElement('div')
  el.className = 'animation'
  for (let time = 0; time <= anim.duration; time += 0.2) {
    try {
      el.append(renderColor(anim.color(time)))
    } catch (err) {
      el.append('✗')
    }
  }
  return el
}

const renderStack = (stack) => {
  let el = document.createElement('div')
  el.className = 'stack'
  el.append(...stack.slice().reverse().map(renderAnim))
  return el
}

const renderEvalPosition = (className, textContent, tooltip) => {
  let el = document.createElement('span')
  el.classList.add('eval-position')
  el.classList.add(className)
  el.textContent = textContent
  el.title = tooltip
  return el
}

let bookmark = null

const showResult = () => {
  // Find close word boundary to use as eval position.
  // Going left then right means that when in middle of word, we're evaluating after it.
  // TODO use findWordAt?
  let pos = editor.getCursor('head')
  // Do allow evaluation at very start of document.
  if (pos.line !== 0 || pos.ch !== 0) {
    pos = editor.findPosH(pos, -1, 'word')
    pos = editor.findPosH(pos, 1, 'word')
  }

  if (bookmark !== null) {
    bookmark.clear()
  }

  window.charPos = doc.indexFromPos(pos)
  const token = editor.getTokenAt(pos, true)
  if (token.state.langState.error) {
    if (token.state.langState.error === 'NameError') {
      let widget = renderEvalPosition(
        'cm-unknown', '📖', // U+1F4D6 OPEN BOOK
        token.state.langState.errorMessage)
      bookmark = doc.setBookmark(pos, { widget })
    } else {
      let widget = renderEvalPosition(
        'cm-error', '💥', // U+1F4A5 COLLISION SYMBOL, double-width
        token.state.langState.errorMessage)
      bookmark = doc.setBookmark(pos, { widget })
    }
  } else {
    let widget = renderEvalPosition('cm-good', '👀') // U+1F440 EYES
    bookmark = doc.setBookmark(pos, { widget })
  }
  const stack = token.state.langState.stack
  result.querySelector('.stack').replaceWith(renderStack(stack))
}

// Also send whole code to backend.
// NOT sensitive to cursor position, so you can use UI to probe execution process without disturbing the room lighting.
const sendToBackend = () => {
  if (hasBackend) {
    // KLUDGE: Async, not awaiting.
    const codeForBackend = { __lang__: langSelector.value, main: doc.getValue() }
    fetch('/api/code', { method: 'PUT', body: JSON.stringify(codeForBackend) })
    console.log('sent to backend', codeForBackend)
  }
}

var sourceTextArea = document.getElementById('source')
console.log(sourceTextArea.value)

const initEditor = () => {
  editor = CodeMirror.fromTextArea(
    sourceTextArea,
    {
      autofocus: true,
      viewportMargin: Infinity, // https://codemirror.net/demo/resize.html
      ...editorConfig(),
    }
  )
  doc = editor.getDoc()

  editor.setCursor({ line: Infinity, ch: Infinity }) // end of doc
  editor.on('change', showResult)
  editor.on('cursorActivity', showResult)
  editor.on('change', sendToBackend)

  langSelector.onchange = () => {
    for (const [name, value] of Object.entries(editorConfig())) {
      editor.setOption(name, value)
    }
    showResult()
    sendToBackend()
    showDictionary()
  }

  exampleButton.onclick = () => {
    doc.setValue(EXAMPLES[langSelector.value])
    editor.setCursor({ line: Infinity, ch: Infinity }) // end of doc
    showResult()
    sendToBackend()
  }

  showDictionary()
  showResult()
}

// Try loading last executed code from server.
// Can fail if no backend running, just static netlify.
// Wait either way before setting up editor to avoid race conditions.
fetch('/api/code', { mode: 'no-cors' })
  .then((response) => {
    if (response.status !== 200) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.json().then((result) => {
      console.log('Got initial code.', result)
      langSelector.value = result.__lang__
      sourceTextArea.value = result.main
    })
  })
  // Network error, HTTP errors (404), JSON.parse error
  .catch((err) => {
    console.error('Error getting initial code.', err)
    hasBackend = false
    langSelector.value = lang.userLanguage()
  })
  // Separated here so errors evaluating (e.g. stack underflow)
  // don't make us give up `hasBackend = false`.
  .then(initEditor)
