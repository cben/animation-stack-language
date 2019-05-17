// Color helpers
// -------------
// {red, green, blue} using 0..255 interval
// TODO 255 not friendly to kids, probably want 0..100 range, but what's best internal representation?

// TODO there is probably an npm module doing all this better

const COLOR_MAX = 255
const clipChannel = v => (v < 0 ? 0 : v > COLOR_MAX ? COLOR_MAX : v)

const mapChannels1 = (color, f) => (
  {
    red: clipChannel(f(color.red)),
    green: clipChannel(f(color.green)),
    blue: clipChannel(f(color.blue)),
  }
)

const mapChannels2 = (c1, c2, f) => (
  {
    red: clipChannel(f(c1.red, c2.red)),
    green: clipChannel(f(c1.green, c2.green)),
    blue: clipChannel(f(c1.blue, c2.blue)),
  }
)

// For additive colors I'll use "light" terminology.

const addLight = (c1, c2) => (
  mapChannels2(c1, c2, (v1, v2) => v1 + v2)
)

// fraction between [0.0, 1.0]
const mixLight = (c1, c2, fraction) => (
  mapChannels2(c1, c2, (v1, v2) => v1*fraction + v2*(1-fraction))
)

// Words
// =====
// f(stack) -> stack.
// Stacks are represented as arrays, 0 is top.
//
// Types on stack
// --------------
// (these are likely to change!)
// - Animation:
//   .duration attribute in seconds
//   .color(time in [0,duration]) -> {red, green, blue}
// - Fixed color on stack represented as animation with .duration == 0
// - Number: TODO
// - Error: TODO value or exception?
//   TODO: voice message

let words = {}

const constWord = (value) => (
  stack => [value, ...stack]
)

const fixedColor = (red, green, blue) => ({
  duration: 0,
  color: time => ({red, green, blue}),
})

words.black = constWord(fixedColor(0, 0, 0))
words.red = constWord(fixedColor(COLOR_MAX, 0, 0))
words.green = constWord(fixedColor(0, COLOR_MAX, 0))
words.blue = constWord(fixedColor(0, 0, COLOR_MAX))
words.white = constWord(fixedColor(COLOR_MAX, COLOR_MAX, COLOR_MAX))

const finalColor = anim => anim.color(anim.duration)


// TODO: stack manipulation helpers — do I need a Stack class with methods?
// TODO: error for not enough arguments

const unaryWord = unaryFunc => (
  stack => {
    const [x, ...rest] = stack
    return [unaryFunc(x), ...rest]
  }
)

words.reverse = unaryWord(a => (
  {
    duration: a.duration,
    color: time => a.color(a.duration - time),
  }
))

words.slow = unaryWord(a => (
  {
    duration: a.duration * 2,
    color: time => a.color(time / 2),
  }
))

words.fast = unaryWord(a => (
  {
    duration: a.duration / 2,
    color: time => a.color(time * 2),
  }
))

const binaryWord = binaryFunc => (
  stack => {
    const [x, y, ...rest] = stack
    // TODO order?
    return [binaryFunc(x, y), ...rest]
  }
)

words.fade = binaryWord((a1, a2) => {
  // TODO should fade do something smarter given animations with duration?
  const c1 = finalColor(a1)
  const c2 = finalColor(a2)
  return {
    duration: 1.0,
    color: time => mixLight(c1, c2, time)
  }
})

// TODO naming: definitely not "concat". maybe "append"?
words.join = binaryWord((a2, a1) => (
  {
    duration: a1.duration + a2.duration,
    color: time => time < a1.duration ? a1.color(time) : a2.color(time - a1.duration),
  }
))

// 2 -> 2 word

words.swap = ([x, y, ...rest]) => [y, x, ...rest]

// i18n

hebrewWords = {
  שחור: words.black,
  ירוק: words.green,
  אדום: words.red,
  כחול: words.blue,
  לבן: words.white,
  הפוך: words.reverse, הפוכ: words.reverse,
  מהר: words.fast,
  לאט: words.slow,
  מעבר: words.fade,
  חבר: words.join,
  החלף: words.swap,
}

// REPL
// ----

const readline = require('readline')
const chalk = require('chalk')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

const showColor = color => chalk.rgb(Math.round(color.red), Math.round(color.green), Math.round(color.blue))

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

const playAnim = async anim => {
  const step = 0.05
  for(time = 0; time <= anim.duration; time += step) {
    const pos = Math.round(time / 0.2) // position inside [.....] above
    const colored = showColor(anim.color(time))
    process.stdout.write('ע' + // bidi hack
                         ' '.repeat(3) +
                         '(' + colored('⬤').repeat(5) + ')' + // U+2B24 BLACK LARGE CIRCLE
                         colored('-').repeat((20 + '['.length + pos) - (3 + 1 + 5 + 1)) +
                         '^' +
                         '\r')
    await sleep(step * 1000)
  }
  //process.stdout.write('\n')
  process.stdout.write(' '.repeat(60) + '\r')
}

const playStack = async stack => {
  console.log('ע' + // bidi hack
              ' '.repeat(20) +
              stack.map(showAnim).join('  '))
  if (stack.length > 0) {
    await playAnim(stack[0])
  }
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

const repl = async (dictionary, stack0) => {
  let stack = stack0
  await playStack(stack)

  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  reader.on('line', async w => {
    if (dictionary[w]) {
      stack = dictionary[w](stack)
    } else {
      console.error('מה?')
    }
    await playStack(stack)
  })

  return stack // is this reachable?
}

// TEST
// ----
// todo move somewhere

const test = async () => {
  await evalWords(words, [], ['black', 'white',  'fade', 'white', 'black', 'fade', 'swap', 'join'])

  await evalWords(words, [], ['red', 'green',  'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'join', 'fast'])
}

//test()
repl(hebrewWords, [])
