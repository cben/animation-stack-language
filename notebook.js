const lang = require("./lang.js")
const CodeMirror = require('/node_modules/codemirror/lib/codemirror.js')

var dictionary = lang.words

// Returns {stack, }
const evalText = (stack0, text, cursorPosition) => {
  let stack = stack0
  const program = text.slice(0, cursorPosition).trim()
  const programWords = program === "" ? [] : program.split(/\s+/)
  console.log(programWords)
  for (w of programWords) {
    // TODO show error on unknown word (now crashes).
    stack = dictionary[w](stack)
  }
  return stack
}

const cssChannel = (val) => Math.round(lang.clipChannel(val)).toString()

const renderColor = (color) => {
  const { red, green, blue } = color

  let el = document.createElement("span")
  el.className = "moment_color"
  el.textContent = "█" // U+2588 FULL BLOCK
  el.style.color = `rgb(${cssChannel(red)}, ${cssChannel(green)}, ${cssChannel(blue)})`
  return el
}

const renderAnim = (anim) => {
  let el = document.createElement("div")
  el.className = "animation"
  for (let time = 0; time <= anim.duration; time += 0.2) {
    el.append(renderColor(anim.color(time)))
  }
  return el
}

const renderStack = (stack) => {
  let el = document.createElement("div")
  el.className = "stack"
  el.append(...stack.slice().reverse().map(renderAnim))
  return el
}

var editor = CodeMirror.fromTextArea(
  document.getElementById("source"),
  {
    autofocus: true,
    viewportMargin: Infinity, // https://codemirror.net/demo/resize.html
  }
)
var doc = editor.getDoc()

var result = document.getElementById("result")

const renderEvalPosition = (success) => {
  let el = document.createElement("span")
  if (success) {
    el.className = "eval-position eval-good"
    el.textContent = "👀"
  } else {
    el.className = "eval-position eval-error"
    el.textContent = "💥"
  }

  return el
}

let bookmark = null;

const showResult = () => {
  // Find close word boundary to use as eval position.
  // Going left then right means that when in middle of word, we're evaluating after it.
  // TODO use findWordAt?
  let pos = editor.getCursor("head")
  // Do allow evaluation at very start of document.
  if (pos.line !== 0 || pos.ch !== 0) {
    pos = editor.findPosH(pos, -1, "word")
    pos = editor.findPosH(pos, 1, "word")
  }

  if (bookmark !== null) {
    bookmark.clear()
  }

  charPos = doc.indexFromPos(pos)
  let stack = []
  try {
    stack = evalText([], editor.getValue(), charPos)
    let widget = renderEvalPosition(true)
    bookmark = doc.setBookmark(pos, { widget })
  } catch (e) {
    let widget = renderEvalPosition(false)
    bookmark = doc.setBookmark(pos, { widget })
  }
  result.querySelector('.stack').replaceWith(renderStack(stack))
}

editor.setCursor({ line: Infinity, ch: Infinity })
editor.on("change", showResult)
editor.on("cursorActivity", showResult)

showResult()
