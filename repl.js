const lang = require('./lang')

// Terminal REPL
// -------------

const readline = require('readline')
const chalk = require('chalk')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

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
    'ע' + // bidi hack
      ' '.repeat(20) +
      showAnim(anim) + '\n'
  )).join('')
)

// TODO column is kludge
const playColor = async (color, {column}) => {
    const colored = showColor(color)
    process.stdout.write('ע' + // bidi hack
                         ' '.repeat(3) +
                         '(' + colored('⬤').repeat(5) + ')' + // U+2B24 BLACK LARGE CIRCLE
                         colored('-').repeat((20 + '['.length + column) - (3 + 1 + 5 + 1)) +
                         '^' +
                         '\r')
}

const playAnim = async (anim, options) => {
  const step = 0.05
  for(time = 0; time <= anim.duration; time += step) {
    const column = Math.round(time / 0.2) // position inside [.....] above
    await options.playColor(anim.color(time), {column})
    await sleep(step * 1000)
  }
  //process.stdout.write('\n')
  process.stdout.write(' '.repeat(60) + '\r')
}

const playStack = async (stack, options) => {
  console.log(showStack(stack))
  if (stack.length > 0) {
    await playAnim(stack[0], options)
  }
}

const repl = async (stack0, options) => {
  let stack = stack0
  await playStack(stack, options)

  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  reader.on('line', async w => {
    if (options.dictionary[w]) {
      stack = options.dictionary[w](stack)
      await playStack(stack, options)
    } else {
      console.error('מה?')
      await showStack(stack, options)
    }
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

repl([], {dictionary: lang.hebrewWords, playColor: playColor})

module.exports = {
  playColor,
  repl,
}
