const { initialState } = require('./lang.js')
const lang = require('./lang.js')
const CodeMirror = require('/node_modules/codemirror/lib/codemirror.js')

var langSelector = document.getElementById('lang')
langSelector.value = lang.userLanguage()

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
          [word] = m
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

var editor = CodeMirror.fromTextArea(
  document.getElementById('source'),
  {
    autofocus: true,
    viewportMargin: Infinity, // https://codemirror.net/demo/resize.html
    ...editorConfig(),
  }
)
var doc = editor.getDoc()

var result = document.getElementById('result')

const renderEvalPosition = (className, textContent, tooltip) => {
  let el = document.createElement('span')
  el.classList.add('eval-position')
  el.classList.add(className)
  el.textContent = textContent
  el.title = tooltip
  return el
}

let bookmark = null;

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

  charPos = doc.indexFromPos(pos)
  const token = editor.getTokenAt(pos, true)
  if (token.state.langState.error) {
    if (token.state.langState.error === 'NameError') {
      let widget = renderEvalPosition(
        'cm-unknown', '📖', // U+1F4D6 OPEN BOOK
        token.state.langState.errorMessage)
      bookmark = doc.setBookmark(pos, { widget })
    } else {
      let widget = renderEvalPosition(
        'cm-error', '💥',  // U+1F4A5 COLLISION SYMBOL, double-width
        token.state.langState.errorMessage)
      bookmark = doc.setBookmark(pos, { widget })
    }
  } else {
    let widget = renderEvalPosition('cm-good', '👀')  // U+1F440 EYES
    bookmark = doc.setBookmark(pos, { widget })
  }
  const stack = token.state.langState.stack
  result.querySelector('.stack').replaceWith(renderStack(stack))
}

// Also send whole code to backend.
// NOT sensitive to cursor position, so you can use UI to probe execution process without disturbing the room lighting.
const sendToBackend = () => {
    // KLUDGE: Async, not awaiting.
    const codeForBackend = { __lang__: langSelector.value, main: doc.getValue() }
    fetch("/api/code", { method: "PUT", body: JSON.stringify(codeForBackend) })
    console.log('sent to backend', codeForBackend)  
}

editor.setCursor({ line: Infinity, ch: Infinity })
editor.on('change', showResult)
editor.on('cursorActivity', showResult)
editor.on('change', sendToBackend)

langSelector.onchange = () => {
  for (const [name, value] of Object.entries(editorConfig())) {
    editor.setOption(name, value)
  }
  showResult()
  sendToBackend()
}

showResult()
