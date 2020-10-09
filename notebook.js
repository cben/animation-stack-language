const lang = require("./lang.js")
const CodeMirror = require('/node_modules/codemirror/lib/codemirror.js')

var dictionary = lang.words

const evalText = (stack0, text, cursorPosition) => {
  let stack = stack0
  // TODO: handle cursor in middle of word.
  // TODO: show evaluation position to user.
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

const showResult = () => {
  charPos = doc.indexFromPos(editor.getCursor("head"))
  stack = evalText([], editor.getValue(), charPos)
  result.querySelector('.stack').replaceWith(renderStack(stack))
}

editor.setCursor({ line: Infinity, ch: Infinity })
editor.on("change", showResult)
editor.on("cursorActivity", showResult)

showResult()
