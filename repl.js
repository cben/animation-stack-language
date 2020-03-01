const lang = require('./lang')

// REPL
// ----

const readline = require('readline')
const chalk = require('chalk')

const yeelight_rgb = require('./yeelight_rgb')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

// bidi hack — TODO use this depending on language
//
// Using a visible char because invisible chars like U+200F RIGHT-TO-LEFT MARK
// don't seem to affect pterm (Putty) which is currently bidi terminal I use.
const RIGHT_TO_LEFT = '׃' // U+05C3 HEBREW PUNCTUATION SOF PASUQ
const PROMPT = '؟ ' // U+061F ARABIC QUESTION MAKR

const showAnim = anim => {
  let s = ''
  if(anim.duration < 0.1) {
    s = showColor(anim.color(0))('❙') // U+2759 MEDIUM VERTICAL BAR
  } else {
    for(time = 0; time <= anim.duration; time += 0.2) {
      s += showColor(anim.color(time))('█') // U+2588 FULL BLOCK
    }
  }
  return('[' + s + ']')
}

const showStack = stack => (
  stack.slice().reverse().map(anim => (
    RIGHT_TO_LEFT +
      ' '.repeat(20) +
      showAnim(anim) + '\n'
  )).join('')
)

const playAnim = async anim => {
  // TODO use actual elapsed time instead of regular time steps
  const step = 0.001
  for(time = 0; time <= anim.duration; time += step) {
    const pos = Math.round(time / 0.2) // position inside [.....] above
    const color = anim.color(time)
    const colored = showColor(color)
    await process.stdout.write(RIGHT_TO_LEFT +
                         ' '.repeat(3) +
                         '(' + colored('⬤').repeat(5) + ')' + // U+2B24 BLACK LARGE CIRCLE
                         colored('-').repeat((20 + '['.length + pos) - (3 + 1 + 5 + 1)) +
                         '^' +
                         '\r')
    await yeelight_rgb.playColor(color)
    await sleep(step * 1000)
  }
  //process.stdout.write('\n')
  process.stdout.write(' '.repeat(60) + '\r')
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

  return stack // is this reachable?
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
  await evalWords(lang.words, [], ['black', 'white',  'fade', 'white', 'black', 'fade', 'swap', 'join'])

  await evalWords(lang.words, [], ['red', 'green',  'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'join', 'fast'])
}

//test()
repl(lang.hebrewWords, [])
