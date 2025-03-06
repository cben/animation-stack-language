const lang = require('./lang')

// REPL
// ----

const readline = require('readline')
const chalk = require('chalk')
const stringWidth = require('string-width')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

// Returns a function from text to colored text.
const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

// bidi hack
//
const LANG = lang.userLanguage()
let PROMPT, DIRECTION
if (lang.isRightToLeft(LANG)) {
  PROMPT = '؟ ' // U+061F ARABIC QUESTION MARK
  // Using a visible char because invisible chars like U+200F RIGHT-TO-LEFT MARK
  // don't seem to affect pterm (Putty) which is currently bidi terminal I use.
  DIRECTION = '׃' // U+05C3 HEBREW PUNCTUATION SOF PASUQ
} else {
  PROMPT = '? '
  DIRECTION = ' '
}

const ERROR_CHAR = '✗' // U+2717 BALLOT X

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
    DIRECTION +
    ' '.repeat(ANIM_INDENT) +
    showAnim(anim) + '\n'
  )).join('')
)

const playAnim = async anim => {
  const duration = lang.getDuration(anim)
  const animWidth = stringWidth(showAnim(anim))
  const step = 0.05
  for (let time = 0; time <= duration; time += step) {
    let colored, bulbChar, errorMessage
    try {
      const color = anim.color(time)
      colored = showColor(color)
      bulbChar = '⬤'.repeat(6)  // U+2B24 BLACK LARGE CIRCLE
      errorMessage = ''
    } catch (e) {
      colored = char => char
      bulbChar = '💥'.repeat(3) // U+1F4A5 COLLISION SYMBOL, double-width
      errorMessage = chalk.red(ERROR_CHAR + ' ' + e)
    }
    const bulb = ' '.repeat(3) + '(' + colored(bulbChar) + ')'

    //                     [██████████]
    // (⬤⬤⬤⬤⬤⬤)------------^       ✗ errorMessage
    const posInAnim = Math.round(time / 0.2)
    process.stdout.write(DIRECTION +
      bulb +
      colored('-').repeat(-stringWidth(bulb) + ANIM_INDENT + '['.length + posInAnim) +
      '^' +
      ' '.repeat(-(posInAnim + '^'.length) + animWidth + 2) +
      errorMessage +
      '\r')
    await sleep(step * 1000)
  }
  //process.stdout.write('\n')
  process.stdout.write(' '.repeat(ANIM_INDENT + animWidth) + '\r')
}

const playStack = async stack => {
  console.log(showStack(stack))
  if (stack.length > 0) {
    await playAnim(stack[0])
  }
}

const repl = async (dictionary, stack0) => {
  const allCompletions = Object.keys(dictionary).sort()
  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: line => {
      // If user moves cursor, the `line` this gets is just from start to cursor.
      // No `.trim()` — here we want `foo bar|` to complete `bar...` words vs. `foo bar |` to complete all known words.
      const lastWord = line.split(/\s+/).at(-1)
      let options = allCompletions.filter(w => w.startsWith(lastWord))
      // Append space after unique completion.  Both convenient and informative.
      // `a` -> `add ` vs. `r` -> `re` (ambiguous `red`, `reverse`, needs another Tab to see that).
      if (options.length === 1) {
        options = [options[0] + ' ']
      }
      return [options, lastWord]
    },
    prompt: PROMPT,
  })

  let state = lang.initialState(dictionary, stack0)
  await playStack(state.stack)

  reader.prompt()
  reader.on('line', async line => {
    for (let w of line.trim().split(/\s+/)) {
      if (w == '') {
        // Allow <Enter> to re-display stack, useful after losing sight from errors and completions
        await playStack(state.stack)
      } else {
        state = lang.evalSmallStep(state, w)
        if (state.error) {
          console.error(`${ERROR_CHAR} ${state.error}: ${state.errorMessage}`)
        } else {
          await playStack(state.stack)
        }
      }
    }
    reader.prompt()
  })

  // would be nice to return final state, but all evaluation
  // happens async in reader callback after we return. 
}

// TODO extract common loop from this and interactive repl()
const evalWords = async (dictionary, stack0, program) => {
  let state = lang.initialState(dictionary, stack0)
  await playStack(state.stack)
  await sleep(500)
  for (const w of program) {
    console.log('#', w)
    state = lang.evalSmallStep(state, w)
    if (state.error) {
      console.log(chalk.red(`${ERROR_CHAR} ${state.error}: ${state.errorMessage}`))
    }
    await playStack(state.stack)
    await sleep(500)
  }
  return state.stack
}

// TEST
// ----
// todo move somewhere

const test = async () => {
  const dictionary = lang.wordsByLanguage.en
  // test error handling.
  await evalWords(dictionary, [], ['fade', 'yellow', 'fade', 'swap', 'cyan', 'purple', 'fade', 'swap', 'XYZ', 'swap'])
  await evalWords(dictionary, [], ['black', 'white', 'fade', 'white', 'black', 'fade', 'swap', 'glue'])
  await evalWords(dictionary, [], ['red', 'green', 'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'glue', 'fast'])
}

//test()
repl(lang.wordsByLanguage[lang.userLanguage()], [])
