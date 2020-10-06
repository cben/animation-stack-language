const lang = require("./lang.js")

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
  el.append(...stack.map(renderAnim))
  return el
}

var source = document.getElementById("source")
//window.source = source // for debugging

var result = document.getElementById("result")

const showResult = () => {
  stack = evalText([], source.value, source.selectionStart)
  result.replaceChildren(renderStack(stack))
}

const textarea = document.querySelector('textarea');
// TODO wasteful?  https://stackoverflow.com/a/53999418/239657
const events = [
  'keypress',  // Every character written
  'keyup',
  'mousedown',  // Click down
  'touchstart',  // Mobile
  'input',  // Other input events
  'paste',  // Clipboard actions
  'cut',
  'mousemove',  // Selection, dragging text
  'select',  // Some browsers support this event
  'selectstart',  // Some browsers support this event
]
for (let event of events) {
  textarea.addEventListener(event, (...e) => {
    console.log('event:', e)
    showResult()
  })
}

const endOfInput = textarea.value.length
textarea.setSelectionRange(endOfInput, endOfInput)
textarea.focus()

showResult()
