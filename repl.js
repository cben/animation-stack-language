const lang = require('./lang')

// REPL
// ----

const readline = require('readline')
const chalk = require('chalk')
const stringWidth = require('string-width')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

// Returns a function from text to colored text.
const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

// bidi hack — TODO use this depending on language
//
// Using a visible char because invisible chars like U+200F RIGHT-TO-LEFT MARK
// don't seem to affect pterm (Putty) which is currently bidi terminal I use.
const RIGHT_TO_LEFT = '׃' // U+05C3 HEBREW PUNCTUATION SOF PASUQ
const PROMPT = '؟ ' // U+061F ARABIC QUESTION MARK

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
    RIGHT_TO_LEFT +
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
    process.stdout.write(RIGHT_TO_LEFT +
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
    completer: line => (
      [allCompletions.filter(w => w.startsWith(line)), line]
    ),
    prompt: PROMPT,
  })

  let stack = stack0
  await playStack(stack)

  reader.prompt()
  reader.on('line', async w => {
    if (w == '') {
      // Allow <Enter> to re-display stack, useful after losing sight from errors and completions
      await playStack(stack)
    } else if (dictionary[w]) {
      stack = dictionary[w](stack)
      await playStack(stack)
    } else {
      console.error(chalk.red('מה?'))
    }
    reader.prompt()
  })

  // would be nice to return final state, but all evaluation
  // happens async in reader callback after we return. 
}

// TODO extract common loop from this and interactive repl()
const evalWords = async (dictionary, stack0, program) => {
  let stack = stack0
  await playStack(stack)
  await sleep(500)
  for(w of program) {
    console.log('#', w)
    stack = dictionary[w](stack)
    await playStack(stack)
    await sleep(500)
  }
  return stack
}

// TEST
// ----
// todo move somewhere

const test = async () => {
  // test error handling.
  await evalWords(lang.words, [], ['fade', 'yellow', 'fade', 'swap', 'cyan', 'purple', 'fade', 'swap', 'swap'])

  await evalWords(lang.words, [], ['black', 'white', 'fade', 'swap', 'white', 'black', 'fade', 'swap', 'join'])

  await evalWords(lang.words, [], ['red', 'green', 'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'join', 'fast'])
}

//test()
repl(lang.hebrewWords, [])
