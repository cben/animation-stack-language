const lang = require('./lang')
const leds = require('./apa102_led_strip')

const http = require('node:http')
const staticHandler = require('serve-handler')
const chalk = require('chalk')

const evalWords = (dictionary, stack0, program) => {
  let state = lang.initialState(dictionary, stack0)
  var errors = []
  for (const w of program) {
    state = lang.evalSmallStep(state, w)
    if (state.error) {
      // log and continue, so mis-spelled words are not end of the world.
      // TODO attribute error to position in code?
      errors.push(`${ERROR_CHAR} ${state.error}: ${state.errorMessage}`)
    }
  }
  return { state, errors }
}

const processCode = (code) => {
  const dictionary = lang.wordsByLanguage[code.__lang__ || 'en']
  const program = code.main.trim() === '' ? [] : code.main.trim().split(/\s+/)
  return evalWords(dictionary, [], program)
}

// SHARED MUTABLE STATE
// --------------------
// These can be replaced (but not mutated) via HTTP at any time; main thread keeps displaying result of current code.
var code = {
  __lang__: 'en',
  main: '', // allowing for multi-function programs in future?
}
var evalResults = processCode(code)
// --------------------


// SERVER
// ------

var server = http.createServer((request, response) => {
  if (!request.url.startsWith('/api/')) {
    return staticHandler(request, response, { etag: true })
  }
  if (request.url === '/api/code') {
    if (request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(code))
    }
    if (request.method === 'PUT') {
      var body = ''
      request.on('data', (data) => { body += data })
      request.on('end', () => {
        try {
          code = JSON.parse(body)
          evalResults = processCode(code)
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify('OK'))
        } catch (err) {
          response.writeHead(400, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(err.toString()))
        }
      })
    }
  }
})
server.listen(4321)

const TITLE = '>>> Serving on http://localhost:4321 <<<\n\n'

// DISPLAY
// -------

// TODO: share code with repl.js?  Drop repl.js?
//   - repl.js implements playing animations as function of time.
//     Still want that for Yeelight lamp (1D) and maybe LED strips (2D?)

// Returns a function from text to colored text.
const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

// bidi hack — TODO use this depending on language
//
// Using a visible char because invisible chars like U+200F RIGHT-TO-LEFT MARK
// don't seem to affect pterm (Putty) which is currently bidi terminal I use.
const RIGHT_TO_LEFT = '׃' // U+05C3 HEBREW PUNCTUATION SOF PASUQ
const PROMPT = '؟ ' // U+061F ARABIC QUESTION MARK

const ERROR_CHAR = '✗' // U+2717 BALLOT X

const ANSI_HOME = '\x1b[H'
const ANSI_CURSOR_INVISIBLE = '\x1b[?25l'
const ANSI_CURSOR_VISIBLE = '\x1b[?25l'
const ANSI_CLEAR_CURSOR_TO_EOL = '\x1b[0K'
const ANSI_CLEAR_CURSOR_TO_END = '\x1b[0J'

const showAnim = anim => {
  let s = ''
  const duration = lang.getDuration(anim)
  if (duration < 0.1) {
    try {
      s = showColor(anim.color(0))('❙') // U+2759 MEDIUM VERTICAL BAR
    } catch (e) {
      s = chalk.red(ERROR_CHAR)
    }
  } else {
    for (let time = 0; time <= duration; time += 0.2) {
      try {
        s += showColor(anim.color(time))('█') // U+2588 FULL BLOCK
      } catch (e) {
        s += chalk.red(ERROR_CHAR)
      }
    }
  }
  return ('[' + s + ']')
}

const ANIM_INDENT = 20

const showStack = stack => (
  stack.slice().reverse().map(anim => (
    RIGHT_TO_LEFT +
    ' '.repeat(ANIM_INDENT) +
    showAnim(anim) + '\n'
  )).join('')
)

const BRIGHTNESS = parseInt(process.env.LEDS_BRIGHTNESS) || 255

const ledsShowStackAtTime = async (stack, time) => {
  //process.stdout.write(time + ' ')
  let led = 0
  for(let i = stack.length - 1; i >= 0; i--) {
    const anim = stack[i]
    // animate, when done, stay at final color
    //const color = anim.color(Math.min(time, anim.duration))
    // TODO: leds are far too bright, not similar to colors on screen
    // (e.g. dark brown on screen is still quite bright pink on leds)
    for(let t = 0; t <= anim.duration; t += 0.2) {
      const color = anim.color(Math.min(t, anim.duration))
      if(led < leds.NLEDS) {
        leds.setRGBb(led++, lang.clipChannel(color.red), lang.clipChannel(color.green), lang.clipChannel(color.blue), BRIGHTNESS)
      }
      //process.stdout.write(showColor(color)(' ' + i))
    }

    // And a bigger gap between stack items:
    leds.setRGBb(led++, 0, 0, 0, 0)
    leds.setRGBb(led++, 0, 0, 0, 0)
    leds.setRGBb(led++, 0, 0, 0, 0)
  }

  // clear to black beyond bottom of stack
  while(led < leds.NLEDS) {
    leds.setRGBb(led++, 0, 0, 0, 0)
  }
  await leds.send()
  //process.stdout.write('\n')
}

const showResult = async () => {
  const printWithClearing = (text) => {
    process.stdout.write(text.replaceAll('\n', ANSI_CLEAR_CURSOR_TO_EOL + '\n'))
  }
  printWithClearing(ANSI_HOME + TITLE + '\n')
  const { state, errors } = evalResults

  printWithClearing(showStack(state.stack))
  for (const e of errors) {
    printWithClearing(chalk.red(e) + '\n')
  }
  // clearing after printing reduces flicker
  printWithClearing('? ' + code.main + ANSI_CLEAR_CURSOR_TO_END)
  await ledsShowStackAtTime(state.stack, 0)
}

showResultContinuously = () =>
  showResult().then(() => setTimeout(showResultContinuously, 1000))

showResultContinuously()
