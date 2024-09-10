const lang = require('./lang')

// REPL
// ----

const leds = require('./apa102_led_strip')

const readline = require('readline')
const chalk = require('chalk')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

const showAnim = anim => {
  let s = ''
  if(anim.duration < 0.1) {
    s = showColor(anim.color(0))('❙') // U+2759 MEDIUM VERTICAL BAR
  } else {
    for(let time = 0; time <= anim.duration; time += 0.2) {
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

// TODO: use shared time source to synchronize parallel animations to actual
// passage of time, instead of each one doing independent sleep().

const playAnim = async anim => {
  const step = 0.05
  for(let time = 0; time <= anim.duration; time += step) {
    const pos = Math.round(time / 0.2) // position inside [.....] above
    const color = anim.color(time)
    const colored = showColor(color)
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

const ledsShowStackAtTime = async (stack, time) => {
  //process.stdout.write(time + ' ')
  for(let i = 0; i < leds.NLEDS; i++) {
    if(i < stack.length) {
      const anim = stack[i]
      // animate, when done, revert to initial color
      const color = anim.color(time <= anim.duration ? time : 0)
      // TODO: leds are far too bright, not similar to colors on screen
      // (e.g. dark brown on screen is still quite bright pink on leds)
      leds.setRGBb(i, lang.clipChannel(color.red), lang.clipChannel(color.green), lang.clipChannel(color.blue), 255)
      //process.stdout.write(showColor(color)(' ' + i))
    } else {
      // clear to black beyond bottom of stack
      leds.setRGBb(i, 0, 0, 0, 0)
    }
  }
  await leds.send()
  //process.stdout.write('\n')
}

const ledsPlayStack = async stack => {
  if(stack.length === 0) {
    await ledsShowStackAtTime(stack, 0) // force clearing LED strip to black.
    return
  }
  const maxDuration = Math.max(...stack.map(a => a.duration))
  const step = 0.05
  // TODO: it seems white->black fades don't reach complete fade, why?
  for(let time = 0; time <= maxDuration; time += step) {
    await ledsShowStackAtTime(stack, time)
    await sleep(step * 1000)
  }
}

const playStack = async stack => {
  console.log(showStack(stack))
  const promises = [ledsPlayStack(stack)]
  if (stack.length > 0) {
    promises.push(playAnim(stack[0]))
  }
  await Promise.all(promises)
}

const repl = async (dictionary, stack0) => {
  let stack = stack0
  await playStack(stack)

  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  reader.on('line', async line => {
    line.trim().split(/\s+/).forEach(w => {
      if (dictionary[w]) {
        stack = dictionary[w](stack)
      } else {
        console.error(`${w}: מה?`)
      }
    })
    await playStack(stack)
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
  await evalWords(lang.words, [], ['black', 'white',  'fade', 'white', 'black', 'fade', 'swap', 'glue'])

  await evalWords(lang.words, [], ['red', 'green',  'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'glue', 'fast'])
}

//test()
repl(lang.hebrewWords, [])
